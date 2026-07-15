// @arganta/builder — Single-File Builder kernel CONTRACTS (B1, Opus batch).
// Pure, framework-agnostic, node-testable. The frozen interfaces the B2
// generation, B3 versions/migration, B4 components, and B5 publish build
// against. Executors (which call the app's engines + llm-proxy) live app-side
// in apps/hq/src/builder-core/ (B2/B3), same split as @arganta/agent ↔ lib/core.
// See docs/arganta-core/Single-File-Builder.md and docs/adr/0005-*.
export * from './types.js';       // B1 · kinds/status/visibility/archetypes + classifier
export * from './schema.js';      // B1 · hq_artifact + artifact_version column + row-mapping contract
export * from './validate.js';    // B1 · deterministic HTML validation gate (structural/security/quality)
export * from './tools.js';       // B1 · builder tool specs (publish = sideEffect, never autonomy-safe)
export * from './prompts.js';     // B1 · generalized generation contract (mode-aware, Circle-optional)
export * from './components.js';  // B1 · portable component shape + selector
export * from './registry.js';    // B4b · the 20 portable blocks (generated, npm run blocks:build)
