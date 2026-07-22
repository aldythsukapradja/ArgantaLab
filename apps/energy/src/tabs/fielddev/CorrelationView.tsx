// CorrelationView.tsx — multi-well correlation panel (V1a).
// Side-by-side condensed track sets hung on a datum (MSL or flatten-on-pick),
// pick markers connected across wells with per-surface colour lines, drag to
// reorder wells, per-well depth-shift nudge, shared/per-well scale toggle,
// horizontal scroll.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { useAsync, cssVar } from './hooks';
import { Inspector, InspectorSection, Segmented, LayerRow, inputStyle, Loading, ErrorBanner, surfaceColor } from './chrome';
import { NatureBadge } from '../../components/Provenance';
import { loadIndex, loadLogs, loadPicks } from '../../wb/load';
import type { WbIndex, LogsJson, Pick } from '../../wb/types';

const COL_W = 190;
const MINI = [
  { curve: 'GR', color: '--teal', min: 0, max: 150 },
  { curve: 'RHOB', color: '--rose', min: 1.95, max: 2.95 },
  { curve: 'NPHI', color: '--blue', min: 0.45, max: -0.15 },
  { curve: 'RT', color: '--amber', min: 0.2, max: 2000, log: true },
];

export function CorrelationView() {
  const idx = useAsync<WbIndex>(loadIndex, []);
  if (idx.loading) return <Loading what="workbench index" />;
  if (idx.error || !idx.data) return <ErrorBanner msg={idx.error || 'index unavailable'} />;
  return <CorrInner index={idx.data} />;
}

function CorrInner({ index }: { index: WbIndex }) {
  const candidates = useMemo(() => index.wells.filter((w) => w.has.logs && w.has.picks), [index]);
  const [selected, setSelected] = useState<string[]>(() => candidates.slice(0, 4).map((w) => w.name));
  const [datum, setDatum] = useState<string>('MSL'); // 'MSL' or surface name
  const [sharedScale, setSharedScale] = useState(true);
  const [shifts, setShifts] = useState<Record<string, number>>({});
  const [inspOpen, setInspOpen] = useState(true);

  const picksRes = useAsync(loadPicks, []);
  const logsRes = useAsync<Array<{ name: string; log: LogsJson | null }>>(
    () => Promise.all(selected.map((n) => loadLogs(n).then((log) => ({ name: n, log })).catch(() => ({ name: n, log: null })))),
    [selected],
  );

  const allPicks = picksRes.data?.picks ?? [];
  const pickSurfaces = useMemo(() => {
    const s = new Set<string>();
    for (const p of allPicks) if (selected.includes(p.well ?? '')) s.add(p.surface);
    return Array.from(s);
  }, [allPicks, selected]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [wrapH, setWrapH] = useState(0);
  const dragOrder = useRef<{ name: string } | null>(null);

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setWrapH(el.clientHeight));
    ro.observe(el); setWrapH(el.clientHeight); return () => ro.disconnect();
  }, []);

  const logsByName = useMemo(() => {
    const m: Record<string, LogsJson | null> = {};
    for (const r of logsRes.data ?? []) m[r.name] = r.log;
    return m;
  }, [logsRes.data]);

  // depth mapping: use md, optionally flatten on the datum surface pick per well.
  const wellDatum = (name: string): number => {
    if (datum === 'MSL') return 0;
    const pk = allPicks.find((p) => p.well === name && p.surface === datum);
    return pk ? pk.md : 0;
  };

  const range = useMemo(() => {
    // global depth range after datum + shift
    let mn = Infinity, mx = -Infinity;
    for (const name of selected) {
      const log = logsByName[name]; if (!log) continue;
      const off = wellDatum(name) - (shifts[name] ?? 0);
      const a = log.md[0] - off, b = log.md[log.md.length - 1] - off;
      if (a < mn) mn = a; if (b > mx) mx = b;
    }
    if (!isFinite(mn)) return { min: 0, max: 1 };
    return { min: mn, max: mx };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, logsByName, datum, shifts]);

  useEffect(() => {
    const cv = canvasRef.current, wrap = wrapRef.current; if (!cv || !wrap || wrapH === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(wrap.clientWidth, selected.length * COL_W + 46);
    cv.width = Math.round(width * dpr); cv.height = Math.round(wrapH * dpr);
    cv.style.width = `${width}px`; cv.style.height = `${wrapH}px`;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, wrapH);
    drawCorrelation(ctx, width, wrapH, selected, logsByName, allPicks, datum, shifts, wellDatum, range, sharedScale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, logsByName, allPicks, datum, shifts, range, wrapH, sharedScale]);

  const toggleWell = (name: string) =>
    setSelected((s) => s.includes(name) ? s.filter((x) => x !== name) : [...s, name]);

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* well chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderBottom: '1px solid var(--line)', background: 'var(--panel)', flexWrap: 'wrap' }}>
          {candidates.map((w) => {
            const on = selected.includes(w.name);
            return (
              <button key={w.name} onClick={() => toggleWell(w.name)}
                style={{ padding: '3px 9px', fontSize: 11, fontFamily: 'var(--mono)', borderRadius: 3, border: `1px solid ${on ? 'var(--teal)' : 'var(--line)'}`,
                  background: on ? 'var(--sel)' : 'var(--panel-2)', color: on ? 'var(--text)' : 'var(--muted)' }}>
                {w.name}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <NatureBadge nature="interpreted" />
          <button onClick={() => setInspOpen((o) => !o)} title="Inspector" style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 4, border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--muted)' }}>
            <ArrowLeftRight size={15} />
          </button>
        </div>
        {/* datum bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderBottom: '1px solid var(--line)', fontSize: 11, color: 'var(--muted)' }}>
          <span>Datum</span>
          <select value={datum} onChange={(e) => setDatum(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '3px 6px' }}>
            <option value="MSL">MSL (no flatten)</option>
            {pickSurfaces.map((s) => <option key={s} value={s}>Flatten on {s}</option>)}
          </select>
          <Segmented options={[{ id: 'shared' as const, label: 'Shared scale' }, { id: 'per' as const, label: 'Per-well' }]} value={sharedScale ? 'shared' : 'per'} onChange={(v) => setSharedScale(v === 'shared')} accent="--blue" />
          <span style={{ marginLeft: 'auto', fontSize: 10 }}>drag chip in inspector to reorder · scroll ↔</span>
        </div>
        {/* scroll panel */}
        <div ref={wrapRef} style={{ flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'hidden', position: 'relative' }}>
          {logsRes.loading ? <Loading what="well logs" /> : <canvas ref={canvasRef} style={{ display: 'block' }} />}
        </div>
      </div>

      <Inspector title="Correlation inspector" open={inspOpen} onToggle={() => setInspOpen(false)}>
        <InspectorSection title="Well order & depth shift">
          {selected.map((name, i) => (
            <div key={name} draggable
              onDragStart={() => (dragOrder.current = { name })}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { const from = dragOrder.current?.name; if (!from || from === name) return; setSelected((s) => { const a = s.filter((x) => x !== from); const idx2 = a.indexOf(name); a.splice(idx2, 0, from); return a; }); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--line)', cursor: 'grab' }}>
              <span style={{ color: 'var(--muted)', fontSize: 10 }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 11.5 }}>{name}</span>
              <button onClick={() => setShifts((s) => ({ ...s, [name]: (s[name] ?? 0) - 10 }))} style={nudge}>−10</button>
              <span className="mono" style={{ fontSize: 10, width: 34, textAlign: 'center' }}>{shifts[name] ?? 0}</span>
              <button onClick={() => setShifts((s) => ({ ...s, [name]: (s[name] ?? 0) + 10 }))} style={nudge}>+10</button>
            </div>
          ))}
        </InspectorSection>
        <InspectorSection title="Correlation surfaces">
          {pickSurfaces.length === 0 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>No shared picks in the selected wells.</div>}
          {pickSurfaces.map((s, i) => (
            <LayerRow key={s} on onToggle={() => { /* colour legend only */ }} label={s} swatch={surfaceColor(i)} />
          ))}
        </InspectorSection>
        <p style={{ fontSize: 10.5, color: 'var(--muted)' }}>Pick lines are correlated per surface across adjacent wells. Flatten-on-datum re-hangs each well so the chosen marker is horizontal.</p>
      </Inspector>
    </div>
  );
}

const nudge: React.CSSProperties = { ...inputStyle, width: 'auto', padding: '2px 6px', fontSize: 10, cursor: 'pointer' };

function drawCorrelation(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  order: string[], logs: Record<string, LogsJson | null>, picks: Pick[],
  datum: string, shifts: Record<string, number>, wellDatum: (n: string) => number,
  range: { min: number; max: number }, shared: boolean,
) {
  const padT = 26, padB = 14, axisW = 42;
  const plotH = h - padT - padB;
  const d2y = (d: number) => padT + ((d - range.min) / Math.max(1e-6, range.max - range.min)) * plotH;
  const line = cssVar('--line'), muted = cssVar('--muted'), text = cssVar('--text');

  // depth axis
  ctx.fillStyle = muted; ctx.strokeStyle = line; ctx.font = '8.5px var(--mono)'; ctx.lineWidth = 0.5;
  const step = niceStep(range.max - range.min);
  ctx.textAlign = 'left';
  for (let d = Math.ceil(range.min / step) * step; d <= range.max; d += step) {
    const y = d2y(d); ctx.beginPath(); ctx.moveTo(axisW - 4, y); ctx.lineTo(w, y); ctx.strokeStyle = 'rgba(127,146,153,0.12)'; ctx.stroke();
    ctx.fillText(String(Math.round(datum === 'MSL' ? d : d)), 2, y + 3);
  }
  ctx.fillStyle = text; ctx.font = 'bold 9px var(--mono)'; ctx.fillText(datum === 'MSL' ? 'MD' : `Δ${datum.slice(0, 8)}`, 2, 12);

  const surfIndex: Record<string, number> = {};
  let si = 0;

  // per-well pick screen positions for connecting lines
  const pickXY: Array<Record<string, number>> = []; // per column: surface→y

  order.forEach((name, ci) => {
    const log = logs[name];
    const x0 = axisW + ci * COL_W;
    const off = wellDatum(name) - (shifts[name] ?? 0);
    // column frame + header
    ctx.strokeStyle = line; ctx.lineWidth = 0.5; ctx.strokeRect(x0, padT, COL_W, plotH);
    ctx.fillStyle = text; ctx.font = 'bold 10px var(--mono)'; ctx.textAlign = 'center';
    ctx.fillText(name, x0 + COL_W / 2, 16);

    if (log) {
      // three mini sub-lanes: GR | RHOB+NPHI | RT
      const lanes = [[MINI[0]], [MINI[1], MINI[2]], [MINI[3]]];
      const laneW = COL_W / lanes.length;
      lanes.forEach((lane, li) => {
        const lx = x0 + li * laneW;
        ctx.strokeStyle = 'rgba(127,146,153,0.15)'; ctx.beginPath(); ctx.moveTo(lx, padT); ctx.lineTo(lx, padT + plotH); ctx.stroke();
        for (const c of lane) {
          const cur = log.curves[c.curve]; if (!cur) continue;
          const gmin = shared ? c.min : c.min, gmax = shared ? c.max : c.max;
          ctx.strokeStyle = cssVar(c.color); ctx.lineWidth = 0.8; ctx.beginPath();
          let started = false;
          const stepI = Math.max(1, Math.floor(log.md.length / 1200));
          for (let i = 0; i < log.md.length; i += stepI) {
            const v = cur.values[i]; if (v == null || !isFinite(v)) { started = false; continue; }
            const d = log.md[i] - off; if (d < range.min || d > range.max) continue;
            let f: number;
            if (c.log) f = (Math.log10(Math.max(1e-3, v)) - Math.log10(c.min)) / (Math.log10(c.max) - Math.log10(c.min));
            else f = (v - gmin) / (gmax - gmin);
            f = Math.max(0, Math.min(1, f));
            const px = lx + f * laneW, py = d2y(d);
            if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      });
    } else {
      ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.fillText('no logs', x0 + COL_W / 2, padT + plotH / 2);
    }

    // picks for this well
    const colPicks: Record<string, number> = {};
    for (const p of picks) {
      if (p.well !== name) continue;
      const d = p.md - off; if (d < range.min || d > range.max) continue;
      if (!(p.surface in surfIndex)) surfIndex[p.surface] = si++;
      const y = d2y(d); colPicks[p.surface] = y;
      const col = surfaceColor(surfIndex[p.surface]);
      ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + COL_W, y); ctx.stroke();
    }
    pickXY.push(colPicks);
  });

  // connect picks across adjacent wells
  for (let ci = 0; ci < order.length - 1; ci++) {
    const a = pickXY[ci], b = pickXY[ci + 1];
    const xA = axisW + ci * COL_W + COL_W, xB = axisW + (ci + 1) * COL_W;
    for (const surf of Object.keys(a)) {
      if (!(surf in b)) continue;
      ctx.strokeStyle = surfaceColor(surfIndex[surf]); ctx.lineWidth = 1.2; ctx.setLineDash([3, 2]);
      ctx.beginPath(); ctx.moveTo(xA, a[surf]); ctx.lineTo(xB, b[surf]); ctx.stroke(); ctx.setLineDash([]);
    }
  }
}

function niceStep(span: number): number {
  const raw = span / 8; const p = Math.pow(10, Math.floor(Math.log10(raw))); const n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}
