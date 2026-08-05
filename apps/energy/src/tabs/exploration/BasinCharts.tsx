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
import { useCallback, useMemo, useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { arc, area as d3area, curveMonotoneX, line as d3line, pie, type PieArcDatum } from 'd3-shape';
import type { CreamingPoint, EventsChart, EventRow, SizedField } from './basin-insight';

/** What the two geology charts cross-filter each other on. Click sets it, click again
 *  clears it, double-click opens the detail popup instead. */
export type CrossFilter = { kind: 'formation' | 'cycle' | 'period'; key: string; label: string } | null;

/** Single click = cross-filter, double click = open. Browsers fire `click` before
 *  `dblclick`, so the single-click action is deferred just past the double-click
 *  threshold and cancelled if a second click lands. */
function useClickOrDouble(onSingle: () => void, onDouble: () => void, delay = 230) {
  const timer = useRef<number | null>(null);
  const click = useCallback(() => {
    if (timer.current != null) return;
    timer.current = window.setTimeout(() => { timer.current = null; onSingle(); }, delay);
  }, [onSingle, delay]);
  const dbl = useCallback(() => {
    if (timer.current != null) { window.clearTimeout(timer.current); timer.current = null; }
    onDouble();
  }, [onDouble]);
  return { onClick: click, onDoubleClick: dbl };
}

/** Does this bar/element fall inside the active cross-filter? */
function matchesFilter(f: CrossFilter, o: { unitName?: string; cycleId?: string; from?: number; to?: number }) {
  if (!f) return true;
  if (f.kind === 'formation') return o.unitName === f.key;
  if (f.kind === 'cycle') return !!o.cycleId && o.cycleId === f.key;
  if (f.kind === 'period') {
    const [pf, pt] = f.key.split('|').map(Number);
    return o.from != null && o.to != null && o.from > pt && o.to < pf; // time ranges overlap
  }
  return true;
}

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

/** Round tick marks across an arbitrary [older, younger] Ma window. Step adapts to the
 *  zoom so a 10 Ma slice doesn't render a single tick. */
function rangeTicks(from: number, to: number): number[] {
  const span = Math.max(0.5, from - to);
  const raw = span / 6;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(from / step) * step; v >= to - 1e-9; v -= step) {
    if (v <= from + 1e-9) out.push(Number(v.toFixed(3)));
  }
  return out;
}

/** One element bar: single click cross-filters, double click opens its detail. */
function EventBarCell({ bar, kind, left, width, filtered, onFilter, onOpen }: {
  bar: { label: string; from: number; to: number; note?: string; confidence?: string; citationId?: string; cycleId?: string; qcLithology?: boolean; derived?: boolean };
  kind: string; left: number; width: number; filtered: boolean;
  onFilter?: (unitName: string) => void; onOpen?: (unitName: string) => void;
}) {
  const handlers = useClickOrDouble(
    () => onFilter?.(bar.label),
    () => onOpen?.(bar.label),
  );
  const clickable = kind !== 'process' && (!!onFilter || !!onOpen);
  return (
    <span
      className={'exs-event-bar' + (clickable ? ' clickable' : '') + (filtered ? ' dimmed' : '') + (bar.qcLithology ? ' qc' : '') + (bar.derived ? ' derived' : '') + (bar.confidence === 'speculative' ? ' speculative' : '')}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      {...(clickable ? handlers : {})}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter') { e.preventDefault(); onOpen?.(bar.label); } } : undefined}
      style={{ left: `${left}%`, width: `${width}%`, background: KIND_VAR[kind] }}
      title={`${bar.label} · ${bar.from}–${bar.to} Ma${bar.confidence ? ` · ${bar.confidence} confidence` : ''}${bar.citationId ? ` · ${bar.citationId}` : ''}${bar.note ? ` · ${bar.note}` : ''}${bar.qcLithology ? ' — QC: a lithology, not a named unit; needs normalising at source' : ''}${bar.derived ? ' — DERIVED by rule, not evidence' : ''}${clickable ? ' — click to filter, double-click for detail' : ''}`}
    >
      <b>{bar.label}{bar.qcLithology && <em title="lithology, not a named unit"> ?</em>}</b>
    </span>
  );
}

export function EventsChartView({
  chart, onOpenGaps, onPickFormation, onCrossFilter, crossFilter, range, onRange,
}: {
  chart: EventsChart | null; onOpenGaps?: () => void; onPickFormation?: (unitName: string) => void;
  onCrossFilter?: (f: CrossFilter) => void; crossFilter?: CrossFilter;
  /** Shared [olderMa, youngerMa] window; null = full span. */
  range?: [number, number] | null;
  /** Wheel-zoom emits a new window so the tectonostratigraphy column follows. */
  onRange?: (r: [number, number] | null) => void;
}) {
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

  // The window: either the shared zoom range or the model's own full span. Oldest sits
  // on the LEFT, so x grows toward the present.
  const from = range ? range[0] : chart.span[0];
  const to = range ? range[1] : chart.span[1];
  const width = Math.max(0.5, from - to);
  const x = (ma: number) => ((from - ma) / width) * 100;
  const tk = rangeTicks(from, to);
  /** Anything wholly outside the window is skipped rather than drawn off-canvas. */
  const visible = (a: number, b: number) => Math.max(a, b) > to && Math.min(a, b) < from;

  // Wheel = zoom about the pointer, so you can drill into a period without leaving
  // the chart. Emits upward so the tectonostratigraphy column stays in lockstep.
  const onWheel = (e: React.WheelEvent) => {
    if (!onRange) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const at = from - frac * width;
    const next = Math.min(chart.span[0], Math.max(0.5, width * (e.deltaY > 0 ? 1.25 : 0.8)));
    const nFrom = Math.min(chart.span[0], at + next * frac);
    const nTo = Math.max(0, nFrom - next);
    onRange(nFrom - nTo >= chart.span[0] - 0.01 ? null : [nFrom, nTo]);
  };

  return (
    <div className="exs-events" onWheel={onWheel}>
      {(chart.title || chart.grade) && (
        <div className="exs-events-model">
          <div><b>{chart.title}</b><small>{chart.scope}</small></div>
          <span>{chart.grade} · {chart.timescale}</span>
        </div>
      )}
      {chart.periods.length > 0 && (
        <div className="exs-events-periods">
          <span className="exs-events-gutter">Geologic time</span>
          <div className="exs-events-period-track">
            {chart.periods.filter((p) => visible(p.from, p.to)).map((p) => {
              const l = x(Math.min(from, p.from)); const w = x(Math.max(to, p.to)) - l;
              return <i key={p.id} style={{ left: `${l}%`, width: `${w}%` }} title={`${p.name} · ${p.from}–${p.to} Ma`}><b>{p.name}</b></i>;
            })}
          </div>
        </div>
      )}
      {chart.cycles.length > 0 && (
        <div className="exs-events-cycles">
          <span className="exs-events-gutter">Basin cycle</span>
          <div className="exs-events-cycle-track">
            {chart.cycles.filter((c) => visible(c.from, c.to)).map((c) => {
              const l = x(Math.min(from, c.from)); const w = Math.max(0.8, x(Math.max(to, c.to)) - l);
              return <i key={c.id} style={{ left: `${l}%`, width: `${w}%` }} title={`${c.label}${c.contribution ? ` · ${c.contribution}` : ''}`}><b>{c.label}</b></i>;
            })}
          </div>
        </div>
      )}
      <div className="exs-events-axis">
        {tk.map((t) => <span key={t} style={{ left: `${x(t)}%` }}>{t}</span>)}
        <em>Ma</em>
      </div>
      <div className="exs-events-rows">
        {chart.rows.map((row: EventRow, rowIndex) => (
          <div className={'exs-event-row' + (row.modelled ? '' : ' gap') + (row.kind === 'process' ? ' process' : '') + (rowIndex === 4 ? ' group-start' : '')} key={row.key}>
            <span className="exs-event-label">{row.label}</span>
            <div className="exs-event-track">
              {tk.map((t) => <i className="exs-event-grid" key={t} style={{ left: `${x(t)}%` }} />)}
              {row.modelled ? row.bars.filter((b) => visible(b.from, b.to)).map((b, i) => (
                <EventBarCell
                  key={row.key + i}
                  bar={b}
                  kind={row.kind}
                  left={x(Math.min(from, b.from))}
                  width={Math.max(1.2, x(Math.max(to, b.to)) - x(Math.min(from, b.from)))}
                  filtered={!matchesFilter(crossFilter ?? null, { unitName: b.label, cycleId: b.cycleId, from: b.from, to: b.to })}
                  onFilter={onCrossFilter ? (unit) => onCrossFilter(
                    crossFilter?.kind === 'formation' && crossFilter.key === unit
                      ? null : { kind: 'formation', key: unit, label: unit },
                  ) : undefined}
                  onOpen={onPickFormation}
                />
              )) : (
                <span className="exs-event-missing"><b>Gap</b> needs {row.requires}</span>
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
        <span className="exs-events-evidence">Click a formation bar for its detail</span>
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

// ── Tectonostratigraphy ─────────────────────────────────────────────────────────
// The geological convention: TIME RUNS VERTICALLY, oldest at the bottom. Three
// synchronised columns — ICS period · basin cycle · petroleum-system element — so you
// can read straight down and see which cycle a source rock sits in, and where the
// column is simply empty (which for most basins is the honest answer).
//
// Era colours follow the ICS/CGMW convention so the column reads like a real chart:
// Cenozoic yellow-green, Mesozoic blue-green, Paleozoic olive/teal.
const ERA_TINT: Record<string, string> = {
  Cenozoic: '#F2FA8C', Mesozoic: '#67C5CA', Paleozoic: '#99C08D', Precambrian: '#F74370',
};
const ROLE_TINT: Record<string, string> = {
  source: '#f43f5e', reservoir: '#f59e0b', seal: '#a78bfa', overburden: '#38bdf8',
};

export interface TectonoPeriod { id: string; name: string; from: number; to: number; parent?: string }
export interface TectonoCycle { id: string; label: string; from: number; to: number; geodynamics?: string }
export interface TectonoElement {
  unitName: string; role: string; from: number; to: number;
  effectiveness?: string; confidence?: string; cycleId?: string;
}

/** Element cell in the tectonostratigraphy column — same click contract as the events chart. */
function TectoElCell({ el, style, filtered, onFilter, onOpen }: {
  el: TectonoElement; style: React.CSSProperties; filtered: boolean;
  onFilter?: (u: string) => void; onOpen?: (u: string) => void;
}) {
  const handlers = useClickOrDouble(() => onFilter?.(el.unitName), () => onOpen?.(el.unitName));
  return (
    <button className={'exs-tecto-el' + (filtered ? ' dimmed' : '')} style={style} {...handlers}
      title={`${el.unitName} · ${el.role}${el.effectiveness ? ` (${el.effectiveness})` : ''} · ${el.from}–${el.to} Ma — click to filter, double-click for detail`}>
      <b>{el.unitName}</b>
    </button>
  );
}

function TectoCycleCell({ cycle, style, filtered, onFilter }: {
  cycle: TectonoCycle; style: React.CSSProperties; filtered: boolean; onFilter?: (c: TectonoCycle) => void;
}) {
  return (
    <button className={'exs-tecto-cycle g-' + (cycle.geodynamics ?? 'none') + (filtered ? ' dimmed' : '')}
      style={style} onClick={() => onFilter?.(cycle)}
      title={`${cycle.label} · ${cycle.from}–${cycle.to} Ma — click to filter the petroleum system chart`}>
      <b>{cycle.label}</b>
    </button>
  );
}

export function TectonoStratChart({
  periods, cycles, elements, onPickFormation, onCrossFilter, crossFilter, range, onRange,
}: {
  periods: TectonoPeriod[]; cycles: TectonoCycle[]; elements: TectonoElement[];
  onPickFormation?: (unitName: string) => void;
  onCrossFilter?: (f: CrossFilter) => void; crossFilter?: CrossFilter;
  /** Same shared window as the events chart — the two axes never disagree. */
  range?: [number, number] | null;
  onRange?: (r: [number, number] | null) => void;
}) {
  if (!periods.length) {
    return <div className="exs-empty-state"><b>No timescale</b><p>The geologic timescale is not loaded, so no tectonostratigraphic column can be drawn.</p></div>;
  }
  // Default view clips to the span that actually carries content, so a basin whose
  // whole story is Jurassic→Recent doesn't render 400 Ma of empty Palaeozoic. An
  // explicit zoom range overrides that entirely.
  const contentOldest = Math.max(
    0,
    ...cycles.map((c) => c.from),
    ...elements.map((e) => e.from),
  );
  const autoOldest = contentOldest > 0
    ? (periods.find((p) => p.from >= contentOldest && p.to <= contentOldest)?.from ?? contentOldest)
    : periods[0].from;
  const older = range ? range[0] : autoOldest;
  const younger = range ? range[1] : 0;
  const span = Math.max(0.5, older - younger);
  const inWindow = (a: number, b: number) => Math.max(a, b) > younger && Math.min(a, b) < older;
  const shown = periods.filter((p) => inWindow(p.from, p.to));
  // 0 Ma (or the window's young edge) at the TOP, oldest at the bottom — the
  // geological convention the column is read in.
  const y = (ma: number) => ((Math.min(Math.max(ma, younger), older) - younger) / span) * 100;
  const band = (from: number, to: number) => ({ top: `${y(to)}%`, height: `${Math.max(1.1, y(from) - y(to))}%` });

  const onWheel = (e: React.WheelEvent) => {
    if (!onRange) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    const at = younger + frac * span;
    const next = Math.min(autoOldest, Math.max(0.5, span * (e.deltaY > 0 ? 1.25 : 0.8)));
    const nTo = Math.max(0, at - next * frac);
    onRange(next >= autoOldest - 0.01 ? null : [nTo + next, nTo]);
  };

  return (
    <div className="exs-tecto" onWheel={onWheel}>
      <div className="exs-tecto-head"><span>Period</span><span>Cycle</span><span>Element</span></div>
      <div className="exs-tecto-body">
        <div className="exs-tecto-col periods">
          {shown.map((p) => {
            const key = `${p.from}|${p.to}`;
            const on = crossFilter?.kind === 'period' && crossFilter.key === key;
            return (
              <button key={p.id} className={'exs-tecto-period' + (on ? ' on' : '')}
                style={{ ...band(p.from, p.to), background: ERA_TINT[p.parent ?? ''] ?? 'var(--panel2)' }}
                onClick={() => onCrossFilter?.(on ? null : { kind: 'period', key, label: p.name })}
                title={`${p.name} · ${p.from}–${p.to} Ma${p.parent ? ` · ${p.parent}` : ''} — click to filter`}>
                <b>{p.name}</b>
              </button>
            );
          })}
        </div>
        <div className="exs-tecto-col">
          {cycles.filter((c) => inWindow(c.from, c.to)).length ? cycles.filter((c) => inWindow(c.from, c.to)).map((c) => (
            <TectoCycleCell key={c.id} cycle={c} style={band(c.from, c.to)}
              filtered={!!crossFilter && !(crossFilter.kind === 'cycle' && crossFilter.key === c.id)}
              onFilter={(cy) => onCrossFilter?.(
                crossFilter?.kind === 'cycle' && crossFilter.key === cy.id
                  ? null : { kind: 'cycle', key: cy.id, label: cy.label },
              )} />
          )) : <div className="exs-tecto-empty">{cycles.length ? 'no cycle in view' : 'no cycle model'}</div>}
        </div>
        <div className="exs-tecto-col">
          {elements.filter((e) => inWindow(e.from, e.to)).length ? elements.filter((e) => inWindow(e.from, e.to)).map((e, i) => (
            <TectoElCell key={e.unitName + i} el={e}
              style={{ ...band(e.from, e.to), background: ROLE_TINT[e.role] ?? 'var(--ink3)' }}
              filtered={!matchesFilter(crossFilter ?? null, { unitName: e.unitName, cycleId: e.cycleId, from: e.from, to: e.to })}
              onFilter={onCrossFilter ? (u) => onCrossFilter(
                crossFilter?.kind === 'formation' && crossFilter.key === u
                  ? null : { kind: 'formation', key: u, label: u },
              ) : undefined}
              onOpen={onPickFormation} />
          )) : <div className="exs-tecto-empty">{elements.length ? 'no element in view' : 'no elements'}</div>}
        </div>
        <div className="exs-tecto-scale">
          {shown.filter((p) => p.to > younger).map((p) => <i key={p.id} style={{ top: `${y(p.to)}%` }}>{p.to}</i>)}
          <i style={{ top: '100%' }}>{older < 10 ? older.toFixed(1) : Math.round(older)}</i>
        </div>
      </div>
      <div className="exs-tecto-foot">
        {Object.entries(ROLE_TINT).map(([k, v]) => <span key={k}><i style={{ background: v }} />{k}</span>)}
        <em>Ma</em>
      </div>
    </div>
  );
}

// ── Hydrocarbon mix, in industry map symbology ──────────────────────────────────
// The convention on petroleum field maps: GREEN = oil, RED = gas, and a field that
// produces both is drawn split — hence the diagonal green/red panel. Condensate takes
// the amber stripe. Using the same language a geologist already reads off a basin map
// means this needs no legend to be understood.
// Solid fills on a single ramp, deliberately NOT split symbols: a diagonal green/red
// wedge read as "half oil half gas" rather than "produces both" and was more confusing
// than informative. Instead the GREEN FAMILY is oil-bearing (darker = also has gas) and
// the RED/AMBER FAMILY is gas-only — still the map convention of green oil / red gas,
// but legible at donut-slice size.
const HC_COLORS: Record<string, string> = {
  oil: '#22c55e',
  'oil and gas': '#15803d',
  gas: '#dc2626',
  'gas and condensate': '#ea580c',
  condensate: '#f59e0b',
};
const hcColor = (k: string) => HC_COLORS[k.toLowerCase()] ?? '#64748b';

export function HcDonut({ mix, total }: { mix: Array<{ key: string; n: number }>; total: number }) {
  const arcs = useMemo(() => {
    if (!mix.length || !total) return [];
    const layout = pie<{ key: string; n: number }>().value((d) => d.n).sort(null).padAngle(0.02);
    const gen = arc<PieArcDatum<{ key: string; n: number }>>().innerRadius(26).outerRadius(46).cornerRadius(1.5);
    return layout(mix).map((s) => ({ key: s.data.key, n: s.data.n, d: gen(s) ?? '' }));
  }, [mix, total]);

  if (!arcs.length) return <div className="exs-empty-inline">Hydrocarbon type not recorded.</div>;
  const top = mix[0];

  return (
    <div className="exs-hc">
      {/* legend left, donut right — the donut then has the card's open edge to breathe
          into instead of being pinched against the footer link */}
      <div className="exs-hc-keys">
        {mix.slice(0, 4).map((d) => (
          <span key={d.key} title={`${d.n.toLocaleString()} fields`}>
            <i style={{ background: hcColor(d.key) }} />{d.key}<b>{Math.round((d.n / total) * 100)}%</b>
          </span>
        ))}
      </div>
      <svg viewBox="0 0 100 100" className="exs-hc-donut" role="img" aria-label="Hydrocarbon type mix">
        <g transform="translate(50,50)">
          {arcs.map((a) => (
            <path key={a.key} d={a.d} fill={hcColor(a.key)} stroke="var(--panel)" strokeWidth="0.8">
              <title>{`${a.key} · ${a.n.toLocaleString()} fields (${Math.round((a.n / total) * 100)}%)`}</title>
            </path>
          ))}
        </g>
        <text x="50" y="49" className="exs-hc-mid">{Math.round((top.n / total) * 100)}%</text>
        <text x="50" y="59" className="exs-hc-sub">{top.key.replace(' and ', '+')}</text>
      </svg>
    </div>
  );
}

/** Smooth, hoverable creaming sparkline. Uses the d3 modules already in the app
 *  (d3-scale + d3-shape) rather than hand-rolled path maths, so the curve is
 *  monotone-interpolated and the hit-testing is exact. */
/** Volume with its unit carried in the label rather than assumed.
 *
 *  Values are MMBOE. Above 1,000 the sensible reading is BBOE, and the label has to
 *  change with it — formatting 14,000 as "14.0B" and then appending "MMBOE" produces
 *  "14.0B MMBOE", i.e. wrong by a factor of a thousand. */
function boeLabel(mmboe: number): string {
  return mmboe >= 1000
    ? `${(mmboe / 1000).toFixed(1)} BBOE`
    : `${mmboe >= 10 ? Math.round(mmboe) : mmboe.toFixed(1)} MMBOE`;
}

/** The Maturity card's inline creaming curve.
 *
 *  Plots cumulative VOLUME, matching the full curve in the discovery popup. It used to
 *  plot cumulative COUNT, which is the wrong shape for a maturity read: counting makes
 *  a run of small finds look like sustained success, and flattens nothing when a giant
 *  lands. Since the card's verdict is literally "how creamed is this basin", the two
 *  had to agree — a card reading "Maturing" above a count curve is answering a
 *  different question from the one it appears to answer.
 *
 *  Falls back to count where no field in scope carries a reported volume, rather than
 *  drawing a flat zero line and implying an empty basin. */
export function CreamingSpark({ creaming, height = 42 }: { creaming: CreamingPoint[]; height?: number }) {
  const [hover, setHover] = useState<CreamingPoint | null>(null);
  const ref = useRef<SVGSVGElement | null>(null);
  const W = 260, H = height;

  const model = useMemo(() => {
    if (creaming.length < 2) return null;
    const last = creaming[creaming.length - 1];
    const useBoe = last.cumBoe > 0;
    const val = (d: CreamingPoint) => (useBoe ? d.cumBoe : d.cumulative);
    const x = scaleLinear().domain([creaming[0].year, last.year]).range([0, W]);
    const y = scaleLinear().domain([0, val(last) || 1]).range([H - 2, 2]);
    const line = d3line<CreamingPoint>().x((d) => x(d.year)).y((d) => y(val(d))).curve(curveMonotoneX);
    const area = d3area<CreamingPoint>().x((d) => x(d.year)).y0(H).y1((d) => y(val(d))).curve(curveMonotoneX);
    return { x, y, val, useBoe, d: line(creaming) ?? '', a: area(creaming) ?? '' };
  }, [creaming, H]);

  if (!model) return <div className="exs-empty-inline">Too few dated discoveries.</div>;

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const year = model.x.invert(((e.clientX - r.left) / r.width) * W);
    const nearest = creaming.reduce((a, b) => (Math.abs(b.year - year) < Math.abs(a.year - year) ? b : a));
    setHover(nearest);
  };

  return (
    <div className="exs-spark">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <path d={model.a} className="exs-spark-area" />
        <path d={model.d} className="exs-spark-line" vectorEffect="non-scaling-stroke" />
        {hover && (
          <>
            <line x1={model.x(hover.year)} x2={model.x(hover.year)} y1={0} y2={H} className="exs-spark-rule" vectorEffect="non-scaling-stroke" />
            <circle cx={model.x(hover.year)} cy={model.y(model.val(hover))} r={2.6} className="exs-spark-dot" />
          </>
        )}
      </svg>
      <small>
        {hover
          ? `${hover.year} · ${model.useBoe ? boeLabel(model.val(hover)) : `${hover.cumulative} found`} to date`
          : `${creaming[0].year}–${creaming[creaming.length - 1].year}`
            + (model.useBoe ? ` · ${boeLabel(model.val(creaming[creaming.length - 1]))}` : '')}
      </small>
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
