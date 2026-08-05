// workspace-model.ts truth-lock — the Input tree's single source.
//
// These are the derivations the sidebar renders: the delivery's global curve TYPES,
// its pick SURFACES, the per-well attribution of both, and the "which curves/tops do
// these wells SHARE" question a correlation panel asks. Every assertion here is about
// a fact the workspace must read from the delivery, or an absence it must preserve.
// Run: node scripts/test-workspace.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const eq = (n, got, want) => check(n, Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const model = join(__dirname, '..', 'src', 'tabs', 'fielddev', 'workspace-model.ts');
if (!existsSync(model)) { console.log('SKIP — workspace-model.ts absent'); process.exit(0); }
const { buildTops, buildCurveTypes, commonCurveTypes, commonTops, utmZoneOf, dedupePicks } =
  await import('../src/tabs/fielddev/workspace-model.ts');

// ── UTM zone: parsed, never assumed ─────────────────────────────────────────────
eq('utmZone reads the declared zone', utmZoneOf('ED50 / UTM zone 31N'), 31);
eq('utmZone reads a compact form', utmZoneOf('WGS84 UTM 15'), 15);
eq('utmZone is null when none is declared', utmZoneOf('WGS 84 geographic'), null);
eq('utmZone is null for a nonsense zone', utmZoneOf('UTM zone 99'), null);
eq('utmZone is null for no CRS at all', utmZoneOf(null), null);

// ── tops: the pick surfaces, attributed per well ────────────────────────────────
// A Volve-shaped picks payload: two shared horizons, one picked in a single well, and
// one pick with NO well name — real data with an unusable key.
const picks = [
  { well: 'F-12', surface: 'Hugin Fm Top', md: 3050 },
  { well: 'F-12', surface: 'Draupne Fm Top', md: 2980 },
  { well: 'F-11 A', surface: 'Hugin Fm Top', md: 3120 },
  { well: 'F-11 A', surface: 'Draupne Fm Top', md: 3005 },
  { well: 'F-4', surface: 'Hugin Fm Top', md: 3210 },
  { well: 'F-4', surface: 'Skagerrak Fm Top', md: 3400 },
  { well: null, surface: 'Hugin Fm Top', md: 3000 },
  { well: 'F-12', surface: '  ', md: 1 },            // blank surface — not a horizon
];
const { tops, byWell, countByWell } = buildTops(picks);

eq('tops: one row per distinct surface', tops.length, 3);
eq('tops: ranked by how many wells carry them', tops.map((t) => t.surface),
  ['Hugin Fm Top', 'Draupne Fm Top', 'Skagerrak Fm Top']);
eq('tops: unattributable pick counted but not attributed',
  [tops[0].count, tops[0].wells.length], [4, 3]);
eq('tops: per-well surfaces', byWell.get('f12'), ['Hugin Fm Top', 'Draupne Fm Top']);
eq('tops: per-well pick counts', countByWell.get('f4'), 2);
check('tops: a blank surface name is not a horizon',
  !tops.some((t) => !t.surface.trim()), 'a whitespace surface must not become a folder');
eq('tops: a well with no picks is absent, not zero', byWell.get('f15a'), undefined);

// ── curve types: the delivery's global well logs ────────────────────────────────
// GR arrives under two mnemonics in two wells; NPHI only in one; and CALI_XYZ maps to
// no known family, so it must stand alone under its own name rather than joining one.
const perWell = [
  { well: 'F-12', curves: [
    { mnemonic: 'GR', family: 'GR', unit: 'gAPI' },
    { mnemonic: 'RHOB', family: 'RHOB', unit: 'g/cm3' },
    { mnemonic: 'NPHI', family: 'NPHI', unit: 'v/v' },
    { mnemonic: 'CALI_XYZ', family: null, unit: 'in' },
  ] },
  { well: 'F-11 A', curves: [
    { mnemonic: 'GRD', family: 'GR', unit: 'gAPI' },
    { mnemonic: 'RHOB', family: 'RHOB', unit: 'g/cm3' },
  ] },
  { well: 'F-4', curves: [
    { mnemonic: 'GR', family: 'GR', unit: 'gAPI' },
    { mnemonic: 'RHOB', family: 'RHOB', unit: 'g/cm3' },
  ] },
];
const { curveTypes, byWell: curvesByWell } = buildCurveTypes(perWell);

eq('curves: aliases fold into ONE family type', curveTypes.find((t) => t.key === 'GR')?.mnemonics, ['GR', 'GRD']);
eq('curves: the family type spans every well that has an alias',
  curveTypes.find((t) => t.key === 'GR')?.wells, ['F-12', 'F-11 A', 'F-4']);
eq('curves: ranked by how many wells carry them', curveTypes.map((t) => t.key),
  ['GR', 'RHOB', 'CALI_XYZ', 'NPHI']);
eq('curves: an unfamilied mnemonic stands alone',
  curveTypes.find((t) => t.key === 'CALI_XYZ')?.family, null);
check('curves: an unfamilied mnemonic did not absorb a neighbour',
  curveTypes.find((t) => t.key === 'CALI_XYZ')?.mnemonics.length === 1, 'must carry only its own name');
eq('curves: unit carried from the digest', curveTypes.find((t) => t.key === 'GR')?.unit, 'gAPI');
eq('curves: per-well type list', curvesByWell.get('f11a'), ['GR', 'RHOB']);

// ── the correlation question: what do these wells SHARE ─────────────────────────
eq('common curves across all three wells', commonCurveTypes(curveTypes, ['F-12', 'F-11 A', 'F-4']), ['GR', 'RHOB']);
eq('common curves across the pair that also has NPHI',
  commonCurveTypes(curveTypes, ['F-12']), ['GR', 'RHOB', 'CALI_XYZ', 'NPHI']);
eq('a curve missing in one well disqualifies it',
  commonCurveTypes(curveTypes, ['F-12', 'F-4']).includes('NPHI'), false);
eq('no wells selected ⇒ nothing is common', commonCurveTypes(curveTypes, []), []);
eq('common tops across all three wells', commonTops(tops, ['F-12', 'F-11 A', 'F-4']), ['Hugin Fm Top']);
eq('common tops for the pair that shares two', commonTops(tops, ['F-12', 'F-11 A']),
  ['Hugin Fm Top', 'Draupne Fm Top']);
eq('name punctuation does not break the match',
  commonCurveTypes(curveTypes, ['f-11-a', 'F-4']), ['GR', 'RHOB']);

// ── empty delivery: folders exist, and say zero rather than inventing ────────────
const empty = buildTops([]);
eq('empty picks ⇒ no surfaces', empty.tops.length, 0);
const emptyCurves = buildCurveTypes([]);
eq('empty logs ⇒ no curve types', emptyCurves.curveTypes.length, 0);
eq('a well with an empty curve list is recorded as having none',
  buildCurveTypes([{ well: 'F-9', curves: [] }]).byWell.get('f9'), []);

// ── duplicate picks: one filed twice is not two intervals ──────────────────────
//
// Both cases are real in the Volve delivery and they must be told apart:
//   · F-1 C meets Hugin Base at 3504 m and again at 4004 m — a deviated bore
//     re-entering the surface. Two genuine intervals.
//   · F-14 carries Hugin Top TWICE at the same MD — one pick filed twice. Keeping
//     both invents a zero-thickness interval that reports zero net and drags the
//     field average down.
{
  const p = (surface, md) => ({ surface, md });

  eq('an exact duplicate is collapsed',
    dedupePicks([p('Hugin Top', 3375), p('Hugin Top', 3375)]).length, 1);
  eq('a re-entry at a different depth is KEPT — it is a real second interval',
    dedupePicks([p('Hugin Base', 3504), p('Hugin Base', 4004)]).map((x) => x.md), [3504, 4004]);
  eq('sub-centimetre separation is the same pick',
    dedupePicks([p('Hugin Top', 3375), p('Hugin Top', 3375.005)]).length, 1);
  eq('a centimetre apart is two picks',
    dedupePicks([p('Hugin Top', 3375), p('Hugin Top', 3375.02)]).length, 2);
  eq('different surfaces at the same depth are both kept',
    dedupePicks([p('BCU', 3038), p('Hugin Top', 3038)]).length, 2);
  eq('an empty list stays empty', dedupePicks([]), []);
  eq('a clean list is untouched',
    dedupePicks([p('A', 100), p('B', 200), p('C', 300)]).map((x) => x.surface), ['A', 'B', 'C']);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
