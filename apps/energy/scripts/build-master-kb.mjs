// build-master-kb.mjs — ArgantaEnergy-Master-KB.xlsx → a compact link index the app
// can resolve at runtime. This is what lets Data QC say "this log belongs to
// wellbore X, of well Y, in field Volve, Viking Graben basin, Norway" — i.e. the
// regional/geological knowledge base, not just the file.
//
// The workbook is the authored source of truth (29 sheets, zero-orphan FKs). We do
// NOT duplicate it — we emit only the spine needed for resolution + display.
// Run: node scripts/build-master-kb.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = join(__dirname, '..');
const SRC = join(APP, '..', '..', 'docs', 'arganta-energy', 'knowledge-base', 'ArgantaEnergy-Master-KB.xlsx');
const OUT_DIR = join(APP, 'public', 'kb');

if (!existsSync(SRC)) {
  console.error(`[kb] source workbook not found: ${SRC}`);
  process.exit(1);
}

const wb = XLSX.readFile(SRC);

// Most entity tabs end with a merged, full-width prose note explaining the tab's
// convention. sheet_to_json cannot tell that apart from data, so it arrived as a
// phantom record whose id field held the note text — which is why the spine used to
// report 180 provinces and 180 basins when the real count is 179 of each. A merged
// note row is the only shape that populates exactly one column, so drop those.
const isNoteRow = (row) => Object.values(row).filter((v) => v != null && v !== '').length === 1;
const J = (name) => (wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name]).filter((r) => !isNoteRow(r)) : []);
const pick = (row, keys) => Object.fromEntries(keys.filter((k) => row[k] != null && row[k] !== '').map((k) => [k, row[k]]));

// ── ancestry spine — all small, ship whole ───────────────────────────────────
const region = J('Region').map((r) => pick(r, ['region_id', 'code', 'name']));
const country = J('Country').map((r) => pick(r, ['country_id', 'name', 'oilMean_mmbbl', 'gasMean_bcf']));
const province = J('Province').map((r) => pick(r, ['province_id', 'code', 'name', 'region_id', 'assessed', 'oilMean_mmbbl', 'gasMean_bcf']));
// classification_* carries the reviewed whole-basin geodynamic call (Doust-sourced),
// which the Exploration dossier reads instead of a hardcoded table in the app.
const basin = J('Basin').map((r) => pick(r, [
  'basin_id', 'name', 'setting', 'province_id',
  'classification_status', 'classification_basis', 'classification_citation_id',
]));
const petroleumSystem = J('Petroleum System').filter((r) => r.tps_id && r.code).map((r) => pick(r, ['tps_id', 'code', 'name', 'province_id', 'source_rock_formation', 'essential_elements_note', 'generation_migration_note', 'evidence_status', 'evidence_vintage', 'provenance', 'source_citation_id']));
const assessmentUnit = J('Assessment Unit').map((r) => pick(r, ['au_id', 'code', 'name', 'tps_id', 'status', 'oilMean_mmbbl', 'gasMean_bcf', 'resource_data_status']));

// ── readiness + authority evidence (the enrichment stream) ───────────────────
// basinCompletion is authored per-basin scoring; the two evidence tables are RAW
// AUTHORITY TEXT with *reported age terms*, not numeric ages — they are candidates
// awaiting review, never a substitute for a reviewed PS Element.
const basinCompletion = J('Basin Completion').filter((r) => r.basin_id && r.basin_name).map((r) => pick(r, [
  'basin_id', 'basin_name', 'province_code', 'province_name', 'tps_count', 'au_count',
  'classification_status', 'cycle_count', 'model_count', 'timed_element_model_count',
  'timed_process_model_count', 'source_connected', 'completion_stage', 'completion_pct',
  'primary_gap', 'next_action', 'source_citation_ids',
]));
const basinCompletionRule = J('Basin Completion Rules').filter((r) => r.milestone).map((r) => pick(r, ['milestone', 'weight', 'completion_test']));
// Per-MODEL chart readiness — the working queue for finishing a petroleum-system
// chart (11 canonical rows: 4 elements + 7 processes). `next_gap` names the single
// next row to close, which is what the dossier surfaces instead of a generic list.
const psChartCompletion = J('PS Chart Completion').filter((r) => r.model_id).map((r) => pick(r, [
  'model_id', 'tps_id', 'tps_code', 'tps_name', 'basin_id', 'basin_name',
  'scope_type', 'scope_id', 'chart_title', 'model_grade',
  'element_bar_count', 'element_role_count', 'timed_process_count', 'critical_moment_status',
  'chart_row_completion_pct', 'remaining_chart_rows', 'next_gap', 'source_citation_ids', 'review_stage',
]));
const psElementCandidate = J('PS Element Candidates').filter((r) => r.candidate_id && r.source_vintage && r.element_role).map((r) => pick(r, [
  'candidate_id', 'source_vintage', 'au_code', 'tps_code', 'element_role', 'unit_candidates',
  'reported_age_terms', 'authority_evidence', 'candidate_status', 'confidence',
  'source_reference', 'source_citation_id', 'review_action',
]));
const psProcessEvidence = J('PS Process Evidence').filter((r) => r.process_evidence_id && r.source_vintage && r.event_type).map((r) => pick(r, [
  'process_evidence_id', 'source_vintage', 'au_code', 'tps_code', 'event_type',
  'reported_age_terms', 'authority_evidence', 'evidence_status', 'certainty',
  'source_reference', 'source_citation_id', 'review_action',
]));

// ── entities that Data QC assets resolve INTO ────────────────────────────────
const well = J('Well').map((r) => pick(r, ['well_id', 'field_id', 'x', 'y', 'crs']));
const wellbore = J('Wellbore').map((r) => pick(r, [
  'wellbore_id', 'well_id', 'role', 'is_exploration', 'td_md_m', 'td_tvd_m', 'kb',
  'has_logs', 'has_traj', 'has_production', 'has_picks',
]));
const reservoir = J('Reservoir').map((r) => pick(r, ['reservoir_id', 'field_id', 'formation_name', 'age', 'lithology', 'drive_mechanism']));
const stratigraphy = J('Stratigraphic Units').map((r) => pick(r, ['unit_name', 'group', 'age_top_ma', 'age_base_ma', 'environment', 'ps_role', 'role_note', 'cycle_id', 'provenance', 'source_citation_id']));
// citation_status is load-bearing: it separates rows authored from analyst recall
// ('recalled') from rows backed by a real source ('cited'). The dossier must be able
// to say which it is showing — a chart full of recalled cycles is complete in shape,
// not in evidence.
const basinCycle = J('Basin Cycle').map((r) => pick(r, ['cycle_id', 'title', 'basin_id', 'stage', 'age_top_ma', 'age_base_ma', 'geodynamics', 'fill', 'lithology', 'dominant_role', 'units', 'provenance', 'source_citation_id', 'citation_status', 'confidence']));
const psModel = J('PS Model').filter((r) => r.model_id && r.tps_id).map((r) => pick(r, ['model_id', 'tps_id', 'scope_type', 'scope_id', 'title', 'completeness_grade', 'timescale_version', 'status', 'author', 'reviewer', 'version', 'valid_from', 'provenance', 'source_citation_id', 'notes']));
const psElement = J('PS Elements').filter((r) => r.element_id && r.model_id).map((r) => pick(r, ['element_id', 'model_id', 'unit_name', 'element_role', 'start_ma', 'end_ma', 'effectiveness', 'confidence', 'basin_cycle_id', 'formation_id', 'provenance', 'source_citation_id', 'notes']));
const psEvent = J('PS Events').filter((r) => r.event_id && r.model_id).map((r) => pick(r, ['event_id', 'model_id', 'event_type', 'label', 'start_ma', 'end_ma', 'event_status', 'certainty', 'basin_cycle_id', 'related_element_ids', 'provenance', 'source_citation_id', 'evidence_required', 'notes']));
// Formations are entities, not free text. `aliases` carries every raw unit_name string
// that clustered into this unit, which is what lets a figure or an element resolve to a
// formation without fuzzy matching at read time. Parent unit and nomenclature authority
// are deliberately NOT asserted here — those need the literature.
const formation = J('Formation').filter((r) => r.formation_id).map((r) => pick(r, [
  'formation_id', 'canonical_name', 'rank', 'aliases', 'alias_count', 'parent_unit',
  'lithology_hint', 'age_hint', 'basin_ids', 'basin_count', 'occurrence_count',
  'source_tables', 'provenance', 'review_status',
]));

// ── figure governance ───────────────────────────────────────────────────────
// The registry is the evidence object; the junction is how entities USE it. Preference
// lives on the link because a chart preferred for one basin may be an alternate for
// its neighbour. `redistribution_status` is what the UI must gate on — never licence
// alone, and never the presence of a local file.
const figureRegistry = J('Figure Registry').filter((r) => r.figure_id).map((r) => pick(r, [
  'figure_id', 'title', 'figure_scope', 'figure_type', 'formation_id', 'basin_id', 'tps_id', 'field_id',
  'source_citation_id', 'source_url', 'doi', 'publication_year', 'page', 'figure_number', 'caption',
  'authority_type', 'geographic_scope', 'age_scope', 'content_summary', 'decision_use',
  'resolution_quality', 'scientific_quality', 'licence_status', 'redistribution_status',
  'local_asset_path', 'thumbnail_allowed', 'candidate_score', 'score_coverage_pct',
  'preferred_for_scope', 'superseded_by', 'review_status', 'reviewer_notes',
]));
const figureLinks = J('Figure Links').filter((r) => r.figure_link_id).map((r) => pick(r, [
  'figure_link_id', 'figure_id', 'entity_type', 'entity_id', 'relationship',
  'relevance_rank', 'preferred_for_scope', 'notes',
]));
const psCycle = J('PS x Cycle').map((r) => pick(r, ['tps_id', 'cycle_id', 'contribution', 'notes'])).filter((r) => r.tps_id && r.cycle_id);
const geologicTimescale = J('Geologic Timescale').filter((r) => r.unit_id && r.name).map((r) => pick(r, ['timescale_version', 'rank', 'unit_id', 'name', 'start_ma', 'end_ma', 'parent_name', 'source_citation_id']));
const citation = J('Citations').filter((r) => r.citation_id).map((r) => pick(r, ['citation_id', 'authority', 'year', 'title', 'publisher', 'url', 'license', 'provenance_note']));

// ── the world field index (slim) — 8k rows, the breadth link ─────────────────
const field = J('Field').map((r) => pick(r, [
  'field_id', 'name', 'basin_id', 'country_id', 'operator',
  'discovery_year', 'discovery_well', 'status', 'hc_type', 'crs', 'datum',
]));

const counts = {
  region: region.length, country: country.length, province: province.length,
  basin: basin.length, petroleumSystem: petroleumSystem.length,
  assessmentUnit: assessmentUnit.length, field: field.length,
  well: well.length, wellbore: wellbore.length, reservoir: reservoir.length,
  psModel: psModel.length, psElement: psElement.length, psEvent: psEvent.length,
  basinCompletion: basinCompletion.length, psChartCompletion: psChartCompletion.length,
  psElementCandidate: psElementCandidate.length, psProcessEvidence: psProcessEvidence.length,
  formation: formation.length, figureRegistry: figureRegistry.length, figureLinks: figureLinks.length,
};
const meta = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  source: 'ArgantaEnergy-Master-KB.xlsx',
  counts,
};

// Split so resolving one field's ancestry doesn't parse the whole world index:
//   spine  — every lookup table needed to walk field → basin → province → region
//   fields — the 8k-row world field index, fetched only when a lookup misses
const spine = {
  ...meta,
  region, country, province, basin, petroleumSystem, assessmentUnit,
  basinCycle, stratigraphy, psModel, psElement, psEvent, psCycle,
  formation, figureRegistry, figureLinks,
  geologicTimescale, citation, well, wellbore, reservoir,
  basinCompletion, basinCompletionRule, psChartCompletion, psElementCandidate, psProcessEvidence,
};

mkdirSync(OUT_DIR, { recursive: true });
const wrote = (name, obj) => {
  const p = join(OUT_DIR, name);
  writeFileSync(p, JSON.stringify(obj));
  return `${name} ${(readFileSync(p).byteLength / 1024).toFixed(0)} KB`;
};
console.log('[kb]', wrote('master-kb-spine.json', spine));
console.log('[kb]', wrote('master-kb-fields.json', { ...meta, field }));
console.log('[kb] counts:', JSON.stringify(counts));
