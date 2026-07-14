// ─────────────────────────────────────────────────────────────────────────
// WS-B · Routing & Escalation Policy  (Opus)
// Per-task cost bands + required capabilities, the deterministic filter+rank
// selection algorithm, and the escalation ladder. Pure + testable. Sonnet WS-2
// wires this to the real registry; WS-4 wires the validators.
// ─────────────────────────────────────────────────────────────────────────

import { COST_CLASS, isTaskClass } from './tiers.js';
import { isActive, allowsDataClass, hasCapabilities } from './modelspec.js';
import { allowedCostClasses } from './governance.js';

/**
 * Task policy table. default/min/max cost class + required capabilities.
 * Derived from the Four-Tier architecture doc's task table — most tasks default
 * to Sovereign (0); only judgment/review tasks require paid floors.
 * @type {Record<string, {def:number,min:number,max:number,caps:string[],maxCostUsd:number,requireValidation:boolean,requireHumanOnFailure:boolean}>}
 */
export const TASK_POLICIES = {
  classify:        { def: 0, min: 0, max: 1, caps: ['json'], maxCostUsd: 0.005, requireValidation: true,  requireHumanOnFailure: false },
  extract:         { def: 0, min: 0, max: 1, caps: ['json'], maxCostUsd: 0.005, requireValidation: true,  requireHumanOnFailure: false },
  tag:             { def: 0, min: 0, max: 1, caps: ['json'], maxCostUsd: 0.005, requireValidation: true,  requireHumanOnFailure: false },
  rewrite:         { def: 0, min: 0, max: 2, caps: ['chat'], maxCostUsd: 0.02,  requireValidation: false, requireHumanOnFailure: false },
  summarize:       { def: 0, min: 0, max: 2, caps: ['chat'], maxCostUsd: 0.02,  requireValidation: false, requireHumanOnFailure: false },
  localize:        { def: 0, min: 0, max: 2, caps: ['chat'], maxCostUsd: 0.02,  requireValidation: false, requireHumanOnFailure: false },
  'rag-answer':    { def: 0, min: 0, max: 2, caps: ['chat'], maxCostUsd: 0.03,  requireValidation: true,  requireHumanOnFailure: false },
  storyboard:      { def: 0, min: 0, max: 2, caps: ['jsonSchema'], maxCostUsd: 0.03, requireValidation: true, requireHumanOnFailure: false },
  copy:            { def: 0, min: 0, max: 2, caps: ['chat'], maxCostUsd: 0.03,  requireValidation: false, requireHumanOnFailure: false },
  brief:           { def: 0, min: 0, max: 3, caps: ['chat', 'reasoning'], maxCostUsd: 0.1, requireValidation: false, requireHumanOnFailure: false },
  analyze:         { def: 0, min: 0, max: 3, caps: ['jsonSchema'], maxCostUsd: 0.05, requireValidation: true, requireHumanOnFailure: false },
  code:            { def: 0, min: 0, max: 3, caps: ['code'], maxCostUsd: 0.2, requireValidation: true,  requireHumanOnFailure: false },
  plan:            { def: 0, min: 0, max: 3, caps: ['jsonSchema', 'reasoning'], maxCostUsd: 0.1, requireValidation: true, requireHumanOnFailure: false },
  orchestrate:     { def: 1, min: 0, max: 3, caps: ['tools'], maxCostUsd: 0.2, requireValidation: true,  requireHumanOnFailure: false },
  'tool-plan':     { def: 0, min: 0, max: 3, caps: ['tools', 'json'], maxCostUsd: 0.1, requireValidation: true, requireHumanOnFailure: false },
  synthesize:      { def: 0, min: 0, max: 3, caps: ['chat', 'reasoning'], maxCostUsd: 0.15, requireValidation: false, requireHumanOnFailure: false },
  judge:           { def: 2, min: 1, max: 3, caps: ['reasoning'], maxCostUsd: 0.3, requireValidation: true, requireHumanOnFailure: false },
  'legal-review':  { def: 3, min: 3, max: 3, caps: ['reasoning'], maxCostUsd: 2.0, requireValidation: true, requireHumanOnFailure: true },
  'financial-review': { def: 2, min: 1, max: 3, caps: ['reasoning'], maxCostUsd: 1.0, requireValidation: true, requireHumanOnFailure: true },
  'security-review':  { def: 3, min: 2, max: 3, caps: ['reasoning', 'code'], maxCostUsd: 2.0, requireValidation: true, requireHumanOnFailure: true },
  'release-review':   { def: 2, min: 1, max: 3, caps: ['reasoning'], maxCostUsd: 1.0, requireValidation: true, requireHumanOnFailure: true },
  'agent-spec-edit':  { def: 3, min: 2, max: 3, caps: ['reasoning', 'json'], maxCostUsd: 2.0, requireValidation: true, requireHumanOnFailure: true },
};

const FALLBACK_POLICY = { def: 0, min: 0, max: 2, caps: ['chat'], maxCostUsd: 0.02, requireValidation: false, requireHumanOnFailure: false };
export const resolveTaskPolicy = (task) => (isTaskClass(task) ? TASK_POLICIES[task] : FALLBACK_POLICY) || FALLBACK_POLICY;

/** Default ranking weights (doc §Routing). */
export const RANK_WEIGHTS = { expectedCost: 0.30, quality: 0.35, latency: 0.15, reliability: 0.20 };

/**
 * The routing algorithm — pure. Filters the registry by lifecycle, data
 * permission, capability, cost band (intersected with data-class governance),
 * runtime, provider health, quota, benchmark floor; ranks the survivors.
 *
 * @param {object[]} registry  ModelSpec[]
 * @param {{task:string,dataClass:string,runtime?:object,health?:object,benchmarks?:object,minCostClass?:number}} ctx
 * @returns {{model:object|null, considered:number, reason:string, band:[number,number]}}
 */
export function selectModel(registry, ctx) {
  const { task, dataClass, runtime = {}, health = {}, benchmarks = {} } = ctx;
  const policy = resolveTaskPolicy(task);

  // cost band = task's [min,max] intersected with what the data class permits.
  // ctx.minCostClass raises the floor for THIS call only — used by WS-4's
  // escalation runner to retry at a higher tier after a validation failure,
  // without mutating the task policy itself.
  const dataAllowed = allowedCostClasses(dataClass); // Set of allowed costClasses
  const lo = Math.max(policy.min, ctx.minCostClass ?? 0);
  const hi = policy.max;

  const candidates = registry
    .filter(isActive)
    .filter((m) => allowsDataClass(m, dataClass))
    .filter((m) => hasCapabilities(m, policy.caps))
    .filter((m) => m.costClass >= lo && m.costClass <= hi)
    .filter((m) => dataAllowed.has(m.costClass))
    .filter((m) => isRuntimeCompatible(m, runtime))
    .filter((m) => isProviderHealthy(m.provider, health))
    .filter((m) => hasQuota(m, health))
    .filter((m) => meetsBenchmarkFloor(m, task, benchmarks));

  if (candidates.length === 0) {
    return { model: null, considered: registry.length, reason: `no model for task=${task} data=${dataClass} band=[${lo},${hi}]`, band: [lo, hi] };
  }
  const ranked = rankCandidates(candidates, RANK_WEIGHTS, benchmarks);
  return { model: ranked[0], considered: candidates.length, reason: 'selected', band: [lo, hi] };
}

/**
 * Rank survivors. Core principle: the benchmark floor already removed models
 * with INSUFFICIENT quality, so the cheapest *capable* tier wins — cost class is
 * the dominant sort (Free before paid, Economy before Frontier). Within a tier,
 * the weighted score (quality/latency/reliability) breaks ties.
 */
export function rankCandidates(models, weights = RANK_WEIGHTS, benchmarks = {}) {
  const score = (m) => {
    const quality = (benchmarks[m.id]?.score ?? benchmarkDefault(m)) / 100;
    const latency = 1 - Math.min(1, (benchmarks[m.id]?.averageLatencyMs ?? 800) / 4000);
    const reliability = benchmarks[m.id]?.schemaPassRate ?? 0.8;
    const prio = 1 - Math.min(1, (m.priority ?? 100) / 1000);
    return quality * weights.quality + latency * weights.latency + reliability * weights.reliability + prio * 0.05;
  };
  return [...models].sort((a, b) => (a.costClass - b.costClass) || (score(b) - score(a)));
}

// Cold-start default — used only until a model accrues enough real runs for
// WS-8's rollupBenchmarks() to produce a genuine score (see benchmarks.js).
// Deliberately conservative-by-tier, not a claim of measured quality.
const benchmarkDefault = (m) => (m.costClass === 0 ? 62 : m.costClass === 1 ? 74 : m.costClass === 2 ? 82 : 90);

// ---- escalation ladder ----------------------------------------------------
/** Next cost class up, capped at the task's max. null → escalate to human. */
export function nextCostClass(current, task) {
  const policy = resolveTaskPolicy(task);
  const next = current + 1;
  return next <= policy.max && next <= COST_CLASS.FRONTIER ? next : null;
}

/** The ordered escalation path for a task, respecting its min/max band. */
export function escalationLadder(task) {
  const p = resolveTaskPolicy(task);
  const ladder = [];
  for (let c = p.min; c <= p.max; c++) ladder.push(c);
  ladder.push('human');
  return ladder;
}

// ---- filter predicates (overridable by Sonnet with real runtime/health) ---
export const isRuntimeCompatible = (m, runtime) => {
  if (m.execution === 'external-api' || m.execution === 'deterministic') return true;
  if (m.execution === 'browser') return runtime.webgpu !== false && (m.vramRequiredMB == null || (runtime.vramMB ?? Infinity) >= m.vramRequiredMB);
  if (m.execution === 'local-server') return !!runtime.localServer;
  return true;
};
export const isProviderHealthy = (provider, health) => (health[provider]?.status ?? 'healthy') !== 'offline' && (health[provider]?.status ?? 'healthy') !== 'degraded';
export const hasQuota = (m, health) => (health[m.provider]?.quotaRemaining ?? Infinity) > 0;
export const meetsBenchmarkFloor = (m, task, benchmarks) => (benchmarks[m.id]?.score ?? benchmarkDefault(m)) >= (benchmarks.__floor?.[task] ?? 0);
