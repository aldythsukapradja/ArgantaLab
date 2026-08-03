// BasinCharts.tsx — the two charts that carry the Basin Dossier.
//
//  * EventsChartView   — petroleum system events chart (Magoon & Dow convention):
//                        elements and processes against geologic time, so you can see
//                        whether the trap existed before the charge arrived.
//  * CreamingCurveView — cumulative major discoveries through time, scrubbable. This
//                        doubles as the time control for the map.
//
// Both render from real derived data (basin-insight.ts) and both have an explicit
// empty state — for most basins the honest answer is "nobody has modelled this".
import { useMemo, useRef } from 'react';
import type { CreamingPoint, EventsChart, EventRow, SizedField } from './basin-insight';

const OIL = '#22c55e';
const GAS = '#f43f5e';
const CAP = '#f59e0b';
const OTHER = '#475569';

const KIND_VAR: Record<string, string> = {
  source: 'var(--rose, #f43f5e)',
  reservoir: 'var(--amber, #f59e0b)',
  seal: 'var(--violet, #a78bfa)',
  overburden: 'var(--sky, #38bdf8)',
  process: 'var(--ink3)',
};

/** Nice round tick marks across a Ma axis, oldest → 0. */
function ticks(oldest: number): number[] {
  const step = oldest > 400 ? 100 : oldest > 200 ? 50 : oldest > 80 ? 25 : 10;
  const out: number[] = [];
  for (let v = Math.ceil(oldest / step) * step; v >= 0; v -= step) out.push(v);
  return out;
}

export function EventsChartView({ chart, onOpenGaps }: { chart: EventsChart | null; onOpenGaps?: () => void }) {
  if (!chart || !chart.rows.some((r) => r.bars.length)) {
    return (
      <div className="exs-empty-state">
        <b>No petroleum-system model</b>
        <p>
          This basin has no stratigraphic column in the catalogue, so no elements can be placed in time.
          Source rock, seal and charge timing are unrecorded — the screening question this chart exists
          to answer cannot be answered here yet.
        </p>
        {onOpenGaps && <button className="exs-linkbtn" onClick={onOpenGaps}>What would fill this ↗</button>}
      </div>
    );
  }

  const [oldest] = chart.span;
  const tk = ticks(oldest);
  const x = (ma: number) => 100 - (ma / oldest) * 100; // oldest on the left, 0 Ma right

  return (
    <div className="exs-events">
      <div className="exs-events-axis">
        {tk.map((t) => <span key={t} style={{ left: `${x(t)}%` }}>{t}</span>)}
        <em>Ma</em>
      </div>
      <div className="exs-events-rows">
        {chart.rows.map((row: EventRow) => (
          <div className={'exs-event-row' + (row.modelled ? '' : ' gap')} key={row.key}>
            <span className="exs-event-label">{row.label}</span>
            <div className="exs-event-track">
              {tk.map((t) => <i className="exs-event-grid" key={t} style={{ left: `${x(t)}%` }} />)}
              {row.modelled ? row.bars.map((b, i) => {
                const left = x(b.from);
                const width = Math.max(1.2, x(b.to) - x(b.from));
                return (
                  <span
                    key={row.key + i}
                    className="exs-event-bar"
                    style={{ left: `${left}%`, width: `${width}%`, background: KIND_VAR[row.kind] }}
                    title={`${b.label} · ${b.from}–${b.to} Ma${b.note ? ` · ${b.note}` : ''}`}
                  >
                    <b>{b.label}</b>
                  </span>
                );
              }) : (
                <span className="exs-event-missing">not modelled — needs {row.requires}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="exs-events-foot">
        <span><i style={{ background: KIND_VAR.source }} />source</span>
        <span><i style={{ background: KIND_VAR.reservoir }} />reservoir</span>
        <span><i style={{ background: KIND_VAR.seal }} />seal</span>
        <span><i style={{ background: KIND_VAR.overburden }} />overburden</span>
        {chart.gapRows > 0 && onOpenGaps && (
          <button className="exs-linkbtn" onClick={onOpenGaps}>{chart.gapRows} process rows unmodelled ↗</button>
        )}
      </div>
    </div>
  );
}

export function CreamingCurveView({
  creaming, scrubYear, onScrub, height = 60,
}: {
  creaming: CreamingPoint[];
  scrubYear: number | null;
  onScrub: (year: number | null) => void;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const model = useMemo(() => {
    if (creaming.length < 2) return null;
    const x0 = creaming[0].year;
    const x1 = creaming[creaming.length - 1].year;
    const yMax = creaming[creaming.length - 1].cumulative;
    const px = (y: number) => ((y - x0) / Math.max(1, x1 - x0)) * 100;
    const py = (c: number) => 100 - (c / Math.max(1, yMax)) * 100;
    const pts = creaming.map((p) => `${px(p.year).toFixed(2)},${py(p.cumulative).toFixed(2)}`);
    return { x0, x1, yMax, px, py, line: pts.join(' '), area: `0,100 ${pts.join(' ')} 100,100` };
  }, [creaming]);

  if (!model) {
    return <div className="exs-empty-inline">Too few dated discoveries to plot a curve.</div>;
  }

  const yearAt = (clientX: number) => {
    const el = ref.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return Math.round(model.x0 + frac * (model.x1 - model.x0));
  };

  const cumAt = scrubYear == null ? model.yMax
    : (creaming.filter((p) => p.year <= scrubYear).pop()?.cumulative ?? 0);

  return (
    <div className="exs-creaming">
      <div
        ref={ref}
        className="exs-creaming-plot"
        style={{ height }}
        onMouseMove={(e) => onScrub(yearAt(e.clientX))}
        onMouseLeave={() => onScrub(null)}
        onClick={(e) => onScrub(yearAt(e.clientX))}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points={model.area} className="exs-creaming-area" />
          <polyline points={model.line} className="exs-creaming-line" vectorEffect="non-scaling-stroke" />
          {scrubYear != null && (
            <line x1={model.px(scrubYear)} x2={model.px(scrubYear)} y1="0" y2="100"
              className="exs-creaming-scrub" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
      </div>
      <div className="exs-creaming-axis">
        <span>{model.x0}</span>
        <b>{scrubYear != null ? `${scrubYear} · ${cumAt} of ${model.yMax} major fields found` : `${model.yMax} major fields · drag to replay`}</b>
        <span>{model.x1}</span>
      </div>
    </div>
  );
}

const fmtBoe = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}B` : v >= 1 ? v.toFixed(1) : v.toFixed(2));

/** Ranked, stacked (oil / gas / condensate+NGL) bar chart of the biggest fields by
 *  reported reserves. `compact` drops axis labels for use as the main-screen preview. */
export function BoeBarChart({ ranked, limit = 8, compact }: { ranked: SizedField[]; limit?: number; compact?: boolean }) {
  const top = ranked.slice(0, limit);
  if (!top.length) {
    return (
      <div className="exs-empty-state">
        <b>No sized fields</b>
        <p>None of the major fields in scope have a reported reserve figure in the catalogue.</p>
      </div>
    );
  }
  const max = top[0].total;
  return (
    <div className={'exs-boe-bars' + (compact ? ' compact' : '')}>
      {top.map((f) => (
        <div className="exs-boe-row" key={f.id} title={`${f.name} · ${f.total.toFixed(2)} MMBOE (oil ${f.oil.toFixed(2)} · gas ${f.gas.toFixed(2)} · NGL/cond ${f.cap.toFixed(2)})`}>
          {!compact && <span className="exs-boe-name">{f.name}</span>}
          <div className="exs-boe-track">
            <i style={{ width: `${(f.oil / max) * 100}%`, background: OIL }} />
            <i style={{ width: `${(f.gas / max) * 100}%`, background: GAS }} />
            <i style={{ width: `${(f.cap / max) * 100}%`, background: CAP }} />
          </div>
          {!compact && <b>{fmtBoe(f.total)}</b>}
        </div>
      ))}
      {!compact && (
        <div className="exs-boe-legend">
          <span><i style={{ background: OIL }} />oil</span>
          <span><i style={{ background: GAS }} />gas</span>
          <span><i style={{ background: CAP }} />NGL / condensate</span>
          <em>MMBOE, reported reserves</em>
        </div>
      )}
    </div>
  );
}

/** Donut showing which fields dominate the scope's total sized reserves. */
export function BoePieChart({ ranked, totalBoe, limit = 6 }: { ranked: SizedField[]; totalBoe: number; limit?: number }) {
  const top = ranked.slice(0, limit);
  const restTotal = Math.max(0, totalBoe - top.reduce((s, f) => s + f.total, 0));
  const palette = ['#22d3ee', '#22c55e', '#f59e0b', '#a78bfa', '#f43f5e', '#38bdf8'];
  const slices = [...top.map((f, i) => ({ label: f.name, value: f.total, color: palette[i % palette.length] })),
    ...(restTotal > 0 ? [{ label: 'All other fields', value: restTotal, color: OTHER }] : [])];

  if (!totalBoe) {
    return <div className="exs-empty-inline">No reserve data to chart.</div>;
  }

  let acc = 0;
  const R = 40, CX = 50, CY = 50;
  const arcs = slices.map((s) => {
    const a0 = (acc / totalBoe) * Math.PI * 2 - Math.PI / 2;
    acc += s.value;
    const a1 = (acc / totalBoe) * Math.PI * 2 - Math.PI / 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const x0 = CX + R * Math.cos(a0), y0 = CY + R * Math.sin(a0);
    const x1 = CX + R * Math.cos(a1), y1 = CY + R * Math.sin(a1);
    return { ...s, path: `M${CX},${CY} L${x0.toFixed(2)},${y0.toFixed(2)} A${R},${R} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`, pct: (s.value / totalBoe) * 100 };
  });

  return (
    <div className="exs-boe-pie">
      <svg viewBox="0 0 100 100">
        {arcs.map((a) => <path key={a.label} d={a.path} fill={a.color} stroke="var(--panel)" strokeWidth="0.6" />)}
        <circle cx={CX} cy={CY} r={22} fill="var(--panel)" />
      </svg>
      <div className="exs-boe-pie-key">
        {arcs.map((a) => (
          <span key={a.label}><i style={{ background: a.color }} />{a.label} <b>{a.pct.toFixed(0)}%</b></span>
        ))}
      </div>
    </div>
  );
}

/** Compact horizontal proportion bar — used for hydrocarbon type and status mix. */
export function MixBar({ data, palette }: { data: Array<{ key: string; n: number }>; palette: string[] }) {
  const total = data.reduce((s, d) => s + d.n, 0);
  if (!total) return <div className="exs-empty-inline">Not recorded.</div>;
  return (
    <div className="exs-mix">
      <div className="exs-mix-bar">
        {data.map((d, i) => (
          <i key={d.key} style={{ width: `${(d.n / total) * 100}%`, background: palette[i % palette.length] }}
            title={`${d.key} · ${d.n}`} />
        ))}
      </div>
      <div className="exs-mix-keys">
        {data.slice(0, 4).map((d, i) => (
          <span key={d.key}><i style={{ background: palette[i % palette.length] }} />{d.key} <b>{d.n}</b></span>
        ))}
      </div>
    </div>
  );
}
