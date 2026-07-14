import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOVEREIGN_MODELS, pickSovereignModel, detectDevice } from '../src/index.js';

test('sovereign rack matches the source doc model list', () => {
  const ids = SOVEREIGN_MODELS.map((m) => m.id);
  assert.ok(ids.some((id) => id.startsWith('Qwen3.5-0.8B')));
  assert.ok(ids.some((id) => id.startsWith('Qwen3.5-2B')));
  assert.ok(ids.some((id) => id.startsWith('Qwen3.5-4B')));
  assert.ok(ids.some((id) => id.startsWith('Qwen3.5-9B')));
  assert.ok(ids.some((id) => id.startsWith('Hermes-2-Pro-Llama-3-8B')));
  // every entry is Tier 0, local, and permitted for every data class (never leaves device)
  for (const m of SOVEREIGN_MODELS) {
    assert.equal(m.costClass, 0);
    assert.equal(m.execution, 'browser');
    assert.deepEqual(m.dataClasses, ['public', 'internal', 'confidential', 'restricted']);
    assert.ok(m.vramRequiredMB > 0);
  }
});

test('device with no WebGPU → no sovereign model picked (degrades to Tier 1+)', () => {
  const picked = pickSovereignModel(SOVEREIGN_MODELS, { webgpu: false, vramMB: null });
  assert.equal(picked, null);
});

test('nothing cached yet → recommends the SMALLEST model that fits (fast first load)', () => {
  // 2500MB fits 0.8B (1630) and 2B (2245) but not 4B (3868+); no cache info → smallest
  const picked = pickSovereignModel(SOVEREIGN_MODELS, { webgpu: true, vramMB: 2500 });
  assert.equal(picked.id.startsWith('Qwen3.5-0.8B'), true);
});

test('once ANY candidate is cached, the STRONGEST cached one wins over downloading a bigger model', () => {
  // simulate: the 4B model happens to already be cached; the device also fits 9B,
  // but we should not pay for a fresh 9B download when 4B is ready to go instantly.
  const cachedId = SOVEREIGN_MODELS.find((m) => m.id.startsWith('Qwen3.5-4B')).id;
  const picked = pickSovereignModel(SOVEREIGN_MODELS, { webgpu: true, vramMB: null }, (id) => id === cachedId);
  assert.equal(picked.id, cachedId);
});

test('unlimited VRAM, nothing cached → still favors the smallest for fast first load', () => {
  const picked = pickSovereignModel(SOVEREIGN_MODELS, { webgpu: true, vramMB: null });
  assert.equal(picked.vramRequiredMB, Math.min(...SOVEREIGN_MODELS.map((m) => m.vramRequiredMB)));
});

test('prefers an already-cached model over re-downloading a bigger one', () => {
  const smallId = SOVEREIGN_MODELS.find((m) => m.id.startsWith('Qwen3.5-0.8B')).id;
  const isCached = (id) => id === smallId;
  const picked = pickSovereignModel(SOVEREIGN_MODELS, { webgpu: true, vramMB: null }, isCached);
  assert.equal(picked.id, smallId);
});

test('no VRAM headroom for anything → null', () => {
  const picked = pickSovereignModel(SOVEREIGN_MODELS, { webgpu: true, vramMB: 100 });
  assert.equal(picked, null);
});

test('detectDevice degrades gracefully with no navigator.gpu (Node/SSR)', async () => {
  const d = await detectDevice();
  assert.equal(d.webgpu, false);
  assert.equal(d.vramMB, null);
});
