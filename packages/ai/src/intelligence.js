// ─────────────────────────────────────────────────────────────────────────
// WS-2 · Intelligence facade  (Sonnet)
// Bridges the WS-B routing policy + WS-C governance + WS-D ledger to the real
// createLLM() adapter, WITHOUT touching createLLM's existing task-based surface
// (agents.ts, Architecture.tsx, VideoBuilder.tsx, postTemplates.ts keep working
// unchanged). This is the new, smarter entry point: `intelligence.ask(...)`.
// ─────────────────────────────────────────────────────────────────────────

import { selectModel } from './policy.js';
import { isRouteAllowed, requiresApproval, budgetGuard } from './governance.js';
import { runRecord, sovereignCompletionRate, capoEconomics } from './ledger.js';
import { detectDevice } from './rack.js';

/**
 * @param {object} o
 * @param {ReturnType<import('./adapter.js').createLLM>} o.llm
 * @param {object[]} o.registry        from buildRegistry()
 * @param {object} [o.health]          per-provider ProviderHealth map
 * @param {object} [o.benchmarks]      per-model BenchmarkResult map
 * @param {object} [o.runtime]         override device profile (else auto-detected lazily)
 * @param {object} [o.agentPolicy]     AgentModelPolicy for approval-threshold checks
 * @param {(record:object)=>any} [o.sink]  optional persistence hook (WS-5) —
 *   called fire-and-forget with every runRecord (never awaited, never lets a
 *   write failure affect the caller). Keeps this package Supabase-free; the app
 *   layer wires the real write (see apps/hq/src/lib/ai.ts).
 */
export function createIntelligence(o) {
  const { llm, health = {}, benchmarks = {}, sink } = o;
  let registry = o.registry || [];
  let runtimeCache = o.runtime || null;
  const runs = [];

  // records a run in memory AND fires the optional persistence sink (WS-5) —
  // fire-and-forget, never awaited, never lets a write failure affect the caller.
  function emit(r) {
    runs.push(r);
    if (sink) { try { Promise.resolve(sink(r)).catch(() => {}); } catch { /* swallow */ } }
    return r;
  }

  async function runtime() {
    if (runtimeCache) return runtimeCache;
    const device = await detectDevice();
    runtimeCache = { webgpu: device.webgpu, vramMB: device.vramMB };
    return runtimeCache;
  }

  /**
   * The smart entry point. Routes by task+dataClass, calls the real adapter
   * with the SELECTED model (not just the legacy tier map), records a truthful
   * agent_runs row, and returns { text, json?, provenance, approval }.
   */
  async function ask(task, { dataClass = 'public', messages, schema, temperature, seed, missionBudget, running } = {}) {
    const rt = await runtime();
    const { model: picked, reason } = selectModel(registry, { task, dataClass, runtime: rt, health, benchmarks });

    // Defence in depth (ADR-0003): re-verify the governance gate even though
    // selectModel already filtered on it — never trust a single check.
    if (picked && !isRouteAllowed(picked, dataClass)) {
      return degrade(task, dataClass, `governance rejected ${picked.id} for ${dataClass}`);
    }
    if (!picked) return degrade(task, dataClass, reason);

    const estCostUsd = 0; // WS-3 gateway returns actual cost; pre-call estimate is 0 until then
    if (missionBudget) {
      const guard = budgetGuard(missionBudget, running || { costUsd: 0, frontierCalls: 0, totalCalls: 0, tokens: 0 }, { costClass: picked.costClass, costUsd: estCostUsd, tokens: 0 });
      if (!guard.ok) return degrade(task, dataClass, `budget: ${guard.reason}`);
    }

    const t0 = performance.now();
    let out;
    try {
      out = schema
        ? await llm.chatJSON({ task, messages, schema, temperature, seed, provider: picked.provider, model: picked.apiModel })
        : await llm.chat({ task, messages, temperature, seed, provider: picked.provider, model: picked.apiModel });
    } catch (e) {
      return degrade(task, dataClass, `adapter threw: ${e.message}`);
    }
    const latencyMs = Math.round(performance.now() - t0);

    const approval = requiresApproval({ costClass: out.tier ?? picked.costClass, dataClass, task, estCostUsd, agentPolicy: o.agentPolicy || {} });
    // Truthfulness gate: if the adapter degraded to its mock provider despite us
    // REQUESTING a real one (picked.provider !== 'mock'), that is a failed route,
    // not a success — a mock reply must never be presented as a genuine Sovereign/
    // Sponsored/Economy/Frontier answer (ADR-0001: "every run shows the true
    // provider and model").
    const silentlyMocked = out.provider === 'mock' && picked.provider !== 'mock';
    const failed = !!out.error || silentlyMocked;
    const record = runRecord({
      domain: 'llm', task, dataClass,
      requestedCostClass: picked.costClass, actualCostClass: out.tier ?? picked.costClass,
      requestedProvider: picked.provider, requestedModel: picked.apiModel,
      actualProvider: out.actualProvider || out.provider, actualModel: out.model, // truthful — never 'edgeProxy' alone once WS-3 lands
      latencyMs, costUsd: out.costUsd ?? estCostUsd,
      inputTokens: out.inputTokens ?? 0, outputTokens: out.outputTokens ?? 0,
      status: failed ? 'failed' : 'succeeded',
      error: out.error || (silentlyMocked ? `requested ${picked.provider} but adapter fell back to mock (not available / failed to load)` : null),
    });
    emit(record);

    if (failed) return { text: null, json: null, provenance: record, approval, rejected: true, reason: record.error };
    return { text: out.text, json: out.json, provenance: record, approval, rejected: false };
  }

  function degrade(task, dataClass, reason) {
    const record = runRecord({ domain: 'llm', task, dataClass, status: 'rejected', error: reason, actualProvider: 'mock', actualModel: 'mock' });
    emit(record);
    return { text: null, json: null, provenance: record, approval: { required: false, reasons: [] }, rejected: true, reason };
  }

  return {
    ask,
    setRegistry: (r) => { registry = r; },
    getRuns: () => [...runs],
    sovereignCompletionRate: () => sovereignCompletionRate(runs),
    capoEconomics: () => capoEconomics(runs),
  };
}
