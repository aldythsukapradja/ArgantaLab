// @arganta/agent — Arganta Core's agentic runtime CONTRACTS (C1, Opus batch).
// Pure, framework-agnostic, node-testable. Sits on top of @arganta/ai (the
// model router) and is consumed by the C3 loop wiring + C4b chat UI. See
// docs/arganta-core/Arganta-Core-Concept.md and docs/adr/0004-*.
export * from './thread.js';       // C1 · conversation schema (threads/messages/blocks + row mapping)
export * from './tools.js';        // C1 · unified tool registry + provider translators
export * from './autonomy.js';     // C1 · autonomy gate + invocation auth boundary (ADR-0004)
export * from './delegation.js';   // C1 · office delegation protocol
export * from './loop.js';         // C1 · pure agentic loop (bounded, budgeted, honest)
export * from './embed.js';        // C1 · mount + embedding contract (mobile-fullscreen, modular)
