// High-level combat resolution built on the monster + skill primitives. Both
// games call these so the "what a hit/skill does" rules live in ONE place.

import { damageMonster, monsterAttackable } from './monsters.js';
import { skillDamage, skillTargets } from './skills.js';

function sameTile(m, tx, ty) {
  return m.tile[0] === tx && m.tile[1] === ty;
}

// Basic attack: the first attackable monster on the faced tile takes `dmg`.
// Returns { monster, killed } or null if nothing was there. Matches Kingdom's
// strike (find !friendly && !dead on the tile, subtract, set hit/die).
export function resolveMelee(monsters, tx, ty, dmg, now) {
  const m = monsters.find((mo) => monsterAttackable(mo) && sameTile(mo, tx, ty));
  if (!m) return null;
  const { killed } = damageMonster(m, dmg, now);
  return { monster: m, killed };
}

// Skill hit: every attackable monster on the skill's target tiles takes the
// skill's damage. Returns the list of { monster, killed } that were struck
// (empty if the skill deals no damage or misses).
export function resolveSkill(monsters, skill, originTile, facingDelta, now) {
  const dmg = skillDamage(skill);
  if (dmg <= 0) return [];
  const tiles = skillTargets(skill, originTile, facingDelta);
  const hits = [];
  for (const [tx, ty] of tiles) {
    const m = monsters.find((mo) => monsterAttackable(mo) && sameTile(mo, tx, ty));
    if (m) hits.push({ monster: m, ...damageMonster(m, dmg, now) });
  }
  return hits;
}

// SINGLE-target magic (Bolt): the faced tile if a monster is there, else the
// nearest live monster. Returns { monster, killed } or null.
export function resolveSkillSingle(monsters, originTile, facingDelta, dmg, now) {
  const [ox, oy] = originTile; const [dx, dy] = facingDelta || [0, 1];
  let m = monsters.find((mo) => monsterAttackable(mo) && sameTile(mo, ox + dx, oy + dy));
  if (!m) {
    let best = null, bd = Infinity;
    for (const mo of monsters) {
      if (!monsterAttackable(mo)) continue;
      const d = Math.abs(mo.tile[0] - ox) + Math.abs(mo.tile[1] - oy);
      if (d < bd) { bd = d; best = mo; }
    }
    m = best;
  }
  if (!m) return null;
  return { monster: m, ...damageMonster(m, dmg, now) };
}

// AoE magic (Storm): every live monster takes the damage. Returns the hits.
export function resolveSkillAll(monsters, dmg, now) {
  const hits = [];
  for (const m of monsters) {
    if (!monsterAttackable(m)) continue;
    hits.push({ monster: m, ...damageMonster(m, dmg, now) });
  }
  return hits;
}

// Self-heal (Mend): raise hp toward maxHp. Returns the amount actually healed.
export function applyHeal(combat, amount) {
  const before = combat.hp;
  combat.hp = Math.min(combat.maxHp, combat.hp + Math.max(0, amount));
  return combat.hp - before;
}
