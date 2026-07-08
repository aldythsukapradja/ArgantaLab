// Bestiary — the kid-safe woodland roster + Tiger boss, shared by both games.
// Rescaled so combat matches the level/gear damage curve (the old flat 100-HP
// mobs were trivial vs a L50 bolt of 628). "faint" not "die" — no gore.
//
// Each monster: hp, atk (damage dealt to the player), xp + bloom (kill reward),
// and a drop table (material key + count range + probability). Zones gate which
// mobs spawn where.

export const BESTIARY = {
  squirrel: { id: 'squirrel', name: 'Squirrel', zone: 'meadow', hp: 130,    atk: 8,   xp: 15,   bloom: 3,   speedMs: 520, color: '#c9803a', drops: [{ k: 'wood', min: 1, max: 2, p: 0.25 }] },
  fox:      { id: 'fox',      name: 'Fox',      zone: 'meadow', hp: 300,    atk: 20,  xp: 22,   bloom: 5,   speedMs: 480, color: '#e2712f', drops: [{ k: 'fish', min: 1, max: 1, p: 0.5 }, { k: 'hide', min: 1, max: 1, p: 0.15 }] },
  badger:   { id: 'badger',   name: 'Badger',   zone: 'grove',  hp: 1100,   atk: 40,  xp: 55,   bloom: 12,  speedMs: 720, color: '#8a8f98', drops: [{ k: 'ore', min: 1, max: 2, p: 0.3 }, { k: 'stone', min: 2, max: 2, p: 0.5 }] },
  boar:     { id: 'boar',     name: 'Boar',     zone: 'grove',  hp: 1600,   atk: 70,  xp: 70,   bloom: 16,  speedMs: 620, color: '#7a5a44', drops: [{ k: 'ore', min: 2, max: 2, p: 0.4 }, { k: 'hide', min: 1, max: 1, p: 0.2 }] },
  deer:     { id: 'deer',     name: 'Deer',     zone: 'cavern', hp: 2300,   atk: 100, xp: 130,  bloom: 28,  speedMs: 560, color: '#b98a5a', drops: [{ k: 'gem', min: 1, max: 1, p: 0.25 }, { k: 'essence', min: 1, max: 1, p: 0.3 }] },
  tiger:    { id: 'tiger',    name: 'Tiger', boss: true, zone: 'boss', hp: 18000, atk: 280, xp: 1500, bloom: 400, speedMs: 640, color: '#e8912f', drops: [{ k: 'token', min: 1, max: 1, p: 1 }, { k: 'gem', min: 5, max: 5, p: 1 }, { k: 'shard', min: 1, max: 1, p: 0.1 }] },
};

// Which mobs roam each zone (Meadow easiest → Cavern hardest).
export const ZONE_MOBS = {
  meadow: ['squirrel', 'fox'],
  grove: ['badger', 'boar'],
  cavern: ['deer'],
};

export function monsterOf(kind) { return BESTIARY[kind] || BESTIARY.squirrel; }

// Roll a monster's drop table → [{ k, n }]. `rng` defaults to Math.random.
export function rollDrops(kind, rng = Math.random) {
  const m = monsterOf(kind);
  const out = [];
  for (const d of m.drops || []) {
    if (rng() <= d.p) {
      const n = d.min + Math.floor(rng() * (d.max - d.min + 1));
      if (n > 0) out.push({ k: d.k, n });
    }
  }
  return out;
}

// Pick a mob kind for a zone (uniform among the zone's roster).
export function pickZoneMob(zone, rng = Math.random) {
  const list = ZONE_MOBS[zone] || ZONE_MOBS.meadow;
  return list[Math.floor(rng() * list.length)] || 'squirrel';
}
