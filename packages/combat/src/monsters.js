// Monster factory + state machine, shared by both games. Rendering is per-app
// (Kingdom composites sprites; the farm draws procedural mobs) — this owns only
// the RULES: hp, the stand/hit/die states, and their timings. Extracted from
// Kingdom's TestRoom (numbers unchanged).

import { MONSTER_MAX_HP, MONSTER_HIT_MS, MONSTER_DIE_FADE_MS } from './constants.js';

// Build a monster's combat/state fields. Callers add their own render fields
// (sheet, mob, palette…) alongside these.
export function makeMonster(init = {}) {
  return {
    id: init.id,
    tile: init.tile || [0, 0],
    from: null,
    moveT: 1,
    moveStart: 0,
    facing: init.facing || 'South',
    friendly: init.friendly === true,
    hp: Number.isFinite(init.hp) ? init.hp : (init.maxHp ?? MONSTER_MAX_HP),
    maxHp: init.maxHp ?? MONSTER_MAX_HP,
    state: 'stand',
    stateStart: 0,
    rewarded: false,
    ...init,
  };
}

// Apply damage to a monster. Sets 'die' (and returns killed:true) when it drops,
// else flashes 'hit'. `now` = performance.now(). Mirrors Kingdom's strike exactly.
export function damageMonster(m, dmg, now) {
  m.hp -= dmg;
  if (m.hp <= 0) {
    m.hp = 0;
    m.state = 'die';
    m.stateStart = now;
    return { killed: true };
  }
  m.state = 'hit';
  m.stateStart = now;
  return { killed: false };
}

// Per-frame: clear a spent 'hit' flash back to 'stand'.
export function tickMonsterState(m, now) {
  if (m.state === 'hit' && now - m.stateStart > MONSTER_HIT_MS) m.state = 'stand';
}

// Has a dead monster finished its fade and should be culled?
export function monsterExpired(m, now) {
  return m.state === 'die' && now - m.stateStart > MONSTER_DIE_FADE_MS;
}

// Is this monster a live, attackable target?
export function monsterAttackable(m) {
  return m && !m.friendly && m.state !== 'die';
}
