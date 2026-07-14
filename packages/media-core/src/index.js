// @arganta/media-core — provider-agnostic media generation router.
//
// One call: generate({ kind, spec, maturityStage, approved }).
// Routing walks DOWN to the cheapest capable provider; premium (stage 3) is
// approval-gated. Deterministic image runs in Node today; music/video/voice
// defer to the existing @arganta/audio + @arganta/video browser engines;
// premium defers to paid MCP providers. See README.md.

export * from './contracts.js';
export * from './router.js';
export * from './registry.js';
export { generate, createRegistry } from './core.js';
export { generateImage, PALETTES, STYLES } from './adapters/image-deterministic.js';
export { encodePNG } from './png.js';
