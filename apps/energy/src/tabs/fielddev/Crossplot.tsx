// Crossplot.tsx — the Logs analytics drawer: a 2D crossplot (any-vs-any, with a
// lithology overlay for NPHI–RHOB, GR colour ramp, and polygon-lasso selection
// that highlights the chosen depth interval on the tracks) and a 3D crossplot
// (three-axis orthographic point cloud, drag to rotate — labelled projection).
import { useMemo, useRef, useState, useCallback, lazy, Suspense } from 'react';
import { useCanvas, cssVar } from './hooks';
import { Segmented, inputStyle, withAlpha } from './chrome';
import { NatureBadge } from '../../components/Provenance';
import type { LogsJson } from '../../wb/types';

const Crossplot3D = lazy(() => import('./Crossplot3D'));

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
  const [hexbin, setHexbin] = useState(false);
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
        {mode === '2d' && (
          <button onClick={() => setHexbin((h) => !h)} style={{ ...inputStyle, width: 'auto', padding: '2px 8px', cursor: 'pointer', color: hexbin ? 'var(--text)' : 'var(--muted)', borderColor: hexbin ? 'var(--violet)' : 'var(--line)' }}>Density</button>
        )}
        <span style={{ flex: 1 }} />
        <GrLegend colorKey={colorC} />
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {mode === '2d'
          ? <Plot2D log={log} xC={xC} yC={yC} colorC={colorC} hexbin={hexbin} onSelectInterval={onSelectInterval} selInterval={selInterval} />
          : <Suspense fallback={<div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 11 }}>Compiling WebGL…</div>}><Crossplot3D log={log} xC={xC} yC={yC} zC={zC} colorC={colorC} /></Suspense>}
      </div>
      <div style={{ padding: '6px 10px', borderTop: '1px solid var(--line)', fontSize: 10, color: 'var(--muted)' }}>
        {mode === '2d' ? 'Drag a lasso/box to select points → highlights the depth interval on the tracks. Hover for point readout.' : 'Real WebGL point cloud — orbit / scroll to zoom.'}
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

function GrLegend({ colorKey }: { colorKey: string }) {
  const stops = [0, 0.25, 0.5, 0.75, 1].map((t) => `hsl(${90 - t * 90},70%,55%)`);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9.5, color: 'var(--muted)' }}>
      <span>{colorKey}</span>
      <span style={{ width: 54, height: 8, borderRadius: 2, background: `linear-gradient(90deg, ${stops.join(',')})` }} />
      <span>sand→shale</span>
    </span>
  );
}

function Plot2D({ log, xC, yC, colorC, hexbin, onSelectInterval, selInterval }: {
  log: LogsJson; xC: string; yC: string; colorC: string; hexbin: boolean; onSelectInterval: (iv: [number, number] | null) => void; selInterval: [number, number] | null;
}) {
  const pts = useMemo(() => samples(log, [xC, yC, colorC]), [log, xC, yC, colorC]);
  const [lasso, setLasso] = useState<Pt2[]>([]);
  const [hoverPt, setHoverPt] = useState<{ x: number; y: number; vx: number; vy: number; vc: number } | null>(null);
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
    const inSel = (md: number) => selInterval && md >= selInterval[0] && md <= selInterval[1];
    if (hexbin) {
      // density hexbin: accumulate counts into a hex lattice, shade by count
      const R = 7; const dx = R * 1.5, dy = R * Math.sqrt(3);
      const bins = new Map<string, number>();
      let maxc = 1;
      for (const p of pts) {
        const px = sx(p.v[0]), py = sy(p.v[1]);
        if (px < padL || px > w - padR || py < padT || py > h - padB) continue;
        const col = Math.round(px / dx); const off = (col % 2) * dy / 2;
        const row = Math.round((py - off) / dy);
        const key = `${col},${row}`; const c = (bins.get(key) ?? 0) + 1; bins.set(key, c); if (c > maxc) maxc = c;
      }
      for (const [key, c] of bins) {
        const [col, row] = key.split(',').map(Number);
        const cx = col * dx; const cy = row * dy + (col % 2) * dy / 2;
        const t = c / maxc;
        ctx.fillStyle = withAlpha(`hsl(${90 - t * 90},70%,55%)`, 0.35 + t * 0.55);
        ctx.beginPath();
        for (let k = 0; k < 6; k++) { const ang = Math.PI / 180 * (60 * k); const hx = cx + R * Math.cos(ang), hy = cy + R * Math.sin(ang); k ? ctx.lineTo(hx, hy) : ctx.moveTo(hx, hy); }
        ctx.closePath(); ctx.fill();
      }
    } else {
      // scatter (GR colour ramp)
      for (const p of pts) {
        const t = (p.v[2] - cr[0]) / (cr[1] - cr[0]);
        const px = sx(p.v[0]), py = sy(p.v[1]);
        if (px < padL || px > w - padR || py < padT || py > h - padB) continue;
        ctx.fillStyle = inSel(p.md) ? cssVar('--text') : `hsl(${90 - t * 90},70%,55%)`;
        ctx.globalAlpha = inSel(p.md) ? 1 : 0.5;
        ctx.fillRect(px - 1, py - 1, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
    // hover marker
    if (hoverPt) {
      ctx.strokeStyle = cssVar('--text'); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(hoverPt.x, hoverPt.y, 4, 0, Math.PI * 2); ctx.stroke();
    }
    // lasso
    if (lasso.length) {
      ctx.strokeStyle = cssVar('--violet'); ctx.fillStyle = cssVar('--sel'); ctx.lineWidth = 1;
      ctx.beginPath(); lasso.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke(); ctx.fill();
    }
  }, [pts, xDomain, yDomain, cr, lasso, selInterval, xC, yC, isNphiRhob, hexbin, hoverPt]);

  const { canvasRef, wrapRef } = useCanvas(draw, [draw]);

  const toLocal = (e: React.MouseEvent): Pt2 => { const el = canvasRef.current; if (!el) return [0, 0]; const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const onDown = (e: React.MouseEvent) => { drawingRef.current = true; setLasso([toLocal(e)]); };
  const onMove = (e: React.MouseEvent) => {
    const [lx, ly] = toLocal(e);
    if (drawingRef.current) { setLasso((l) => [...l, [lx, ly]]); return; }
    // nearest point readout
    const { padL, padB, w, h } = geom.current; const padT = 10, padR = 10; const plotW = w - padL - padR, plotH = h - padT - padB;
    const sx = (v: number) => padL + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * plotW;
    const sy = (v: number) => padT + ((v - yDomain[0]) / (yDomain[1] - yDomain[0])) * plotH;
    let best: typeof hoverPt = null, bd = 100;
    for (const p of pts) { const px = sx(p.v[0]), py = sy(p.v[1]); const d = Math.hypot(px - lx, py - ly); if (d < bd) { bd = d; best = { x: px, y: py, vx: p.v[0], vy: p.v[1], vc: p.v[2] }; } }
    setHoverPt(best);
  };
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
      <canvas ref={canvasRef} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={() => { onUp(); setHoverPt(null); }} style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair' }} />
      {hoverPt && !drawingRef.current && (
        <div className="mono" style={{ position: 'absolute', left: Math.min(hoverPt.x + 8, 220), top: Math.max(6, hoverPt.y - 8), fontSize: 9.5, color: 'var(--text)', background: 'color-mix(in srgb, var(--panel) 90%, transparent)', border: '1px solid var(--line)', borderRadius: 3, padding: '2px 6px', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          {xC} {hoverPt.vx.toFixed(2)} · {yC} {hoverPt.vy.toFixed(2)} · {colorC} {hoverPt.vc.toFixed(0)}
        </div>
      )}
      {selInterval && (
        <button onClick={() => onSelectInterval(null)} style={{ position: 'absolute', top: 6, right: 8, ...inputStyle, width: 'auto', padding: '2px 8px', fontSize: 10, cursor: 'pointer', color: 'var(--rose)' }}>
          clear {selInterval[0].toFixed(0)}–{selInterval[1].toFixed(0)}m
        </button>
      )}
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
