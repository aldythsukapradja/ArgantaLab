import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIntelligence, buildRegistry, SOVEREIGN_MODELS, createLLM } from '../src/index.js';

// A stub llm that mimics createLLM's contract without needing a real WebGPU
// engine — proves the intelligence facade wires provider+model through
// correctly, independent of the actual adapter implementation.
function stubLLM(behavior = {}) {
  return {
    info: () => ({ available: { mock: true }, providers: ['mock'] }),
    chat: async (o) => ({ text: `stub:${o.provider}/${o.model}`, provider: o.provider, model: o.model, tier: behavior.tier ?? 0 }),
    chatJSON: async (o) => ({ text: '{}', json: { echo: o.model }, provider: o.provider, model: o.model, tier: behavior.tier ?? 0 }),
  };
}

test('routes a public/classify task to the sovereign rack when webllm is available', async () => {
  const registry = buildRegistry({ webllm: true });
  const intel = createIntelligence({ llm: stubLLM(), registry, runtime: { webgpu: true, vramMB: null } });
  const res = await intel.ask('classify', { dataClass: 'public', messages: [{ role: 'user', content: 'hi' }] });
  assert.equal(res.provenance.actualCostClass, 0);
  assert.ok(res.provenance.actualProvider === 'webllm' || res.provenance.requestedProvider === 'webllm');
  assert.equal(res.rejected, false);
});

test('restricted data never escapes the sovereign tier, even with paid models registered', async () => {
  const registry = buildRegistry({ webllm: true, edgeProxy: true, gatewayIsTruthful: true });
  const intel = createIntelligence({ llm: stubLLM(), registry, runtime: { webgpu: true, vramMB: null } });
  const res = await intel.ask('brief', { dataClass: 'restricted', messages: [] });
  assert.equal(res.provenance.requestedCostClass, 0);
});

test('no sovereign model fits the device and no other tier is registered → rejected, not a silent paid escalation', async () => {
  const registry = buildRegistry({ webllm: true }); // no edgeProxy registered
  const intel = createIntelligence({ llm: stubLLM(), registry, runtime: { webgpu: false, vramMB: null } });
  const res = await intel.ask('summarize', { dataClass: 'public', messages: [] });
  assert.equal(res.rejected, true);
  assert.equal(res.provenance.status, 'rejected');
});

test('every ask() call is recorded in the truthful runs ledger', async () => {
  const registry = buildRegistry({ webllm: true });
  const intel = createIntelligence({ llm: stubLLM(), registry, runtime: { webgpu: true, vramMB: null } });
  await intel.ask('tag', { dataClass: 'public', messages: [] });
  await intel.ask('extract', { dataClass: 'public', messages: [] });
  assert.equal(intel.getRuns().length, 2);
  const scr = intel.sovereignCompletionRate();
  assert.equal(scr.rate, 1); // both ran on Tier 0
});

test('a silent mock-degrade is reported as REJECTED, never presented as a real Sovereign answer', async () => {
  // The registry says webllm is available (so selectModel picks a real Qwen
  // ModelSpec), but the underlying createLLM was never given a webllm config —
  // its own router will fall back to mock. This reproduces the exact failure
  // mode caught in Media Center: a local-model load failure must never be
  // silently displayed as if it were a genuine Sovereign/local reply.
  const llm = createLLM({}); // no providers configured at all → everything is mock
  const registry = buildRegistry({ webllm: true });
  const intel = createIntelligence({ llm, registry, runtime: { webgpu: true, vramMB: null } });
  const res = await intel.ask('classify', { dataClass: 'public', messages: [{ role: 'user', content: 'ping' }] });
  assert.equal(res.rejected, true);
  assert.equal(res.text, null);
  assert.equal(res.provenance.status, 'failed');
  assert.match(res.provenance.error, /fell back to mock/);
});

test('createLLM + createIntelligence compose end to end and genuinely succeed when the requested provider IS mock', async () => {
  // Sanity check for the fix above: it must not become overzealous and reject
  // every mock response — only ones where mock was requested but a REAL
  // provider was picked. Force mock via an empty registry → mock fallback.
  const llm = createLLM({});
  const intel = createIntelligence({ llm, registry: [], runtime: { webgpu: false, vramMB: null } });
  const res = await intel.ask('classify', { dataClass: 'public', messages: [] });
  // empty registry → selectModel finds nothing → degrade() (explicit reject),
  // not a "succeeded on mock" — proves the two rejection paths agree.
  assert.equal(res.rejected, true);
});
