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
const J = (name) => (wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name]) : []);
const pick = (row, keys) => Object.fromEntries(keys.filter((k) => row[k] != null && row[k] !== '').map((k) => [k, row[k]]));

// ── ancestry spine — all small, ship whole ───────────────────────────────────
const region = J('Region').map((r) => pick(r, ['region_id', 'code', 'name']));
const country = J('Country').map((r) => pick(r, ['country_id', 'name', 'oilMean_mmbbl', 'gasMean_bcf']));
const province = J('Province').map((r) => pick(r, ['province_id', 'code', 'name', 'region_id', 'assessed', 'oilMean_mmbbl', 'gasMean_bcf']));
const basin = J('Basin').map((r) => pick(r, ['basin_id', 'name', 'setting', 'province_id']));
const petroleumSystem = J('Petroleum System').map((r) => pick(r, ['tps_id', 'code', 'name', 'province_id', 'source_rock_formation']));
const assessmentUnit = J('Assessment Unit').map((r) => pick(r, ['au_id', 'code', 'name', 'tps_id', 'status', 'oilMean_mmbbl', 'gasMean_bcf']));

// ── entities that Data QC assets resolve INTO ────────────────────────────────
const well = J('Well').map((r) => pick(r, ['well_id', 'field_id', 'x', 'y', 'crs']));
const wellbore = J('Wellbore').map((r) => pick(r, [
  'wellbore_id', 'well_id', 'role', 'is_exploration', 'td_md_m', 'td_tvd_m', 'kb',
  'has_logs', 'has_traj', 'has_production', 'has_picks',
]));
const reservoir = J('Reservoir').map((r) => pick(r, ['reservoir_id', 'field_id', 'formation_name', 'age', 'lithology', 'drive_mechanism']));
const stratigraphy = J('Stratigraphic Units').map((r) => pick(r, ['unit_name', 'group', 'age_top_ma', 'age_base_ma', 'environment', 'ps_role']));
const basinCycle = J('Basin Cycle').map((r) => pick(r, ['cycle_id', 'title', 'basin_id', 'age_top_ma', 'age_base_ma', 'geodynamics']));

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
  basinCycle, stratigraphy, well, wellbore, reservoir,
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
