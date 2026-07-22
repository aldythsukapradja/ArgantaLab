// Petrophysics.tsx (V1b) — INTERPRETED (Equinor LFP) vs RECOMPUTE (Archie via
// engine/petro) dual-mode track viewer with live param sliders, an
// interpreted-vs-derived residual track, and a Hugin-bounded zone-average table
// that writes to the shared props store (consumed by Property + Volumetrics).
import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useAsync, useCanvas, cssVar } from './hooks';
import { Inspector, InspectorSection, Segmented, Slider, inputStyle, Loading, ErrorBanner, withAlpha } from './chrome';
import { NatureBadge } from '../../components/Provenance';
import { loadIndex, loadPicks } from '../../wb/load';
import type { WbIndex } from '../../wb/types';
import { loadWellPetro, recompute, interpretedZone, derivedZone, upscale, type WellPetro, type RecomputeParams } from './fdData';
import type { PicksJson } from '../../wb/types';
import { DEFAULT_CUTOFFS } from '../../engine/petro';
import { usePropsStore } from './propsStore';

type Mode = 'interpreted' | 'recompute';

interface TrackDef { id: string; label: string; min: number; max: number; getInt?: (c: WellPetro['log']['curves']) => (number|null)[]|undefined; color: string; reverse?: boolean }

export function Petrophysics() {
  const idx = useAsync<WbIndex>(loadIndex, []);
  const picks = useAsync<PicksJson>(loadPicks, []);
  if (idx.loading || picks.loading) return <Loading what="petrophysics data" />;
  if (idx.error || !idx.data || !picks.data) return <ErrorBanner msg={idx.error || 'index unavailable'} />;
  return <Inner index={idx.data} picks={picks.data} />;
}

function Inner({ index, picks }: { index: WbIndex; picks: PicksJson }) {
  // wells with logs, prefer those with LFP + Hugin picks first.
  const logWells = useMemo(() => index.wells.filter((w) => w.has.logs), [index]);
  const [well, setWell] = useState('19 A');
  const [mode, setMode] = useState<Mode>('interpreted');
  const [inspOpen, setInspOpen] = useState(true);
  const [zoom, setZoom] = useState({ lo: 0, hi: 1 });
  const [hoverDepth, setHoverDepth] = useState<number | null>(null);
  const dragRef = useRef<{ y: number; lo: number; hi: number } | null>(null);
  const setWellProp = usePropsStore((s) => s.setWell);

  const wellRow = logWells.find((w) => w.name === well) ?? logWells[0];
  const wpRes = useAsync<WellPetro | null>(() => loadWellPetro(wellRow, picks), [well]);

  // recompute params (LFP defaults where available)
  const [p, setP] = useState<RecomputeParams>({ grMin: 25, grMax: 90, rw: 0.03, rhoMa: 2.65, rhoFl: 1.0, a: 1, m: 2, n: 2, phiSh: 0.1, vshMethod: 'larionov_tertiary' });
  const [cuts, setCuts] = useState(DEFAULT_CUTOFFS);

  // seed grMin/grMax/rw from the LFP curves when a well loads
  useEffect(() => {
    const wp = wpRes.data; if (!wp) return;
    const c = wp.log.curves;
    const first = (k: string) => c[k]?.values.find((v) => v != null) ?? undefined;
    setP((prev) => ({
      ...prev,
      grMin: (first('GRMIN') as number) ?? prev.grMin,
      grMax: (first('GRMAX') as number) ?? prev.grMax,
      rw: (first('RW') as number) ?? prev.rw,
      rhoMa: (first('RHOMA') as number) ?? prev.rhoMa,
    }));
  }, [wpRes.data]);

  const wp = wpRes.data;
  const rc = useMemo(() => (wp ? recompute(wp.log, p) : null), [wp, p]);
  const intZone = useMemo(() => (wp ? interpretedZone(wp, cuts) : null), [wp, cuts]);
  const derZone = useMemo(() => (wp && rc ? derivedZone(wp, rc, cuts) : null), [wp, rc, cuts]);
  const up = useMemo(() => (wp ? upscale(wp) : null), [wp]);

  // write to shared props store when a valid interpreted zone exists
  useEffect(() => {
    if (!wp || !wp.interval) return;
    const z = intZone; if (!z || z.grossM <= 0) return;
    setWellProp({
      well: wp.well.name, x: wp.well.x, y: wp.well.y,
      ntg: z.ntg, phie: z.phie, sw: z.sw, netM: z.netM, grossM: z.grossM,
      phieDerived: derZone?.phie, swDerived: derZone?.sw,
      phieUp: up?.phieUp ?? undefined, netSand: up?.netSand, facies: up?.facies,
    });
  }, [wp, intZone, derZone, up, setWellProp]);

  const tracks: TrackDef[] = useMemo(() => [
    { id: 'gr', label: 'GR', min: 0, max: 150, color: cssVar('--teal'), getInt: (c) => c.GR?.values },
    { id: 'phie', label: 'PHIE', min: 0.5, max: 0, reverse: true, color: cssVar('--teal'), getInt: (c) => c.PHIE?.values },
    { id: 'sw', label: 'SW', min: 1, max: 0, reverse: true, color: cssVar('--blue'), getInt: (c) => c.SWE?.values },
    { id: 'vsh', label: 'VSH', min: 0, max: 1, color: cssVar('--orange'), getInt: (c) => c.VSH?.values },
    { id: 'resid', label: 'PHIE resid', min: -0.1, max: 0.1, color: cssVar('--rose') },
  ], []);

  const md = wp?.log.md ?? [];
  const dRange = md.length ? { min: md[0], max: md[md.length - 1] } : { min: 0, max: 1 };
  const view = { lo: dRange.min + (dRange.max - dRange.min) * zoom.lo, hi: dRange.min + (dRange.max - dRange.min) * zoom.hi };

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (!wp) return;
    const headH = 34, laneAvail = w - headH;
    const tW = laneAvail / tracks.length;
    const d2p = (d: number) => ((d - view.lo) / Math.max(1e-6, view.hi - view.lo)) * h;
    const line = cssVar('--line'), muted = cssVar('--muted'), text = cssVar('--text');
    const c = wp.log.curves;
    const derived = rc;

    // Hugin interval band
    if (wp.interval) {
      const a = d2p(wp.interval.topMd), b = d2p(wp.interval.baseMd);
      ctx.fillStyle = withAlpha(cssVar('--amber'), 0.12);
      ctx.fillRect(headH, Math.min(a, b), w - headH, Math.abs(b - a));
      ctx.strokeStyle = cssVar('--amber'); ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
      for (const yy of [a, b]) { ctx.beginPath(); ctx.moveTo(headH, yy); ctx.lineTo(w, yy); ctx.stroke(); }
      ctx.setLineDash([]);
    }

    tracks.forEach((t, ti) => {
      const x0 = headH + ti * tW;
      ctx.strokeStyle = line; ctx.lineWidth = 0.5; ctx.strokeRect(x0, 0, tW, h);
      const norm = (v: number) => Math.max(0, Math.min(1, (v - t.min) / (t.max - t.min)));
      const plot = (vals: (number|null)[]|undefined, color: string, dash: boolean) => {
        if (!vals) return;
        ctx.strokeStyle = color; ctx.lineWidth = 1.1; ctx.setLineDash(dash ? [4, 3] : []);
        ctx.beginPath(); let started = false;
        for (let i = 0; i < md.length; i++) {
          const d = md[i]; if (d < view.lo - 5 || d > view.hi + 5) continue;
          const v = vals[i]; if (v == null || !isFinite(v)) { started = false; continue; }
          const px = x0 + norm(v) * tW, py = d2p(d);
          if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
        }
        ctx.stroke(); ctx.setLineDash([]);
      };
      if (t.id === 'resid') {
        // interpreted − derived PHIE residual (0.5 = zero line)
        const pi = c.PHIE?.values, pd = derived?.phie;
        if (pi && pd) {
          ctx.strokeStyle = 'var(--muted)'; ctx.lineWidth = 0.5; ctx.setLineDash([2, 2]);
          ctx.beginPath(); ctx.moveTo(x0 + tW / 2, 0); ctx.lineTo(x0 + tW / 2, h); ctx.stroke(); ctx.setLineDash([]);
          const resid: (number|null)[] = md.map((_, i) => (pi[i] != null && pd[i] != null ? (pi[i]! - pd[i]!) : null));
          plot(resid, t.color, false);
        }
      } else {
        // interpreted (solid) + derived (dashed) overlay
        const intVals = t.getInt?.(c);
        if (mode === 'interpreted' || mode === 'recompute') plot(intVals, t.color, false);
        const dv = t.id === 'phie' ? derived?.phie : t.id === 'sw' ? derived?.sw : t.id === 'vsh' ? derived?.vsh : undefined;
        if (dv) plot(dv, cssVar('--violet'), true);
        // GR cutoff lines
        if (t.id === 'gr') {
          for (const [val, col] of [[p.grMin, cssVar('--muted')], [p.grMax, cssVar('--muted')]] as const) {
            const px = x0 + norm(val) * tW;
            ctx.strokeStyle = col; ctx.setLineDash([2, 4]); ctx.lineWidth = 0.75;
            ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke(); ctx.setLineDash([]);
          }
        }
      }
      // header
      ctx.fillStyle = text; ctx.font = '9px var(--mono)'; ctx.textAlign = 'center';
      ctx.fillText(t.label, x0 + tW / 2, 12);
      ctx.fillStyle = muted; ctx.font = '8px var(--mono)';
      ctx.fillText(`${t.min}–${t.max}`, x0 + tW / 2, 22);
    });

    // depth ticks
    ctx.fillStyle = muted; ctx.strokeStyle = line; ctx.font = '8.5px var(--mono)'; ctx.textAlign = 'left'; ctx.lineWidth = 0.5;
    const span = view.hi - view.lo, step = Math.pow(10, Math.floor(Math.log10(span / 8))) * (span/8/Math.pow(10,Math.floor(Math.log10(span/8))) < 1.5 ? 1 : 5);
    for (let d = Math.ceil(view.lo / step) * step; d <= view.hi; d += step) {
      const py = d2p(d); ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(headH, py); ctx.stroke();
      ctx.fillText(String(Math.round(d)), 2, py - 2);
    }

    // hover crosshair + readout
    if (hoverDepth != null && hoverDepth >= view.lo && hoverDepth <= view.hi) {
      const py = d2p(hoverDepth);
      ctx.strokeStyle = text; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(headH, py); ctx.lineTo(w, py); ctx.stroke();
      let lo = 0, hi = md.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (md[m] < hoverDepth) lo = m + 1; else hi = m; }
      const gr = c.GR?.values[lo], pe = c.PHIE?.values[lo], pd = derived?.phie[lo];
      const label = `MD ${hoverDepth.toFixed(1)}  GR ${gr?.toFixed(0) ?? '–'}  φe ${pe?.toFixed(3) ?? '–'}${pd != null ? `  φ' ${pd.toFixed(3)}` : ''}`;
      ctx.font = '9px var(--mono)'; const tw = ctx.measureText(label).width + 10;
      ctx.fillStyle = cssVar('--panel'); ctx.fillRect(headH + 4, Math.min(py + 4, h - 16), tw, 14);
      ctx.strokeStyle = line; ctx.strokeRect(headH + 4, Math.min(py + 4, h - 16), tw, 14);
      ctx.fillStyle = text; ctx.textAlign = 'left'; ctx.fillText(label, headH + 9, Math.min(py + 4, h - 16) + 10);
    }
  }, [wp, rc, tracks, view.lo, view.hi, md, hoverDepth, mode, p]);

  const { canvasRef, wrapRef } = useCanvas(draw, [draw]);

  const evtDepth = (e: React.MouseEvent): number => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return view.lo + ((e.clientY - rect.top) / rect.height) * (view.hi - view.lo);
  };
  const onWheel = (e: React.WheelEvent) => {
    const at = (evtDepth(e as unknown as React.MouseEvent) - dRange.min) / (dRange.max - dRange.min);
    const sp = zoom.hi - zoom.lo, ns = Math.max(0.03, Math.min(1, sp * (e.deltaY < 0 ? 0.88 : 1 / 0.88)));
    let lo = at - (at - zoom.lo) * (ns / sp), hi = lo + ns;
    if (lo < 0) { lo = 0; hi = ns; } if (hi > 1) { hi = 1; lo = 1 - ns; }
    setZoom({ lo, hi });
  };

  const discrepancy = (a?: number, b?: number) => (a != null && b != null ? (a - b) : null);

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderBottom: '1px solid var(--line)', background: 'var(--panel)', flexWrap: 'wrap' }}>
          <select value={well} onChange={(e) => { setWell(e.target.value); setZoom({ lo: 0, hi: 1 }); }} style={{ ...inputStyle, width: 'auto' }}>
            {logWells.map((w) => <option key={w.name} value={w.name}>{w.name}{w.has.picks ? '' : ' (no picks)'}</option>)}
          </select>
          <Segmented options={[{ id: 'interpreted' as const, label: 'Interpreted (LFP)' }, { id: 'recompute' as const, label: 'Recompute (Archie)' }]} value={mode} onChange={setMode} accent="--violet" />
          <button onClick={() => setZoom({ lo: 0, hi: 1 })} style={{ ...inputStyle, width: 'auto', cursor: 'pointer', color: 'var(--muted)' }}>Fit depth</button>
          <div style={{ flex: 1 }} />
          <NatureBadge nature={mode === 'interpreted' ? 'interpreted' : 'derived'} />
          <button onClick={() => setInspOpen((o) => !o)} title="Inspector" style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 4, border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--muted)' }}>
            <SlidersHorizontal size={15} />
          </button>
        </div>
        <div ref={wrapRef} style={{ flex: 1, minHeight: 60, position: 'relative', overflow: 'hidden', cursor: 'crosshair' }}>
          {wpRes.loading ? <Loading what={`${well} logs`} /> : !wp ? <ErrorBanner msg={`No logs for ${well}`} /> : (
            <canvas ref={canvasRef} onWheel={onWheel}
              onMouseMove={(e) => { setHoverDepth(evtDepth(e)); if (dragRef.current) { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); const df = ((e.clientY - dragRef.current.y) / rect.height) * (zoom.hi - zoom.lo); let lo = dragRef.current.lo - df, hi = dragRef.current.hi - df; if (lo < 0) { lo = 0; hi = dragRef.current.hi - dragRef.current.lo; } if (hi > 1) { hi = 1; lo = 1 - (dragRef.current.hi - dragRef.current.lo); } setZoom({ lo, hi }); } }}
              onMouseDown={(e) => { dragRef.current = { y: e.clientY, lo: zoom.lo, hi: zoom.hi }; }}
              onMouseUp={() => { dragRef.current = null; }} onMouseLeave={() => { dragRef.current = null; setHoverDepth(null); }}
              style={{ display: 'block', width: '100%', height: '100%' }} />
          )}
        </div>
      </div>

      <Inspector title="Petrophysics inspector" open={inspOpen} onToggle={() => setInspOpen(false)}>
        <InspectorSection title={`Zone averages · Hugin interval`}>
          {!wp?.interval && <div style={{ fontSize: 11, color: 'var(--muted)' }}>No Hugin picks for {well} — pick-bounded averages unavailable. Zone table shows only wells with Hugin Top/Base picks (the 15/9-19 exploration set).</div>}
          {wp?.interval && intZone && (
            <table className="mono" style={{ width: '100%', fontSize: 10.5, borderCollapse: 'collapse' }}>
              <thead><tr style={{ color: 'var(--muted)', textAlign: 'right' }}><th style={{ textAlign: 'left' }}></th><th>Interp</th><th>Derived</th><th>Δ</th></tr></thead>
              <tbody>
                {([['NTG', intZone.ntg, derZone?.ntg], ['PHIE', intZone.phie, derZone?.phie], ['SW', intZone.sw, derZone?.sw]] as const).map(([k, iv, dv]) => (
                  <tr key={k} style={{ textAlign: 'right' }}>
                    <td style={{ textAlign: 'left', color: 'var(--text)' }}>{k}</td>
                    <td style={{ color: 'var(--teal)' }}>{iv.toFixed(3)}</td>
                    <td style={{ color: 'var(--violet)' }}>{dv != null ? dv.toFixed(3) : '–'}</td>
                    <td style={{ color: 'var(--rose)' }}>{discrepancy(iv, dv) != null ? discrepancy(iv, dv)!.toFixed(3) : '–'}</td>
                  </tr>
                ))}
                <tr style={{ textAlign: 'right', color: 'var(--muted)' }}><td style={{ textAlign: 'left' }}>net/gross m</td><td colSpan={3}>{intZone.netM.toFixed(1)} / {intZone.grossM.toFixed(1)}</td></tr>
              </tbody>
            </table>
          )}
          <div style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 6 }}>Interpreted → written to shared props store for Property + Volumetrics.</div>
        </InspectorSection>

        <InspectorSection title="Archie / cutoff params">
          <Slider label="GR min" min={0} max={100} step={1} value={p.grMin} onChange={(v) => setP({ ...p, grMin: v })} />
          <Slider label="GR max" min={40} max={200} step={1} value={p.grMax} onChange={(v) => setP({ ...p, grMax: v })} />
          <Slider label="Rw (Ωm)" min={0.005} max={0.2} step={0.001} value={p.rw} onChange={(v) => setP({ ...p, rw: v })} fmt={(v) => v.toFixed(3)} />
          <Slider label="ρma (g/cc)" min={2.55} max={2.75} step={0.01} value={p.rhoMa} onChange={(v) => setP({ ...p, rhoMa: v })} fmt={(v) => v.toFixed(2)} />
          <Slider label="a" min={0.5} max={2} step={0.05} value={p.a} onChange={(v) => setP({ ...p, a: v })} fmt={(v) => v.toFixed(2)} />
          <Slider label="m" min={1.5} max={2.5} step={0.05} value={p.m} onChange={(v) => setP({ ...p, m: v })} fmt={(v) => v.toFixed(2)} />
          <Slider label="n" min={1.5} max={2.5} step={0.05} value={p.n} onChange={(v) => setP({ ...p, n: v })} fmt={(v) => v.toFixed(2)} />
          <Slider label="φsh" min={0} max={0.3} step={0.01} value={p.phiSh} onChange={(v) => setP({ ...p, phiSh: v })} fmt={(v) => v.toFixed(2)} />
        </InspectorSection>
        <InspectorSection title="Net cutoffs">
          <Slider label="Vsh ≤" min={0.2} max={0.8} step={0.05} value={cuts.vsh} onChange={(v) => setCuts({ ...cuts, vsh: v })} fmt={(v) => v.toFixed(2)} />
          <Slider label="φe ≥" min={0.02} max={0.2} step={0.01} value={cuts.phie} onChange={(v) => setCuts({ ...cuts, phie: v })} fmt={(v) => v.toFixed(2)} />
          <Slider label="Sw ≤" min={0.3} max={0.9} step={0.05} value={cuts.sw} onChange={(v) => setCuts({ ...cuts, sw: v })} fmt={(v) => v.toFixed(2)} />
        </InspectorSection>
        <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>Solid = interpreted LFP · dashed violet = Archie recompute. Residual track = interpreted − derived φe.</div>
      </Inspector>
    </div>
  );
}
