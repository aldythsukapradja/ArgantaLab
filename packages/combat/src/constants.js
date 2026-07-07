// Combat tuning — the SINGLE source of truth shared by Kingdom Heroes and
// LashiraBloom. Change a number here and BOTH games update (Kingdom's TestRoom
// and the farm's battle mode both import these). Extracted verbatim from
// Kingdom's TestRoom so behaviour is unchanged at extraction time.

// Damage
export const MELEE_DAMAGE = 34;   // basic attack on the faced tile (strike)
export const PVP_DAMAGE = 25;     // player-vs-player hit; victim self-applies it

// Monster state timings (ms)
export const MONSTER_MAX_HP = 100;
export const MONSTER_WALK_MS = 620;      // one tile of monster movement
export const MONSTER_HIT_MS = 700;       // 'hit' flash duration before → 'stand'
export const MONSTER_DIE_FADE_MS = 1400; // 'die' fade before the corpse is culled

// Player combat pools (fallbacks; a hero's account stats override these)
export const PLAYER_MAX_HP = 100;
export const PLAYER_MAX_MP = 40;

// Which attack motion a weapon category plays.
export const ATTACK_BY_WEAPON = { sword: 'Swing', spear: 'Pierce', bow: 'Shoot', fan: 'Swing' };
