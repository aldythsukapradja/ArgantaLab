// Figure Registry governance gate.
//
// Figures are evidence objects, not decoration. The registry only earns that status if
// three things are structurally true, so this asserts them rather than trusting them:
//
//   1. LICENCE and REDISTRIBUTION are separate and consistent. "We hold a local copy"
//      and "we may publish it" are different facts; conflating them is how an
//      internal-reference plate ends up deployed.
//   2. Nothing we may not redistribute is ever chosen as an entity's preferred figure.
//   3. Preference is per-LINK, not per-figure — a chart preferred for one basin may be
//      an alternate for its neighbour, and one global winner would lose that.
//
// Run: node scripts/test-figure-registry.mjs
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPINE = join(__dirname, '..', 'public', 'kb', 'master-kb-spine.json');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  ok ? pass++ : fail++;
};

console.log('\n=== Figure Registry governance gate ===\n');
if (!existsSync(SPINE)) { check('spine present', false); process.exit(1); }
const kb = JSON.parse(readFileSync(SPINE, 'utf8'));
const reg = kb.figureRegistry ?? [];
const links = kb.figureLinks ?? [];
if (!reg.length) {
  check('Figure Registry exported to spine', false, 'run build-master-kb.mjs after build_figure_registry.py');
  process.exit(1);
}

const LICENCE = new Set(['public-domain', 'cc-by', 'cc-by-sa', 'cc-by-nc', 'all-rights-reserved', 'unknown']);
const REDIST = new Set(['local-copy-permitted', 'link-only', 'internal-reference-only', 'do-not-ingest']);
const SHOWABLE = new Set(['local-copy-permitted']);

// ── 1 · identity & vocabulary ────────────────────────────────────────────────
console.log('-- 1 · identity --');
const ids = reg.map((f) => f.figure_id);
check('figure ids unique', new Set(ids).size === ids.length, `${ids.length} rows, ${new Set(ids).size} distinct`);
check('licence_status vocabulary closed', reg.every((f) => LICENCE.has(f.licence_status)),
  [...new Set(reg.map((f) => f.licence_status))].filter((v) => !LICENCE.has(v)).join(', '));
check('redistribution_status vocabulary closed', reg.every((f) => REDIST.has(f.redistribution_status)),
  [...new Set(reg.map((f) => f.redistribution_status))].filter((v) => !REDIST.has(v)).join(', '));

// ── 2 · the licence/redistribution invariant ─────────────────────────────────
console.log('\n-- 2 · rights coherence --');
// An all-rights-reserved figure can never be freely redistributable. This is the one
// combination that would quietly authorise publishing someone else's work.
const overreach = reg.filter((f) => f.licence_status === 'all-rights-reserved'
  && f.redistribution_status === 'local-copy-permitted');
check('no all-rights-reserved figure is marked redistributable', overreach.length === 0,
  overreach.slice(0, 3).map((f) => f.figure_id).join(', '));
const unknownOpen = reg.filter((f) => f.licence_status === 'unknown'
  && f.redistribution_status !== 'do-not-ingest');
check('unknown licence ⇒ do-not-ingest (fail closed)', unknownOpen.length === 0,
  `${unknownOpen.length} unknown-licence rows escaped quarantine`);
const restrictedThumb = reg.filter((f) => f.redistribution_status === 'internal-reference-only'
  && f.thumbnail_allowed === 'yes');
check('internal-reference figures do not claim thumbnail rights', restrictedThumb.length === 0,
  `${restrictedThumb.length} do`);
const credited = reg.filter((f) => f.licence_status === 'all-rights-reserved');
check('every all-rights-reserved figure names a source publication',
  credited.every((f) => !!f.source_publication || !!f.caption), `${credited.length} rows`);

// ── 3 · links & preference ───────────────────────────────────────────────────
console.log('\n-- 3 · links and preference --');
const regIds = new Set(ids);
const orphanLinks = links.filter((l) => !regIds.has(l.figure_id));
check('every link resolves to a registry figure', orphanLinks.length === 0, `${orphanLinks.length} orphan`);
const linkIds = links.map((l) => l.figure_link_id);
check('link ids unique', new Set(linkIds).size === linkIds.length);
// THE important one: a figure we may not redistribute must never be an entity default.
const byId = new Map(reg.map((f) => [f.figure_id, f]));
const badPreferred = links.filter((l) => /preferred_/.test(l.preferred_for_scope ?? '')
  && !SHOWABLE.has(byId.get(l.figure_id)?.redistribution_status));
check('no non-redistributable figure is preferred for any entity', badPreferred.length === 0,
  badPreferred.slice(0, 3).map((l) => `${l.entity_id}→${l.figure_id}`).join(', '));
// preference is per-entity: no entity may hold two winners of the same slot
const dupSlot = new Map();
for (const l of links) {
  for (const slot of (l.preferred_for_scope ?? '').split(';').filter((s) => s.startsWith('preferred_'))) {
    const k = `${l.entity_id}|${slot}`;
    dupSlot.set(k, (dupSlot.get(k) ?? 0) + 1);
  }
}
const dupes = [...dupSlot.entries()].filter(([, n]) => n > 1);
check('each entity has at most one winner per preferred slot', dupes.length === 0,
  dupes.slice(0, 3).map(([k, n]) => `${k}=${n}`).join(', '));

// ── 4 · scoring honesty ──────────────────────────────────────────────────────
console.log('\n-- 4 · scoring --');
const scored = reg.filter((f) => typeof f.candidate_score === 'number');
check('every figure carries a candidate_score', scored.length === reg.length,
  `${reg.length - scored.length} missing`);
check('scores are within 0..1', scored.every((f) => f.candidate_score >= 0 && f.candidate_score <= 1));
// A score computed over part of the rubric must say so, or 0.82 reads as a full verdict.
const noCoverage = reg.filter((f) => typeof f.score_coverage_pct !== 'number');
check('every score declares its rubric coverage', noCoverage.length === 0, `${noCoverage.length} missing`);
const overclaim = reg.filter((f) => f.score_coverage_pct === 100 && f.review_status === 'auto-classified');
check('no auto-classified figure claims 100% rubric coverage', overclaim.length === 0,
  `${overclaim.length} overclaim`);

// ── 5 · formations ───────────────────────────────────────────────────────────
// Formations must be entities before anything formation-scoped can attach to them.
console.log('\n-- 5 · formation registry --');
const forms = kb.formation ?? [];
check('Formation sheet exported', forms.length > 0, `${forms.length} rows`);
const fIds = forms.map((f) => f.formation_id);
check('formation ids unique', new Set(fIds).size === fIds.length,
  `${fIds.length} rows, ${new Set(fIds).size} distinct`);
// A lithology is not a formation — the defect already found in PS Elements must not
// be re-introduced at the point formations become entities.
const LITHO = new Set(['coal', 'shale', 'sandstone', 'limestone', 'carbonate', 'dolomite',
  'salt', 'evaporite', 'chalk', 'marl', 'basement', 'mudstone', 'siltstone']);
const lithoNamed = forms.filter((f) => {
  const core = (f.canonical_name ?? '').replace(/\s+(Formation|Group|Member|Supergroup)$/i, '').toLowerCase();
  return LITHO.has(core);
});
check('no formation is a bare lithology', lithoNamed.length === 0,
  lithoNamed.slice(0, 3).map((f) => f.canonical_name).join(', '));
const noRank = forms.filter((f) => !f.rank);
check('every formation declares a rank', noRank.length === 0, `${noRank.length} missing`);
// every element that names a resolvable unit should carry the link
const els = kb.psElement ?? [];
const linked = els.filter((e) => e.formation_id);
const badFk = linked.filter((e) => !new Set(fIds).has(e.formation_id));
check('every psElement.formation_id resolves', badFk.length === 0, `${badFk.length} dangling`);
console.log(`      formations : ${forms.length}   elements linked : ${linked.length} / ${els.length}`);
console.log(`      multi-basin formations : ${forms.filter((f) => (f.basin_count ?? 0) > 1).length}`);
console.log(`      with >1 alias          : ${forms.filter((f) => (f.alias_count ?? 0) > 1).length}`);

// ── 6 · coverage report ──────────────────────────────────────────────────────
console.log('\n-- 6 · registry shape --');
const cnt = (arr, k) => arr.reduce((a, x) => { a[x[k] ?? 'none'] = (a[x[k] ?? 'none'] ?? 0) + 1; return a; }, {});
console.log(`      figures : ${reg.length}   links : ${links.length}`);
console.log(`      licence : ${JSON.stringify(cnt(reg, 'licence_status'))}`);
console.log(`      redist  : ${JSON.stringify(cnt(reg, 'redistribution_status'))}`);
console.log(`      scope   : ${JSON.stringify(cnt(reg, 'figure_scope'))}`);
const withFormation = reg.filter((f) => f.formation_id).length;
console.log(`      formation-scoped : ${withFormation} / ${reg.length}  (Phase 1 populates this)`);
const entities = new Set(links.map((l) => l.entity_id));
console.log(`      distinct entities linked : ${entities.size}`);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
