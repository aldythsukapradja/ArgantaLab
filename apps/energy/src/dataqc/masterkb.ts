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
export interface KbPsModel {
  model_id: string; tps_id: string; scope_type: string; scope_id: string; title: string;
  completeness_grade: string; timescale_version?: string; status?: string; author?: string;
  reviewer?: string; version?: string; valid_from?: string; provenance?: string;
  source_citation_id?: string; notes?: string;
}
export interface KbPsElement {
  element_id: string; model_id: string; unit_name: string; element_role: string;
  start_ma: number; end_ma: number; effectiveness?: string; confidence?: string;
  basin_cycle_id?: string; provenance?: string; source_citation_id?: string; notes?: string;
}
export interface KbPsEvent {
  event_id: string; model_id: string; event_type: string; label: string;
  start_ma?: number; end_ma?: number; event_status: string; certainty?: string;
  basin_cycle_id?: string; related_element_ids?: string; provenance?: string;
  source_citation_id?: string; evidence_required?: string; notes?: string;
}
export interface KbGeologicTimeUnit {
  timescale_version: string; rank: string; unit_id: string; name: string;
  start_ma: number; end_ma: number; parent_name?: string; source_citation_id?: string;
}

/** Authored per-basin readiness scoring (Basin Completion tab). `completion_pct` is a
 *  weighted roll-up of the milestones in `basinCompletionRule` — it measures DATA
 *  readiness, never prospectivity. */
export interface KbBasinCompletion {
  basin_id: string; basin_name?: string; province_code?: string; province_name?: string;
  tps_count?: number; au_count?: number; classification_status?: string;
  cycle_count?: number; model_count?: number; timed_element_model_count?: number;
  timed_process_model_count?: number; source_connected?: string;
  completion_stage?: string; completion_pct?: number;
  primary_gap?: string; next_action?: string; source_citation_ids?: string;
}
export interface KbCompletionRule { milestone: string; weight?: number; completion_test?: string }

/** Per-MODEL chart readiness. A complete petroleum-system chart is 11 canonical rows
 *  (4 essential elements + 7 processes); `chart_row_completion_pct` is how many are
 *  drawn, and `next_gap` names the single next row to close.
 *
 *  GRADE LADDER — these are separate milestones and must not be conflated:
 *    G0 catalogue identity · G1 evidence-derived framework · G2 complete + peer checked
 *    G3 burial/thermal calibrated · G4 technically reviewed and approved
 *  A `modelled` process row means an evidence-derived numerical interval exists — it is
 *  NOT a claim that burial history was calibrated. */
export interface KbChartCompletion {
  model_id: string; tps_id?: string; tps_code?: string | number; tps_name?: string;
  basin_id?: string; basin_name?: string; scope_type?: string; scope_id?: string;
  chart_title?: string; model_grade?: string;
  element_bar_count?: number; element_role_count?: number; timed_process_count?: number;
  critical_moment_status?: string; chart_row_completion_pct?: number;
  remaining_chart_rows?: number; next_gap?: string;
  source_citation_ids?: string; review_stage?: string;
}

/** RAW AUTHORITY EVIDENCE — candidate formations / process statements lifted from USGS
 *  narrative text. These carry *reported age terms* ("Upper Jurassic"), NOT numeric
 *  ages, so they can never be drawn as timed bars; they exist to show what the source
 *  says and what a reviewer still has to normalise. */
export interface KbElementCandidate {
  candidate_id: string; source_vintage?: string; au_code?: string; tps_code?: string;
  element_role?: string; unit_candidates?: string; reported_age_terms?: string;
  authority_evidence?: string; candidate_status?: string; confidence?: string;
  source_reference?: string; source_citation_id?: string; review_action?: string;
}
export interface KbProcessEvidence {
  process_evidence_id: string; source_vintage?: string; au_code?: string; tps_code?: string;
  event_type?: string; reported_age_terms?: string; authority_evidence?: string;
  evidence_status?: string; certainty?: string; source_reference?: string;
  source_citation_id?: string; review_action?: string;
}

export interface KbSpine {
  version: string; counts: Record<string, number>;
  region: Array<KbNamed & { region_id: string }>;
  country: Array<KbNamed & { country_id: string; oilMean_mmbbl?: number; gasMean_bcf?: number }>;
  province: Array<KbNamed & { province_id: string; region_id?: string; assessed?: string; oilMean_mmbbl?: number; gasMean_bcf?: number }>;
  basin: Array<KbNamed & {
    basin_id: string; setting?: string; province_id?: string;
    classification_status?: string; classification_basis?: string; classification_citation_id?: string;
  }>;
  petroleumSystem: Array<KbNamed & { tps_id: string; province_id?: string; source_rock_formation?: string; essential_elements_note?: string; generation_migration_note?: string; provenance?: string; source_citation_id?: string }>;
  assessmentUnit: Array<KbNamed & { au_id: string; tps_id?: string; status?: string; oilMean_mmbbl?: number; gasMean_bcf?: number }>;
  /** Formations as entities. `aliases` carries every raw unit-name string that
   *  clustered into this unit, which is what lets an element or a figure resolve to a
   *  formation without fuzzy matching at read time. Parent unit and nomenclature
   *  authority are deliberately NOT asserted — those need the literature. */
  formation: Array<{ formation_id: string; canonical_name: string; rank?: string; aliases?: string; alias_count?: number; parent_unit?: string; lithology_hint?: string; age_hint?: string; basin_ids?: string; basin_count?: number; occurrence_count?: number; source_tables?: string; provenance?: string; review_status?: string }>;
  /** Governed figure evidence. `redistribution_status` is the ONLY field the UI may
   *  gate on — not licence, and not whether a file happens to exist. A USGS report is
   *  public domain, but figures reproduced inside it from third parties are not. */
  figureRegistry: Array<{ figure_id: string; title?: string; figure_scope?: string; figure_type: string; formation_id?: string; basin_id?: string; tps_id?: string; field_id?: string; source_citation_id?: string; source_url?: string; doi?: string; publication_year?: number; page?: number; figure_number?: number; caption?: string; authority_type?: string; geographic_scope?: string; age_scope?: string; content_summary?: string; decision_use?: string; resolution_quality?: string; scientific_quality?: string; licence_status?: string; redistribution_status?: string; local_asset_path?: string; thumbnail_allowed?: string; candidate_score?: number; score_coverage_pct?: number; preferred_for_scope?: string; superseded_by?: string; review_status?: string; reviewer_notes?: string }>;
  /** Junction: which entities use a figure, and which figure is preferred for each.
   *  Preference lives here, not on the figure — a chart preferred for one basin may be
   *  an alternate for its neighbour. */
  figureLinks: Array<{ figure_link_id: string; figure_id: string; entity_type?: string; entity_id?: string; relationship?: string; relevance_rank?: number; preferred_for_scope?: string; notes?: string }>;
  /** Tectonostratigraphic cycles. `citation_status` is the audit state of the row's
   *  geology, independent of `provenance`: 'recalled' = model parametric knowledge, no
   *  source consulted (cites C-RECALL-UNVERIFIED); 'verified' = checked but citation not
   *  yet recorded; 'cited' = a real source_citation_id is attached. Note `age_top_ma` is
   *  the OLDER bound here — read both via Math.max/Math.min, never assume orientation. */
  basinCycle: Array<{ cycle_id: string; title?: string; basin_id?: string; stage?: string; age_top_ma?: number; age_base_ma?: number; geodynamics?: string; fill?: string; lithology?: string; dominant_role?: string; units?: string; provenance?: string; source_citation_id?: string; citation_status?: string; confidence?: string }>;
  stratigraphy: Array<{ unit_name: string; group?: string; age_top_ma?: number; age_base_ma?: number; environment?: string; ps_role?: string; role_note?: string; cycle_id?: string; provenance?: string; source_citation_id?: string }>;
  psModel: KbPsModel[];
  psElement: KbPsElement[];
  psEvent: KbPsEvent[];
  psCycle: Array<{ tps_id: string; cycle_id: string; contribution?: string; notes?: string }>;
  geologicTimescale: KbGeologicTimeUnit[];
  citation: Array<{ citation_id: string; authority?: string; year?: number; title?: string; publisher?: string; url?: string; license?: string; provenance_note?: string }>;
  well: KbWell[];
  wellbore: KbWellbore[];
  reservoir: Array<{ reservoir_id: string; field_id: string; formation_name?: string; age?: string; lithology?: string; drive_mechanism?: string }>;
  basinCompletion: KbBasinCompletion[];
  basinCompletionRule: KbCompletionRule[];
  psChartCompletion: KbChartCompletion[];
  psElementCandidate: KbElementCandidate[];
  psProcessEvidence: KbProcessEvidence[];
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
  /** the SAME petroleum-system elements the Exploration tab's Basin Dossier reads
   *  (element_role/effectiveness/confidence per formation) — every psModel scoped to
   *  this field's province, so a formation surface can show its real PS role, not just
   *  the coarser stratigraphy.ps_role. See dataqc/surface-context.ts. */
  psElements: KbPsElement[];
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

  // every psModel scoped to one of this province's petroleum systems (basin-wide
  // catalog model AND any assessment-unit-scoped model), and their timed elements
  const modelIds = new Set(spine.psModel.filter((m) => tpsIds.has(m.tps_id)).map((m) => m.model_id));
  const psElements = spine.psElement.filter((e) => modelIds.has(e.model_id));

  return {
    field, basin, province, region, country,
    petroleumSystems, assessmentUnits, wells, wellbores, reservoirs,
    stratigraphy: spine.stratigraphy, basinCycles, psElements,
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
