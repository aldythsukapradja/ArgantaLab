// Petroleum-System Screening — Stratigraphy, Charge Timing, Play Fairway.
import { Fragment, useEffect, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { extent, rollup } from 'd3-array';
import { useStore } from '../../../store';
import {
  crsMatrix, fmtNum, loadSpine, systemsFor, cyclesFor,
  type CrsRow, type CycleRec, type ElementRec, type FormationRec, type SystemBundle,
} from '../data';
import {
  AxisY, DataTable, Degrade, Legend, Loading, Plot, TableToggle, Tip, useSize, VizDefs, type TipData,
} from '../../../viz/primitives';
import { ROLE_COLOR, SEQUENTIAL_BLUE, STATUS } from '../../../viz/palette';
import type { ChartProps } from './types';

const ROLES = ['source', 'reservoir', 'seal', 'overburden'] as const;

// ═══ 4a · Petroleum-system column ════════════════════════════════════════════
export function PetroleumSystemColumn({ scope }: ChartProps) {
  const [bundles, setBundles] = useState<SystemBundle[] | null>(null);
  const [cycles, setCycles] = useState<CycleRec[]>([]);
  const [tip, setTip] = useState<TipData | null>(null);
  const [table, setTable] = useState(false);
  const dark = useStore((s) => s.theme) === 'dark';

  useEffect(() => { systemsFor(scope).then(setBundles); cyclesFor(scope).then(setCycles); }, [scope]);
  if (!bundles) return <Loading what="1,544 petroleum-system element bars" />;

  const elements = bundles.flatMap((b) => b.elements);
  if (table) {
    return (
      <div className="viz-host">
        <div className="viz-tools"><TableToggle open onToggle={() => setTable(false)} /></div>
        <DataTable head={['Unit', 'Role', 'Start Ma', 'End Ma', 'Effectiveness', 'Confidence']}
          rows={elements.map((e) => [e.unit_name ?? '', e.element_role, e.start_ma ?? '', e.end_ma ?? '', e.effectiveness ?? '', e.confidence ?? ''])} />
      </div>
    );
  }

  return (
    <Degrade n={elements.length} need={1} what="element bars">
      <div className="viz-host">
        <div className="viz-tools"><TableToggle open={false} onToggle={() => setTable(true)} /></div>
        <Plot minHeight={210}>{(size) => (<>
          <RoleColumn elements={elements} cycles={cycles} size={size} dark={dark} onTip={setTip} />
          <Tip tip={tip} host={size} />
        </>)}</Plot>
        <Legend items={ROLES.map((r) => ({ label: r[0].toUpperCase() + r.slice(1), color: ROLE_COLOR[r][dark ? 'dark' : 'light'] }))} />
        <p className="viz-note">
          Two lanes on one axis: what the basin <b>did</b> (cycles, left) beside what it <b>made</b> (roles, right).
          Hatched bars have no assessed effectiveness — a claim we decline to fill in.
        </p>
      </div>
    </Degrade>
  );
}

function RoleColumn({ elements, cycles, size, dark, onTip }: {
  elements: ElementRec[]; cycles: CycleRec[]; size: { w: number; h: number };
  dark: boolean; onTip: (t: TipData | null) => void;
}) {
  const h = Math.max(140, size.h);
  const pad = { top: 14, bottom: 6, left: 44 };
  const ages = [...elements.flatMap((e) => [e.start_ma ?? 0, e.end_ma ?? 0]), ...cycles.flatMap((c) => [c.age_top_ma ?? 0, c.age_base_ma ?? 0])];
  const [lo, hi] = extent(ages) as [number, number];
  const y = scaleLinear().domain([hi ?? 250, lo ?? 0]).range([pad.top, h - pad.bottom]);
  const usable = size.w - pad.left - 8;
  const cycleW = cycles.length ? usable * 0.22 : 0;
  const laneW = (usable - cycleW - 8) / ROLES.length;

  return (
    <svg width={size.w} height={h} className="viz-column">
      <VizDefs />
      <AxisY ticks={y.ticks(6).map((v) => ({ v, y: y(v) }))} x={pad.left} w={usable} fmt={(v) => `${v} Ma`} />
      {cycles.map((c) => {
        const top = y(c.age_base_ma ?? 0), bot = y(c.age_top_ma ?? 0);
        return <rect key={c.cycle_id} x={pad.left} y={top + 1} width={cycleW - 4} height={Math.max(2, bot - top - 2)}
          rx={3} className="viz-cycle-ghost" />;
      })}
      {ROLES.map((role, ri) => {
        const x = pad.left + cycleW + 8 + ri * laneW;
        const fill = ROLE_COLOR[role][dark ? 'dark' : 'light'];
        const bars = elements.filter((e) => e.element_role === role);
        return (
          <g key={role}>
            <text x={x + laneW / 2} y={pad.top - 3} textAnchor="middle" className="viz-col-title" fill={fill}>
              {role} · {bars.length}
            </text>
            {bars.map((e) => {
              const top = y(e.start_ma ?? 0), bot = y(e.end_ma ?? 0);
              const notAssessed = !e.effectiveness || e.effectiveness === 'not-assessed';
              return (
                <g key={e.element_id}
                  onMouseEnter={(ev) => onTip({
                    x: ev.nativeEvent.offsetX, y: ev.nativeEvent.offsetY, title: e.unit_name ?? role,
                    rows: [['Role', role], ['Age', `${e.start_ma}–${e.end_ma} Ma`],
                      ['Effectiveness', e.effectiveness ?? 'not-assessed'], ['Confidence', e.confidence ?? '—']],
                    grade: notAssessed ? 'RECALLED' : 'SOURCED',
                  })}
                  onMouseLeave={() => onTip(null)}>
                  <rect x={x + 2} y={Math.min(top, bot) + 1} width={laneW - 5}
                    height={Math.max(2, Math.abs(bot - top) - 2)} rx={3} fill={fill}
                    opacity={notAssessed ? 0.5 : 0.95} className="viz-cycle" />
                  {notAssessed && (
                    <rect x={x + 2} y={Math.min(top, bot) + 1} width={laneW - 5}
                      height={Math.max(2, Math.abs(bot - top) - 2)} rx={3} fill="url(#viz-recalled)" color={fill} />
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

// ═══ 4b · Depositional-system matrix ═════════════════════════════════════════
export function DepositionalSystemMatrix({ scope }: ChartProps) {
  const [ref, size] = useSize<HTMLDivElement>();
  const [cells, setCells] = useState<{ period: string; env: string; n: number }[] | null>(null);
  const [periods, setPeriods] = useState<string[]>([]);
  const [tip, setTip] = useState<TipData | null>(null);
  const [worldwide, setWorldwide] = useState(false);

  useEffect(() => {
    (async () => {
      const spine = await loadSpine();
      const scoped = worldwide ? spine.basinCycle : await cyclesFor(scope);
      const ts = spine.geologicTimescale.filter((t) => t.rank === 'period').sort((a, b) => b.start_ma - a.start_ma);
      const periodOf = (ma: number) => ts.find((t) => ma <= t.start_ma && ma >= t.end_ma)?.name ?? 'Unassigned';
      const rolled = rollup(
        scoped.filter((c) => c.age_top_ma != null),
        (v) => v.length,
        (c) => periodOf(((c.age_top_ma ?? 0) + (c.age_base_ma ?? 0)) / 2),
        (c) => (c.fill ?? 'unknown').split(' ')[0],
      );
      const out: { period: string; env: string; n: number }[] = [];
      rolled.forEach((envs, period) => envs.forEach((n, env) => out.push({ period, env, n })));
      setCells(out);
      setPeriods(ts.map((t) => t.name));
    })();
  }, [scope, worldwide]);

  if (!cells) return <Loading what="cycle fill by period" />;
  const envs = [...new Set(cells.map((c) => c.env))].sort();
  const max = Math.max(1, ...cells.map((c) => c.n));
  const color = scaleLinear<string>().domain([0, max]).range([SEQUENTIAL_BLUE[0], SEQUENTIAL_BLUE[5]]);
  const shownPeriods = periods.filter((p) => cells.some((c) => c.period === p));

  return (
    <Degrade n={cells.length} need={1} what="cycle records"
      alt={<button className="viz-alt-btn" onClick={() => setWorldwide(true)}>Show the worldwide matrix instead</button>}>
      <div className="viz-host scroll" ref={ref}>
        <div className="viz-tools">
          <button className={'exc-icon-btn' + (worldwide ? ' on' : '')} onClick={() => setWorldwide((w) => !w)}
            title="Toggle scope: this basin vs all 630 cycles">🌐</button>
        </div>
        <div className="viz-matrix" style={{ gridTemplateColumns: `92px repeat(${shownPeriods.length}, minmax(0,1fr))` }}>
          <span />
          {shownPeriods.map((p) => <span key={p} className="viz-matrix-col">{p.slice(0, 4)}</span>)}
          {envs.map((env) => (
            <Fragment key={env}>
              <span className="viz-matrix-row">{env}</span>
              {shownPeriods.map((p) => {
                const cell = cells.find((c) => c.period === p && c.env === env);
                return (
                  <i key={`${env}-${p}`} style={{ background: cell ? color(cell.n) : 'transparent' }}
                    title={`${env} · ${p}: ${cell?.n ?? 0} cycles`}
                    onMouseEnter={(e) => setTip({
                      x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, title: `${env} · ${p}`,
                      rows: [['Cycles', String(cell?.n ?? 0)], ['Scope', worldwide ? 'worldwide' : scope]], grade: 'RECALLED',
                    })}
                    onMouseLeave={() => setTip(null)} />
                );
              })}
            </Fragment>
          ))}
        </div>
        <p className="viz-note">
          A <b>count</b> heatmap — cycles per period × depositional fill. Not a mapped facies area, and the legend says so.
          {worldwide ? ' Showing all 630 cycles.' : ` Showing ${scope}.`}
        </p>
        <Tip tip={tip} host={size} />
      </div>
    </Degrade>
  );
}

// ═══ 4c · Interval evidence ledger ═══════════════════════════════════════════
export function IntervalEvidenceLedger({ scope }: ChartProps) {
  const [rows, setRows] = useState<{ f: FormationRec; inScope: boolean }[] | null>(null);
  const [narr, setNarr] = useState<{ label: string; text: string }[]>([]);

  useEffect(() => {
    (async () => {
      const [spine, bundles] = await Promise.all([loadSpine(), systemsFor(scope)]);
      const units = new Set(bundles.flatMap((b) => b.elements.map((e) => (e.unit_name ?? '').toLowerCase())));
      setRows(spine.formation
        .map((f) => ({ f, inScope: units.has(f.canonical_name.toLowerCase()) }))
        .sort((a, b) => Number(b.inScope) - Number(a.inScope) || (b.f.occurrence_count ?? 0) - (a.f.occurrence_count ?? 0))
        .slice(0, 40));
      // The USGS narrative is the strongest sourced asset we hold — split it on
      // its own labels rather than paraphrasing it.
      const note = bundles[0]?.tps.essential_elements_note ?? '';
      setNarr(note.split('|').map((chunk) => {
        const [label, ...rest] = chunk.split(':');
        return { label: label.trim().slice(0, 40), text: rest.join(':').trim().slice(0, 320) };
      }).filter((c) => c.text));
    })();
  }, [scope]);

  if (!rows) return <Loading what="618 canonical formations" />;
  return (
    <div className="viz-host scroll">
      {narr.length > 0 && (
        <div className="viz-narr">
          {narr.slice(0, 3).map((c) => (
            <div key={c.label}><b>{c.label}</b><p>{c.text}…</p><em>USGS authority text · SOURCED</em></div>
          ))}
        </div>
      )}
      <div className="viz-ledger">
        {rows.map(({ f, inScope }) => (
          <div key={f.formation_id} className={'viz-ledger-row' + (inScope ? ' focus' : '')}>
            <b>{f.canonical_name}</b>
            <span>{f.age_hint ?? '—'}</span>
            <span>{f.basin_count ?? 0} basins</span>
            <span>{f.occurrence_count ?? 0}×</span>
            <em className={inScope ? 'sourced' : 'derived'}>{inScope ? 'in scope' : 'catalogue'}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ 5a · Petroleum-system events chart (Magoon–Dow) ═════════════════════════
const EVENT_ORDER = ['generation', 'expulsion', 'migration', 'accumulation', 'trap-formation', 'preservation', 'critical-moment'];

export function GenerationTimingChart({ scope }: ChartProps) {
  const [bundles, setBundles] = useState<SystemBundle[] | null>(null);
  const [pick, setPick] = useState(0);
  const [tip, setTip] = useState<TipData | null>(null);
  const [table, setTable] = useState(false);
  const dark = useStore((s) => s.theme) === 'dark';

  useEffect(() => { systemsFor(scope).then((b) => { setBundles(b); setPick(0); }); }, [scope]);
  if (!bundles) return <Loading what="1,484 petroleum-system events" />;
  const bundle = bundles[Math.min(pick, bundles.length - 1)];
  if (!bundle) return <Degrade n={0} need={1} what="petroleum systems in scope"><span /></Degrade>;

  if (table) {
    return (
      <div className="viz-host">
        <div className="viz-tools"><TableToggle open onToggle={() => setTable(false)} /></div>
        <DataTable head={['Event', 'Start Ma', 'End Ma', 'Certainty']}
          rows={bundle.events.map((e) => [e.label ?? e.event_type, e.start_ma ?? '', e.end_ma ?? '', e.certainty ?? ''])} />
      </div>
    );
  }

  return (
    <div className="viz-host">
      <div className="viz-tools"><TableToggle open={false} onToggle={() => setTable(true)} /></div>
      {bundles.length > 1 && (
        <div className="viz-axis-picker">
          {bundles.map((b, i) => (
            <button key={b.tps.tps_id} className={i === pick ? 'on' : ''} onClick={() => setPick(i)}>{b.tps.name}</button>
          ))}
        </div>
      )}
      <Plot minHeight={230}>{(size) => (<>
        <EventsChart bundle={bundle} size={size} dark={dark} onTip={setTip} multi={bundles.length > 1} />
        <Tip tip={tip} host={size} />
      </>)}</Plot>
      <p className="viz-note">
        Magoon–Dow chart for <b>{bundle.tps.name}</b> — elements above, processes below, critical moment marked.
        Available for all 212 systems in the corpus.
      </p>
    </div>
  );
}

function EventsChart({ bundle, size, dark, onTip, multi }: {
  bundle: SystemBundle; size: { w: number; h: number }; dark: boolean;
  onTip: (t: TipData | null) => void; multi: boolean;
}) {
  const rows = [
    ...ROLES.map((r) => ({ key: r, label: r, kind: 'element' as const })),
    ...EVENT_ORDER.filter((e) => e !== 'critical-moment').map((e) => ({ key: e, label: e.replace('-', ' '), kind: 'event' as const })),
  ];
  // Fill the measured box rather than stacking fixed 17px rows and leaving two
  // thirds of the hero empty. Rows grow into the space available, with a floor so
  // a short viewport still gives each bar a legible band.
  const pad = { left: 100, right: 12, top: 10, bottom: 24 };
  const h = Math.max(140, size.h);
  const rowH = Math.max(16, (h - pad.top - pad.bottom) / rows.length);
  const ages = [...bundle.elements.flatMap((e) => [e.start_ma ?? 0, e.end_ma ?? 0]), ...bundle.events.flatMap((e) => [e.start_ma ?? 0, e.end_ma ?? 0])];
  const [lo, hi] = extent(ages) as [number, number];
  const x = scaleLinear().domain([hi ?? 300, lo ?? 0]).range([pad.left, Math.max(pad.left + 20, size.w - pad.right)]);
  const crit = bundle.events.find((e) => e.event_type === 'critical-moment');

  return (
    <svg width={size.w} height={h} className="viz-events">
      <VizDefs />
      {x.ticks(6).map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={pad.top} y2={h - pad.bottom} className="viz-grid vertical" />
          <text x={x(t)} y={h - pad.bottom + 14} textAnchor="middle" className="viz-axis-text">{t}</text>
        </g>
      ))}
      {rows.map((r, i) => {
        const y = pad.top + i * rowH;
        const isEl = r.kind === 'element';
        const fill = isEl ? ROLE_COLOR[r.key as keyof typeof ROLE_COLOR][dark ? 'dark' : 'light'] : 'var(--teal)';
        const bars = isEl
          ? bundle.elements.filter((e) => e.element_role === r.key).map((e) => ({ a: e.start_ma ?? 0, b: e.end_ma ?? 0, cert: e.confidence, title: e.unit_name ?? r.label }))
          : bundle.events.filter((e) => e.event_type === r.key).map((e) => ({ a: e.start_ma ?? 0, b: e.end_ma ?? 0, cert: e.certainty, title: e.label ?? r.label }));
        return (
          <g key={r.key}>
            <text x={pad.left - 6} y={y + rowH / 2} dy="0.32em" textAnchor="end" className="viz-row-label">{r.label}</text>
            <line x1={pad.left} x2={size.w - pad.right} y1={y + rowH / 2} y2={y + rowH / 2} className="viz-grid" />
            {bars.map((b, j) => {
              const x1 = Math.min(x(b.a), x(b.b)), x2 = Math.max(x(b.a), x(b.b));
              const low = b.cert === 'low' || b.cert === undefined;
              return (
                <g key={j}
                  onMouseEnter={(e) => onTip({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, title: b.title, rows: [['Interval', `${b.a}–${b.b} Ma`], ['Certainty', b.cert ?? 'unknown'], ['Row', r.label]], grade: isEl ? 'RECALLED' : 'SOURCED' })}
                  onMouseLeave={() => onTip(null)}>
                  <rect x={x1} y={y + 4} width={Math.max(2, x2 - x1)} height={Math.max(6, rowH - 8)} rx={3}
                    fill={fill} opacity={low ? 0.45 : 0.9} />
                  {low && <rect x={x1} y={y + 4} width={Math.max(2, x2 - x1)} height={Math.max(6, rowH - 8)} rx={3} fill="url(#viz-recalled)" color={fill} />}
                </g>
              );
            })}
          </g>
        );
      })}
      {crit?.start_ma != null && (
        <g className="viz-critical">
          <line x1={x(crit.start_ma)} x2={x(crit.start_ma)} y1={pad.top - 4} y2={h - pad.bottom} />
          <text x={x(crit.start_ma)} y={pad.top - 6} textAnchor="middle">critical moment {crit.start_ma} Ma</text>
        </g>
      )}
      {multi && <title>Multiple systems in scope — use the picker above.</title>}
    </svg>
  );
}

// ═══ 5b · 1D burial model (user-input sandbox) ═══════════════════════════════
interface Layer { name: string; top: number; base: number; thickness: number }

export function BurialModel1D({ scope }: ChartProps) {
  const [heatFlow, setHeatFlow] = useState(55);
  const [layers, setLayers] = useState<Layer[] | null>(null);

  useEffect(() => {
    // Seeded from the cycle ages in scope — the AGES are real; the thicknesses
    // are the user's to enter, because the corpus holds none.
    cyclesFor(scope).then((cs) => setLayers(cs.map((c) => ({
      name: c.title, top: c.age_top_ma ?? 0, base: c.age_base_ma ?? 0, thickness: 0,
    }))));
  }, [scope]);

  if (!layers) return <Loading what="cycle ages to seed the layer table" />;

  const total = layers.reduce((t, l) => t + l.thickness, 0);

  return (
    <div className="viz-host scroll">
      <div className="viz-user-banner">
        <b>USER-INPUT · uncalibrated</b>
        <span>Ages are sourced from the cycle framework. Thickness, erosion and heat flow are not in the corpus —
          type them and the curve is yours, not ours. No vitrinite or Tmax exists to calibrate against.</span>
      </div>
      <div className="viz-layer-grid">
        <span>Layer</span><span>Age (Ma)</span><span>Thickness (m)</span>
        {layers.map((l, i) => (
          <Fragment key={l.name + i}>
            <b>{l.name}</b>
            <span>{l.base}–{l.top}</span>
            <input
              type="number" min={0} max={12000} step={50} value={l.thickness}
              onChange={(e) => setLayers(layers.map((x, j) => j === i ? { ...x, thickness: Number(e.target.value) } : x))}
            />
          </Fragment>
        ))}
      </div>
      <label className="viz-slider">
        Heat flow <b>{heatFlow} mW/m²</b>
        <input type="range" min={30} max={110} value={heatFlow} onChange={(e) => setHeatFlow(Number(e.target.value))} />
      </label>
      {total > 0 ? (
        <Plot minHeight={140}>{(size) => <BurialCurve layers={layers} w={size.w} h={size.h} heatFlow={heatFlow} />}</Plot>
      ) : (
        <p className="viz-note">Enter a thickness to draw the burial curve. Nothing is drawn from an assumed number.</p>
      )}
    </div>
  );
}

function BurialCurve({ layers, w, h, heatFlow }: { layers: Layer[]; w: number; h: number; heatFlow: number }) {
  const ages = layers.flatMap((l) => [l.top, l.base]);
  const x = scaleLinear().domain([Math.max(...ages), 0]).range([38, Math.max(48, w - 8)]);
  const total = layers.reduce((t, l) => t + l.thickness, 0);
  const y = scaleLinear().domain([0, total]).range([6, h - 18]);
  let cum = 0;
  const bands = [...layers].sort((a, b) => b.base - a.base).map((l) => {
    const topDepth = cum; cum += l.thickness;
    return { l, topDepth, baseDepth: cum };
  });
  // Depth to the 100–150 °C oil window, from the user's own gradient.
  const gradient = heatFlow / 25;
  const oilTop = gradient > 0 ? (100 - 15) / gradient : 0;

  return (
    <svg width={w} height={h} className="viz-burial">
      {bands.map((b, i) => (
        <path key={i} d={`M${x(b.l.base)},${y(b.topDepth)} L${x(0)},${y(b.topDepth)} L${x(0)},${y(b.baseDepth)} L${x(b.l.base)},${y(b.baseDepth)} Z`}
          fill={SEQUENTIAL_BLUE[Math.min(5, i + 1)]} opacity={0.7} stroke="var(--panel)" strokeWidth={1} />
      ))}
      {oilTop < total && (
        <g className="viz-oilwindow">
          <line x1={38} x2={w - 8} y1={y(oilTop)} y2={y(oilTop)} />
          <text x={42} y={y(oilTop) - 3}>oil window ≈ {Math.round(oilTop)} m at {heatFlow} mW/m²</text>
        </g>
      )}
      <text x={4} y={12} className="viz-axis-text">m</text>
    </svg>
  );
}

// ═══ 5c · Timing-risk readout ════════════════════════════════════════════════
export function BasinModelCaseManager({ scope }: ChartProps) {
  const [ref, size] = useSize<HTMLDivElement>();
  const [bundles, setBundles] = useState<SystemBundle[] | null>(null);
  useEffect(() => { systemsFor(scope).then(setBundles); }, [scope]);
  if (!bundles) return <Loading what="event intervals" />;

  const rows = bundles.map((b) => {
    const gen = b.events.find((e) => e.event_type === 'generation');
    const trap = b.events.find((e) => e.event_type === 'trap-formation');
    const ok = trap?.start_ma != null && gen?.start_ma != null && trap.start_ma >= gen.start_ma;
    return { name: b.tps.name, gen, trap, ok };
  });
  const ages = rows.flatMap((r) => [r.gen?.start_ma ?? 0, r.gen?.end_ma ?? 0, r.trap?.start_ma ?? 0, r.trap?.end_ma ?? 0]);
  const x = scaleLinear().domain([Math.max(...ages, 1), 0]).range([8, Math.max(20, size.w - 8)]);

  return (
    <div className="viz-host scroll" ref={ref}>
      {rows.map((r) => (
        <div key={r.name} className="viz-timing">
          <div className="viz-timing-head">
            <b>{r.name}</b>
            <em className={r.ok ? 'good' : 'warn'} style={{ color: r.ok ? STATUS.good : STATUS.warning }}>
              {r.ok ? 'trap predates generation' : 'order unresolved'}
            </em>
          </div>
          <svg width={size.w - 4} height={30}>
            {r.gen && <rect x={Math.min(x(r.gen.start_ma ?? 0), x(r.gen.end_ma ?? 0))} y={3}
              width={Math.max(2, Math.abs(x(r.gen.end_ma ?? 0) - x(r.gen.start_ma ?? 0)))} height={10} rx={3}
              fill={ROLE_COLOR.source.light}><title>generation {r.gen.start_ma}–{r.gen.end_ma} Ma</title></rect>}
            {r.trap && <rect x={Math.min(x(r.trap.start_ma ?? 0), x(r.trap.end_ma ?? 0))} y={16}
              width={Math.max(2, Math.abs(x(r.trap.end_ma ?? 0) - x(r.trap.start_ma ?? 0)))} height={10} rx={3}
              fill={ROLE_COLOR.reservoir.light}><title>trap {r.trap.start_ma}–{r.trap.end_ma} Ma</title></rect>}
          </svg>
        </div>
      ))}
      <p className="viz-note">
        Interval overlap, older left. This boolean <b>is</b> the timing chance factor consumed by Play Fairway —
        it is not re-derived there.
      </p>
    </div>
  );
}

// ═══ 6a · Common-risk matrix ═════════════════════════════════════════════════
const GRADE_COLOR = { evidenced: STATUS.good, partial: STATUS.warning, absent: STATUS.critical };

export function CommonRiskMap({ scope }: ChartProps) {
  const [rows, setRows] = useState<CrsRow[] | null>(null);
  const [sel, setSel] = useState<{ row: string; factor: string } | null>(null);
  const [table, setTable] = useState(false);
  useEffect(() => { crsMatrix(scope).then(setRows); }, [scope]);
  if (!rows) return <Loading what="element and event evidence per system" />;

  const detail = sel ? rows.find((r) => r.tpsId === sel.row)?.factors.find((f) => f.key === sel.factor) : null;
  if (table) {
    return (
      <div className="viz-host">
        <div className="viz-tools"><TableToggle open onToggle={() => setTable(false)} /></div>
        <DataTable head={['System', ...rows[0].factors.map((f) => f.label)]}
          rows={rows.map((r) => [r.name, ...r.factors.map((f) => f.grade)])} />
      </div>
    );
  }

  return (
    <Degrade n={rows.length} need={1} what="petroleum systems in scope">
      <div className="viz-host scroll">
        <div className="viz-tools"><TableToggle open={false} onToggle={() => setTable(true)} /></div>
        <div className="viz-crs">
          <span />
          {rows[0].factors.map((f) => <span key={f.key} className="viz-crs-col">{f.label}</span>)}
          {rows.map((r) => (
            <Fragment key={r.tpsId}>
              <span className="viz-crs-row" title={r.name}>{r.name}</span>
              {r.factors.map((f) => (
                <button key={`${r.tpsId}-${f.key}`} className={'viz-crs-cell' + (sel?.row === r.tpsId && sel?.factor === f.key ? ' on' : '')}
                  style={{ background: GRADE_COLOR[f.grade] }} title={`${f.label}: ${f.grade}\n${f.basis}`}
                  onClick={() => setSel({ row: r.tpsId, factor: f.key })}>
                  <i>{f.grade === 'evidenced' ? '●' : f.grade === 'partial' ? '◐' : '○'}</i>
                </button>
              ))}
            </Fragment>
          ))}
        </div>
        {detail && <div className="viz-crs-detail"><b>{detail.label} · {detail.grade}</b><p>{detail.basis}</p></div>}
        <Legend items={[
          { label: 'Evidenced', color: STATUS.good }, { label: 'Partial', color: STATUS.warning }, { label: 'Absent', color: STATUS.critical },
        ]} />
        <p className="viz-note">
          Evidence grade, <b>not</b> a probability — we decline to print a number the corpus cannot support.
          A gridded fairway needs AU polygons, which do not exist yet.
        </p>
      </div>
    </Degrade>
  );
}

// ═══ 6b · Chance-factor editor ═══════════════════════════════════════════════
const BASE = { charge: 0.5, reservoir: 0.6, seal: 0.5, trap: 0.6, timing: 0.7 };

export function ChanceFactorEditor({ scope }: ChartProps) {
  const [rows, setRows] = useState<CrsRow[] | null>(null);
  const [override, setOverride] = useState<Record<string, number>>({});
  useEffect(() => { crsMatrix(scope).then(setRows); }, [scope]);
  if (!rows) return <Loading what="chance factors" />;
  const row = rows[0];
  if (!row) return <Degrade n={0} need={1} what="systems in scope"><span /></Degrade>;

  // The evidence layer and the user layer are separate values, always. An
  // override never destroys what the corpus said.
  const evidenceValue = (grade: string, key: string) =>
    grade === 'evidenced' ? Math.min(0.9, BASE[key as keyof typeof BASE] + 0.2)
      : grade === 'partial' ? BASE[key as keyof typeof BASE] : Math.max(0.1, BASE[key as keyof typeof BASE] - 0.25);

  const gcos = row.factors.reduce((p, f) => p * (override[f.key] ?? evidenceValue(f.grade, f.key)), 1);

  return (
    <div className="viz-host scroll">
      <div className="viz-gcos"><span>GCoS</span><b>{(gcos * 100).toFixed(1)}%</b><em>product of five factors</em></div>
      {row.factors.map((f) => {
        const ev = evidenceValue(f.grade, f.key);
        const val = override[f.key] ?? ev;
        return (
          <div key={f.key} className="viz-factor">
            <div className="viz-factor-head">
              <b>{f.label}</b>
              <span style={{ color: GRADE_COLOR[f.grade] }}>{f.grade}</span>
              <em>{(val * 100).toFixed(0)}%</em>
            </div>
            <div className="viz-factor-track">
              <i className="ev" style={{ left: `${ev * 100}%` }} title={`evidence layer: ${(ev * 100).toFixed(0)}%`} />
              <input type="range" min={5} max={95} value={Math.round(val * 100)}
                onChange={(e) => setOverride({ ...override, [f.key]: Number(e.target.value) / 100 })} />
            </div>
            <small>{f.basis}</small>
          </div>
        );
      })}
      <p className="viz-note">The tick is the evidence layer; the slider is yours. Overrides are recorded beside the evidence, never on top of it.</p>
    </div>
  );
}

// ═══ 6c · Play calibration ═══════════════════════════════════════════════════
export function PlayCalibrationPanel() {
  const [pts, setPts] = useState<{ x: number; y: number; n: number; name: string }[] | null>(null);
  const [tip, setTip] = useState<TipData | null>(null);

  useEffect(() => {
    (async () => {
      const { provinceStats } = await import('../data');
      const stats = await provinceStats();
      setPts(stats
        .filter((s) => s.creamingReady >= 3 && s.boeMean > 0)
        .map((s) => ({
          // Predicted: how complete the evidence is. Observed: how much of the
          // total endowment has actually been found. A PROXY, and labelled one.
          x: Math.min(1, s.datedCount / Math.max(1, s.fieldCount)),
          y: s.discovered / (s.discovered + s.boeMean),
          n: s.creamingReady, name: s.name,
        })));
    })();
  }, []);

  if (!pts) return <Loading what="90 provinces with a discovery record" />;

  return (
    <Degrade n={pts.length} need={10} what="provinces with ≥3 dated discoveries">
      <div className="viz-host">
        <Plot minHeight={170}>{(box) => { const w = box.w, h = box.h; const x = scaleLinear().domain([0, 1]).range([34, w - 12]); const y = scaleLinear().domain([0, 1]).range([h - 22, 10]); return (<>
        <svg width={w} height={h} className="viz-scatter">
          <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} className="viz-parity" />
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={8} y2={h - 20} className="viz-grid vertical" />
              <text x={x(t)} y={h - 6} textAnchor="middle" className="viz-axis-text">{t}</text>
              <text x={26} y={y(t)} dy="0.32em" textAnchor="end" className="viz-axis-text">{t}</text>
            </g>
          ))}
          {pts.map((p) => (
            <circle key={p.name} cx={x(p.x)} cy={y(p.y)} r={3 + Math.min(5, p.n / 40)} className="viz-dot"
              onMouseEnter={(e) => setTip({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, title: p.name, rows: [['Evidence completeness', p.x.toFixed(2)], ['Discovered share (proxy)', p.y.toFixed(2)], ['Dated discoveries', String(p.n)]], grade: 'DERIVED' })}
              onMouseLeave={() => setTip(null)} />
          ))}
        </svg>
        <Tip tip={tip} host={box} />
        </>); }}</Plot>
        <p className="viz-note">
          x = evidence completeness · y = discovered ÷ (discovered + undiscovered mean), a <b>proxy</b> for outcome —
          we hold no dry-hole record, so this is not a drill-success rate. {fmtNum(pts.length)} provinces.
        </p>
      </div>
    </Degrade>
  );
}
