// curate.ts — group the flat asset inventory by WELLBORE and rank by completeness, so
// the delivery list reads the way a subsurface team would triage it: producers and
// injectors carrying trajectory + full logs + production first, appraisal/exploration
// wellbores next, unclassified last. Field-wide assets (surfaces, patterns, the field
// production rollup, reports) are not a wellbore and sit in their own bucket.
//
// Pure and deterministic — no fabrication. Role and exploration-flag come ONLY from the
// Master KB wellbore spine (the authority already used by the side-panel Master KB
// card). A wellbore the KB does not carry is classified from the data it actually has
// (a well with an ingested production asset IS a producer, KB match or not) rather than
// left blank — but it is flagged `roleFromKb: false` so the UI can say where the
// classification came from.
import type { IngestedAsset } from './types.ts';
import type { KbContext, KbWellbore } from './masterkb.ts';
import { wellKey } from './audit.ts';

// Deliberately NOT importing masterkb.ts's `resolveWellbore` — that module reads
// `import.meta.env` at module scope, which breaks under a plain node test runner (the
// same cross-import limitation documented on engine/sim/fv.ts). The lookup itself is
// two lines, so it is inlined here to keep this module pure and node-testable.
const authoritySlug = (id: string) => (id.split(':').pop() ?? id).toLowerCase();
const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function findWellbore(ctx: KbContext | null, wellName: string): KbWellbore | null {
  if (!ctx) return null;
  const s = slug(wellName);
  return ctx.wellbores.find((wb) => authoritySlug(wb.wellbore_id) === s) ?? null;
}

/** Wellbore role, taken from the REGULATOR's purpose+content (Sodir), not inferred
 *  from whether a production file happens to exist. The distinction that matters:
 *  a PRODUCTION well whose content is WATER is a water-supply well, not an oil
 *  producer — Volve's F-7 / F-9 / F-9 A are exactly that. */
export type WellRole =
  | 'oil-producer' | 'water-injector'
  | 'observation' | 'appraisal' | 'exploration'
  | 'water-supply'   // shallow aquifer well feeding the injectors — NOT a reservoir well
  | 'not-drilled' | 'unclassified';

export const ROLE_LABEL: Record<WellRole, string> = {
  'oil-producer': 'Oil producer', 'water-injector': 'Water injector',
  observation: 'Observation', appraisal: 'Appraisal', exploration: 'Exploration',
  'water-supply': 'Water supply', 'not-drilled': 'Never drilled', unclassified: 'Unclassified',
};

/** Sort priority only — never displayed. The wells that move fluid first, then the
 *  observation/appraisal bores, then anything unclassifiable. */
/** The order a subsurface team triages the well stock: what made oil, what supported
 *  pressure, then the wells drilled to learn something, then support and unknowns. */
const ROLE_RANK: Record<WellRole, number> = {
  'oil-producer': 0, 'water-injector': 1,
  appraisal: 2, exploration: 2,
  observation: 3, 'water-supply': 4,
  unclassified: 5, 'not-drilled': 6,
};

type CompletenessFlag = 'hasLogs' | 'hasTrajectory' | 'hasProduction' | 'hasInjection'
  | 'hasPicks' | 'hasDrilling' | 'hasPressure';
const KIND_FLAG: Partial<Record<IngestedAsset['kind'], CompletenessFlag>> = {
  log: 'hasLogs', trajectory: 'hasTrajectory', production: 'hasProduction',
  injection: 'hasInjection', picks: 'hasPicks',
  drilling: 'hasDrilling', pressure: 'hasPressure',
};
/** Display order for the completeness capsule, and the 7 tracked data types. */
export const COMPLETENESS_KINDS: Array<{ flag: CompletenessFlag; label: string }> = [
  { flag: 'hasLogs', label: 'Logs' }, { flag: 'hasTrajectory', label: 'Trajectory' },
  { flag: 'hasPicks', label: 'Tops' },
  { flag: 'hasProduction', label: 'Production' }, { flag: 'hasInjection', label: 'Injection' },
  { flag: 'hasDrilling', label: 'Drilling' }, { flag: 'hasPressure', label: 'Pressure' },
];

export interface WellGroup {
  key: string; well: string;
  role: WellRole; roleFromKb: boolean;
  assets: IngestedAsset[];
  hasLogs: boolean; hasTrajectory: boolean; hasProduction: boolean; hasInjection: boolean; hasPicks: boolean;
  hasDrilling: boolean; hasPressure: boolean;
  /** how many of the 7 tracked data types this wellbore actually carries, 0–7 */
  completeness: number;
  /** picks attributed from the ONE delivery-wide picks asset (see picksByWell below) —
   *  no per-well picks asset exists, so this is a count + a shared asset id to open,
   *  not a row in `assets` */
  picksCount: number | null;
  picksAssetId: string | null;
  /** this wellbore has no trajectory of its OWN, but a sibling wellbore drilled from
   *  the SAME slot (Master KB well_id — e.g. "F-11 A" and "F-11" are both slot F-11)
   *  does. The sidetrack's spatial path is unknown without it, so surfacing the
   *  sibling's is the honest next-best thing — never fabricated as this well's own. */
  trajectoryVia: { well: string; assetId: string } | null;
  /** reports whose deterministic entity extraction named this wellbore — duplicated
   *  across every well they mention, on purpose (a report about the field context
   *  belongs to each well it discusses, not to one arbitrary owner) */
  linkedDocuments: IngestedAsset[];
}

/** WELLHEAD = the surface slot. Under it sits the mother bore and its sidetracks.
 *  This is the real asset structure, and getting it wrong misreads the field: Volve's
 *  F-11 mother bore reaches only 347 m and was sidetracked immediately, yet production
 *  is filed against the bare name "F-11". Flattening the four F-11 bores into peers
 *  makes a 347 m stub look like a producer. */
export interface WellheadGroup {
  well: string;
  bores: WellGroup[];
  /** union of what exists anywhere under this slot */
  role: WellRole;
  completeness: number;
  motherBore: string | null;
  /** deepest terminal bore — the one that reached the reservoir last */
  deepestBore: string | null;
  /** the bore the production series is FILED against (may be the wellhead name) */
  productionFiledOn: string | null;
  /** the bore the volumes can physically have come from */
  producedBy: string | null;
  /** why producedBy differs from productionFiledOn — null when they agree */
  productionBasis: string | null;
  /** parent bores named by drilled_from that we hold no record for */
  missingAncestors: string[];
  /** measured performance, attributed to the bore the volumes came FROM */
  metrics: WellMetrics | null;
}

export interface CuratedInventory {
  /** flat per-wellbore view (kept — the audit and kind filters still use it) */
  groups: WellGroup[];
  /** the real hierarchy: one node per surface slot */
  wellheads: WellheadGroup[];
  /** assets that describe the whole field rather than one wellbore */
  fieldLevel: IngestedAsset[];
}

/** Measured production performance for one wellbore, from the monthly series. */
export interface WellMetrics {
  cumOilSm3: number; cumGasSm3: number; cumWaterSm3: number; cumInjectedSm3: number;
  firstFlow: string | null; lastFlow: string | null; months: number;
  peakOilRateSm3d: number | null; peakOilMonth: string | null;
  lastOilRateSm3d: number | null; lastOilMonth: string | null;
  lastWaterCut: number | null;
  /** share of the FIELD's cumulative oil. A per-well RECOVERY FACTOR is deliberately
   *  absent: it needs a per-well in-place volume that no source in this delivery
   *  provides, and inventing one would be a fabrication. Field RF comes from the
   *  regulator's official STOIIP instead. */
  shareOfFieldCumPct: number | null;
}

/** Wellhead metadata resolved by the build from each bore's own `drilled_from`
 *  (NPD survey header) — never from parsing the name, because "F-11 A" is drilled
 *  from F-11 T2, not from F-11. */
export interface WellheadSpec {
  well: string; bores: string[];
  motherBore?: string | null; deepestBore?: string | null;
  productionFiledOn?: string | null; producedBy?: string | null;
  productionBasis?: string | null; missingAncestors?: string[];
}

const FIELD_SENTINEL = /^(field|total|all)$/i;

export interface CurateOptions {
  /** picks arrive as ONE delivery-wide asset (picks.json); the caller reads its
   *  digest and attributes counts per well — mirrors audit.ts's buildAudit input. */
  picksByWell?: Map<string, number>;
  picksAssetId?: string | null;
  /** wellhead→wellbore genealogy from the bundle index. Absent for a client upload,
   *  in which case the slot is derived from the bore name as a best effort. */
  wellheads?: WellheadSpec[];
  /** REGULATOR-published role per wellbore (Sodir purpose+content), keyed by wellKey.
   *  The authority for what a bore is FOR — outranks anything inferred from the data. */
  rolesByBore?: Map<string, WellRole>;
  /** measured production metrics per wellbore, keyed by wellKey */
  metricsByBore?: Map<string, WellMetrics>;
}

/** Fallback slot when no genealogy is supplied: the leading well token.
 *  "F-11 B" → "F-11", "19 BT2" → "19", "F-12 pilot" → "F-12". */
const slotOfBore = (n: string) => (n.match(/^(F-\d+|\d+)(?=\s|$)/) || [])[1] ?? n;

export function curateInventory(assets: IngestedAsset[], kb: KbContext | null, opts: CurateOptions = {}): CuratedInventory {
  const groups = new Map<string, WellGroup>();
  const fieldLevel: IngestedAsset[] = [];

  const makeGroup = (wellName: string): WellGroup => ({
    key: wellKey(wellName), well: wellName, role: 'unclassified', roleFromKb: false, assets: [],
    hasLogs: false, hasTrajectory: false, hasProduction: false, hasInjection: false, hasPicks: false,
    hasDrilling: false, hasPressure: false,
    completeness: 0, picksCount: null, picksAssetId: null, trajectoryVia: null, linkedDocuments: [],
  });

  for (const a of assets) {
    const raw = typeof a.meta.well === 'string' ? a.meta.well.trim() : '';
    const wellName = FIELD_SENTINEL.test(raw) ? '' : raw;
    // documents are handled in a dedicated pass below (they attach to every well they
    // MENTION, not to a single owning well) — never grouped here even when a `well`
    // meta field happens to be present
    if (!wellName || a.kind === 'document') { fieldLevel.push(a); continue; }

    const key = wellKey(wellName);
    let g = groups.get(key);
    if (!g) { g = makeGroup(wellName); groups.set(key, g); }
    g.assets.push(a);
    // a real asset name beats an id-derived placeholder well string
    if (g.well !== wellName && /^[a-z0-9-]+$/i.test(g.well) === false) g.well = wellName;
    const flag = KIND_FLAG[a.kind];
    if (flag) g[flag] = true;
    // a producing well that ALSO shows injected volume (bundle.ts's cumInjectedSm3
    // convention on the production asset) reads as injecting too
    if (a.kind === 'production' && Number(a.meta.cumInjectedSm3) > 0) g.hasInjection = true;
  }

  // ── picks: attribute the shared delivery-wide asset per well ──────────────────
  if (opts.picksByWell) {
    for (const [key, n] of opts.picksByWell) {
      const g = groups.get(key);
      if (!g || n <= 0) continue;
      g.hasPicks = true; g.picksCount = n; g.picksAssetId = opts.picksAssetId ?? null;
    }
  }

  // ── documents: attach to EVERY wellbore they mention, duplicates intentional ───
  for (const a of assets) {
    if (a.kind !== 'document' || !a.linked?.matched?.length) continue;
    for (const name of a.linked.matched) {
      const g = groups.get(wellKey(name));
      if (g && !g.linkedDocuments.some((d) => d.id === a.id)) g.linkedDocuments.push(a);
    }
  }

  // ── role + slot lookup, using the Master KB well_id as the authoritative "which
  // wellbores share one physical slot" link (NOT a guessed name-suffix rule) ────────
  const wellboreOf = new Map<string, KbWellbore | null>();
  for (const g of groups.values()) wellboreOf.set(g.key, findWellbore(kb, g.well));

  for (const g of groups.values()) {
    const wellbore = wellboreOf.get(g.key) ?? null;
    // AUTHORITY ORDER. The regulator's published purpose (Sodir `purpose` + `content`,
    // resolved by the build) is the truth and comes first — it is the only source that
    // distinguishes an oil producer from a water-supply well, or an observation bore
    // from the producing sidetrack beside it. Only when no regulator row exists do we
    // fall back to what the ingested data shows the bore doing.
    const regulated = opts.rolesByBore?.get(g.key) ?? null;
    if (regulated) {
      g.roleFromKb = true;
      g.role = regulated;
    } else if (g.hasProduction || g.hasInjection) {
      // no regulator row (a pilot hole, an unregistered technical sidetrack) — say
      // what it flowed, and be explicit that this is inferred, not published
      g.role = g.hasProduction ? 'oil-producer' : 'water-injector';
    } else if (wellbore?.is_exploration === 'Y') {
      g.roleFromKb = true;
      g.role = 'exploration';
    } else if (wellbore) {
      g.roleFromKb = true;
      g.role = 'appraisal'; // a KB-known wellbore, no regulator purpose
    } else {
      g.role = 'unclassified'; // nothing knows what this bore is for
    }

    // trajectory-via-sibling: only when THIS wellbore has none of its own, the KB
    // resolves it to a slot (well_id), and some OTHER group sharing that slot does
    if (!g.hasTrajectory && wellbore?.well_id) {
      for (const other of groups.values()) {
        if (other.key === g.key || !other.hasTrajectory) continue;
        const otherWb = wellboreOf.get(other.key);
        if (otherWb?.well_id !== wellbore.well_id) continue;
        const trajAsset = other.assets.find((x) => x.kind === 'trajectory');
        if (trajAsset) { g.trajectoryVia = { well: other.well, assetId: trajAsset.id }; break; }
      }
    }

    g.completeness = COMPLETENESS_KINDS.filter(({ flag }) => g[flag]).length;
  }

  const list = [...groups.values()].sort((a, b) =>
    ROLE_RANK[a.role] - ROLE_RANK[b.role]
    || b.completeness - a.completeness
    || a.well.localeCompare(b.well, 'en', { numeric: true }));

  // ── roll the flat bores up into their WELLHEAD ───────────────────────────────
  const specByBore = new Map<string, WellheadSpec>();
  for (const spec of opts.wellheads ?? []) for (const b of spec.bores) specByBore.set(wellKey(b), spec);

  const headMap = new Map<string, { spec: WellheadSpec | null; bores: WellGroup[] }>();
  for (const g of list) {
    const spec = specByBore.get(g.key) ?? null;
    const wellName = spec?.well ?? slotOfBore(g.well);
    const h = headMap.get(wellName) ?? { spec, bores: [] };
    if (spec && !h.spec) h.spec = spec;
    h.bores.push(g);
    headMap.set(wellName, h);
  }

  const wellheads: WellheadGroup[] = [...headMap.entries()].map(([well, h]) => {
    // the wellhead's role is the strongest role any of its bores carries — a slot
    // with a producing sidetrack IS a producer, even though its mother bore is not
    const roles = h.bores.map((b) => b.role);
    const role: WellRole = roles.find((r) => r === 'oil-producer')
      ?? roles.find((r) => r === 'water-injector')
      ?? roles.find((r) => r === 'appraisal' || r === 'exploration')
      ?? roles.find((r) => r === 'observation')
      ?? roles.find((r) => r === 'water-supply')
      ?? 'unclassified';
    // completeness at the slot = what exists ANYWHERE under it, since the bores are
    // one physical well and a log on the mother describes the same rock
    const completeness = COMPLETENESS_KINDS.filter(({ flag }) => h.bores.some((b) => b[flag])).length;
    return {
      well, bores: h.bores, role, completeness,
      motherBore: h.spec?.motherBore ?? null,
      deepestBore: h.spec?.deepestBore ?? null,
      productionFiledOn: h.spec?.productionFiledOn ?? null,
      producedBy: h.spec?.producedBy ?? null,
      productionBasis: h.spec?.productionBasis ?? null,
      missingAncestors: h.spec?.missingAncestors ?? [],
      // metrics live on whichever bore the series is FILED against; the wellhead shows
      // them because that is the level production is actually reported at
      metrics: h.bores.map((b) => opts.metricsByBore?.get(b.key)).find(Boolean) ?? null,
    };
  }).sort((a, b) =>
    // role band first, then — for anything that flowed — by how much it actually
    // MADE, which is how a subsurface team ranks a well stock. Completeness only
    // breaks ties between wells that never flowed.
    ROLE_RANK[a.role] - ROLE_RANK[b.role]
    || (b.metrics?.cumOilSm3 ?? 0) - (a.metrics?.cumOilSm3 ?? 0)
    || (b.metrics?.cumInjectedSm3 ?? 0) - (a.metrics?.cumInjectedSm3 ?? 0)
    || b.completeness - a.completeness
    || a.well.localeCompare(b.well, 'en', { numeric: true }));

  return {
    groups: list,
    wellheads,
    fieldLevel: fieldLevel.sort((a, b) => a.kind.localeCompare(b.kind) || a.fileName.localeCompare(b.fileName)),
  };
}
