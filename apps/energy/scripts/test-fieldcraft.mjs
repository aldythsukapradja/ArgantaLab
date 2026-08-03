/**
 * Fieldcraft assessment-bank validation.
 *
 * The question bank is content, so it needs the same guarantees as code: the
 * blueprint counts must be met exactly, every item must be answerable, and the
 * correct option must not sit in a predictable position.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(here, '../src/fieldcraft/questions.ts'), 'utf8');

/* The file is plain data, so evaluate it after stripping the TypeScript surface. */
const stripped = src
  .replace(/^import[\s\S]*?;\s*$/m, '')
  .replace(/export const BLUEPRINT[\s\S]*$/m, '')
  .replace(/export function[\s\S]*?\n}\n/g, '')
  .replace(/: Question\[\]/g, '')
  .replace(/\bexport const\b/g, 'const');

const QUESTIONS = new Function(`${stripped}; return QUESTIONS;`)();

const BLUEPRINT = { day1: 10, day2: 10, day3: 10, day4: 10, final: 50 };
const FINAL_MIX = {
  evidence: 7, exploration: 9, 'field-development': 12,
  'well-delivery': 9, 'reservoir-management': 9, integrated: 4,
};
const COMPETENCIES = new Set(Object.keys(FINAL_MIX));
const SCOPES = new Set(Object.keys(BLUEPRINT));

let failures = 0;
const fail = (msg) => { console.error(`  ✗ ${msg}`); failures += 1; };
const pass = (msg) => console.log(`  ✓ ${msg}`);

console.log('\n[fieldcraft] assessment bank');

/* 1 — structural integrity of every item. */
const ids = new Set();
for (const q of QUESTIONS) {
  const at = q.id ?? '(missing id)';
  if (!q.id) fail('question with no id');
  if (ids.has(q.id)) fail(`duplicate id ${q.id}`);
  ids.add(q.id);
  if (!SCOPES.has(q.scope)) fail(`${at}: bad scope ${q.scope}`);
  if (!COMPETENCIES.has(q.competency)) fail(`${at}: bad competency ${q.competency}`);
  if (!Array.isArray(q.options) || q.options.length !== 4) fail(`${at}: needs exactly 4 options`);
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) fail(`${at}: answer out of range`);
  if (new Set(q.options).size !== q.options.length) fail(`${at}: duplicate option text`);
  if (!q.stem || q.stem.length < 30) fail(`${at}: stem too short to be scenario-led`);
  if (!q.explanation || q.explanation.length < 40) fail(`${at}: explanation too short`);
}
if (!failures) pass(`${QUESTIONS.length} questions structurally valid, ids unique`);

/* 2 — blueprint counts must match exactly. */
for (const [scope, want] of Object.entries(BLUEPRINT)) {
  const got = QUESTIONS.filter((q) => q.scope === scope).length;
  if (got !== want) fail(`${scope}: expected ${want} questions, found ${got}`);
}
if (!failures) pass('daily checks 10x4 and final exam 50 match the published blueprint');

/* 3 — the final exam competency mix must match the printed table. */
for (const [competency, want] of Object.entries(FINAL_MIX)) {
  const got = QUESTIONS.filter((q) => q.scope === 'final' && q.competency === competency).length;
  if (got !== want) fail(`final/${competency}: expected ${want}, found ${got}`);
}

/* 4 — the correct option must not be guessable from its position. */
const spread = [0, 0, 0, 0];
QUESTIONS.forEach((q) => { spread[q.answer] += 1; });
const expected = QUESTIONS.length / 4;
const worst = Math.max(...spread.map((n) => Math.abs(n - expected)));
if (worst > expected * 0.6) {
  fail(`answer positions are skewed: ${spread.join('/')} (expected about ${expected.toFixed(0)} each)`);
} else {
  pass(`answer key spread across positions: ${spread.join('/')}`);
}

/* 5 — banned constructions the authoring brief ruled out. */
const banned = /\b(all of the above|none of the above)\b/i;
QUESTIONS.forEach((q) => {
  if (q.options.some((o) => banned.test(o))) fail(`${q.id}: uses an all/none-of-the-above option`);
});

if (failures) {
  console.error(`\n[fieldcraft] FAILED with ${failures} problem(s)\n`);
  process.exit(1);
}
console.log(`\n[fieldcraft] assessment bank OK — ${QUESTIONS.length} questions\n`);
