// Crossplot.tsx — the Logs analytics drawer: a 2D crossplot (any-vs-any, with a
// lithology overlay for NPHI–RHOB, GR colour ramp, and polygon-lasso selection
// that highlights the chosen depth interval on the tracks) and a 3D crossplot
// (three-axis orthographic point cloud, drag to rotate — labelled projection).
import { useMemo, useRef, useState, useCallback } from 'react';
import { useCanvas, cssVar } from './hooks';
import { Segmented, inputStyle } from './chrome';
import { NatureBadge } from '../../components/Provenance';
import type { LogsJson } from '../../wb/types';

type Pt2 = [number, number];

export function Crossplot({ log, onSelectInterval, selInterval }: {
  log: LogsJson; onSelectInterval: (iv: [number, number] | null) => void; selInterval: [number, number] | null;
}) {
  const [mode, setMode] = useState<'2d' | '3d'>('2d');
  const curveKeys = Object.keys(log.curves);
  const has = (k: string) => curveKeys.includes(k);
  const [xC, setXC] = useState(has('NPHI') ? 'NPHI' : curveKeys[0]);
  const [yC, setYC] = useState(has('RHOB') ? 'RHOB' : curveKeys[1] ?? curveKeys[0]);
  const [zC, setZC] = useState(has('GR') ? 'GR' : curveKeys[0]);
  const colorC = has('GR') ? 'GR' : curveKeys[0];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: '1px solid var(--line)' }}>
        <span className="eyebrow" style={{ flex: 1 }}>Analytics</span>
        <NatureBadge nature="measured" />
        <Segmented options={[{ id: '2d' as const, label: '2D' }, { id: '3d' as const, label: '3D' }]} value={mode} onChange={setMode} accent="--violet" />
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '8px 10px', flexWrap: 'wrap', fontSize: 10.5, color: 'var(--muted)' }}>
        <label>X <select value={xC} onChange={(e) => setXC(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '2px 4px' }}>{curveKeys.map((k) => <option key={k}>{k}</option>)}</select></label>
        <label>Y <select value={yC} onChange={(e) => setYC(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '2px 4px' }}>{curveKeys.map((k) => <option key={k}>{k}</option>)}</select></label>
        {mode === '3d' && <label>Z <select value={zC} onChange={(e) => setZC(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '2px 4px' }}>{curveKeys.map((k) => <option key={k}>{k}</option>)}</select></label>}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {mode === '2d'
          ? <Plot2D log={log} xC={xC} yC={yC} colorC={colorC} onSelectInterval={onSelectInterval} selInterval={selInterval} />
          : <Plot3D log={log} xC={xC} yC={yC} zC={zC} colorC={colorC} />}
      </div>
      <div style={{ padding: '6px 10px', borderTop: '1px solid var(--line)', fontSize: 10, color: 'var(--muted)' }}>
        {mode === '2d' ? 'Drag a lasso to select points → highlights the depth interval on the tracks.' : 'Drag to rotate. Orthographic projection (labelled) — not a true 3D scene.'}
      </div>
    </div>
  );
}

function samples(log: LogsJson, keys: string[]): Array<{ md: number; v: number[] }> {
  const out: Array<{ md: number; v: number[] }> = [];
  const arrs = keys.map((k) => log.curves[k]?.values ?? []);
  const step = Math.max(1, Math.floor(log.md.length / 6000)); // cap point count
  for (let i = 0; i < log.md.length; i += step) {
    const v = arrs.map((a) => a[i]);
    if (v.some((x) => x == null || !isFinite(x as number))) continue;
    out.push({ md: log.md[i], v: v as number[] });
  }
  return out;
}
function rangeOf(pts: Array<{ v: number[] }>, i: number): [number, number] {
  let mn = Infinity, mx = -Infinity; for (const p of pts) { const x = p.v[i]; if (x < mn) mn = x; if (x > mx) mx = x; }
  if (!isFinite(mn)) return [0, 1]; if (mn === mx) mx = mn + 1; return [mn, mx];
}

function Plot2D({ log, xC, yC, colorC, onSelectInterval, selInterval }: {
  log: LogsJson; xC: string; yC: string; colorC: string; onSelectInterval: (iv: [number, number] | null) => void; selInterval: [number, number] | null;
}) {
  const pts = useMemo(() => samples(log, [xC, yC, colorC]), [log, xC, yC, colorC]);
  const [lasso, setLasso] = useState<Pt2[]>([]);
  const drawingRef = useRef(false);
  const isNphiRhob = (xC === 'NPHI' && yC === 'RHOB');

  const [xr, yr, cr] = useMemo(() => [rangeOf(pts, 0), rangeOf(pts, 1), rangeOf(pts, 2)], [pts]);
  // NPHI reversed high→low left→right; RHOB high at bottom (geoscience convention)
  const xDomain: [number, number] = isNphiRhob ? [0.45, -0.15] : xr;
  const yDomain: [number, number] = xC === 'NPHI' && yC === 'RHOB' ? [2.95, 1.95] : [yr[1], yr[0]];

  const geom = useRef<{ padL: number; padB: number; w: number; h: number }>({ padL: 40, padB: 28, w: 0, h: 0 });

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const padL = 40, padB = 28, padT = 10, padR = 10;
    geom.current = { padL, padB, w, h };
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const sx = (v: number) => padL + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * plotW;
    const sy = (v: number) => padT + ((v - yDomain[0]) / (yDomain[1] - yDomain[0])) * plotH;
    const line = cssVar('--line'), muted = cssVar('--muted'), text = cssVar('--text');
    // frame + grid
    ctx.strokeStyle = line; ctx.lineWidth = 0.5; ctx.strokeRect(padL, padT, plotW, plotH);
    ctx.fillStyle = muted; ctx.font = '8.5px var(--mono)';
    for (let i = 0; i <= 4; i++) {
      const fx = padL + (i / 4) * plotW, fy = padT + (i / 4) * plotH;
      ctx.textAlign = 'center'; ctx.fillText((xDomain[0] + (xDomain[1] - xDomain[0]) * (i / 4)).toFixed(2), fx, h - 14);
      ctx.textAlign = 'right'; ctx.fillText((yDomain[0] + (yDomain[1] - yDomain[0]) * (i / 4)).toFixed(2), padL - 3, fy + 3);
    }
    ctx.fillStyle = text; ctx.textAlign = 'center'; ctx.fillText(xC, padL + plotW / 2, h - 3);
    ctx.save(); ctx.translate(10, padT + plotH / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(yC, 0, 0); ctx.restore();

    // lithology overlay lines for NPHI–RHOB (matrix trends)
    if (isNphiRhob) {
      const lith: Array<{ name: string; pts: Pt2[]; col: string }> = [
        { name: 'SS', col: cssVar('--amber'), pts: [[-0.01, 2.65], [0.30, 2.30]] },
        { name: 'LS', col: cssVar('--teal'), pts: [[0.00, 2.71], [0.30, 2.40]] },
        { name: 'DOL', col: cssVar('--blue'), pts: [[0.02, 2.87], [0.30, 2.55]] },
      ];
      ctx.lineWidth = 1;
      for (const l of lith) {
        ctx.strokeStyle = l.col; ctx.beginPath(); ctx.moveTo(sx(l.pts[0][0]), sy(l.pts[0][1])); ctx.lineTo(sx(l.pts[1][0]), sy(l.pts[1][1])); ctx.stroke();
        ctx.fillStyle = l.col; ctx.textAlign = 'left'; ctx.fillText(l.name, sx(l.pts[1][0]) + 2, sy(l.pts[1][1]));
      }
    }
    // points (GR colour ramp)
    const inSel = (md: number) => selInterval && md >= selInterval[0] && md <= selInterval[1];
    for (const p of pts) {
      const t = (p.v[2] - cr[0]) / (cr[1] - cr[0]);
      const hue = 90 - t * 90; // green(sand)→red(shale)
      const px = sx(p.v[0]), py = sy(p.v[1]);
      if (px < padL || px > w - padR || py < padT || py > h - padB) continue;
      ctx.fillStyle = inSel(p.md) ? cssVar('--text') : `hsl(${hue},70%,55%)`;
      ctx.globalAlpha = inSel(p.md) ? 1 : 0.5;
      ctx.fillRect(px - 1, py - 1, 2, 2);
    }
    ctx.globalAlpha = 1;
    // lasso
    if (lasso.length) {
      ctx.strokeStyle = cssVar('--violet'); ctx.fillStyle = cssVar('--sel'); ctx.lineWidth = 1;
      ctx.beginPath(); lasso.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke(); ctx.fill();
    }
  }, [pts, xDomain, yDomain, cr, lasso, selInterval, xC, yC, isNphiRhob]);

  const { canvasRef, wrapRef } = useCanvas(draw, [draw]);

  const toLocal = (e: React.MouseEvent): Pt2 => { const el = canvasRef.current; if (!el) return [0, 0]; const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const onDown = (e: React.MouseEvent) => { drawingRef.current = true; setLasso([toLocal(e)]); };
  const onMove = (e: React.MouseEvent) => { if (drawingRef.current) setLasso((l) => [...l, toLocal(e)]); };
  const onUp = () => {
    drawingRef.current = false;
    // Build the selection region: a traced polygon (≥3 pts) or, for a simple
    // box-drag (2 pts), the bounding rectangle of the two corners.
    let region: Pt2[] | null = null;
    if (lasso.length >= 3) region = lasso;
    else if (lasso.length === 2) {
      const [[ax, ay], [bx, by]] = lasso;
      if (Math.hypot(bx - ax, by - ay) > 4) region = [[ax, ay], [bx, ay], [bx, by], [ax, by]];
    }
    if (region) {
      const { padL, padB, w, h } = geom.current;
      const padT = 10, padR = 10; const plotW = w - padL - padR, plotH = h - padT - padB;
      const sx = (v: number) => padL + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * plotW;
      const sy = (v: number) => padT + ((v - yDomain[0]) / (yDomain[1] - yDomain[0])) * plotH;
      let mn = Infinity, mx = -Infinity, count = 0;
      for (const p of pts) { if (pointInPoly([sx(p.v[0]), sy(p.v[1])], region)) { if (p.md < mn) mn = p.md; if (p.md > mx) mx = p.md; count++; } }
      onSelectInterval(count > 0 ? [mn, mx] : null);
    }
    setLasso([]);
  };

  return (
    <div ref={wrapRef} style={{ height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair' }} />
      {selInterval && (
        <button onClick={() => onSelectInterval(null)} style={{ position: 'absolute', top: 6, right: 8, ...inputStyle, width: 'auto', padding: '2px 8px', fontSize: 10, cursor: 'pointer', color: 'var(--rose)' }}>
          clear {selInterval[0].toFixed(0)}–{selInterval[1].toFixed(0)}m
        </button>
      )}
    </div>
  );
}

function Plot3D({ log, xC, yC, zC, colorC }: { log: LogsJson; xC: string; yC: string; zC: string; colorC: string }) {
  const pts = useMemo(() => samples(log, [xC, yC, zC, colorC]), [log, xC, yC, zC, colorC]);
  const [rot, setRot] = useState({ a: 0.6, b: 0.5 });
  const dragRef = useRef<{ x: number; y: number; a: number; b: number } | null>(null);
  const [xr, yr, zr, cr] = useMemo(() => [rangeOf(pts, 0), rangeOf(pts, 1), rangeOf(pts, 2), rangeOf(pts, 3)], [pts]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.32;
    const norm = (v: number, r: [number, number]) => ((v - r[0]) / (r[1] - r[0]) - 0.5) * 2;
    const ca = Math.cos(rot.a), sa = Math.sin(rot.a), cb = Math.cos(rot.b), sb = Math.sin(rot.b);
    const proj = (x: number, y: number, z: number): Pt2 => {
      const x1 = x * ca - z * sa, z1 = x * sa + z * ca;
      const y1 = y * cb - z1 * sb;
      return [cx + x1 * R, cy - y1 * R];
    };
    const line = cssVar('--line'), text = cssVar('--text');
    // axes
    const axes: Array<[[number, number, number], string, string]> = [
      [[1, 0, 0], xC, cssVar('--rose')], [[0, 1, 0], yC, cssVar('--blue')], [[0, 0, 1], zC, cssVar('--teal')],
    ];
    ctx.lineWidth = 1;
    for (const [dir, lab, col] of axes) {
      const o = proj(-dir[0], -dir[1], -dir[2]), e = proj(dir[0], dir[1], dir[2]);
      ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(e[0], e[1]); ctx.stroke();
      ctx.fillStyle = col; ctx.font = '9px var(--mono)'; ctx.fillText(lab, e[0] + 3, e[1]);
    }
    void line; void text;
    for (const p of pts) {
      const [px, py] = proj(norm(p.v[0], xr), norm(p.v[1], yr), norm(p.v[2], zr));
      const t = (p.v[3] - cr[0]) / (cr[1] - cr[0]);
      ctx.fillStyle = `hsl(${90 - t * 90},70%,55%)`; ctx.globalAlpha = 0.55;
      ctx.fillRect(px - 1, py - 1, 2, 2);
    }
    ctx.globalAlpha = 1;
  }, [pts, rot, xr, yr, zr, cr, xC, yC, zC]);

  const { canvasRef, wrapRef } = useCanvas(draw, [draw]);
  const onDown = (e: React.MouseEvent) => { dragRef.current = { x: e.clientX, y: e.clientY, a: rot.a, b: rot.b }; };
  const onMove = (e: React.MouseEvent) => { if (dragRef.current) setRot({ a: dragRef.current.a + (e.clientX - dragRef.current.x) * 0.01, b: dragRef.current.b + (e.clientY - dragRef.current.y) * 0.01 }); };
  const onUp = () => { dragRef.current = null; };
  return (
    <div ref={wrapRef} style={{ height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} style={{ display: 'block', width: '100%', height: '100%', cursor: 'grab' }} />
      <span className="chip mono" style={{ position: 'absolute', top: 6, right: 8, borderColor: 'var(--violet)', color: 'var(--violet)' }}>ORTHOGRAPHIC PROJECTION</span>
    </div>
  );
}

function pointInPoly(p: Pt2, poly: Pt2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > p[1]) !== (yj > p[1])) && (p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
