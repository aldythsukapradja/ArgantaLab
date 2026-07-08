// Character progression — shared by both games. Two parts:
//   1. PATHS: HP/MP archetypes (warrior/rogue/poet/mage) — different pools + growth.
//   2. XP ladder: an EXPONENTIAL curve (cap 99) so the climb to 99 gets steadily
//      harder. Calibrated so level 50 ≈ 24.6k XP (matches the old linear curve at
//      50), then 50→99 costs ~28× more — a real end-game grind.
//
// SAFETY: never re-derive a level DOWN. Consumers floor a player's level at their
// stored/account level (see levelWithFloor) so existing heroes (e.g. a level-50
// player) can never regress when this curve replaces the old one.

export const LEVEL_CAP = 99;

// Path archetypes. hp/mp = the level-1 pool; hpPer/mpPer = added each level.
// Warrior = tanky (most HP, least MP) … Mage = glass cannon (least HP, most MP).
export const PATHS = {
  warrior: { id: 'warrior', name: 'Warrior', icon: '⚔️', hp: 130, hpPer: 14, mp: 24, mpPer: 2 },
  rogue:   { id: 'rogue',   name: 'Rogue',   icon: '🗡️', hp: 105, hpPer: 11, mp: 36, mpPer: 3 },
  poet:    { id: 'poet',    name: 'Poet',    icon: '✒️', hp: 90,  hpPer: 8,  mp: 50, mpPer: 4 },
  mage:    { id: 'mage',    name: 'Mage',    icon: '🔮', hp: 70,  hpPer: 6,  mp: 60, mpPer: 5 },
};
export function pathOf(id) { return PATHS[id] || PATHS.warrior; }

const clampLevel = (L) => Math.max(1, Math.min(LEVEL_CAP, Math.floor(Number(L) || 1)));

export function pathMaxHp(pathId, level) { const p = pathOf(pathId); return Math.round(p.hp + p.hpPer * (clampLevel(level) - 1)); }
export function pathMaxMp(pathId, level) { const p = pathOf(pathId); return Math.round(p.mp + p.mpPer * (clampLevel(level) - 1)); }

// Kingdom heroes carry a WEAPON, not a class yet — map it to a default path
// (override later if we add an explicit class picker).
export function pathForWeapon(weapon) {
  const w = String(weapon || '').toLowerCase();
  if (w.includes('bow')) return 'rogue';
  if (w.includes('fan')) return 'poet';
  if (w.includes('staff') || w.includes('wand') || w.includes('rod') || w.includes('book')) return 'mage';
  if (w.includes('sword') || w.includes('spear') || w.includes('axe') || w.includes('lance')) return 'warrior';
  return 'warrior';
}

// --- Exponential XP ladder ---
const XP_BASE = 65, XP_GROWTH = 1.07;
// TOTAL xp required to REACH level L (level 1 = 0).
export function xpForLevel(level) {
  const n = clampLevel(level);
  if (n <= 1) return 0;
  return Math.round(XP_BASE * (Math.pow(XP_GROWTH, n - 1) - 1) / (XP_GROWTH - 1));
}
// Level implied by a raw XP total (capped at 99).
export function levelFromXp(xp) {
  const x = Math.max(0, Number(xp) || 0);
  let L = 1;
  while (L < LEVEL_CAP && xpForLevel(L + 1) <= x) L++;
  return L;
}
// Level, floored at a hero's stored/account level so it can NEVER drop.
export function levelWithFloor(xp, floorLevel = 1) {
  return Math.min(LEVEL_CAP, Math.max(clampLevel(floorLevel), levelFromXp(xp)));
}
// 0..1 progress through the current level (for the XP bar).
export function levelProgress(xp) {
  const x = Math.max(0, Number(xp) || 0);
  const L = levelFromXp(x);
  if (L >= LEVEL_CAP) return 1;
  const a = xpForLevel(L), b = xpForLevel(L + 1);
  return b > a ? Math.max(0, Math.min(1, (x - a) / (b - a))) : 0;
}
// XP still needed to reach the next level (0 at the cap).
export function xpToNext(xp) {
  const L = levelFromXp(xp);
  if (L >= LEVEL_CAP) return 0;
  return Math.max(0, xpForLevel(L + 1) - Math.max(0, Number(xp) || 0));
}
