// surface-context.ts truth-lock — surface→stratigraphy→petroleum-system linkage.
// Run: node scripts/test-surface-context.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };

if (!existsSync(join(__dirname, '..', 'src', 'dataqc', 'surface-context.ts'))) { console.log('SKIP'); process.exit(0); }
const { surfaceContextFor, stripEdgeSuffix } = await import('../src/dataqc/surface-context.ts');

// ── suffix stripping ─────────────────────────────────────────────────────────────
check('strips " Top"', JSON.stringify(stripEdgeSuffix('Hugin Fm Top')) === JSON.stringify({ base: 'Hugin Fm', isTop: true, isBase: false }));
check('strips " Base"', JSON.stringify(stripEdgeSuffix('Hugin Fm Base')) === JSON.stringify({ base: 'Hugin Fm', isTop: false, isBase: true }));
check('no suffix passes through', JSON.stringify(stripEdgeSuffix('BCU')) === JSON.stringify({ base: 'BCU', isTop: false, isBase: false }));
check('no suffix: Seabed passes through', stripEdgeSuffix('Seabed').base === 'Seabed');

// ── a small real-shaped Volve KB context (values copied from master-kb-spine.json) ──
const ctx = {
  stratigraphy: [
    { unit_name: 'Shetland Gp', group: 'Shetland', age_top_ma: 100, age_base_ma: 56, environment: 'marl / chalk', ps_role: 'overburden' },
    { unit_name: 'Ty Fm', group: 'Rogaland', age_top_ma: 61, age_base_ma: 58, environment: 'submarine fan sst', ps_role: 'reservoir' },
    { unit_name: 'BCU', group: '-', age_top_ma: 145, age_base_ma: 145, environment: 'unconformity', ps_role: 'seal' },
    { unit_name: 'Hugin Fm', group: 'Vestland', age_top_ma: 168, age_base_ma: 157, environment: 'shallow-marine sst', ps_role: 'reservoir' },
  ],
  basinCycles: [
    { cycle_id: 'atlas:basin-cycle:atlas:viking-graben-postrift-sag', title: 'Post-rift sag' },
    { cycle_id: 'atlas:basin-cycle:atlas:viking-graben-early-climax-synrift', title: 'Early climax syn-rift' },
  ],
  psElements: [
    { unit_name: 'Shetland Gp', element_role: 'overburden', effectiveness: 'not-assessed', confidence: 'medium', basin_cycle_id: 'atlas:basin-cycle:atlas:viking-graben-postrift-sag' },
    { unit_name: 'Ty Fm', element_role: 'reservoir', effectiveness: 'secondary', confidence: 'medium', basin_cycle_id: 'atlas:basin-cycle:atlas:viking-graben-postrift-sag' },
    { unit_name: 'BCU', element_role: 'seal', effectiveness: 'regional', confidence: 'medium' },              // no cycle on this row
    { unit_name: 'Hugin Fm', element_role: 'reservoir', effectiveness: 'primary', confidence: 'medium', basin_cycle_id: 'atlas:basin-cycle:atlas:viking-graben-early-climax-synrift' },
    { unit_name: 'Hugin Fm', element_role: 'reservoir', effectiveness: 'not-assessed', confidence: 'medium' }, // basin-wide catalog dupe, no cycle — richer row should win
  ],
};

// ── real matches ──────────────────────────────────────────────────────────────────
const hugTop = surfaceContextFor('Hugin Fm Top', ctx);
check('Hugin Fm Top: matched + isTop', hugTop && hugTop.unitName === 'Hugin Fm' && hugTop.isTop === true);
check('Hugin Fm Top: age from stratigraphy', hugTop.ageTopMa === 168 && hugTop.ageBaseMa === 157);
check('Hugin Fm Top: real PS element (primary, not the catalog placeholder)', hugTop.psElement.effectiveness === 'primary');
check('Hugin Fm Top: prefers the row WITH a basin cycle over the one without', hugTop.cycleTitle === 'Early climax syn-rift');

const hugBase = surfaceContextFor('Hugin Fm Base', ctx);
check('Hugin Fm Base: matched + isBase', hugBase.unitName === 'Hugin Fm' && hugBase.isBase === true);

const bcu = surfaceContextFor('BCU', ctx);
check('BCU: exact name match with no suffix', bcu && bcu.unitName === 'BCU' && bcu.stratRole === 'seal');
check('BCU: psElement present even with no basin-cycle row', bcu.psElement.effectiveness === 'regional');
check('BCU: no cycle on its only row ⇒ cycleTitle undefined, not fabricated', bcu.cycleTitle === undefined);

const ty = surfaceContextFor('Ty Fm Top', ctx);
check('Ty Fm Top: reservoir, secondary', ty.psElement.role === 'reservoir' && ty.psElement.effectiveness === 'secondary');

const shet = surfaceContextFor('Shetland Gp Top', ctx);
check('Shetland Gp Top: overburden', shet.stratRole === 'overburden' && shet.cycleTitle === 'Post-rift sag');

// ── GROUNDING: no fabricated match ────────────────────────────────────────────────
check('GROUNDING: Seabed has no stratigraphic unit ⇒ null, not guessed', surfaceContextFor('Seabed', ctx) === null);
check('GROUNDING: unknown name ⇒ null', surfaceContextFor('Some Random Fm Top', ctx) === null);
check('GROUNDING: no KB context ⇒ null, never throws', surfaceContextFor('Hugin Fm Top', null) === null);
check('GROUNDING: no surface name ⇒ null, never throws', surfaceContextFor(null, ctx) === null && surfaceContextFor(undefined, ctx) === null);
check('GROUNDING: unit with no psElement rows ⇒ psElement undefined, not invented', (() => {
  const c2 = { ...ctx, psElements: [] };
  const r = surfaceContextFor('BCU', c2);
  return r && r.stratRole === 'seal' && r.psElement === undefined;
})());

// ── case-insensitivity (real filenames vary in case) ──────────────────────────────
check('case-insensitive match', surfaceContextFor('hugin fm top', ctx)?.unitName === 'Hugin Fm');

// ── FORMATION-PICK naming (the raw Well_picks_Volve_v1.dat convention) ───────────
// These are the ACTUAL 16 surface names in the raw pick file. Picks and mapped
// surfaces name the same rock differently, so both must resolve to one KB unit.
const ctx2 = {
  ...ctx,
  stratigraphy: [
    ...ctx.stratigraphy,
    { unit_name: 'Nordland Gp', group: 'Nordland', age_top_ma: 23, age_base_ma: 0, environment: 'marine to glaciomarine', ps_role: 'overburden' },
    { unit_name: 'Utsira Fm', group: 'Nordland', age_top_ma: 15, age_base_ma: 3, environment: 'shallow-marine sand', ps_role: 'overburden' },
    { unit_name: 'Hordaland Gp', group: 'Hordaland', age_top_ma: 34, age_base_ma: 15, environment: 'marine mudstone', ps_role: 'seal' },
    { unit_name: 'Draupne Fm', group: 'Viking', age_top_ma: 157, age_base_ma: 145, environment: 'anoxic marine shale', ps_role: 'source' },
    { unit_name: 'Heather Fm', group: 'Viking', age_top_ma: 168, age_base_ma: 150, environment: 'offshore shale', ps_role: 'source' },
    { unit_name: 'Sleipner Fm', group: 'Vestland', age_top_ma: 170, age_base_ma: 165, environment: 'fluvial', ps_role: 'none' },
    { unit_name: 'Skagerrak Fm', group: 'Hegre', age_top_ma: 237, age_base_ma: 201, environment: 'fluvial redbeds', ps_role: 'reservoir' },
  ],
};
check('pick "Hugin Fm. VOLVE Top" → Hugin Fm (field qualifier folded away)',
  surfaceContextFor('Hugin Fm. VOLVE Top', ctx2)?.unitName === 'Hugin Fm');
check('pick "Hugin Fm. VOLVE Base" → Hugin Fm, isBase',
  surfaceContextFor('Hugin Fm. VOLVE Base', ctx2)?.isBase === true);
check('pick "NORDLAND GP. Top" → Nordland Gp (uppercase + period)',
  surfaceContextFor('NORDLAND GP. Top', ctx2)?.unitName === 'Nordland Gp');
check('pick "SHETLAND GP. Top" → Shetland Gp', surfaceContextFor('SHETLAND GP. Top', ctx2)?.unitName === 'Shetland Gp');
check('pick "HORDALAND GP. Top" → Hordaland Gp, seal', (() => {
  const r = surfaceContextFor('HORDALAND GP. Top', ctx2);
  return r?.unitName === 'Hordaland Gp' && r.stratRole === 'seal';
})());
check('pick "Draupne Fm. Top" → Draupne Fm, SOURCE rock', (() => {
  const r = surfaceContextFor('Draupne Fm. Top', ctx2);
  return r?.unitName === 'Draupne Fm' && r.stratRole === 'source';
})());
check('pick "Heather Fm. Sand VOLVE Top" → Heather Fm (member qualifier folded away)',
  surfaceContextFor('Heather Fm. Sand VOLVE Top', ctx2)?.unitName === 'Heather Fm');
check('pick "Utsira Fm. Top" → Utsira Fm', surfaceContextFor('Utsira Fm. Top', ctx2)?.unitName === 'Utsira Fm');
check('pick "Ty Fm. Top" → Ty Fm, reservoir', surfaceContextFor('Ty Fm. Top', ctx2)?.stratRole === 'reservoir');
check('pick "Sleipner Fm. Top" → Sleipner Fm', surfaceContextFor('Sleipner Fm. Top', ctx2)?.unitName === 'Sleipner Fm');
check('pick "Skagerrak Fm. Top" → Skagerrak Fm', surfaceContextFor('Skagerrak Fm. Top', ctx2)?.unitName === 'Skagerrak Fm');

// GROUNDING: tops that are NOT in the KB must stay unmatched, never snapped to a lookalike
check('GROUNDING: "Seabed" is not a rock unit ⇒ null', surfaceContextFor('Seabed', ctx2) === null);
check('GROUNDING: "Hod Fm. Top" absent from this KB ⇒ null (not forced onto Hordaland)',
  surfaceContextFor('Hod Fm. Top', ctx2) === null);
check('GROUNDING: "Ekofisk Fm. Top" absent ⇒ null', surfaceContextFor('Ekofisk Fm. Top', ctx2) === null);
check('GROUNDING: "Smith Bank Fm. Top" absent ⇒ null', surfaceContextFor('Smith Bank Fm. Top', ctx2) === null);
check('GROUNDING: prefix rule never matches a DIFFERENT formation', (() => {
  // "Heather Fm" must not capture "Hordaland Gp" and vice versa
  const a = surfaceContextFor('Heather Fm. Top', ctx2);
  const b = surfaceContextFor('HORDALAND GP. Top', ctx2);
  return a?.unitName === 'Heather Fm' && b?.unitName === 'Hordaland Gp';
})());

// every real pick surface either resolves or is honestly null — none throw
{
  const REAL = ['Seabed', 'Heather Fm. Top', 'Utsira Fm. Top', 'HORDALAND GP. Top', 'SHETLAND GP. Top',
    'NORDLAND GP. Top', 'Hod Fm. Top', 'Draupne Fm. Top', 'Hugin Fm. VOLVE Top', 'Hugin Fm. VOLVE Base',
    'Ty Fm. Top', 'Ekofisk Fm. Top', 'Sleipner Fm. Top', 'Heather Fm. Sand VOLVE Top',
    'Smith Bank Fm. Top', 'Skagerrak Fm. Top'];
  let threw = null, resolved = 0;
  for (const n of REAL) {
    try { if (surfaceContextFor(n, ctx2)) resolved++; } catch (e) { threw = `${n}: ${e.message}`; }
  }
  check('all 16 REAL pick surfaces handled without throwing', threw === null, threw ?? `${resolved}/16 resolved to a KB unit`);
  check('a majority of real pick surfaces resolve', resolved >= 11, `${resolved}/16`);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
