// TimeChart — the one time-series chart the Simulation surface draws with.
//
// d3 for the scales, ticks and path generation; React owns the DOM. That split matters:
// d3's own selection API and React's reconciler both want to be the thing that mutates
// the tree, and letting them share it is how you get charts that render correctly once
// and then go stale on the second update.
//
// ── WHAT MAKES IT READABLE, NOT JUST DRAWN ──────────────────────────────────
//
//  · RESPONSIVE by measurement, not by viewBox scaling. A viewBox stretch scales the
//    TEXT too, so a chart in a narrow pane gets fat axis labels and a wide one gets
//    unreadable ones. Measuring the element keeps type at one size everywhere.
//  · A SHARED CURSOR across every series, with the value of each at that instant. On a
//    rate chart the question is almost never "what is this one curve here" — it is
//    "what were oil, water and injection doing at the same moment".
//  · FORECAST IS DRAWN DIFFERENTLY from history. A curve that runs continuously from
//    measurement into prediction invites the reader to trust the right-hand end as much
//    as the left, which is the whole problem with forecasts.
//  · OBSERVED DATA IS POINTS, never a line. Joining measurements implies you know what
//    happened between them.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { line as d3line, area as d3area, curveMonotoneX } from 'd3-shape';
import { format } from 'd3-format';
import { useThemeInk } from './theme-ink';

export interface Series {
  key: string;
  label: string;
  color: string;
  points: Array<{ x: number; y: number }>;
  /** dashed and labelled as prediction rather than measurement */
  forecast?: boolean;
  /** drawn as discrete markers — a measurement is not a curve */
  observed?: boolean;
  /** filled to the baseline; use for one series at most or the chart becomes mud */
  fill?: boolean;
  /** right-hand axis, for a quantity in different units (water cut against rate) */
  axis?: 'left' | 'right';
}

export interface TimeChartProps {
  series: Series[];
  xLabel: string;
  yLabel: string;
  yRightLabel?: string;
  /** where history stops and prediction starts — drawn as a labelled rule */
  historyEnd?: number | null;
  /** force the left axis to include zero; a rate chart that does not is misleading */
  zeroBased?: boolean;
  height?: number;
  /** number formatting for the readout */
  precision?: number;
}

const fmtTick = format('~s');

export function TimeChart({
  series, xLabel, yLabel, yRightLabel, historyEnd, zeroBased = true, height = 300, precision = 1,
}: TimeChartProps) {
  const ink = useThemeInk();
  const wrap = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(720);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState<number | null>(null);

  useEffect(() => {
    const obs = new ResizeObserver((es) => {
      for (const e of es) setW(Math.max(240, e.contentRect.width));
    });
    if (wrap.current) obs.observe(wrap.current);
    return () => obs.disconnect();
  }, []);

  const shown = useMemo(() => series.filter((s) => !hidden.has(s.key) && s.points.length), [series, hidden]);
  const hasRight = shown.some((s) => s.axis === 'right');

  const pad = { l: 58, r: hasRight ? 52 : 14, t: 12, b: 34 };
  const iw = Math.max(10, w - pad.l - pad.r);
  const ih = Math.max(10, height - pad.t - pad.b);

  const { x, yl, yr } = useMemo(() => {
    let x0 = Infinity, x1 = -Infinity;
    let l0 = Infinity, l1 = -Infinity, r0 = Infinity, r1 = -Infinity;
    for (const s of shown) for (const p of s.points) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
      if (s.axis === 'right') { if (p.y < r0) r0 = p.y; if (p.y > r1) r1 = p.y; }
      else { if (p.y < l0) l0 = p.y; if (p.y > l1) l1 = p.y; }
    }
    if (!Number.isFinite(x0)) { x0 = 0; x1 = 1; }
    if (!Number.isFinite(l0)) { l0 = 0; l1 = 1; }
    if (zeroBased) { l0 = Math.min(0, l0); }
    if (l1 <= l0) l1 = l0 + 1;
    const xs = scaleLinear().domain([x0, x1 === x0 ? x0 + 1 : x1]).range([pad.l, pad.l + iw]);
    // 6% headroom so a peak does not touch the frame and read as clipped
    const yls = scaleLinear().domain([l0, l1 + (l1 - l0) * 0.06]).range([pad.t + ih, pad.t]).nice();
    const yrs = Number.isFinite(r0)
      ? scaleLinear().domain([Math.min(0, r0), r1 <= r0 ? r0 + 1 : r1]).range([pad.t + ih, pad.t]).nice()
      : null;
    return { x: xs, yl: yls, yr: yrs };
  }, [shown, iw, ih, pad.l, pad.t, zeroBased]);

  const yOf = useCallback((s: Series) => (s.axis === 'right' && yr ? yr : yl), [yl, yr]);

  const onMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    if (px < pad.l || px > pad.l + iw) { setCursor(null); return; }
    setCursor(x.invert(px));
  }, [x, pad.l, iw]);

  // the value of every visible series at the cursor — nearest sample, because a time
  // series is irregularly spaced and interpolating invents a reading
  const readout = useMemo(() => {
    if (cursor == null) return null;
    return shown.map((s) => {
      let best = null as { x: number; y: number } | null, bd = Infinity;
      for (const p of s.points) {
        const d = Math.abs(p.x - cursor);
        if (d < bd) { bd = d; best = p; }
      }
      return { s, p: best };
    }).filter((r) => r.p);
  }, [cursor, shown]);

  const mkLine = d3line<{ x: number; y: number }>().defined((p) => Number.isFinite(p.y)).curve(curveMonotoneX);
  const fmtV = (v: number) => (Math.abs(v) >= 1000 ? fmtTick(v) : v.toFixed(precision));

  return (
    <div className="tc" ref={wrap}>
      <svg width={w} height={height} onMouseMove={onMove} onMouseLeave={() => setCursor(null)}>
        {/* horizontal rules only — vertical ones on a time axis add clutter without
            answering a question anyone asks of a production chart */}
        {yl.ticks(5).map((t) => (
          <g key={`gy${t}`}>
            <line x1={pad.l} x2={pad.l + iw} y1={yl(t)} y2={yl(t)} stroke={ink.grid} />
            <text x={pad.l - 7} y={yl(t) + 3.5} textAnchor="end" fontSize={9.5}
              fill={ink.axis} fontFamily="ui-monospace, monospace">{fmtTick(t)}</text>
          </g>
        ))}
        {x.ticks(Math.max(3, Math.floor(iw / 90))).map((t) => (
          <text key={`gx${t}`} x={x(t)} y={pad.t + ih + 16} textAnchor="middle" fontSize={9.5}
            fill={ink.axis} fontFamily="ui-monospace, monospace">{fmtTick(t)}</text>
        ))}
        {yr && yr.ticks(5).map((t) => (
          <text key={`ry${t}`} x={pad.l + iw + 7} y={yr(t) + 3.5} textAnchor="start" fontSize={9.5}
            fill={ink.axis} fontFamily="ui-monospace, monospace">{fmtTick(t)}</text>
        ))}

        <line x1={pad.l} x2={pad.l + iw} y1={pad.t + ih} y2={pad.t + ih} stroke={ink.frame} />
        <line x1={pad.l} x2={pad.l} y1={pad.t} y2={pad.t + ih} stroke={ink.frame} />

        {/* THE HISTORY / FORECAST BOUNDARY, named. Without it a reader has no way to
            know which half of the chart is a measurement. */}
        {historyEnd != null && Number.isFinite(historyEnd) && (
          <g>
            <line x1={x(historyEnd)} x2={x(historyEnd)} y1={pad.t} y2={pad.t + ih}
              stroke="#fbbf24" strokeDasharray="4 3" />
            <text x={x(historyEnd) + 4} y={pad.t + 10} fontSize={9} fill="#fbbf24"
              fontFamily="ui-monospace, monospace">forecast →</text>
          </g>
        )}

        {shown.map((s) => {
          const yy = yOf(s);
          if (s.observed) {
            // MEASUREMENTS ARE POINTS. Joining them claims knowledge of the gaps.
            return (
              <g key={s.key}>
                {s.points.filter((p) => Number.isFinite(p.y)).map((p, i) => (
                  <circle key={i} cx={x(p.x)} cy={yy(p.y)} r={2.2} fill="none" stroke={s.color} strokeWidth={1.2} />
                ))}
              </g>
            );
          }
          const path = mkLine.x((p) => x(p.x)).y((p) => yy(p.y))(s.points) ?? '';
          const fillPath = s.fill
            ? d3area<{ x: number; y: number }>()
              .defined((p) => Number.isFinite(p.y))
              .curve(curveMonotoneX)
              .x((p) => x(p.x)).y0(yy(yy.domain()[0])).y1((p) => yy(p.y))(s.points) ?? ''
            : null;
          return (
            <g key={s.key}>
              {fillPath && <path d={fillPath} fill={s.color} opacity={0.14} />}
              <path d={path} fill="none" stroke={s.color} strokeWidth={1.8}
                strokeDasharray={s.forecast ? '5 4' : undefined} />
            </g>
          );
        })}

        {cursor != null && (
          <line x1={x(cursor)} x2={x(cursor)} y1={pad.t} y2={pad.t + ih}
            stroke={ink.cross} strokeDasharray="3 3" />
        )}
        {readout?.map(({ s, p }) => (
          <circle key={`c${s.key}`} cx={x(p!.x)} cy={yOf(s)(p!.y)} r={3.4}
            fill={s.color} stroke={ink.tipBg} strokeWidth={1.5} />
        ))}

        <text x={pad.l + iw / 2} y={height - 2} textAnchor="middle" fontSize={9.5} fill={ink.axis}>{xLabel}</text>
        <text transform={`translate(11 ${pad.t + ih / 2}) rotate(-90)`} textAnchor="middle"
          fontSize={9.5} fill={ink.axis}>{yLabel}</text>
        {yRightLabel && (
          <text transform={`translate(${w - 4} ${pad.t + ih / 2}) rotate(-90)`} textAnchor="middle"
            fontSize={9.5} fill={ink.axis}>{yRightLabel}</text>
        )}
      </svg>

      {/* the legend is also the FILTER — clicking a series hides it, which is the
          only practical way to read one curve out of six on a shared axis */}
      <div className="tc-legend">
        {series.map((s) => (
          <button key={s.key} className={`tc-leg${hidden.has(s.key) ? ' off' : ''}`}
            onClick={() => setHidden((h) => {
              const n = new Set(h); n.has(s.key) ? n.delete(s.key) : n.add(s.key); return n;
            })}
            title={hidden.has(s.key) ? 'Show' : 'Hide'}>
            <i style={{ background: s.color, borderStyle: s.forecast ? 'dashed' : 'solid' }} />
            {s.label}
            {s.observed && <em>observed</em>}
            {s.forecast && <em>forecast</em>}
          </button>
        ))}
      </div>

      {readout && readout.length > 0 && (
        <div className="tc-read">
          <b>{xLabel.split('(')[0].trim()} {cursor!.toFixed(0)}</b>
          {readout.map(({ s, p }) => (
            <span key={s.key}><i style={{ background: s.color }} />{s.label} {fmtV(p!.y)}</span>
          ))}
        </div>
      )}
    </div>
  );
}
