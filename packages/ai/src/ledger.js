// ─────────────────────────────────────────────────────────────────────────
// WS-D · Metering & Provenance Ledger  (Opus)
// Every execution — LLM (@arganta/ai) AND media (@arganta/media-core) — records
// a truthful run: requested vs ACTUAL provider/model/cost. Never hide the real
// provider behind a generic label. Sonnet WS-5 creates the Supabase table +
// RLS from this contract. Powers CAPO economics + Sovereign Completion Rate.
// ─────────────────────────────────────────────────────────────────────────

/** ValidationResult — output of the WS-4 validators, stored on each run. */
export const validationResult = (v = {}) => ({
  schema: v.schema ?? null,        // boolean | null
  grounding: v.grounding ?? null,
  policy: v.policy ?? null,
  cost: v.cost ?? null,
  quality: v.quality ?? null,
  passed: v.passed ?? null,        // overall accept
  notes: v.notes || [],
});

/**
 * Build an agent_runs row. Mirrors the doc's ledger fields exactly.
 * `requested*` = what the router asked for; `actual*` = what the gateway truly
 * used (may differ after fallback). `fallbackFrom` records the escalation path.
 */
export function runRecord(r) {
  return {
    runId: r.runId || newId('run'),
    missionId: r.missionId || null,
    agentId: r.agentId || null,
    domain: r.domain || 'llm',                 // 'llm' | 'media'
    task: r.task || null,
    dataClass: r.dataClass || 'public',
    requestedCostClass: r.requestedCostClass ?? null,
    actualCostClass: r.actualCostClass ?? r.requestedCostClass ?? null,
    requestedProvider: r.requestedProvider || null,
    requestedModel: r.requestedModel || null,
    actualProvider: r.actualProvider || null,  // MUST be the true provider, never 'edgeProxy'
    actualModel: r.actualModel || null,
    fallbackFrom: r.fallbackFrom ?? null,      // costClass we escalated from, if any (0 is valid)
    inputTokens: r.inputTokens ?? 0,
    outputTokens: r.outputTokens ?? 0,
    cachedTokens: r.cachedTokens ?? 0,
    latencyMs: r.latencyMs ?? 0,
    costUsd: r.costUsd ?? 0,
    attempt: r.attempt ?? 1,
    status: r.status || 'succeeded',           // succeeded|failed|escalated|rejected
    error: r.error || null,
    benchmarkScore: r.benchmarkScore ?? null,
    validationResult: r.validationResult || validationResult(),
    createdAt: r.createdAt || new Date().toISOString(),
  };
}

/** Sovereign Completion Rate = local/deterministic runs ÷ eligible runs. */
export function sovereignCompletionRate(runs) {
  const eligible = runs.filter((r) => r.status !== 'rejected');
  if (eligible.length === 0) return { rate: 0, validated: 0, n: 0 };
  const sovereign = eligible.filter((r) => r.actualCostClass === 0);
  const validated = sovereign.filter((r) => r.validationResult?.passed === true);
  return { rate: sovereign.length / eligible.length, validatedRate: validated.length / eligible.length, n: eligible.length };
}

/** CAPO economics summary over a run set. */
export function capoEconomics(runs) {
  const ok = runs.filter((r) => r.status === 'succeeded');
  const spend = runs.reduce((s, r) => s + (r.costUsd || 0), 0);
  const byClass = [0, 1, 2, 3].map((c) => runs.filter((r) => r.actualCostClass === c).length);
  return {
    totalRuns: runs.length,
    costUsd: spend,
    costPerSuccess: ok.length ? spend / ok.length : 0,
    escalationRate: runs.length ? runs.filter((r) => r.fallbackFrom != null).length / runs.length : 0,
    frontierDependency: runs.length ? byClass[3] / runs.length : 0,
    mix: { sovereign: byClass[0], sponsored: byClass[1], economy: byClass[2], frontier: byClass[3] },
  };
}

let _seq = 0;
export const newId = (p = 'run') => `${p}_${Date.now().toString(36)}_${(_seq++).toString(36)}`;

/** Reference SQL for Sonnet WS-5 (informational — real migration lives in supabase/migrations). */
export const AGENT_RUNS_DDL = `-- agent_runs (WS-5)
create table if not exists agent_runs (
  run_id text primary key,
  mission_id text, agent_id text, domain text not null default 'llm',
  task text, data_class text not null default 'public',
  requested_cost_class int, actual_cost_class int,
  requested_provider text, requested_model text,
  actual_provider text, actual_model text, fallback_from int,
  input_tokens int default 0, output_tokens int default 0, cached_tokens int default 0,
  latency_ms int default 0, cost_usd numeric default 0,
  attempt int default 1, status text default 'succeeded', error text,
  benchmark_score numeric, validation_result jsonb,
  created_at timestamptz default now()
);
-- RLS: operator-only read; service-role write from the gateway.`;
