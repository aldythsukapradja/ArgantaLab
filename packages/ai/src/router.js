// task → tier → provider. Config-driven so the operator picks providers per tier
// (default: everything free). Tasks are grouped by difficulty, not by feature.

export const TASK_TIER = {
  // tier 0 — small/local is plenty
  storyboard: 0, copy: 0, classify: 0, extract: 0, tag: 0,
  // tier 1 — needs real reasoning / tool use
  brief: 1, reason: 1, orchestrate: 1, tools: 1, analyze: 1,
  // tier 2 — opt-in best judgement
  judge: 2,
};

// Default provider per tier. `null` tiers fall back to the next-lower available.
export const DEFAULT_TIER_PROVIDER = { 0: 'webllm', 1: 'edgeProxy', 2: 'edgeProxy' };

// Resolve a task to a concrete provider id, honoring config overrides + what's
// actually available. Always returns SOMETHING (falls back to mock) so a call
// never hard-fails on a missing key/model.
export function route(task, config = {}) {
  const tier = config.taskTier?.[task] ?? TASK_TIER[task] ?? 1;
  const map = { ...DEFAULT_TIER_PROVIDER, ...(config.tierProvider || {}) };
  const available = config.available || {}; // { webllm:bool, edgeProxy:bool, openaiCompat:bool, mock:true }
  // try requested tier, then walk down, then mock
  for (let t = tier; t >= 0; t--) {
    const pid = map[t];
    if (pid && available[pid]) return { tier: t, provider: pid, model: config.model?.[pid] };
  }
  // nothing configured at/below tier — try any available real provider, else mock
  for (const pid of ['edgeProxy', 'openaiCompat', 'webllm']) if (available[pid]) return { tier, provider: pid, model: config.model?.[pid] };
  return { tier, provider: 'mock', model: 'mock' };
}
