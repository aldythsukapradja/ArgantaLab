import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOVES, WEIGHTS, LOOKS, compileCameraClause, compileShot } from '../cameraGrammar.js';

test('MOVES catalog is complete and well-formed', () => {
  assert.equal(MOVES.length, 12);
  for (const m of MOVES) {
    assert.ok(m.id && m.label && m.glyph && m.clause, `move ${JSON.stringify(m)} missing fields`);
  }
  // ids are unique
  assert.equal(new Set(MOVES.map((m) => m.id)).size, MOVES.length);
});

test('compileCameraClause defaults to static + natural + clean', () => {
  const clause = compileCameraClause();
  assert.match(clause, /static camera/);
  assert.match(clause, /natural even pacing/);
  assert.match(clause, /clean modern digital/);
});

test('compileCameraClause composes the selected move/weight/look', () => {
  const clause = compileCameraClause({ move: 'dolly-in', weight: 'energetic', look: 'noir' });
  assert.match(clause, /dollies in/);
  assert.match(clause, /fast energetic/);
  assert.match(clause, /noir/);
});

test('compileCameraClause falls back gracefully on unknown ids', () => {
  const clause = compileCameraClause({ move: 'nonexistent', weight: 'bogus', look: 'fake' });
  // unknown move → static (MOVES[0]); unknown weight/look → empty, filtered out
  assert.match(clause, /static camera/);
  assert.ok(!clause.includes('undefined'));
});

test('compileShot prepends the subject and always returns a negative', () => {
  const { prompt, negative } = compileShot({ prompt: 'a red fox', move: 'orbit-l' });
  assert.match(prompt, /^a red fox,/);
  assert.match(prompt, /orbits smoothly/);
  assert.ok(negative.length > 0);
});

test('compileShot handles empty subject without a leading comma', () => {
  const { prompt } = compileShot({ prompt: '', move: 'static' });
  assert.ok(!prompt.startsWith(','));
});

test('WEIGHTS and LOOKS expose the expected option sets', () => {
  assert.deepEqual(WEIGHTS, ['slow', 'natural', 'energetic']);
  assert.deepEqual(LOOKS, ['clean', 'film-grain', 'teal-orange', 'noir']);
});
