// ─────────────────────────────────────────────────────────────────────────
// WS-2 · Model Registry impl  (Sonnet)
// Builds MODEL_REGISTRY from whatever's actually configured/available at
// runtime — the sovereign rack (always, if webllm is enabled) + non-sovereign
// entries gated behind the providers createLLM was actually given. This is the
// single source selectModel() (WS-B policy.js) ranks against.
// ─────────────────────────────────────────────────────────────────────────

import { modelSpec } from './modelspec.js';
import { SOVEREIGN_MODELS } from './rack.js';

// Sponsored/Economy/Frontier catalog entries. `provider` here is the GATEWAY's
// upstream provider name (WS-3 makes the edge function actually call these) —
// distinct from the local adapter provider id ('edgeProxy'), which is why each
// entry also carries `gatewayProvider` for the truthful-return contract.
const NON_SOVEREIGN_CATALOG = [
  // Tier 1 — Sponsored (free quotas)
  modelSpec({ id: 'gemini-flash-free', name: 'Gemini Flash (free)', provider: 'edgeProxy', apiModel: 'gemini-1.5-flash', costClass: 1, execution: 'external-api', capabilities: { chat: true, json: true, jsonSchema: true, tools: true, reasoning: true }, dataClasses: ['public', 'internal'], contextWindow: 1000000, priority: 30 }).spec,
  modelSpec({ id: 'groq-llama-free', name: 'Groq Llama (free)', provider: 'edgeProxy', apiModel: 'llama-3.3-70b-versatile', costClass: 1, execution: 'external-api', capabilities: { chat: true, json: true, tools: true, reasoning: true }, dataClasses: ['public', 'internal'], contextWindow: 128000, priority: 32 }).spec,
  // Tier 2 — Economy (cheap paid)
  modelSpec({ id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'edgeProxy', apiModel: 'deepseek-chat', costClass: 2, execution: 'external-api', capabilities: { chat: true, json: true, reasoning: true, code: true }, dataClasses: ['public', 'internal'], contextWindow: 64000, pricing: { inputUsdPerMillion: 0.14, outputUsdPerMillion: 0.28 }, priority: 40 }).spec,
  modelSpec({ id: 'claude-haiku', name: 'Claude Haiku', provider: 'edgeProxy', apiModel: 'claude-haiku-4-5', costClass: 2, execution: 'external-api', capabilities: { chat: true, json: true, jsonSchema: true, tools: true, reasoning: true, code: true }, dataClasses: ['public', 'internal'], contextWindow: 200000, pricing: { inputUsdPerMillion: 1, outputUsdPerMillion: 5 }, priority: 42 }).spec,
  // Tier 3 — Frontier (premium reasoning)
  modelSpec({ id: 'claude-sonnet', name: 'Claude Sonnet', provider: 'edgeProxy', apiModel: 'claude-sonnet-5', costClass: 3, execution: 'external-api', capabilities: { chat: true, json: true, jsonSchema: true, tools: true, reasoning: true, code: true, vision: true }, dataClasses: ['public', 'internal'], contextWindow: 200000, pricing: { inputUsdPerMillion: 3, outputUsdPerMillion: 15 }, priority: 50 }).spec,
  modelSpec({ id: 'claude-opus', name: 'Claude Opus', provider: 'edgeProxy', apiModel: 'claude-opus-4-8', costClass: 3, execution: 'external-api', capabilities: { chat: true, json: true, jsonSchema: true, tools: true, reasoning: true, code: true, vision: true }, dataClasses: ['public', 'internal'], contextWindow: 200000, pricing: { inputUsdPerMillion: 15, outputUsdPerMillion: 75 }, priority: 52 }).spec,
];

/**
 * Build the live registry. Sovereign entries are included only when webllm is
 * enabled (a device might not support it — selectModel's runtime filter still
 * applies per-call); non-sovereign entries are included only when the local
 * `edgeProxy` adapter is actually configured — until WS-3 ships, the gateway
 * doesn't yet route to distinct upstream providers, so these stay `preview`
 * (excluded from `isActive` filtering) rather than silently misrepresenting
 * what the edge function can really do today.
 *
 * @param {{webllm?:boolean, edgeProxy?:boolean, gatewayIsTruthful?:boolean}} available
 */
export function buildRegistry(available = {}) {
  const sovereign = available.webllm ? SOVEREIGN_MODELS : [];
  const nonSovereign = available.edgeProxy
    ? NON_SOVEREIGN_CATALOG.map((m) => ({ ...m, lifecycle: available.gatewayIsTruthful ? 'active' : 'preview' }))
    : [];
  return [...sovereign, ...nonSovereign];
}

export const MODEL_REGISTRY_CATALOG = Object.freeze([...SOVEREIGN_MODELS, ...NON_SOVEREIGN_CATALOG]);
