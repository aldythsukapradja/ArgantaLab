// RMChart — the Reservoir-Management diagnostic chart core, a de-identified port of the
// founder's WellNexus inline-SVG engine (`WLN_CHART`). Zero chart-library dependency:
// axes (linear + first-class log-Y with decade ticks), Fritsch–Carlson monotone-cubic
// series paths (no overshoot), an optional dashed target line, and a nearest-point
// hover tooltip. Token-themed, both light/dark, reduced-motion safe. One component
// renders every panel of the 9-panel diagnostic grid (config-driven, see registry/data).
import { useEffect, useRef, useState, useMemo } from 'react';
import { cssVar } from '../../fielddev/hooks';

export interface RMSeries {
  name: string;
  color: string;                 // token var() or hex
  pts: Array<[number, number]>;  // already in data space
  width?: number;
  dashed?: boolean;
  faded?: boolean;               // cohort (grey background) vs focus
}
export interface RMChartProps {
  series: RMSeries[];
  xLabel: string; yLabel: string;
  yLog?: boolean;
  target?: { y: number; label?: string; color?: string };
  xFmt?: (v: number) => string;
  yFmt?: (v: number) => string;
  height?: number;               // css px; default fills wrapper
}

const PAD = { l: 46, r: 12, t: 12, b: 26 };

function niceTicks(lo: number, hi: number, n = 5): number[] {
  if (!(hi > lo)) return [lo];
  const span = hi - lo, step0 = Math.pow(10, Math.floor(Math.log10(span / n)));
  const err = (span / n) / step0;
  const step = err >= 7.5 ? 10 * step0 : err >= 3 ? 5 * step0 : err >= 1.5 ? 2 * step0 : step0;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) out.push(Math.round(v / step) * step);
  return out;
}

/** Fritsch–Carlson monotone cubic Hermite → SVG path, tangents mapped through the
 *  (possibly log) scale functions so it works for linear and log-Y alike. */
function monotonePath(pts: Array<[number, number]>, sx: (v: number) => number, sy: (v: number) => number): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${sx(pts[0][0])},${sy(pts[0][1])}`;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const dx: number[] = [], m: number[] = [], t: number[] = new Array(n);
  for (let i = 0; i < n - 1; i++) { dx[i] = xs[i + 1] - xs[i] || 1e-9; m[i] = (ys[i + 1] - ys[i]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; }
    else { const a = t[i] / m[i], b = t[i + 1] / m[i], h = Math.hypot(a, b); if (h > 3) { const s = 3 / h; t[i] = s * a * m[i]; t[i + 1] = s * b * m[i]; } }
  }
  let d = `M${sx(xs[0])},${sy(ys[0])}`;
  for (let i = 0; i < n - 1; i++) {
    const c1x = sx(xs[i] + dx[i] / 3), c1y = sy(ys[i] + (t[i] * dx[i]) / 3);
    const c2x = sx(xs[i + 1] - dx[i] / 3), c2y = sy(ys[i + 1] - (t[i + 1] * dx[i]) / 3);
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${sx(xs[i + 1])},${sy(ys[i + 1])}`;
  }
  return d;
}

export function RMChart({ series, xLabel, yLabel, yLog, target, xFmt, yFmt, height }: RMChartProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<{ x: number; y: number; sx: number; sy: number; name: string } | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current; if (!wrap) return;
    const ro = new ResizeObserver(() => setSize({ w: wrap.clientWidth, h: wrap.clientHeight }));
    ro.observe(wrap); setSize({ w: wrap.clientWidth, h: wrap.clientHeight });
    return () => ro.disconnect();
  }, []);

  const model = useMemo(() => {
    const all = series.flatMap((s) => s.pts);
    if (!all.length || size.w < 40 || size.h < 40) return null;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of all) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (target) { y0 = Math.min(y0, target.y); y1 = Math.max(y1, target.y); }
    if (x0 === x1) x1 = x0 + 1;
    const innerW = size.w - PAD.l - PAD.r, innerH = size.h - PAD.t - PAD.b;
    const sx = (v: number) => PAD.l + ((v - x0) / (x1 - x0)) * innerW;
    let sy: (v: number) => number, yticks: number[];
    if (yLog) {
      const lo = Math.max(1e-3, y0), hi = Math.max(lo * 10, y1);
      const l0 = Math.floor(Math.log10(lo)), l1 = Math.ceil(Math.log10(hi));
      sy = (v: number) => { const lv = Math.log10(Math.max(1e-3, v)); return PAD.t + (1 - (lv - l0) / (l1 - l0 || 1)) * innerH; };
      yticks = []; for (let k = l0; k <= l1; k++) yticks.push(Math.pow(10, k));
    } else {
      const pad = (y1 - y0) * 0.06 || 1; const lo = y0 - pad, hi = y1 + pad;
      sy = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * innerH;
      yticks = niceTicks(lo, hi, 5);
    }
    const xticks = niceTicks(x0, x1, 5);
    return { x0, x1, sx, sy, xticks, yticks, innerW, innerH };
  }, [series, size, yLog, target]);

  const line = cssVar('--line'), muted = cssVar('--muted'), text = cssVar('--text');
  const fmtX = xFmt ?? ((v: number) => (Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(Math.round(v * 100) / 100)));
  const fmtY = yFmt ?? ((v: number) => (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v < 1 ? String(Math.round(v * 1000) / 1000) : String(Math.round(v * 100) / 100)));

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: height ?? '100%', minHeight: 140 }}>
      {model && (
        <svg width={size.w} height={size.h} style={{ display: 'block', position: 'absolute', inset: 0 }}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const mx = e.clientX - rect.left;
            let best: typeof hover = null, bd = Infinity;
            for (const s of series) for (const [x, y] of s.pts) { const px = model.sx(x); const d = Math.abs(px - mx); if (d < bd) { bd = d; best = { x, y, sx: px, sy: model.sy(y), name: s.name }; } }
            setHover(bd < 40 ? best : null);
          }}>
          {/* grid + y ticks */}
          {model.yticks.map((v, i) => { const yy = model.sy(v); return (
            <g key={'y' + i}>
              <line x1={PAD.l} y1={yy} x2={size.w - PAD.r} y2={yy} stroke={line} strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />
              <text x={PAD.l - 6} y={yy + 3} textAnchor="end" fontSize={9.5} fill={muted} fontFamily="var(--mono)">{fmtY(v)}</text>
            </g>); })}
          {/* x ticks */}
          {model.xticks.map((v, i) => { const xx = model.sx(v); return (
            <g key={'x' + i}>
              <line x1={xx} y1={PAD.t} x2={xx} y2={size.h - PAD.b} stroke={line} strokeWidth={1} strokeDasharray="2 3" opacity={0.35} />
              <text x={xx} y={size.h - PAD.b + 13} textAnchor="middle" fontSize={9.5} fill={muted} fontFamily="var(--mono)">{fmtX(v)}</text>
            </g>); })}
          {/* frame */}
          <path d={`M${PAD.l},${PAD.t} L${PAD.l},${size.h - PAD.b} L${size.w - PAD.r},${size.h - PAD.b}`} fill="none" stroke={line} strokeWidth={1.2} />
          {/* target line */}
          {target && (
            <line x1={PAD.l} y1={model.sy(target.y)} x2={size.w - PAD.r} y2={model.sy(target.y)}
              stroke={target.color ?? cssVar('--orange')} strokeWidth={1.3} strokeDasharray="4 3" opacity={0.8} />
          )}
          {/* series — cohort (faded) first, focus over */}
          {[...series].sort((a, b) => (a.faded === b.faded ? 0 : a.faded ? -1 : 1)).map((s, i) => (
            <path key={i} d={monotonePath(s.pts, model.sx, model.sy)} fill="none"
              stroke={s.color} strokeWidth={s.width ?? (s.faded ? 1 : 1.8)} strokeDasharray={s.dashed ? '4 3' : undefined}
              opacity={s.faded ? 0.28 : 0.95} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {/* axis labels */}
          <text x={PAD.l + model.innerW / 2} y={size.h - 2} textAnchor="middle" fontSize={9.5} fill={muted} fontFamily="var(--mono)" letterSpacing="0.04em">{xLabel.toUpperCase()}</text>
          <text x={11} y={PAD.t + model.innerH / 2} textAnchor="middle" fontSize={9.5} fill={muted} fontFamily="var(--mono)" letterSpacing="0.04em" transform={`rotate(-90 11 ${PAD.t + model.innerH / 2})`}>{yLabel.toUpperCase()}</text>
          {/* hover */}
          {hover && (<>
            <line x1={hover.sx} y1={PAD.t} x2={hover.sx} y2={size.h - PAD.b} stroke={muted} strokeWidth={1} opacity={0.4} />
            <circle cx={hover.sx} cy={hover.sy} r={3.2} fill={text} />
          </>)}
        </svg>
      )}
      {hover && (
        <div className="mono" style={{ position: 'absolute', left: Math.min(hover.sx + 8, size.w - 96), top: Math.max(4, hover.sy - 30),
          fontSize: 10, background: 'color-mix(in srgb, var(--panel) 88%, transparent)', border: '1px solid var(--line)',
          borderRadius: 4, padding: '3px 6px', pointerEvents: 'none', whiteSpace: 'nowrap', color: 'var(--text)' }}>
          {fmtX(hover.x)}, {fmtY(hover.y)}
        </div>
      )}
      {!model && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 11 }}>no data</div>}
    </div>
  );
}
