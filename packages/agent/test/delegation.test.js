import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFICES, routeConcern, delegationRequest, delegationResponse,
} from '../src/index.js';

test('offices exactly match the graph OfficeId set', () => {
  assert.deepEqual([...OFFICES].sort(), ['bridge', 'legal', 'operations', 'roster', 'technology', 'treasury'].sort());
});

test('routeConcern sends money to treasury, architecture to technology, and defaults to bridge', () => {
  assert.equal(routeConcern('what is our runway and monetization plan'), 'treasury');
  assert.equal(routeConcern('review the database schema and security'), 'technology');
  assert.equal(routeConcern('should we launch in Q3'), 'bridge'); // strategy
  assert.equal(routeConcern('completely unrelated musing'), 'bridge'); // honest default, not a guess
});

test('delegationRequest honors an explicit office, else routes, and inherits dataClass', () => {
  assert.equal(delegationRequest({ office: 'legal', question: 'x' }).office, 'legal');
  assert.equal(delegationRequest({ office: 'not-real', question: 'our pricing model' }).office, 'treasury');
  assert.equal(delegationRequest({ question: 'x', dataClass: 'confidential' }).dataClass, 'confidential');
});

test('delegationResponse surfaces an empty office answer honestly', () => {
  const ok = delegationResponse({ office: 'treasury', text: 'Cut CAC by 20%.' });
  assert.equal(ok.ok, true);
  assert.equal(ok.toolResult.recommendation, 'Cut CAC by 20%.');
  const empty = delegationResponse({ office: 'treasury', text: '' });
  assert.equal(empty.ok, false);
  assert.match(empty.summary, /no recommendation/);
});
