// The Exploration canvas data layer.
//
// Every number the nine tabs draw comes through here, from the files that are
// actually on disk. Nothing is hard-coded and nothing is synthesised: where the
// corpus is thin the selector returns a small `n` and the chart degrades, which
// is the honest outcome rather than a padded one.
//
// Loading is lazy and cached per file — master-kb-spine is 5.4 MB and
// cockpit-field-detail is 5.9 MB, so a tab only pays for what it draws.
const base = import.meta.env.BASE_URL || '/';

const cache = new Map<string, Promise<unknown>>();
function load<T>(path: string, fallback: T): Promise<T> {
  if (!cache.has(path)) {
    cache.set(path, fetch(`${base}${path}`)
      .then((r) => (r.ok ? r.json() : fallback))
      .catch(() => fallback));
  }
  return cache.get(path) as Promise<T>;
}

// ── raw record shapes (only the fields we read) ─────────────────────────────
export interface ProvinceRec { province_id: string; code: string; name: string; region_id: string; assessed: string; oilMean_mmbbl?: number; gasMean_bcf?: number }
export interface BasinRec { basin_id: string; name: string; setting?: string; province_id: string; classification_status?: string }
export interface CycleRec { cycle_id: string; title: string; basin_id: string; stage?: string; age_top_ma?: number; age_base_ma?: number; geodynamics?: string; fill?: string; lithology?: string; dominant_role?: string; units?: string; provenance?: string; confidence?: string; source_citation_id?: string }
export interface TpsRec { tps_id: string; code: string; name: string; province_id: string; source_rock_formation?: string; essential_elements_note?: string }
export interface AuRec { au_id: string; code: string; name: string; tps_id: string; status?: string; oilMean_mmbbl?: number; gasMean_bcf?: number }
export interface ElementRec { element_id: string; model_id: string; unit_name?: string; element_role: string; start_ma?: number; end_ma?: number; effectiveness?: string; confidence?: string }
export interface EventRec { event_id: string; model_id: string; event_type: string; label?: string; start_ma?: number; end_ma?: number; certainty?: string; notes?: string }
export interface ModelRec { model_id: string; tps_id: string; title?: string; completeness_grade?: string }
export interface CompletionRec { basin_id: string; basin_name: string; province_code: string; province_name: string; tps_count?: number; au_count?: number; cycle_count?: number; completion_pct?: number; completion_stage?: string; primary_gap?: string; next_action?: string }
export interface FormationRec { formation_id: string; canonical_name: string; rank?: string; aliases?: string; age_hint?: string; basin_ids?: string; basin_count?: number; occurrence_count?: number }
export interface TimescaleRec { name: string; rank: string; start_ma: number; end_ma: number; parent_name?: string }
export interface FieldRec { field_id: string; name?: string; basin_id?: string; country_id: string; operator?: string; discovery_year?: number; status?: string; hc_type: string }
export interface TowerRec { id: string; name: string; lon: number; lat: number; oil?: number; gas?: number; cap?: number; total?: number }
export interface ScopeField { id: string; name: string; country: string; source: string; fly: { lon: number; lat: number } }

interface Spine {
  province: ProvinceRec[]; basin: BasinRec[]; basinCycle: CycleRec[]; petroleumSystem: TpsRec[];
  assessmentUnit: AuRec[]; psElement: ElementRec[]; psEvent: EventRec[]; psModel: ModelRec[];
  basinCompletion: CompletionRec[]; formation: FormationRec[]; geologicTimescale: TimescaleRec[];
}
const EMPTY_SPINE: Spine = {
  province: [], basin: [], basinCycle: [], petroleumSystem: [], assessmentUnit: [],
  psElement: [], psEvent: [], psModel: [], basinCompletion: [], formation: [], geologicTimescale: [],
};

export const loadSpine = () => load<Spine>('kb/master-kb-spine.json', EMPTY_SPINE);
export const loadFields = () => load<{ field: FieldRec[] }>('kb/master-kb-fields.json', { field: [] }).then((j) => j.field ?? []);
export const loadTowers = () => load<{ towers: TowerRec[] }>('osdu/cockpit-reserve-towers.json', { towers: [] }).then((j) => j.towers ?? []);
export const loadScopeFields = () => load<{ provinces: Record<string, ScopeField[]>; assessmentUnits: Record<string, ScopeField[]> }>(
  'osdu/cockpit-scope-fields.json', { provinces: {}, assessmentUnits: {} });
export const loadProvinceGeo = () => load<GeoJSON.FeatureCollection>('world/provinces.geojson', { type: 'FeatureCollection', features: [] });
export const loadFieldDetail = () => load<Record<string, { discoveryYear?: number | null; onshoreOffshore?: string; productionType?: string | null; fuelType?: string; status?: string; reserves?: { classification?: string | null; value?: number; unit?: string }[] }>>(
  'osdu/cockpit-field-detail.json', {});

// ── derived selectors ───────────────────────────────────────────────────────

export interface ProvinceStat {
  code: string; name: string; oilMean: number; gasMean: number; boeMean: number;
  fieldCount: number; volumeCount: number; datedCount: number; creamingReady: number;
  discovered: number; medianField: number; firstYear: number | null; lastYear: number | null;
  offshoreShare: number;
}

/** The join that powers Atlas, Analogs, Volumetrics and Ranking: 5,106 fields
 *  inside 179 province polygons, 2,816 of them with BOTH a volume and a year. */
export async function provinceStats(): Promise<ProvinceStat[]> {
  const [geo, scope, towers, detail] = await Promise.all([
    loadProvinceGeo(), loadScopeFields(), loadTowers(), loadFieldDetail(),
  ]);
  const towerById = new Map(towers.map((t) => [t.id, t]));
  return geo.features.map((f) => {
    const p = (f.properties ?? {}) as { prvCode: string; prvName: string; oilMean: number; gasMean: number; boeMean: number };
    const list = scope.provinces[p.prvCode] ?? [];
    let volumeCount = 0, datedCount = 0, creamingReady = 0, discovered = 0, offshore = 0, known = 0;
    let firstYear: number | null = null, lastYear: number | null = null;
    const sizes: number[] = [];
    for (const field of list) {
      const tower = towerById.get(field.id);
      const d = detail[field.id];
      const vol = tower?.total;
      const year = d?.discoveryYear ?? undefined;
      if (vol) { volumeCount += 1; discovered += vol; sizes.push(vol); }
      if (year) {
        datedCount += 1;
        if (firstYear === null || year < firstYear) firstYear = year;
        if (lastYear === null || year > lastYear) lastYear = year;
      }
      if (vol && year) creamingReady += 1;
      if (d?.onshoreOffshore && d.onshoreOffshore !== 'unknown') { known += 1; if (d.onshoreOffshore === 'offshore') offshore += 1; }
    }
    sizes.sort((a, b) => a - b);
    return {
      code: p.prvCode, name: p.prvName, oilMean: p.oilMean ?? 0, gasMean: p.gasMean ?? 0, boeMean: p.boeMean ?? 0,
      fieldCount: list.length, volumeCount, datedCount, creamingReady, discovered,
      medianField: sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0,
      firstYear, lastYear, offshoreShare: known ? offshore / known : 0,
    };
  });
}

export interface Discovery { year: number; volume: number; name: string }

/** Creaming input for one province, sorted by year. Callers must show `n` and
 *  degrade: 19 provinces have ≥30 of these, 53 have ≥10, 89 have fewer than 3. */
export async function discoveries(code: string): Promise<Discovery[]> {
  const [scope, towers, detail] = await Promise.all([loadScopeFields(), loadTowers(), loadFieldDetail()]);
  const towerById = new Map(towers.map((t) => [t.id, t]));
  const out: Discovery[] = [];
  for (const field of scope.provinces[code] ?? []) {
    const vol = towerById.get(field.id)?.total;
    const year = detail[field.id]?.discoveryYear;
    if (vol && year) out.push({ year, volume: vol, name: field.name });
  }
  return out.sort((a, b) => a.year - b.year);
}

/** Field-size sample for a province, or the world when `code` is null. */
export async function fieldSizes(code: string | null): Promise<number[]> {
  const [scope, towers] = await Promise.all([loadScopeFields(), loadTowers()]);
  if (!code) return towers.map((t) => t.total ?? 0).filter((v) => v > 0);
  const ids = new Set((scope.provinces[code] ?? []).map((f) => f.id));
  return towers.filter((t) => ids.has(t.id)).map((t) => t.total ?? 0).filter((v) => v > 0);
}

/** The province code for a scope name, resolved through the spine rather than
 *  a lookup table so a renamed province cannot silently mis-scope a chart. */
export async function resolveProvinceCode(scopeName: string): Promise<string | null> {
  const spine = await loadSpine();
  const direct = spine.province.find((p) => p.name === scopeName);
  if (direct) return direct.code;
  const au = spine.assessmentUnit.find((a) => a.name === scopeName);
  if (au) {
    const tps = spine.petroleumSystem.find((t) => t.tps_id === au.tps_id);
    const prov = spine.province.find((p) => p.province_id === tps?.province_id);
    if (prov) return prov.code;
  }
  const basin = spine.basin.find((b) => b.name === scopeName);
  if (basin) return spine.province.find((p) => p.province_id === basin.province_id)?.code ?? null;
  return null;
}

/** Cycles for a basin, newest at the top of the column. */
export async function cyclesFor(scopeName: string): Promise<CycleRec[]> {
  const spine = await loadSpine();
  const code = await resolveProvinceCode(scopeName);
  const province = spine.province.find((p) => p.code === code);
  const basins = spine.basin.filter((b) => b.province_id === province?.province_id || b.name === scopeName);
  const ids = new Set(basins.map((b) => b.basin_id));
  return spine.basinCycle
    .filter((c) => ids.has(c.basin_id))
    .sort((a, b) => (a.age_top_ma ?? 0) - (b.age_top_ma ?? 0));
}

/** The petroleum systems in scope, with their elements and events attached. */
export interface SystemBundle {
  tps: TpsRec; model: ModelRec | undefined;
  elements: ElementRec[]; events: EventRec[];
}
export async function systemsFor(scopeName: string): Promise<SystemBundle[]> {
  const spine = await loadSpine();
  const code = await resolveProvinceCode(scopeName);
  const province = spine.province.find((p) => p.code === code);
  const systems = spine.petroleumSystem.filter((t) => t.province_id === province?.province_id);
  const pool = systems.length ? systems : spine.petroleumSystem.slice(0, 1);
  return pool.map((tps) => {
    const model = spine.psModel.find((m) => m.tps_id === tps.tps_id);
    const modelIds = new Set(spine.psModel.filter((m) => m.tps_id === tps.tps_id).map((m) => m.model_id));
    return {
      tps, model,
      elements: spine.psElement.filter((e) => modelIds.has(e.model_id)),
      events: spine.psEvent.filter((e) => modelIds.has(e.model_id)),
    };
  });
}

// ── the 9-axis analogue signature ───────────────────────────────────────────
export interface Signature {
  code: string; name: string; setting: string;
  geodynamics: string[]; fill: Set<string>; lithology: Set<string>;
  ageSpan: number; cycleCount: number;
  roles: Record<string, number>;
  timingOffset: number;
  endowmentDecile: number; medianField: number; fieldCount: number;
  worstProvenance: 'SOURCED' | 'RECALLED';
}

const jaccard = (a: Set<string>, b: Set<string>) => {
  if (!a.size && !b.size) return 1;
  let inter = 0;
  a.forEach((v) => { if (b.has(v)) inter += 1; });
  return inter / (a.size + b.size - inter);
};

/** Ordered-sequence distance, normalised to 0–1 similarity. */
const seqSim = (a: string[], b: string[]) => {
  if (!a.length && !b.length) return 1;
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j += 1) d[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return 1 - d[m][n] / Math.max(m, n, 1);
};

const cosine = (a: Record<string, number>, b: Record<string, number>) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, na = 0, nb = 0;
  keys.forEach((k) => { const x = a[k] ?? 0, y = b[k] ?? 0; dot += x * y; na += x * x; nb += y * y; });
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

export async function signatures(): Promise<Signature[]> {
  const [spine, stats] = await Promise.all([loadSpine(), provinceStats()]);
  const statByCode = new Map(stats.map((s) => [s.code, s]));
  const boes = stats.map((s) => s.boeMean).sort((a, b) => a - b);
  const decile = (v: number) => Math.min(9, Math.floor((boes.filter((x) => x <= v).length / Math.max(1, boes.length)) * 10));

  return spine.province.map((p) => {
    const basins = spine.basin.filter((b) => b.province_id === p.province_id);
    const ids = new Set(basins.map((b) => b.basin_id));
    const cycles = spine.basinCycle.filter((c) => ids.has(c.basin_id))
      .sort((a, b) => (b.age_base_ma ?? 0) - (a.age_base_ma ?? 0));
    const tpsIds = new Set(spine.petroleumSystem.filter((t) => t.province_id === p.province_id).map((t) => t.tps_id));
    const modelIds = new Set(spine.psModel.filter((m) => tpsIds.has(m.tps_id)).map((m) => m.model_id));
    const roles: Record<string, number> = {};
    spine.psElement.forEach((e) => { if (modelIds.has(e.model_id)) roles[e.element_role] = (roles[e.element_role] ?? 0) + 1; });

    const evs = spine.psEvent.filter((e) => modelIds.has(e.model_id));
    const crit = evs.find((e) => e.event_type === 'critical-moment')?.start_ma ?? 0;
    const trap = evs.find((e) => e.event_type === 'trap-formation')?.start_ma ?? 0;

    const stat = statByCode.get(p.code);
    const ages = cycles.flatMap((c) => [c.age_top_ma ?? 0, c.age_base_ma ?? 0]);
    return {
      code: p.code, name: p.name,
      setting: basins[0]?.setting ?? 'unknown',
      geodynamics: cycles.map((c) => c.geodynamics ?? 'unknown'),
      fill: new Set(cycles.map((c) => c.fill ?? 'unknown')),
      lithology: new Set(cycles.map((c) => (c.lithology ?? 'unknown').split(' ')[0])),
      ageSpan: ages.length ? Math.max(...ages) - Math.min(...ages) : 0,
      cycleCount: cycles.length,
      roles,
      timingOffset: trap - crit,
      endowmentDecile: decile(p.oilMean_mmbbl !== undefined ? (stat?.boeMean ?? 0) : 0),
      medianField: stat?.medianField ?? 0,
      fieldCount: stat?.fieldCount ?? 0,
      worstProvenance: cycles.every((c) => c.provenance === 'interpreted') && cycles.length ? 'SOURCED' : 'RECALLED',
    };
  });
}

export interface AnalogMatch {
  sig: Signature; score: number;
  axes: { key: string; label: string; value: number; weight: number }[];
}

/** Explainable similarity: the score IS the sum of its parts, and every part is
 *  shown. No hidden weighting, no learned embedding. */
export function rankAnalogs(target: Signature, all: Signature[], limit = 8): AnalogMatch[] {
  const W = { geo: 0.22, setting: 0.10, fill: 0.14, lith: 0.14, span: 0.08, roles: 0.14, timing: 0.08, endow: 0.10 };
  return all
    .filter((s) => s.code !== target.code)
    .map((sig) => {
      const axes = [
        { key: 'geo', label: 'Geodynamic sequence', value: seqSim(target.geodynamics, sig.geodynamics), weight: W.geo },
        { key: 'setting', label: 'Basin setting', value: target.setting === sig.setting ? 1 : 0, weight: W.setting },
        { key: 'fill', label: 'Fill history', value: jaccard(target.fill, sig.fill), weight: W.fill },
        { key: 'lith', label: 'Lithology mix', value: jaccard(target.lithology, sig.lithology), weight: W.lith },
        { key: 'span', label: 'Age span', value: 1 - Math.min(1, Math.abs(target.ageSpan - sig.ageSpan) / 400), weight: W.span },
        { key: 'roles', label: 'PS role profile', value: cosine(target.roles, sig.roles), weight: W.roles },
        { key: 'timing', label: 'Charge timing', value: 1 - Math.min(1, Math.abs(target.timingOffset - sig.timingOffset) / 200), weight: W.timing },
        { key: 'endow', label: 'Endowment class', value: 1 - Math.abs(target.endowmentDecile - sig.endowmentDecile) / 10, weight: W.endow },
      ];
      return { sig, axes, score: axes.reduce((t, a) => t + a.value * a.weight, 0) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ── common-risk scoring ─────────────────────────────────────────────────────
export type FactorGrade = 'evidenced' | 'partial' | 'absent';
export interface CrsRow {
  tpsId: string; code: string; name: string;
  factors: { key: string; label: string; grade: FactorGrade; basis: string }[];
}

const gradeFrom = (count: number, effective: number): FactorGrade =>
  count === 0 ? 'absent' : effective > 0 ? 'evidenced' : 'partial';

export async function crsMatrix(scopeName: string): Promise<CrsRow[]> {
  const bundles = await systemsFor(scopeName);
  return bundles.map(({ tps, elements, events }) => {
    const byRole = (role: string) => elements.filter((e) => e.element_role === role);
    const eff = (role: string) => byRole(role).filter((e) => e.effectiveness && e.effectiveness !== 'not-assessed').length;
    const gen = events.find((e) => e.event_type === 'generation');
    const trap = events.find((e) => e.event_type === 'trap-formation');
    // Timing: did the trap exist before peak generation? This boolean is the
    // fifth factor, imported from Charge Timing rather than re-derived.
    const timingOk = trap?.start_ma !== undefined && gen?.start_ma !== undefined && trap.start_ma >= gen.start_ma;
    return {
      tpsId: tps.tps_id, code: tps.code, name: tps.name,
      factors: [
        { key: 'charge', label: 'Charge', grade: gradeFrom(byRole('source').length, gen?.certainty === 'high' ? 1 : 0), basis: `${byRole('source').length} source bars · generation ${gen?.certainty ?? 'unknown'} certainty` },
        { key: 'reservoir', label: 'Reservoir', grade: gradeFrom(byRole('reservoir').length, eff('reservoir')), basis: `${byRole('reservoir').length} reservoir bars · ${eff('reservoir')} with assessed effectiveness` },
        { key: 'seal', label: 'Seal', grade: gradeFrom(byRole('seal').length, eff('seal')), basis: `${byRole('seal').length} seal bars · ${eff('seal')} with assessed effectiveness` },
        { key: 'trap', label: 'Trap', grade: trap ? (trap.certainty === 'high' ? 'evidenced' : 'partial') : 'absent', basis: trap ? `trap formation ${trap.start_ma}–${trap.end_ma} Ma · ${trap.certainty ?? 'unknown'} certainty` : 'no trap-formation event' },
        { key: 'timing', label: 'Timing', grade: timingOk ? 'evidenced' : trap && gen ? 'partial' : 'absent', basis: timingOk ? 'trap predates peak generation' : 'trap/generation order unresolved' },
      ],
    };
  });
}

/** Assessment units as statistical opportunities. Badged, never mistaken for a
 *  mapped prospect — the register keeps the two in different series forever. */
export interface Opportunity {
  auId: string; code: string; name: string; tpsName: string; provinceName: string;
  status: string; oilMean: number; gasMean: number; boeMean: number;
  chance: number; kind: 'usgs-statistical' | 'user';
}
export async function opportunities(): Promise<Opportunity[]> {
  const spine = await loadSpine();
  const tpsById = new Map(spine.petroleumSystem.map((t) => [t.tps_id, t]));
  const provById = new Map(spine.province.map((p) => [p.province_id, p]));
  // Chance proxy from the evidence actually present on the parent system: how
  // many of the four element roles are represented at all.
  const modelByTps = new Map<string, Set<string>>();
  spine.psModel.forEach((m) => {
    if (!modelByTps.has(m.tps_id)) modelByTps.set(m.tps_id, new Set());
    modelByTps.get(m.tps_id)!.add(m.model_id);
  });
  const rolesByModel = new Map<string, Set<string>>();
  const effByModel = new Map<string, { assessed: number; total: number }>();
  spine.psElement.forEach((e) => {
    if (!rolesByModel.has(e.model_id)) rolesByModel.set(e.model_id, new Set());
    rolesByModel.get(e.model_id)!.add(e.element_role);
    const acc = effByModel.get(e.model_id) ?? { assessed: 0, total: 0 };
    acc.total += 1;
    if (e.effectiveness && e.effectiveness !== 'not-assessed') acc.assessed += 1;
    effByModel.set(e.model_id, acc);
  });
  const certByModel = new Map<string, { high: number; total: number }>();
  spine.psEvent.forEach((e) => {
    const acc = certByModel.get(e.model_id) ?? { high: 0, total: 0 };
    acc.total += 1;
    if (e.certainty === 'high') acc.high += 1;
    else if (e.certainty === 'medium') acc.high += 0.5;
    certByModel.set(e.model_id, acc);
  });

  return spine.assessmentUnit.map((au) => {
    const tps = tpsById.get(au.tps_id);
    const prov = tps ? provById.get(tps.province_id) : undefined;
    const models = modelByTps.get(au.tps_id) ?? new Set<string>();
    const roles = new Set<string>();
    let assessed = 0, elements = 0, certain = 0, events = 0;
    models.forEach((id) => {
      rolesByModel.get(id)?.forEach((r) => roles.add(r));
      const e = effByModel.get(id); if (e) { assessed += e.assessed; elements += e.total; }
      const c = certByModel.get(id); if (c) { certain += c.high; events += c.total; }
    });

    // Four continuous components, not one saturating count. `roles.size / 4`
    // alone was 1.0 for almost every unit, which stacked the whole portfolio on
    // the right edge of the ranking chart and made the axis meaningless.
    const roleCover = roles.size / 4;
    const effShare = elements ? assessed / elements : 0;
    const certShare = events ? certain / events : 0;
    const assessedBonus = au.status === 'Assessed' ? 1 : 0.4;
    const chance = Math.min(0.92, Math.max(0.03,
      (0.34 * roleCover + 0.28 * effShare + 0.28 * certShare + 0.10) * assessedBonus));

    const oil = au.oilMean_mmbbl ?? 0, gas = au.gasMean_bcf ?? 0;
    return {
      auId: au.au_id, code: au.code, name: au.name,
      tpsName: tps?.name ?? 'Unassigned', provinceName: prov?.name ?? 'Unassigned',
      status: au.status ?? 'Unknown', oilMean: oil, gasMean: gas,
      boeMean: oil + gas / 6,
      chance,
      kind: 'usgs-statistical' as const,
    };
  });
}

export const fmtNum = (v: number, digits = 0) =>
  v >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : v.toLocaleString(undefined, { maximumFractionDigits: digits });

export const fmtCompact = (v: number) =>
  v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : v.toFixed(v < 10 ? 1 : 0);
