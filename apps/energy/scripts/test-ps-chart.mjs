// Petroleum-system chart integrity gate.
//
// The chart is now 100% populated, but most of it is INFERENCE: rows obtained by rule
// from the basin cycle framework rather than read out of a cited narrative. A full
// chart that quietly asserts impossible geology would be worse than an empty one, so
// this gate enforces two things:
//
//   1. every derived row declares itself derived, and cannot masquerade as evidence
//   2. the chart tells a physically possible story — a petroleum system has a
//      mandatory order (source deposited → generated → migrated → accumulated →
//      preserved) and a trap that exists before it is charged
//
// Run: node scripts/test-ps-chart.mjs
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

console.log('\n=== Petroleum-system chart integrity gate ===\n');
if (!existsSync(SPINE)) { check('spine present', false, 'run build-master-kb.mjs'); process.exit(1); }
const kb = JSON.parse(readFileSync(SPINE, 'utf8'));

const ROLES = ['source', 'reservoir', 'seal', 'overburden'];
const PROCS = ['trap-formation', 'generation', 'expulsion', 'migration',
  'accumulation', 'preservation', 'critical-moment'];
const cycleIds = new Set((kb.basinCycle ?? []).map((c) => c.cycle_id));

// span helper — orientation-agnostic; returns [older, younger]
const sp = (a, b) => [Math.max(a, b), Math.min(a, b)];

const el = new Map(), ev = new Map();
// `oldestOnset` is the older bound of the OLDEST element carrying this role — the
// moment rock of that kind first existed. Chronology has to be tested against that,
// not against the envelope: a basin with several source intervals can be generating
// from the deep one while a shallower one is still being laid down.
for (const e of kb.psElement ?? []) {
  if (!e.element_role || e.start_ma == null) continue;
  if (!el.has(e.model_id)) el.set(e.model_id, new Map());
  const m = el.get(e.model_id);
  const [o, y] = sp(e.start_ma, e.end_ma);
  const cur = m.get(e.element_role);
  m.set(e.element_role, cur ? [Math.max(cur[0], o), Math.min(cur[1], y)] : [o, y]);
}
for (const e of kb.psEvent ?? []) {
  if (e.start_ma == null || e.end_ma == null) continue;
  if (!ev.has(e.model_id)) ev.set(e.model_id, new Map());
  ev.get(e.model_id).set(e.event_type, sp(e.start_ma, e.end_ma));
}

// ── 1 · completeness ─────────────────────────────────────────────────────────
console.log('-- 1 · completeness --');
const models = kb.psModel ?? [];
let missing = 0;
for (const m of models) {
  const E = el.get(m.model_id) ?? new Map(), V = ev.get(m.model_id) ?? new Map();
  for (const r of ROLES) if (!E.has(r)) missing++;
  for (const p of PROCS) if (!V.has(p)) missing++;
}
check('every model has all 11 canonical rows', missing === 0, `${missing} cells missing`);

// ── 2 · derived rows declare themselves ──────────────────────────────────────
console.log('\n-- 2 · derived rows declare themselves --');
const derivedEl = (kb.psElement ?? []).filter((e) => e.provenance === 'derived-rule');
const badEl = derivedEl.filter((e) => e.source_citation_id);
check('derived elements carry no citation', badEl.length === 0, `${badEl.length} do`);
const unflagged = derivedEl.filter((e) => !/derived/i.test(e.notes ?? ''));
check('derived elements say so in notes', unflagged.length === 0, `${unflagged.length} silent`);

const derivedEv = (kb.psEvent ?? []).filter((e) => e.event_status === 'derived');
const badEv = derivedEv.filter((e) => e.provenance !== 'derived-rule');
check('derived events carry derived-rule provenance', badEv.length === 0, `${badEv.length} do not`);
const evUnflagged = derivedEv.filter((e) => !/DERIVED, not evidence/.test(e.notes ?? ''));
check('derived events say so in notes', evUnflagged.length === 0, `${evUnflagged.length} silent`);
const statuses = new Set((kb.psEvent ?? []).map((e) => e.event_status));
check('event_status vocabulary is closed', [...statuses].every((s) => ['modelled', 'derived', 'not-modelled'].includes(s)),
  [...statuses].join(', '));

// ── 3 · cycle references resolve ─────────────────────────────────────────────
console.log('\n-- 3 · cycle references --');
const dangEl = (kb.psElement ?? []).filter((e) => e.basin_cycle_id && !cycleIds.has(e.basin_cycle_id));
check('element basin_cycle_id resolves', dangEl.length === 0, `${dangEl.length} dangling`);
const dangEv = (kb.psEvent ?? []).filter((e) => e.basin_cycle_id && !cycleIds.has(e.basin_cycle_id));
check('event basin_cycle_id resolves', dangEv.length === 0, `${dangEv.length} dangling`);

// ── 4 · chronology — the story must be physically possible ───────────────────
// Ages are in Ma before present, so OLDER = larger number. "A before B" means
// A's older bound is >= B's older bound.
// A violation is OURS when any row involved was produced by this programme
// (event_status 'derived'). Those are a hard failure — we control the rule that made
// them. A violation purely among 'modelled' evidence rows is a defect in the upstream
// extraction: real, worth reporting, but not something to silently overwrite with a
// rule, because that would destroy the evidence to make a test go green.
console.log('\n-- 4 · chronology --');
const viol = { genBeforeSource: [], migBeforeGen: [], accBeforeMig: [], accBeforeTrap: [], presEnd: [], cmOutside: [] };
const evidenceOnly = { genBeforeSource: [], migBeforeGen: [], accBeforeMig: [], accBeforeTrap: [], presEnd: [], cmOutside: [] };
const rawStatus = new Map();
for (const e of kb.psEvent ?? []) {
  if (e.start_ma == null) continue;
  if (!rawStatus.has(e.model_id)) rawStatus.set(e.model_id, new Map());
  rawStatus.get(e.model_id).set(e.event_type, e.event_status);
}
const oursIf = (mid, ...types) => {
  const s = rawStatus.get(mid);
  return types.some((t) => s?.get(t) === 'derived');
};
const record = (bucket, mid, ...types) =>
  (oursIf(mid, ...types) ? viol : evidenceOnly)[bucket].push(mid);
for (const m of models) {
  const E = el.get(m.model_id) ?? new Map(), V = ev.get(m.model_id) ?? new Map();
  const src = E.get('source'), gen = V.get('generation'), mig = V.get('migration');
  const acc = V.get('accumulation'), trap = V.get('trap-formation');
  const pres = V.get('preservation'), cm = V.get('critical-moment');
  // Generation cannot start before the source rock EXISTS — i.e. before deposition
  // began. It may legitimately overlap deposition, since a source interval buried at
  // depth can mature while its younger equivalents are still accumulating.
  if (src && gen && gen[0] > src[0] + 1e-6) record('genBeforeSource', m.model_id, 'generation');
  // migration cannot start before generation starts
  if (gen && mig && mig[0] > gen[0] + 1e-6) record('migBeforeGen', m.model_id, 'generation', 'migration');
  // accumulation cannot start before migration starts
  if (mig && acc && acc[0] > mig[0] + 1e-6) record('accBeforeMig', m.model_id, 'migration', 'accumulation');
  // accumulation cannot begin before trap formation begins
  if (trap && acc && acc[0] > trap[0] + 1e-6) record('accBeforeTrap', m.model_id, 'trap-formation', 'accumulation');
  // preservation must run to the present day
  if (pres && pres[1] > 0.05) record('presEnd', m.model_id, 'preservation');
  // the critical moment must sit inside the generation-migration window
  if (cm && gen) { const lo = Math.min(gen[1], mig ? mig[1] : gen[1]), hi = Math.max(gen[0], mig ? mig[0] : gen[0]);
    if (cm[0] > hi + 1e-6 || cm[0] < lo - 1e-6) record('cmOutside', m.model_id, 'critical-moment'); }
}
check('generation never precedes source deposition', viol.genBeforeSource.length === 0, `${viol.genBeforeSource.length} models`);
check('migration never precedes generation', viol.migBeforeGen.length === 0, `${viol.migBeforeGen.length} models`);
check('accumulation never precedes migration', viol.accBeforeMig.length === 0, `${viol.accBeforeMig.length} models`);
check('accumulation never precedes trap formation', viol.accBeforeTrap.length === 0, `${viol.accBeforeTrap.length} models`);
check('preservation runs to the present', viol.presEnd.length === 0, `${viol.presEnd.length} models`);
check('critical moment sits within generation-migration', viol.cmOutside.length === 0, `${viol.cmOutside.length} models`);

const evTotal = Object.values(evidenceOnly).reduce((a, v) => a + v.length, 0);
if (evTotal) {
  console.log(`\n      ⚠ ${evTotal} chronology violations among EVIDENCE-ONLY rows (upstream`);
  console.log('        extraction defects — reported, deliberately not overwritten):');
  for (const [k, v] of Object.entries(evidenceOnly)) {
    if (v.length) console.log(`          ${k}: ${v.length}`);
  }
}

// ── 5 · grade discipline ─────────────────────────────────────────────────────
// Derived and recalled rows are G1-grade inference. Nothing carrying them may claim
// a higher grade, and no model anywhere may claim G3/G4 without a named reviewer.
console.log('\n-- 5 · grade discipline --');
const rank = (g) => ({ G0: 0, G1: 1, G2: 2, G3: 3, G4: 4 }[g] ?? 0);
const withDerived = new Set(derivedEl.map((e) => e.model_id).concat(derivedEv.map((e) => e.model_id)));
const overGraded = models.filter((m) => withDerived.has(m.model_id) && rank(m.completeness_grade) > 1);
check('no model with derived rows exceeds G1', overGraded.length === 0,
  overGraded.slice(0, 3).map((m) => `${m.model_id}=${m.completeness_grade}`).join(', '));
const highNoReviewer = models.filter((m) => rank(m.completeness_grade) >= 3 && !m.reviewer);
check('no G3/G4 model without a named reviewer', highNoReviewer.length === 0, `${highNoReviewer.length} models`);

// ── 6 · evidence vs inference (informational) ────────────────────────────────
console.log('\n-- 6 · evidence vs inference --');
const elProv = (kb.psElement ?? []).reduce((a, e) => { a[e.provenance ?? 'none'] = (a[e.provenance ?? 'none'] ?? 0) + 1; return a; }, {});
const evStat = (kb.psEvent ?? []).reduce((a, e) => { a[e.event_status ?? 'none'] = (a[e.event_status ?? 'none'] ?? 0) + 1; return a; }, {});
const spec = (kb.psEvent ?? []).filter((e) => e.certainty === 'speculative');
console.log(`      elements : ${JSON.stringify(elProv)}`);
console.log(`      events   : ${JSON.stringify(evStat)}`);
console.log(`      SPECULATIVE event rows: ${spec.length} — the weakest rows in the dataset`);
const evidenceCells = (kb.psElement ?? []).filter((e) => e.provenance === 'evidence-derived').length
  + (kb.psEvent ?? []).filter((e) => e.event_status === 'modelled').length;
console.log(`      evidence-backed rows: ${evidenceCells} of ${(kb.psElement ?? []).length + (kb.psEvent ?? []).length}`);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
