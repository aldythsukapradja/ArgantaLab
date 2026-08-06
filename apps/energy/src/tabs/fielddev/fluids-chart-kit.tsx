// fluids-chart-kit.tsx — the Fluids & Rock stage's chart chrome.
//
// One frame, one hover model, one axis style, shared by every plot on the stage. The
// charts were seven hand-rolled SVGs with hand-rolled scales and no interaction; this
// replaces the hand-rolling with d3-scale / d3-axis / d3-format so ticks are chosen by
// the same algorithm everywhere and every axis carries its unit.
//
// WHY d3-scale BUT NOT d3-selection. React owns the DOM here. d3 is used for what it
// is unambiguously better at — choosing tick values, formatting them, and building
// path strings — while the elements themselves are rendered by React. Mixing
// d3-selection into a React subtree gives two writers for one node, which is how
// charts start disagreeing with the state that produced them.
//
// EVERY CHART IS INTERACTIVE. Hovering gives a crosshair and a readout of every series
// at that position, with units. A plot you cannot interrogate is a picture; the point
// of these is that an engineer can ask "what is Bo at 250 bara" and get the number the
// simulator would use.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { scaleLog } from 'd3-scale';
import {
  M, readText, tickText,
  type AxisSpec, type Margin, type Probe, type SeriesSpec,
} from './fluids-format';

// the pure half — scales, formatting, path builders, the unit splitter
export * from './fluids-format';

/** Track the element's real pixel size so the chart is drawn at 1:1 and never
 *  stretched by `preserveAspectRatio`, which is what made the old axis labels
 *  render at different sizes on every panel. */
export function useChartSize<T extends HTMLElement>(): [React.RefObject<T>, { w: number; h: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 640, h: 320 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      if (r.width > 0 && r.height > 0) setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

// ── the frame ────────────────────────────────────────────────────────────────

interface ChartProps {
  size: { w: number; h: number };
  margin?: Margin;
  x: AxisSpec;
  y: AxisSpec;
  y2?: AxisSpec;
  series: SeriesSpec[];
  probe?: Probe;
  /** the plot itself, drawn in ABSOLUTE svg pixels — the scales already include the
   *  margins, so a caller never has to reason about a group transform */
  children?: React.ReactNode;
  /** drawn after `children`, for markers that must stay on top of the series */
  overlay?: React.ReactNode;
  /** which axis the crosshair and the readout follow. Depth charts read down, so
   *  their independent variable is y. */
  orient?: 'x' | 'y';
}

function ticksOf(a: AxisSpec): number[] {
  if (a.tickValues) return a.tickValues;
  const n = a.ticks ?? 6;
  return a.log ? (a.scale as ReturnType<typeof scaleLog>).ticks(n) : a.scale.ticks(n);
}

export function Chart({ size, margin = M, x, y, y2, series, probe, children, overlay, orient = 'x' }: ChartProps) {
  const { w, h } = size;
  const L = margin.left, R = w - margin.right, T = margin.top, B = h - margin.bottom;
  const [hover, setHover] = useState<{ px: number; py: number; v: number } | null>(null);

  const onMove = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    const box = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = e.clientX - box.left, py = e.clientY - box.top;
    const v = orient === 'x' ? x.scale.invert(px) : y.scale.invert(py);
    setHover({ px, py, v: v as number });
  }, [x.scale, y.scale, orient]);

  const readout = useMemo(() => {
    if (!hover || !probe) return null;
    return probe(hover.v).filter((v) => v.value != null && Number.isFinite(v.value));
  }, [hover, probe]);

  const xt = ticksOf(x), yt = ticksOf(y), y2t = y2 ? ticksOf(y2) : [];
  const fmtX = x.format ?? tickText, fmtY = y.format ?? tickText, fmtY2 = y2?.format ?? tickText;

  // keep the tooltip inside the plot rather than clipped at an edge
  const TT_W = 176;
  const ttH = 26 + (readout?.length ?? 0) * 15;
  const ttLeft = hover ? (hover.px + TT_W + 18 > R ? hover.px - TT_W - 14 : hover.px + 14) : 0;
  const ttTop = hover ? Math.min(Math.max(T, hover.py - 12), Math.max(T, B - ttH)) : 0;

  return (
    <svg width={w} height={h} className="frx-svg" role="img">
      <g className="frx-grid">
        {yt.map((v) => <line key={`gy${v}`} x1={L} x2={R} y1={y.scale(v)} y2={y.scale(v)} />)}
        {xt.map((v) => <line key={`gx${v}`} y1={T} y2={B} x1={x.scale(v)} x2={x.scale(v)} />)}
      </g>

      {children}
      {overlay}

      <g className="frx-axis">
        <line x1={L} x2={R} y1={B} y2={B} />
        <line x1={L} x2={L} y1={T} y2={B} />
        {xt.map((v) => (
          <g key={`x${v}`} transform={`translate(${x.scale(v)},${B})`}>
            <line y2={5} />
            <text y={17} textAnchor="middle">{fmtX(v)}</text>
          </g>
        ))}
        {yt.map((v) => (
          <g key={`y${v}`} transform={`translate(${L},${y.scale(v)})`}>
            <line x2={-5} />
            <text x={-9} dy="0.32em" textAnchor="end">{fmtY(v)}</text>
          </g>
        ))}
        {y2 && (
          <>
            <line x1={R} x2={R} y1={T} y2={B} stroke={y2.color} />
            {y2t.map((v) => (
              <g key={`y2${v}`} transform={`translate(${R},${y2.scale(v)})`}>
                <line x2={5} stroke={y2.color} />
                <text x={9} dy="0.32em" textAnchor="start" fill={y2.color}>{fmtY2(v)}</text>
              </g>
            ))}
          </>
        )}
      </g>

      {/* axis titles — always carry the unit */}
      <text className="frx-axis-title" x={(L + R) / 2} y={B + 35} textAnchor="middle">
        {x.label}{x.unit ? ` (${x.unit})` : ''}
      </text>
      <text className="frx-axis-title" transform={`translate(13,${(T + B) / 2}) rotate(-90)`} textAnchor="middle">
        {y.label}{y.unit ? ` (${y.unit})` : ''}
      </text>
      {y2 && (
        <text className="frx-axis-title" fill={y2.color}
          transform={`translate(${w - 6},${(T + B) / 2}) rotate(90)`} textAnchor="middle">
          {y2.label}{y2.unit ? ` (${y2.unit})` : ''}
        </text>
      )}

      {hover && (
        orient === 'x'
          ? <line className="frx-cross" x1={hover.px} x2={hover.px} y1={T} y2={B} />
          : <line className="frx-cross" y1={hover.py} y2={hover.py} x1={L} x2={R} />
      )}

      <rect x={L} y={T} width={Math.max(0, R - L)} height={Math.max(0, B - T)} fill="transparent"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ cursor: 'crosshair' }} />

      {hover && readout && readout.length > 0 && (
        <foreignObject x={ttLeft} y={ttTop} width={TT_W} height={ttH} style={{ pointerEvents: 'none' }}>
          <div className="frx-tip">
            {/* the header is the axis the crosshair follows, formatted by that axis */}
            <b>{`${((orient === 'x' ? x : y).format ?? readText)(hover.v)}${(orient === 'x' ? x : y).unit ? ` ${(orient === 'x' ? x : y).unit}` : ''}`}</b>
            {readout.map((r) => {
              const s = series.find((q) => q.key === r.key);
              return (
                <i key={r.key}>
                  <em style={{ background: s?.color }} />
                  <span>{s?.label ?? r.key}</span>
                  <u>{readText(r.value as number)}{s?.unit ? ` ${s.unit}` : ''}</u>
                </i>
              );
            })}
          </div>
        </foreignObject>
      )}
    </svg>
  );
}

/** The legend every chart carries, so a colour never has to be guessed. */
export function Legend({ series, extra }: { series: SeriesSpec[]; extra?: React.ReactNode }) {
  return (
    <div className="frx-legend">
      {series.map((s) => (
        <span key={s.key}>
          <i style={s.dash
            ? { background: 'none', borderTop: `2px dashed ${s.color}`, height: 0 }
            : { background: s.color }} />
          {s.label}{s.unit ? <em> ({s.unit})</em> : null}
        </span>
      ))}
      {extra}
    </div>
  );
}
