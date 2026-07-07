// @arganta/combat — one shared combat system for Kingdom Heroes + LashiraBloom.
// Edit the rules/numbers/skills here and BOTH games update. Rendering stays
// per-app; this owns damage, skills, monster state, and (via ./cluster) the
// bottom-right action cluster UI.
export * from './constants.js';
export * from './skills.js';
export * from './monsters.js';
export * from './resolve.js';
export * from './effects.js';
