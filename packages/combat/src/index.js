// @arganta/combat — one shared combat system for Kingdom Heroes + LashiraBloom.
// Edit the rules/numbers/skills here and BOTH games update. Rendering stays
// per-app; this owns damage, skills, monster state, and (via ./cluster) the
// bottom-right action cluster UI.
export * from './constants.js';
export * from './skills.js';
export * from './monsters.js';
export * from './resolve.js';
export * from './effects.js';
export * from './progression.js';
export * from './gear.js';
export * from './bestiary.js';
export * from './skins.js';
export * from './tuning.js';
export * from './tuningRepo.js';
export * from './emotes.js';
export { GameIcon } from './icons/Icon.jsx';
