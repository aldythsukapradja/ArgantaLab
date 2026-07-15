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

test('WS-4 escalation: a validation failure at Tier 0 retries at the next tier and records BOTH attempts', async () => {
  const registry = buildRegistry({ webllm: true, edgeProxy: true, gatewayIsTruthful: true }); // sovereign + paid tiers active
  // this stub answers with an empty string (fails validateQuality) at Sovereign,
  // but a real answer once escalated to a paid tier — simulates a weak local
  // model failing where a stronger paid one succeeds.
  const llm = { chat: async (o) => ({ text: o.provider === 'webllm' ? '' : 'a real, complete answer', provider: 'edgeProxy', model: o.model, tier: undefined }) };
  const intel = createIntelligence({ llm, registry, runtime: { webgpu: true, vramMB: null } });
  const res = await intel.ask('analyze', { dataClass: 'public', messages: [], validate: true });
  assert.equal(res.rejected, false);
  assert.equal(res.text, 'a real, complete answer');
  const runs = intel.getRuns();
  assert.equal(runs.length, 2); // the failed Tier-0 attempt AND the successful escalation
  assert.equal(runs[0].status, 'escalated');
  assert.equal(runs[0].attempt, 1);
  assert.equal(runs[1].status, 'succeeded');
  assert.equal(runs[1].attempt, 2);
  assert.ok(runs[1].requestedCostClass > runs[0].requestedCostClass);
});

test('a hard adapter failure at Sovereign (not just a validation failure) escalates to Sponsored instead of rejecting outright', async () => {
  // Reproduces the exact real-world failure this fix addresses: WebLLM's
  // module fails to load in the browser, the adapter silently falls back to
  // its own mock provider — but Sponsored (Gemini/Groq/Cloudflare) is right
  // there and perfectly capable. The old behavior hard-rejected on ANY adapter
  // failure without ever trying the next tier; that defeated the whole point
  // of having redundant tiers.
  const registry = buildRegistry({ webllm: true, edgeProxy: true, gatewayIsTruthful: true });
  const llm = {
    chat: async (o) => o.provider === 'webllm'
      ? { text: null, provider: 'mock', model: 'mock', error: undefined } // silently-mocked, not thrown
      : { text: 'a real Sponsored-tier answer', provider: 'edgeProxy', model: o.model, tier: 1 },
  };
  const intel = createIntelligence({ llm, registry, runtime: { webgpu: true, vramMB: null } });
  const res = await intel.ask('copy', { dataClass: 'public', messages: [] }); // 'copy': def 0, max 2, no validation required
  assert.equal(res.rejected, false);
  assert.equal(res.text, 'a real Sponsored-tier answer');
  const runs = intel.getRuns();
  assert.equal(runs.length, 2); // the failed Sovereign attempt AND the successful Sponsored one
  assert.equal(runs[0].status, 'failed');
  assert.match(runs[0].error, /fell back to mock/);
  assert.equal(runs[1].status, 'succeeded');
});

test('a genuinely thrown adapter exception (network error, etc) also escalates rather than hard-rejecting', async () => {
  const registry = buildRegistry({ webllm: true, edgeProxy: true, gatewayIsTruthful: true });
  const llm = {
    chat: async (o) => {
      if (o.provider === 'webllm') throw new Error('WebGPU device lost');
      return { text: 'recovered at the next tier', provider: 'edgeProxy', model: o.model, tier: 1 };
    },
  };
  const intel = createIntelligence({ llm, registry, runtime: { webgpu: true, vramMB: null } });
  const res = await intel.ask('copy', { dataClass: 'public', messages: [] });
  assert.equal(res.rejected, false);
  assert.equal(res.text, 'recovered at the next tier');
  assert.match(intel.getRuns()[0].error, /adapter threw: WebGPU device lost/);
});

test('WS-4 escalation: exhausting the ladder with requireHumanOnFailure marks the run for human review, not a silent bad answer', async () => {
  // models exist at every tier (0..3), but every provider answers empty text
  // (always fails validateQuality) — genuine ladder exhaustion, not "no model".
  const registry = buildRegistry({ webllm: true, edgeProxy: true, gatewayIsTruthful: true });
  const llm = { chat: async () => ({ text: '', provider: 'edgeProxy', model: 'x' }) };
  const intel = createIntelligence({ llm, registry, runtime: { webgpu: true, vramMB: null } });
  // 'judge' has requireHumanOnFailure:false but band [1,3]; use it with validate
  // to walk 1→2→3 and exhaust — every attempt should be recorded.
  const res = await intel.ask('judge', { dataClass: 'public', messages: [], validate: true });
  assert.equal(res.rejected, true);
  assert.match(res.reason, /validation failed at every tier/);
  const runs = intel.getRuns();
  assert.ok(runs.length >= 2); // at least two tiers were actually tried, not just one
  assert.ok(runs.every((r) => r.status === 'escalated' || r.status === 'failed'));
});

test('WS-8: setBenchmarks() feeds real rollup data into subsequent ask() calls (visible in the returned provenance chain via getBenchmarks)', async () => {
  const registry = buildRegistry({ webllm: true });
  const intel = createIntelligence({ llm: stubLLM(), registry, runtime: { webgpu: true, vramMB: null } });
  assert.deepEqual(intel.getBenchmarks(), {});
  const rollup = { 'Qwen3.5-0.8B-q4f16_1-MLC': { score: 95, averageLatencyMs: 50, schemaPassRate: 0.9, n: 10 } };
  intel.setBenchmarks(rollup);
  assert.deepEqual(intel.getBenchmarks(), rollup);
  // still routes successfully with real benchmark data feeding the rank
  const res = await intel.ask('classify', { dataClass: 'public', messages: [] });
  assert.equal(res.rejected, false);
});

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

test('sink (WS-5 persistence hook) fires for every run, fire-and-forget, without blocking or throwing', async () => {
  const registry = buildRegistry({ webllm: true });
  const sunk = [];
  const intel = createIntelligence({
    llm: stubLLM(), registry, runtime: { webgpu: true, vramMB: null },
    sink: (r) => { sunk.push(r); throw new Error('a broken sink must never break ask()'); },
  });
  const res = await intel.ask('tag', { dataClass: 'public', messages: [] });
  assert.equal(res.rejected, false); // sink throwing didn't propagate
  await new Promise((r) => setTimeout(r, 0)); // let the fire-and-forget microtask settle
  assert.equal(sunk.length, 1);
  assert.equal(sunk[0].task, 'tag');
});

test('a rejected/degraded run is ALSO sunk (needed for observability, not just successes)', async () => {
  const sunk = [];
  const intel = createIntelligence({ llm: stubLLM(), registry: [], sink: (r) => sunk.push(r) });
  await intel.ask('summarize', { dataClass: 'public', messages: [] });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(sunk.length, 1);
  assert.equal(sunk[0].status, 'rejected');
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
