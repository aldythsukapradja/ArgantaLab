// Basin Intelligence — Atlas, Framework, Analogs. Nine live widgets.
import { useEffect, useMemo, useState } from 'react';
import { geoEquirectangular, geoPath, geoContains } from 'd3-geo';
import { scaleLinear, scaleSqrt } from 'd3-scale';
import { extent, quantile } from 'd3-array';
import { useCanvas } from '../canvas-store';
import { useStore } from '../../../store';
import {
  cyclesFor, fmtNum, loadProvinceGeo, loadSpine, loadTowers, provinceStats, rankAnalogs,
  resolveProvinceCode, signatures, discoveries, fieldSizes,
  type AnalogMatch, type CycleRec, type ProvinceStat, type Signature, type CompletionRec,
} from '../data';
import {
  AxisY, DataTable, Degrade, Legend, Loading, Plot, TableToggle, Tip, VizDefs, type TipData,
} from '../../../viz/primitives';
import { GEODYNAMIC_CLASS, GEODYNAMIC_COLOR, pinColor, SEQUENTIAL_BLUE } from '../../../viz/palette';
import type { ChartProps } from './types';


/** Fit a projection to the data's own extent, then report the height that extent
 *  actually needs. Fitting to the box letterboxes a world map inside a tall card
 *  and leaves a dead band above and below it; fitting to the aspect does not. */
function fitMap(geo: GeoJSON.FeatureCollection, size: { w: number; h: number }) {
  const pad = 6;
  const wide = geoEquirectangular().fitWidth(Math.max(20, size.w - pad * 2), geo);
  const bounds = geoPath(wide).bounds(geo);
  const needed = bounds[1][1] - bounds[0][1] + pad * 2;
  if (needed <= size.h) {
    const projection = geoEquirectangular()
      .fitExtent([[pad, pad], [size.w - pad, needed - pad]], geo);
    return { projection, path: geoPath(projection), h: Math.max(60, needed) };
  }
  const projection = geoEquirectangular()
    .fitExtent([[pad, pad], [size.w - pad, size.h - pad]], geo);
  return { projection, path: geoPath(projection), h: size.h };
}

// ═══ 1a · Global basin position ══════════════════════════════════════════════
export function BasinBenchmarkMap({ scope }: ChartProps) {
  const [geo, setGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [stats, setStats] = useState<ProvinceStat[] | null>(null);
  const [points, setPoints] = useState<{ lon: number; lat: number; v: number; name: string }[]>([]);
  const [tip, setTip] = useState<TipData | null>(null);
  const [table, setTable] = useState(false);
  const pins = useCanvas((s) => s.pins);
  const togglePin = useCanvas((s) => s.togglePin);
  const dark = useStore((s) => s.theme) === 'dark';

  useEffect(() => {
    loadProvinceGeo().then(setGeo);
    provinceStats().then(setStats);
    loadTowers().then((t) => setPoints(t
      .filter((x) => x.total && x.lon != null)
      .map((x) => ({ lon: x.lon, lat: x.lat, v: x.total ?? 0, name: x.name }))));
  }, []);

  // Scales that do not depend on the box stay memoised out here; the projection
  // has to be built from the MEASURED plot, or hit-testing lands on the wrong
  // province — the map would look fine and lie on hover.
  const { color, radius } = useMemo(() => {
    const boes = (stats ?? []).map((s) => s.boeMean).filter((v) => v > 0).sort((a, b) => a - b);
    const stops = [0, 0.2, 0.4, 0.6, 0.8, 1].map((q) => quantile(boes, q) ?? 0);
    return {
      // Sequential = ONE hue, light→dark. Quantile stops so the long tail of
      // giant provinces cannot flatten everything else into the first step.
      color: scaleLinear<string>().domain(stops).range([...SEQUENTIAL_BLUE]).clamp(true),
      radius: scaleSqrt().domain([0, quantile(points.map((p) => p.v).sort((a, b) => a - b), 0.99) ?? 1]).range([0.8, 7]).clamp(true),
    };
  }, [stats, points]);

  const statByCode = useMemo(() => new Map((stats ?? []).map((s) => [s.code, s])), [stats]);
  const pinnedCodes = useMemo(() => new Map(pins.map((p) => [p.id, p.slot])), [pins]);

  if (!geo || !stats) return <Loading what="179 province polygons and 3,861 field volumes" />;

  if (table) {
    const rows = [...stats].sort((a, b) => b.boeMean - a.boeMean).slice(0, 40)
      .map((s) => [s.name, Math.round(s.boeMean), s.fieldCount, s.creamingReady, Math.round(s.discovered)]);
    return (
      <div className="viz-host">
        <div className="viz-tools"><TableToggle open onToggle={() => setTable(false)} /></div>
        <DataTable head={['Province', 'Undiscovered MMBOE', 'Fields', 'Creaming-ready', 'Discovered MMBOE']} rows={rows} />
      </div>
    );
  }

  return (
    <div className="viz-host">
      <div className="viz-tools"><TableToggle open={false} onToggle={() => setTable(true)} /></div>
      <Plot minHeight={190}>{(size) => {
        // Fit to where the DATA is, not to the whole globe: a sphere fit spends
        // the panel on empty Pacific and polar ocean and leaves the provinces as
        // specks. Then size the SVG to the map's own aspect rather than the box,
        // so the leftover goes to the page instead of becoming a dead band
        // inside the card.
        const { projection, path, h } = fitMap(geo, size);
        const at = (e: React.MouseEvent<SVGSVGElement>) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left, y = e.clientY - rect.top;
          const ll = projection.invert?.([x, y]);
          return { x, y, hit: ll ? geo.features.find((f) => geoContains(f, ll)) : undefined };
        };
        const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
          const { x, y, hit } = at(e);
          if (!hit) return setTip(null);
          const p = hit.properties as { prvCode: string; prvName: string };
          const s = statByCode.get(p.prvCode);
          setTip({
            x, y, title: p.prvName,
            rows: [
              ['Undiscovered', `${fmtNum(s?.boeMean ?? 0)} MMBOE`],
              ['Fields', fmtNum(s?.fieldCount ?? 0)],
              ['Creaming-ready', `${s?.creamingReady ?? 0}`],
              ['Discovered', `${fmtNum(s?.discovered ?? 0)} MMBOE`],
            ],
            grade: 'SOURCED',
          });
        };
        const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
          const { hit } = at(e);
          if (!hit) return;
          const p = hit.properties as { prvCode: string; prvName: string };
          togglePin({ id: p.prvCode, name: p.prvName, fieldCount: statByCode.get(p.prvCode)?.fieldCount });
        };
        return (<>
      <svg width={size.w} height={h} onMouseMove={onMove} onMouseLeave={() => setTip(null)} onClick={onClick} className="viz-map">
        <VizDefs />
        {geo.features.map((f) => {
          const p = f.properties as { prvCode: string; prvName: string; boeMean: number };
          const slot = pinnedCodes.get(p.prvCode);
          return (
            <path
              key={p.prvCode}
              d={path(f) ?? undefined}
              fill={slot !== undefined ? pinColor(slot, dark) : color(p.boeMean ?? 0)}
              className={'viz-prov' + (slot !== undefined ? ' pinned' : '')}
            />
          );
        })}
        <g className="viz-points">
          {points.map((pt, i) => {
            const xy = projection([pt.lon, pt.lat]);
            if (!xy) return null;
            return <circle key={i} cx={xy[0]} cy={xy[1]} r={radius(pt.v)} />;
          })}
        </g>
      </svg>
      <Tip tip={tip} host={size} />
      </>); }}</Plot>
      <Legend items={[
        { label: 'Low undiscovered', color: SEQUENTIAL_BLUE[1] },
        { label: 'High undiscovered', color: SEQUENTIAL_BLUE[5] },
        { label: 'Discovered field (∝ MMBOE)', color: dark ? '#e2e8f0' : '#0f172a' },
      ]} />
      <p className="viz-note">Click any province to pin it · {fmtNum(points.length)} fields sized by log volume, clamped at p99 · scope: {scope}</p>
    </div>
  );
}

// ═══ 1b · Basin scorecard ════════════════════════════════════════════════════
export function BasinScorecard({ scope }: ChartProps) {
  const [stats, setStats] = useState<ProvinceStat[] | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const pins = useCanvas((s) => s.pins);

  useEffect(() => { provinceStats().then(setStats); resolveProvinceCode(scope).then(setCode); }, [scope]);
  if (!stats) return <Loading what="province aggregates" />;

  const target = pins[0]?.id ?? code;
  const me = stats.find((s) => s.code === target);

  const AXES: { label: string; get: (s: ProvinceStat) => number; unit: string }[] = [
    { label: 'Undiscovered resource', get: (s) => s.boeMean, unit: 'MMBOE mean' },
    { label: 'Discovered endowment', get: (s) => s.discovered, unit: 'MMBOE' },
    { label: 'Field count', get: (s) => s.fieldCount, unit: 'fields' },
    { label: 'Median field size', get: (s) => s.medianField, unit: 'MMBOE' },
    { label: 'Discovery span', get: (s) => (s.firstYear && s.lastYear ? s.lastYear - s.firstYear : 0), unit: 'years' },
    { label: 'Offshore share', get: (s) => s.offshoreShare * 100, unit: '%' },
  ];

  const rows = AXES.map((a) => {
    const all = stats.map(a.get).filter((v) => v > 0).sort((x, y) => x - y);
    const v = me ? a.get(me) : 0;
    const rank = all.filter((x) => x <= v).length;
    return { ...a, v, pct: all.length ? rank / all.length : 0, n: all.length, p50: quantile(all, 0.5) ?? 0 };
  });

  if (table) {
    return (
      <div className="viz-host">
        <div className="viz-tools"><TableToggle open onToggle={() => setTable(false)} /></div>
        <DataTable
          head={['Axis', 'Value', 'Unit', 'Percentile', 'World median', 'n']}
          rows={rows.map((r) => [r.label, Math.round(r.v), r.unit, `p${Math.round(r.pct * 100)}`, Math.round(r.p50), r.n])}
        />
      </div>
    );
  }

  return (
    <div className="viz-host">
      <div className="viz-tools"><TableToggle open={false} onToggle={() => setTable(true)} /></div>
      <div className="viz-scorecard">
        {rows.map((r) => (
          <div key={r.label} className="viz-score-row" title={`${r.label}: ${fmtNum(r.v, 1)} ${r.unit} — p${Math.round(r.pct * 100)} of ${r.n} provinces`}>
            <span className="viz-score-label">{r.label}</span>
            <div className="viz-score-track">
              {/* The distribution is the track; the basin is the marker. A scalar
                  alone is meaningless — 20 MMBOE means nothing without the p50. */}
              <i className="viz-score-fill" style={{ width: `${r.pct * 100}%` }} />
              <i className="viz-score-median" style={{ left: '50%' }} title={`world median ${fmtNum(r.p50, 1)}`} />
            </div>
            <b className="viz-score-val">{fmtNum(r.v, 1)}<em>{r.unit}</em></b>
            <span className="viz-score-pct">p{Math.round(r.pct * 100)}</span>
          </div>
        ))}
      </div>
      <p className="viz-note">
        {me ? me.name : scope} against {stats.length} assessed provinces. USGS publishes a MEAN only — no F95/F50/F5 —
        so these bars show position, never spread.
      </p>
    </div>
  );
}

// ═══ 1c · Peer-basin comparator ══════════════════════════════════════════════
export function BasinPeerComparator({ scope }: ChartProps) {
  const [matches, setMatches] = useState<AnalogMatch[] | null>(null);
  const [table, setTable] = useState(false);
  const pins = useCanvas((s) => s.pins);
  const togglePin = useCanvas((s) => s.togglePin);

  useEffect(() => {
    (async () => {
      const [sigs, code] = await Promise.all([signatures(), resolveProvinceCode(scope)]);
      const target = sigs.find((s) => s.code === (pins[0]?.id ?? code)) ?? sigs[0];
      if (target) setMatches(rankAnalogs(target, sigs, 6));
    })();
  }, [scope, pins]);

  if (!matches) return <Loading what="179 basin signatures" />;
  if (table) {
    return (
      <div className="viz-host">
        <div className="viz-tools"><TableToggle open onToggle={() => setTable(false)} /></div>
        <DataTable
          head={['Peer', 'Score', ...matches[0].axes.map((a) => a.label)]}
          rows={matches.map((m) => [m.sig.name, m.score.toFixed(3), ...m.axes.map((a) => a.value.toFixed(2))])}
        />
      </div>
    );
  }

  return (
    <div className="viz-host">
      <div className="viz-tools"><TableToggle open={false} onToggle={() => setTable(true)} /></div>
      <div className="viz-peers">
        {matches.map((m) => (
          <button key={m.sig.code} className="viz-peer" onClick={() => togglePin({ id: m.sig.code, name: m.sig.name, fieldCount: m.sig.fieldCount })}>
            <span className="viz-peer-head">
              <b>{m.sig.name}</b>
              <em>{(m.score * 100).toFixed(0)}%</em>
            </span>
            {/* The score IS the sum of its parts, and every part is on the card.
                No hidden weighting: this is why the widget is called explainable. */}
            <span className="viz-peer-bar">
              {m.axes.map((a) => (
                <i
                  key={a.key}
                  style={{
                    flexGrow: Math.max(0.04, a.value * a.weight),
                    background: SEQUENTIAL_BLUE[Math.min(5, 1 + Math.round(a.value * 4))],
                  }}
                  title={`${a.label}: ${(a.value * 100).toFixed(0)}% match, weight ${a.weight}`}
                />
              ))}
            </span>
            <span className="viz-peer-axes">
              {m.axes.filter((a) => a.value > 0.6).slice(0, 3).map((a) => a.label).join(' · ') || 'weak match on every axis'}
            </span>
          </button>
        ))}
      </div>
      <p className="viz-note">Click a peer to pin it. Similarity decomposes into 9 axes — hover a bar segment for its contribution.</p>
    </div>
  );
}

// ═══ 2a · Tectonic cycle column ══════════════════════════════════════════════
export function TectonicCycleColumn({ scope }: ChartProps) {
  const [cols, setCols] = useState<{ name: string; cycles: CycleRec[] }[] | null>(null);
  const [tip, setTip] = useState<TipData | null>(null);
  const [table, setTable] = useState(false);
  const pins = useCanvas((s) => s.pins);
  const dark = useStore((s) => s.theme) === 'dark';

  useEffect(() => {
    (async () => {
      const names = pins.length ? pins.map((p) => p.name) : [scope];
      const sets = await Promise.all(names.map(async (n) => ({ name: n, cycles: await cyclesFor(n) })));
      setCols(sets.filter((s) => s.cycles.length));
    })();
  }, [scope, pins]);

  if (!cols) return <Loading what="630 basin cycles" />;
  const all = cols.flatMap((c) => c.cycles);

  if (table) {
    return (
      <div className="viz-host">
        <div className="viz-tools"><TableToggle open onToggle={() => setTable(false)} /></div>
        <DataTable
          head={['Basin cycle', 'Top Ma', 'Base Ma', 'Geodynamics', 'Fill', 'Lithology', 'Role', 'Provenance', 'Confidence']}
          rows={all.map((c) => [c.title, c.age_top_ma ?? '', c.age_base_ma ?? '', c.geodynamics ?? '', c.fill ?? '', c.lithology ?? '', c.dominant_role ?? '', c.provenance ?? '', c.confidence ?? ''])}
        />
      </div>
    );
  }

  return (
    <Degrade n={all.length} need={1} what="tectonic cycles">
      <div className="viz-host">
        <div className="viz-tools"><TableToggle open={false} onToggle={() => setTable(true)} /></div>
        <Plot minHeight={200}>{(size) => (<>
          <CycleColumns cols={cols} size={size} dark={dark} onTip={setTip} />
          <Tip tip={tip} host={size} />
        </>)}</Plot>
        <Legend items={[
          { label: 'Extensional', color: GEODYNAMIC_COLOR.extensional[dark ? 'dark' : 'light'] },
          { label: 'Contractional', color: GEODYNAMIC_COLOR.contractional[dark ? 'dark' : 'light'] },
          { label: 'Quiescent', color: GEODYNAMIC_COLOR.quiescent[dark ? 'dark' : 'light'] },
          { label: 'Recalled (hatched)', color: GEODYNAMIC_COLOR.extensional[dark ? 'dark' : 'light'], pattern: 'recalled' },
        ]} />
        <p className="viz-note">
          Time-scaled, <b>not</b> depth-scaled — no thickness exists in the corpus. Hatched bars are literature-recalled
          (626 of 630 corpus-wide); opacity carries confidence.
        </p>
      </div>
    </Degrade>
  );
}

function CycleColumns({ cols, size, dark, onTip }: {
  cols: { name: string; cycles: CycleRec[] }[]; size: { w: number; h: number };
  dark: boolean; onTip: (t: TipData | null) => void;
}) {
  const pad = { top: 8, right: 8, bottom: 6, left: 42 };
  const h = Math.max(120, size.h);
  const ages = cols.flatMap((c) => c.cycles.flatMap((x) => [x.age_top_ma ?? 0, x.age_base_ma ?? 0]));
  const [lo, hi] = extent(ages) as [number, number];
  const y = scaleLinear().domain([hi ?? 250, lo ?? 0]).range([pad.top, h - pad.bottom]);
  const colW = (size.w - pad.left - pad.right) / Math.max(1, cols.length);
  const ticks = y.ticks(6).map((v) => ({ v, y: y(v) }));

  return (
    <svg width={size.w} height={h} className="viz-column">
      <VizDefs />
      <AxisY ticks={ticks} x={pad.left} w={size.w - pad.left - pad.right} fmt={(v) => `${v} Ma`} />
      {cols.map((col, ci) => {
        const x = pad.left + ci * colW;
        return (
          <g key={col.name}>
            {cols.length > 1 && (
              <text x={x + colW / 2} y={pad.top - 1} textAnchor="middle" className="viz-col-title"
                fill={pinColor(ci, dark)}>{col.name}</text>
            )}
            {col.cycles.map((c) => {
              const top = y(c.age_base_ma ?? 0), bot = y(c.age_top_ma ?? 0);
              const cls = GEODYNAMIC_CLASS[(c.geodynamics ?? '').toLowerCase()] ?? 'quiescent';
              const fill = GEODYNAMIC_COLOR[cls][dark ? 'dark' : 'light'];
              const recalled = c.provenance !== 'interpreted';
              const conf = c.confidence === 'high' ? 1 : c.confidence === 'medium' ? 0.72 : 0.48;
              return (
                <g key={c.cycle_id}
                  onMouseEnter={(e) => onTip({
                    x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, title: c.title,
                    rows: [
                      ['Age', `${c.age_base_ma}–${c.age_top_ma} Ma`],
                      ['Geodynamics', c.geodynamics ?? '—'],
                      ['Fill · lithology', `${c.fill ?? '—'} · ${c.lithology ?? '—'}`],
                      ['Dominant role', c.dominant_role ?? '—'],
                      ['Units', c.units ?? '—'],
                    ],
                    grade: recalled ? 'RECALLED' : 'SOURCED',
                  })}
                  onMouseLeave={() => onTip(null)}
                >
                  {/* 2px surface gap between stacked segments — the house spec. */}
                  <rect x={x + 3} y={top + 1} width={colW - 6} height={Math.max(2, bot - top - 2)}
                    rx={3} fill={fill} opacity={conf} className="viz-cycle" />
                  {recalled && (
                    <rect x={x + 3} y={top + 1} width={colW - 6} height={Math.max(2, bot - top - 2)}
                      rx={3} fill="url(#viz-recalled)" color={fill} />
                  )}
                  {bot - top > 15 && (
                    <text x={x + colW / 2} y={(top + bot) / 2} dy="0.32em" textAnchor="middle" className="viz-cycle-label">
                      {c.stage ?? c.title}
                    </text>
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

// ═══ 2b · Framework map ══════════════════════════════════════════════════════
export function BasinFrameworkMap({ scope }: ChartProps) {
  const [geo, setGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [pts, setPts] = useState<{ lon: number; lat: number; name: string }[]>([]);
  const [tip, setTip] = useState<TipData | null>(null);
  const pins = useCanvas((s) => s.pins);

  useEffect(() => { loadProvinceGeo().then(setGeo); resolveProvinceCode(scope).then(setCode); }, [scope]);
  const target = pins[0]?.id ?? code;
  useEffect(() => {
    if (!target) return;
    import('../data').then(({ loadScopeFields }) => loadScopeFields().then((s) => {
      setPts((s.provinces[target] ?? []).map((f) => ({ lon: f.fly.lon, lat: f.fly.lat, name: f.name })));
    }));
  }, [target]);

  const feature = useMemo(() => geo?.features.find((f) => (f.properties as { prvCode: string })?.prvCode === target), [geo, target]);

  if (!geo) return <Loading what="province polygons" />;
  if (!feature) return <Degrade n={0} need={1} what="mapped province for this scope"><span /></Degrade>;

  return (
    <div className="viz-host">
      <Plot minHeight={150}>{(size) => {
        const projection = geoEquirectangular()
          .fitExtent([[10, 10], [Math.max(20, size.w - 10), Math.max(20, size.h - 10)]], feature);
        const path = geoPath(projection);
        return (<>
      <svg width={size.w} height={size.h} className="viz-map">
        {geo.features.filter((f) => f !== feature).map((f, i) => (
          <path key={i} d={path(f) ?? undefined} className="viz-prov ghost" />
        ))}
        <path d={path(feature) ?? undefined} className="viz-prov focus" />
        <g className="viz-points solid">
          {pts.map((p, i) => {
            const xy = projection([p.lon, p.lat]);
            if (!xy) return null;
            return <circle key={i} cx={xy[0]} cy={xy[1]} r={2.6}
              onMouseEnter={(e) => setTip({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, title: p.name, rows: [['Source', 'OSDU field record']], grade: 'SOURCED' })}
              onMouseLeave={() => setTip(null)} />;
          })}
        </g>
      </svg>
      <Tip tip={tip} host={size} />
      </>); }}</Plot>
      <p className="viz-note">{fmtNum(pts.length)} field records in scope. Assessment units have no geometry in the corpus — membership shows as points, never a polygon.</p>
    </div>
  );
}

// ═══ 2c · Framework evidence ═════════════════════════════════════════════════
export function FrameworkEvidencePanel({ scope }: ChartProps) {
  const [rows, setRows] = useState<CompletionRec[] | null>(null);
  const [table, setTable] = useState(false);
  useEffect(() => { loadSpine().then((s) => setRows([...s.basinCompletion].sort((a, b) => (b.completion_pct ?? 0) - (a.completion_pct ?? 0)))); }, []);
  if (!rows) return <Loading what="179 basin completion records" />;

  const mine = rows.filter((r) => r.province_name === scope || r.basin_name === scope);
  const shown = [...mine, ...rows.filter((r) => !mine.includes(r))].slice(0, 24);

  if (table) {
    return (
      <div className="viz-host">
        <div className="viz-tools"><TableToggle open onToggle={() => setTable(false)} /></div>
        <DataTable head={['Basin', 'Completion', 'Stage', 'Primary gap']}
          rows={rows.slice(0, 60).map((r) => [r.basin_name, `${Math.round((r.completion_pct ?? 0) * 100)}%`, r.completion_stage ?? '', r.primary_gap ?? ''])} />
      </div>
    );
  }

  return (
    <div className="viz-host">
      <div className="viz-tools"><TableToggle open={false} onToggle={() => setTable(true)} /></div>
      <div className="viz-bars">
        {shown.map((r) => {
          const pct = Math.round((r.completion_pct ?? 0) * 100);
          const inScope = mine.includes(r);
          return (
            <div key={r.basin_id} className={'viz-bar-row' + (inScope ? ' focus' : '')} title={`${r.basin_name} — ${r.completion_stage}\nGap: ${r.primary_gap}\nNext: ${r.next_action}`}>
              <span className="viz-bar-label">{r.basin_name}</span>
              <div className="viz-bar-track"><i style={{ width: `${pct}%` }} /></div>
              <b>{pct}%</b>
            </div>
          );
        })}
      </div>
      <p className="viz-note">Our own audit, charted: {rows.length} basins by framework completeness. In-scope rows are lifted to the top.</p>
    </div>
  );
}

// ═══ 3a · Analogue finder ════════════════════════════════════════════════════
export function BasinAnalogFinder({ scope }: ChartProps) {
  const [matches, setMatches] = useState<AnalogMatch[] | null>(null);
  const [axis, setAxis] = useState<string | null>(null);
  const [sigs, setSigs] = useState<Signature[] | null>(null);
  const [target, setTarget] = useState<Signature | null>(null);
  const pins = useCanvas((s) => s.pins);
  const togglePin = useCanvas((s) => s.togglePin);

  useEffect(() => {
    (async () => {
      const [all, code] = await Promise.all([signatures(), resolveProvinceCode(scope)]);
      const t = all.find((s) => s.code === (pins[0]?.id ?? code)) ?? all[0];
      setSigs(all); setTarget(t ?? null);
      if (t) setMatches(rankAnalogs(t, all, 8));
    })();
  }, [scope, pins]);

  useEffect(() => {
    if (!sigs || !target) return;
    const ranked = rankAnalogs(target, sigs, 8);
    setMatches(axis
      ? [...ranked].sort((a, b) => (b.axes.find((x) => x.key === axis)?.value ?? 0) - (a.axes.find((x) => x.key === axis)?.value ?? 0))
      : ranked);
  }, [axis, sigs, target]);

  if (!matches || !target) return <Loading what="basin signatures across 179 provinces" />;

  return (
    <div className="viz-host">
      <div className="viz-axis-picker">
        <button className={axis === null ? 'on' : ''} onClick={() => setAxis(null)}>All axes</button>
        {matches[0].axes.map((a) => (
          <button key={a.key} className={axis === a.key ? 'on' : ''} onClick={() => setAxis(a.key)}>{a.label}</button>
        ))}
      </div>
      <div className="viz-analogs">
        {matches.map((m) => (
          <div key={m.sig.code} className="viz-analog">
            <div className="viz-analog-head">
              <b>{m.sig.name}</b>
              <span>{m.sig.setting} · {m.sig.cycleCount} cycles · {fmtNum(m.sig.fieldCount)} fields</span>
              <button onClick={() => togglePin({ id: m.sig.code, name: m.sig.name, fieldCount: m.sig.fieldCount })}>pin</button>
              <em>{(m.score * 100).toFixed(0)}%</em>
            </div>
            <div className="viz-analog-axes">
              {m.axes.map((a) => (
                <div key={a.key} className={'viz-analog-axis' + (axis === a.key ? ' on' : '')} title={`${a.label} — ${(a.value * 100).toFixed(0)}% match at weight ${a.weight}`}>
                  <span>{a.label}</span>
                  <i><b style={{ width: `${a.value * 100}%` }} /></i>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="viz-note">
        Ranked against <b>{target.name}</b>. Every score is the weighted sum of the eight bars beneath it —
        nothing hidden, nothing learned. Grade is capped at RECALLED while cycles remain unverified.
      </p>
    </div>
  );
}

// ═══ 3b · Analogue world map ═════════════════════════════════════════════════
export function BasinAnalogMap({ scope }: ChartProps) {
  const [geo, setGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [arcs, setArcs] = useState<{ from: [number, number]; to: [number, number]; score: number; name: string }[]>([]);
  const [tip, setTip] = useState<TipData | null>(null);
  const pins = useCanvas((s) => s.pins);

  useEffect(() => { loadProvinceGeo().then(setGeo); }, []);
  useEffect(() => {
    (async () => {
      const [all, code, g] = await Promise.all([signatures(), resolveProvinceCode(scope), loadProvinceGeo()]);
      const centroid = (c: string) => {
        const f = g.features.find((x) => (x.properties as { prvCode: string })?.prvCode === c);
        return f ? (geoPath().centroid(f) as [number, number]) : null;
      };
      const t = all.find((s) => s.code === (pins[0]?.id ?? code));
      if (!t) return;
      const home = centroid(t.code);
      if (!home) return;
      setArcs(rankAnalogs(t, all, 8)
        .map((m) => ({ from: home, to: centroid(m.sig.code), score: m.score, name: m.sig.name }))
        .filter((a): a is { from: [number, number]; to: [number, number]; score: number; name: string } => a.to !== null));
    })();
  }, [scope, pins]);

  if (!geo) return <Loading what="province geometry" />;

  return (
    <div className="viz-host">
      <Plot minHeight={150}>{(size) => {
        const { projection, path, h } = fitMap(geo, size);
        return (<>
      <svg width={size.w} height={h} className="viz-map">
        {geo.features.map((f, i) => <path key={i} d={path(f) ?? undefined} className="viz-prov ghost" />)}
        {arcs.map((a, i) => {
          const p1 = projection(a.from), p2 = projection(a.to);
          if (!p1 || !p2) return null;
          const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2 - Math.abs(p2[0] - p1[0]) * 0.22;
          return (
            <path key={i} d={`M${p1[0]},${p1[1]} Q${mx},${my} ${p2[0]},${p2[1]}`} className="viz-arc"
              strokeWidth={0.7 + a.score * 3} opacity={0.28 + a.score * 0.6}
              onMouseEnter={(e) => setTip({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, title: a.name, rows: [['Similarity', `${(a.score * 100).toFixed(0)}%`]], grade: 'RECALLED' })}
              onMouseLeave={() => setTip(null)} />
          );
        })}
      </svg>
      <Tip tip={tip} host={size} />
      </>); }}</Plot>
      <p className="viz-note">{arcs.length} analogues. Arc weight is similarity — how far the evidence has to travel to reach you.</p>
    </div>
  );
}

// ═══ 3c · Prior library ══════════════════════════════════════════════════════
export function AnalogPriorLibrary({ scope }: ChartProps) {
  const [sizes, setSizes] = useState<number[] | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const pins = useCanvas((s) => s.pins);

  useEffect(() => { resolveProvinceCode(scope).then(setCode); }, [scope]);
  const target = pins[0]?.id ?? code;
  useEffect(() => {
    if (!target) return;
    fieldSizes(target).then(setSizes);
    discoveries(target).then((d) => setYears(d.map((x) => x.year)));
  }, [target]);

  if (!sizes) return <Loading what="cohort field sizes" />;
  const sorted = [...sizes].sort((a, b) => a - b);
  const stats = [
    { k: 'n', v: fmtNum(sorted.length) },
    { k: 'P90', v: fmtNum(quantile(sorted, 0.1) ?? 0, 1) },
    { k: 'P50', v: fmtNum(quantile(sorted, 0.5) ?? 0, 1) },
    { k: 'P10', v: fmtNum(quantile(sorted, 0.9) ?? 0, 1) },
    { k: 'Span', v: years.length ? `${Math.min(...years)}–${Math.max(...years)}` : '—' },
  ];

  return (
    <Degrade n={sorted.length} need={3} what="fields with a reported volume">
      <div className="viz-host">
        <div className="viz-priors">
          {stats.map((s) => <div key={s.k} className="viz-prior-stat"><span>{s.k}</span><b>{s.v}</b></div>)}
        </div>
        <Plot minHeight={80}>{(size) => <Spark values={sorted} w={size.w} h={size.h} />}</Plot>
        <p className="viz-note">
          Empirical prior, MMBOE, log-x. Biased toward what has already been found — that bias is a property of the
          data, not a defect of the chart. Hand these to Volumetrics with the caveat attached.
        </p>
      </div>
    </Degrade>
  );
}

function Spark({ values, w, h }: { values: number[]; w: number; h: number }) {
  if (!values.length || w < 10) return null;
  const x = scaleLinear().domain([Math.log10(Math.max(0.01, values[0])), Math.log10(values[values.length - 1] || 1)]).range([4, w - 4]);
  const y = scaleLinear().domain([0, 1]).range([h - 4, 4]);
  const pts = values.map((v, i) => `${x(Math.log10(Math.max(0.01, v)))},${y(i / (values.length - 1 || 1))}`);
  return (
    <svg width={w} height={h} className="viz-spark">
      <polyline points={pts.join(' ')} />
    </svg>
  );
}
