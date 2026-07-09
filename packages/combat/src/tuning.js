// Combat TUNING PIPELINE — the single source of truth both Circle HQ (Battle
// Builder) and LashiraBloom import. HQ *publishes* a config; the game *loads +
// applies* it. Because both sides import THIS module, "build it in HQ" == "build
// it in LashiraBloom" — the config schema, defaults, merge, validation, and the
// fairness summary all live here once.
//
// Design rules:
//  1. ADDITIVE + safe. Defaults are the floor; a missing/invalid override falls
//     back to defaults so the game can never brick. Kingdom PvE (which reads raw
//     skillPower/MELEE, not these objects) is unaffected.
//  2. SERIALIZABLE. The config is plain JSON (functions like the HP curve are
//     stored as {base,perLevel} and rebuilt on apply) so it round-trips through
//     Supabase cleanly.
//  3. applyTuning() mutates the LIVE exported objects in place, so every importer
//     (the combat engine) sees the new numbers without a re-import.

import { PATH_POWER, PVP_PROFILE, PVP_TUNING, DAMAGE_BASE, SKILL_SLOTS } from './skills.js';
import { BESTIARY, ZONE_MOBS } from './bestiary.js';
import { WEAPON_TIERS, ARMOR_TIERS } from './gear.js';
import { PATHS as PATH_POOLS, XP_LADDER } from './progression.js';

export const TUNING_VERSION = 1;
const PATHS = ['warrior', 'rogue', 'poet', 'mage'];
const clone = (o) => JSON.parse(JSON.stringify(o));

// Enemy tuning drives the REAL BESTIARY the game spawns from — the pipeline tunes
// each monster's hp (how tanky) + atk (damage dealt to the player). applyTuning
// writes back into BESTIARY in place, so spawns pick up the new numbers.
const ENEMY_IDS = Object.keys(BESTIARY);

// Player attack base curves live in skills.js DAMAGE_BASE (boltDamage/physBase read
// it) — re-export under the old name for back-compat.
export { DAMAGE_BASE as DAMAGE_TUNING };

// SPAWN — how the arena/battleground populates (mutable; FarmRoom reads these).
// maxConcurrent = how many roam at once, intervalMs = respawn pacing, roster =
// which enemies can appear (the boss spawns via its own gate, not here).
export const SPAWN_TUNING = {
  maxConcurrent: 5,
  intervalMs: 900,
  roster: ['squirrel', 'fox', 'badger', 'boar', 'deer'],
};

// REWARDS — global multipliers on kill XP + Bloom (per-monster base lives in the
// BESTIARY; these scale all kills at once). farm-logic.rewardKill reads them.
export const REWARD_TUNING = { xpMul: 1, bloomMul: 1 };

// ── The DEFAULTS (the floor) — a serializable snapshot captured at load ────────
export const COMBAT_DEFAULTS = Object.freeze({
  version: TUNING_VERSION,
  paths: PATHS.reduce((acc, p) => {
    acc[p] = { ...PATH_POWER[p], ...PVP_PROFILE[p] }; // mag,phy + atkInt,moveRel,pvpHpMul,healMul
    return acc;
  }, {}),
  pvp: {
    boltReach: PVP_TUNING.boltReach, spread: PVP_TUNING.spread, crit: PVP_TUNING.crit,
    critX: PVP_TUNING.critX, miss: PVP_TUNING.miss, healAt: PVP_TUNING.healAt,
    healMax: PVP_TUNING.healMax, hp: { base: 100, perLevel: 70 },
  },
  damage: clone(DAMAGE_BASE),        // player melee/skill base curves (phys/bolt/storm/mend)
  pools: PATH_POOLS ? Object.keys(PATH_POOLS).reduce((a, p) => { const x = PATH_POOLS[p]; a[p] = { hp: x.hp, hpPer: x.hpPer, mp: x.mp, mpPer: x.mpPer }; return a; }, {}) : {},
  xp: { base: XP_LADDER.base, growth: XP_LADDER.growth },   // level ladder
  skills: SKILL_SLOTS.reduce((a, s) => { a[s.id] = { manaCost: s.manaCost }; return a; }, {}), // MP cost per slot
  enemies: ENEMY_IDS.reduce((acc, id) => {
    const e = BESTIARY[id];
    // stats + rewards + speed + the loot drop table (material · count · rate)
    acc[id] = { hp: e.hp, atk: e.atk, xp: e.xp, bloom: e.bloom, speedMs: e.speedMs, drops: clone(e.drops || []) };
    return acc;
  }, {}),
  zones: clone(ZONE_MOBS),       // which mobs roam each zone (meadow/grove/cavern)
  spawn: clone(SPAWN_TUNING),
  rewards: clone(REWARD_TUNING),
  // Gear power axis, keyed by tier so partial edits deep-merge cleanly.
  gear: {
    weapons: WEAPON_TIERS.reduce((a, t) => { a['t' + t.tier] = { atk: t.atk }; return a; }, {}),
    armor: ARMOR_TIERS.reduce((a, t) => { a['t' + t.tier] = { def: t.def, hp: t.hp }; return a; }, {}),
  },
});

// ── Deep merge an override onto the defaults → the EFFECTIVE config ────────────
function deepMerge(base, over) {
  if (over == null || typeof over !== 'object') return clone(base);
  const out = clone(base);
  for (const k of Object.keys(over)) {
    const bv = out[k], ov = over[k];
    out[k] = (bv && typeof bv === 'object' && !Array.isArray(bv) && ov && typeof ov === 'object')
      ? deepMerge(bv, ov) : ov;
  }
  return out;
}
export function mergeTuning(override) {
  return clampConfig(deepMerge(COMBAT_DEFAULTS, override || {}));
}

// ── Validation — ordering rules + sane ranges (the guardrails the UI shows) ────
const RANGE = { mag: [0.3, 1.9], phy: [0.3, 1.9], atkInt: [0.4, 1.4], moveRel: [1.4, 4.0], pvpHpMul: [0.6, 1.5], healMul: [0.3, 2.4] };
export function validateTuning(override) {
  const errors = [], warnings = [];
  const cfg = mergeTuning(override);
  const P = cfg.paths;
  // owner-locked ordering
  if (!(P.mage.mag >= P.poet.mag && P.poet.mag >= P.rogue.mag && P.rogue.mag >= P.warrior.mag))
    warnings.push('Magic order broken (want mage ≥ poet ≥ rogue ≥ warrior).');
  if (!(P.warrior.phy >= P.rogue.phy && P.rogue.phy >= P.poet.phy && P.poet.phy >= P.mage.phy))
    warnings.push('Physical order broken (want warrior ≥ rogue ≥ poet ≥ mage).');
  for (const p of PATHS) for (const k of Object.keys(RANGE)) {
    const v = P[p][k];
    if (typeof v !== 'number' || Number.isNaN(v)) errors.push(`${p}.${k} is not a number`);
    else if (v < RANGE[k][0] || v > RANGE[k][1]) warnings.push(`${p}.${k}=${v} outside [${RANGE[k][0]}, ${RANGE[k][1]}]`);
  }
  if (cfg.pvp.boltReach < 1 || cfg.pvp.boltReach > 8) warnings.push('boltReach outside [1,8]');
  return { ok: errors.length === 0, errors, warnings };
}
// A loot table is [{ k:material, min, max, p:0..1 }]. Drop malformed rows so a bad
// publish can't break kill rewards (or mint a material with a >1 probability).
function sanitizeDrops(drops) {
  const out = [];
  for (const d of drops) {
    if (!d || typeof d.k !== 'string' || !d.k) continue;
    const min = Math.max(0, Math.floor(Number(d.min) || 0));
    const max = Math.max(min, Math.floor(Number(d.max) || min));
    const p = Math.min(1, Math.max(0, Number(d.p)));
    if (max > 0 && p > 0) out.push({ k: d.k, min, max, p });
  }
  return out;
}

// Clamp every numeric into a safe range so a bad override can't produce NaN combat.
function clampConfig(cfg) {
  for (const p of PATHS) for (const k of Object.keys(RANGE)) {
    const [lo, hi] = RANGE[k]; const v = cfg.paths[p][k];
    cfg.paths[p][k] = Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : COMBAT_DEFAULTS.paths[p][k];
  }
  cfg.pvp.boltReach = Math.min(8, Math.max(1, cfg.pvp.boltReach || 2));
  return cfg;
}

// ── APPLY — push an effective config into the LIVE exported objects ────────────
// Anything importing PATH_POWER / PVP_PROFILE / PVP_TUNING / MONSTER_TUNING /
// DAMAGE_TUNING now reads the new numbers. This is what makes the game "use it".
export function applyTuning(configOrOverride) {
  // mergeTuning is idempotent for a full effective config and gap-fills a partial
  // override — so applyTuning is safe with either shape (no undefined-path crash).
  const cfg = mergeTuning(configOrOverride);
  for (const p of PATHS) {
    PATH_POWER[p].mag = cfg.paths[p].mag;
    PATH_POWER[p].phy = cfg.paths[p].phy;
    PVP_PROFILE[p].atkInt = cfg.paths[p].atkInt;
    PVP_PROFILE[p].moveRel = cfg.paths[p].moveRel;
    PVP_PROFILE[p].pvpHpMul = cfg.paths[p].pvpHpMul;
    PVP_PROFILE[p].healMul = cfg.paths[p].healMul;
  }
  Object.assign(PVP_TUNING, {
    boltReach: cfg.pvp.boltReach, spread: cfg.pvp.spread, crit: cfg.pvp.crit,
    critX: cfg.pvp.critX, miss: cfg.pvp.miss, healAt: cfg.pvp.healAt, healMax: cfg.pvp.healMax,
    hpCurve: (L) => cfg.pvp.hp.base + cfg.pvp.hp.perLevel * (Math.max(1, L) - 1),
  });
  // Player base curves (melee/skill damage) — skills.js boltDamage/physBase read these.
  for (const k of ['phys', 'bolt', 'storm', 'mend']) {
    const c = cfg.damage && cfg.damage[k]; if (!c) continue;
    if (Number.isFinite(c.base)) DAMAGE_BASE[k].base = Math.max(0, c.base);
    if (Number.isFinite(c.perLevel)) DAMAGE_BASE[k].perLevel = Math.max(0, c.perLevel);
  }
  // HP/MP pools per path (pathMaxHp/pathMaxMp read PATHS).
  if (cfg.pools) for (const p of Object.keys(cfg.pools)) {
    const q = cfg.pools[p]; if (!q || !PATH_POOLS[p]) continue;
    if (Number.isFinite(q.hp)) PATH_POOLS[p].hp = Math.max(1, q.hp);
    if (Number.isFinite(q.hpPer)) PATH_POOLS[p].hpPer = Math.max(0, q.hpPer);
    if (Number.isFinite(q.mp)) PATH_POOLS[p].mp = Math.max(1, q.mp);
    if (Number.isFinite(q.mpPer)) PATH_POOLS[p].mpPer = Math.max(0, q.mpPer);
  }
  // XP ladder (growth must stay > 1 or xpForLevel divides by zero).
  if (cfg.xp) {
    if (Number.isFinite(cfg.xp.base)) XP_LADDER.base = Math.max(1, cfg.xp.base);
    if (Number.isFinite(cfg.xp.growth)) XP_LADDER.growth = Math.min(1.5, Math.max(1.001, cfg.xp.growth));
  }
  // Skill MP costs (per slot id).
  if (cfg.skills) for (const s of SKILL_SLOTS) {
    const v = cfg.skills[s.id] && cfg.skills[s.id].manaCost;
    if (Number.isFinite(v)) s.manaCost = Math.max(0, v);
  }
  for (const id of Object.keys(cfg.enemies)) {
    if (!BESTIARY[id]) continue;
    const e = cfg.enemies[id];
    if (Number.isFinite(e.hp)) BESTIARY[id].hp = Math.max(1, e.hp);
    if (Number.isFinite(e.atk)) BESTIARY[id].atk = Math.max(0, e.atk);
    if (Number.isFinite(e.xp)) BESTIARY[id].xp = Math.max(0, e.xp);
    if (Number.isFinite(e.bloom)) BESTIARY[id].bloom = Math.max(0, e.bloom);
    if (Number.isFinite(e.speedMs)) BESTIARY[id].speedMs = Math.min(5000, Math.max(100, e.speedMs));
    if (Array.isArray(e.drops)) BESTIARY[id].drops = sanitizeDrops(e.drops);
  }
  if (cfg.zones && typeof cfg.zones === 'object') {
    for (const z of Object.keys(cfg.zones)) {
      const list = cfg.zones[z];
      if (Array.isArray(list)) ZONE_MOBS[z] = list.filter((k) => BESTIARY[k]); // only real mobs
    }
  }
  if (cfg.spawn) {
    SPAWN_TUNING.maxConcurrent = Math.min(20, Math.max(1, Math.round(cfg.spawn.maxConcurrent) || 5));
    SPAWN_TUNING.intervalMs = Math.min(8000, Math.max(200, Math.round(cfg.spawn.intervalMs) || 900));
    if (Array.isArray(cfg.spawn.roster) && cfg.spawn.roster.length) SPAWN_TUNING.roster = cfg.spawn.roster.filter((k) => BESTIARY[k]);
  }
  if (cfg.rewards) {
    REWARD_TUNING.xpMul = Math.min(10, Math.max(0, Number(cfg.rewards.xpMul) || 1));
    REWARD_TUNING.bloomMul = Math.min(10, Math.max(0, Number(cfg.rewards.bloomMul) || 1));
  }
  if (cfg.gear) {
    const setTier = (tiers, key, field, v) => {
      const t = tiers.find((x) => 't' + x.tier === key);
      if (t && Number.isFinite(v)) t[field] = Math.max(0, v);
    };
    for (const k of Object.keys(cfg.gear.weapons || {})) setTier(WEAPON_TIERS, k, 'atk', cfg.gear.weapons[k].atk);
    for (const k of Object.keys(cfg.gear.armor || {})) {
      setTier(ARMOR_TIERS, k, 'def', cfg.gear.armor[k].def);
      setTier(ARMOR_TIERS, k, 'hp', cfg.gear.armor[k].hp);
    }
  }
  return cfg;
}
export function resetTuning() { return applyTuning(COMBAT_DEFAULTS); }

// ── Serialization (versioned) ──────────────────────────────────────────────────
export function serializeTuning(override) {
  return JSON.stringify({ v: TUNING_VERSION, override: override || {} });
}
export function parseTuning(str) {
  const o = typeof str === 'string' ? JSON.parse(str) : str;
  if (!o || typeof o !== 'object') return { version: 0, override: {} };
  return { version: Number(o.v ?? o.version ?? 0), override: o.override || {} };
}

// ── FAIRNESS SUMMARY — the deterministic duel sim, so HQ and the game report the
// SAME numbers. Seeded RNG → same config ⇒ same score (reproducible + testable).
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function duel(cfg, a, b, L, rand) {
  const D = cfg.damage;
  const curve = (c, l) => c.base + c.perLevel * (l - 1);
  const mk = (p) => {
    const s = cfg.paths[p];
    const dP = Math.round(curve(D.phys, L) * s.phy), dB = Math.round(curve(D.bolt, L) * s.mag);
    const hp = (cfg.pvp.hp.base + cfg.pvp.hp.perLevel * (L - 1)) * s.pvpHpMul;
    return { hp, maxHp: hp, dP, dB, heal: curve(D.mend, L) * s.healMul, ranged: dB > dP, atkInt: s.atkInt, move: s.moveRel, cd: rand() * s.atkInt, healed: 0 };
  };
  const A = mk(a), B = mk(b); let dist = 6 + rand() * 3; const dt = 0.06, R = cfg.pvp.boltReach, T = cfg.pvp;
  const roll = (base) => { if (rand() < T.miss) return 0; let d = base * (1 - T.spread + rand() * 2 * T.spread); if (rand() < T.crit) d *= T.critX; return d; };
  for (let t = 0; t < 60; t += dt) {
    const plan = (U) => (U.heal > 0 && U.healed < T.healMax && U.hp / U.maxHp < T.healAt) ? 0 : (U.ranged ? 1 : 2); // 0 heal,1 bolt,2 phys
    const pa = plan(A), pb = plan(B);
    const reachOf = (k) => k === 0 ? 0 : k === 1 ? R : 1;
    const mv = (pa !== 0 && dist > reachOf(pa) ? A.move * dt : 0) + (pb !== 0 && dist > reachOf(pb) ? B.move * dt : 0);
    if (mv) dist = Math.max(0.5, dist - mv);
    A.cd -= dt; B.cd -= dt;
    const fire = (U, k, o) => { if (U.cd > 0 || (k !== 0 && dist > reachOf(k))) return; U.cd = U.atkInt; if (k === 0) { U.hp = Math.min(U.maxHp, U.hp + U.heal); U.healed++; } else o.hp -= roll(k === 1 ? U.dB : U.dP); };
    fire(A, pa, B); fire(B, pb, A);
    if (A.hp <= 0 && B.hp <= 0) return 0.5; if (B.hp <= 0) return 1; if (A.hp <= 0) return 0;
  }
  return 0.5;
}
export function fairnessSummary(config, opts = {}) {
  const cfg = config && config.paths ? mergeTuning(config) : mergeTuning(config); // normalize
  const L = opts.level || 10, N = opts.samples || 300;
  const rand = mulberry32(opts.seed || 0x9e3779b9);
  const M = {}; let sse = 0, n = 0, worst = { pct: 50 };
  for (const a of PATHS) { M[a] = {}; for (const b of PATHS) {
    if (a === b) { M[a][b] = 50; continue; }
    let w = 0; for (let i = 0; i < N; i++) w += duel(cfg, a, b, L, rand);
    const pct = (w / N) * 100; M[a][b] = pct; sse += (pct - 50) ** 2; n++;
    if (Math.abs(pct - 50) > Math.abs(worst.pct - 50)) worst = { a, b, pct };
  } }
  const perPath = {};
  for (const a of PATHS) { let s = 0, c = 0; for (const b of PATHS) if (a !== b) { s += M[a][b]; c++; } perPath[a] = s / c; }
  const rms = Math.sqrt(sse / n);
  return { level: L, samples: N, matrix: M, perPath, rms, worst, score: Math.max(0, Math.round(100 - rms * 2.6)) };
}
