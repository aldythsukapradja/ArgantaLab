// ─────────────────────────────────────────────────────────────────────────
// WS-A · Tier & Task Ontology  (Opus, contract-freeze)
// The canonical taxonomy for the Arganta Four-Tier LLM Router. This is the
// single source of truth every other module — and @arganta/media-core — routes
// against. See docs/adr/0001-four-tier-llm-router.md.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Cost class — the lowest-cost intelligence capable of a task reliably.
 * Identical 0..3 scale to media-core's maturityStage (aliased in that package).
 */
export const COST_CLASS = Object.freeze({ SOVEREIGN: 0, SPONSORED: 1, ECONOMY: 2, FRONTIER: 3 });
export const COST_LABEL = ['Sovereign', 'Sponsored', 'Economy', 'Frontier'];
/** Friendly labels for the Media Center tier pill (same 0..3). */
export const COST_LABEL_FRIENDLY = ['Free · local', 'Free API', 'Economy', 'Premium'];

/** Sub-tiers inside Tier 0 — where most work should land. */
export const SUBTIER_0 = Object.freeze({ DETERMINISTIC: '0A', LOCAL_FAST: '0B', LOCAL_STRONG: '0C' });

/** Autonomy is orthogonal to cost — a Tier-0 model can be autopilot only for
 *  tightly constrained deterministic tasks; a Tier-3 model still needs approval
 *  to publish unless its grant says otherwise. */
export const AUTONOMY = Object.freeze({ ON_DEMAND: 0, SCHEDULED: 1, EVENT: 2, AUTOPILOT: 3 });
export const AUTONOMY_LABEL = ['on-demand', 'scheduled', 'event-triggered', 'approved-autopilot'];

/** The task classes the router understands. */
export const TASK_CLASSES = [
  'classify', 'extract', 'tag', 'rewrite', 'summarize', 'localize', 'rag-answer',
  'storyboard', 'copy', 'brief', 'analyze', 'code', 'plan', 'orchestrate', 'tool-plan',
  'synthesize', 'judge', 'legal-review', 'financial-review', 'security-review',
  'release-review', 'agent-spec-edit',
];

/** Data classification — governs which tiers a task may route to. */
export const DATA_CLASSES = ['public', 'internal', 'confidential', 'restricted'];

/** Where a model executes. */
export const EXECUTION = ['deterministic', 'browser', 'local-server', 'external-api'];

/** Capability flags a task can require. */
export const CAPABILITIES = ['chat', 'json', 'jsonSchema', 'tools', 'vision', 'reasoning', 'code', 'streaming', 'embeddings', 'reranking'];

export const isCostClass = (c) => c === 0 || c === 1 || c === 2 || c === 3;
export const isTaskClass = (t) => TASK_CLASSES.includes(t);
export const isDataClass = (d) => DATA_CLASSES.includes(d);

/** A Tier-0 (Sovereign) route never leaves the device / Arganta infra. */
export const isSovereign = (costClass) => costClass === COST_CLASS.SOVEREIGN;
