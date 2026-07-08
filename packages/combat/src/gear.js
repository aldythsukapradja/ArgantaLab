// Gear — weapon + armor tiers, shared by both games. This is the missing "power
// axis" beyond level: a weapon adds ATK to every hit, armor adds DEF (damage
// reduction) + bonus HP. Crafted/upgraded at the Forge (see cost tables).
//
// Damage model:
//   outgoingDamage(base, weaponTier) = base(skill/melee at level) + weapon ATK
//   incomingDamage(mobAtk, armorTier) = max(1, mobAtk − armor DEF)
//
// Costs are the "spend to REACH this tier" bundle. Exponential so each tier is a
// multi-session goal (mirrors the XP marathon + rank rules).

export const WEAPON_TIERS = [
  { tier: 1, name: 'Worn',    atk: 0,    cost: null },
  { tier: 2, name: 'Iron',    atk: 60,   cost: { bloom: 500,    wood: 20, stone: 15, ore: 5 } },
  { tier: 3, name: 'Steel',   atk: 180,  cost: { bloom: 2500,   ore: 20, gem: 3, ingot: 2 } },
  { tier: 4, name: 'Mythril', atk: 450,  cost: { bloom: 10000,  gem: 12, ingot: 4, token: 1 } },
  { tier: 5, name: 'Astral',  atk: 1000, cost: { bloom: 40000,  gem: 30, shard: 1, token: 5 } },
];

export const ARMOR_TIERS = [
  { tier: 1, name: 'Cloth',   def: 0,   hp: 0,    cost: null },
  { tier: 2, name: 'Leather', def: 20,  hp: 300,  cost: { bloom: 400,   wood: 25, fish: 5 } },
  { tier: 3, name: 'Chain',   def: 60,  hp: 900,  cost: { bloom: 2000,  ore: 18, stone: 30 } },
  { tier: 4, name: 'Plate',   def: 140, hp: 2500, cost: { bloom: 9000,  gem: 10, ingot: 3 } },
  { tier: 5, name: 'Aegis',   def: 320, hp: 6000, cost: { bloom: 35000, gem: 28, shard: 1 } },
];

export const WEAPON_MAX = WEAPON_TIERS.length; // 5
export const ARMOR_MAX = ARMOR_TIERS.length;   // 5

const clampIdx = (t, arr) => Math.max(0, Math.min(arr.length - 1, (Math.floor(Number(t)) || 1) - 1));
export function weaponOf(tier) { return WEAPON_TIERS[clampIdx(tier, WEAPON_TIERS)]; }
export function armorOf(tier) { return ARMOR_TIERS[clampIdx(tier, ARMOR_TIERS)]; }

export function weaponAtk(tier) { return weaponOf(tier).atk; }
export function armorDef(tier) { return armorOf(tier).def; }
export function armorHp(tier) { return armorOf(tier).hp; }

// Player's dealt damage: level-scaled base (melee/skill) + weapon ATK.
export function outgoingDamage(base, weaponTier) {
  return Math.round((Number(base) || 0) + weaponAtk(weaponTier));
}
// Player's taken damage: monster ATK minus armor DEF, never below 1.
export function incomingDamage(mobAtk, armorTier) {
  return Math.max(1, Math.round((Number(mobAtk) || 0) - armorDef(armorTier)));
}

// Cost to upgrade FROM the current tier to the next; null when already max.
export function weaponUpgradeCost(curTier) { return WEAPON_TIERS[clampIdx(curTier, WEAPON_TIERS) + 1]?.cost ?? null; }
export function armorUpgradeCost(curTier) { return ARMOR_TIERS[clampIdx(curTier, ARMOR_TIERS) + 1]?.cost ?? null; }
