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
