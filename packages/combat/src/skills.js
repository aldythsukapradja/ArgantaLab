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
export const SKILL_SLOTS = [
  { id: 'bolt', name: 'Magic Bolt', type: 'magic', target: 'single', manaCost: 1, fx: 22, icon: '✦' },
  { id: 'storm', name: 'Magic Storm', type: 'magic', target: 'all', manaCost: 5, fx: 131, icon: '✷' },
  { id: 'mend', name: 'Mend', type: 'heal', target: 'self', manaCost: 3, fx: 1, icon: '✚' },
];

// --- level scaling (MP cost fixed; power grows) — one source of truth ---
const lv = (L) => Math.max(1, Number(L) || 1);
export function boltDamage(L) { return 40 + 12 * (lv(L) - 1); }
export function stormDamage(L) { return 24 + 8 * (lv(L) - 1); } // per monster (AoE)
export function mendHeal(L) { return 30 + 10 * (lv(L) - 1); }
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
export const PATH_POWER = {
  warrior: { mag: 0.60, phy: 1.60 },
  rogue:   { mag: 0.85, phy: 1.30 },
  poet:    { mag: 1.25, phy: 0.85 },
  mage:    { mag: 1.50, phy: 0.60 },
};
export function pathPower(pathId) { return PATH_POWER[pathId] || PATH_POWER.warrior; }

// Physical attack base — level-scaled (parallels the magic bases so high-level
// PvP doesn't stall against the big HP pools). Melee/PvP strikes use this.
export function physBase(L) { return 34 + 10 * (lv(L) - 1); }

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
export function battleSkillsFor(heroSkills) {
  const raw = Array.isArray(heroSkills) ? heroSkills : [];
  return SKILL_SLOTS.map((slot, i) => {
    const f = Number(raw[i]?.fx);
    const name = typeof raw[i]?.name === 'string' ? raw[i].name : slot.name;
    return { ...slot, name, fx: Number.isFinite(f) ? f : slot.fx };
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
//   aoe (adjacent): the caster's tile + its 4 neighbours (a nova).
//   otherwise: a straight line of `reach` tiles in front (reach 1 = melee range).
export function skillTargets(skill, originTile, facingDelta) {
  const [ox, oy] = originTile;
  if (skill?.aoe) {
    return [[ox, oy], [ox + 1, oy], [ox - 1, oy], [ox, oy + 1], [ox, oy - 1]];
  }
  const [dx, dy] = facingDelta || [0, 1];
  const reach = Math.max(1, Number(skill?.reach || 1));
  const tiles = [];
  for (let i = 1; i <= reach; i++) tiles.push([ox + dx * i, oy + dy * i]);
  return tiles;
}
