// Basin-figure integrity gate + coverage ledger.
//
// The picture card carries PUBLISHED plates — cross-sections, stratigraphic charts,
// depositional maps — lifted from petroleum-geology publications. Two things must
// hold, and one thing must be reported honestly:
//
//   1. rights are correctly separated. USGS reports are US Government works (public
//      domain) and ship; a figure REPRODUCED inside one from a copyrighted source is
//      not, and must sit in the gitignored -restricted directory carrying its credit.
//   2. every manifest entry resolves to a file that actually exists.
//   3. coverage is reported per type, because "we have a figure" and "we have the
//      cross-section a geologist asked for" are very different claims.
//
// Run: node scripts/test-basin-figures.mjs
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = join(__dirname, '..');
const OPEN = join(APP, 'public', 'basin-figures');
const RESTRICTED = join(APP, 'public', 'basin-figures-restricted');
const MANIFEST = join(OPEN, 'manifest.json');
const SPINE = join(APP, 'public', 'kb', 'master-kb-spine.json');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  ok ? pass++ : fail++;
};

console.log('\n=== Basin-figure gate ===\n');
if (!existsSync(MANIFEST)) {
  check('manifest present', false, 'run harvest_basin_figures.py');
  process.exit(1);
}
const man = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const kb = JSON.parse(readFileSync(SPINE, 'utf8'));
const figs = man.figures ?? [];
const basins = kb.basin ?? [];

// ── 1 · rights separation ────────────────────────────────────────────────────
console.log('-- 1 · rights --');
const RIGHTS = new Set(['usgs-public-domain', 'cc-attribution', 'restricted']);
check('rights vocabulary is closed', figs.every((f) => RIGHTS.has(f.rights)),
  [...new Set(figs.map((f) => f.rights))].join(', '));
const restricted = figs.filter((f) => f.restricted);
check('restricted flag matches rights', figs.every((f) => f.restricted === (f.rights === 'restricted')));
const noCredit = restricted.filter((f) => !f.credit);
check('every restricted figure names its rightsholder', noCredit.length === 0,
  `${noCredit.length} without a credit`);
// The whole point of the split: a restricted image must NOT be in the shipped dir.
const openFiles = existsSync(OPEN) ? new Set(readdirSync(OPEN)) : new Set();
const leaked = restricted.filter((f) => openFiles.has(f.file));
check('no restricted image sits in the shipped directory', leaked.length === 0,
  leaked.slice(0, 3).map((f) => f.file).join(', '));

// ── 2 · files resolve ────────────────────────────────────────────────────────
console.log('\n-- 2 · files --');
const restFiles = existsSync(RESTRICTED) ? new Set(readdirSync(RESTRICTED)) : new Set();
const missing = figs.filter((f) => !(f.restricted ? restFiles : openFiles).has(f.file));
check('every manifest entry has its image on disk', missing.length === 0,
  `${missing.length} missing`);
const noCaption = figs.filter((f) => !f.caption || f.caption.length < 8);
check('every figure carries a caption', noCaption.length === 0, `${noCaption.length} blank`);
const noSource = figs.filter((f) => !f.source_publication);
check('every figure names its source publication', noSource.length === 0, `${noSource.length} without`);

// ── 3 · basin linkage ────────────────────────────────────────────────────────
console.log('\n-- 3 · linkage --');
const basinIds = new Set(basins.map((b) => b.basin_id));
const orphan = figs.filter((f) => f.basin_id && !basinIds.has(f.basin_id));
check('every basin_id resolves', orphan.length === 0, `${orphan.length} orphan`);

// ── 4 · coverage ledger, computed from the REGISTRY ──────────────────────────
// The flat manifest is the harvester's output; the Figure Registry is what the
// workbook governs and what the app actually reads. Reporting coverage off the
// manifest understated it by the entire monograph harvest.
console.log('\n-- 4 · coverage (from Figure Registry) --');
const reg = kb.figureRegistry ?? [];
const flinks = kb.figureLinks ?? [];
const SHOWABLE = new Set(['local-copy-permitted']);
const regById = new Map(reg.map((f) => [f.figure_id, f]));
const perBasin = new Map();
for (const l of flinks) {
  const f = regById.get(l.figure_id);
  if (!f || !l.entity_id || !SHOWABLE.has(f.redistribution_status)) continue;
  if (!perBasin.has(l.entity_id)) perBasin.set(l.entity_id, new Set());
  perBasin.get(l.entity_id).add(f.figure_type);
}
const N = basins.length;
const has = (t) => [...perBasin.values()].filter((s) => s.has(t)).length;
const pct = (n) => `${n}/${N} (${(n / N * 100).toFixed(0)}%)`;
const notShowable = reg.filter((f) => !SHOWABLE.has(f.redistribution_status));
console.log(`      registry figures   : ${reg.length}  (${notShowable.length} not redistributable)`);
console.log(`      basins with ANY    : ${pct(perBasin.size)}`);
console.log(`      · cross-section    : ${pct(has('cross-section'))}`);
console.log(`      · stratigraphic    : ${pct(has('strat-chart'))}`);
console.log(`      · depositional     : ${pct(has('depositional'))}`);
console.log(`      · events chart     : ${pct(has('events-chart'))}`);
console.log(`      · burial history   : ${pct(has('burial'))}`);
console.log(`      · basin/TPS map    : ${pct(has('map'))}`);
const none = basins.filter((b) => !perBasin.has(b.basin_id));
console.log(`      basins with NO showable figure: ${none.length}`);
if (none.length) console.log(`        e.g. ${none.slice(0, 8).map((b) => b.name).join(' · ')}`);


console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
