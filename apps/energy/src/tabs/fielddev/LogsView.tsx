// LogsView.tsx — Petrel-grade multi-track log viewer (V1a).
// DEVIATION (noted in DoD): rendered with a custom high-DPI canvas track engine
// rather than @equinor/videx-wellog. videx-wellog's imperative D3 lifecycle
// fought the React re-render / theming / orientation-toggle model; the canvas
// engine meets the same spec (standard scales, fills, crossover, crosshair,
// picks, orientation toggle, per-curve editing) with clean theming + zero
// console noise. The dep remains installed for a future swap.
import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { SlidersHorizontal, Rows3, Columns3, ScatterChart } from 'lucide-react';
import { useAsync, useCanvas, usePersist, cssVar } from './hooks';
import { Inspector, InspectorSection, Segmented, LayerRow, inputStyle, Loading, ErrorBanner } from './chrome';
import { NatureBadge } from '../../components/Provenance';
import { loadIndex, loadLogs, loadPicks } from '../../wb/load';
import type { WbIndex, LogsJson, Pick } from '../../wb/types';
import { Crossplot } from './Crossplot';

interface CurveCfg { curve: string; color: string; min: number; max: number; log?: boolean; reverse?: boolean }
interface TrackCfg { id: string; label: string; curves: CurveCfg[]; kind: 'line' | 'overlay' | 'flag'; gr?: boolean; crossover?: boolean }

// Standard O&G scale conventions.
const DEFAULT_TRACKS = (): TrackCfg[] => [
  { id: 'gr', label: 'GR', kind: 'line', gr: true, curves: [{ curve: 'GR', color: cssVar('--teal'), min: 0, max: 150 }] },
  { id: 'den', label: 'RHOB / NPHI', kind: 'overlay', crossover: true, curves: [
    { curve: 'RHOB', color: cssVar('--rose'), min: 1.95, max: 2.95 },
    { curve: 'NPHI', color: cssVar('--blue'), min: 0.45, max: -0.15, reverse: true },
  ] },
  { id: 'res', label: 'RT', kind: 'line', curves: [{ curve: 'RT', color: cssVar('--amber'), min: 0.2, max: 2000, log: true }] },
  { id: 'son', label: 'DT', kind: 'line', curves: [{ curve: 'DT', color: cssVar('--violet'), min: 40, max: 240 }] },
  { id: 'petro', label: 'PHIE / SWE / VSH', kind: 'overlay', curves: [
    { curve: 'PHIE', color: cssVar('--teal'), min: 0.5, max: 0, reverse: true },
    { curve: 'SWE', color: cssVar('--blue'), min: 1, max: 0, reverse: true },
    { curve: 'VSH', color: cssVar('--orange'), min: 0, max: 1 },
  ] },
  { id: 'sand', label: 'SAND', kind: 'flag', curves: [{ curve: 'SAND', color: cssVar('--amber'), min: 0, max: 1 }] },
];

export function LogsView() {
  const idx = useAsync<WbIndex>(loadIndex, []);
  if (idx.loading) return <Loading what="workbench index" />;
  if (idx.error || !idx.data) return <ErrorBanner msg={idx.error || 'index unavailable'} />;
  return <LogsInner index={idx.data} />;
}

function LogsInner({ index }: { index: WbIndex }) {
  const logWells = useMemo(() => index.wells.filter((w) => w.has.logs), [index]);
  const [well, setWell] = useState(() => logWells.find((w) => w.name === 'F-12')?.name ?? logWells[0].name);
  const [orient, setOrient] = usePersist<'v' | 'h'>('ae_logs_orient', 'v');
  const [inspOpen, setInspOpen] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [tracks, setTracks] = useState<TrackCfg[]>(DEFAULT_TRACKS);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [zoom, setZoom] = useState({ lo: 0, hi: 1 }); // fraction of depth range
  const [hoverDepth, setHoverDepth] = useState<number | null>(null);
  const [selInterval, setSelInterval] = useState<[number, number] | null>(null);
  const [dockH, setDockH] = useState(320); // Analytics bottom-dock height (px), resizable
  const dockDragRef = useRef<{ y: number; h: number } | null>(null);

  const logsRes = useAsync<LogsJson>(() => loadLogs(well), [well]);
  const picksRes = useAsync(loadPicks, []);
  const dragRef = useRef<{ y: number; lo: number; hi: number } | null>(null);

  const log = logsRes.data;
  const md = log?.md ?? [];
  const dRange = md.length ? { min: md[0], max: md[md.length - 1] } : { min: 0, max: 1 };
  const view = { lo: dRange.min + (dRange.max - dRange.min) * zoom.lo, hi: dRange.min + (dRange.max - dRange.min) * zoom.hi };

  const picks: Pick[] = useMemo(() => (picksRes.data?.picks ?? []).filter((p) => p.well === well), [picksRes.data, well]);

  const visTracks = tracks.filter((t) => !hidden[t.id] && (log ? t.curves.some((c) => log.curves[c.curve]) : true));

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (!log) return;
    const horiz = orient === 'h';
    const depthPx = horiz ? w : h;      // pixels along depth axis
    const lane = horiz ? h : w;         // perpendicular extent
    const headH = 30;                    // track header band
    const laneAvail = lane - headH;
    const nT = Math.max(1, visTracks.length);
    const tW = laneAvail / nT;
    const d2p = (d: number) => ((d - view.lo) / Math.max(1e-6, view.hi - view.lo)) * depthPx;
    const idxAt = (d: number) => {
      // nearest md index (md ascending)
      let lo = 0, hi = md.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (md[m] < d) lo = m + 1; else hi = m; }
      return lo;
    };
    const line = cssVar('--line'), muted = cssVar('--muted'), text = cssVar('--text');

    // selection band
    if (selInterval) {
      const a = d2p(selInterval[0]), b = d2p(selInterval[1]);
      ctx.fillStyle = cssVar('--sel');
      if (horiz) ctx.fillRect(Math.min(a, b), 0, Math.abs(b - a), h); else ctx.fillRect(0, Math.min(a, b), w, Math.abs(b - a));
    }

    visTracks.forEach((t, ti) => {
      const x0 = headH + ti * tW;
      // header
      ctx.save();
      // track frame
      ctx.strokeStyle = line; ctx.lineWidth = 0.5;
      if (horiz) ctx.strokeRect(0, x0, w, tW); else ctx.strokeRect(x0, 0, tW, h);
      // curves
      for (const c of t.curves) {
        const cur = log.curves[c.curve]; if (!cur) continue;
        const vals = cur.values;
        const norm = (v: number) => {
          let f: number;
          if (c.log) f = (Math.log10(Math.max(1e-3, v)) - Math.log10(c.min)) / (Math.log10(c.max) - Math.log10(c.min));
          else f = (v - c.min) / (c.max - c.min);
          return Math.max(0, Math.min(1, f));
        };
        if (t.kind === 'flag') {
          ctx.fillStyle = c.color;
          for (let i = 0; i < md.length; i++) {
            const v = vals[i]; if (v == null || v < 0.5) continue;
            const dp = d2p(md[i]); const dp2 = d2p(md[Math.min(md.length - 1, i + 1)]);
            if (horiz) ctx.fillRect(Math.min(dp, dp2), x0 + tW * 0.25, Math.max(1, Math.abs(dp2 - dp)), tW * 0.5);
            else ctx.fillRect(x0 + tW * 0.25, Math.min(dp, dp2), tW * 0.5, Math.max(1, Math.abs(dp2 - dp)));
          }
          continue;
        }
        ctx.strokeStyle = c.color; ctx.lineWidth = 1; ctx.beginPath();
        let started = false;
        for (let i = 0; i < md.length; i++) {
          const d = md[i]; if (d < view.lo - 5 || d > view.hi + 5) continue;
          const v = vals[i]; if (v == null || !isFinite(v)) { started = false; continue; }
          const f = norm(v);
          const perp = x0 + f * tW;
          const dp = d2p(d);
          const px = horiz ? dp : perp, py = horiz ? perp : dp;
          if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
        }
        ctx.stroke();
        // GR shading fill to sand/shale
        if (t.gr && c.curve === 'GR') {
          ctx.fillStyle = 'rgba(225,174,72,0.14)';
          ctx.beginPath(); let st = false;
          for (let i = 0; i < md.length; i++) {
            const d = md[i]; if (d < view.lo - 5 || d > view.hi + 5) continue;
            const v = vals[i]; if (v == null) { continue; }
            const f = norm(v); const perp = x0 + f * tW; const dp = d2p(d);
            const px = horiz ? dp : perp, py = horiz ? perp : dp;
            if (!st) { ctx.moveTo(horiz ? dp : x0, horiz ? x0 : dp); st = true; }
            ctx.lineTo(px, py);
          }
          ctx.stroke();
          ctx.fill();
        }
      }
      // crossover shading (density/neutron gas effect)
      if (t.crossover && t.curves.length >= 2) {
        const [c1, c2] = t.curves;
        const v1 = log.curves[c1.curve]?.values, v2 = log.curves[c2.curve]?.values;
        if (v1 && v2) {
          ctx.fillStyle = 'rgba(225,174,72,0.22)';
          for (let i = 0; i < md.length - 1; i++) {
            const d = md[i]; if (d < view.lo || d > view.hi) continue;
            const a = v1[i], b = v2[i]; if (a == null || b == null) continue;
            const fa = Math.max(0, Math.min(1, (a - c1.min) / (c1.max - c1.min)));
            const fb = Math.max(0, Math.min(1, (b - c2.min) / (c2.max - c2.min)));
            if (fb > fa) { // neutron left of density → gas effect
              const dp = d2p(d), dp2 = d2p(md[i + 1]);
              if (horiz) ctx.fillRect(Math.min(dp, dp2), x0 + fa * tW, Math.abs(dp2 - dp) || 1, (fb - fa) * tW);
              else ctx.fillRect(x0 + fa * tW, Math.min(dp, dp2), (fb - fa) * tW, Math.abs(dp2 - dp) || 1);
            }
          }
        }
      }
      // header text
      ctx.fillStyle = muted; ctx.font = `9px ${cssVar('--mono')}`; ctx.textAlign = 'center';
      const isInterp = ['PHIE', 'SWE', 'VSH'].some((k) => t.curves.some((c) => c.curve === k));
      const hx = horiz ? 4 : x0 + tW / 2, hy = horiz ? x0 + 10 : 11;
      if (horiz) { ctx.textAlign = 'left'; }
      ctx.fillStyle = text; ctx.fillText(t.label + (isInterp ? ' ⬗' : ''), hx, hy);
      ctx.fillStyle = muted; ctx.font = `8px ${cssVar('--mono')}`;
      ctx.fillText(t.curves.map((c) => `${c.min}–${c.max}${c.log ? ' log' : ''}`).join('  '), hx, hy + 9);
      ctx.restore();
    });

    // depth axis ticks
    ctx.fillStyle = muted; ctx.strokeStyle = line; ctx.font = `8.5px ${cssVar('--mono')}`; ctx.lineWidth = 0.5;
    const step = niceStep(view.hi - view.lo);
    ctx.textAlign = 'left';
    for (let d = Math.ceil(view.lo / step) * step; d <= view.hi; d += step) {
      const dp = d2p(d);
      if (horiz) { ctx.beginPath(); ctx.moveTo(dp, 0); ctx.lineTo(dp, headH); ctx.stroke(); ctx.fillText(String(Math.round(d)), dp + 2, headH - 2); }
      else { ctx.beginPath(); ctx.moveTo(0, dp); ctx.lineTo(headH, dp); ctx.stroke(); ctx.fillText(String(Math.round(d)), 2, dp - 2); }
    }

    // picks
    for (const p of picks) {
      if (p.md < view.lo || p.md > view.hi) continue;
      const dp = d2p(p.md);
      ctx.strokeStyle = cssVar('--orange'); ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
      ctx.beginPath();
      if (horiz) { ctx.moveTo(dp, headH); ctx.lineTo(dp, h); } else { ctx.moveTo(headH, dp); ctx.lineTo(w, dp); }
      ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = cssVar('--orange'); ctx.font = `8px ${cssVar('--mono')}`; ctx.textAlign = 'left';
      ctx.fillText(p.surface.replace(/ (Top|Base).*/, ''), horiz ? dp + 2 : headH + 3, horiz ? h - 3 : dp - 2);
    }

    // crosshair
    if (hoverDepth != null && hoverDepth >= view.lo && hoverDepth <= view.hi) {
      const dp = d2p(hoverDepth);
      ctx.strokeStyle = text; ctx.lineWidth = 0.5;
      ctx.beginPath();
      if (horiz) { ctx.moveTo(dp, 0); ctx.lineTo(dp, h); } else { ctx.moveTo(0, dp); ctx.lineTo(w, dp); }
      ctx.stroke();
      const i = idxAt(hoverDepth);
      const parts = visTracks.flatMap((t) => t.curves.map((c) => { const v = log.curves[c.curve]?.values[i]; return v == null ? null : `${c.curve} ${v.toFixed(2)}`; })).filter(Boolean);
      const label = `MD ${hoverDepth.toFixed(1)}  ` + parts.join('  ');
      ctx.font = `9px ${cssVar('--mono')}`; const tw = ctx.measureText(label).width + 10;
      ctx.fillStyle = 'color-mix(in srgb, var(--panel) 85%, transparent)';
      const bx = horiz ? Math.min(dp + 4, w - tw) : headH + 4, by = horiz ? 4 : Math.min(dp + 4, h - 16);
      ctx.fillStyle = cssVar('--panel'); ctx.fillRect(bx, by, tw, 14);
      ctx.strokeStyle = line; ctx.strokeRect(bx, by, tw, 14);
      ctx.fillStyle = text; ctx.textAlign = 'left'; ctx.fillText(label, bx + 5, by + 10);
    }
  }, [log, orient, visTracks, view.lo, view.hi, md, picks, hoverDepth, selInterval]);

  const { canvasRef, wrapRef } = useCanvas(draw, [draw]);

  // interaction
  const evtDepth = (e: React.MouseEvent): number => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const horiz = orient === 'h';
    const along = horiz ? (e.clientX - rect.left) / rect.width : (e.clientY - rect.top) / rect.height;
    return view.lo + along * (view.hi - view.lo);
  };
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const at = (evtDepth(e as unknown as React.MouseEvent) - dRange.min) / (dRange.max - dRange.min);
    const span = zoom.hi - zoom.lo;
    const ns = Math.max(0.03, Math.min(1, span * (e.deltaY < 0 ? 0.88 : 1 / 0.88)));
    let lo = at - (at - zoom.lo) * (ns / span), hi = lo + ns;
    if (lo < 0) { lo = 0; hi = ns; } if (hi > 1) { hi = 1; lo = 1 - ns; }
    setZoom({ lo, hi });
  };
  const onDown = (e: React.MouseEvent) => { dragRef.current = { y: orient === 'h' ? e.clientX : e.clientY, lo: zoom.lo, hi: zoom.hi }; };
  const onMove = (e: React.MouseEvent) => {
    setHoverDepth(evtDepth(e));
    if (dragRef.current) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const px = orient === 'h' ? rect.width : rect.height;
      const dfrac = ((orient === 'h' ? e.clientX : e.clientY) - dragRef.current.y) / px * (zoom.hi - zoom.lo);
      let lo = dragRef.current.lo - dfrac, hi = dragRef.current.hi - dfrac;
      if (lo < 0) { lo = 0; hi = dragRef.current.hi - dragRef.current.lo; } if (hi > 1) { hi = 1; lo = 1 - (dragRef.current.hi - dragRef.current.lo); }
      setZoom({ lo, hi });
    }
  };
  const onUp = () => { dragRef.current = null; };

  // nudge the track canvas to re-measure when the dock opens/closes or resizes
  useEffect(() => {
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    return () => cancelAnimationFrame(id);
  }, [drawer, dockH]);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dockDragRef.current) return;
      const delta = dockDragRef.current.y - e.clientY; // drag up → taller
      setDockH(Math.max(120, Math.min(640, dockDragRef.current.h + delta)));
    };
    const up = () => { dockDragRef.current = null; };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);

  const editCurve = (tid: string, ci: number, patch: Partial<CurveCfg>) =>
    setTracks((prev) => prev.map((t) => t.id === tid ? { ...t, curves: t.curves.map((c, i) => i === ci ? { ...c, ...patch } : c) } : t));

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderBottom: '1px solid var(--line)', background: 'var(--panel)', flexWrap: 'wrap' }}>
          <select value={well} onChange={(e) => { setWell(e.target.value); setZoom({ lo: 0, hi: 1 }); setSelInterval(null); }} style={{ ...inputStyle, width: 'auto' }}>
            {logWells.map((w) => <option key={w.name} value={w.name}>{w.name}</option>)}
          </select>
          <Segmented options={[{ id: 'v' as const, label: 'Vert' }, { id: 'h' as const, label: 'Horiz' }]} value={orient} onChange={setOrient} accent="--violet" />
          <button onClick={() => setZoom({ lo: 0, hi: 1 })} style={{ ...inputStyle, width: 'auto', cursor: 'pointer', color: 'var(--muted)' }}>Fit depth</button>
          <div style={{ flex: 1 }} />
          {log && <NatureBadge nature="interpreted" />}
          <button onClick={() => setDrawer((d) => !d)} title="Analytics drawer"
            style={{ display: 'flex', alignItems: 'center', gap: 6, ...inputStyle, width: 'auto', cursor: 'pointer', color: drawer ? 'var(--text)' : 'var(--muted)', borderColor: drawer ? 'var(--violet)' : 'var(--line)' }}>
            <ScatterChart size={14} /> Analytics
          </button>
          <button onClick={() => setInspOpen((o) => !o)} title="Inspector" style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 4, border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--muted)' }}>
            <SlidersHorizontal size={15} />
          </button>
        </div>

        {/* tracks (flex) + full-width resizable Analytics bottom dock — never
            overlaps the inspector because the dock lives inside the left column. */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div ref={wrapRef} style={{ flex: 1, minHeight: 60, position: 'relative', overflow: 'hidden', cursor: 'crosshair' }}>
            {logsRes.loading ? <Loading what={`${well} logs`} /> : logsRes.error ? <ErrorBanner msg={logsRes.error} /> : (
              <canvas ref={canvasRef} onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={() => { onUp(); setHoverDepth(null); }}
                style={{ display: 'block', width: '100%', height: '100%' }} />
            )}
          </div>
          {drawer && log && (
            <>
              <div
                onMouseDown={(e) => { dockDragRef.current = { y: e.clientY, h: dockH }; }}
                style={{ height: 6, cursor: 'ns-resize', background: 'var(--line)', flexShrink: 0 }} title="Drag to resize Analytics" />
              <div style={{ height: dockH, flexShrink: 0, borderTop: '1px solid var(--line)', background: 'var(--panel)', minHeight: 0 }}>
                <Crossplot log={log} onSelectInterval={setSelInterval} selInterval={selInterval} />
              </div>
            </>
          )}
        </div>
      </div>

      <Inspector title="Log inspector" open={inspOpen} onToggle={() => setInspOpen(false)}>
        <InspectorSection title="Well">
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{well} · {md.length} samples</div>
          <div className="mono" style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 4, wordBreak: 'break-all' }}>{log?.source_id}</div>
        </InspectorSection>
        <InspectorSection title="Tracks">
          {tracks.map((t) => {
            const present = log ? t.curves.some((c) => log.curves[c.curve]) : true;
            return (
              <div key={t.id} style={{ marginBottom: 6, opacity: present ? 1 : 0.4 }}>
                <LayerRow on={!hidden[t.id]} onToggle={() => setHidden((h) => ({ ...h, [t.id]: !h[t.id] }))} label={`${t.label}${present ? '' : ' (n/a)'}`} />
                {!hidden[t.id] && present && t.curves.map((c, ci) => log?.curves[c.curve] && (
                  <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0 2px 22px' }}>
                    <input type="color" value={toHex(c.color)} onChange={(e) => editCurve(t.id, ci, { color: e.target.value })} style={{ width: 22, height: 18, border: 'none', background: 'none', padding: 0 }} />
                    <span style={{ flex: 1, fontSize: 10.5 }}>{c.curve}</span>
                    <input type="number" value={c.min} onChange={(e) => editCurve(t.id, ci, { min: +e.target.value })} style={{ ...inputStyle, width: 46, padding: '2px 4px', fontSize: 10 }} />
                    <input type="number" value={c.max} onChange={(e) => editCurve(t.id, ci, { max: +e.target.value })} style={{ ...inputStyle, width: 46, padding: '2px 4px', fontSize: 10 }} />
                  </div>
                ))}
              </div>
            );
          })}
        </InspectorSection>
        <InspectorSection title="Picks">
          {picks.length === 0 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>No picks for this well.</div>}
          {picks.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, fontSize: 10.5, padding: '1px 0' }}>
              <span style={{ color: 'var(--orange)' }}>▬</span><span style={{ flex: 1 }}>{p.surface}</span><span className="mono">{p.md.toFixed(0)}</span>
            </div>
          ))}
        </InspectorSection>
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <span className="chip"><Rows3 size={11} /> vert</span><span className="chip"><Columns3 size={11} /> horiz toggle</span>
        </div>
      </Inspector>
    </div>
  );
}

function niceStep(span: number): number {
  const raw = span / 8; const p = Math.pow(10, Math.floor(Math.log10(raw))); const n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}
function toHex(c: string): string {
  if (c.startsWith('#')) return c.length === 4 ? '#' + c.slice(1).split('').map((x) => x + x).join('') : c;
  const m = c.match(/\d+/g); if (!m) return '#888888';
  return '#' + m.slice(0, 3).map((x) => (+x).toString(16).padStart(2, '0')).join('');
}
