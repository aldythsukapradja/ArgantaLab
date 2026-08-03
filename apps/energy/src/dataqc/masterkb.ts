// dataqc/masterkb.ts — resolve ingested assets into the ArgantaEnergy Master KB.
//
// This is the "everything talks to everything" link. An uploaded log is not just a
// file: it belongs to a wellbore, of a well, in a field, in a basin, in a province,
// in a region — and the Master KB workbook (29 sheets, zero-orphan FKs) is the
// authored source of truth for that chain.
//
// Bridge: the KB keys on Sodir/authority ids (`atlas:field:sodir:3420717`), the app
// scopes on OSDU ids (`arganta:master-data--Field:no-field-3420717`). Both carry the
// same native authority number, so the join is exact, not fuzzy.
const BASE = import.meta.env.BASE_URL || '/';

export interface KbField {
  field_id: string; name: string; basin_id?: string; country_id?: string;
  operator?: string; discovery_year?: number; discovery_well?: string;
  status?: string; hc_type?: string; crs?: string; datum?: string;
}
export interface KbWell { well_id: string; field_id: string; x?: number; y?: number; crs?: string }
export interface KbWellbore {
  wellbore_id: string; well_id: string; role?: string; is_exploration?: string;
  td_md_m?: number; td_tvd_m?: number; kb?: string;
  has_logs?: string; has_traj?: string; has_production?: string; has_picks?: string;
}
export interface KbNamed { name?: string; code?: string }

export interface KbSpine {
  version: string; counts: Record<string, number>;
  region: Array<KbNamed & { region_id: string }>;
  country: Array<KbNamed & { country_id: string; oilMean_mmbbl?: number; gasMean_bcf?: number }>;
  province: Array<KbNamed & { province_id: string; region_id?: string; assessed?: string; oilMean_mmbbl?: number; gasMean_bcf?: number }>;
  basin: Array<KbNamed & { basin_id: string; setting?: string; province_id?: string }>;
  petroleumSystem: Array<KbNamed & { tps_id: string; province_id?: string; source_rock_formation?: string }>;
  assessmentUnit: Array<KbNamed & { au_id: string; tps_id?: string; status?: string; oilMean_mmbbl?: number; gasMean_bcf?: number }>;
  basinCycle: Array<{ cycle_id: string; title?: string; basin_id?: string; age_top_ma?: number; age_base_ma?: number; geodynamics?: string }>;
  stratigraphy: Array<{ unit_name: string; group?: string; age_top_ma?: number; age_base_ma?: number; environment?: string; ps_role?: string }>;
  well: KbWell[];
  wellbore: KbWellbore[];
  reservoir: Array<{ reservoir_id: string; field_id: string; formation_name?: string; age?: string; lithology?: string; drive_mechanism?: string }>;
}

let spinePromise: Promise<KbSpine | null> | null = null;
export function loadKbSpine(): Promise<KbSpine | null> {
  if (!spinePromise) {
    spinePromise = fetch(`${BASE}kb/master-kb-spine.json`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return spinePromise;
}

let fieldsPromise: Promise<KbField[]> | null = null;
export function loadKbFields(): Promise<KbField[]> {
  if (!fieldsPromise) {
    fieldsPromise = fetch(`${BASE}kb/master-kb-fields.json`)
      .then((r) => (r.ok ? r.json() : { field: [] }))
      .then((j) => (Array.isArray(j.field) ? j.field : []))
      .catch(() => []);
  }
  return fieldsPromise;
}

/** Pull the authority number out of either id form.
 *  `arganta:master-data--Field:no-field-3420717` → `3420717`
 *  `atlas:field:sodir:3420717`                   → `3420717` */
export const authorityKey = (id: string): string => {
  const tail = id.split(':').pop() ?? id;
  const digits = tail.match(/(\d{3,})/);
  return digits ? digits[1] : tail.toLowerCase();
};

export interface KbContext {
  field: KbField | null;
  basin: (KbNamed & { basin_id: string; setting?: string }) | null;
  province: (KbNamed & { province_id: string; assessed?: string; oilMean_mmbbl?: number; gasMean_bcf?: number }) | null;
  region: (KbNamed & { region_id: string }) | null;
  country: (KbNamed & { country_id: string }) | null;
  petroleumSystems: Array<KbNamed & { tps_id: string; source_rock_formation?: string }>;
  assessmentUnits: Array<KbNamed & { au_id: string; status?: string }>;
  wells: KbWell[];
  wellbores: KbWellbore[];
  reservoirs: KbSpine['reservoir'];
  stratigraphy: KbSpine['stratigraphy'];
  basinCycles: KbSpine['basinCycle'];
}

/** Walk field → basin → province → region, plus the wells/wellbores beneath it. */
export async function resolveKbContext(osduFieldId: string): Promise<KbContext | null> {
  const spine = await loadKbSpine();
  if (!spine) return null;
  const key = authorityKey(osduFieldId);

  const fields = await loadKbFields();
  const field = fields.find((f) => authorityKey(f.field_id) === key) ?? null;

  const basin = field?.basin_id ? spine.basin.find((b) => b.basin_id === field.basin_id) ?? null : null;
  const province = basin?.province_id ? spine.province.find((p) => p.province_id === basin.province_id) ?? null : null;
  const region = province?.region_id ? spine.region.find((r) => r.region_id === province.region_id) ?? null : null;
  const country = field?.country_id ? spine.country.find((c) => c.country_id === field.country_id) ?? null : null;

  const petroleumSystems = province ? spine.petroleumSystem.filter((t) => t.province_id === province.province_id) : [];
  const tpsIds = new Set(petroleumSystems.map((t) => t.tps_id));
  const assessmentUnits = spine.assessmentUnit.filter((a) => a.tps_id && tpsIds.has(a.tps_id));

  const wells = field ? spine.well.filter((w) => w.field_id === field.field_id) : [];
  const wellIds = new Set(wells.map((w) => w.well_id));
  const wellbores = spine.wellbore.filter((wb) => wellIds.has(wb.well_id));
  const reservoirs = field ? spine.reservoir.filter((r) => r.field_id === field.field_id) : [];
  const basinCycles = basin ? spine.basinCycle.filter((c) => c.basin_id === basin.basin_id) : [];

  return {
    field, basin, province, region, country,
    petroleumSystems, assessmentUnits, wells, wellbores, reservoirs,
    stratigraphy: spine.stratigraphy, basinCycles,
  };
}

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Resolve one asset's well name to a KB wellbore/well. The KB's wellbore ids are
 *  authority slugs (`atlas:wellbore:sodir:f-10`), which match the bundle's own well
 *  slugs exactly — so this is an id join, not a name guess. */
export function resolveWellbore(ctx: KbContext, wellName: string): { wellbore: KbWellbore | null; well: KbWell | null } {
  const s = slug(wellName);
  const wellbore = ctx.wellbores.find((wb) => authoritySlug(wb.wellbore_id) === s) ?? null;
  const well = wellbore
    ? ctx.wells.find((w) => w.well_id === wellbore.well_id) ?? null
    : ctx.wells.find((w) => authoritySlug(w.well_id) === s) ?? null;
  return { wellbore, well };
}

const authoritySlug = (id: string) => (id.split(':').pop() ?? id).toLowerCase();
