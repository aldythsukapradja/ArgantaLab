// @arganta/character — one shared character-appearance registry for Circle HQ,
// Kingdom Heroes, and LashiraBloom. HQ publishes the canonical preset specs;
// both games read them on boot. The player's personal hero build is untouched —
// this owns only the shared/default/NPC looks.
export * from './registry.js';
export * from './registryRepo.js';
