// SectionDrawer — draw a line on a 2D map, get the property panel beneath it.
//
// Named for the interaction rather than the output, and deliberately NOT `XSection`:
// a lowercase `xsection.ts` already exists here and on a case-insensitive filesystem
// the two collide, which TypeScript reports as a file that differs only in casing.
//
// Two canvases, one interaction. The map is an areal raster of the property at the
// current layer, drawn from `sliceProp`; clicking adds a vertex, double-click ends the
// line. The panel below samples every grid column the line crosses (`sectionPanel`) and
// draws each column to its TRUE top and base depth, not to a uniform box — a section
// that ignores the geometry is a coloured barcode, not a cross-section.
//
// Columns the line crosses OUTSIDE the model are drawn as a visible gap rather than
// skipped, because a section that closes over open ground reads as continuous geology.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PackedGridLike, PackedPropLike, PolylinePoint, SliceAxis } from './prop-view';
import { colorTable, normalise, rampColor, sectionPanel, sliceProp, styleFor } from './prop-view';
import { useStatic } from './static-store';
import { useThemeInk } from './theme-ink';

export interface SectionDrawerProps {
  grid: PackedGridLike & {
    dx: number; dy: number; x0: number; y0: number;
    topZ: ArrayLike<number>; baseZ: ArrayLike<number>;
  };
  prop: PackedPropLike;
  /** the colour range the 3D view is using — shared so the two never disagree */
  lo: number;
  hi: number;
  /** layer shown on the map */
  layer: number;
  points: PolylinePoint[];
  onPoints: (p: PolylinePoint[]) => void;
  /** the K player, driven from the shared store so the map and the 3D slice agree */
  onLayer?: (l: number) => void;
  nz?: number;
  /** wells, for context on the map */
  wells?: Array<{ name: string; x: number; y: number; producer?: boolean; injector?: boolean }>;
}

export function SectionDrawer({ grid, prop, lo, hi, layer, points, onPoints, wells = [], onLayer, nz }: SectionDrawerProps) {
  const mapRef = useRef<HTMLCanvasElement | null>(null);
  const panRef = useRef<HTMLCanvasElement | null>(null);
  const [hover, setHover] = useState<PolylinePoint | null>(null);
  const ink = useThemeInk();
  // the depth and value under the cursor on the SECTION — a colour is a category,
  // and a reader comparing two patches needs the number
  const [read, setRead] = useState<{ x: number; y: number; z: number; v: number; col: number } | null>(null);

  // ── canvases sized to their CONTAINER, not to the grid ──
  //
  // Drawing at `width={grid.nx}` and letting CSS stretch it to the pane is why the map
  // looked coarse and smeared: a 166 × 131 bitmap blown up to 700 px is 4× magnified,
  // and non-square when the pane is not the grid's aspect. Measuring the element and
  // drawing at devicePixelRatio gives crisp cells and a true aspect at any size.
  const [mapBox, setMapBox] = useState({ w: 600, h: 460 });
  const [panBox, setPanBox] = useState({ w: 600, h: 460 });
  const mapWrap = useRef<HTMLDivElement | null>(null);
  const panWrap = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const obs = new ResizeObserver((es) => {
      for (const e of es) {
        const r = e.contentRect;
        if (e.target === mapWrap.current) setMapBox({ w: Math.max(120, r.width), h: Math.max(120, r.height) });
        if (e.target === panWrap.current) setPanBox({ w: Math.max(120, r.width), h: Math.max(120, r.height) });
      }
    });
    if (mapWrap.current) obs.observe(mapWrap.current);
    if (panWrap.current) obs.observe(panWrap.current);
    return () => obs.disconnect();
  }, []);
  const dpr = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1);
  // the ramp chosen for this property in the nav bar, so map, section and
  // 3D never disagree about what a colour means
  const rampId = useStatic((st) => st.propRamp[prop.name]);
  const style = useMemo(() => styleFor(prop.name, rampId), [prop.name, rampId]);

  // the panel's own transform, recorded at draw time so the pointer can invert it
  const panGeom = useRef<{ pad: { l: number; r: number; t: number; b: number }; iw: number; ih: number;
    zTop: number; zBase: number; cw: number; n: number; dpr: number } | null>(null);

  const areal = useMemo(
    () => sliceProp(grid, prop, 'k' as SliceAxis, Math.max(0, Math.min(grid.nz - 1, layer))),
    [grid, prop, layer],
  );
  const panel = useMemo(
    () => (points.length >= 2 ? sectionPanel(grid, prop, points) : null),
    [grid, prop, points],
  );

  const onPanelMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const g = panGeom.current, cv = panRef.current;
    if (!g || !cv || !panel) { setRead(null); return; }
    const r = cv.getBoundingClientRect();
    // the canvas is drawn at dpr, so client pixels scale by the ratio of the two
    const k = cv.width / r.width;
    const px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k;
    if (px < g.pad.l || px > g.pad.l + g.iw || py < g.pad.t || py > g.pad.t + g.ih) { setRead(null); return; }
    const col = Math.min(g.n - 1, Math.max(0, Math.floor((px - g.pad.l) / g.cw)));
    const z = g.zTop + ((py - g.pad.t) / g.ih) * (g.zBase - g.zTop);
    const t = panel.topZ[col], b = panel.baseZ[col];
    let v = NaN;
    if (Number.isFinite(t) && Number.isFinite(b) && b > t && z >= t && z <= b) {
      const l = Math.min(panel.nz - 1, Math.max(0, Math.floor(((z - t) / (b - t)) * panel.nz)));
      v = panel.values[col * panel.nz + l];
    }
    setRead({ x: (e.clientX - r.left), y: (e.clientY - r.top), z, v, col });
  }, [panel]);


  const colorOf = useCallback((v: number) => {
    if (!Number.isFinite(v)) return null;
    if (style.categorical) {
      return style.codes?.find((c) => c.code === Math.round(v))?.color ?? '#888';
    }
    return rampColor(style.stops ?? [], normalise(style, v, lo, hi));
  }, [style, lo, hi]);

  // world ⇄ canvas, preserving aspect so a square cell is drawn square
  const view = useMemo(() => {
    const wM = grid.nx * grid.dx, hM = grid.ny * grid.dy;
    return { wM, hM, x1: grid.x0 + wM, y1: grid.y0 + hM };
  }, [grid]);

  // ── the map ──
  useEffect(() => {
    const cv = mapRef.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const W = cv.width, H = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // FIT, never stretch: a map with the wrong aspect is a map of a different field
    const sc = Math.min(W / grid.nx, H / grid.ny);
    const gw = grid.nx * sc, gh = grid.ny * sc;
    const ox = (W - gw) / 2, oy = (H - gh) / 2;

    for (let j = 0; j < grid.ny; j++) {
      for (let i = 0; i < grid.nx; i++) {
        const c = colorOf(areal.values[j * grid.nx + i]);
        if (!c) continue;
        ctx.fillStyle = c;
        // north is UP on screen, so the raster row is flipped
        ctx.fillRect(ox + i * sc, oy + (grid.ny - 1 - j) * sc, Math.ceil(sc), Math.ceil(sc));
      }
    }

    const toPx = (p: PolylinePoint) => ({
      x: ox + ((p.x - grid.x0) / view.wM) * gw,
      y: oy + gh - ((p.y - grid.y0) / view.hM) * gh,
    });

    // wells, with names — a map without labels is a pattern, not a location
    for (const w of wells) {
      const q = toPx(w);
      if (q.x < ox - 4 || q.x > ox + gw + 4) continue;
      ctx.fillStyle = w.injector ? '#5ac8fa' : w.producer ? '#ff6b4a' : '#cbd5e1';
      ctx.strokeStyle = ink.dark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(q.x, q.y, 3.4 * dpr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (w.producer || w.injector) {
        ctx.fillStyle = ink.tipBg;
        ctx.font = `${9 * dpr}px ui-monospace,monospace`;
        const tw = ctx.measureText(w.name).width;
        ctx.fillRect(q.x + 5 * dpr, q.y - 7 * dpr, tw + 5 * dpr, 12 * dpr);
        ctx.fillStyle = ink.tipInk;
        ctx.fillText(w.name, q.x + 7 * dpr, q.y + 2 * dpr);
      }
    }

    if (points.length) {
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2 * dpr;
      ctx.setLineDash([]);
      ctx.beginPath();
      points.forEach((p, n) => { const q = toPx(p); n ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
      ctx.stroke();
      // the rubber band to the cursor is DASHED, so a line in progress cannot be
      // mistaken for one that was drawn
      if (hover) {
        const a = toPx(points[points.length - 1]), b = toPx(hover);
        ctx.setLineDash([5 * dpr, 4 * dpr]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.setLineDash([]);
      }
      points.forEach((p, n) => {
        const q = toPx(p);
        ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = 'rgba(15,23,42,0.7)'; ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath(); ctx.arc(q.x, q.y, 5 * dpr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#0b1020'; ctx.font = `bold ${9 * dpr}px ui-monospace,monospace`;
        ctx.fillText(String(n + 1), q.x - 2.5 * dpr, q.y + 3 * dpr);
      });
    }
  }, [areal, colorOf, grid, points, hover, wells, view, dpr, mapBox]);

  // ── the panel ──
  useEffect(() => {
    const cv = panRef.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const W = cv.width, H = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!panel || !panel.columns.length) {
      ctx.fillStyle = '#64748b'; ctx.font = `${12 * dpr}px system-ui`;
      ctx.fillText('Click two or more points on the map to draw a section.', 16 * dpr, 26 * dpr);
      return;
    }

    let zTop = Infinity, zBase = -Infinity;
    for (let c = 0; c < panel.columns.length; c++) {
      if (Number.isFinite(panel.topZ[c])) zTop = Math.min(zTop, panel.topZ[c]);
      if (Number.isFinite(panel.baseZ[c])) zBase = Math.max(zBase, panel.baseZ[c]);
    }
    if (!Number.isFinite(zTop) || !Number.isFinite(zBase) || zBase <= zTop) {
      ctx.fillStyle = '#f59e0b'; ctx.font = `${12 * dpr}px system-ui`;
      ctx.fillText('The line does not cross the model.', 16 * dpr, 26 * dpr);
      return;
    }
    // a little headroom so the section is not glued to the frame
    const pad = { l: 46 * dpr, r: 12 * dpr, t: 26 * dpr, b: 26 * dpr };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const zPx = (z: number) => pad.t + ((z - zTop) / (zBase - zTop)) * ih;
    const cw = iw / panel.columns.length;

    for (let c = 0; c < panel.columns.length; c++) {
      const x = pad.l + c * cw;
      const t = panel.topZ[c], b = panel.baseZ[c];
      if (!Number.isFinite(t) || !Number.isFinite(b)) {
        // OUTSIDE the model — a visible gap, never closed over
        ctx.fillStyle = ink.empty;
        ctx.fillRect(x, pad.t, Math.ceil(cw) + 1, ih);
        continue;
      }
      const lh = (b - t) / panel.nz;
      for (let l = 0; l < panel.nz; l++) {
        const v = panel.values[c * panel.nz + l];
        const col = colorOf(v);
        if (!col) continue;
        ctx.fillStyle = col;
        const y0 = zPx(t + l * lh), y1 = zPx(t + (l + 1) * lh);
        ctx.fillRect(x, y0, Math.ceil(cw) + 1, Math.max(1, y1 - y0) + 1);
      }
    }

    // ── WELLS ON THE SECTION ──
    //
    // A panel without wells is a coloured band nobody can locate. Each well is
    // projected onto the polyline and drawn where it is closest, with the distance it
    // sits off the line — a well 800 m away is context, not a tie point, and the
    // reader has to be able to tell which.
    const colX = (idx: number) => pad.l + (idx + 0.5) * cw;
    for (const w of wells) {
      let bestIdx = -1, bestD = Infinity;
      for (let c = 0; c < panel.columns.length; c++) {
        const col = panel.columns[c];
        const cx = grid.x0 + (col.i + 0.5) * grid.dx;
        const cy = grid.y0 + (col.j + 0.5) * grid.dy;
        const d = Math.hypot(cx - w.x, cy - w.y);
        if (d < bestD) { bestD = d; bestIdx = c; }
      }
      if (bestIdx < 0 || bestD > 1200) continue;
      const x = colX(bestIdx);
      const near = bestD <= grid.dx * 1.5;
      ctx.strokeStyle = w.injector ? '#5ac8fa' : w.producer ? '#ff6b4a' : ink.axis;
      ctx.lineWidth = (near ? 2 : 1) * dpr;
      ctx.setLineDash(near ? [] : [4 * dpr, 4 * dpr]);
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ih); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ctx.strokeStyle as string;
      ctx.font = `${9 * dpr}px ui-monospace,monospace`;
      ctx.save();
      ctx.translate(x + 3 * dpr, pad.t + 4 * dpr);
      ctx.fillText(`${w.name}${near ? '' : ` (${bestD.toFixed(0)} m off)`}`, 0, 0);
      ctx.restore();
    }

    // ── A LABELLED DEPTH AXIS, NOT TWO END NUMBERS ──────────────────────────
    //
    // Two numbers at the ends make the reader interpolate by eye to place anything in
    // between, which is the one thing a depth section exists to make unnecessary.
    ctx.strokeStyle = ink.frame; ctx.lineWidth = 1 * dpr;
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + ih); ctx.stroke();
    ctx.fillStyle = ink.axis; ctx.font = `${9.5 * dpr}px ui-monospace,monospace`;
    {
      const zSpan = zBase - zTop;
      const zStep = zSpan > 800 ? 200 : zSpan > 400 ? 100 : zSpan > 160 ? 50 : zSpan > 60 ? 20 : 10;
      ctx.strokeStyle = ink.grid; ctx.lineWidth = 1;
      for (let z = Math.ceil(zTop / zStep) * zStep; z <= zBase; z += zStep) {
        const py = zPx(z);
        ctx.beginPath(); ctx.moveTo(pad.l, py); ctx.lineTo(pad.l + iw, py); ctx.stroke();
        ctx.fillStyle = ink.axis;
        ctx.fillText(z.toFixed(0), 3 * dpr, py + 3.5 * dpr);
      }
      // distance ticks along the section, so a feature can be located along the line
      const dStep = panel.lengthM > 8000 ? 2000 : panel.lengthM > 3000 ? 1000 : panel.lengthM > 1200 ? 500 : 200;
      ctx.strokeStyle = ink.grid;
      for (let d = dStep; d < panel.lengthM; d += dStep) {
        const px = pad.l + (d / panel.lengthM) * iw;
        ctx.beginPath(); ctx.moveTo(px, pad.t + ih); ctx.lineTo(px, pad.t + ih + 4 * dpr); ctx.stroke();
        ctx.fillStyle = ink.axis;
        const lab = d >= 1000 ? `${(d / 1000).toFixed(1)}k` : String(d);
        ctx.fillText(lab, px - ctx.measureText(lab).width / 2, H - 8 * dpr);
      }
    }
    ctx.fillStyle = ink.axis;
    ctx.font = `${10 * dpr}px ui-monospace,monospace`;
    ctx.fillText('0', pad.l, H - 8 * dpr);
    const km = `${(panel.lengthM / 1000).toFixed(2)} km`;
    ctx.fillText(km, W - ctx.measureText(km).width - 8 * dpr, H - 8 * dpr);
    // the pointer handler has to invert exactly this mapping, so it is recorded
    // rather than recomputed — two copies of a transform drift apart
    panGeom.current = { pad, iw, ih, zTop, zBase, cw, n: panel.columns.length, dpr };

    // ── the crosshair, and the value it is over ──
    if (read) {
      const px = read.x * dpr, py = read.y * dpr;
      ctx.strokeStyle = ink.cross; ctx.lineWidth = 1;
      ctx.setLineDash([3 * dpr, 3 * dpr]);
      ctx.beginPath(); ctx.moveTo(pad.l, py); ctx.lineTo(pad.l + iw, py); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px, pad.t); ctx.lineTo(px, pad.t + ih); ctx.stroke();
      ctx.setLineDash([]);
      const dec = style.decimals ?? 3;
      const txt = Number.isFinite(read.v)
        ? `${read.z.toFixed(0)} m   ${style.label} ${read.v.toFixed(dec)}${style.unit ? ' ' + style.unit : ''}`
        : `${read.z.toFixed(0)} m   no cell`;
      ctx.font = `${9.5 * dpr}px ui-monospace,monospace`;
      const tw2 = ctx.measureText(txt).width;
      const bx = Math.min(px + 8 * dpr, pad.l + iw - tw2 - 12 * dpr);
      ctx.fillStyle = ink.tipBg;
      ctx.fillRect(bx, py - 16 * dpr, tw2 + 10 * dpr, 14 * dpr);
      ctx.strokeStyle = ink.frame; ctx.strokeRect(bx, py - 16 * dpr, tw2 + 10 * dpr, 14 * dpr);
      ctx.fillStyle = ink.tipInk;
      ctx.fillText(txt, bx + 5 * dpr, py - 6 * dpr);
    }

    const gaps = panel.columns.filter((c) => !c.inside).length;
    if (gaps) {
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(`${gaps} column${gaps === 1 ? '' : 's'} outside the model`, pad.l + 6 * dpr, 16 * dpr);
    }
  }, [panel, colorOf, dpr, panBox, wells, grid, ink, read, style]);

  /** Screen → world, through the SAME fit the map is drawn with. Using the raw
   *  element rect instead puts every clicked vertex off by the letterbox margin. */
  const toWorld = (e: React.MouseEvent<HTMLCanvasElement>): PolylinePoint => {
    const r = e.currentTarget.getBoundingClientRect();
    const sc = Math.min(r.width / grid.nx, r.height / grid.ny);
    const gw = grid.nx * sc, gh = grid.ny * sc;
    const ox = (r.width - gw) / 2, oy = (r.height - gh) / 2;
    const fx = (e.clientX - r.left - ox) / gw;
    const fy = (e.clientY - r.top - oy) / gh;
    return { x: grid.x0 + fx * view.wM, y: grid.y0 + (1 - fy) * view.hM };
  };

  const table = useMemo(() => colorTable(style, lo, hi), [style, lo, hi]);

  return (
    <div className="gea-xs">
      <div className="gea-xs-map" ref={mapWrap}>
        <canvas ref={mapRef} width={Math.round(mapBox.w * dpr)} height={Math.round(mapBox.h * dpr)}
          onClick={(e) => onPoints([...points, toWorld(e)])}
          onContextMenu={(e) => {
            // right-click undoes the last vertex. A section is drawn by eye and the
            // first click is often a metre out; without an undo the only recovery is
            // to clear the whole line.
            e.preventDefault();
            if (points.length) onPoints(points.slice(0, -1));
          }}
          onDoubleClick={() => setHover(null)}
          onMouseMove={(e) => points.length && setHover(toWorld(e))}
          onMouseLeave={() => setHover(null)} />

        {/* the K player, ON THE MAP. Scrubbing a layer and reading its areal pattern is
            the whole reason to have a 2D view, and making the user reach back to the 3D
            toolbar to change it breaks that loop. */}
        {onLayer && (nz ?? grid.nz) > 1 && (
          <div className="gea-xs-k">
            <button onClick={() => onLayer(Math.max(0, layer - 1))} disabled={layer <= 0}>‹</button>
            <input type="range" min={0} max={(nz ?? grid.nz) - 1} step={1} value={layer}
              onChange={(e) => onLayer(Number(e.target.value))} />
            <button onClick={() => onLayer(Math.min((nz ?? grid.nz) - 1, layer + 1))}
              disabled={layer >= (nz ?? grid.nz) - 1}>›</button>
            <span>K {layer + 1} / {nz ?? grid.nz}</span>
          </div>
        )}

        <div className="gea-xs-cap">
          {style.label} · layer {layer + 1} / {nz ?? grid.nz}
          {points.length === 0 && <em> — click to start a section</em>}
          {points.length === 1 && <em> — click again to close the first segment</em>}
          {points.length > 1 && <span> · {points.length} vertices · right-click to undo</span>}
        </div>
      </div>
      <div className="gea-xs-panel" ref={panWrap}>
        <canvas ref={panRef} width={Math.round(panBox.w * dpr)} height={Math.round(panBox.h * dpr)}
          onMouseMove={onPanelMove} onMouseLeave={() => setRead(null)} />
        <div className="gea-xs-cap">
          {panel
            ? `${panel.columns.length} columns · ${(panel.lengthM / 1000).toFixed(2)} km · ${table.style.label}`
            : 'no section drawn'}
        </div>
      </div>
    </div>
  );
}
