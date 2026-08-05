// Opportunity Evaluation — Register, Volumetrics, Ranking.
import { useEffect, useMemo, useState } from 'react';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { scaleLinear, scaleLog, scaleSqrt } from 'd3-scale';
import { bin, quantile } from 'd3-array';
import { useCanvas } from '../canvas-store';
import { useStore } from '../../../store';
import {
  discoveries, fieldSizes, fmtNum, loadFieldDetail, loadProvinceGeo, loadScopeFields, loadSpine,
  opportunities, provinceStats, resolveProvinceCode, crsMatrix, fmtCompact,
  type Opportunity, type ProvinceStat,
} from '../data';
import {
  DataTable, Degrade, Legend, Loading, Plot, TableToggle, Tip, useSize, VizDefs, type TipData,
} from '../../../viz/primitives';
import { pinColor, SEQUENTIAL_BLUE, STATUS } from '../../../viz/palette';
import type { ChartProps } from './types';

// ═══ 7a · Opportunity inventory ══════════════════════════════════════════════
export function OpportunityRegister({ scope }: ChartProps) {
  const [rows, setRows] = useState<Opportunity[] | null>(null);
  const [q, setQ] = useState('');
  const [onlyScope, setOnlyScope] = useState(true);
  const [table, setTable] = useState(false);
  const [spark, setSpark] = useState<Record<string, number[]>>({});

  useEffect(() => { opportunities().then(setRows); }, []);
  useEffect(() => {
    (async () => {
      const code = await resolveProvinceCode(scope);
      if (!code) return;
      const d = await discoveries(code);
      setSpark({ [scope]: d.map((x) => x.volume) });
    })();
  }, [scope]);

  if (!rows) return <Loading what="339 assessment units" />;
  const filtered = rows
    .filter((r) => (!onlyScope || r.provinceName === scope || rows.every((x) => x.provinceName !== scope)))
    .filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.tpsName.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.boeMean - a.boeMean);

  if (table) {
    return (
      <div className="viz-host">
        <div className="viz-tools"><TableToggle open onToggle={() => setTable(false)} /></div>
        <DataTable head={['Assessment unit', 'Province', 'Status', 'Oil MMBBL', 'Gas BCF', 'BOE mean', 'Chance']}
          rows={filtered.slice(0, 80).map((r) => [r.name, r.provinceName, r.status, Math.round(r.oilMean), Math.round(r.gasMean), Math.round(r.boeMean), r.chance.toFixed(2)])} />
      </div>
    );
  }

  const cream = spark[scope] ?? [];
  return (
    <div className="viz-host scroll">
      <div className="viz-tools"><TableToggle open={false} onToggle={() => setTable(true)} /></div>
      <div className="viz-register-bar">
        <input placeholder={`Filter ${fmtNum(rows.length)} opportunities`} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={onlyScope ? 'on' : ''} onClick={() => setOnlyScope((s) => !s)}>
          {onlyScope ? 'In scope' : 'All provinces'}
        </button>
        <span>{fmtNum(filtered.length)} shown</span>
      </div>
      <div className="viz-register">
        {filtered.slice(0, 60).map((r) => (
          <div key={r.auId} className="viz-reg-row">
            <div className="viz-reg-main">
              <b>{r.name}</b>
              <span>{r.tpsName} · {r.provinceName}</span>
            </div>
            <MiniSpark values={cream} />
            <div className="viz-reg-nums">
              <span>{fmtNum(r.boeMean)}<em>MMBOE</em></span>
              <span>{(r.chance * 100).toFixed(0)}<em>% chance</em></span>
            </div>
            {/* Two badges that can never merge into one legend series. */}
            <em className="viz-badge usgs">USGS STATISTICAL</em>
            <em className={'viz-badge status ' + (r.status === 'Assessed' ? 'on' : '')}>{r.status}</em>
          </div>
        ))}
      </div>
      <p className="viz-note">
        Seeded from USGS assessment units — statistical opportunities, <b>not mapped prospects</b>. User-authored
        prospects will appear beside these as a separate series and never pool with them.
      </p>
    </div>
  );
}

function MiniSpark({ values }: { values: number[] }) {
  if (values.length < 3) return <span className="viz-reg-spark thin">n={values.length}</span>;
  const sorted = [...values];
  const max = Math.max(...sorted);
  let cum = 0;
  const pts = sorted.map((v, i) => { cum += v; return `${(i / (sorted.length - 1)) * 46},${16 - (cum / sorted.reduce((a, b) => a + b, 0)) * 14}`; });
  return (
    <svg className="viz-reg-spark" width={48} height={18} aria-label={`creaming curve, n=${values.length}, max ${max.toFixed(0)} MMBOE`}>
      <polyline points={pts.join(' ')} />
    </svg>
  );
}

// ═══ 7b · Opportunity map ════════════════════════════════════════════════════
export function OpportunityMap({ scope }: ChartProps) {
  const [geo, setGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [pts, setPts] = useState<{ lon: number; lat: number; name: string }[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [tip, setTip] = useState<TipData | null>(null);
  const pins = useCanvas((s) => s.pins);

  useEffect(() => { loadProvinceGeo().then(setGeo); resolveProvinceCode(scope).then(setCode); }, [scope]);
  const target = pins[0]?.id ?? code;
  useEffect(() => {
    if (!target) return;
    loadScopeFields().then((s) => setPts((s.provinces[target] ?? []).map((f) => ({ lon: f.fly.lon, lat: f.fly.lat, name: f.name }))));
  }, [target]);

  const feature = useMemo(() => geo?.features.find((f) => (f.properties as { prvCode: string })?.prvCode === target), [geo, target]);

  if (!geo) return <Loading what="province geometry" />;
  if (!feature) return <Degrade n={0} need={1} what="mapped province"><span /></Degrade>;

  return (
    <div className="viz-host">
      <Plot minHeight={150}>{(size) => {
        const projection = geoEquirectangular()
          .fitExtent([[12, 12], [Math.max(24, size.w - 12), Math.max(24, size.h - 12)]], feature);
        const path = geoPath(projection);
        return (<>
      <svg width={size.w} height={size.h} className="viz-map">
        <VizDefs />
        <path d={path(feature) ?? undefined} className="viz-prov focus" />
        <g className="viz-points solid">
          {pts.map((p, i) => {
            const xy = projection([p.lon, p.lat]);
            if (!xy) return null;
            return <circle key={i} cx={xy[0]} cy={xy[1]} r={2.4}
              onMouseEnter={(e) => setTip({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, title: p.name, rows: [['Kind', 'discovered field']], grade: 'SOURCED' })}
              onMouseLeave={() => setTip(null)} />;
          })}
        </g>
      </svg>
      <Tip tip={tip} host={size} />
      </>); }}</Plot>
      <p className="viz-note">Discovered fields only — no prospect or AU geometry exists in the corpus, so nothing is drawn that would imply one.</p>
    </div>
  );
}

// ═══ 7c · Maturity gate ══════════════════════════════════════════════════════
export function OpportunityGateTracker({ scope }: ChartProps) {
  const [checks, setChecks] = useState<{ stage: string; label: string; ok: boolean; why: string }[] | null>(null);

  useEffect(() => {
    (async () => {
      const [spine, crs, code] = await Promise.all([loadSpine(), crsMatrix(scope), resolveProvinceCode(scope)]);
      const completion = spine.basinCompletion.find((b) => b.province_code === code);
      const row = crs[0];
      const evidenced = row ? row.factors.filter((f) => f.grade === 'evidenced').length : 0;
      setChecks([
        { stage: 'Lead', label: 'Basin framework exists', ok: (completion?.cycle_count ?? 0) > 0, why: `${completion?.cycle_count ?? 0} cycles` },
        { stage: 'Lead', label: 'Petroleum system identified', ok: (completion?.tps_count ?? 0) > 0, why: `${completion?.tps_count ?? 0} systems` },
        { stage: 'Prospect', label: 'Charge timing established', ok: evidenced >= 1, why: `${evidenced}/5 factors evidenced` },
        { stage: 'Prospect', label: 'All five CRS factors scored', ok: evidenced >= 4, why: `${evidenced}/5 evidenced` },
        { stage: 'Prospect', label: 'Trap geometry mapped', ok: false, why: 'no closure geometry in the corpus' },
        { stage: 'Drill/drop', label: 'Volumetric case built', ok: false, why: 'requires user geometry' },
        { stage: 'Drill/drop', label: 'Cost basis agreed', ok: false, why: 'no cost data — gap G8' },
      ]);
    })();
  }, [scope]);

  if (!checks) return <Loading what="the evidence ledger" />;
  const stages = ['Lead', 'Prospect', 'Drill/drop'];
  return (
    <div className="viz-host scroll">
      {stages.map((s) => {
        const items = checks.filter((c) => c.stage === s);
        const done = items.filter((i) => i.ok).length;
        return (
          <div key={s} className="viz-gate">
            <div className="viz-gate-head">
              <b>{s}</b>
              <i style={{ background: done === items.length ? STATUS.good : done ? STATUS.warning : 'var(--line)' }} />
              <em>{done}/{items.length}</em>
            </div>
            {items.map((c) => (
              <div key={c.label} className={'viz-gate-item' + (c.ok ? ' ok' : '')}>
                <i>{c.ok ? '✓' : '○'}</i><b>{c.label}</b><span>{c.why}</span>
              </div>
            ))}
          </div>
        );
      })}
      <p className="viz-note">Ticked from evidence that actually exists — nothing here is self-reported.</p>
    </div>
  );
}

// ═══ 8a · Empirical field-size distribution ══════════════════════════════════
export function ResourceDistributionViewer({ scope }: ChartProps) {
  const [sizes, setSizes] = useState<number[] | null>(null);
  const [world, setWorld] = useState<number[]>([]);
  const [classes, setClasses] = useState<{ label: string; n: number; basis: string }[]>([]);
  const [tip, setTip] = useState<TipData | null>(null);
  const [table, setTable] = useState(false);
  const pins = useCanvas((s) => s.pins);
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => { resolveProvinceCode(scope).then(setCode); fieldSizes(null).then(setWorld); }, [scope]);
  const target = pins[0]?.id ?? code;
  useEffect(() => { if (target) fieldSizes(target).then(setSizes); }, [target]);

  useEffect(() => {
    loadFieldDetail().then((detail) => {
      // 170+ free-text classes. In-place is held apart from recoverable, always.
      const buckets: Record<string, number> = {};
      Object.values(detail).forEach((d) => (d.reserves ?? []).forEach((r) => {
        const raw = (r.classification ?? 'unstated').toLowerCase();
        const key = /place|stoiip|oiip|giip|geological/.test(raw) ? 'In-place'
          : /2p|2c|best|mean|expected/.test(raw) ? 'Central recoverable'
            : /1p|proven|proved|low/.test(raw) ? 'Low recoverable'
              : /3p|3c|high|potential|prospective/.test(raw) ? 'High recoverable'
                : 'Unclassified';
        buckets[key] = (buckets[key] ?? 0) + 1;
      }));
      setClasses(Object.entries(buckets).sort((a, b) => b[1] - a[1])
        .map(([label, n]) => ({ label, n, basis: 'raw GOGET classification string' })));
    });
  }, []);

  if (!sizes) return <Loading what="3,861 field volumes" />;
  const sorted = [...sizes].sort((a, b) => a - b);

  if (table) {
    return (
      <div className="viz-host">
        <div className="viz-tools"><TableToggle open onToggle={() => setTable(false)} /></div>
        <DataTable head={['Percentile', 'MMBOE']}
          rows={[0.1, 0.25, 0.5, 0.75, 0.9, 0.99].map((q) => [`P${Math.round((1 - q) * 100)}`, Math.round(quantile(sorted, q) ?? 0)])} />
      </div>
    );
  }

  return (
    <Degrade n={sorted.length} need={5} what="fields with a reported volume"
      alt={<span className="viz-note">World distribution stays available as the fallback prior — {fmtNum(world.length)} fields.</span>}>
      <div className="viz-host">
        <div className="viz-tools"><TableToggle open={false} onToggle={() => setTable(true)} /></div>
        <Plot minHeight={180}>{(size) => (<>
          <Histogram sizes={sorted} world={world} size={size} onTip={setTip} />
          <Tip tip={tip} host={size} />
        </>)}</Plot>
        <div className="viz-classmix">
          {classes.map((c) => (
            <i key={c.label} style={{ flexGrow: c.n }} className={c.label === 'In-place' ? 'inplace' : ''}
              title={`${c.label}: ${fmtNum(c.n)} reported volumes — ${c.basis}`} />
          ))}
        </div>
        <Legend items={[
          { label: 'This scope', color: SEQUENTIAL_BLUE[4] },
          { label: 'World (3,861)', color: 'var(--ink3)' },
        ]} />
        <p className="viz-note">
          Log-x, MMBOE. The strip beneath is the reserve-class mix — <b>in-place is never pooled with recoverable</b>
          ({fmtNum(classes.find((c) => c.label === 'In-place')?.n ?? 0)} in-place volumes across 170+ raw class strings).
        </p>
      </div>
    </Degrade>
  );
}

function Histogram({ sizes, world, size, onTip }: {
  sizes: number[]; world: number[]; size: { w: number; h: number }; onTip: (t: TipData | null) => void;
}) {
  const h = Math.max(90, size.h), w = Math.max(60, size.w);
  const lo = Math.max(0.05, sizes[0] ?? 0.05), hi = sizes[sizes.length - 1] || 1;
  const x = scaleLog().domain([lo, hi]).range([32, w - 8]).clamp(true);
  const thresholds = x.ticks(14);
  const bins = bin<number, number>().domain([lo, hi]).thresholds(thresholds)(sizes);
  const wbins = world.length ? bin<number, number>().domain([lo, hi]).thresholds(thresholds)(world.filter((v) => v >= lo && v <= hi)) : [];
  const maxB = Math.max(1, ...bins.map((b) => b.length));
  const maxW = Math.max(1, ...wbins.map((b) => b.length));
  const y = scaleLinear().domain([0, maxB]).range([h - 20, 8]);
  const yw = scaleLinear().domain([0, maxW]).range([h - 20, 8]);
  const cdf = scaleLinear().domain([0, 1]).range([h - 20, 8]);
  const marks: [string, number][] = [['P90', quantile(sizes, 0.1) ?? 0], ['P50', quantile(sizes, 0.5) ?? 0], ['P10', quantile(sizes, 0.9) ?? 0]];

  return (
    <svg width={w} height={h} className="viz-hist">
      <VizDefs />
      {/* World ghost first, so the scope reads on top of its own context. */}
      {wbins.map((b, i) => (
        <rect key={`w${i}`} x={x(b.x0 ?? lo) + 1} width={Math.max(1, x(b.x1 ?? hi) - x(b.x0 ?? lo) - 2)}
          y={yw(b.length)} height={Math.max(0, h - 20 - yw(b.length))} className="viz-hist-world" />
      ))}
      {bins.map((b, i) => (
        <rect key={i} x={x(b.x0 ?? lo) + 1} width={Math.max(1, x(b.x1 ?? hi) - x(b.x0 ?? lo) - 2)}
          y={y(b.length)} height={Math.max(0, h - 20 - y(b.length))} rx={3} className="viz-hist-bar"
          onMouseEnter={(e) => onTip({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, title: `${(b.x0 ?? 0).toFixed(1)}–${(b.x1 ?? 0).toFixed(1)} MMBOE`, rows: [['Fields', String(b.length)], ['Share', `${((b.length / sizes.length) * 100).toFixed(1)}%`]], grade: 'SOURCED' })}
          onMouseLeave={() => onTip(null)} />
      ))}
      <polyline className="viz-cdf" points={sizes.map((v, i) => `${x(Math.max(lo, v))},${cdf(i / (sizes.length - 1 || 1))}`).join(' ')} />
      {marks.map(([label, v]) => v > 0 && (
        <g key={label} className="viz-pmark">
          <line x1={x(v)} x2={x(v)} y1={8} y2={h - 20} />
          <text x={x(v)} y={6} textAnchor="middle">{label} {v.toFixed(v < 10 ? 1 : 0)}</text>
        </g>
      ))}
      {x.ticks(5).map((t) => <text key={t} x={x(t)} y={h - 5} textAnchor="middle" className="viz-axis-text">{t < 1 ? t.toFixed(1) : fmtNum(t)}</text>)}
    </svg>
  );
}

// ═══ 8b · Volumetric input deck ══════════════════════════════════════════════
const PARAMS = [
  { key: 'area', label: 'Area', unit: 'km²', p90: 4, p50: 12, p10: 30, origin: 'user' },
  { key: 'thick', label: 'Net thickness', unit: 'm', p90: 8, p50: 22, p10: 48, origin: 'analog' },
  { key: 'ntg', label: 'Net-to-gross', unit: 'frac', p90: 0.45, p50: 0.65, p10: 0.85, origin: 'analog' },
  { key: 'phi', label: 'Porosity', unit: 'frac', p90: 0.14, p50: 0.2, p10: 0.26, origin: 'volve' },
  { key: 'sw', label: 'Water saturation', unit: 'frac', p90: 0.2, p50: 0.3, p10: 0.45, origin: 'volve' },
  { key: 'fvf', label: 'FVF', unit: 'rb/stb', p90: 1.15, p50: 1.28, p10: 1.42, origin: 'analog' },
  { key: 'rf', label: 'Recovery factor', unit: 'frac', p90: 0.18, p50: 0.32, p10: 0.48, origin: 'analog' },
];
const ORIGIN_LABEL: Record<string, string> = { user: 'USER', analog: 'ANALOG PRIOR', volve: 'VOLVE ONLY' };

export function VolumetricInputDeck() {
  const [vals, setVals] = useState(PARAMS);
  const stoiip = (pick: 'p90' | 'p50' | 'p10') => {
    const g = (k: string) => vals.find((v) => v.key === k)?.[pick] ?? 0;
    return (g('area') * 1e6 * g('thick') * g('ntg') * g('phi') * (1 - g('sw'))) / g('fvf') / 1.589873e5 * g('rf');
  };
  return (
    <div className="viz-host scroll">
      <div className="viz-deck-head"><span>Parameter</span><span>P90</span><span>P50</span><span>P10</span><span>Origin</span></div>
      {vals.map((p, i) => (
        <div key={p.key} className="viz-deck-row">
          <b>{p.label}<em>{p.unit}</em></b>
          {(['p90', 'p50', 'p10'] as const).map((k) => (
            <input key={k} type="number" step={p.p50 < 2 ? 0.01 : 1} value={p[k]}
              onChange={(e) => setVals(vals.map((v, j) => j === i ? { ...v, [k]: Number(e.target.value) } : v))} />
          ))}
          {/* Every row declares where its number came from. Volve-only rows are
              the honest ones: those parameters exist for exactly one field. */}
          <em className={'viz-origin ' + p.origin}>{ORIGIN_LABEL[p.origin]}</em>
        </div>
      ))}
      <div className="viz-deck-out">
        {(['p90', 'p50', 'p10'] as const).map((k) => (
          <div key={k}><span>{k.toUpperCase()}</span><b>{fmtNum(stoiip(k), 1)}</b><em>MMBBL recoverable</em></div>
        ))}
      </div>
      <p className="viz-note">Deterministic pass. φ and Sw exist for Volve only — everywhere else they are analogue priors or your own numbers.</p>
    </div>
  );
}

// ═══ 8c · Risk and value bridge ══════════════════════════════════════════════
export function RiskValueBridge({ scope }: ChartProps) {
  const [ref, size] = useSize<HTMLDivElement>();
  const [unitCost, setUnitCost] = useState(9);
  const [price, setPrice] = useState(65);
  const [gcos, setGcos] = useState(0.18);
  useEffect(() => {
    crsMatrix(scope).then((rows) => {
      const r = rows[0];
      if (r) setGcos(Math.max(0.04, r.factors.filter((f) => f.grade === 'evidenced').length / 5 * 0.45));
    });
  }, [scope]);

  const volume = 120;
  const wellCost = 55;
  const value = volume * (price - unitCost);
  const emv = gcos * value - (1 - gcos) * wellCost;
  const tornado = [
    { k: 'Chance of success', lo: gcos * 0.5, hi: gcos * 1.5, base: gcos, fmt: (v: number) => `${(v * 100).toFixed(0)}%` },
    { k: 'Unit cost (assumed)', lo: unitCost * 1.6, hi: unitCost * 0.6, base: unitCost, fmt: (v: number) => `$${v.toFixed(0)}/boe` },
    { k: 'Price', lo: price * 0.7, hi: price * 1.3, base: price, fmt: (v: number) => `$${v.toFixed(0)}` },
    { k: 'Well cost', lo: wellCost * 1.5, hi: wellCost * 0.7, base: wellCost, fmt: (v: number) => `$${v.toFixed(0)}m` },
  ].map((t) => {
    const at = (over: Partial<Record<string, number>>) => {
      const g = over.gcos ?? gcos, u = over.unitCost ?? unitCost, p = over.price ?? price, w = over.wellCost ?? wellCost;
      return g * volume * (p - u) - (1 - g) * w;
    };
    const key = t.k.startsWith('Chance') ? 'gcos' : t.k.startsWith('Unit') ? 'unitCost' : t.k.startsWith('Price') ? 'price' : 'wellCost';
    return { ...t, emvLo: at({ [key]: t.lo }), emvHi: at({ [key]: t.hi }) };
  }).sort((a, b) => Math.abs(b.emvHi - b.emvLo) - Math.abs(a.emvHi - a.emvLo));

  const span = Math.max(...tornado.map((t) => Math.max(Math.abs(t.emvHi - emv), Math.abs(t.emvLo - emv)))) || 1;
  const x = scaleLinear().domain([-span, span]).range([8, Math.max(20, size.w - 8)]);

  return (
    <div className="viz-host scroll" ref={ref}>
      <div className="viz-user-banner amber">
        <b>ASSUMPTION</b>
        <span>No cost data exists in the corpus. Unit cost and well cost are sliders, and every number below inherits that.</span>
      </div>
      <div className="viz-emv"><span>EMV</span><b style={{ color: emv >= 0 ? STATUS.good : STATUS.critical }}>${emv.toFixed(0)}m</b><em>GCoS {(gcos * 100).toFixed(0)}%</em></div>
      <label className="viz-slider">Unit cost <b>${unitCost}/boe</b><input type="range" min={3} max={30} value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value))} /></label>
      <label className="viz-slider">Price <b>${price}/bbl</b><input type="range" min={30} max={120} value={price} onChange={(e) => setPrice(Number(e.target.value))} /></label>
      <svg width={size.w} height={tornado.length * 26 + 8} className="viz-tornado">
        <line x1={x(0)} x2={x(0)} y1={0} y2={tornado.length * 26} className="viz-parity" />
        {tornado.map((t, i) => {
          const a = x(t.emvLo - emv), b = x(t.emvHi - emv);
          return (
            <g key={t.k} transform={`translate(0,${i * 26})`}>
              <rect x={Math.min(a, b)} y={5} width={Math.max(2, Math.abs(b - a))} height={13} rx={3}
                fill={t.k.includes('assumed') ? STATUS.warning : SEQUENTIAL_BLUE[4]} opacity={0.85}>
                <title>{t.k}: {t.fmt(t.lo)} → {t.fmt(t.hi)} swings EMV ${(t.emvLo).toFixed(0)}m → ${(t.emvHi).toFixed(0)}m</title>
              </rect>
              <text x={x(0) + 5} y={12} dy="0.32em" className="viz-row-label">{t.k}</text>
            </g>
          );
        })}
      </svg>
      <p className="viz-note">Tornado ordered by EMV swing. The amber bar is the assumed input — if it dominates, the decision is about the assumption, not the geology.</p>
    </div>
  );
}

// ═══ 9a · Opportunity ranking ════════════════════════════════════════════════
export function OpportunityRanking({ scope }: ChartProps) {
  const [rows, setRows] = useState<Opportunity[] | null>(null);
  const [stats, setStats] = useState<ProvinceStat[] | null>(null);
  const [tip, setTip] = useState<TipData | null>(null);
  const [table, setTable] = useState(false);
  const [brush, setBrush] = useState<string | null>(null);
  const dark = useStore((s) => s.theme) === 'dark';

  useEffect(() => { opportunities().then(setRows); provinceStats().then(setStats); }, []);
  if (!rows || !stats) return <Loading what="339 opportunities and their parent provinces" />;

  // The evidence-derived chance score was tried on x and abandoned: across all
  // 339 units it produces SIX distinct values in a 0.44–0.54 band, because
  // element effectiveness is `not-assessed` almost everywhere. An axis that does
  // not vary is a decoration. Exploration maturity does vary, and asks the
  // question that matters: where is the prize still un-hunted?
  const statByName = new Map(stats.map((s) => [s.name, s]));
  const live = rows.filter((r) => r.boeMean > 0).map((r) => {
    const st = statByName.get(r.provinceName);
    const found = st?.discovered ?? 0;
    return { ...r, maturity: found + r.boeMean > 0 ? found / (found + r.boeMean) : 0, fields: st?.fieldCount ?? 0 };
  });

  if (table) {
    return (
      <div className="viz-host">
        <div className="viz-tools"><TableToggle open onToggle={() => setTable(false)} /></div>
        <DataTable head={['Opportunity', 'Province', 'Undiscovered MMBOE', 'Province maturity', 'Chance', 'Risked BOE']}
          rows={[...live].sort((a, b) => b.boeMean * b.chance - a.boeMean * a.chance).slice(0, 60)
            .map((r) => [r.name, r.provinceName, Math.round(r.boeMean), `${(r.maturity * 100).toFixed(0)}%`, r.chance.toFixed(2), Math.round(r.boeMean * r.chance)])} />
      </div>
    );
  }

  const medX = quantile(live.map((r) => r.maturity).sort((a, b) => a - b), 0.5) ?? 0.5;
  const medY = quantile(live.map((r) => r.boeMean).sort((a, b) => a - b), 0.5) ?? 1;
  const rad = scaleSqrt().domain([0, Math.max(1, ...live.map((r) => r.fields))]).range([2.5, 11]);

  return (
    <div className="viz-host">
      <div className="viz-tools"><TableToggle open={false} onToggle={() => setTable(true)} /></div>
      <Plot minHeight={200}>{(box) => { const w = box.w, h = box.h;
        const x = scaleLinear().domain([0, 1]).range([40, w - 14]);
        const y = scaleLog().domain([Math.max(0.5, Math.min(...live.map((r) => r.boeMean))), Math.max(...live.map((r) => r.boeMean))]).range([h - 26, 14]).clamp(true);
        return (<>
      <svg width={w} height={h} className="viz-scatter">
        <VizDefs />
        <line x1={x(medX)} x2={x(medX)} y1={12} y2={h - 24} className="viz-median" />
        <line x1={40} x2={w - 14} y1={y(medY)} y2={y(medY)} className="viz-median" />
        <text x={44} y={24} className="viz-quad">big prize · lightly explored</text>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <text key={t} x={x(t)} y={h - 8} textAnchor="middle" className="viz-axis-text">{Math.round(t * 100)}%</text>
        ))}
        {y.ticks(4).map((t) => (
          <g key={t}>
            <line x1={40} x2={w - 14} y1={y(t)} y2={y(t)} className="viz-grid" />
            <text x={36} y={y(t)} dy="0.32em" textAnchor="end" className="viz-axis-text">{fmtCompact(t)}</text>
          </g>
        ))}
        {live.map((r) => {
          const inScope = r.provinceName === scope;
          return (
            <circle key={r.auId} cx={x(r.maturity)} cy={y(r.boeMean)} r={inScope ? rad(r.fields) + 2 : rad(r.fields)}
              className={'viz-dot' + (inScope ? ' focus' : '')}
              fill={inScope ? pinColor(0, dark) : undefined}
              onMouseEnter={(e) => { setBrush(r.name); setTip({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, title: r.name, rows: [['Province', r.provinceName], ['Undiscovered', `${fmtNum(r.boeMean)} MMBOE`], ['Province maturity', `${(r.maturity * 100).toFixed(0)}% found`], ['Parent fields', fmtNum(r.fields)]], grade: 'DERIVED' }); }}
              onMouseLeave={() => setTip(null)} />
          );
        })}
      </svg>
      <Tip tip={tip} host={box} />
      </>); }}</Plot>
      <p className="viz-note">
        x = parent-province maturity (discovered ÷ discovered + undiscovered) · y = AU undiscovered mean, log ·
        bubble = fields already found there. <b>Chance is not an axis</b>: the corpus yields only 6 distinct
        chance values across 339 units, so plotting it would imply a precision we do not have.
        {brush ? ` ${brush}.` : ` ${fmtNum(live.length)} opportunities, ${fmtNum(live.filter((r) => r.provinceName === scope).length)} in scope.`}
      </p>
    </div>
  );
}

// ═══ 9b · Portfolio scenarios ════════════════════════════════════════════════
export function ExplorationPortfolioScenarios({ scope }: ChartProps) {
  const [rows, setRows] = useState<Opportunity[] | null>(null);
  const [capital, setCapital] = useState(400);
  useEffect(() => { opportunities().then(setRows); }, []);
  if (!rows) return <Loading what="the opportunity set" />;

  const wellCost = 55;
  const ranked = [...rows].filter((r) => r.boeMean > 0)
    .map((r) => ({ ...r, risked: r.boeMean * r.chance, cost: wellCost }))
    .sort((a, b) => b.risked / b.cost - a.risked / a.cost);

  let spent = 0;
  const chosen = ranked.filter((r) => { if (spent + r.cost <= capital) { spent += r.cost; return true; } return false; });
  const frontier = Array.from({ length: 18 }, (_, i) => {
    const cap = (i + 1) * 60;
    let s = 0, v = 0;
    ranked.forEach((r) => { if (s + r.cost <= cap) { s += r.cost; v += r.risked; } });
    return { cap, v };
  });


  return (
    <div className="viz-host scroll">
      <div className="viz-user-banner amber"><b>SCENARIO</b><span>Assumed unit cost; opportunities treated as independent because no dependency or correlation data exists.</span></div>
      <label className="viz-slider">Capital <b>${capital}m</b><input type="range" min={60} max={1080} step={20} value={capital} onChange={(e) => setCapital(Number(e.target.value))} /></label>
      <Plot minHeight={130}>{(box) => { const w = box.w, h = box.h;
        const x = scaleLinear().domain([0, 1080]).range([34, w - 12]);
        const y = scaleLinear().domain([0, Math.max(...frontier.map((f) => f.v)) || 1]).range([h - 20, 10]);
        return (
      <svg width={w} height={h} className="viz-scatter">
        <polyline className="viz-frontier" points={frontier.map((f) => `${x(f.cap)},${y(f.v)}`).join(' ')} />
        {frontier.map((f) => <circle key={f.cap} cx={x(f.cap)} cy={y(f.v)} r={2.6} className="viz-dot"><title>${f.cap}m → {fmtNum(f.v)} MMBOE risked</title></circle>)}
        <line x1={x(capital)} x2={x(capital)} y1={8} y2={h - 18} className="viz-median" />
        {[0, 300, 600, 900].map((t) => <text key={t} x={x(t)} y={h - 5} textAnchor="middle" className="viz-axis-text">${t}m</text>)}
      </svg>); }}</Plot>
      <div className="viz-scenario">
        <div><span>Wells</span><b>{chosen.length}</b></div>
        <div><span>Committed</span><b>${spent}m</b></div>
        <div><span>Risked volume</span><b>{fmtNum(chosen.reduce((t, r) => t + r.risked, 0))}</b><em>MMBOE</em></div>
        <div><span>In scope</span><b>{chosen.filter((c) => c.provinceName === scope).length}</b></div>
      </div>
    </div>
  );
}

// ═══ 9c · Drill/drop record ══════════════════════════════════════════════════
export function DrillDropDecisionRecord({ scope }: ChartProps) {
  const pins = useCanvas((s) => s.pins);
  const facets = useCanvas((s) => s.facets);
  const artifacts = useCanvas((s) => s.artifacts);
  const list = Object.values(artifacts);

  return (
    <div className="viz-host scroll">
      <div className="viz-memo">
        <header>
          <b>Drill / drop record</b>
          <em>{list.length}/9 artifacts settled</em>
        </header>
        <dl>
          <div><dt>Scope</dt><dd>{scope}</dd></div>
          <div><dt>Pinned</dt><dd>{pins.length ? pins.map((p) => p.name).join(' · ') : 'none — world frame'}</dd></div>
          <div><dt>Facets</dt><dd>{Object.keys(facets).length ? Object.entries(facets).map(([k, v]) => `${k}: ${v.join('/')}`).join(' · ') : 'none applied'}</dd></div>
          <div><dt>Weakest input</dt><dd>{list.some((a) => a.provenance === 'USER') ? 'USER — an assumed cost basis is in the chain'
            : list.some((a) => a.provenance === 'RECALLED') ? 'RECALLED — the basin framework is unverified'
              : list.length ? 'DERIVED' : 'no run yet'}</dd></div>
        </dl>
        {list.length === 0 ? (
          <p className="viz-memo-empty">Run the study to populate the lineage. A decision record with no artifact chain is not a record.</p>
        ) : (
          <ol className="viz-memo-chain">
            {list.map((a) => (
              <li key={a.stageId}>
                <b>{a.name}</b>
                <em className={a.provenance.toLowerCase()}>{a.provenance} n={fmtNum(a.n)}</em>
                <span>{a.inputs.length ? `consumes ${a.inputs.length}` : 'root'}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <p className="viz-note">Immutable once approved. Captures scope, pins, facets and the provenance grade of every upstream artifact.</p>
    </div>
  );
}
