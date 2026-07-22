// CorrelationView.tsx — fully interactive multi-well correlation panel (V1a
// polish). Synchronized depth zoom-to-cursor (wheel) + pan across all wells,
// hover crosshair with per-well curve readouts, drag-to-reorder columns directly
// on the panel, per-well depth-shift by dragging a column, animated flatten-on-
// marker, and hover-surface highlighting the correlation line across every well.
// High-DPI canvas, token colours, both themes, reduced-motion safe.
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { useAsync, cssVar } from './hooks';
import { Inspector, InspectorSection, Segmented, LayerRow, inputStyle, Loading, ErrorBanner, surfaceColor, withAlpha } from './chrome';
import { NatureBadge } from '../../components/Provenance';
import { loadIndex, loadLogs, loadPicks } from '../../wb/load';
import type { WbIndex, LogsJson, Pick } from '../../wb/types';

const COL_W = 200;
const AXIS_W = 44;
const PAD_T = 30;
const PAD_B = 14;
const HEAD_H = 22; // draggable header band inside each column
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

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function CorrInner({ index }: { index: WbIndex }) {
  const candidates = useMemo(() => index.wells.filter((w) => w.has.logs && w.has.picks), [index]);
  const [selected, setSelected] = useState<string[]>(() => candidates.slice(0, 4).map((w) => w.name));
  const [datum, setDatum] = useState<string>('MSL');
  const [prevDatum, setPrevDatum] = useState<string>('MSL');
  const [sharedScale, setSharedScale] = useState(true);
  const [shifts, setShifts] = useState<Record<string, number>>({});
  const [inspOpen, setInspOpen] = useState(true);
  const [zoomFrac, setZoomFrac] = useState({ lo: 0, hi: 1 });
  const [hoverDepth, setHoverDepth] = useState<number | null>(null);
  const [hoverSurface, setHoverSurface] = useState<string | null>(null);
  const [anim, setAnim] = useState(1); // flatten transition progress 0→1

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
  const dragRef = useRef<{ kind: 'pan' | 'reorder' | 'shift'; name?: string; sx: number; sy: number; startShift?: number; startLo: number; startHi: number } | null>(null);
  const geomRef = useRef({ w: 0, h: 0 });
  const rafRef = useRef(0);
  const animRef = useRef(0);

  const logsByName = useMemo(() => {
    const m: Record<string, LogsJson | null> = {};
    for (const r of logsRes.data ?? []) m[r.name] = r.log;
    return m;
  }, [logsRes.data]);

  const offsetFor = useCallback((name: string, d: string): number => {
    const base = d === 'MSL' ? 0 : (allPicks.find((p) => p.well === name && p.surface === d)?.md ?? 0);
    return base - (shifts[name] ?? 0);
  }, [allPicks, shifts]);

  // animated effective offset (lerp prevDatum → datum)
  const effOffset = useCallback((name: string): number => {
    const a = offsetFor(name, prevDatum), b = offsetFor(name, datum);
    return a + (b - a) * anim;
  }, [offsetFor, prevDatum, datum, anim]);

  const range = useMemo(() => {
    let mn = Infinity, mx = -Infinity;
    for (const name of selected) {
      const log = logsByName[name]; if (!log) continue;
      const off = effOffset(name);
      const lo = log.md[0] - off, hi = log.md[log.md.length - 1] - off;
      if (lo < mn) mn = lo; if (hi > mx) mx = hi;
    }
    if (!isFinite(mn)) return { min: 0, max: 1 };
    return { min: mn, max: mx };
  }, [selected, logsByName, effOffset]);

  const view = useMemo(() => ({
    lo: range.min + (range.max - range.min) * zoomFrac.lo,
    hi: range.min + (range.max - range.min) * zoomFrac.hi,
  }), [range, zoomFrac]);

  // flatten animation driver
  const startFlatten = (next: string) => {
    if (next === datum) return;
    setPrevDatum(datum); setDatum(next);
    if (reducedMotion()) { setAnim(1); return; }
    cancelAnimationFrame(animRef.current);
    setAnim(0);
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 420);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setAnim(e);
      if (p < 1) animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setWrapH(el.clientHeight));
    ro.observe(el); setWrapH(el.clientHeight); return () => ro.disconnect();
  }, []);

  // draw
  useEffect(() => {
    const cv = canvasRef.current, wrap = wrapRef.current; if (!cv || !wrap || wrapH === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(wrap.clientWidth, selected.length * COL_W + AXIS_W + 4);
    cv.width = Math.round(width * dpr); cv.height = Math.round(wrapH * dpr);
    cv.style.width = `${width}px`; cv.style.height = `${wrapH}px`;
    geomRef.current = { w: width, h: wrapH };
    const ctx = cv.getContext('2d'); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, wrapH);
    drawCorrelation(ctx, width, wrapH, selected, logsByName, allPicks, datum, effOffset, view, sharedScale, hoverDepth, hoverSurface);
  }, [selected, logsByName, allPicks, datum, view, wrapH, sharedScale, hoverDepth, hoverSurface, effOffset]);

  const toggleWell = (name: string) => setSelected((s) => s.includes(name) ? s.filter((x) => x !== name) : [...s, name]);

  // ── interaction ──
  const d2yInv = (py: number): number => {
    const plotH = geomRef.current.h - PAD_T - PAD_B;
    return view.lo + ((py - PAD_T) / Math.max(1, plotH)) * (view.hi - view.lo);
  };
  const colAt = (px: number): number => Math.floor((px - AXIS_W) / COL_W);
  const local = (e: React.MouseEvent): [number, number] => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); return [e.clientX - r.left + (wrapRef.current?.scrollLeft ?? 0), e.clientY - r.top]; };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const [, py] = local(e);
    const at = (d2yInv(py) - range.min) / Math.max(1e-6, range.max - range.min);
    const span = zoomFrac.hi - zoomFrac.lo;
    const ns = Math.max(0.02, Math.min(1, span * (e.deltaY < 0 ? 0.86 : 1 / 0.86)));
    let lo = at - (at - zoomFrac.lo) * (ns / span), hi = lo + ns;
    if (lo < 0) { lo = 0; hi = ns; } if (hi > 1) { hi = 1; lo = 1 - ns; }
    setZoomFrac({ lo, hi });
  };
  const onDown = (e: React.MouseEvent) => {
    const [px, py] = local(e);
    if (px < AXIS_W) { dragRef.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, startLo: zoomFrac.lo, startHi: zoomFrac.hi }; return; }
    const ci = colAt(px); const name = selected[ci];
    if (name == null) { dragRef.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, startLo: zoomFrac.lo, startHi: zoomFrac.hi }; return; }
    if (py < PAD_T + HEAD_H) dragRef.current = { kind: 'reorder', name, sx: e.clientX, sy: e.clientY, startLo: zoomFrac.lo, startHi: zoomFrac.hi };
    else dragRef.current = { kind: 'shift', name, sx: e.clientX, sy: e.clientY, startShift: shifts[name] ?? 0, startLo: zoomFrac.lo, startHi: zoomFrac.hi };
  };
  const onMove = (e: React.MouseEvent) => {
    const [px, py] = local(e);
    setHoverDepth(d2yInv(py));
    const dg = dragRef.current; if (!dg) return;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      if (dg.kind === 'pan') {
        const plotH = geomRef.current.h - PAD_T - PAD_B;
        const dfrac = (e.clientY - dg.sy) / Math.max(1, plotH) * (dg.startHi - dg.startLo);
        let lo = dg.startLo - dfrac, hi = dg.startHi - dfrac;
        if (lo < 0) { lo = 0; hi = dg.startHi - dg.startLo; } if (hi > 1) { hi = 1; lo = 1 - (dg.startHi - dg.startLo); }
        setZoomFrac({ lo, hi });
      } else if (dg.kind === 'shift' && dg.name) {
        const plotH = geomRef.current.h - PAD_T - PAD_B;
        const dMeters = (e.clientY - dg.sy) / Math.max(1, plotH) * (view.hi - view.lo);
        setShifts((s) => ({ ...s, [dg.name!]: Math.round((dg.startShift ?? 0) - dMeters) }));
      } else if (dg.kind === 'reorder' && dg.name) {
        const targetCi = Math.max(0, Math.min(selected.length - 1, colAt(px)));
        const from = selected.indexOf(dg.name);
        if (from !== targetCi && from >= 0) {
          setSelected((s) => { const a = [...s]; a.splice(from, 1); a.splice(targetCi, 0, dg.name!); return a; });
        }
      }
    });
  };
  const onUp = () => { dragRef.current = null; if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; } };

  // hover readout values per well
  const hoverReadout = useMemo(() => {
    if (hoverDepth == null) return [];
    return selected.map((name) => {
      const log = logsByName[name]; if (!log) return null;
      const off = effOffset(name); const md = hoverDepth + off;
      // nearest index
      let lo = 0, hi = log.md.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (log.md[m] < md) lo = m + 1; else hi = m; }
      const gr = log.curves.GR?.values[lo];
      return { name, md, gr: gr == null ? null : gr };
    }).filter(Boolean) as Array<{ name: string; md: number; gr: number | null }>;
  }, [hoverDepth, selected, logsByName, effOffset]);

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderBottom: '1px solid var(--line)', fontSize: 11, color: 'var(--muted)' }}>
          <span>Datum</span>
          <select value={datum} onChange={(e) => startFlatten(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '3px 6px' }}>
            <option value="MSL">MSL (no flatten)</option>
            {pickSurfaces.map((s) => <option key={s} value={s}>Flatten on {s}</option>)}
          </select>
          <Segmented options={[{ id: 'shared' as const, label: 'Shared scale' }, { id: 'per' as const, label: 'Per-well' }]} value={sharedScale ? 'shared' : 'per'} onChange={(v) => setSharedScale(v === 'shared')} accent="--blue" />
          <button onClick={() => setZoomFrac({ lo: 0, hi: 1 })} style={{ ...inputStyle, width: 'auto', padding: '3px 8px', cursor: 'pointer' }}>Fit depth</button>
          <span style={{ marginLeft: 'auto', fontSize: 10 }}>scroll = zoom · drag column body = depth-shift · drag header = reorder</span>
        </div>
        <div ref={wrapRef} style={{ flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'hidden', position: 'relative', cursor: dragRef.current?.kind === 'shift' ? 'ns-resize' : dragRef.current?.kind === 'reorder' ? 'grabbing' : 'crosshair' }}>
          {logsRes.loading ? <Loading what="well logs" /> : (
            <canvas ref={canvasRef} onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={() => { onUp(); setHoverDepth(null); }}
              style={{ display: 'block' }} />
          )}
          {hoverDepth != null && hoverReadout.length > 0 && (
            <div className="mono" style={{ position: 'absolute', left: 48, top: 6, fontSize: 10, color: 'var(--text)', background: 'color-mix(in srgb, var(--panel) 88%, transparent)', border: '1px solid var(--line)', borderRadius: 3, padding: '3px 7px', pointerEvents: 'none', display: 'flex', gap: 10, flexWrap: 'wrap', maxWidth: '90%' }}>
              <span style={{ color: 'var(--muted)' }}>{datum === 'MSL' ? 'MD' : 'Δ'} {hoverDepth.toFixed(0)}m</span>
              {hoverReadout.map((r) => <span key={r.name}>{r.name} <span style={{ color: 'var(--teal)' }}>GR{r.gr != null ? ' ' + r.gr.toFixed(0) : ' —'}</span></span>)}
            </div>
          )}
        </div>
      </div>

      <Inspector title="Correlation inspector" open={inspOpen} onToggle={() => setInspOpen(false)}>
        <InspectorSection title="Well order & depth shift">
          {selected.map((name, i) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--muted)', fontSize: 10 }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 11.5 }}>{name}</span>
              <button onClick={() => setShifts((s) => ({ ...s, [name]: (s[name] ?? 0) - 10 }))} style={nudge}>−10</button>
              <span className="mono" style={{ fontSize: 10, width: 34, textAlign: 'center' }}>{shifts[name] ?? 0}</span>
              <button onClick={() => setShifts((s) => ({ ...s, [name]: (s[name] ?? 0) + 10 }))} style={nudge}>+10</button>
            </div>
          ))}
          <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>Tip: drag a column body up/down on the panel to shift, drag its header sideways to reorder.</p>
        </InspectorSection>
        <InspectorSection title="Correlation surfaces">
          {pickSurfaces.length === 0 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>No shared picks in the selected wells.</div>}
          {pickSurfaces.map((s, i) => (
            <div key={s} onMouseEnter={() => setHoverSurface(s)} onMouseLeave={() => setHoverSurface(null)}>
              <LayerRow on onToggle={() => { /* legend */ }} label={s} swatch={surfaceColor(i)} />
            </div>
          ))}
          <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Hover a surface to highlight its correlation line across all wells.</p>
        </InspectorSection>
      </Inspector>
    </div>
  );
}

const nudge: React.CSSProperties = { ...inputStyle, width: 'auto', padding: '2px 6px', fontSize: 10, cursor: 'pointer' };

function drawCorrelation(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  order: string[], logs: Record<string, LogsJson | null>, picks: Pick[],
  datum: string, effOffset: (n: string) => number,
  view: { lo: number; hi: number }, shared: boolean,
  hoverDepth: number | null, hoverSurface: string | null,
) {
  const plotH = h - PAD_T - PAD_B;
  const d2y = (d: number) => PAD_T + ((d - view.lo) / Math.max(1e-6, view.hi - view.lo)) * plotH;
  const line = cssVar('--line'), muted = cssVar('--muted'), text = cssVar('--text');

  // depth axis
  ctx.fillStyle = muted; ctx.font = `8.5px ${cssVar('--mono')}`; ctx.lineWidth = 0.5;
  const step = niceStep(view.hi - view.lo);
  ctx.textAlign = 'left';
  for (let d = Math.ceil(view.lo / step) * step; d <= view.hi; d += step) {
    const y = d2y(d); ctx.strokeStyle = 'rgba(127,146,153,0.12)'; ctx.beginPath(); ctx.moveTo(AXIS_W - 4, y); ctx.lineTo(w, y); ctx.stroke();
    ctx.fillStyle = muted; ctx.fillText(String(Math.round(d)), 2, y + 3);
  }
  ctx.fillStyle = text; ctx.font = `bold 9px ${cssVar('--mono')}`; ctx.fillText(datum === 'MSL' ? 'MD' : `Δ${datum.slice(0, 8)}`, 2, 12);

  const surfIndex: Record<string, number> = {};
  let si = 0;
  const pickXY: Array<Record<string, number>> = [];

  order.forEach((name, ci) => {
    const log = logs[name];
    const x0 = AXIS_W + ci * COL_W;
    const off = effOffset(name);
    // header band
    ctx.fillStyle = withAlpha(cssVar('--teal'), 0.06); ctx.fillRect(x0, PAD_T, COL_W, HEAD_H);
    ctx.strokeStyle = line; ctx.lineWidth = 0.5; ctx.strokeRect(x0, PAD_T, COL_W, plotH);
    ctx.fillStyle = text; ctx.font = `bold 10px ${cssVar('--mono')}`; ctx.textAlign = 'center';
    ctx.fillText(name + '  ⇕⇔', x0 + COL_W / 2, PAD_T + 14);

    if (log) {
      const lanes = [[MINI[0]], [MINI[1], MINI[2]], [MINI[3]]];
      const laneW = COL_W / lanes.length;
      lanes.forEach((lane, li) => {
        const lx = x0 + li * laneW;
        ctx.strokeStyle = 'rgba(127,146,153,0.15)'; ctx.beginPath(); ctx.moveTo(lx, PAD_T + HEAD_H); ctx.lineTo(lx, PAD_T + plotH); ctx.stroke();
        for (const c of lane) {
          const cur = log.curves[c.curve]; if (!cur) continue;
          ctx.strokeStyle = cssVar(c.color); ctx.lineWidth = 0.9; ctx.beginPath();
          let started = false;
          const stepI = Math.max(1, Math.floor(log.md.length / 1400));
          for (let i = 0; i < log.md.length; i += stepI) {
            const v = cur.values[i]; if (v == null || !isFinite(v)) { started = false; continue; }
            const d = log.md[i] - off; if (d < view.lo || d > view.hi) continue;
            let f: number;
            if (c.log) f = (Math.log10(Math.max(1e-3, v)) - Math.log10(c.min)) / (Math.log10(c.max) - Math.log10(c.min));
            else f = (v - c.min) / (c.max - c.min);
            f = Math.max(0, Math.min(1, f));
            const px = lx + f * laneW, py = d2y(d);
            if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      });
      void shared;
    } else {
      ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.fillText('no logs', x0 + COL_W / 2, PAD_T + plotH / 2);
    }

    const colPicks: Record<string, number> = {};
    for (const p of picks) {
      if (p.well !== name) continue;
      const d = p.md - off; if (d < view.lo || d > view.hi) continue;
      if (!(p.surface in surfIndex)) surfIndex[p.surface] = si++;
      const y = d2y(d); colPicks[p.surface] = y;
      const hot = hoverSurface === p.surface;
      const col = surfaceColor(surfIndex[p.surface]);
      ctx.strokeStyle = col; ctx.lineWidth = hot ? 2.6 : 1.4;
      if (hot) { ctx.shadowColor = col; ctx.shadowBlur = 8; }
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + COL_W, y); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    pickXY.push(colPicks);
  });

  // connect picks across adjacent wells
  for (let ci = 0; ci < order.length - 1; ci++) {
    const A = pickXY[ci], B = pickXY[ci + 1];
    const xA = AXIS_W + ci * COL_W + COL_W, xB = AXIS_W + (ci + 1) * COL_W;
    for (const surf of Object.keys(A)) {
      if (!(surf in B)) continue;
      const hot = hoverSurface === surf;
      ctx.strokeStyle = surfaceColor(surfIndex[surf]); ctx.lineWidth = hot ? 2.4 : 1.2; ctx.setLineDash(hot ? [] : [3, 2]);
      if (hot) { ctx.shadowColor = ctx.strokeStyle as string; ctx.shadowBlur = 8; }
      ctx.beginPath(); ctx.moveTo(xA, A[surf]); ctx.lineTo(xB, B[surf]); ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
    }
  }

  // hover crosshair (shared depth line)
  if (hoverDepth != null && hoverDepth >= view.lo && hoverDepth <= view.hi) {
    const y = d2y(hoverDepth);
    ctx.strokeStyle = withAlpha(text, 0.55); ctx.lineWidth = 0.7; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(AXIS_W, y); ctx.lineTo(w, y); ctx.stroke(); ctx.setLineDash([]);
  }
}

function niceStep(span: number): number {
  const raw = span / 8; const p = Math.pow(10, Math.floor(Math.log10(Math.max(1e-6, raw)))); const n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}
