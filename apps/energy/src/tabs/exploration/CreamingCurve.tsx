// CreamingCurve.tsx — the basin's discovery record, plotted on VOLUME.
//
// It used to plot cumulative discovery COUNT, which is the wrong axis for the question
// the chart exists to answer. A decade of small finds moves the count steeply while
// barely moving the resource; a single giant does the opposite. The classic creaming
// curve is volume-based for exactly that reason — its flattening is what "creamed"
// means, and a count curve can look flat in a basin that just found a giant.
//
// Volume is reported reserves per field (oil + condensate + NGL, gas at 164.3 m³/boe),
// summed to one MMBOE figure — the reserve towers, joined on OSDU field id.
//
// A field with a discovery year but NO reported reserves still counts as a discovery
// and contributes nothing to the volume line. Absent is not zero; we will not invent a
// size. The footer says how many fields that applies to, because a curve built on half
// the finds should say so.
import { useMemo, useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { area as d3area, line as d3line, curveMonotoneX } from 'd3-shape';
import { format } from 'd3-format';
import type { CreamingPoint } from './basin-insight';

const fmtBoe = (v: number) => (v >= 1000 ? `${format('.2~s')(v)}` : format(',.0f')(v));

export function CreamingCurve({
  creaming, scrubYear, onScrub, height = 210, sized, total,
}: {
  creaming: CreamingPoint[];
  scrubYear: number | null;
  onScrub?: (year: number | null) => void;
  height?: number;
  /** How many fields carried a reported volume, and how many discoveries there were. */
  sized?: number;
  total?: number;
}) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<CreamingPoint | null>(null);
  const W = 720, H = height;
  const M = { t: 14, r: 16, b: 26, l: 52 };

  const model = useMemo(() => {
    if (creaming.length < 2) return null;
    const yrs = creaming.map((c) => c.year);
    const x = scaleLinear().domain([Math.min(...yrs), Math.max(...yrs)]).range([M.l, W - M.r]);
    const maxB = creaming[creaming.length - 1].cumBoe;
    // If nothing carries a volume the chart has no honest y-axis; fall back to count
    // rather than drawing a flat zero line and implying an empty basin.
    const useBoe = maxB > 0;
    const val = (d: CreamingPoint) => (useBoe ? d.cumBoe : d.cumulative);
    const yMax = useBoe ? maxB : creaming[creaming.length - 1].cumulative;
    const y = scaleLinear().domain([0, yMax || 1]).nice().range([H - M.b, M.t]);
    const ln = d3line<CreamingPoint>().x((d) => x(d.year)).y((d) => y(val(d))).curve(curveMonotoneX);
    const ar = d3area<CreamingPoint>().x((d) => x(d.year)).y0(H - M.b).y1((d) => y(val(d))).curve(curveMonotoneX);
    // Year bars: what was found IN that year, so the steps are visible under the curve.
    const barMax = Math.max(...creaming.map((c) => (useBoe ? c.boe : c.count)), 1);
    const bh = scaleLinear().domain([0, barMax]).range([0, (H - M.b - M.t) * 0.42]);
    return {
      x, y, val, useBoe, yMax, d: ln(creaming) ?? '', a: ar(creaming) ?? '',
      bar: (d: CreamingPoint) => bh(useBoe ? d.boe : d.count),
      ticks: y.ticks(4), xticks: x.ticks(6),
    };
  }, [creaming, H, W, M.l, M.r, M.t, M.b]);

  if (!model) {
    return <div className="exs-empty-inline">Too few dated discoveries to plot a curve.</div>;
  }

  const pick = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return null;
    const yr = model.x.invert(((clientX - r.left) / r.width) * W);
    return creaming.reduce((a, b) => (Math.abs(b.year - yr) < Math.abs(a.year - yr) ? b : a));
  };
  const active = hover ?? (scrubYear != null
    ? creaming.reduce((a, b) => (Math.abs(b.year - scrubYear) < Math.abs(a.year - scrubYear) ? b : a))
    : null);

  const unit = model.useBoe ? 'MMBOE' : 'discoveries';

  return (
    <div className="exs-cream">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="exs-cream-svg"
        onMouseMove={(e) => setHover(pick(e.clientX))}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => { const p = pick(e.clientX); onScrub?.(p ? p.year : null); }}>
        <defs>
          <linearGradient id="creamFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity=".42" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* y grid + axis */}
        {model.ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={model.y(t)} y2={model.y(t)} className="exs-cream-grid" />
            <text x={M.l - 7} y={model.y(t) + 3} className="exs-cream-ylab">{fmtBoe(t)}</text>
          </g>
        ))}
        {model.xticks.map((t) => (
          <text key={t} x={model.x(t)} y={H - 8} className="exs-cream-xlab">{t}</text>
        ))}

        {/* per-year found volume — the steps that build the curve */}
        {creaming.map((d) => {
          const h = model.bar(d);
          return h > 0.5 ? (
            <rect key={d.year} className="exs-cream-bar"
              x={model.x(d.year) - 1.6} width="3.2"
              y={H - M.b - h} height={h} rx="1" />
          ) : null;
        })}

        <path d={model.a} fill="url(#creamFill)" />
        <path d={model.d} className="exs-cream-line" />

        {/* the biggest single find — the one worth naming */}
        {(() => {
          const big = creaming.reduce((a, b) =>
            ((b.biggest?.boe ?? 0) > (a.biggest?.boe ?? 0) ? b : a), creaming[0]);
          if (!big?.biggest) return null;
          return (
            <g className="exs-cream-star">
              <circle cx={model.x(big.year)} cy={model.y(model.val(big))} r="4" />
              <text x={model.x(big.year)} y={model.y(model.val(big)) - 9}>
                {big.biggest.name.split('(')[0].trim().slice(0, 22)}
              </text>
            </g>
          );
        })()}

        {active && (
          <g className="exs-cream-cursor">
            <line x1={model.x(active.year)} x2={model.x(active.year)} y1={M.t} y2={H - M.b} />
            <circle cx={model.x(active.year)} cy={model.y(model.val(active))} r="4.5" />
          </g>
        )}
      </svg>

      <div className="exs-cream-read">
        {active ? (
          <>
            <b>{active.year}</b>
            <span>{fmtBoe(model.val(active))} {unit} found to date</span>
            <span>
              {active.count} discover{active.count === 1 ? 'y' : 'ies'} that year
              {active.boe > 0 && ` · ${fmtBoe(active.boe)} MMBOE`}
            </span>
            {active.biggest && <em>largest: {active.biggest.name.split('(')[0].trim()}</em>}
          </>
        ) : (
          <>
            <b>{fmtBoe(model.yMax)} {unit}</b>
            <span>cumulative discovered, {creaming[0].year}–{creaming[creaming.length - 1].year}</span>
            {model.useBoe && sized != null && total != null && sized < total && (
              <em>{sized} of {total} discoveries carry a reported volume — the rest are counted, not sized</em>
            )}
          </>
        )}
      </div>
    </div>
  );
}
