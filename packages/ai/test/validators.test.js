import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSchema, validateGrounding, validatePolicy, validateCost, validateQuality, runValidators,
} from '../src/index.js';
import { modelSpec } from '../src/index.js';

test('schema: missing required field fails', () => {
  const r = validateSchema({ a: 1 }, { required: ['a', 'b'] });
  assert.equal(r.ok, false);
  assert.match(r.reason, /missing required field "b"/);
});

test('schema: wrong primitive type fails', () => {
  const r = validateSchema({ n: 'nope' }, { properties: { n: { type: 'number' } } });
  assert.equal(r.ok, false);
});

test('schema: valid object passes', () => {
  const r = validateSchema({ a: 1, tags: ['x'] }, { required: ['a'], properties: { a: { type: 'number' }, tags: { type: 'array' } } });
  assert.equal(r.ok, true);
});

test('grounding: a number that traces back to the source data passes', () => {
  const r = validateGrounding('ARR reaches 47975 at scale', { arr: 47975 });
  assert.equal(r.ok, true);
});

test('grounding: an invented number NOT present in the source data fails', () => {
  const r = validateGrounding('ARR reaches 9000000 at scale', { arr: 47975 });
  assert.equal(r.ok, false);
  assert.match(r.reason, /unsupported numeric claim/);
});

test('grounding: small numbers (percentages, counts) are ignored by default', () => {
  const r = validateGrounding('conversion is 5% across 12 families', { arr: 47975 });
  assert.equal(r.ok, true);
});

test('grounding: rounding/approximation ("about 48k" for 47975) is tolerated', () => {
  const r = validateGrounding('roughly 48000 in ARR', { arr: 47975 });
  assert.equal(r.ok, true);
});

test('policy: delegates to governance.js — restricted data blocks an external model', () => {
  const external = modelSpec({ id: 'x', costClass: 2, execution: 'external-api', dataClasses: ['public'] }).spec;
  const r = validatePolicy(external, 'restricted');
  assert.equal(r.ok, false);
});

test('cost: delegates to governance.js budgetGuard', () => {
  const r = validateCost({ maxCostUsd: 0.01, maxFrontierCalls: 5, maxTotalCalls: 10, maxTokens: 1000 }, { costUsd: 0, frontierCalls: 0, totalCalls: 0, tokens: 0 }, { costClass: 1, costUsd: 1, tokens: 10 });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'maxCostUsd');
});

test('quality: empty or too-short text fails', () => {
  assert.equal(validateQuality('').ok, false);
  assert.equal(validateQuality('  ').ok, false);
  assert.equal(validateQuality('a real answer here').ok, true);
});

test('quality: below the benchmark floor fails', () => {
  const r = validateQuality('fine answer', { benchmarkScore: 40, floor: 60 });
  assert.equal(r.ok, false);
});

test('pipeline: runValidators short-circuits and reports which check failed', () => {
  const r = runValidators({ text: 'x'.repeat(20), schema: { required: ['missing'] }, json: {} });
  assert.equal(r.passed, false);
  assert.equal(r.schema, false);
  assert.match(r.notes[0], /^schema:/);
});

test('pipeline: all checks passing yields passed:true', () => {
  const model = modelSpec({ id: 'local', costClass: 0, execution: 'browser', dataClasses: ['public', 'internal', 'confidential', 'restricted'] }).spec;
  const r = runValidators({ text: 'a solid, complete answer', model, dataClass: 'public' });
  assert.equal(r.passed, true);
  assert.deepEqual(r.notes, []);
});
