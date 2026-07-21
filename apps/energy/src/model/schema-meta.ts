// ArgantaEnergy — runtime semantic-model single-source-of-truth (M1).
// GENERATED from contracts/schema.md + contracts/ontology.md (v1.0.0). Do not hand-edit
// structure; regenerate from the locked contract. Edge ids are DERIVED from from|to
// (never hand-typed — hand ids collide, the reference's FK16/17/20/32 lesson).

export type Role = 'hub' | 'dim' | 'fact' | 'detail' | 'bridge' | 'gis' | 'evidence';
export type Group = 'WELLTECH' | 'PROD' | 'LOGS' | 'WITSML' | 'GEOINT' | 'DERIVED' | 'EVIDENCE';
export type DataNature = 'measured' | 'reported' | 'interpreted' | 'derived' | 'forecast' | 'scenario';

export interface ColMeta { name: string; type: string; unit?: string; key?: 'pk' | 'fk' | 'dim'; fk_to?: string; desc?: string }
export interface TableMeta {
  id: string; name: string; role: Role; group: Group; rows: number;
  key: string; dataNature: DataNature; source: string; desc: string; cols: ColMeta[];
}

export const CENTERS = { primary: 'well', secondary: 'wellbore' } as const;

export const GROUPS: Record<Group, string> = {
  WELLTECH: 'Well technical data', PROD: 'Production', LOGS: 'Well logs',
  WITSML: 'WITSML drilling', GEOINT: 'Geophysical interpretation', DERIVED: 'Derived (workbench)', EVIDENCE: 'Evidence ledger',
};

export const TABLES: TableMeta[] = [
  { id: 'well', name: 'Well', role: 'hub', group: 'WELLTECH', rows: 11, key: 'well_name', dataNature: 'reported',
    source: 'Well_technical_data/WellWellbore', desc: 'Well identity hub (11; exploration 15/9-19* + development F-series).',
    cols: [
      { name: 'well_name', type: 'TEXT', key: 'pk', desc: 'logical well identity' },
      { name: 'field', type: 'TEXT', key: 'dim', desc: 'Q0015 SLEIPNER / VOLVE' },
      { name: 'is_exploration', type: 'BOOL', key: 'dim' },
      { name: 'crs', type: 'TEXT(JSON)', desc: 'ED50 / UTM 31N' },
    ] },
  { id: 'wellbore', name: 'Wellbore', role: 'dim', group: 'WELLTECH', rows: 24, key: 'wellbore_name', dataNature: 'reported',
    source: 'Well_technical_data/WellWellbore', desc: 'Wellbore/sidetrack child dimension.',
    cols: [
      { name: 'wellbore_name', type: 'TEXT', key: 'pk' },
      { name: 'well_name', type: 'TEXT', key: 'fk', fk_to: 'well.well_name' },
      { name: 'drilled_from', type: 'TEXT', key: 'fk', fk_to: 'wellbore.wellbore_name', desc: 'sidetrack parent' },
      { name: 'surface_ew_m', type: 'NUM', unit: 'm' }, { name: 'surface_ns_m', type: 'NUM', unit: 'm' },
      { name: 'bottom_hole_md_m', type: 'NUM', unit: 'm' }, { name: 'bottom_hole_tvd_m', type: 'NUM', unit: 'm' },
      { name: 'source_id', type: 'TEXT', key: 'fk', fk_to: 'evidence.volumePath' },
    ] },
  { id: 'production', name: 'ProductionRecord', role: 'fact', group: 'PROD', rows: 15634, key: 'wellbore,date', dataNature: 'reported',
    source: 'Production_data', desc: 'Daily production/injection (15,634 daily / 526 monthly). Volumes Sm3 as sourced.',
    cols: [
      { name: 'source_well_bore_name', type: 'TEXT', key: 'fk', fk_to: 'wellbore.wellbore_name' },
      { name: 'date', type: 'DATE', key: 'pk' },
      { name: 'bore_oil_vol', type: 'NUM', unit: 'Sm3' }, { name: 'bore_gas_vol', type: 'NUM', unit: 'Sm3' },
      { name: 'bore_wat_vol', type: 'NUM', unit: 'Sm3' }, { name: 'bore_wi_vol', type: 'NUM', unit: 'Sm3' },
      { name: 'on_stream_hrs', type: 'NUM', unit: 'hr' },
      { name: 'flow_kind', type: 'TEXT', key: 'dim' }, { name: 'well_type', type: 'TEXT', key: 'dim' },
      { name: 'source_id', type: 'TEXT', key: 'fk', fk_to: 'evidence.volumePath' },
    ] },
  { id: 'log_sample', name: 'LogSample', role: 'fact', group: 'LOGS', rows: 223, key: 'well,run,md,curve', dataNature: 'measured',
    source: 'Well_logs_pr_WELL', desc: '223 log runs (LAS+DLIS). Long-format, index-aligned. Aliases explicit (DTC→DT, RDEP→RT).',
    cols: [
      { name: 'well', type: 'TEXT', key: 'fk', fk_to: 'wellbore.wellbore_name' },
      { name: 'run', type: 'TEXT' }, { name: 'curves', type: 'TEXT[]' },
      { name: 'md', type: 'NUM[]', unit: 'm' }, { name: 'values', type: 'NUM[][]' },
      { name: 'null_sentinel', type: 'NUM' },
      { name: 'source_id', type: 'TEXT', key: 'fk', fk_to: 'evidence.volumePath' },
    ] },
  { id: 'pressure', name: 'PressureSample', role: 'fact', group: 'LOGS', rows: 48, key: 'well,run,index', dataNature: 'measured',
    source: 'Well_logs_pr_WELL/03.PRESSURE', desc: '48 LAS 3.0 MDT/RFT pretest runs (~58 curves each).',
    cols: [
      { name: 'well', type: 'TEXT', key: 'fk', fk_to: 'wellbore.wellbore_name' },
      { name: 'run', type: 'TEXT' }, { name: 'index_kind', type: 'TEXT' }, { name: 'curves', type: 'TEXT[]' },
      { name: 'source_id', type: 'TEXT', key: 'fk', fk_to: 'evidence.volumePath' },
    ] },
  { id: 'trajectory', name: 'TrajectorySurvey', role: 'detail', group: 'WITSML', rows: 29, key: 'wellbore,station_i', dataNature: 'measured',
    source: 'WITSML/trajectory', desc: '29 DEFINITIVE surveys (3,332 stations). Plans excluded. Source angle units preserved.',
    cols: [
      { name: 'wellbore', type: 'TEXT', key: 'fk', fk_to: 'wellbore.wellbore_name' },
      { name: 'chosen_trajectory_name', type: 'TEXT' }, { name: 'station_count', type: 'NUM' },
      { name: 'stations', type: 'TEXT(JSON)[]', desc: '[{i,md,tvd,incl,azi,dispNs,dispEw}]' },
    ] },
  { id: 'marker', name: 'FormationMarker', role: 'detail', group: 'GEOINT', rows: 409, key: 'source_well,surface,obs', dataNature: 'interpreted',
    source: 'Geophysical_Interpretations/Wells', desc: '409 formation tops; 317 resolved / 92 orphan (12 regional/pilot wells outside field), carried verbatim.',
    cols: [
      { name: 'source_well', type: 'TEXT', key: 'fk', fk_to: 'wellbore.wellbore_name' },
      { name: 'well_id', type: 'TEXT', desc: 'resolved or null (no forced merge)' },
      { name: 'surface', type: 'TEXT', key: 'fk', fk_to: 'surface.surface_name' },
      { name: 'md', type: 'NUM', unit: 'm' }, { name: 'tvdss', type: 'NUM', unit: 'm' }, { name: 'interpreter', type: 'TEXT' },
      { name: 'source_id', type: 'TEXT', key: 'fk', fk_to: 'evidence.volumePath' },
    ] },
  { id: 'horizon', name: 'DepthHorizon', role: 'gis', group: 'GEOINT', rows: 6, key: 'name', dataNature: 'interpreted',
    source: 'Geophysical_Interpretations/Horizons_DEPTH', desc: '6 field-level interpreted depth surfaces (1.59M grid pts).',
    cols: [
      { name: 'name', type: 'TEXT', key: 'fk', fk_to: 'surface.surface_name' },
      { name: 'points_count', type: 'NUM' }, { name: 'bbox', type: 'TEXT(JSON)', unit: 'm' },
      { name: 'source_id', type: 'TEXT', key: 'fk', fk_to: 'evidence.volumePath' },
    ] },
  { id: 'surface', name: 'Surface', role: 'bridge', group: 'GEOINT', rows: 16, key: 'surface_name', dataNature: 'interpreted',
    source: '(derived from markers+horizons)', desc: 'Formation/interval bridge (16). Owns stratigraphic ordering + reservoir flag.',
    cols: [
      { name: 'surface_name', type: 'TEXT', key: 'pk' },
      { name: 'chrono_order', type: 'NUM', key: 'dim', desc: 'youngest→oldest' },
      { name: 'reservoir_flag', type: 'BOOL', key: 'dim' },
    ] },
  { id: 'evidence', name: 'EvidenceRecord', role: 'evidence', group: 'EVIDENCE', rows: 1002, key: 'volumePath', dataNature: 'reported',
    source: 'mirror-manifest.json', desc: 'The evidence ledger — every processed row.source_id resolves here (path + sha256).',
    cols: [
      { name: 'volumePath', type: 'TEXT', key: 'pk' }, { name: 'sha256', type: 'TEXT' },
      { name: 'size', type: 'NUM', unit: 'bytes' }, { name: 'last_modified', type: 'DATE' },
    ] },
];

// FK edges with ids DERIVED from from|to (collision-proof). orphans = data-quality truth.
export interface Fk { id: string; from: string; to: string; card: '*-1' | '1-*'; orphans: number | null; note?: string }
function fk(from: string, to: string, card: Fk['card'], orphans: number | null, note?: string): Fk {
  return { id: `fk_${from.replace(/\W+/g, '_')}__${to.replace(/\W+/g, '_')}`, from, to, card, orphans, note };
}
export const FKS: Fk[] = [
  fk('wellbore.well_name', 'well.well_name', '*-1', 0, 'all 24 wellbores → 11 wells'),
  fk('wellbore.drilled_from', 'wellbore.wellbore_name', '*-1', null, 'sidetrack parent; null on mains'),
  fk('production.source_well_bore_name', 'wellbore.wellbore_name', '*-1', 0, '7 producing wellbores, alias-normalized'),
  fk('log_sample.well', 'wellbore.wellbore_name', '*-1', 2, '24 log-wells; 2 orphan (19 B / 19 S combined-branch splits w/o exact master)'),
  fk('pressure.well', 'wellbore.wellbore_name', '*-1', 0, '7 wells'),
  fk('trajectory.wellbore', 'wellbore.wellbore_name', '*-1', 1, '29; 1 orphan (F-15 S sidetrack absent from master)'),
  fk('marker.source_well', 'wellbore.wellbore_name', '*-1', 92, '409 rows: 317 resolved, 92 orphan = 12 regional/pilot wells outside field (15/5-7 A, 15/9-C-2*, -A-15, -B-6, -4/-8/-11/-17, F-12 pilot); carried verbatim, never merged'),
  fk('marker.surface', 'surface.surface_name', '*-1', 0, '409 → 16 surfaces'),
  fk('horizon.name', 'surface.surface_name', '*-1', null, 'field-level fuzzy surface match'),
  fk('production.source_id', 'evidence.volumePath', '*-1', 0, 'universal FK10'),
];

// ---- Alias layer: FIVE physical naming systems → one canonical wellbore form ----
// canonical (VERIFIED against the master): short form "F-<n>[ <branch>]" / "19 <branch>",
// i.e. the common "15/9-" field prefix is stripped (the master itself mixes short+full).
export function normalizeWellbore(raw: string): string {
  if (!raw) return raw;
  let s = raw.trim();
  s = s.replace(/^NO\s+/i, '');           // trajectory "NO " prefix
  s = s.replace(/_/g, '/');               // logs/pressure underscore
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/^15\/9-/, '');           // strip the common field prefix → short form
  // compact branch: F-15A / F-15S → F-15 A / F-15 S (letter glued to number)
  s = s.replace(/(F-\d+)([A-Z])\b/g, '$1 $2');
  return s;
}
export function normalizeWell(raw: string): string {
  // well = wellbore minus trailing branch token (e.g. "F-1 C" → "F-1", "19 A" → "19")
  const wb = normalizeWellbore(raw);
  return wb.replace(/\s+[A-Z]{1,3}\d?$/, '').trim();
}
// logs "&"-combined branches (e.g. "15/9-19 B&BT2") → ["15/9-19 B","15/9-19 BT2"]
export function splitCombinedBranches(raw: string): string[] {
  const s = normalizeWellbore(raw);
  const m = s.match(/^(.*?\s)([A-Z0-9]+)&([A-Z0-9]+)$/);
  if (!m) return [s];
  return [m[1] + m[2], m[1] + m[3]];
}
// Wells outside the Volve field surface set → orphan (never merged). Field prefix "15/9-F" or "15/9-19".
export function isFieldWell(canonical: string): boolean {
  return /^15\/9-(F-|19)/.test(canonical);
}

// Fuzzy column resolver (ordered-regex; against messy real headers). Reference's ckFindCol.
export function findCol(cols: string[], patterns: RegExp[]): string | null {
  for (const rx of patterns) { const m = cols.find((c) => rx.test(c)); if (m) return m; }
  return null;
}

export const SCHEMA_VERSION = '1.0.0';
export const tableById = (id: string) => TABLES.find((t) => t.id === id);
export const fksFor = (tableId: string) => FKS.filter((f) => f.from.startsWith(tableId + '.') || f.to.startsWith(tableId + '.'));
