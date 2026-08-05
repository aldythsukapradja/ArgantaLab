// basin-insight.ts — turns raw catalogue records into the handful of verdicts a
// screening geologist actually wants: how mature is this basin, what's been found,
// when, by whom, and what is missing.
//
// Everything here is DERIVED from data already shipped in public/osdu/ — nothing is
// typed in by hand. Where a signal genuinely isn't in the data (burial history,
// generation timing) the model says so rather than inventing a plausible number.
//
// NOTE ON "MAJOR FIELDS": the field catalogue (GOGET) tracks *major* fields only —
// it is not a complete inventory of every accumulation. Every count produced here is
// therefore a count of major fields, and the UI must label it that way. Saying
// "24 fields" where the truth is "24 major fields" would overstate the coverage.

const base = import.meta.env.BASE_URL || '/';

export interface FieldDetail {
  fuelType: string | null;
  onshoreOffshore: string | null;
  status: string | null;
  discoveryYear: number | null;
  productionStartYear: number | null;
  operator: string | null;
  basin: string | null;
}

let detailPromise: Promise<Record<string, FieldDetail> | null> | null = null;
/** ~6 MB, so fetched once on demand and shared by every scope thereafter. */
export function loadFieldDetail() {
  if (!detailPromise) {
    detailPromise = fetch(`${base}osdu/cockpit-field-detail.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Record<string, FieldDetail>>) : null))
      .catch(() => null);
  }
  return detailPromise;
}

export interface ScopeFieldRef { id: string; name: string; country: string }

// ── per-field size (MMBOE) ───────────────────────────────────────────────────────
// Real, already-shipped data: public/osdu/cockpit-reserve-towers.json, built by
// scripts/build-cockpit-spatial.mjs from GOGET's reported reserves (oil + condensate
// + NGL in million bbl; gas converted at the standard 164.3 m³/boe factor). This is
// REPORTED RESERVES, not STOIIP — most fields (the ~45% with no reserves filing) have
// no entry at all, which must render as "no size data", never as zero.
export interface FieldSize { id: string; name: string; oil: number; gas: number; cap: number; total: number }
let towersPromise: Promise<Map<string, FieldSize> | null> | null = null;

export function loadFieldSizes() {
  if (!towersPromise) {
    towersPromise = fetch(`${base}osdu/cockpit-reserve-towers.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j?.towers ? new Map((j.towers as FieldSize[]).map((t) => [t.id, t])) : null))
      .catch(() => null);
  }
  return towersPromise;
}

export interface SizedField extends FieldSize { country: string }
export interface FieldSizeSummary {
  ranked: SizedField[];
  withSize: number;
  totalBoe: number;
  totalOil: number;
  totalGas: number;
}

export function buildFieldSizeSummary(fields: ScopeFieldRef[], sizes: Map<string, FieldSize> | null): FieldSizeSummary {
  const ranked: SizedField[] = [];
  for (const f of fields) {
    const s = sizes?.get(f.id);
    if (s && s.total > 0) ranked.push({ ...s, country: f.country });
  }
  ranked.sort((a, b) => b.total - a.total);
  return {
    ranked,
    withSize: ranked.length,
    totalBoe: ranked.reduce((s, r) => s + r.total, 0),
    totalOil: ranked.reduce((s, r) => s + r.oil, 0),
    totalGas: ranked.reduce((s, r) => s + r.gas, 0),
  };
}

// ── USGS assessed volumes ────────────────────────────────────────────────────────
// The search index carries no volumes, so undiscovered resource comes straight from
// the ingested USGS assessment polygons. These are UNDISCOVERED, TECHNICALLY
// RECOVERABLE means — not STOIIP, not in-place, not reserves in known fields. A
// province with no entry was never assessed, which is not the same as zero.
export interface AssessedVolumes { oilMean: number | null; gasMean: number | null; boeMean: number | null }
export interface AssessmentUnitRow extends AssessedVolumes { auCode: string; auName: string; tps: string | null; prvCode: string }

interface VolumeIndex { provinces: Record<string, AssessedVolumes & { name: string }>; aus: AssessmentUnitRow[] }
let volumePromise: Promise<VolumeIndex | null> | null = null;

export function loadVolumes() {
  if (!volumePromise) {
    volumePromise = Promise.all([
      fetch(`${base}world/provinces.geojson`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`${base}world/aus.geojson`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([pv, au]) => {
      if (!pv && !au) return null;
      const provinces: VolumeIndex['provinces'] = {};
      for (const f of pv?.features ?? []) {
        const p = f.properties ?? {};
        if (p.prvCode) provinces[String(p.prvCode)] = { name: p.prvName, oilMean: p.oilMean ?? null, gasMean: p.gasMean ?? null, boeMean: p.boeMean ?? null };
      }
      const aus: AssessmentUnitRow[] = (au?.features ?? []).map((f: { properties: Record<string, unknown> }) => {
        const p = f.properties ?? {};
        return {
          auCode: String(p.auCode ?? ''), auName: String(p.auName ?? ''),
          tps: (p.tps as string) ?? null, prvCode: String(p.prvCode ?? ''),
          oilMean: (p.oilMean as number) ?? null, gasMean: (p.gasMean as number) ?? null, boeMean: (p.boeMean as number) ?? null,
        };
      });
      return { provinces, aus };
    }).catch(() => null);
  }
  return volumePromise;
}

/** A year on the creaming curve.
 *
 *  `cumulative` counts discoveries; `cumBoe` sums what was actually found. The second is
 *  the one that answers "is this basin creamed" — a decade of small finds moves the
 *  count sharply while barely moving the volume, and the classic creaming curve is
 *  volume-based for exactly that reason. `boe` is per-year found volume, MMBOE. */
export interface CreamingPoint {
  year: number; count: number; cumulative: number;
  boe: number; cumBoe: number;
  /** The largest find of that year — the label worth putting on a step. */
  biggest?: { name: string; boe: number };
}

export interface BasinInsight {
  /** Major fields in scope (GOGET tracks major accumulations only). */
  total: number;
  dated: number;
  firstYear: number | null;
  lastYear: number | null;
  creaming: CreamingPoint[];
  hcMix: Array<{ key: string; n: number }>;
  statusMix: Array<{ key: string; n: number }>;
  operators: Array<{ key: string; n: number }>;
  offshore: number;
  onshore: number;
  /** Screening verdict derived from the shape of the discovery record. */
  maturity: { label: string; detail: string; tone: 'frontier' | 'emerging' | 'mature' | 'unknown' };
  producing: number;
}

const tally = (values: Array<string | null>) => {
  const m = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    const k = String(v).trim().toLowerCase();
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n);
};

/** Verdict from the *shape* of the record, not from a hand-set flag.
 *  Deliberately conservative: with too few dated discoveries we say so rather than
 *  calling a basin "frontier" on the strength of three data points. */
function verdict(dated: number, creaming: CreamingPoint[], lastYear: number | null): BasinInsight['maturity'] {
  if (!dated || !creaming.length || lastYear == null) {
    return { label: 'Unknown', detail: 'no dated discoveries in the catalogue', tone: 'unknown' };
  }
  if (dated < 5) {
    return { label: 'Frontier', detail: `${dated} dated discovery${dated === 1 ? '' : 's'} — too few to read a trend`, tone: 'frontier' };
  }
  const now = 2026;
  const span = creaming[creaming.length - 1].year - creaming[0].year;
  const cum = creaming[creaming.length - 1].cumulative;
  const recent = creaming.filter((p) => p.year > now - 20).reduce((s, p) => s + p.count, 0);
  const share = recent / cum;
  const quiet = now - lastYear;
  if (quiet > 15 && share < 0.1) {
    return { label: 'Mature', detail: `last major find ${lastYear} · ${Math.round(share * 100)}% of finds in the last 20 yr`, tone: 'mature' };
  }
  if (share > 0.35) {
    return { label: 'Active', detail: `${Math.round(share * 100)}% of major finds in the last 20 yr`, tone: 'emerging' };
  }
  return { label: 'Maturing', detail: `${span} yr of drilling · last major find ${lastYear}`, tone: 'emerging' };
}

export function buildBasinInsight(
  fields: ScopeFieldRef[],
  detail: Record<string, FieldDetail> | null,
  /** Reported reserves per field, MMBOE — the reserve towers, keyed on the same OSDU
   *  field id as `detail`. Optional: without it the curve falls back to counting. */
  sizes?: Map<string, FieldSize> | null,
): BasinInsight {
  const rows = fields.map((f) => detail?.[f.id]).filter(Boolean) as FieldDetail[];
  const years = rows.map((r) => r.discoveryYear).filter((y): y is number => typeof y === 'number' && y > 1800 && y <= 2030);

  // Volume AND count per year. A field with a discovery year but no reported reserves
  // still counts as a discovery — it just contributes nothing to the volume curve,
  // which is the honest treatment: absent is not zero, but we cannot invent a size.
  const byYear = new Map<number, { count: number; boe: number; biggest?: { name: string; boe: number } }>();
  for (const f of fields) {
    const d = detail?.[f.id];
    const y = d?.discoveryYear;
    if (typeof y !== 'number' || y <= 1800 || y > 2030) continue;
    const boe = sizes?.get(f.id)?.total ?? 0;
    const slot = byYear.get(y) ?? { count: 0, boe: 0 };
    slot.count += 1;
    slot.boe += boe;
    if (boe > 0 && (!slot.biggest || boe > slot.biggest.boe)) slot.biggest = { name: f.name, boe };
    byYear.set(y, slot);
  }
  let cum = 0, cumB = 0;
  const creaming: CreamingPoint[] = [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, s]) => ({
      year, count: s.count, cumulative: (cum += s.count),
      boe: s.boe, cumBoe: (cumB += s.boe), biggest: s.biggest,
    }));

  const statusMix = tally(rows.map((r) => r.status));
  const producing = statusMix.find((s) => s.key === 'operating')?.n ?? 0;

  return {
    total: fields.length,
    dated: years.length,
    firstYear: creaming.length ? creaming[0].year : null,
    lastYear: creaming.length ? creaming[creaming.length - 1].year : null,
    creaming,
    hcMix: tally(rows.map((r) => r.fuelType)),
    statusMix,
    operators: tally(rows.map((r) => r.operator)).slice(0, 8),
    offshore: rows.filter((r) => (r.onshoreOffshore || '').toLowerCase() === 'offshore').length,
    onshore: rows.filter((r) => (r.onshoreOffshore || '').toLowerCase() === 'onshore').length,
    maturity: verdict(years.length, creaming, creaming.length ? creaming[creaming.length - 1].year : null),
    producing,
  };
}

// ── Petroleum system events chart ────────────────────────────────────────────────
// The Magoon & Dow convention: elements and processes plotted against geologic time,
// so you can see at a glance whether the trap was there before the charge arrived.
//
// Element rows are built from the REAL stratigraphic column (ages and roles come from
// explData.STRAT_COLUMN, the same source the Exploration tab uses). Process rows —
// trap formation, generation/migration, preservation, critical moment — require a
// burial/thermal model this platform has not built yet, so they are emitted as
// explicitly UN-MODELLED rows. A blank row here is a real statement: "nobody has
// modelled this", which for most basins is the honest answer and is exactly the work
// the gap ledger tracks.

export type EventKind = 'source' | 'reservoir' | 'seal' | 'overburden' | 'process';

/** A bare lithology word standing where a formation NAME belongs — the signature of an
 *  extraction that lifted "Coal"/"Shale" out of authority prose as if it were a unit.
 *  Flagged rather than hidden: it is real data that needs normalising at source, and
 *  silently dropping it would hide the very gap the reader should see. */
const LITHOLOGY_WORDS = new Set([
  'coal', 'sandstone', 'sandstones', 'limestone', 'limestones', 'dolomite', 'shale', 'shales',
  'carbonate', 'carbonates', 'sand', 'silt', 'siltstone', 'mudstone', 'evaporite', 'evaporites',
  'anhydrite', 'salt', 'chalk', 'clastics', 'marl', 'chert', 'conglomerate', 'reef',
]);
export const isLithologyName = (unit: string) => LITHOLOGY_WORDS.has(unit.trim().toLowerCase());

export interface EventBar {
  from: number; to: number; label: string; note?: string; confidence?: string;
  citationId?: string; status?: string;
  /** True when `label` is a lithology, not a named unit — rendered as needs-normalising. */
  qcLithology?: boolean;
  /** True when this bar was obtained by rule or recall rather than from cited evidence.
   *  Rendered flagged: the chart shows the interval, but never as if it were measured. */
  derived?: boolean;
  /** Basin cycle this element belongs to — the key the tectonostratigraphy column and
   *  the events chart cross-filter each other on. */
  cycleId?: string;
}
export interface EventRow {
  key: string;
  label: string;
  kind: EventKind;
  bars: EventBar[];
  modelled: boolean;
  /** Shown when `modelled` is false — what would have to be built to fill it. */
  requires?: string;
}

export interface EventsChart {
  rows: EventRow[];
  /** Oldest → youngest bound of the time axis, in Ma. */
  span: [number, number];
  modelledRows: number;
  gapRows: number;
  periods: Array<{ id: string; name: string; from: number; to: number; parent?: string }>;
  cycles: Array<{ id: string; label: string; from: number; to: number; contribution?: string }>;
  title?: string;
  grade?: string;
  timescale?: string;
  scope?: string;
}

interface StratLike { name: string; ageMa: [number, number]; role?: string; roleNote?: string }

interface PsElementLike {
  element_id: string; unit_name: string; element_role: string; start_ma: number; end_ma: number;
  confidence?: string; effectiveness?: string; source_citation_id?: string; notes?: string;
  basin_cycle_id?: string; provenance?: string;
}
interface PsEventLike {
  event_id: string; event_type: string; label: string; start_ma?: number; end_ma?: number;
  event_status: string; certainty?: string; evidence_required?: string; source_citation_id?: string; notes?: string;
  provenance?: string;
}
interface CycleLike {
  cycle_id: string; title?: string; age_top_ma?: number; age_base_ma?: number;
  contribution?: string;
}
interface TimeLike {
  unit_id: string; name: string; start_ma: number; end_ma: number; parent_name?: string;
}

export function buildPetroleumSystemChart(
  elements: PsElementLike[], processEvents: PsEventLike[], cycles: CycleLike[], timescale: TimeLike[],
  meta: { title?: string; grade?: string; timescale?: string; scope?: string } = {},
): EventsChart {
  const elementRoles: Array<{ key: EventKind; label: string }> = [
    { key: 'source', label: 'Source rock' }, { key: 'reservoir', label: 'Reservoir rock' },
    { key: 'seal', label: 'Seal rock' }, { key: 'overburden', label: 'Overburden rock' },
  ];
  const elementRows: EventRow[] = elementRoles.map(({ key, label }) => {
    const bars = elements.filter((e) => e.element_role === key).map((e) => ({
      from: Math.max(e.start_ma, e.end_ma), to: Math.min(e.start_ma, e.end_ma), label: e.unit_name,
      note: [e.effectiveness, e.notes].filter(Boolean).join(' · '), confidence: e.confidence,
      citationId: e.source_citation_id, status: 'modelled', cycleId: e.basin_cycle_id,
      qcLithology: isLithologyName(e.unit_name),
      derived: e.provenance === 'derived-rule' || e.provenance === 'literature-recalled',
    })).sort((a, b) => b.from - a.from);
    return { key, label, kind: key, bars, modelled: bars.length > 0, requires: bars.length ? undefined : `${label.toLowerCase()} interpretation` };
  });
  const processRows: EventRow[] = processEvents.map((e) => {
    const hasTime = Number.isFinite(e.start_ma) && Number.isFinite(e.end_ma);
    // 'derived' rows carry a numeric interval obtained by rule, not by evidence. They
    // DRAW — leaving them blank would misreport a reasoned inference as an untouched
    // gap — but they draw flagged, so the chart never passes inference off as evidence.
    const derived = e.event_status === 'derived';
    const modelled = (e.event_status === 'modelled' || derived) && hasTime;
    return {
      key: e.event_id, label: e.label, kind: 'process', modelled,
      bars: modelled ? [{ from: Math.max(e.start_ma!, e.end_ma!), to: Math.min(e.start_ma!, e.end_ma!), label: e.label, note: e.notes, confidence: e.certainty, citationId: e.source_citation_id, status: e.event_status, derived }] : [],
      requires: e.evidence_required || 'reviewed timing evidence',
    };
  });
  const values = [...elements.flatMap((e) => [e.start_ma, e.end_ma]), ...processEvents.flatMap((e) => [e.start_ma, e.end_ma]).filter((v): v is number => Number.isFinite(v))];
  const oldest = Math.ceil(Math.max(250, ...values) / 10) * 10;
  const span: [number, number] = [oldest, 0];
  const periodRows = timescale.filter((p) => p.end_ma < oldest && p.start_ma > 0).map((p) => ({
    id: p.unit_id, name: p.name, from: Math.min(oldest, p.start_ma), to: Math.max(0, p.end_ma), parent: p.parent_name,
  })).sort((a, b) => b.from - a.from);
  const cycleRows = cycles.filter((c) => Number.isFinite(c.age_top_ma) && Number.isFinite(c.age_base_ma)).map((c) => ({
    id: c.cycle_id, label: c.title || c.cycle_id, from: Math.max(c.age_top_ma!, c.age_base_ma!),
    to: Math.min(c.age_top_ma!, c.age_base_ma!), contribution: c.contribution,
  })).sort((a, b) => b.from - a.from);
  const rows = [...elementRows, ...processRows];
  return { ...meta, rows, span, periods: periodRows, cycles: cycleRows, modelledRows: rows.filter((r) => r.modelled).length, gapRows: rows.filter((r) => !r.modelled).length };
}

export function buildEventsChart(units: StratLike[]): EventsChart {
  const pick = (role: string) => units.filter((u) => (u.role || '').toLowerCase() === role);
  const toBars = (list: StratLike[]): EventBar[] => list
    .map((u) => ({ from: Math.max(u.ageMa[0], u.ageMa[1]), to: Math.min(u.ageMa[0], u.ageMa[1]), label: u.name, note: u.roleNote }))
    .sort((a, b) => b.from - a.from);

  const oldest = units.reduce((m, u) => Math.max(m, u.ageMa[0], u.ageMa[1]), 0);
  const span: [number, number] = [Math.ceil(oldest / 10) * 10 || 250, 0];

  const rows: EventRow[] = [
    { key: 'source', label: 'Source rock', kind: 'source', bars: toBars(pick('source')), modelled: true },
    { key: 'reservoir', label: 'Reservoir rock', kind: 'reservoir', bars: toBars(pick('reservoir')), modelled: true },
    { key: 'seal', label: 'Seal rock', kind: 'seal', bars: toBars(pick('seal')), modelled: true },
    { key: 'overburden', label: 'Overburden rock', kind: 'overburden', bars: toBars(pick('overburden')), modelled: true },
    { key: 'trap', label: 'Trap formation', kind: 'process', bars: [], modelled: false, requires: 'structural restoration' },
    { key: 'gen', label: 'Generation · migration', kind: 'process', bars: [], modelled: false, requires: 'burial & thermal model' },
    { key: 'preserve', label: 'Preservation', kind: 'process', bars: [], modelled: false, requires: 'uplift / breach analysis' },
    { key: 'critical', label: 'Critical moment', kind: 'process', bars: [], modelled: false, requires: 'burial & thermal model' },
  ].map((r) => ({ ...r, modelled: r.modelled && r.bars.length > 0 })) as EventRow[];

  return { rows, span, periods: [], cycles: [], modelledRows: rows.filter((r) => r.modelled).length, gapRows: rows.filter((r) => !r.modelled).length };
}
