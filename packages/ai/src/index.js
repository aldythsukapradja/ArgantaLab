// @arganta/ai — the shared LLM runtime. See docs/circle-ai-llm-runtime-mapping.md
// and docs/media-center/Intelligence-Router.md (Four-Tier Router).
export * from './schemas.js';
export * from './router.js';   // legacy task→tier→provider (deprecated by policy.js; kept for existing consumers)
export * from './adapter.js';

// ── Four-Tier LLM Router — Opus contract batch (WS-A..D) ──────────────────
export * from './tiers.js';       // WS-A · ontology
export * from './modelspec.js';   // WS-A · model registry contract
export * from './policy.js';      // WS-B · task policy + selectModel + escalation
export * from './governance.js';  // WS-C · data-class + cost governance
export * from './ledger.js';      // WS-D · agent_runs metering + CAPO

// ── Sonnet implementation batch (WS-1, WS-2) ───────────────────────────────
export * from './rack.js';          // WS-1 · sovereign model manifest + device profiling
export * from './registry.js';      // WS-2 · MODEL_REGISTRY builder
export { createIntelligence } from './intelligence.js'; // WS-2 · selectModel-driven facade
export * from './validators.js'; // WS-4 · schema/grounding/policy/cost/quality + runValidators
export * from './benchmarks.js'; // WS-8 · rollupBenchmarks (bootstrapped from real validated usage)
