// Skill definitions + the skill damage/targeting logic, shared by both games.
// The 3 skill slots come from a hero's spec; DEFAULT_SKILLS fills any gaps.
// `normalizeSkills` is extracted verbatim from Kingdom's TestRoom (unchanged).
//
// The damage/targeting seam (skillDamage / skillTargets) is where you "set up the
// damage on skill logic" ONCE — both Kingdom and the farm resolve skills through
// it, so a change here lands in both. Kingdom historically only spent MP + played
// a visual effect; these helpers add the shared damage rules without changing that
// unless a game opts in by calling them.

export const DEFAULT_SKILLS = [{ fx: 22 }, { fx: 1 }, { fx: 131 }];

// The canonical 3 skill slots, shared by BOTH games. Slot 1 = single-target
// magic (cheap), slot 2 = magic on ALL monsters (pricey), slot 3 = self-heal.
// MP is spent from mana (Kingdom) / stamina (farm) — same numbers. `fx` = the
// Kingdom effect id played on cast (placeholder ids; retune from the effect lib).
// `cdMs` = per-skill cooldown — a rate limit (not the cast animation length) so
// a skill can't be spammed every frame the way MP-cost alone allowed; roughly
// scaled to each skill's power/cost (storm's AoE + heal both cool the slowest).
export const SKILL_SLOTS = [
  { id: 'bolt', name: 'Magic Bolt', type: 'magic', target: 'single', manaCost: 1, cdMs: 900, fx: 22, icon: '✦' },
  { id: 'storm', name: 'Magic Storm', type: 'magic', target: 'all', manaCost: 5, cdMs: 2600, fx: 131, icon: '✷' },
  { id: 'mend', name: 'Mend', type: 'heal', target: 'self', manaCost: 3, cdMs: 1800, fx: 1, icon: '✚' },
];

// --- level scaling (MP cost fixed; power grows) — one source of truth ---
// Base curves live in a MUTABLE object so the tuning pipeline (tuning.js) can
// retune melee/skill damage without editing these functions. Defaults equal the
// old constants exactly, so Kingdom PvE is unchanged until a tuning is applied.
export const DAMAGE_BASE = {
  phys:  { base: 34, perLevel: 10 },
  bolt:  { base: 40, perLevel: 12 },
  storm: { base: 24, perLevel: 8 },
  mend:  { base: 30, perLevel: 10 },
};
const lv = (L) => Math.max(1, Number(L) || 1);
const curveAt = (c, L) => c.base + c.perLevel * (lv(L) - 1);
export function boltDamage(L) { return curveAt(DAMAGE_BASE.bolt, L); }
export function stormDamage(L) { return curveAt(DAMAGE_BASE.storm, L); } // per monster (AoE)
export function mendHeal(L) { return curveAt(DAMAGE_BASE.mend, L); }
export function killReward(L) { return 2 + Math.floor(lv(L) / 2); } // Diamonds per kill
export function killXp(L) { return 15 + 5 * (lv(L) - 1); }         // XP per kill (adults)
// Power (damage or heal) a slotted skill produces at a level.
export function skillPower(skill, L) {
  if (skill?.id === 'storm') return stormDamage(L);
  if (skill?.id === 'mend') return mendHeal(L);
  return boltDamage(L); // bolt / default
}

// --- PER-PATH power (the class identity for combat, esp. PvP) ------------------
// Each path multiplies the shared bases: casters hit harder with MAGIC, martials
// hit harder with PHYSICAL. Ordering matches the design:
//   Magic:    Mage > Poet > Rogue > Warrior      (mage highest, warrior last)
//   Physical: Warrior > Rogue > Poet > Mage       (warrior's big-hit identity)
// These are ADDITIVE helpers — the old skillPower/MELEE stay untouched, so
// existing Kingdom PvE is unchanged until a caller opts into the path-scaled ones
// (PvP does). Keys are the stable path ids from progression.js.
//
// Values are the FAIRNESS-TUNED per-hit multipliers from the PvP balance study
// (docs/lashirabloom/pvp-balance-sim.mjs). NOTE: rogue's phy is intentionally LOW
// (1.00) because rogue's damage identity is ATTACK SPEED (many fast weak hits),
// carried by PVP_PROFILE.atkInt below — not per-hit size. These multipliers are
// calibrated for the PvP model (which adds attack-speed + compressed HP + variance);
// a future PvE opt-in would need that same model or its own numbers.
export const PATH_POWER = {
  warrior: { mag: 0.55, phy: 1.55 },
  rogue:   { mag: 0.70, phy: 1.00 },
  poet:    { mag: 1.15, phy: 0.80 },
  mage:    { mag: 1.45, phy: 0.58 },
};
export function pathPower(pathId) { return PATH_POWER[pathId] || PATH_POWER.warrior; }

// --- PvP balance PROFILE (CONCEPT SPEC — inert until PvP combat is wired) -------
// The full per-path PvP identity that makes all four ~50/50 at equal level (see
// docs/pvp-concept.md §Balance + pvp-balance-sim.mjs). Fairness needs MORE than
// damage multipliers: a compressed PvP HP curve, per-path ATTACK SPEED + MOVE
// SPEED, a short bolt reach, and hit variance. This table records the tuned set;
// the PvP combat layer will consume it (it does not affect PvE or current play).
//   atkInt = seconds per attack (lower = faster)   moveRel = relative move speed
//   pvpHpMul = × the PvP HP curve (100 + 70*(L-1))  healMul = × Mend base
export const PVP_PROFILE = {
  warrior: { atkInt: 1.10, moveRel: 3.0, pvpHpMul: 1.20, healMul: 0.6 },
  rogue:   { atkInt: 0.69, moveRel: 3.4, pvpHpMul: 1.06, healMul: 0.8 },
  poet:    { atkInt: 1.00, moveRel: 2.1, pvpHpMul: 1.03, healMul: 1.3 },
  mage:    { atkInt: 1.00, moveRel: 2.0, pvpHpMul: 0.80, healMul: 1.0 },
};
// Globals for the PvP model (concept): bolt reach 2 tiles, PvP HP curve, hit
// variance (spread ±18%, 12% crit ×1.6, 8% miss) — see the sim for provenance.
export const PVP_TUNING = { boltReach: 2, hpCurve: (L) => 100 + 70 * (Math.max(1, L) - 1),
  spread: 0.18, crit: 0.12, critX: 1.6, miss: 0.08, healAt: 0.30, healMax: 2 };

// Physical attack base — level-scaled (parallels the magic bases so high-level
// PvP doesn't stall against the big HP pools). Melee/PvP strikes use this.
export function physBase(L) { return curveAt(DAMAGE_BASE.phys, L); }

// Path-scaled MAGIC power for a slotted skill (bolt/storm/mend all count as
// spellcasting, so a caster path amplifies damage AND healing).
export function pathSkillPower(skill, pathId, L) {
  return Math.round(skillPower(skill, L) * pathPower(pathId).mag);
}

// Path-scaled PHYSICAL power for a melee / PvP strike.
export function pathPhysPower(pathId, L) {
  return Math.round(physBase(L) * pathPower(pathId).phy);
}

// Merge the shared slot BEHAVIOUR (single/all/heal + MP + scaling) with a hero's
// own effect visuals. Kingdom is the single source of truth for character stuff,
// so the `fx` (which spell animation plays) comes from the hero's Kingdom
// skills; only the behaviour/costs are shared. `heroSkills` = hero.spec.skills.
// When pathId + level are given, the SKILL MATRIX supplies the path's evolving
// name + effect for the hero's current tier. A hero's OWN spec still wins when
// they deliberately customized it in Character Lab (a name, or an fx that differs
// from the slot's canonical default); an untouched hero inherits the path/tier
// identity authored in the Skill Forge. shape (warrior's nova, etc.) rides along.
export function battleSkillsFor(heroSkills, pathId, level) {
  const raw = Array.isArray(heroSkills) ? heroSkills : [];
  return SKILL_SLOTS.map((slot, i) => {
    const f = Number(raw[i]?.fx);
    const customName = typeof raw[i]?.name === 'string' && raw[i].name.trim() ? raw[i].name : null;
    const customFx = Number.isFinite(f) && f !== slot.fx ? f : null; // != canonical ⇒ operator picked it
    const cell = pathId ? SKILL_MATRIX[pathId]?.[i]?.[skillTierIndex(level)] : null;
    const name = customName || (pathId ? skillNameFor(pathId, i, level) : slot.name);
    const fx = customFx != null ? customFx : (pathId ? skillFxFor(pathId, i, level) : slot.fx);
    return { ...slot, name, fx, shape: cell?.shape || slot.shape };
  });
}

export function normalizeSkills(skills) {
  return DEFAULT_SKILLS.map((def, i) => ({
    fx: Number.isFinite(Number(skills?.[i]?.fx)) ? Number(skills[i].fx) : def.fx,
    skillId: typeof skills?.[i]?.skillId === 'string' ? skills[i].skillId : null,
    name: typeof skills?.[i]?.name === 'string' ? skills[i].name : null,
    path: typeof skills?.[i]?.path === 'string' ? skills[i].path : null,
    manaCost: Number.isFinite(Number(skills?.[i]?.manaCost)) ? Number(skills[i].manaCost) : null,
    spellType: typeof skills?.[i]?.spellType === 'string' ? skills[i].spellType : null,
    // Damage tuning (optional on a skill; drives the shared damage seam below).
    damage: Number.isFinite(Number(skills?.[i]?.damage)) ? Number(skills[i].damage) : null,
    reach: Number.isFinite(Number(skills?.[i]?.reach)) ? Number(skills[i].reach) : null,
    aoe: skills?.[i]?.aoe === true || skills?.[i]?.aoe === 'adjacent' ? skills[i].aoe : null,
  }));
}

// Mana cost gate — can this skill be cast with the given MP?
export function canAffordSkill(mp, skill) {
  return Number(mp || 0) >= Number(skill?.manaCost || 0);
}

// Damage a skill deals per hit. 0 means "no damage" (a pure visual/utility cast,
// which is Kingdom's historical behaviour until a skill is given a `damage`).
export function skillDamage(skill) {
  return Math.max(0, Number(skill?.damage || 0));
}

// Which tiles a skill hits, given the caster's tile + facing delta [dx,dy].
//   shape 'nova' (or legacy aoe): the caster's tile + its 4 neighbours — the
//     "attack everything left/right/up/down around me" warrior pattern.
//   shape 'cross': the 4 cardinals extended to `reach` in every direction.
//   otherwise: a straight line of `reach` tiles in front (reach 1 = melee range).
export function skillTargets(skill, originTile, facingDelta) {
  const [ox, oy] = originTile;
  const shape = skill?.shape || (skill?.aoe ? 'nova' : 'line');
  if (shape === 'nova') {
    return [[ox, oy], [ox + 1, oy], [ox - 1, oy], [ox, oy + 1], [ox, oy - 1]];
  }
  const reach = Math.max(1, Number(skill?.reach || 1));
  if (shape === 'cross') {
    const tiles = [[ox, oy]];
    for (let i = 1; i <= reach; i++) tiles.push([ox + i, oy], [ox - i, oy], [ox, oy + i], [ox, oy - i]);
    return tiles;
  }
  const [dx, dy] = facingDelta || [0, 1];
  const tiles = [];
  for (let i = 1; i <= reach; i++) tiles.push([ox + dx * i, oy + dy * i]);
  return tiles;
}

// ============================================================================
// SKILL MATRIX + RESISTANCE — the Skill Forge authoring model (HQ) ============
// ============================================================================
// A per-PATH, per-SLOT, per-TIER identity for the 3 skills. The 3 slots stay
// fixed by SKILL_SLOTS (single / all-multi / self-heal); this layers each path's
// own NAME + effect (fx) + optional target SHAPE on top, evolving across six
// level bands so a skill is renamed AND re-animated as the hero levels. Both
// games import this; HQ's Skill Forge publishes overrides through the tuning
// pipeline (tuning.js) and applyTuning writes them back here in place.
//
// These are MUTABLE exports (like PATH_POWER) so a published config updates them
// live for every importer without a re-import.

// The six milestones a skill's name/effect can change at — deliberately the SAME
// bands as progression.js's per-path TITLES, so "Warden" the title and the skill
// it unlocks step up together instead of on two different clocks.
export const SKILL_TIER_BANDS = [1, 15, 30, 50, 70, 90];

// Index into a tier band for a given level (0..5).
export function skillTierIndex(level) {
  const L = Math.max(1, Number(level) || 1);
  let idx = 0;
  for (let i = 0; i < SKILL_TIER_BANDS.length; i++) if (L >= SKILL_TIER_BANDS[i]) idx = i;
  return idx;
}

// Default fx per slot = the slot's canonical effect, used at EVERY tier until an
// operator authors a per-tier effect in the Skill Forge (so the live viewer can
// never point at a missing effect id — a published override replaces these).
const _names = (list, fx) => list.map((name) => ({ name, fx }));

// name sets: [slot0 single, slot1 multi, slot2 heal] × 6 tiers, one per path.
export const SKILL_MATRIX = {
  warrior: {
    0: _names(['Slash', 'Cleave', 'Rend', 'Sunder', 'Ruin', 'Cataclysm'], 22),
    1: _names(['Sweep', 'Whirl', 'Tempest', 'Maelstrom', 'Cyclone', 'Annihilation'], 131),
    2: _names(['Bandage', 'Second Wind', 'Rally', 'Iron Will', 'Unbroken', 'Undying'], 1),
  },
  rogue: {
    0: _names(['Jab', 'Puncture', 'Backstab', 'Gut', 'Eviscerate', 'Execute'], 22),
    1: _names(['Fan of Knives', 'Flurry', 'Barrage', 'Volley', 'Bladestorm', 'Thousand Cuts'], 131),
    2: _names(['Patch Up', 'Quick Bind', 'Adrenaline', 'Numbing Draught', 'Vitality', 'Deathless'], 1),
  },
  poet: {
    0: _names(['Verse', 'Lament', 'Dirge', 'Requiem', 'Elegy', 'Epitaph'], 22),
    1: _names(['Chorus', 'Refrain', 'Anthem', 'Symphony', 'Crescendo', 'Finale'], 131),
    2: _names(['Hymn', 'Ballad', 'Sonnet', 'Ode', 'Psalm', 'Benediction'], 1),
  },
  mage: {
    0: _names(['Spark', 'Bolt', 'Arc', 'Blast', 'Nova', 'Singularity'], 22),
    1: _names(['Ember Storm', 'Firestorm', 'Meteor', 'Comet', 'Ragnarok', 'Armageddon'], 131),
    2: _names(['Warmth', 'Renew', 'Restore', 'Rejuvenate', 'Sanctuary', 'Rebirth'], 1),
  },
};

// The name shown for a path's skill slot at a given level (falls back cleanly).
export function skillNameFor(pathId, slotIdx, level) {
  const row = SKILL_MATRIX[pathId]?.[slotIdx];
  if (!row || !row.length) return SKILL_SLOTS[slotIdx]?.name || 'Skill';
  return row[skillTierIndex(level)]?.name || SKILL_SLOTS[slotIdx]?.name || 'Skill';
}
// The effect id for a path's skill slot at a given level.
export function skillFxFor(pathId, slotIdx, level) {
  const row = SKILL_MATRIX[pathId]?.[slotIdx];
  const canon = SKILL_SLOTS[slotIdx]?.fx ?? 0;
  if (!row || !row.length) return canon;
  const cell = row[skillTierIndex(level)];
  return Number.isFinite(cell?.fx) ? cell.fx : canon;
}

// --- PER-PATH RESISTANCE / WEAKNESS -----------------------------------------
// A defender's path reduces (resist, +) or amplifies (weakness, −) incoming
// damage BY TYPE. Range [−0.6, 0.6]; a value of r means damage × (1 − r), so
// +0.4 = takes 60%, −0.4 = takes 140%. DEFAULT ALL-ZERO (neutral) so adding the
// axis changes nothing until an operator authors it and watches the benchmark.
export const RESIST = {
  warrior: { phys: 0, mag: 0 },
  rogue:   { phys: 0, mag: 0 },
  poet:    { phys: 0, mag: 0 },
  mage:    { phys: 0, mag: 0 },
};
// Damage multiplier a defender's path applies to an incoming hit of `type`
// ('phys' | 'mag'). Clamped to a safe [0.2, 2.0] so a bad publish can't null or
// runaway damage. Unknown type/path → 1.0 (no effect), so it fails safe.
export function resistMul(defenderPathId, type) {
  const r = RESIST[defenderPathId]?.[type === 'mag' ? 'mag' : type === 'phys' ? 'phys' : null];
  if (!Number.isFinite(r)) return 1;
  return Math.min(2, Math.max(0.2, 1 - r));
}
