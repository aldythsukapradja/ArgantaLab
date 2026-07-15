// ─────────────────────────────────────────────────────────────────────────
// C1 · Tool registry contract  (Opus, contract-freeze)
// The single list of things Arganta Core can DO, unifying the media engines,
// the live-data analytics tools (apps/hq/src/data/agentTools.ts), memory
// search, and office delegation under ONE spec shape. This is what the model
// sees (function-calling schema) AND what the C3 executor implements. The spec
// carries the governance a tool needs — cost class, data class, whether it has
// outside side-effects, and whether it may run autonomously — so the loop and
// autonomy gate can reason about a tool WITHOUT executing it.
// See docs/arganta-core/Arganta-Core-Concept.md and ADR-0004.
// ─────────────────────────────────────────────────────────────────────────

/** What backs a tool at runtime (C3 injects the matching executor). */
export const TOOL_BACKINGS = Object.freeze(['gateway', 'engine', 'analytics', 'memory', 'delegation', 'meta']);

/**
 * @typedef {Object} ToolSpec
 * @property {string} name        function-call name the model uses
 * @property {string} title       human label for the tool-trail UI
 * @property {string} description one sentence — what it does + when to use it
 * @property {object} params      JSON Schema for the arguments
 * @property {string} backing     one of TOOL_BACKINGS
 * @property {number} costClass   0 Sovereign · 1 Sponsored · 2 Economy · 3 Frontier (the tier its work runs at)
 * @property {string} dataClass   max sensitivity of data it may touch (public|internal|confidential|restricted)
 * @property {boolean} sideEffect true if it publishes/mutates state OUTSIDE the conversation (never silently autonomous)
 * @property {boolean} autonomySafe true if it may run headless without a human in the loop (read-only, cheap, non-publishing)
 */

/**
 * The frozen registry. costClass is the tier the tool's work lands at TODAY
 * (deterministic engines = 0; the Cloudflare gateways = 1). autonomySafe is
 * deliberately conservative: anything that spends money you don't yet control,
 * or produces something a human should eyeball, is false.
 * @type {ReadonlyArray<ToolSpec>}
 */
export const TOOL_SPECS = Object.freeze([
  {
    name: 'generate_image', title: 'Generate image', backing: 'gateway', costClass: 1, dataClass: 'public', sideEffect: false, autonomySafe: true,
    description: 'Create an image from a text prompt (Cloudflare FLUX, free tier). Saves it to media-artifacts.',
    params: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] },
  },
  {
    name: 'generate_speech', title: 'Voice a line', backing: 'gateway', costClass: 1, dataClass: 'public', sideEffect: false, autonomySafe: true,
    description: 'Synthesize speech from text (Cloudflare Aura-1). Returns a saved audio clip. voice = JM (male) or KF (female).',
    params: { type: 'object', properties: { text: { type: 'string' }, voice: { type: 'string', enum: ['JM', 'KF'] } }, required: ['text'] },
  },
  {
    name: 'make_website', title: 'Build a landing page', backing: 'engine', costClass: 0, dataClass: 'public', sideEffect: false, autonomySafe: true,
    description: 'Generate a self-contained landing page (deterministic, instant, $0) from a brief.',
    params: { type: 'object', properties: { brief: { type: 'string' } }, required: ['brief'] },
  },
  {
    name: 'make_deck', title: 'Build a slide deck', backing: 'engine', costClass: 0, dataClass: 'public', sideEffect: false, autonomySafe: true,
    description: 'Generate a cinematic HTML slide deck (deterministic, instant, $0) from a topic.',
    params: { type: 'object', properties: { topic: { type: 'string' } }, required: ['topic'] },
  },
  {
    name: 'make_brand', title: 'Make a brand kit', backing: 'engine', costClass: 0, dataClass: 'public', sideEffect: false, autonomySafe: true,
    description: 'Generate a seeded palette + type kit (deterministic, $0) from a name or vibe.',
    params: { type: 'object', properties: { seed: { type: 'string' } }, required: ['seed'] },
  },
  {
    name: 'analyze', title: 'Analyze data', backing: 'analytics', costClass: 0, dataClass: 'confidential', sideEffect: false, autonomySafe: true,
    description: 'Answer a data question with the right chart, grounded in LIVE Supabase metrics. Real revenue data → stays local (confidential).',
    params: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] },
  },
  {
    name: 'search_vault', title: 'Search memory', backing: 'memory', costClass: 1, dataClass: 'internal', sideEffect: false, autonomySafe: true,
    description: 'Semantic search across the founder Vault + past threads (pgvector, CF embeddings). Returns the most relevant notes.',
    params: { type: 'object', properties: { query: { type: 'string' }, k: { type: 'number' } }, required: ['query'] },
  },
  {
    name: 'consult_office', title: 'Consult an office', backing: 'delegation', costClass: 2, dataClass: 'internal', sideEffect: false, autonomySafe: false,
    description: 'Delegate a question to a C-Level office (bridge/operations/technology/treasury/legal/roster) and fold its recommendation back in.',
    params: { type: 'object', properties: { office: { type: 'string' }, question: { type: 'string' } }, required: ['office', 'question'] },
  },
  {
    name: 'check_quota', title: 'Check neuron quota', backing: 'meta', costClass: 0, dataClass: 'internal', sideEffect: false, autonomySafe: true,
    description: 'Report today’s Cloudflare Workers AI neuron usage vs the free daily allocation.',
    params: { type: 'object', properties: {} },
  },
  {
    name: 'check_ledger', title: 'Check the run ledger', backing: 'meta', costClass: 0, dataClass: 'internal', sideEffect: false, autonomySafe: true,
    description: 'Report recent generation runs + spend from the truthful agent_runs ledger.',
    params: { type: 'object', properties: { days: { type: 'number' } } },
  },
]);

export const toolByName = (name) => TOOL_SPECS.find((t) => t.name === name) || null;

/** Filter to the tools a given context may offer the model. Autonomous contexts
 * only ever see autonomySafe tools — a headless mission can't even be TEMPTED to
 * call a publishing tool (defence in depth alongside autonomyGate). */
export function availableTools(specs = TOOL_SPECS, { autonomous = false, maxCostClass = 3 } = {}) {
  return specs.filter((t) => t.costClass <= maxCostClass && (!autonomous || t.autonomySafe));
}

// ── provider translation — the model needs OpenAI- or Anthropic-shaped tool
// definitions; strip our governance metadata, keep only name/description/params.
export function toOpenAITools(specs = TOOL_SPECS) {
  return specs.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.params } }));
}
export function toAnthropicTools(specs = TOOL_SPECS) {
  return specs.map((t) => ({ name: t.name, description: t.description, input_schema: t.params }));
}
