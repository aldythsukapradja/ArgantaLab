/**
 * Syllabus validation.
 *
 * The course content is the product, so it gets the same treatment as code.
 * This asserts the teaching spine is actually present in every day, that every
 * exercise step points at a module that really exists in the app, and that no
 * apostrophes survive into strings that are embedded in single-quoted
 * TypeScript (the failure mode that silently breaks the build).
 */
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve as pathResolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(here, '../src/fieldcraft/syllabus/index.ts');

let failures = 0;
const fail = (m) => { console.error(`  x ${m}`); failures += 1; };
const pass = (m) => console.log(`  + ${m}`);

/** The real module ids, taken from each vertical's registry. */
const MODULES = {
  discover: ['atlas', 'data-room', 'basin-framework', 'seismic-structure', 'petrophysics', 'gde', 'basin-modeling', 'play-fairway', 'prospect-risk', 'deliverables'],
  'describe-design': ['map', 'logs', 'correlation', 'petrophysics', 'structural', 'property', 'gridmodel', 'volumetrics', 'uncertainty', 'simulation', 'forecast', 'economics', 'review'],
  deliver: ['intent', 'analogs', 'concept', 'trajectory', 'assurance', 'sanction', 'basis', 'rigs', 'sequence', 'readiness', 'execute', 'revisions'],
  operate: ['performance-overview', 'surveillance-coverage', 'production-validation', 'production-diagnostics', 'pressure-pattern', 'welltest-decline', 'forecast-cases', 'opportunity-screening', 'actions-learning'],
  decide: ['cockpit'],
};

/** Every day must run the full six-beat spine. */
const REQUIRED_LAYOUTS = ['divider', 'objective', 'framework', 'concept', 'example', 'exercise', 'debrief', 'summary', 'bridge'];

console.log('\n[fieldcraft] syllabus');

const dir = await mkdtemp(join(tmpdir(), 'fc-syl-'));
let mod;
try {
  const out = join(dir, 'syllabus.mjs');
  await build({
    entryPoints: [SRC], outfile: out, bundle: true, format: 'esm',
    platform: 'node', absWorkingDir: pathResolve(here, '..'), logLevel: 'silent',
  });
  mod = await import(pathToFileURL(out).href);
} catch (e) {
  console.error(`\n[fieldcraft] FAILED to bundle the syllabus: ${e.message}\n`);
  await rm(dir, { recursive: true, force: true });
  process.exit(1);
}

const { SYLLABUS, COURSE_SPINE } = mod;
const dayIds = Object.keys(MODULES);

/* 1 - every day is present and substantial */
let totalSlides = 0;
let totalSteps = 0;
for (const id of dayIds) {
  const day = SYLLABUS[id];
  if (!day) { fail(`day ${id} missing from the syllabus`); continue; }
  totalSlides += day.slides.length;
  if (day.slides.length < 15) fail(`${id}: only ${day.slides.length} slides, expected a full teaching day`);
  if (day.missions.length !== 2) fail(`${id}: ${day.missions.length} missions, expected 2`);
  day.missions.forEach((m) => { totalSteps += m.steps.length; });
}
if (!failures) pass(`5 days, ${totalSlides} slides, ${totalSteps} graded exercise steps`);

/* 2 - the six-beat spine appears in every day */
for (const id of dayIds) {
  const layouts = new Set((SYLLABUS[id]?.slides ?? []).map((s) => s.layout));
  const missing = REQUIRED_LAYOUTS.filter((l) => !layouts.has(l));
  if (missing.length) fail(`${id}: missing slide layouts ${missing.join(', ')}`);
}
if (!failures) pass('every day runs the full spine: divider through bridge');

/* 3 - McKinsey action titles: an assertion, not a label */
let shortTitles = 0;
for (const id of dayIds) {
  (SYLLABUS[id]?.slides ?? []).forEach((s) => {
    if (!s.title || s.title.split(/\s+/).length < 4) { fail(`${id}: title is a label not an assertion - "${s.title}"`); shortTitles += 1; }
    if (!s.note || s.note.length < 80) fail(`${id}: facilitator note too thin on "${s.title}"`);
    if (!s.body || s.body.length < 60) fail(`${id}: body too thin on "${s.title}"`);
  });
}
if (!shortTitles) pass('every slide carries an action title, a body and a real facilitator note');

/* 4 - every exercise step points at a module that exists */
let badModules = 0;
for (const id of dayIds) {
  const allowed = new Set(MODULES[id]);
  (SYLLABUS[id]?.missions ?? []).forEach((m) => {
    if (!m.steps.length) fail(`${id}/${m.title}: no steps`);
    m.steps.forEach((s) => {
      if (!allowed.has(s.module)) { fail(`${id}/${m.title}: step "${s.title}" points at unknown module "${s.module}"`); badModules += 1; }
      if (!s.evidence || s.evidence.length < 30) fail(`${id}/${m.title}: step "${s.title}" has no gradable evidence`);
    });
  });
}
if (!badModules) pass('every exercise step deep-links to a module that exists in the app');

/* 5 - exercises walk the workflow rather than sitting in one tool */
for (const id of dayIds) {
  if (id === 'decide') continue; // capstone is cockpit-only by design
  (SYLLABUS[id]?.missions ?? []).forEach((m) => {
    const distinct = new Set(m.steps.map((s) => s.module));
    if (distinct.size < 3) fail(`${id}/${m.title}: only touches ${distinct.size} module(s), not a workflow`);
  });
}
if (!failures) pass('each lab walks at least three modules of the real workflow');

/* 6 - the apostrophe trap */
let apostrophes = 0;
for (const id of dayIds) {
  const walk = (v, where) => {
    if (typeof v === 'string') { if (v.includes("'")) { apostrophes += 1; fail(`${id}: apostrophe in ${where} - breaks single-quoted TS`); } }
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, `${where}.${k}`));
  };
  walk(SYLLABUS[id], id);
}
if (!apostrophes) pass('no apostrophes in content strings');

/* 7 - the layout must survive the seed into the content store.
      Regression guard: dropping `layout` here renders every slide as a generic
      concept page and the six-beat rhythm silently disappears from the deck. */
try {
  const csOut = join(dir, 'content-store.mjs');
  await build({
    entryPoints: [pathResolve(here, '../src/fieldcraft/content-store.ts')],
    // React is bundled in rather than left external: the output lives in a temp
    // directory that cannot resolve back to the project's node_modules.
    outfile: csOut, bundle: true, format: 'esm', platform: 'node',
    absWorkingDir: pathResolve(here, '..'), logLevel: 'silent',
  });
  const cs = await import(pathToFileURL(csOut).href);
  const deck = cs.getDeck('d1-deck');
  if (!deck) fail('content store did not seed the Day 1 deck');
  else {
    const withLayout = deck.slides.filter((s) => s.layout).length;
    if (withLayout !== deck.slides.length) {
      fail(`content store dropped layout on ${deck.slides.length - withLayout} of ${deck.slides.length} seeded slides`);
    } else {
      pass(`layout survives the seed on all ${deck.slides.length} slides (first is "${deck.slides[0].layout}")`);
    }
  }
} catch (e) {
  fail(`could not verify the content-store seed: ${e.message}`);
}

/* 8 - the spine is declared for the UI */
if (!Array.isArray(COURSE_SPINE) || COURSE_SPINE.length !== 6) fail('COURSE_SPINE must declare the six beats');
else pass(`spine declared: ${COURSE_SPINE.map((b) => b.beat).join(' -> ')}`);

await rm(dir, { recursive: true, force: true });

if (failures) {
  console.error(`\n[fieldcraft] syllabus FAILED with ${failures} problem(s)\n`);
  process.exit(1);
}
console.log(`\n[fieldcraft] syllabus OK - ${totalSlides} slides, ${totalSteps} exercise steps\n`);
