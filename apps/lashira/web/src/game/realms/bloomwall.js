import gsap from 'gsap';
import { cx, euclid, drawPad, makeCooldowns, roundRect } from './util.js';
import { TILE, W, H } from '../farm-map.js';
import { monsterOf, ZONE_MOBS } from '@arganta/combat';
import { creatureFrame } from '../creature-sprites.js';
import { towerSprite } from './tower-sprites.js';
import { sfx } from '../../audio/sfx.js';

// Bloomwall Pass — Tower Defense v2 (IMPL §3.2 + CONCEPT-bloomwall-real-tower-
// defense.md). Loop: Start Wave -> tap any open tile beside the lane -> a
// fan-out picker offers the 4 tower types -> real LashiraBloom monsters
// (bestiary.js) walk the lane -> leaks hurt the Bloom Core -> clear a wave =
// Bloom/Stone/Ore + score. Wave 10 of every 10-wave block is always the Tiger
// boss. Clearing wave 10 once unlocks Endless (waves keep cycling
// Meadow->Grove->Cavern->Boss with rising per-cycle scaling). The hero can
// also fight directly: a real equipped skill on the primary button, AND
// light contact damage just by walking into an enemy.
//
// Free placement (v1.3): there is no fixed pad list. Any tile far enough from
// the lane, inside the map's walkable bounds, and not already occupied is a
// legal build spot — tap it and pick a tower from the fan-out. This replaces
// the old fixed 8-pad system entirely.

// ---------------------------------------------------------------------------
// Lane geometry, traced from the real basemap art (bloomwall-pass.png): the
// painted dirt trail from the upper-left forest gap down to the glowing
// crystal (the Bloom Core). A single lane — an earlier fork/merge version
// self-crossed where both branches converged head-on at one point, which
// read as a tangled loop instead of a road. PATH is logic-only (enemy
// movement + build-distance) and is never drawn — the basemap art itself is
// the visual reference for where the lane runs.
const PATH = [
  [10, 6], [11, 9], [13, 12], [16, 15], [19, 17], [21, 20],
  [22, 22], [24, 24], [27, 26], [31, 27], [35, 28], [39, 30], [41, 32], [41, 33],
];
const CORE = PATH[PATH.length - 1];

// Free-placement rules: how close to the lane a tower may sit, and the
// fan-out picker's 4 icon slots (a small arc above the tapped build tile).
const MIN_BUILD_DIST = 0.95; // tiles from the lane centerline
const FAN_TYPES = ['sentry', 'bramble', 'frostbud', 'sunspire'];
const FAN_OFFSETS = [[-1.6, -1.2], [-0.55, -1.7], [0.55, -1.7], [1.6, -1.2]];

const CORE_MAX = 26;
const TD_HP_SCALE = 0.32;  // real bestiary HP is tuned for a leveled hero, not a handful of towers — cut it down for TD pacing
const CYCLE_SCALE = 0.35;  // +35% hp/atk per Endless cycle past the first campaign clear
const BASE_TILES_PER_SEC = 1.1;
const MELEE_RANGE = 0.85, MELEE_CD_MS = 380;

// shotMs/shotEase/shotStyle drive the GSAP-tweened travel animation (§14) —
// separate from fireMs (the cooldown between shots). shotMs also becomes the
// shot's damage-resolution delay, so impact always lands exactly when the
// projectile visually arrives.
const TOWERS = {
  sentry:   { id: 'sentry',   name: 'Sentry',   icon: '🗼', dmgType: 'phys', range: 4.2, fireMs: 620, dmg: 17, tier2: { range: 5.2, fireMs: 500, dmg: 25 }, shotMs: 140, shotEase: 'power2.out', shotStyle: 'arrow' },
  bramble:  { id: 'bramble',  name: 'Bramble',  icon: '🌿', dmgType: 'phys', range: 3.4, fireMs: 880, dmg: 12, aoe: 1.1, tier2: { dmg: 17, aoe: 1.3, burnDmg: 5, burnMs: 2400 }, shotMs: 260, shotEase: 'power1.inOut', shotStyle: 'arc' },
  frostbud: { id: 'frostbud', name: 'Frostbud', icon: '❄️', dmgType: 'mag',  range: 3.6, fireMs: 780, dmg: 9,  slowPct: 0.4, slowMs: 1400, tier2: { dmg: 13, slowPct: 0.55, rootMs: 600 }, shotMs: 200, shotEase: 'power1.out', shotStyle: 'shard' },
  sunspire: { id: 'sunspire', name: 'Sunspire', icon: '✨', dmgType: 'mag',  range: 5.0, fireMs: 950, dmg: 27, pierce: true, tier2: { dmg: 38 }, shotMs: 180, shotEase: 'power2.out', shotStyle: 'beam' },
};
const MODE_ICON = { nearest: '🎯', first: '🏁', strongest: '💪' };

// On-screen monster sizing — absolute px per kind, not a TILE fraction,
// because the first pass (§18.1, a flat TILE*1.15 factor) still read as
// specks next to the hero and towers: creature-sprite art carries the same
// kind of transparent padding livestock sprites do, so a modest bounding-box
// bump doesn't translate 1:1 into visible pixel size. These are picked to
// read clearly next to a ~1.9-tile tower and a full hero sprite, smallest
// (squirrel) still meaningfully smaller than largest (deer/boar).
const MON_SIZE = { squirrel: 64, fox: 72, badger: 88, boar: 96, deer: 92, tiger: 300 };
function monsterHeight(kind, boss) {
  if (boss) return MON_SIZE.tiger;
  return MON_SIZE[kind] || 70;
}

// TD-local overlay on top of the real bestiary stats: resist per damage type
// (+ reduces, − amplifies, same convention as the shared combat RESIST table)
// and a control-resist for slow/root. Local to Bloomwall — never mutates
// packages/combat/bestiary.js or player PvP balance.
const ENEMY_OVERLAY = {
  squirrel: { resist: { phys: 0, mag: 0 } },
  fox:      { resist: { phys: 0, mag: 0 } },
  badger:   { resist: { phys: 0.35, mag: -0.1 } }, // armored bruiser
  boar:     { resist: { phys: 0, mag: 0.1 }, controlResist: 0.7 }, // charger, shrugs off slows
  deer:     { resist: { phys: -0.1, mag: 0 } },    // fast, no armor
  tiger:    { resist: { phys: 0.3, mag: 0.3 }, controlResist: 1 }, // boss, immune to control
};
function tdResist(kind, dmgType) {
  const r = ENEMY_OVERLAY[kind]?.resist?.[dmgType] || 0;
  return Math.max(0.2, Math.min(2, 1 - r));
}

function cycleOf(wave) { return Math.floor((wave - 1) / 10); }

// Wave composition follows the bestiary's own zone tiers (Meadow -> Grove ->
// Cavern, "easiest -> hardest" per ZONE_MOBS) instead of an arbitrary curve.
// Wave 10 of every block is always the Tiger boss, solo.
function waveInfo(wave) {
  const inCycle = ((wave - 1) % 10) + 1;
  const cycle = cycleOf(wave);
  if (inCycle === 10) return { kinds: ['tiger'], boss: true, cycle, count: 1 };
  let kinds;
  if (inCycle <= 3) kinds = ZONE_MOBS.meadow;
  else if (inCycle <= 6) kinds = Math.random() < 0.4 ? [...ZONE_MOBS.grove, ...ZONE_MOBS.meadow] : ZONE_MOBS.grove;
  else kinds = Math.random() < 0.4 ? [...ZONE_MOBS.cavern, ...ZONE_MOBS.grove] : ZONE_MOBS.cavern;
  return { kinds, boss: false, cycle, count: 4 + Math.round(inCycle * 1.3) };
}

function facingFromDelta(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 'East' : 'West';
  return dy >= 0 ? 'South' : 'North';
}

function speedMulOf(e, now) {
  if (e.rootUntil && now < e.rootUntil) return 0;
  if (e.slowUntil && now < e.slowUntil) return 1 - (e.slowPct || 0);
  return 1;
}

// Shortest distance from a point to a line segment (for keeping towers off the lane).
function pointSegDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 0.0001;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
function distToPath(tx, ty) {
  let best = Infinity;
  for (let i = 0; i < PATH.length - 1; i++) {
    const [ax, ay] = PATH[i], [bx, by] = PATH[i + 1];
    const d = pointSegDist(tx, ty, ax, ay, bx, by);
    if (d < best) best = d;
  }
  return best;
}

export function createBloomwallModule(api) {
  const cd = makeCooldowns();
  const s = {
    phase: 'idle', wave: 0, coreHp: CORE_MAX, coreMax: CORE_MAX,
    towers: [], nextTowerId: 1, fan: null, // fan: { tile:[tx,ty], icons:[{type,tile}] } while the picker is open
    enemies: [], shots: [], hits: [], meleeHit: {},
    toSpawn: 0, spawnAt: 0, nextId: 1,
    waveInfo: null, campaignCleared: false, stars: 0,
  };

  function isBuildable(tx, ty) {
    if (tx < 1 || ty < 1 || tx >= W - 1 || ty >= H - 1) return false;
    if (distToPath(tx, ty) < MIN_BUILD_DIST) return false;
    if (s.towers.some((t) => t.tile[0] === tx && t.tile[1] === ty)) return false;
    return true;
  }
  function openFan(tx, ty) {
    s.fan = { kind: 'build', tile: [tx, ty], icons: FAN_TYPES.map((type, i) => ({
      type, tile: [Math.round(tx + FAN_OFFSETS[i][0]), Math.round(ty + FAN_OFFSETS[i][1])],
    })) };
  }
  // Tapping a placed tower opens Upgrade (if under tier 2) + the 3 targeting
  // modes as direct picks (§16) — same fan mechanism, different actions.
  function openTowerFan(t) {
    const [tx, ty] = t.tile;
    const items = [];
    if (t.tier < 2) items.push({ kind: 'upgrade' });
    items.push({ kind: 'mode', mode: 'nearest' }, { kind: 'mode', mode: 'first' }, { kind: 'mode', mode: 'strongest' });
    s.fan = {
      kind: 'tower', forTower: t, tile: [tx, ty],
      icons: items.slice(0, 4).map((it, i) => ({ ...it, tile: [Math.round(tx + FAN_OFFSETS[i][0]), Math.round(ty + FAN_OFFSETS[i][1])] })),
    };
  }

  function advance(e, dt, speedMul) {
    let move = e.speed * speedMul * dt / 1000;
    while (move > 0 && e.seg < PATH.length - 1) {
      const [ax, ay] = PATH[e.seg], [bx, by] = PATH[e.seg + 1];
      const segLen = Math.hypot(bx - ax, by - ay) || 0.001;
      const remain = (1 - e.t) * segLen;
      if (move >= remain) { move -= remain; e.seg++; e.t = 0; e.dist += remain; e.facing = facingFromDelta(bx - ax, by - ay); }
      else { e.t += move / segLen; e.dist += move; move = 0; e.facing = facingFromDelta(bx - ax, by - ay); }
    }
    const [ax, ay] = PATH[Math.min(e.seg, PATH.length - 1)], [bx, by] = PATH[Math.min(e.seg + 1, PATH.length - 1)];
    e.x = ax + (bx - ax) * e.t; e.y = ay + (by - ay) * e.t;
    return e.seg >= PATH.length - 1;
  }

  function spawnEnemy(kind, boss) {
    const base = monsterOf(kind);
    const mul = 1 + cycleOf(s.wave) * CYCLE_SCALE;
    const hp = Math.max(6, Math.round(base.hp * TD_HP_SCALE * mul));
    s.enemies.push({
      id: s.nextId++, kind, boss: !!boss,
      seg: 0, t: 0, dist: 0, x: PATH[0][0], y: PATH[0][1], facing: 'South',
      hp, maxHp: hp, atk: Math.round(base.atk * mul), speed: BASE_TILES_PER_SEC * (600 / base.speedMs),
      slowUntil: 0, rootUntil: 0, burn: null, enraged: false, telegraphed: false,
    });
  }

  function killEnemy(e) {
    const idx = s.enemies.indexOf(e); if (idx >= 0) s.enemies.splice(idx, 1);
    const tierBonus = ZONE_MOBS.grove.includes(e.kind) ? 1 : ZONE_MOBS.cavern.includes(e.kind) ? 2 : 0;
    api.grant({ bloom: 2 + tierBonus, ore: e.boss ? 6 : 1, score: e.boss ? 80 : 5 }, { source: e.boss ? 'boss-kill' : 'kill', meterGain: 0 });
  }

  function pickTarget(mode, range, tx, ty) {
    let best = null, bestScore = -Infinity, bestDist = Infinity;
    for (const e of s.enemies) {
      const d = euclid(tx, ty, e.x, e.y);
      if (d > range) continue;
      if (mode === 'strongest') { if (e.hp > bestScore) { bestScore = e.hp; best = e; } }
      else if (mode === 'first') { if (e.dist > bestScore) { bestScore = e.dist; best = e; } }
      else if (d < bestDist) { bestDist = d; best = e; }
    }
    return best;
  }

  function beginWave(n) {
    s.wave = n;
    const info = waveInfo(n);
    s.waveInfo = info;
    s.phase = 'wave';
    s.toSpawn = info.count;
    s.spawnAt = performance.now() + 500;
    api.flash(info.boss ? 'Tiger incoming! 🐯' : `Wave ${n}`);
    api.bumpHud();
  }
  function startWave() {
    if (s.phase === 'wave') return;
    if (s.phase === 'lost') {
      // a fresh run after defeat — clear defenses/stars along with the core.
      s.coreHp = s.coreMax; s.towers = []; s.stars = 0;
      beginWave(1);
    } else if (s.phase === 'idle') {
      // first-ever start — keep whatever towers were placed during prep.
      beginWave(1);
    } else beginWave(s.wave + 1); // 'won' -> next wave, or past 10 -> Endless
  }

  function placeTower(type, tile) {
    s.towers.push({ id: s.nextTowerId++, type, tile, tier: 1, lastFire: 0, targetMode: 'nearest' });
    api.flash(`${TOWERS[type].name} built`);
    api.bumpHud();
  }

  // The hero fights with the REAL PvP/PvE kit (v1.5 §18.4): a basic attack +
  // the 3 equipped Skill-Forge slots, rendered in the shared ActionCluster.
  // Behavior is keyed off the skill's own `type`/`target` fields — the SAME
  // convention FarmRoom's doSkill uses (skill.type==='heal', skill.target
  // ==='all') — not a hardcoded slot index, so a reordered/custom loadout
  // still behaves correctly:
  //   type 'heal'          — Mend → repairs the Bloom Core (the defense's self-heal)
  //   target 'all'         — Storm-family — every foe in radius
  //   otherwise            — Bolt-family — single-target, nearest foe in reach
  const HERO_REACH = 2.4, HERO_AOE = 2.8, ATK_CD = 700;
  const DEFAULT_SKILL = [
    { id: 'bolt', name: 'Bolt', type: 'magic', target: 'single', fx: 22, cdMs: 900 },
    { id: 'storm', name: 'Storm', type: 'magic', target: 'all', fx: 131, cdMs: 2600 },
    { id: 'mend', name: 'Mend', type: 'heal', target: 'self', fx: 1, cdMs: 1800 },
  ];

  function heroAttack() {
    if (!cd.ready('atk')) return;
    const hc = api.heroCombat ? api.heroCombat() : null;
    const p = api.player();
    let best = null, bd = HERO_REACH;
    for (const e of s.enemies) { const d = euclid(p.tile[0], p.tile[1], e.x, e.y); if (d < bd) { bd = d; best = e; } }
    api.playMotion('strike');
    cd.trigger('atk', ATK_CD);
    if (best) {
      best.hp -= (hc ? hc.physPower : 20) * tdResist(best.kind, 'phys');
      s.hits.push({ x: cx(best.x), y: cx(best.y), life: 220 });
      if (best.hp <= 0) killEnemy(best);
    }
  }

  function heroCastSkill(slot) {
    const key = 'sk' + slot;
    if (!cd.ready(key)) return;
    const hc = api.heroCombat ? api.heroCombat() : null;
    const sk = hc?.skills?.[slot] || DEFAULT_SKILL[slot];
    if (!sk) return;
    const name = sk.name || 'Skill';
    const p = api.player();
    api.playMotion('cast');
    cd.trigger(key, sk.cdMs || 1200);

    if (sk.type === 'heal') { // Mend → repairs the Bloom Core
      const before = s.coreHp;
      s.coreHp = Math.min(s.coreMax, s.coreHp + 3);
      if (api.castEffect) api.castEffect(sk.fx, p.tile);
      api.flash(s.coreHp > before ? `${name} — Core +${s.coreHp - before}` : `${name}`);
      api.bumpHud();
      return;
    }
    const power = sk.power || 30;
    let hit = 0;
    if (sk.target === 'all') { // Storm-family — every foe in radius
      for (let i = s.enemies.length - 1; i >= 0; i--) {
        const e = s.enemies[i];
        if (euclid(p.tile[0], p.tile[1], e.x, e.y) <= HERO_AOE) {
          e.hp -= power * tdResist(e.kind, 'mag'); hit++;
          if (api.castEffect) api.castEffect(sk.fx, [e.x, e.y]);
          if (e.hp <= 0) killEnemy(e);
        }
      }
    } else { // Bolt-family — single-target, nearest foe in reach
      let best = null, bd = HERO_REACH + 0.6;
      for (const e of s.enemies) { const d = euclid(p.tile[0], p.tile[1], e.x, e.y); if (d < bd) { bd = d; best = e; } }
      if (best) {
        best.hp -= power * 1.6 * tdResist(best.kind, 'mag'); hit = 1;
        if (api.castEffect) api.castEffect(sk.fx, [best.x, best.y]);
        if (best.hp <= 0) killEnemy(best);
      }
    }
    api.flash(hit ? `${name}! ${hit} hit` : `${name}!`);
  }

  // The hero also fights just by walking into an enemy on the lane — light
  // contact damage, short per-target cooldown so it can't melt a boss by
  // standing still, independent of the skill-button cooldown.
  function meleeTick(now) {
    if (s.phase !== 'wave') return;
    const p = api.player();
    const t = p.moveT ?? 1;
    const px = p.from && t < 1 ? p.from[0] + (p.tile[0] - p.from[0]) * t : p.tile[0];
    const py = p.from && t < 1 ? p.from[1] + (p.tile[1] - p.from[1]) * t : p.tile[1];
    const hc = api.heroCombat ? api.heroCombat() : null;
    const dmg = hc ? Math.max(4, Math.round(hc.physPower * 0.3)) : 8;
    for (let i = s.enemies.length - 1; i >= 0; i--) {
      const e = s.enemies[i];
      if (euclid(px, py, e.x, e.y) > MELEE_RANGE) continue;
      if (now - (s.meleeHit[e.id] || 0) < MELEE_CD_MS) continue;
      s.meleeHit[e.id] = now;
      e.hp -= dmg * tdResist(e.kind, 'phys');
      s.hits.push({ x: cx(e.x), y: cx(e.y), life: 220 });
      if (e.hp <= 0) killEnemy(e);
    }
  }

  function tick(dt, now) {
    meleeTick(now);
    if (s.phase !== 'wave') return;
    if (s.toSpawn > 0 && now >= s.spawnAt) {
      const info = s.waveInfo;
      const kind = info.boss ? 'tiger' : info.kinds[Math.floor(Math.random() * info.kinds.length)];
      spawnEnemy(kind, !!info.boss);
      s.toSpawn--;
      s.spawnAt = now + (info.boss ? 600 : Math.max(360, 900 - s.wave * 15));
    }
    // movement + leaks
    for (let i = s.enemies.length - 1; i >= 0; i--) {
      const e = s.enemies[i];
      if (e.boss && !e.enraged && e.hp <= e.maxHp * 0.5) { e.enraged = true; e.speed *= 1.15; api.flash('Tiger enrages! 🔥'); }
      if (e.boss && !e.telegraphed && e.seg >= PATH.length - 3) { e.telegraphed = true; api.flash('Tiger charges the core! ⚠️'); }
      const leaked = advance(e, dt, speedMulOf(e, now));
      if (leaked) {
        s.enemies.splice(i, 1);
        const dmg = Math.max(1, Math.round(e.atk / 55));
        s.coreHp -= dmg;
        api.flash(e.boss ? 'The Tiger breaches the gate! 💔💔💔' : 'Core hit! 💔');
        if (s.coreHp <= 0) {
          s.coreHp = 0; s.phase = 'lost'; s.enemies = []; s.shots = []; s.toSpawn = 0;
          api.setBoardBest(s.wave); api.flash('The gate fell… try again'); api.bumpHud();
          return;
        }
      }
    }
    // burn ticks (Bramble tier 2)
    for (let i = s.enemies.length - 1; i >= 0; i--) {
      const e = s.enemies[i]; if (!e.burn) continue;
      if (now >= e.burn.until) { e.burn = null; continue; }
      if (now >= e.burn.tickAt) { e.hp -= e.burn.dmg; e.burn.tickAt = now + 500; if (e.hp <= 0) killEnemy(e); }
    }
    // towers fire
    for (const t of s.towers) {
      const def = TOWERS[t.type]; const tierDef = t.tier === 2 ? { ...def, ...def.tier2 } : def;
      if (now - t.lastFire < tierDef.fireMs) continue;
      const [tx, ty] = t.tile;
      const target = pickTarget(t.targetMode, tierDef.range, tx, ty);
      if (!target) continue;
      t.lastFire = now;
      sfx.play('tower' + def.name);
      const shotMs = def.shotMs || 220;
      const shot = {
        ox: cx(tx), oy: cx(ty), tx0: cx(target.x), ty0: cx(target.y), progress: 0,
        style: def.shotStyle || 'arrow', tid: target.id, life: shotMs, dmg: tierDef.dmg, dmgType: tierDef.dmgType,
        pierce: !!tierDef.pierce, aoe: tierDef.aoe || 0, burnDmg: tierDef.burnDmg || 0, burnMs: tierDef.burnMs || 0,
        slowPct: tierDef.slowPct || 0, slowMs: tierDef.slowMs || 0, rootMs: tierDef.rootMs || 0,
      };
      s.shots.push(shot);
      // Visual-only tween (§14) — damage resolution below still runs on its
      // own deterministic dt-driven `life` countdown, unaffected by GSAP.
      gsap.to(shot, { progress: 1, duration: shotMs / 1000, ease: def.shotEase || 'power2.out' });
    }
    // resolve shots
    for (let i = s.shots.length - 1; i >= 0; i--) {
      const sh = s.shots[i]; sh.life -= dt;
      if (sh.life > 0) continue;
      const primary = s.enemies.find((x) => x.id === sh.tid);
      if (primary) {
        sfx.play('hit');
        const targets = sh.aoe ? s.enemies.filter((x) => euclid(x.x, x.y, primary.x, primary.y) <= sh.aoe) : [primary];
        for (const e of targets) {
          const mult = sh.pierce ? 1 : tdResist(e.kind, sh.dmgType);
          e.hp -= sh.dmg * mult;
          const cr = ENEMY_OVERLAY[e.kind]?.controlResist || 0;
          if (sh.slowPct) { e.slowUntil = Math.max(e.slowUntil, now + sh.slowMs); e.slowPct = sh.slowPct * (1 - cr); }
          if (sh.rootMs && cr < 0.9) e.rootUntil = Math.max(e.rootUntil, now + sh.rootMs);
          if (sh.burnDmg) e.burn = { dmg: sh.burnDmg, until: now + sh.burnMs, tickAt: now + 500 };
          if (e.hp <= 0) killEnemy(e);
        }
      }
      s.shots.splice(i, 1);
    }
    for (let i = s.hits.length - 1; i >= 0; i--) { s.hits[i].life -= dt; if (s.hits[i].life <= 0) s.hits.splice(i, 1); }
    // wave cleared?
    if (s.phase === 'wave' && s.toSpawn === 0 && s.enemies.length === 0) {
      const info = s.waveInfo;
      if (info.boss) {
        if (s.wave === 10 && !s.campaignCleared) {
          s.campaignCleared = true;
          s.stars = s.coreHp >= s.coreMax * 0.8 ? 3 : s.coreHp >= s.coreMax * 0.4 ? 2 : 1;
          api.grant({ bloom: 24, stone: 10, ore: 6, score: 60 }, { source: 'victory', meterGain: 1 });
          api.flash(`Gate held! Blueprint earned 📜 (${s.stars}★)`);
        } else {
          api.grant({ bloom: 18, stone: 8, ore: 5, score: 40 }, { source: 'boss', meterGain: 0 });
          api.flash('Cycle boss defeated! 🐯');
        }
        api.setBoardBest(s.wave);
        s.phase = 'won';
      } else {
        api.grant({ bloom: 6, stone: 3, score: 8 }, { source: 'wave', meterGain: 0 });
        api.flash(`Wave ${s.wave} cleared!`);
        beginWave(s.wave + 1);
      }
      api.bumpHud();
    }
  }

  return {
    kind: 'bloomwall', movement: true, _s: s,
    tick,
    onTapWorld(tx, ty) {
      if (s.fan) {
        const hit = s.fan.icons.find((ic) => ic.tile[0] === tx && ic.tile[1] === ty);
        const fan = s.fan;
        s.fan = null;
        if (!hit) return;
        if (fan.kind === 'build') placeTower(hit.type, fan.tile);
        else if (hit.kind === 'upgrade') {
          fan.forTower.tier = 2;
          api.flash(`${TOWERS[fan.forTower.type].name} Lv2 ⬆`);
          api.bumpHud();
        } else if (hit.kind === 'mode') {
          fan.forTower.targetMode = hit.mode;
          api.flash(`${TOWERS[fan.forTower.type].name} targeting: ${hit.mode}`);
        }
        return;
      }
      const existing = s.towers.find((t) => t.tile[0] === tx && t.tile[1] === ty);
      if (existing) { openTowerFan(existing); return; }
      if (!isBuildable(tx, ty)) { api.flash(distToPath(tx, ty) < MIN_BUILD_DIST ? "Can't build on the lane" : 'Out of bounds'); return; }
      openFan(tx, ty);
    },
    onAction(id) {
      if (id === 'primary') startWave();
      else if (id === 'attack') heroAttack();
      else if (id === 'skill:0') heroCastSkill(0);
      else if (id === 'skill:1') heroCastSkill(1);
      else if (id === 'skill:2') heroCastSkill(2);
      else if (id === 'menu') api.exit();
    },
    controller() {
      const inWave = s.phase === 'wave';
      // Mid-wave: the real PvP/PvE ActionCluster (attack + the hero's 3 real
      // skill slots, pie-wipe cooldowns). Otherwise: a simple Start/Retry button.
      if (inWave) {
        const hc = api.heroCombat ? api.heroCombat() : null;
        const slots = hc?.skills || DEFAULT_SKILL;
        return {
          cluster: {
            skills: slots.map((sk, i) => ({ ...sk, cooldownMs: sk.cdMs || 1200, cooldownUntil: cd.until('sk' + i) })),
            attack: { cooldownMs: ATK_CD, cooldownUntil: cd.until('atk') },
            mp: null, // Bloomwall gates skills on cooldown only (no depleting pool)
            skin: 'brass', // the real PvP/PvE default skin — warm gold, matches the reference exactly
            utils: [{ id: 'menu', key: 'menu', icon: '↩', title: 'Exit to HQ' }],
          },
        };
      }
      const primaryLabel = s.phase === 'lost' ? 'Retry' : s.phase === 'won' ? (s.wave < 10 ? 'Next Wave' : 'Continue → Endless') : 'Start Wave';
      return {
        primary: { id: 'primary', label: primaryLabel, icon: '⚔', kind: 'primary' },
        ring: [{ id: 'menu', label: 'Exit', icon: '↩', kind: 'utility' }],
      };
    },
    hud() {
      const m = api.getMeter();
      const inCycle = ((s.wave - 1) % 10) + 1, cycle = cycleOf(s.wave);
      const label = s.wave > 10 ? `Endless cycle ${cycle + 1} · wave ${inCycle}/10` : `Wave ${Math.max(s.wave, 1)}/10`;
      const obj = s.phase === 'wave' ? `${label} · foes ${s.enemies.length + s.toSpawn}`
        : s.phase === 'won' ? (s.wave >= 10 ? `Gate held! ${s.stars ? s.stars + '★ · ' : ''}Continue for Endless?` : 'Wave cleared — next?')
        : s.phase === 'lost' ? 'The gate fell — retry' : 'Tap open ground to build, then Start Wave';
      return { objective: obj, meter: { value: m.value, max: 10, label: `Core ${s.coreHp}/${s.coreMax} · Defense Lv ${(m.stage || 0) + 1}` } };
    },
    drawUnder(ctx) {
      // No drawn lane — the basemap art itself is the path reference (§13).
      // PATH stays pure logic (enemy movement + build-distance checks).
      for (const t of s.towers) {
        const [tx, ty] = t.tile;
        const def = TOWERS[t.type];
        const tierDef = t.tier === 2 ? { ...def, ...def.tier2 } : def;
        ctx.save(); ctx.strokeStyle = 'rgba(44,166,78,.16)';
        ctx.beginPath(); ctx.arc(cx(tx), cx(ty), tierDef.range * TILE, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        const sprite = towerSprite(t.type, t.tier);
        ctx.save();
        if (sprite) {
          const iw = sprite.naturalWidth || 96, ih = sprite.naturalHeight || 96;
          const targetH = TILE * 1.9;
          const sc = targetH / ih, w = iw * sc, h = ih * sc;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(sprite, cx(tx) - w / 2, cx(ty) - h * 0.82, w, h);
          ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
          ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
          const label = `L${t.tier} · ${t.targetMode}`;
          ctx.strokeText(label, cx(tx), cx(ty) + TILE * 0.55);
          ctx.fillText(label, cx(tx), cx(ty) + TILE * 0.55);
        } else {
          drawPad(ctx, tx - 1, ty - 1, 2, 2, { color: '#2ca64e', icon: def.icon, label: `${def.name.slice(0, 3)} L${t.tier}` });
        }
        ctx.restore();
      }
      // Fan-out picker — build choices on an open tile, or Upgrade/targeting
      // on an existing tower (§16). Same mechanism, different action set.
      if (s.fan) {
        const [btx, bty] = s.fan.tile;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx(btx), cx(bty), TILE * 0.55, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        for (const ic of s.fan.icons) {
          const [fx, fy] = ic.tile;
          const active = s.fan.kind === 'tower' && ic.kind === 'mode' && s.fan.forTower.targetMode === ic.mode;
          ctx.save();
          ctx.beginPath(); ctx.arc(cx(fx), cx(fy), TILE * 0.42, 0, Math.PI * 2);
          ctx.fillStyle = active ? 'rgba(44,166,78,.9)' : 'rgba(20,24,40,.85)'; ctx.fill();
          ctx.strokeStyle = '#ffffffcc'; ctx.lineWidth = 2; ctx.stroke();
          if (s.fan.kind === 'build') {
            const def = TOWERS[ic.type];
            const sprite = towerSprite(ic.type, 1);
            if (sprite) {
              const iw = sprite.naturalWidth || 96, ih = sprite.naturalHeight || 96;
              const targetH = TILE * 0.85, sc = targetH / ih, w = iw * sc, h = ih * sc;
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(sprite, cx(fx) - w / 2, cx(fy) - h * 0.75, w, h);
            } else {
              ctx.font = '20px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
              ctx.fillText(def.icon, cx(fx), cx(fy));
            }
          } else {
            ctx.font = '20px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
            ctx.fillText(ic.kind === 'upgrade' ? '⬆' : MODE_ICON[ic.mode], cx(fx), cx(fy));
          }
          ctx.restore();
        }
      }
      const [ctX, ctY] = CORE;
      ctx.save();
      roundRect(ctx, cx(ctX) - 22, cx(ctY) - 22, 44, 44, 10);
      ctx.fillStyle = s.coreHp > s.coreMax * 0.3 ? 'rgba(124,108,255,.9)' : 'rgba(224,60,60,.9)'; ctx.fill();
      ctx.font = '20px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
      ctx.fillText('💎', cx(ctX), cx(ctY) - 2);
      ctx.font = '700 13px system-ui'; ctx.fillText(s.coreHp + '/' + s.coreMax, cx(ctX), cx(ctY) + 26);
      ctx.restore();
    },
    drawOver(ctx, now) {
      for (const e of s.enemies) {
        const X = cx(e.x), Y = cx(e.y);
        const sprite = creatureFrame(e.kind, e.facing || 'South', true, now || performance.now());
        const targetH = monsterHeight(e.kind, e.boss);
        ctx.save();
        if (sprite) {
          const iw = sprite.naturalWidth || 96, ih = sprite.naturalHeight || 96;
          const sc = targetH / ih, w = iw * sc, h = ih * sc;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(sprite, X - w / 2, Y - h * 0.85, w, h);
        } else {
          ctx.fillStyle = monsterOf(e.kind).color || '#3a2b4a';
          ctx.beginPath(); ctx.arc(X, Y, targetH * 0.32, 0, Math.PI * 2); ctx.fill();
        }
        if (e.boss) {
          ctx.font = '700 13px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd76a';
          ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
          ctx.strokeText('👑 Tiger', X, Y - targetH * 0.7); ctx.fillText('👑 Tiger', X, Y - targetH * 0.7);
        }
        const barW = e.boss ? 56 : 30, barY = Y - targetH * 0.92;
        ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(X - barW / 2, barY, barW, 5);
        ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#57c98a' : e.hp / e.maxHp > 0.25 ? '#e0b83c' : '#e05c5c';
        ctx.fillRect(X - barW / 2, barY, barW * Math.max(0, e.hp / e.maxHp), 5);
        ctx.restore();
      }
      // Traveling shots (§14) — GSAP tweens sh.progress 0..1; damage still
      // resolves on its own deterministic dt-driven `life` countdown above.
      for (const sh of s.shots) {
        const p = Math.max(0, Math.min(1, sh.progress || 0));
        if (sh.style === 'beam') {
          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - p);
          ctx.strokeStyle = '#ffe38a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(sh.ox, sh.oy); ctx.lineTo(sh.tx0, sh.ty0); ctx.stroke();
          ctx.restore();
          continue;
        }
        let x = sh.ox + (sh.tx0 - sh.ox) * p;
        let y = sh.oy + (sh.ty0 - sh.oy) * p;
        if (sh.style === 'arc') y -= Math.sin(p * Math.PI) * TILE * 0.55;
        ctx.save();
        ctx.translate(x, y);
        if (sh.style === 'arrow' || sh.style === 'shard') ctx.rotate(Math.atan2(sh.ty0 - sh.oy, sh.tx0 - sh.ox));
        ctx.fillStyle = sh.style === 'shard' ? '#bfe9ff' : sh.style === 'arc' ? '#8ee08a' : '#ffe38a';
        if (sh.style === 'arrow') { ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-4, 3.5); ctx.lineTo(-4, -3.5); ctx.closePath(); ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(0, 0, sh.style === 'arc' ? 5 : 4, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      }
      ctx.save(); ctx.strokeStyle = '#ffffffcc'; ctx.lineWidth = 2;
      for (const h of s.hits) { ctx.globalAlpha = Math.max(0, h.life / 220); ctx.beginPath(); ctx.arc(h.x, h.y, 10, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    },
    cleanup() {},
  };
}
