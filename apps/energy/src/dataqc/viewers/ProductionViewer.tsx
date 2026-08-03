// viewers/ProductionViewer.tsx — monthly production AND injection, interactive.
//
// Values are shown as average DAILY RATE for the calendar month (Sm³/day →
// bopd/bwpd/Mscf-d), the app's established field-unit default (see
// units.ts's oilRate/liquidRate/gasRate — this reuses them rather than
// inventing a parallel convention), not raw monthly cumulative volume.
//
// Stack order bottom→top: oil, gas, water — injection mirrors below the zero
// line. Colors are fixed industry conventions: gas red, oil green, water blue,
// injection a lighter blue (same fluid, injected not produced).
//
// Oil, gas and water don't share a physical unit (Sm³ liquid vs Sm³ gas), so
// stacking them directly would silently misrepresent the mix. The bar heights
// use the standard oilfield "oil-equivalent" convention instead — gas divided
// by 1000 (1000 Sm³ gas ≈ 1 Sm³ o.e., the Sodir/NPD convention) — so the stack
// is genuinely one unit, not an arbitrary visual fudge. The exact native-unit
// rate per commodity is always one hover away in the tooltip, and the totals
// strip below the chart states real converted cumulative totals per fluid.
//
// D3 is used for what it's good at — scale math, axis generation, zoom/pan
// behavior — while React owns the actual DOM (bars, tooltip) as plain JSX.
// This is the opposite pattern from the wellog library this codebase already
// rejected (see LogViewer.tsx comment): here D3 never touches component state
// or reconciles nodes itself, so there's no lifecycle fight with React.
import { useEffect, useMemo, useRef, useState } from 'react';
import { select } from 'd3-selection';
import { scaleLinear, scaleUtc } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { stack as d3stack } from 'd3-shape';
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import { format as d3format } from 'd3-format';
import { useUnits, oilVol, gasVol, waterVol, oilRate, liquidRate, gasRate, SM3_TO_BBL, type UnitSystem } from '../../units';

export interface ProdMonth { ym: string; oil: number; gas: number; water: number; wi: number }
export interface ProdPayload { well: string; units?: string; monthly: ProdMonth[] }

const WATER_COLOR = '#62aef7';
const OIL_COLOR = '#16805a';
const GAS_COLOR = '#e24b4a';
const INJECTION_COLOR = '#a9d4fb';

// array order IS the stack order, bottom→top
const SERIES = [
  { key: 'oil' as const, label: 'Oil', color: OIL_COLOR },
  { key: 'gas' as const, label: 'Gas', color: GAS_COLOR },
  { key: 'water' as const, label: 'Water', color: WATER_COLOR },
];
const INJ = { key: 'wi' as const, label: 'Injection', color: INJECTION_COLOR };

const OE_GAS_DIVISOR = 1000; // 1000 Sm³ gas ≈ 1 Sm³ oil-equivalent (Sodir/NPD convention)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parseYm = (ym: string): Date | null => {
  const y = Number(ym?.slice(0, 4)), mo = Number(ym?.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(mo)) return null;
  return new Date(Date.UTC(y, mo - 1, 1));
};
const nextMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
const fmtMonth = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const daysInMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();

/** oe-Sm³/day rate → display units (bbl/d for field, Sm³/d for metric) — same
 *  conversion family as oil, since "oil-equivalent" is defined in terms of it. */
const oeDisplay = (sm3oePerDay: number, sys: UnitSystem) => (sys === 'field' ? sm3oePerDay * SM3_TO_BBL : sm3oePerDay);
const oeUnitLabel = (sys: UnitSystem) => (sys === 'field' ? 'boepd' : 'Sm³/d, o.e.');

const fmtY = d3format('~s');

export function ProductionViewer({ prod }: { prod: ProdPayload }) {
  const { system } = useUnits();
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gxRef = useRef<SVGGElement>(null);
  const gyRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [size, setSize] = useState({ w: 900, h: 460 });
  const [on, setOn] = useState<Record<string, boolean>>({ gas: true, oil: true, water: true, wi: true });
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const m = prod.monthly ?? [];

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const totals = useMemo(() => ({
    oil: m.reduce((n, x) => n + (+x.oil || 0), 0),
    gas: m.reduce((n, x) => n + (+x.gas || 0), 0),
    water: m.reduce((n, x) => n + (+x.water || 0), 0),
    wi: m.reduce((n, x) => n + (+x.wi || 0), 0),
  }), [m]);

  const dates = useMemo(() => m.map((x) => parseYm(x.ym)), [m]);

  const margin = { l: 56, r: 14, t: 14, b: 30 };
  const plotW = Math.max(40, size.w - margin.l - margin.r);
  const plotH = Math.max(40, size.h - margin.t - margin.b);

  // base X scale over the full history; d3-zoom rescales it for pan/zoom
  const x0 = useMemo(() => {
    const valid = dates.filter((d): d is Date => !!d);
    const domain = valid.length ? [valid[0], nextMonth(valid[valid.length - 1])] : [new Date(), new Date()];
    return scaleUtc().domain(domain).range([margin.l, margin.l + plotW]);
  }, [dates, plotW, margin.l]);

  const xz = useMemo(() => transform.rescaleX(x0), [transform, x0]);

  // average daily rate for the calendar month, in Sm³/day — the basis for
  // every bar height and axis value below (never raw monthly volume)
  const daily = useMemo(() => m.map((x, i) => {
    const days = dates[i] ? daysInMonth(dates[i]!) : 30;
    return { oil: (+x.oil || 0) / days, gas: (+x.gas || 0) / days, water: (+x.water || 0) / days, wi: (+x.wi || 0) / days };
  }), [m, dates]);

  // oe-normalised stack data, respecting series on/off toggles
  const stackData = useMemo(() => daily.map((d) => ({
    oil: on.oil ? oeDisplay(d.oil, system) : 0,
    gas: on.gas ? oeDisplay(d.gas / OE_GAS_DIVISOR, system) : 0,
    water: on.water ? oeDisplay(d.water, system) : 0,
  })), [daily, on, system]);

  const stackKeys = SERIES.map((s) => s.key);
  const series = useMemo(() => d3stack<Record<string, number>>().keys(stackKeys)(stackData), [stackData, stackKeys]);

  const wiDisplay = useMemo(() => daily.map((d) => (on.wi ? oeDisplay(d.wi, system) : 0)), [daily, on, system]);
  const anyInj = on.wi && totals.wi > 0;

  const y = useMemo(() => {
    let maxUp = 0;
    for (const s of series) for (const [, v1] of s) maxUp = Math.max(maxUp, v1);
    const maxDn = anyInj ? Math.max(...wiDisplay, 0) : 0;
    const hUp = anyInj ? plotH * 0.62 : plotH;
    const zeroY = margin.t + hUp;
    return scaleLinear().domain([-1 * (maxDn || 1), maxUp || 1]).range([zeroY + (anyInj ? plotH - hUp : 0), zeroY - hUp])
      .clamp(true);
  }, [series, wiDisplay, anyInj, plotH, margin.t]);
  const zeroY = y(0);

  // attach the zoom behavior once per size change; it only ever touches X
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !plotW) return;
    const maxZoom = Math.max(1, Math.min(60, m.length / 4));
    const zb = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, maxZoom])
      .translateExtent([[margin.l, 0], [margin.l + plotW, 0]])
      .extent([[margin.l, 0], [margin.l + plotW, plotH]])
      .on('zoom', (event) => setTransform(event.transform));
    select(svg).call(zb);
    zoomRef.current = zb;
    return () => { select(svg).on('.zoom', null); };
  }, [plotW, plotH, margin.l, m.length]);

  // reset zoom when a different asset is opened
  useEffect(() => { setTransform(zoomIdentity); }, [prod.well]);

  useEffect(() => {
    if (gxRef.current) select(gxRef.current).call(axisBottom(xz).ticks(Math.max(2, plotW / 90)) as never);
  }, [xz, plotW]);
  useEffect(() => {
    if (gyRef.current) select(gyRef.current).call(axisLeft(y).ticks(6).tickFormat((v) => fmtY(v as number)) as never);
  }, [y]);

  const zoomBy = (k: number) => {
    const svg = svgRef.current, zb = zoomRef.current;
    if (!svg || !zb) return;
    select(svg).transition().duration(180).call(zb.scaleBy as never, k);
  };
  const resetZoom = () => {
    const svg = svgRef.current, zb = zoomRef.current;
    if (!svg || !zb) return;
    select(svg).transition().duration(180).call(zb.transform as never, zoomIdentity);
  };

  if (!m.length) return <div className="dqv-empty">No monthly records in this asset.</div>;

  const bars = m.map((x, i) => {
    const d = dates[i];
    if (!d) return null;
    const bx0 = xz(d), bx1 = xz(nextMonth(d));
    const bw = Math.max(0.5, bx1 - bx0 - 1);
    if (bx1 < margin.l || bx0 > margin.l + plotW) return null; // culled outside the visible window
    const segs = series.map((s, si) => {
      const [v0, v1] = s[i];
      if (v1 <= v0) return null;
      return <rect key={SERIES[si].key} x={bx0} y={y(v1)} width={bw} height={Math.max(0, y(v0) - y(v1))} fill={SERIES[si].color} />;
    });
    const wi = wiDisplay[i];
    const injRect = wi > 0 ? <rect x={bx0} y={zeroY} width={bw} height={Math.max(0, y(-wi) - zeroY)} fill={INJECTION_COLOR} /> : null;
    return <g key={x.ym}>{segs}{injRect}</g>;
  });

  const hoverMonth = hoverIdx != null ? m[hoverIdx] : null;
  const hoverDate = hoverIdx != null ? dates[hoverIdx] : null;
  const hoverDaily = hoverIdx != null ? daily[hoverIdx] : null;

  return (
    <div className="dqv-prod">
      <div className="dqv-bar">
        {SERIES.map((s) => (
          <button
            key={s.key}
            className={'dqv-chip' + (on[s.key] ? ' on' : '')}
            style={on[s.key] ? { borderColor: s.color, color: s.color } : undefined}
            onClick={() => setOn((o) => ({ ...o, [s.key]: !o[s.key] }))}
          >
            {s.label}
          </button>
        ))}
        <button
          className={'dqv-chip' + (on.wi ? ' on' : '')}
          style={on.wi ? { borderColor: INJ.color, color: INJ.color } : undefined}
          onClick={() => setOn((o) => ({ ...o, wi: !o.wi }))}
        >
          {INJ.label}
        </button>
        <span className="dqv-meta">
          {m.length} months · {m[0]?.ym} → {m[m.length - 1]?.ym}
        </span>
      </div>

      <div className="dqv-zoom-bar">
        <button title="Zoom in" onClick={() => zoomBy(1.5)}>+</button>
        <button title="Zoom out" onClick={() => zoomBy(1 / 1.5)}>−</button>
        <button title="Reset zoom" disabled={transform.k === 1} onClick={resetZoom}>Reset</button>
        <span className="dqv-zoom-range">scroll to zoom · drag to pan</span>
      </div>

      <div className="dqv-totals">
        <span>Oil <b>{oilVol(totals.oil, system).text}</b></span>
        <span>Gas <b>{gasVol(totals.gas, system).text}</b></span>
        <span>Water <b>{waterVol(totals.water, system).text}</b></span>
        <span>Injected <b>{waterVol(totals.wi, system).text}</b></span>
      </div>

      <div className="dqv-canvas-wrap" ref={wrapRef}>
        <svg ref={svgRef} width={size.w} height={size.h} className="dqv-prod-svg">
          <defs>
            <clipPath id="dqv-prod-clip">
              <rect x={margin.l} y={margin.t} width={plotW} height={plotH} />
            </clipPath>
          </defs>
          <line className="dqv-axis-zero" x1={margin.l} x2={margin.l + plotW} y1={zeroY} y2={zeroY} />
          <g clipPath="url(#dqv-prod-clip)">{bars}</g>
          <g ref={gxRef} className="dqv-axis dqv-axis-x" transform={`translate(0,${margin.t + plotH})`} />
          <g ref={gyRef} className="dqv-axis dqv-axis-y" transform={`translate(${margin.l},0)`} />
          <text className="dqv-axis-label" x={margin.l + plotW / 2} y={size.h - 4} textAnchor="middle">Time</text>
          <text
            className="dqv-axis-label"
            transform={`translate(14,${margin.t + plotH / 2}) rotate(-90)`}
            textAnchor="middle"
          >
            Daily rate, oil-equivalent ({oeUnitLabel(system)})
          </text>
          {hoverIdx != null && (
            <line className="dqv-hover-line" x1={hoverX} x2={hoverX} y1={margin.t} y2={margin.t + plotH} />
          )}
          <rect
            x={margin.l} y={margin.t} width={plotW} height={plotH} fill="transparent"
            onMouseMove={(e) => {
              const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
              const mx = e.clientX - r.left;
              const d = xz.invert(mx);
              let idx = -1, best = Infinity;
              dates.forEach((dt, i) => { if (!dt) return; const diff = Math.abs(dt.getTime() - d.getTime()); if (diff < best) { best = diff; idx = i; } });
              if (idx >= 0) { setHoverIdx(idx); setHoverX(xz(dates[idx]!) + Math.max(0.5, xz(nextMonth(dates[idx]!)) - xz(dates[idx]!)) / 2); }
            }}
            onMouseLeave={() => setHoverIdx(null)}
          />
        </svg>
        {hoverMonth && hoverDate && hoverDaily && (
          <div className="dqv-prod-tip" style={{ left: Math.min(hoverX + 10, size.w - 170), top: 10 }}>
            <b>{fmtMonth(hoverDate)}</b>
            {on.oil && <span><i style={{ background: OIL_COLOR }} />Oil {oilRate(hoverDaily.oil, system).text}</span>}
            {on.gas && <span><i style={{ background: GAS_COLOR }} />Gas {gasRate(hoverDaily.gas, system).text}</span>}
            {on.water && <span><i style={{ background: WATER_COLOR }} />Water {liquidRate(hoverDaily.water, system).text}</span>}
            {on.wi && hoverDaily.wi > 0 && <span><i style={{ background: INJECTION_COLOR }} />Injection {liquidRate(hoverDaily.wi, system).text}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
