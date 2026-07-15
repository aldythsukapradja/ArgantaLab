// ─────────────────────────────────────────────────────────────────────────
// C1 · Autonomy guardrails + invocation boundary  (Opus, contract-freeze)
// Two questions this module answers, purely and testably:
//   1. May THIS tool run, given who's asking and how much has been spent?
//   2. May the caller reach the gateways AT ALL (browser operator vs headless
//      mission)? — the security decision written up in ADR-0004.
// Reuses @arganta/ai's governance (budgetGuard/missionBudget/requiresApproval)
// so there is ONE budget/approval brain, not two.
// See docs/arganta-core/Arganta-Core-Concept.md, ADR-0004.
// ─────────────────────────────────────────────────────────────────────────

import { budgetGuard, missionBudget, requiresApproval, mustStayLocal, AUTONOMY } from '@arganta/ai';

export { missionBudget, AUTONOMY };

/**
 * The two ways a request can be authorized to reach the operator-gated
 * gateways. OPERATOR = a signed-in founder JWT (today's only path, browser).
 * INTERNAL = a server-side shared secret carried by the pg_net/cron path, which
 * has no user JWT. The internal secret NEVER ships to the browser (ADR-0004).
 */
export const AUTH_MODES = Object.freeze({ OPERATOR: 'operator-jwt', INTERNAL: 'internal-agent-secret' });

/**
 * Is this invocation of the gateway authorized? Pure logic behind ADR-0004.
 * - OPERATOR mode requires a real operator JWT (the browser path, unchanged).
 * - INTERNAL mode requires the internal secret AND an autonomy level that is
 *   actually scheduled/event/autopilot — an on-demand call has no business
 *   using the headless path.
 * Anything else is refused; a leaked-but-empty combination can't sneak through.
 */
export function isAuthorizedInvocation({ mode, hasOperatorJwt = false, hasInternalSecret = false, autonomyLevel = AUTONOMY.ON_DEMAND }) {
  if (mode === AUTH_MODES.OPERATOR) return { ok: !!hasOperatorJwt, reason: hasOperatorJwt ? 'operator' : 'no-operator-jwt' };
  if (mode === AUTH_MODES.INTERNAL) {
    if (!hasInternalSecret) return { ok: false, reason: 'no-internal-secret' };
    if (autonomyLevel < AUTONOMY.SCHEDULED) return { ok: false, reason: 'internal-path-needs-autonomy' };
    return { ok: true, reason: 'internal-autonomous' };
  }
  return { ok: false, reason: 'unknown-mode' };
}

/**
 * May this tool run in this context? The predicate the loop consults BEFORE
 * executing each tool. Returns { allowed, needsApproval, reason }.
 *
 * Refusal (allowed:false) is for hard governance breaches; needsApproval:true
 * means the tool COULD run but a human must confirm first (the loop surfaces an
 * approval-required trail entry instead of executing).
 *
 * @param {object} o
 * @param {import('./tools.js').ToolSpec} o.tool
 * @param {number} o.autonomyLevel  AUTONOMY.* — ON_DEMAND has a human present
 * @param {{costUsd:number,frontierCalls:number,totalCalls:number,tokens:number}} [o.running]
 * @param {object} [o.budget]       missionBudget(); default a tight one
 * @param {boolean} [o.granted]     an explicit standing grant for a side-effecting tool
 */
export function autonomyGate({ tool, autonomyLevel = AUTONOMY.ON_DEMAND, running, budget, granted = false }) {
  if (!tool) return { allowed: false, needsApproval: false, reason: 'unknown-tool' };
  const b = budget || missionBudget({});
  const run = running || { costUsd: 0, frontierCalls: 0, totalCalls: 0, tokens: 0 };
  const autonomous = autonomyLevel >= AUTONOMY.SCHEDULED;

  // Hard breaches — never, regardless of approval:
  if (mustStayLocal(tool.dataClass) && tool.costClass > 0)
    return { allowed: false, needsApproval: false, reason: 'restricted-data-external' };

  const bg = budgetGuard(b, run, { costClass: tool.costClass, costUsd: 0, tokens: 0 });
  if (!bg.ok) return { allowed: false, needsApproval: false, reason: `budget:${bg.reason}` };

  // A headless mission may ONLY run autonomy-safe tools; a side-effecting or
  // human-eyeball tool it wants must wait for a person — unless explicitly
  // granted a standing autopilot for that tool.
  if (autonomous && !tool.autonomySafe && !granted)
    return { allowed: false, needsApproval: true, reason: 'needs-human-not-autonomy-safe' };

  // Even with a human present, side-effecting / confidential-paid tools ask
  // first (reuse the governance approval brain, one source of truth).
  const appr = requiresApproval({ costClass: tool.costClass, dataClass: tool.dataClass, task: tool.name, estCostUsd: 0 });
  if (tool.sideEffect || appr.required)
    return { allowed: !autonomous || granted, needsApproval: true, reason: appr.required ? appr.reasons.join(',') : 'side-effect' };

  return { allowed: true, needsApproval: false, reason: 'ok' };
}
