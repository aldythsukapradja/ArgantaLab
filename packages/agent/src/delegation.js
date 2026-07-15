// ─────────────────────────────────────────────────────────────────────────
// C1 · Delegation protocol  (Opus, contract-freeze)
// How Arganta Core hands a question to a C-Level office and folds the answer
// back into the conversation. Offices are the canonical org lens already used
// by the graph (apps/hq/src/data/graph/types.ts OfficeId) and the 25-agent
// roster (apps/hq/src/data/agents.ts) maps into them. The `consult_office`
// tool (tools.js) is the surface; this is the protocol behind it.
// See docs/arganta-core/Arganta-Core-Concept.md.
// ─────────────────────────────────────────────────────────────────────────

/** The six offices — MUST match graph/types.ts OfficeId exactly. */
export const OFFICES = Object.freeze(['bridge', 'operations', 'technology', 'treasury', 'legal', 'roster']);
export const isOffice = (o) => OFFICES.includes(o);

/** What each office owns + keywords that route a concern to it. The roster
 * (people/agents) is the fallback lens for anything org/hiring/agent-shaped. */
export const OFFICE_META = Object.freeze({
  bridge:      { label: 'The Bridge',   owns: 'strategy, orchestration, founder decisions', keywords: ['strategy', 'decision', 'priorit', 'roadmap', 'vision', 'launch'] },
  operations:  { label: 'Operations',   owns: 'portfolio rhythm, growth, product ops',      keywords: ['growth', 'ops', 'retention', 'engagement', 'rhythm', 'product'] },
  technology:  { label: 'Technology',   owns: 'architecture, builds, data, security',        keywords: ['architect', 'build', 'code', 'schema', 'security', 'data', 'infra'] },
  treasury:    { label: 'Treasury',     owns: 'economy, monetization, spend, runway',        keywords: ['revenue', 'cost', 'monetiz', 'econom', 'budget', 'spend', 'runway', 'pricing'] },
  legal:       { label: 'Legal',        owns: 'compliance, risk, terms, privacy',            keywords: ['legal', 'complian', 'privacy', 'risk', 'terms', 'contract'] },
  roster:      { label: 'Roster',       owns: 'the agent org itself, people, hiring',        keywords: ['agent', 'hir', 'team', 'roster', 'role', 'org'] },
});

/**
 * Deterministic router: which office should own this question? Keyword match,
 * first office to hit wins by OFFICES order; honest default is `bridge` (the
 * orchestrator) rather than guessing. The model can always override by naming
 * an office explicitly in consult_office({ office }).
 */
export function routeConcern(text = '') {
  const s = String(text).toLowerCase();
  for (const o of OFFICES) {
    if (OFFICE_META[o].keywords.some((k) => s.includes(k))) return o;
  }
  return 'bridge';
}

/**
 * The request handed to an office sub-agent. `parentRunId` threads the
 * delegation into the same run lineage; `dataClass` is inherited so a
 * confidential parent can't leak via a delegated child.
 * @returns frozen request
 */
export function delegationRequest({ office, question, parentRunId = null, dataClass = 'internal' }) {
  const target = isOffice(office) ? office : routeConcern(question);
  return Object.freeze({ office: target, question: String(question ?? ''), parentRunId, dataClass });
}

/**
 * Normalize an office's answer into the shape the loop folds back: a `tool`
 * result the model reads AND a `delegation` block/trail entry the UI shows.
 * Honest: if the office had no live model / returned empty, that is surfaced,
 * never papered over.
 */
export function delegationResponse({ office, text, ok = true }) {
  const summary = (text && String(text).trim()) || '(no recommendation — office offline or no live model)';
  return Object.freeze({
    office,
    ok: ok && !!(text && String(text).trim()),
    summary,
    // what the model reads back as the tool result:
    toolResult: { office, recommendation: summary },
    // what the UI renders (makeBlock('delegation', block)):
    block: { office, summary: summary.slice(0, 240) },
  });
}
