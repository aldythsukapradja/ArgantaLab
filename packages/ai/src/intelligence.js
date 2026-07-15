// ─────────────────────────────────────────────────────────────────────────
// WS-2/WS-4 · Intelligence facade + escalation runner  (Sonnet)
// Bridges the WS-B routing policy + WS-C governance + WS-D ledger + WS-4
// validators to the real createLLM() adapter, WITHOUT touching createLLM's
// existing task-based surface (agents.ts, Architecture.tsx, VideoBuilder.tsx,
// postTemplates.ts keep working unchanged). This is the new, smarter entry
// point: `intelligence.ask(...)`.
//
// Escalation (doc §Escalation Logic): Generate → validate → accept, or bump to
// the next cost class and retry — bounded by the task's own [min,max] band
// (nextCostClass returns null past the ceiling, so the loop always terminates).
// Every attempt gets its own truthful ledger row (attempt N), not just the last.
// ─────────────────────────────────────────────────────────────────────────

import { selectModel, nextCostClass, resolveTaskPolicy } from './policy.js';
import { isRouteAllowed, requiresApproval, budgetGuard } from './governance.js';
import { runRecord, sovereignCompletionRate, capoEconomics } from './ledger.js';
import { detectDevice } from './rack.js';
import { runValidators } from './validators.js';

/**
 * @param {object} o
 * @param {ReturnType<import('./adapter.js').createLLM>} o.llm
 * @param {object[]} o.registry        from buildRegistry()
 * @param {object} [o.health]          per-provider ProviderHealth map
 * @param {object} [o.benchmarks]      per-model BenchmarkResult map
 * @param {object} [o.runtime]         override device profile (else auto-detected lazily)
 * @param {object} [o.agentPolicy]     AgentModelPolicy for approval-threshold checks
 * @param {object} [o.benchmarks]      per-model BenchmarkResult map (WS-8) — mutable
 *   via setBenchmarks(); the app layer refreshes it from rollupBenchmarks() as
 *   agent_runs volume grows, so ranking/floor decisions get real data over time
 *   with no code change needed here.
 * @param {(record:object)=>any} [o.sink]  optional persistence hook (WS-5) —
 *   called fire-and-forget with every runRecord (never awaited, never lets a
 *   write failure affect the caller). Keeps this package Supabase-free; the app
 *   layer wires the real write (see apps/hq/src/lib/ai.ts).
 */
export function createIntelligence(o) {
  const { llm, health = {}, sink } = o;
  let registry = o.registry || [];
  let benchmarks = o.benchmarks || {};
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
   * with the SELECTED model, optionally validates the result (WS-4) and
   * escalates to the next cost class on failure, records every attempt as a
   * truthful agent_runs row, and returns { text, json?, provenance, approval }.
   *
   * @param {string} task
   * @param {{dataClass?:string, messages:object[], schema?:object, temperature?:number,
   *   seed?:number, missionBudget?:object, running?:object,
   *   sourceData?:unknown, minLength?:number, validate?:boolean}} opts
   *   `sourceData` + `validate` opt into WS-4's grounding check (pass the same
   *   data that went into the prompt, e.g. Media Center's Analysis.data) — this
   *   is what catches an invented statistic before it reaches the user.
   */
  async function ask(task, opts = {}) {
    const { dataClass = 'public', messages, schema, temperature, seed, missionBudget, running, sourceData, minLength, validate } = opts;
    const rt = await runtime();
    const policy = resolveTaskPolicy(task);
    const wantValidation = validate ?? policy.requireValidation;

    let minCostClass; // undefined on the first attempt — the task's natural band
    let attempt = 1;
    let lastAttempt = null; // most recent real attempt's record+reason — carried forward so
    // "the ladder said try tier N but nothing is registered there" reports what
    // actually failed, not a generic dead end.

    for (;;) {
      const { model: picked, reason } = selectModel(registry, { task, dataClass, runtime: rt, health, benchmarks, minCostClass });

      // Defence in depth (ADR-0003): re-verify the governance gate even though
      // selectModel already filtered on it — never trust a single check.
      if (picked && !isRouteAllowed(picked, dataClass)) return degrade(task, dataClass, `governance rejected ${picked.id} for ${dataClass}`);
      if (!picked) {
        if (lastAttempt) return { text: null, json: null, provenance: lastAttempt.record, approval: { required: false, reasons: [] }, rejected: true, reason: lastAttempt.record.error };
        return degrade(task, dataClass, reason);
      }

      const estCostUsd = 0; // pre-call estimate; the gateway (WS-3) returns the actual
      if (missionBudget) {
        const guard = budgetGuard(missionBudget, running || { costUsd: 0, frontierCalls: 0, totalCalls: 0, tokens: 0 }, { costClass: picked.costClass, costUsd: estCostUsd, tokens: 0 });
        if (!guard.ok) return degrade(task, dataClass, `budget: ${guard.reason}`);
      }

      const t0 = performance.now();
      let out;
      let threw = null;
      try {
        out = schema
          ? await llm.chatJSON({ task, messages, schema, temperature, seed, provider: picked.provider, model: picked.apiModel })
          : await llm.chat({ task, messages, temperature, seed, provider: picked.provider, model: picked.apiModel });
      } catch (e) {
        threw = e.message;
        out = { text: null, json: null, provider: 'mock', costUsd: 0, inputTokens: 0, outputTokens: 0 };
      }
      const latencyMs = Math.round(performance.now() - t0);

      const approval = requiresApproval({ costClass: out.tier ?? picked.costClass, dataClass, task, estCostUsd, agentPolicy: o.agentPolicy || {} });
      // Truthfulness gate: if the adapter degraded to its mock provider despite
      // us REQUESTING a real one, that is a failed route, not a success — a mock
      // reply must never be presented as a genuine Sovereign/Sponsored/Economy/
      // Frontier answer (ADR-0001: "every run shows the true provider and model").
      // This is a FAILED ATTEMPT, not a dead end: the whole point of the tiered
      // router is that a tier being unavailable here (WebLLM can't load, a key
      // is missing, a network call throws) should fall through to the next
      // tier, exactly like a validation failure does — only an EXHAUSTED ladder
      // is a genuine rejection.
      const silentlyMocked = out.provider === 'mock' && picked.provider !== 'mock';
      const attemptFailed = !!threw || !!out.error || silentlyMocked;

      const validation = !attemptFailed && wantValidation
        ? runValidators({
          text: out.text, json: out.json, schema, model: picked, dataClass, sourceData, minLength,
          budget: missionBudget, running, planned: { costClass: picked.costClass, costUsd: out.costUsd ?? estCostUsd, tokens: 0 },
        })
        : null;
      const validationFailed = !!validation && !validation.passed;
      const attemptError = threw ? `adapter threw: ${threw}` : out.error || (silentlyMocked ? `requested ${picked.provider} but adapter fell back to mock (not available / failed to load)` : null);

      const record = runRecord({
        domain: 'llm', task, dataClass,
        requestedCostClass: picked.costClass, actualCostClass: out.tier ?? picked.costClass,
        requestedProvider: picked.provider, requestedModel: picked.apiModel,
        actualProvider: out.actualProvider || out.provider, actualModel: out.model, // truthful — never a generic label
        latencyMs, costUsd: out.costUsd ?? estCostUsd,
        inputTokens: out.inputTokens ?? 0, outputTokens: out.outputTokens ?? 0,
        attempt,
        status: attemptFailed ? 'failed' : validationFailed ? 'escalated' : 'succeeded',
        error: attemptError || (validationFailed ? validation.notes[0] : null),
        validationResult: validation || undefined,
      });

      if (!attemptFailed && !validationFailed) { emit(record); return { text: out.text, json: out.json, provenance: record, approval, rejected: false }; }
      lastAttempt = { record };

      // This attempt failed (adapter error/throw/silent-mock) or validation
      // failed — try the next cost class (doc §Escalation Logic) before giving
      // up. Never returns attemptFailed's out.text/out.json (mock/empty) as a
      // success on the way out.
      const next = nextCostClass(picked.costClass, task);
      if (next == null) {
        // Ladder exhausted at the task's ceiling. High-risk tasks must never
        // silently degrade to an unvalidated answer — flag for human review.
        record.status = policy.requireHumanOnFailure ? 'escalated' : 'failed';
        emit(record);
        const reason = attemptFailed ? `failed at every tier: ${attemptError}` : `validation failed at every tier: ${validation.notes[0]}`;
        return { text: attemptFailed ? null : out.text, json: attemptFailed ? null : out.json, provenance: record, approval, rejected: true, reason, needsHumanReview: !!policy.requireHumanOnFailure };
      }
      emit(record); // this attempt still gets recorded — full observability, not just the winner
      minCostClass = next;
      attempt++;
    }
  }

  function degrade(task, dataClass, reason) {
    const record = runRecord({ domain: 'llm', task, dataClass, status: 'rejected', error: reason, actualProvider: 'mock', actualModel: 'mock' });
    emit(record);
    return { text: null, json: null, provenance: record, approval: { required: false, reasons: [] }, rejected: true, reason };
  }

  return {
    ask,
    setRegistry: (r) => { registry = r; },
    setBenchmarks: (b) => { benchmarks = b; }, // WS-8 — app layer refreshes from rollupBenchmarks()
    getBenchmarks: () => benchmarks,
    getRuns: () => [...runs],
    sovereignCompletionRate: () => sovereignCompletionRate(runs),
    capoEconomics: () => capoEconomics(runs),
  };
}
