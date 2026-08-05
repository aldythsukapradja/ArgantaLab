// Basin-cycle integrity gate.
//
// Basin cycles are the tectonostratigraphy chart's middle column, and most of them are
// authored from analyst RECALL rather than from a cited narrative. Recall is a legitimate
// first-pass method — a desktop basin review is real work — but it is only safe while two
// things hold: the row says out loud that it is recall, and the geology it asserts is
// internally coherent. This gate enforces both.
//
// What it deliberately does NOT enforce: that a basin's cycles tile without gaps or
// overlaps. Real basins carry hiatuses, and diachronous sub-basins legitimately overlap —
// the seeded Viking Graben stack does both. A tiling rule would reject correct geology.
//
// Run: node scripts/test-basin-cycles.mjs
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = join(__dirname, '..');
const SPINE = join(APP, 'public', 'kb', 'master-kb-spine.json');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  ok ? pass++ : fail++;
};

console.log('\n=== Basin-cycle integrity gate ===\n');

if (!existsSync(SPINE)) {
  check('master-kb-spine.json present', false, 'run node scripts/build-master-kb.mjs');
  process.exit(1);
}
const kb = JSON.parse(readFileSync(SPINE, 'utf8'));
const cycles = kb.basinCycle ?? [];
const basins = new Set((kb.basin ?? []).map((b) => b.basin_id));
const citations = new Set((kb.citation ?? []).map((c) => c.citation_id));

const PROVENANCE = new Set(['measured', 'reported', 'interpreted', 'derived', 'forecast',
  'scenario', 'reference', 'evidence-derived', 'derived-rule', 'literature-recalled', 'gap']);
const CITATION_STATUS = new Set(['recalled', 'verified', 'cited']);
// The oldest rocks on Earth are ~4.03 Ga; no sedimentary basin cycle predates that.
const OLDEST_MA = 4030;

// ── 1 · identity ─────────────────────────────────────────────────────────────
console.log('-- 1 · identity --');
check('every cycle has an id', cycles.every((c) => !!c.cycle_id));
const ids = cycles.map((c) => c.cycle_id);
check('cycle ids are unique', new Set(ids).size === ids.length,
  `${ids.length} rows, ${new Set(ids).size} distinct`);
const badPrefix = cycles.filter((c) => !String(c.cycle_id).startsWith('atlas:basin-cycle:'));
check('cycle ids use the atlas:basin-cycle: form', badPrefix.length === 0,
  badPrefix.slice(0, 3).map((c) => c.cycle_id).join(', '));

// ── 2 · referential integrity ────────────────────────────────────────────────
console.log('\n-- 2 · referential integrity --');
const orphanBasin = cycles.filter((c) => c.basin_id && !basins.has(c.basin_id));
check('every basin_id resolves to a Basin row', orphanBasin.length === 0,
  orphanBasin.slice(0, 3).map((c) => c.cycle_id).join(', '));
const orphanCite = cycles.filter((c) => c.source_citation_id && !citations.has(c.source_citation_id));
check('every source_citation_id resolves to a Citation row', orphanCite.length === 0,
  orphanCite.slice(0, 3).map((c) => `${c.cycle_id}→${c.source_citation_id}`).join(', '));

// PS Elements point at cycles by basin_cycle_id — a dangling pointer silently empties
// the cross-filter rather than erroring, so it has to be caught here.
const cycleIds = new Set(ids);
const danglingEl = (kb.psElement ?? []).filter((e) => e.basin_cycle_id && !cycleIds.has(e.basin_cycle_id));
check('no PS Element points at a missing cycle', danglingEl.length === 0,
  `${danglingEl.length} dangling`);

// ── 3 · chronology ───────────────────────────────────────────────────────────
console.log('\n-- 3 · chronology --');
const timed = cycles.filter((c) => Number.isFinite(c.age_top_ma) && Number.isFinite(c.age_base_ma));
check('every cycle carries both age bounds', timed.length === cycles.length,
  `${cycles.length - timed.length} missing`);
// Convention in this tab: age_top_ma is the OLDER bound, age_base_ma the younger.
const misordered = timed.filter((c) => c.age_top_ma <= c.age_base_ma);
check('age_top_ma is older than age_base_ma', misordered.length === 0,
  misordered.slice(0, 3).map((c) => `${c.cycle_id} ${c.age_top_ma}→${c.age_base_ma}`).join(', '));
const negative = timed.filter((c) => c.age_top_ma < 0 || c.age_base_ma < 0);
check('no negative ages', negative.length === 0);
const tooOld = timed.filter((c) => c.age_top_ma > OLDEST_MA);
check(`no cycle older than ${OLDEST_MA} Ma`, tooOld.length === 0,
  tooOld.slice(0, 3).map((c) => `${c.cycle_id} ${c.age_top_ma}`).join(', '));
const absurd = timed.filter((c) => c.age_top_ma - c.age_base_ma > 1500);
check('no single cycle spans more than 1500 Myr', absurd.length === 0,
  absurd.slice(0, 3).map((c) => c.cycle_id).join(', '));

// A duplicated span inside one basin means the same cycle was authored twice under
// different names — the commonest recall failure.
const byBasin = new Map();
for (const c of timed) {
  if (!c.basin_id) continue;
  if (!byBasin.has(c.basin_id)) byBasin.set(c.basin_id, []);
  byBasin.get(c.basin_id).push(c);
}
let dupSpan = 0;
for (const [, list] of byBasin) {
  const spans = list.map((c) => `${c.age_top_ma}-${c.age_base_ma}`);
  dupSpan += spans.length - new Set(spans).size;
}
check('no duplicate cycle spans within a basin', dupSpan === 0, `${dupSpan} duplicates`);

// ── 4 · vocabulary ───────────────────────────────────────────────────────────
console.log('\n-- 4 · vocabulary --');
const badProv = cycles.filter((c) => c.provenance && !PROVENANCE.has(c.provenance));
check('provenance uses the documented vocabulary', badProv.length === 0,
  [...new Set(badProv.map((c) => c.provenance))].join(', '));
const badStatus = cycles.filter((c) => c.citation_status && !CITATION_STATUS.has(c.citation_status));
check('citation_status uses the documented vocabulary', badStatus.length === 0,
  [...new Set(badStatus.map((c) => c.citation_status))].join(', '));
check('every cycle declares a citation_status', cycles.every((c) => !!c.citation_status),
  `${cycles.filter((c) => !c.citation_status).length} undeclared`);

// ── 5 · the recall-pairing rule ──────────────────────────────────────────────
// This is the load-bearing one. Recalled geology is acceptable; recalled geology
// wearing a real citation is not.
console.log('\n-- 5 · recall pairing --');
const recalled = cycles.filter((c) => c.provenance === 'literature-recalled');
const mismatch = recalled.filter((c) => c.citation_status !== 'recalled');
check('literature-recalled ⇒ citation_status recalled', mismatch.length === 0,
  mismatch.slice(0, 3).map((c) => c.cycle_id).join(', '));
const wrongCite = recalled.filter((c) => c.source_citation_id !== 'C-RECALL-UNVERIFIED');
check('literature-recalled cites only C-RECALL-UNVERIFIED', wrongCite.length === 0,
  wrongCite.slice(0, 3).map((c) => `${c.cycle_id}→${c.source_citation_id}`).join(', '));
const fakeCited = cycles.filter((c) => c.citation_status === 'cited'
  && (!c.source_citation_id || c.source_citation_id === 'C-RECALL-UNVERIFIED'));
check('nothing claims cited without a real citation', fakeCited.length === 0,
  fakeCited.slice(0, 3).map((c) => c.cycle_id).join(', '));

// ── 6 · coverage report (informational, never a failure) ─────────────────────
console.log('\n-- 6 · coverage --');
const withCycles = new Set(cycles.map((c) => c.basin_id).filter(Boolean));
const byStatus = cycles.reduce((a, c) => { a[c.citation_status ?? 'none'] = (a[c.citation_status ?? 'none'] ?? 0) + 1; return a; }, {});
console.log(`      basins with cycles : ${withCycles.size} / ${basins.size}`);
console.log(`      cycle rows         : ${cycles.length}`);
console.log(`      by citation_status : ${JSON.stringify(byStatus)}`);
const citedBasins = new Set(cycles.filter((c) => c.citation_status === 'cited').map((c) => c.basin_id));
console.log(`      evidence-backed    : ${citedBasins.size} basin(s) — the rest are recalled hypotheses`);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
