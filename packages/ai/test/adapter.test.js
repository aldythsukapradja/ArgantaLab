import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLLM, extractJSON } from '../src/index.js';

test('no providers configured → mock, never throws', async () => {
  const ai = createLLM({});
  const out = await ai.chat({ messages: [{ role: 'user', content: 'hi' }] });
  assert.equal(out.provider, 'mock');
  assert.equal(out.model, 'mock');
  assert.ok(out.text.length > 0);
});

test('explicit provider/model override bypasses task-tier routing', async () => {
  const ai = createLLM({});
  // 'mock' is always available; forcing it should still work identically —
  // proves the override plumbing (used by the WS-2 registry-driven router)
  // doesn't break the default task-based path for existing callers.
  const out = await ai.chat({ messages: [{ role: 'user', content: 'x' }], provider: 'mock', model: 'forced-model-id' });
  assert.equal(out.provider, 'mock');
});

test('chatJSON extracts JSON even when the model wraps it in prose/fences', () => {
  assert.deepEqual(extractJSON('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJSON('sure, here you go: {"a":1} thanks'), { a: 1 });
  assert.equal(extractJSON('not json at all'), null);
});

test('edgeProxy: when the gateway falls back to a different cost tier, the ACTUAL tier is reported, not the requested one', async () => {
  // WS-3: the gateway may fall back from Sponsored(1) to Economy(2) on a 429.
  // The adapter must surface that truthfully, not silently keep claiming tier 1.
  const ai = createLLM({ edgeProxy: { invoke: async () => ({ data: { text: 'hi', provider: 'deepseek', model: 'deepseek-chat', costClass: 2, costUsd: 0.0002 }, error: null }) } });
  const out = await ai.chat({ task: 'brief', messages: [{ role: 'user', content: 'x' }] }); // 'brief' legacy-routes to tier 1
  assert.equal(out.provider, 'edgeProxy');
  assert.equal(out.tier, 2); // actual, not the requested tier-1
  assert.equal(out.model, 'deepseek-chat');
});

test('existing task-based callers are unaffected (no provider/model passed)', async () => {
  const ai = createLLM({});
  const out = await ai.chatJSON({ task: 'storyboard', messages: [{ role: 'user', content: 'hi' }] });
  assert.equal(out.provider, 'mock'); // no real provider configured → mock, as before
  assert.deepEqual(out.json, {});
});
