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
