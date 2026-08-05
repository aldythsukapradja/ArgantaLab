// RMChart — a state-of-the-art interactive line/scatter chart for the Reservoir-
// Management surfaces. Built on d3-scale + d3-shape (math) with React owning the DOM
// (the modern pattern). Features: animated draw-in (reduced-motion aware), a snapped
// crosshair with a rich multi-series tooltip (d3 bisector), hover-to-highlight (dim the
// rest), an interactive legend (click to toggle a series), brush-to-zoom on X (drag a
// range, double-click to reset), gradient area fill under the focus series, log-X/log-Y
// axes, and a dashed target line. Token-themed, both light/dark, responsive.
import { useEffect, useMemo, useRef, useState, useId } from 'react';
import { scaleLinear, scaleLog, type ScaleContinuousNumeric } from 'd3-scale';
import { line as d3line, area as d3area, curveMonotoneX } from 'd3-shape';
import { cssVar } from '../../fielddev/hooks';

export interface RMSeries {
  name: string;
  color: string;                 // token var() or hex
  pts: Array<[number, number]>;  // data space
  width?: number;
  dashed?: boolean;
  faded?: boolean;               // cohort (grey background) vs focus
  area?: boolean;                // gradient area fill under this series
}
export interface RMChartProps {
  series: RMSeries[];
  xLabel: string; yLabel: string;
  yLog?: boolean; xLog?: boolean;
  target?: { y: number; label?: string; color?: string };
  xFmt?: (v: number) => string;
  yFmt?: (v: number) => string;
  height?: number;
  legend?: boolean;              // default: on when >1 named series
  zoomable?: boolean;            // default: true
  animate?: boolean;             // default: true (unless reduced motion)
}

const PAD = { l: 50, r: 14, t: 14, b: 30 };
/** d3-array's `bisector(d => d[0]).left`, inlined — index of the first point whose x is
 *  >= target. Dropping the package import removes a late-discovered Vite optimizer entry
 *  that 504'd and broke the surface (see engine/charts/SurveillanceCharts.ts). */
const bisectX = (pts: Array<[number, number]>, target: number): number => {
  let lo = 0, hi = pts.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (pts[mid][0] < target) lo = mid + 1; else hi = mid; }
  return lo;
};

function fmtNum(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (v / 1e3).toFixed(1) + 'k';
  if (a > 0 && a < 1) return (Math.round(v * 1000) / 1000).toString();
  return (Math.round(v * 100) / 100).toString();
}

export function RMChart(props: RMChartProps) {
  const { series, xLabel, yLabel, yLog, xLog, target, xFmt, yFmt, height, zoomable = true } = props;
  const uid = useId().replace(/[:]/g, '');
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hoverX, setHoverX] = useState<number | null>(null);       // pixel x
  const [zoom, setZoom] = useState<[number, number] | null>(null); // data-x domain
  const [brush, setBrush] = useState<{ x0: number; x1: number } | null>(null);
  const brushRef = useRef<{ x0: number; x1: number } | null>(null); // avoids stale-closure in onUp
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [activeName, setActiveName] = useState<string | null>(null);
  const [drawn, setDrawn] = useState(false);

  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const animate = (props.animate ?? true) && !reduce;
  const showLegend = props.legend ?? series.filter((s) => s.name).length > 1;

  useEffect(() => {
    const wrap = wrapRef.current; if (!wrap) return;
    const ro = new ResizeObserver(() => setSize({ w: wrap.clientWidth, h: wrap.clientHeight }));
    ro.observe(wrap); setSize({ w: wrap.clientWidth, h: wrap.clientHeight });
    return () => ro.disconnect();
  }, []);
  useEffect(() => { setDrawn(false); const id = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true))); return () => cancelAnimationFrame(id); }, [series, size.w, size.h, zoom]);

  const visible = useMemo(() => series.filter((s) => !hidden.has(s.name)), [series, hidden]);

  const model = useMemo(() => {
    const legendH = showLegend ? 22 : 0;
    const iw = size.w - PAD.l - PAD.r, ih = size.h - PAD.t - PAD.b - legendH;
    const all = visible.flatMap((s) => s.pts);
    if (!all.length || iw < 30 || ih < 30) return null;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of all) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (target) { y0 = Math.min(y0, target.y); y1 = Math.max(y1, target.y); }
    if (zoom) { x0 = zoom[0]; x1 = zoom[1]; }
    if (x0 === x1) x1 = x0 + 1;
    const x: ScaleContinuousNumeric<number, number> = xLog
      ? scaleLog().domain([Math.max(1e-3, x0), Math.max(x0 * 10, x1)]).range([PAD.l, PAD.l + iw]).clamp(true)
      : scaleLinear().domain([x0, x1]).range([PAD.l, PAD.l + iw]).nice();
    const y: ScaleContinuousNumeric<number, number> = yLog
      ? scaleLog().domain([Math.max(1e-3, y0), Math.max(y0 * 10, y1)]).range([PAD.t + ih, PAD.t]).clamp(true)
      : scaleLinear().domain([y0 - (y1 - y0) * 0.06 || y0 - 1, y1 + (y1 - y0) * 0.06 || y1 + 1]).range([PAD.t + ih, PAD.t]).nice();
    const xticks = (xLog ? x.ticks(4) : (x as ReturnType<typeof scaleLinear>).ticks(6)) as number[];
    const yticks = (yLog ? y.ticks(4) : (y as ReturnType<typeof scaleLinear>).ticks(5)) as number[];
    return { x, y, iw, ih, legendH, xd: [x0, x1] as [number, number], xticks, yticks };
  }, [visible, size, xLog, yLog, target, zoom, showLegend]);

  const mkLine = useMemo(() => model ? d3line<[number, number]>().x((d) => model.x(d[0])).y((d) => model.y(d[1])).curve(curveMonotoneX) : null, [model]);
  const mkArea = useMemo(() => model ? d3area<[number, number]>().x((d) => model.x(d[0])).y0(model.y.range()[0]).y1((d) => model.y(d[1])).curve(curveMonotoneX) : null, [model]);

  const line = cssVar('--line'), muted = cssVar('--muted'), text = cssVar('--text'), panel = cssVar('--panel');
  const fmtX = xFmt ?? fmtNum, fmtY = yFmt ?? fmtNum;

  // nearest-x hover readout across visible series
  const hover = useMemo(() => {
    if (hoverX == null || !model) return null;
    const dataX = model.x.invert(hoverX);
    const rows = visible.map((s) => {
      if (s.pts.length < 1) return null;
      const i = Math.min(s.pts.length - 1, Math.max(0, bisectX(s.pts, dataX)));
      const a = s.pts[Math.max(0, i - 1)], b = s.pts[Math.min(s.pts.length - 1, i)];
      const p = Math.abs((a?.[0] ?? Infinity) - dataX) < Math.abs((b?.[0] ?? Infinity) - dataX) ? a : b;
      return p ? { name: s.name, color: s.color, x: p[0], y: p[1] } : null;
    }).filter(Boolean) as Array<{ name: string; color: string; x: number; y: number }>;
    if (!rows.length) return null;
    const gx = model.x(rows[0].x);
    return { gx, rows };
  }, [hoverX, model, visible]);

  function onMove(e: React.PointerEvent) {
    if (!model || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const px = e.clientX - r.left;
    const cx = Math.max(PAD.l, Math.min(PAD.l + model.iw, px));
    if (brushRef.current) { brushRef.current = { ...brushRef.current, x1: cx }; setBrush({ ...brushRef.current }); setHoverX(null); return; }
    setHoverX(px < PAD.l || px > PAD.l + model.iw ? null : px);
  }
  function onDown(e: React.PointerEvent) {
    if (!zoomable || !model || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const px = Math.max(PAD.l, Math.min(PAD.l + model.iw, e.clientX - r.left));
    brushRef.current = { x0: px, x1: px }; setBrush({ x0: px, x1: px });
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* synthetic pointer */ }
  }
  function onUp() {
    const b = brushRef.current;
    if (b && model && Math.abs(b.x1 - b.x0) > 12) {
      setZoom([model.x.invert(Math.min(b.x0, b.x1)), model.x.invert(Math.max(b.x0, b.x1))]);
    }
    brushRef.current = null; setBrush(null);
  }
  const toggle = (name: string) => setHidden((h) => { const n = new Set(h); n.has(name) ? n.delete(name) : n.add(name); return n; });

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: height ?? '100%', minHeight: 150, userSelect: 'none' }}>
      {model && (
        <svg ref={svgRef} width={size.w} height={size.h} style={{ display: 'block', position: 'absolute', inset: 0, cursor: brush ? 'ew-resize' : 'crosshair' }}
          onPointerMove={onMove} onPointerLeave={() => { setHoverX(null); brushRef.current = null; setBrush(null); }} onPointerDown={onDown} onPointerUp={onUp}
          onDoubleClick={() => setZoom(null)}>
          <defs>
            {visible.map((s, i) => s.area && (
              <linearGradient key={i} id={`grad-${uid}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
            <clipPath id={`clip-${uid}`}><rect x={PAD.l} y={PAD.t} width={model.iw} height={model.ih} /></clipPath>
          </defs>
          {/* gridlines */}
          {model.yticks.map((v, i) => { const yy = model.y(v); return <line key={'gy' + i} x1={PAD.l} y1={yy} x2={PAD.l + model.iw} y2={yy} stroke={line} strokeWidth={1} strokeDasharray="2 4" opacity={0.4} />; })}
          {model.xticks.map((v, i) => { const xx = model.x(v); return <line key={'gx' + i} x1={xx} y1={PAD.t} x2={xx} y2={PAD.t + model.ih} stroke={line} strokeWidth={1} strokeDasharray="2 4" opacity={0.28} />; })}
          {/* tick labels */}
          {model.yticks.map((v, i) => <text key={'ty' + i} x={PAD.l - 7} y={model.y(v) + 3} textAnchor="end" fontSize={9.5} fill={muted} fontFamily="var(--mono)">{fmtY(v)}</text>)}
          {model.xticks.map((v, i) => <text key={'tx' + i} x={model.x(v)} y={PAD.t + model.ih + 14} textAnchor="middle" fontSize={9.5} fill={muted} fontFamily="var(--mono)">{fmtX(v)}</text>)}
          {/* frame */}
          <path d={`M${PAD.l},${PAD.t} L${PAD.l},${PAD.t + model.ih} L${PAD.l + model.iw},${PAD.t + model.ih}`} fill="none" stroke={line} strokeWidth={1.2} />
          {/* target */}
          {target && <line x1={PAD.l} y1={model.y(target.y)} x2={PAD.l + model.iw} y2={model.y(target.y)} stroke={target.color ?? cssVar('--orange')} strokeWidth={1.3} strokeDasharray="5 3" opacity={0.85} />}
          {target?.label && <text x={PAD.l + model.iw - 4} y={model.y(target.y) - 4} textAnchor="end" fontSize={9} fill={target.color ?? cssVar('--orange')} fontFamily="var(--mono)">{target.label}</text>}
          {/* series (clipped) */}
          <g clipPath={`url(#clip-${uid})`}>
            {mkArea && visible.map((s, i) => s.area && s.pts.length > 1 && <path key={'a' + i} d={mkArea(s.pts) || ''} fill={`url(#grad-${uid}-${i})`} opacity={activeName && activeName !== s.name ? 0.2 : 1} />)}
            {mkLine && [...visible].sort((a, b) => (a.faded === b.faded ? 0 : a.faded ? -1 : 1)).map((s, i) => {
              const dim = (activeName && activeName !== s.name) || s.faded;
              const w = (s.width ?? (s.faded ? 1 : 1.9)) * (activeName === s.name ? 1.5 : 1);
              return <path key={'l' + i} d={mkLine(s.pts) || ''} fill="none" stroke={s.color}
                strokeWidth={w} strokeDasharray={s.dashed ? '5 3' : undefined} opacity={dim ? 0.22 : 0.96}
                strokeLinejoin="round" strokeLinecap="round" pathLength={animate ? 1 : undefined}
                style={animate ? { strokeDasharray: s.dashed ? '5 3' : 1, strokeDashoffset: drawn ? 0 : 1, transition: `stroke-dashoffset .7s ease ${i * 0.04}s, opacity .2s` } : { transition: 'opacity .2s' }} />;
            })}
          </g>
          {/* brush rectangle */}
          {brush && <rect x={Math.min(brush.x0, brush.x1)} y={PAD.t} width={Math.abs(brush.x1 - brush.x0)} height={model.ih} fill={cssVar('--blue')} opacity={0.12} stroke={cssVar('--blue')} strokeOpacity={0.4} />}
          {/* crosshair + focus dots */}
          {hover && !brush && (<>
            <line x1={hover.gx} y1={PAD.t} x2={hover.gx} y2={PAD.t + model.ih} stroke={muted} strokeWidth={1} opacity={0.5} />
            {hover.rows.map((r, i) => <circle key={i} cx={hover.gx} cy={model.y(r.y)} r={3.4} fill={panel} stroke={r.color} strokeWidth={2} />)}
          </>)}
          {/* axis titles */}
          <text x={PAD.l + model.iw / 2} y={size.h - model.legendH - 1} textAnchor="middle" fontSize={9.5} fill={muted} fontFamily="var(--mono)" letterSpacing="0.04em">{xLabel.toUpperCase()}</text>
          <text x={13} y={PAD.t + model.ih / 2} textAnchor="middle" fontSize={9.5} fill={muted} fontFamily="var(--mono)" letterSpacing="0.04em" transform={`rotate(-90 13 ${PAD.t + model.ih / 2})`}>{yLabel.toUpperCase()}</text>
          {/* legend */}
          {showLegend && (
            <g transform={`translate(${PAD.l}, ${size.h - 4})`}>
              {series.filter((s) => s.name).map((s, i) => {
                const off = i * 96; const isHidden = hidden.has(s.name);
                return (
                  <g key={s.name} transform={`translate(${off}, 0)`} style={{ cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); toggle(s.name); }} onPointerEnter={() => setActiveName(s.name)} onPointerLeave={() => setActiveName(null)}>
                    <rect x={0} y={-9} width={12} height={4} rx={2} fill={s.color} opacity={isHidden ? 0.3 : 1} />
                    <text x={16} y={-5} fontSize={9.5} fill={isHidden ? muted : text} fontFamily="var(--mono)" style={{ textDecoration: isHidden ? 'line-through' : 'none' }}>{s.name}</text>
                  </g>
                );
              })}
            </g>
          )}
        </svg>
      )}
      {/* tooltip overlay */}
      {hover && !brush && model && (
        <div className="mono" style={{ position: 'absolute', left: Math.min(hover.gx + 12, size.w - 130), top: PAD.t + 6,
          fontSize: 10.5, background: 'color-mix(in srgb, var(--panel) 94%, transparent)', border: '1px solid var(--line)',
          borderRadius: 6, padding: '5px 8px', pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(0,0,0,0.16)', minWidth: 96 }}>
          <div style={{ color: 'var(--muted)', marginBottom: 3 }}>{xLabel}: {fmtX(hover.rows[0].x)}</div>
          {hover.rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flex: 'none' }} />
              <span style={{ color: 'var(--muted)', flex: 1 }}>{r.name || yLabel}</span>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{fmtY(r.y)}</span>
            </div>
          ))}
        </div>
      )}
      {zoom && <button onClick={() => setZoom(null)} style={{ position: 'absolute', top: 6, right: 8, fontSize: 9.5, fontFamily: 'var(--mono)', color: 'var(--muted)', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 4, padding: '2px 7px', cursor: 'pointer' }}>reset zoom</button>}
      {!model && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 11 }}>no data</div>}
    </div>
  );
}
