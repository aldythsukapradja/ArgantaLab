// ─────────────────────────────────────────────────────────────────────────
// WS-8 · Benchmarks — simplest viable start  (Sonnet)
//
// Decision (founder, 2026-07-14): start simple, scale later. Rather than a
// curated eval harness with hand-graded ground truth (a real, separate
// product decision — what counts as "correct" per task, who grades it), v1
// BOOTSTRAPS benchmarks from real production usage that's already flowing:
// WS-4's validators write a truthful validationResult onto every metered run
// (WS-5). Rolling those up per (model, task) gives a genuine, non-fabricated
// BenchmarkResult — no new schema, no new UI to curate test cases, and it
// gets MORE statistically meaningful as agent_runs volume grows, with zero
// migration needed to "turn on" scaling later.
//
// This plugs directly into policy.js's rankCandidates()/meetsBenchmarkFloor(),
// which already read exactly this shape — so wiring real data in is purely
// additive; no routing logic changes.
//
// Deferred to a later pass (the "scale" half): curated static eval sets,
// human-graded ground truth, model-as-judge scoring, tool-call accuracy
// (no validator for that yet), per-task quality floors (`benchmarks.__floor`,
// left empty here so nothing is gated out by default).
// ─────────────────────────────────────────────────────────────────────────

/**
 * Roll up a set of agent_runs-shaped records into BenchmarkResult-shaped
 * entries keyed by model id (the shape policy.js's rankCandidates/
 * meetsBenchmarkFloor already consume). Pure — no I/O.
 *
 * @param {object[]} runs   agent_runs rows (camelCase or snake_case — accepts either)
 * @param {{minSamples?:number}} [opts]  below this many samples for a model,
 *   no entry is produced (caller's default heuristic applies instead) — this
 *   is what makes "scale later" automatic: sparse models simply aren't
 *   overfit to a couple of data points.
 * @returns {Record<string, {score:number, schemaPassRate:number|null,
 *   groundingPassRate:number|null, hallucinationRate:number|null,
 *   averageLatencyMs:number, averageCostUsd:number, testedAt:string, n:number}>}
 */
export function rollupBenchmarks(runs, opts = {}) {
  const minSamples = opts.minSamples ?? 3;
  const byModel = new Map();

  for (const r of runs) {
    // media-core runs (image/video/…) have no LLM "model" concept — fall back
    // to the provider id (e.g. 'deterministic-image') so both domains produce
    // a meaningful rollup, not just LLM calls.
    const model = r.actualModel ?? r.actual_model ?? r.actualProvider ?? r.actual_provider;
    const status = r.status;
    if (!model || status === 'rejected') continue; // no route was taken — nothing to score
    if (!byModel.has(model)) byModel.set(model, { n: 0, succeeded: 0, latency: 0, cost: 0, schema: [], grounding: [], lastAt: null });
    const bucket = byModel.get(model);
    bucket.n++;
    if (status === 'succeeded') bucket.succeeded++;
    bucket.latency += r.latencyMs ?? r.latency_ms ?? 0;
    bucket.cost += r.costUsd ?? r.cost_usd ?? 0;
    const at = r.createdAt ?? r.created_at;
    if (at && (!bucket.lastAt || at > bucket.lastAt)) bucket.lastAt = at;

    const v = r.validationResult ?? r.validation_result;
    if (v && v.passed != null) {
      if (v.schema != null) bucket.schema.push(!!v.schema);
      if (v.grounding != null) bucket.grounding.push(!!v.grounding);
    }
  }

  const out = {};
  for (const [model, b] of byModel) {
    if (b.n < minSamples) continue;
    const schemaPassRate = b.schema.length ? b.schema.filter(Boolean).length / b.schema.length : null;
    const groundingPassRate = b.grounding.length ? b.grounding.filter(Boolean).length / b.grounding.length : null;
    // prefer real validation pass rate when it exists; otherwise fall back to
    // plain success rate — still genuine outcome data, never a made-up constant.
    const validatedSamples = b.schema.length + b.grounding.length;
    const score = validatedSamples > 0
      ? Math.round((((schemaPassRate ?? 1) + (groundingPassRate ?? 1)) / 2) * 100)
      : Math.round((b.succeeded / b.n) * 100);
    out[model] = {
      score, schemaPassRate, groundingPassRate,
      hallucinationRate: groundingPassRate != null ? Math.round((1 - groundingPassRate) * 100) / 100 : null,
      averageLatencyMs: Math.round(b.latency / b.n), averageCostUsd: b.cost / b.n,
      testedAt: b.lastAt || new Date().toISOString(), n: b.n,
    };
  }
  return out;
}

/** CAPO's benchmark-side headline: quality-per-dollar, cheapest-first tiebreak. */
export function qualityPerDollar(rollup) {
  return Object.entries(rollup)
    .map(([model, b]) => ({ model, qualityPerDollar: b.averageCostUsd > 0 ? b.score / (b.averageCostUsd * 1000) : Infinity, ...b }))
    .sort((a, b) => b.qualityPerDollar - a.qualityPerDollar);
}
