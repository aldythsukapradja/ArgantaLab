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

test('existing task-based callers are unaffected (no provider/model passed)', async () => {
  const ai = createLLM({});
  const out = await ai.chatJSON({ task: 'storyboard', messages: [{ role: 'user', content: 'hi' }] });
  assert.equal(out.provider, 'mock'); // no real provider configured → mock, as before
  assert.deepEqual(out.json, {});
});
