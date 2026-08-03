// viewers/TrajectoryViewer.tsx — well path in map view (N/E) and vertical
// section, both independently zoomable/pannable, both colored by fluid status
// (same petro.ts heuristic LogViewer annotates its tracks with — read from
// this well's own log, resolved by AssetViewer). Falls back to a depth-tint
// gradient when the well has no matching log to color from.
//
// Canvas, DPI-correct, no chart library: a trajectory is a polyline with
// per-segment coloring, which no generic charting lib draws well — same
// reasoning as LogViewer (see its header comment).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { useUnits, depth as depthQ } from '../../units';
import { nearestFluid, type Fluid, type FluidProfile } from '../petro.ts';

export interface TrajStation { md: number; tvd: number; incl?: number; azi?: number; dispNs: number; dispEw: number }
export interface TrajPayload { well: string; stations: TrajStation[] }
export interface PickMarker { surface: string; md: number }

const FLUID_RED = '#e24b4a';
const FLUID_GREEN = '#16805a';
const NEUTRAL_COLOR = '#8b96a5';
const PICK_COLOR = '#e11d74';
const SURFACE_COLOR = '#0fb5a6';
const WELL_LABEL_COLOR = '#0b6b62';

interface PanelView { scale: number; dx: number; dy: number }
const IDENTITY_VIEW: PanelView = { scale: 1, dx: 0, dy: 0 };
const applyView = (x: number, y: number, v: PanelView, cx: number, cy: number) => ({
  x: cx + (x - cx) * v.scale + v.dx, y: cy + (y - cy) * v.scale + v.dy,
});
const invView = (x: number, y: number, v: PanelView, cx: number, cy: number) => ({
  x: cx + (x - cx - v.dx) / v.scale, y: cy + (y - cy - v.dy) / v.scale,
});
function zoomAt(view: PanelView, factor: number, mouseX: number, mouseY: number, cx: number, cy: number): PanelView {
  const newScale = Math.min(10, Math.max(0.6, view.scale * factor));
  const base = invView(mouseX, mouseY, view, cx, cy);
  return { scale: newScale, dx: mouseX - cx - (base.x - cx) * newScale, dy: mouseY - cy - (base.y - cy) * newScale };
}

function computeGeom(size: { w: number; h: number }) {
  const gap = 14;
  const halfW = (size.w - gap * 3) / 2;
  const padT = 26, padB = 24;
  const plotH = size.h - padT - padB;
  const x2 = gap * 2 + halfW;
  return {
    gap, halfW, padT, padB, plotH, x2,
    mapBox: { x0: gap, y0: padT, x1: gap + halfW, y1: padT + plotH, cx: gap + halfW / 2, cy: padT + plotH / 2 },
    secBox: { x0: x2, y0: padT, x1: x2 + halfW, y1: padT + plotH, cx: x2 + halfW / 2, cy: padT + plotH / 2 },
  };
}
type Geom = ReturnType<typeof computeGeom>;
function panelAt(x: number, y: number, geom: Geom): 'map' | 'sec' | null {
  const { mapBox, secBox } = geom;
  if (x >= mapBox.x0 && x <= mapBox.x1 && y >= mapBox.y0 && y <= mapBox.y1) return 'map';
  if (x >= secBox.x0 && x <= secBox.x1 && y >= secBox.y0 && y <= secBox.y1) return 'sec';
  return null;
}
const dispOf = (s: TrajStation) => Math.hypot(s.dispNs, s.dispEw);
const fluidColor = (f: Fluid) => (f === 'gas' ? FLUID_RED : f === 'oil' ? FLUID_GREEN : NEUTRAL_COLOR);
const depthGradient = (t: number) => `hsl(${190 - t * 150}, 72%, ${58 - t * 18}%)`;

export function TrajectoryViewer({ traj, picks, fluidProfile }: { traj: TrajPayload; picks?: PickMarker[]; fluidProfile?: FluidProfile | null }) {
  const { system } = useUnits();
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 900, h: 520 });
  const [mapView, setMapView] = useState<PanelView>(IDENTITY_VIEW);
  const [secView, setSecView] = useState<PanelView>(IDENTITY_VIEW);
  const dragRef = useRef<{ panel: 'map' | 'sec'; x: number; y: number; view: PanelView } | null>(null);
  const [hover, setHover] = useState<{ panel: 'map' | 'sec'; x: number; y: number } | null>(null);
  const st = traj.stations ?? [];

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // a new well resets any zoom/pan from the previous one
  useEffect(() => { setMapView(IDENTITY_VIEW); setSecView(IDENTITY_VIEW); }, [traj.well]);

  const bounds = useMemo(() => {
    let ns0 = Infinity, ns1 = -Infinity, ew0 = Infinity, ew1 = -Infinity, tvd1 = -Infinity;
    for (const s of st) {
      ns0 = Math.min(ns0, s.dispNs); ns1 = Math.max(ns1, s.dispNs);
      ew0 = Math.min(ew0, s.dispEw); ew1 = Math.max(ew1, s.dispEw);
      tvd1 = Math.max(tvd1, s.tvd);
    }
    if (!Number.isFinite(ns0)) return null;
    return { ns0, ns1, ew0, ew1, tvd1 };
  }, [st]);

  const dmax = useMemo(() => { let d = 0; for (const s of st) d = Math.max(d, dispOf(s)); return d; }, [st]);
  const geom = useMemo(() => computeGeom(size), [size]);

  // the total wave state → screen projection, both panels — shared by the
  // canvas draw effect, hit-testing (which panel was clicked) and the hover
  // tooltip, so all three agree on where everything actually is
  const proj = useMemo(() => {
    if (!bounds) return null;
    const spanE = Math.max(1, bounds.ew1 - bounds.ew0), spanN = Math.max(1, bounds.ns1 - bounds.ns0);
    const mapSc = Math.min(geom.halfW / spanE, geom.plotH / spanN) * 0.86;
    const mox = geom.mapBox.cx - (spanE * mapSc) / 2 - bounds.ew0 * mapSc;
    const moy = geom.mapBox.cy + (spanN * mapSc) / 2 + bounds.ns0 * mapSc;
    const vsXBase = (d: number) => geom.secBox.x0 + 8 + (d / (dmax || 1)) * (geom.halfW - 18);
    const vsYBase = (tvd: number) => geom.padT + (tvd / (bounds.tvd1 || 1)) * geom.plotH;
    const projMap = (e: number, n: number) => applyView(mox + e * mapSc, moy - n * mapSc, mapView, geom.mapBox.cx, geom.mapBox.cy);
    const projSec = (d: number, tvd: number) => applyView(vsXBase(d), vsYBase(tvd), secView, geom.secBox.cx, geom.secBox.cy);
    return { projMap, projSec, vsYBase };
  }, [bounds, geom, dmax, mapView, secView]);

  const tdIdx = useMemo(() => {
    let idx = 0; for (let i = 1; i < st.length; i++) if (st[i].tvd > st[idx].tvd) idx = i;
    return st.length ? idx : -1;
  }, [st]);

  const atMd = useMemo(() => (md: number) => {
    for (let i = 1; i < st.length; i++) {
      if (st[i].md >= md) {
        const a = st[i - 1], b = st[i];
        const f = (md - a.md) / ((b.md - a.md) || 1);
        return { ns: a.dispNs + (b.dispNs - a.dispNs) * f, ew: a.dispEw + (b.dispEw - a.dispEw) * f, tvd: a.tvd + (b.tvd - a.tvd) * f };
      }
    }
    return null;
  }, [st]);

  useEffect(() => {
    const cv = cvRef.current; if (!cv || !size.w || !size.h || !bounds || !st.length || !proj) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size.w * dpr; cv.height = size.h * dpr;
    cv.style.width = `${size.w}px`; cv.style.height = `${size.h}px`;
    const g = cv.getContext('2d'); if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size.w, size.h);

    const css = (n: string, f: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f;
    const ink = css('--ink', '#0f172a'), ink3 = css('--ink3', '#94a3b8'), line = css('--line', '#e2e8f0');
    const { mapBox, secBox } = geom;
    const { projMap, projSec, vsYBase } = proj;

    const clipTo = (box: { x0: number; y0: number; x1: number; y1: number }, draw: () => void) => {
      g.save(); g.beginPath(); g.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0); g.clip(); draw(); g.restore();
    };

    g.strokeStyle = line; g.strokeRect(mapBox.x0, mapBox.y0, mapBox.x1 - mapBox.x0, mapBox.y1 - mapBox.y0);
    g.fillStyle = ink3; g.font = '600 10px ui-monospace, monospace'; g.textAlign = 'left';
    g.fillText('MAP VIEW · N/E displacement', mapBox.x0 + 4, mapBox.y0 - 8);
    g.strokeStyle = line; g.strokeRect(secBox.x0, secBox.y0, secBox.x1 - secBox.x0, secBox.y1 - secBox.y0);
    g.fillText('VERTICAL SECTION · TVD vs displacement', secBox.x0 + 4, secBox.y0 - 8);

    // ── map panel ──
    clipTo(mapBox, () => {
      g.lineWidth = 2.2; g.lineJoin = 'round';
      for (let i = 1; i < st.length; i++) {
        const b = st[i];
        const color = fluidProfile ? fluidColor(nearestFluid(fluidProfile, b.md)) : depthGradient(b.tvd / (bounds.tvd1 || 1));
        const pa = projMap(st[i - 1].dispEw, st[i - 1].dispNs), pb = projMap(b.dispEw, b.dispNs);
        g.strokeStyle = color;
        g.beginPath(); g.moveTo(pa.x, pa.y); g.lineTo(pb.x, pb.y); g.stroke();
      }
      const p0 = projMap(st[0].dispEw, st[0].dispNs);
      g.fillStyle = SURFACE_COLOR;
      g.beginPath(); g.arc(p0.x, p0.y, 4, 0, Math.PI * 2); g.fill();
    });

    // ── vertical section panel ──
    clipTo(secBox, () => {
      g.lineWidth = 2.2;
      for (let i = 1; i < st.length; i++) {
        const b = st[i];
        const color = fluidProfile ? fluidColor(nearestFluid(fluidProfile, b.md)) : depthGradient(b.tvd / (bounds.tvd1 || 1));
        const pa = projSec(dispOf(st[i - 1]), st[i - 1].tvd), pb = projSec(dispOf(b), b.tvd);
        g.strokeStyle = color;
        g.beginPath(); g.moveTo(pa.x, pa.y); g.lineTo(pb.x, pb.y); g.stroke();
      }

      // depth ticks
      g.font = '9px ui-monospace, monospace'; g.fillStyle = ink3; g.textAlign = 'right';
      for (let i = 0; i <= 5; i++) {
        const tvd = (i / 5) * bounds.tvd1;
        const y = vsYBase(tvd); // axis ticks track the base scale, not the pan/zoom — a stable ruler
        if (y < secBox.y0 || y > secBox.y1) continue;
        g.strokeStyle = line; g.globalAlpha = 0.5;
        g.beginPath(); g.moveTo(secBox.x0, y); g.lineTo(secBox.x1, y); g.stroke();
        g.globalAlpha = 1;
        g.fillText(depthQ(tvd, system).text, secBox.x1 - 4, y - 3);
      }

      // formation tops — full-width dashed guide + label
      if (picks?.length) {
        g.setLineDash([4, 3]);
        for (const p of picks) {
          const at = atMd(p.md); if (!at) continue;
          const py = projSec(Math.hypot(at.ns, at.ew), at.tvd).y;
          if (py < secBox.y0 || py > secBox.y1) continue;
          g.strokeStyle = PICK_COLOR; g.lineWidth = 1.1;
          g.beginPath(); g.moveTo(secBox.x0, py); g.lineTo(secBox.x1, py); g.stroke();
          g.fillStyle = PICK_COLOR; g.font = '600 9px ui-monospace, monospace'; g.textAlign = 'left'; g.setLineDash([]);
          g.fillText(p.surface, secBox.x0 + 4, py - 3);
          g.setLineDash([4, 3]);
        }
        g.setLineDash([]);
      }
    });

    // formation-top dot markers on the map panel (unclipped labels read fine near the edge)
    if (picks?.length) {
      clipTo(mapBox, () => {
        for (const p of picks) {
          const at = atMd(p.md); if (!at) continue;
          const pt = projMap(at.ew, at.ns);
          g.fillStyle = PICK_COLOR;
          g.beginPath(); g.arc(pt.x, pt.y, 3.2, 0, Math.PI * 2); g.fill();
        }
      });
    }

    // well name posted at TD, in both panels
    if (tdIdx >= 0) {
      const td = st[tdIdx];
      const label = traj.well;
      const drawLabel = (x: number, y: number) => {
        g.font = '700 10.5px ui-monospace, monospace';
        const tw = g.measureText(label).width;
        g.fillStyle = ink; g.globalAlpha = 0.92;
        g.fillRect(x + 6, y - 9, tw + 8, 14);
        g.globalAlpha = 1;
        g.strokeStyle = WELL_LABEL_COLOR; g.lineWidth = 1.3;
        g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#fff'; g.textAlign = 'left';
        g.fillText(label, x + 10, y + 2);
      };
      clipTo(mapBox, () => { const p = projMap(td.dispEw, td.dispNs); drawLabel(p.x, p.y); });
      clipTo(secBox, () => { const p = projSec(dispOf(td), td.tvd); drawLabel(p.x, p.y); });
    }
  }, [st, bounds, size, picks, system, traj.well, proj, geom, fluidProfile, atMd, tdIdx]);

  const hoverInfo = useMemo(() => {
    if (!hover || !proj || !st.length) return null;
    const { projMap, projSec } = proj;
    let best = -1, bestD = Infinity;
    for (let i = 0; i < st.length; i++) {
      const p = hover.panel === 'map' ? projMap(st[i].dispEw, st[i].dispNs) : projSec(dispOf(st[i]), st[i].tvd);
      const d = Math.hypot(p.x - hover.x, p.y - hover.y);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best < 0 || bestD > 40) return null;
    const s = st[best];
    const fluid: Fluid = fluidProfile ? nearestFluid(fluidProfile, s.md) : null;
    return { s, fluid };
  }, [hover, proj, st, fluidProfile]);

  if (!st.length) return <div className="dqv-empty">No trajectory stations in this asset.</div>;

  const resetViews = () => { setMapView(IDENTITY_VIEW); setSecView(IDENTITY_VIEW); };
  const zoomed = mapView.scale !== 1 || mapView.dx !== 0 || mapView.dy !== 0 || secView.scale !== 1 || secView.dx !== 0 || secView.dy !== 0;

  return (
    <div className="dqv-traj">
      <div className="dqv-zoom-bar">
        <button title="Reset both views" disabled={!zoomed} onClick={resetViews}><Maximize2 size={12} /> Reset</button>
        <span className="dqv-zoom-range">scroll to zoom · drag to pan · each panel independent</span>
        {fluidProfile && (
          <span className="dqv-flag-legend">
            <i style={{ background: FLUID_RED }} /> gas <i style={{ background: FLUID_GREEN }} /> oil <i style={{ background: NEUTRAL_COLOR }} /> unclassified
            <em>— colored from this well's own log (petro.ts screening flag), not a saturation model</em>
          </span>
        )}
      </div>
      <div className="dqv-canvas-wrap" ref={wrapRef}>
        <canvas
          ref={cvRef}
          onWheel={(e) => {
            e.preventDefault();
            const r = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - r.left, y = e.clientY - r.top;
            const which = panelAt(x, y, geom);
            if (!which) return;
            const factor = e.deltaY > 0 ? 1 / 1.3 : 1.3;
            if (which === 'map') setMapView((v) => zoomAt(v, factor, x, y, geom.mapBox.cx, geom.mapBox.cy));
            else setSecView((v) => zoomAt(v, factor, x, y, geom.secBox.cx, geom.secBox.cy));
          }}
          onMouseDown={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - r.left, y = e.clientY - r.top;
            const which = panelAt(x, y, geom);
            if (!which) return;
            dragRef.current = { panel: which, x, y, view: which === 'map' ? mapView : secView };
          }}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - r.left, y = e.clientY - r.top;
            if (dragRef.current) {
              const dr = dragRef.current;
              const nv = { scale: dr.view.scale, dx: dr.view.dx + (x - dr.x), dy: dr.view.dy + (y - dr.y) };
              if (dr.panel === 'map') setMapView(nv); else setSecView(nv);
            } else {
              const which = panelAt(x, y, geom);
              setHover(which ? { panel: which, x, y } : null);
            }
          }}
          onMouseUp={() => { dragRef.current = null; }}
          onMouseLeave={() => { dragRef.current = null; setHover(null); }}
        />
        {hoverInfo && hover && (
          <div className="dqv-log-tip" style={{ left: Math.min(hover.x + 14, size.w - 190), top: Math.max(4, hover.y - 10) }}>
            <b>{traj.well}</b>
            <span>MD<em>{depthQ(hoverInfo.s.md, system).text}</em></span>
            <span>TVD<em>{depthQ(hoverInfo.s.tvd, system).text}</em></span>
            {hoverInfo.s.incl != null && <span>Incl<em>{hoverInfo.s.incl.toFixed(1)}°</em></span>}
            {hoverInfo.s.azi != null && <span>Azi<em>{hoverInfo.s.azi.toFixed(1)}°</em></span>}
            {hoverInfo.fluid && (
              <div className="dqv-log-tip-tags">
                <i className={'dqv-tag fluid-' + hoverInfo.fluid}>{hoverInfo.fluid}</i>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
