// ─────────────────────────────────────────────────────────────────────────
// WS-C · Data-Class & Cost Governance  (Opus)
// The privacy + spend guardrails the router MUST honor. Sensitive data stays
// local; paid tiers respect mission budgets; premium/high-risk needs approval.
// See docs/adr/0003-data-classification-governance.md.
// ─────────────────────────────────────────────────────────────────────────

import { COST_CLASS, DATA_CLASSES } from './tiers.js';

/**
 * Which cost classes a data class may EVER route to (before task policy narrows
 * it). Doc §Data Classification:
 *   public       → any tier
 *   internal     → Tier 0, approved Tier 2/3 (Tier 1 needs provider-policy ok)
 *   confidential → Tier 0, approved paid enterprise routes only
 *   restricted   → deterministic / local only, never external
 */
const DATA_ALLOWED = {
  public:       new Set([0, 1, 2, 3]),
  internal:     new Set([0, 2, 3]),          // Tier 1 gated separately
  confidential: new Set([0]),                // + explicitly-approved paid, added by caller
  restricted:   new Set([0]),                // Tier 0 only, and only local/deterministic
};

export function allowedCostClasses(dataClass, opts = {}) {
  const base = new Set(DATA_ALLOWED[dataClass] || DATA_ALLOWED.restricted);
  if (dataClass === 'internal' && opts.tier1Approved) base.add(1);
  if (dataClass === 'confidential' && opts.enterprisePaidApproved) { base.add(2); base.add(3); }
  return base;
}

/** True if this exact model is permitted to see this data class. Restricted
 *  data may only touch local/deterministic execution — never external-api. */
export function isRouteAllowed(model, dataClass, opts = {}) {
  if (!DATA_CLASSES.includes(dataClass)) return false;
  if (!allowedCostClasses(dataClass, opts).has(model.costClass)) return false;
  if ((dataClass === 'restricted' || dataClass === 'confidential') && model.execution === 'external-api') {
    // confidential may use approved paid ONLY if explicitly enterprise-approved
    if (dataClass === 'restricted') return false;
    if (dataClass === 'confidential' && !opts.enterprisePaidApproved) return false;
  }
  return true;
}

/** Restricted data must never leave the device. */
export const mustStayLocal = (dataClass) => dataClass === 'restricted';

// ---- cost controls (doc §Cost Controls) -----------------------------------
/** @typedef {{maxCostUsd:number,maxFrontierCalls:number,maxTotalCalls:number,maxTokens:number}} MissionBudget */
export const missionBudget = (b = {}) => ({
  maxCostUsd: b.maxCostUsd ?? 0.02, maxFrontierCalls: b.maxFrontierCalls ?? 0,
  maxTotalCalls: b.maxTotalCalls ?? 20, maxTokens: b.maxTokens ?? 200000,
});

/** Would this planned call bust the budget? Returns {ok, reason}. */
export function budgetGuard(budget, running, planned) {
  if (running.costUsd + planned.costUsd > budget.maxCostUsd) return { ok: false, reason: 'maxCostUsd' };
  if (planned.costClass === COST_CLASS.FRONTIER && running.frontierCalls + 1 > budget.maxFrontierCalls) return { ok: false, reason: 'maxFrontierCalls' };
  if (running.totalCalls + 1 > budget.maxTotalCalls) return { ok: false, reason: 'maxTotalCalls' };
  if (running.tokens + planned.tokens > budget.maxTokens) return { ok: false, reason: 'maxTokens' };
  return { ok: true, reason: 'within-budget' };
}

// ---- approval policy ------------------------------------------------------
/**
 * Does this run require human approval before its artifact publishes?
 * Frontier always for high-risk; confidential/restricted external; over-budget;
 * or when the agent's policy sets a $ threshold.
 */
export function requiresApproval({ costClass, dataClass, task, estCostUsd = 0, agentPolicy = {} }) {
  const reasons = [];
  if (task && /review|agent-spec-edit/.test(task)) reasons.push('high-risk-task');
  if (costClass === COST_CLASS.FRONTIER) reasons.push('frontier');
  if (dataClass === 'restricted') reasons.push('restricted-data');
  if (dataClass === 'confidential' && costClass >= COST_CLASS.ECONOMY) reasons.push('confidential-paid');
  if (agentPolicy.requireHumanAboveCostUsd != null && estCostUsd > agentPolicy.requireHumanAboveCostUsd) reasons.push('over-agent-threshold');
  return { required: reasons.length > 0, reasons };
}

/** Agent-level model policy (doc §Agent-Level Model Policy). */
export const agentModelPolicy = (p = {}) => ({
  defaultTaskClass: p.defaultTaskClass || 'summarize',
  defaultCostClass: p.defaultCostClass ?? COST_CLASS.SOVEREIGN,
  maximumCostClass: p.maximumCostClass ?? COST_CLASS.ECONOMY,
  allowedModels: p.allowedModels || null,
  blockedModels: p.blockedModels || null,
  dataClass: p.dataClass || 'internal',
  requireHumanAboveCostUsd: p.requireHumanAboveCostUsd ?? null,
});
