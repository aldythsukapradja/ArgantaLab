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

// Path archetypes. hp/mp = the LEVEL-1 pool; hpPer/mpPer = added each level, tuned
// so the L99 pools land at the values below (RPG "holy quaternary" spread — cf.
// Final Fantasy / WoW: fighters = big HP/tiny MP, casters = tiny HP/big MP).
//   L99 HP:  Warrior 10,018 · Rogue 7,548 · Poet 5,573 · Mage 4,382
//   L99 MP:  Mage 8,013 · Poet 5,940 · Rogue 3,573 · Warrior 1,990
//   L99 HP:MP ratio: Warrior 5.0:1 · Rogue 2.1:1 · Poet ~1:1 · Mage 0.55:1
// Ids stay warrior/rogue/poet/mage (stable keys); the displayed NAMES are the
// renamed classes (Guardian/Shadow/Mystic/Arcanist).
export const PATHS = {
  warrior: { id: 'warrior', name: 'Guardian', icon: '⚔️', hp: 120, hpPer: 101, mp: 30, mpPer: 20 },
  rogue:   { id: 'rogue',   name: 'Shadow',   icon: '🗡️', hp: 100, hpPer: 76,  mp: 45, mpPer: 36 },
  poet:    { id: 'poet',    name: 'Mystic',   icon: '✨', hp: 85,  hpPer: 56,  mp: 60, mpPer: 60 },
  mage:    { id: 'mage',    name: 'Arcanist', icon: '🔮', hp: 70,  hpPer: 44,  mp: 75, mpPer: 81 },
};
export function pathOf(id) { return PATHS[id] || PATHS.warrior; }

// Per-path level TITLES (shown in the card in place of the class word). Bands at
// levels 1/15/30/50/70/90; avoids "Sage" (collides with the ArgantaLab rank).
const TITLE_BANDS = [1, 15, 30, 50, 70, 90];
const TITLES = {
  warrior: ['Recruit', 'Footman', 'Warden', 'Knight', 'Bulwark', 'Vanguard'],
  rogue:   ['Cutpurse', 'Prowler', 'Stalker', 'Nightblade', 'Reaper', 'Phantom'],
  poet:    ['Acolyte', 'Seer', 'Oracle', 'Diviner', 'Augur', 'Ascendant'],
  mage:    ['Apprentice', 'Adept', 'Conjurer', 'Warlock', 'Archmage', 'Grandmagus'],
};
export function pathTitle(pathId, level) {
  const list = TITLES[pathId] || TITLES.warrior;
  const L = Math.max(1, Number(level) || 1);
  let idx = 0;
  for (let i = 0; i < TITLE_BANDS.length; i++) if (L >= TITLE_BANDS[i]) idx = i;
  return list[idx];
}

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
