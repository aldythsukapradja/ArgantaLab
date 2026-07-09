// PvP fairness engine — consumes the tuned PATH_POWER/PVP_PROFILE/PVP_TUNING
// (skills.js, validated via docs/lashirabloom/pvp-balance-sim.mjs) to turn
// "per-path damage numbers" into the mechanics that actually make them fair:
// compressed PvP-only HP, per-path attack speed + move speed, a short Bolt
// reach, and hit variance. See docs/lashirabloom/pvp-concept.md §3.3 — damage
// multipliers ALONE were found to NOT be fair (naive version: warrior wins 0%,
// because unlimited-range Bolt lets casters kite melee to death forever).
import { PVP_PROFILE, PVP_TUNING } from './skills.js';

function profileOf(pathId) { return PVP_PROFILE[pathId] || PVP_PROFILE.warrior; }

// PvP HP pool — a level-STABLE curve × the path's compression multiplier, NOT
// the PvE pools (which diverge 2.3x by L99, making any fixed damage table only
// fair at one level). Warrior tankiest (1.20x), mage frailest (0.80x) — a
// modest 1.5x spread, vs the PvE pools' 2.3x.
export function pvpMaxHp(pathId, level) {
  return Math.round(PVP_TUNING.hpCurve(level) * profileOf(pathId).pvpHpMul);
}

// Per-path basic-attack cooldown, ms. Rogue's whole identity: fast, many small
// hits (0.69s) vs warrior's slow, big hit (1.10s) — NOT the flat PvE cooldown.
export function pvpAttackCooldownMs(pathId) {
  return Math.round(profileOf(pathId).atkInt * 1000);
}

// Relative move-speed multiplier, normalized to warrior = 1.0x (the archetype
// that most needs to close distance, so it's the natural reference point).
// Rogue closes fastest; poet/mage are meant to kite at range, not chase.
export function pvpMoveMultiplier(pathId) {
  return profileOf(pathId).moveRel / PVP_PROFILE.warrior.moveRel;
}

// Bolt's range is capped in PvP — unlimited reach lets casters kite melee
// paths to 0% wins (the balance sim's finding #1). Physical strikes and Storm
// (already "hit everyone") are unaffected.
export function pvpBoltReach() { return PVP_TUNING.boltReach; }

// Roll hit variance onto a base damage number: a miss chance, a symmetric
// spread, and a crit chance/multiplier. Returns { dmg, crit, miss } — dmg is 0
// on a miss so the caller can show "MISS" instead of a 0-damage hit.
export function rollPvpDamage(baseDmg) {
  const t = PVP_TUNING;
  if (Math.random() < t.miss) return { dmg: 0, crit: false, miss: true };
  const spread = 1 + (Math.random() * 2 - 1) * t.spread; // in [1-spread, 1+spread]
  const crit = Math.random() < t.crit;
  const dmg = Math.max(1, Math.round(baseDmg * spread * (crit ? t.critX : 1)));
  return { dmg, crit, miss: false };
}

// Mend in PvP is capped: usable only at/below healAt of max HP, and at most
// healMax times per duel (a per-session counter the caller resets on entering
// the PvP zone) — unlimited healing would trivialize poet/mage's glass-cannon
// identity into permanent sustain.
export function canPvpHeal(hpFrac, healsUsedThisSession) {
  return hpFrac <= PVP_TUNING.healAt && healsUsedThisSession < PVP_TUNING.healMax;
}

// Mend's heal amount in PvP is the same base curve as PvE, scaled by the
// path's healMul (poet is the best healer at 1.3x; warrior worst at 0.6x,
// matching its "big hit, no sustain" identity).
export function pvpHealMul(pathId) { return profileOf(pathId).healMul; }
