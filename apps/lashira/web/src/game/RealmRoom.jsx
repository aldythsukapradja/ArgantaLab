import { useEffect, useMemo, useRef, useState } from 'react';
import { pathForWeapon, battleSkillsFor, pathSkillPower, pathPhysPower, pathMaxHp, pathMaxMp, pathOf, pathTitle, levelWithFloor, levelProgress, xpForLevel, pvpMaxHp, resistMul, spawnEffect, drawEffect, EMOTES } from '@arganta/combat';
import { computeRank, loadMotionTables, loadPlayerResources } from '../net/hero.js';
import { defaultFarmerSpec } from '../net/characterRegistry.js';
import { drawPlaceholderFarmer, TILE, W, H, WORLD_W, WORLD_H } from './farm-map.js';
import { loadOpenworldState, saveOpenworldState } from './openworld-save.js';
import { worldAssetUrl, worldMapById } from './world-map-registry.js';
import { resolveStep, paintStep, stepCount, drawListBBox } from '../engine/compositor.js';
import { effects as loadEffects, effectSheetUrl, loadImage as loadEffectImage } from '../engine/data.js';
import { makeRewardSession } from './realm-rewards.js';
import { getRealmModule } from './realms/index.js';
import { joinFarmPresence } from './farm-presence.js';
import { recordPvpKo } from './pvp-rank.js';
import RealmShell from '../ui/RealmShell.jsx';
import { sfx } from '../audio/sfx.js';
import { ambient } from '../audio/ambient.js';

const REMOTE_WALK_MS = 440;

const DIR_BY_KEY = { ArrowUp: 'North', w: 'North', ArrowDown: 'South', s: 'South', ArrowLeft: 'West', a: 'West', ArrowRight: 'East', d: 'East' };
const DELTA = { North: [0, -1], South: [0, 1], East: [1, 0], West: [-1, 0] };
const FACE_WORD = { North: 'up', South: 'down', East: 'right', West: 'left' };
const WALK_MS = 440;

function blockedAt(tx, ty) { return tx < 1 || ty < 1 || tx >= W - 1 || ty >= H - 1; }

// Module-level (not component-scoped, needs no closure) — interpolated pixel
// position of any {tile,from,moveT} entity. Shared by the render loop AND the
// presence/PvP effect; a function declared inside only ONE of those two
// useEffects would be invisible to the other (exactly the FarmRoom.jsx pvp-hit
// scoping bug — see that file's history — so this one is deliberately hoisted
// out to module scope instead of repeating the mistake).
function entityPxOf(e) {
  const t = e.moveT ?? 1;
  const fx = e.from && t < 1 ? e.from[0] + (e.tile[0] - e.from[0]) * t : e.tile[0];
  const fy = e.from && t < 1 ? e.from[1] + (e.tile[1] - e.from[1]) * t : e.tile[1];
  return [fx * TILE, fy * TILE];
}
function actorTileAt(e, now = performance.now()) {
  const t = e.moveT ?? 1;
  if (e.from && t < 1) {
    const p = Math.max(0, Math.min(1, (now - e.moveStart) / (e.speedMs || REMOTE_WALK_MS)));
    return [e.from[0] + (e.tile[0] - e.from[0]) * p, e.from[1] + (e.tile[1] - e.from[1]) * p];
  }
  return e.tile;
}

// Real character motions (mirrors FarmRoom.jsx's attackMotionBase/castMotionBase
// exactly, so a realm's Strike/Skill button shows the SAME body animation the
// main farm combat does): 'Swing'-family for physical hits, 'Spell' for magic
// skill casts — falls back gracefully if this hero's sprite has no frames for it.
function attackMotionBase(g) {
  const facing = g.player.facing;
  if (g.tables) {
    for (const base of ['Swing', 'Attack', 'Pierce', 'Shoot']) {
      if (stepCount(g.tables, base + facing) > 0) return base;
    }
  }
  return 'Get';
}
function castMotionBase(g) {
  const facing = g.player.facing;
  if (g.tables && stepCount(g.tables, 'Spell' + facing) > 0) return 'Spell';
  return attackMotionBase(g);
}

// The hero's real combat path, inferred from the equipped weapon (same rule
// FarmRoom/heroCombat use — no separate class picker exists yet).
function realPathId(hero) {
  const w = hero?.spec?.weapon;
  const weaponStr = typeof w === 'string' ? w : (w?.cat || w?.name || w?.id || '');
  return pathForWeapon(weaponStr);
}

// Was a standalone level(=profile.level)/hp/mp formula unrelated to the rest
// of the game (flat +10hp/+4mp per level, no path, xp%500 progress bar) — so
// two different realms (or a realm vs the real farm) showed DIFFERENT hp/mp
// for the same hero, reading as "random". Now derives the card the exact same
// way farm-logic.js's snapshot() does: real path (from the equipped weapon),
// the shared exponential XP ladder, and pathMaxHp/pathMaxMp (path + level
// scaled, matching what FarmRoom and PvP both use).
function xpCard(profile, hero) {
  const xp = Number(profile?.xp) || 0;
  const floor = Number(profile?.level) || 1;
  const level = profile?.operator ? 99 : levelWithFloor(xp, floor);
  const path = realPathId(hero);
  const maxHp = pathMaxHp(path, level);
  const maxMp = pathMaxMp(path, level);
  return {
    rank: computeRank(xp), name: profile?.displayName || 'Farmer',
    pathIcon: pathOf(path).icon, pathName: pathOf(path).name, title: pathTitle(path, level), level,
    xpPct: Math.round(levelProgress(xp) * 100),
    xpCur: Math.max(0, xp - xpForLevel(level)),
    xpReq: level >= 99 ? 0 : (xpForLevel(level + 1) - xpForLevel(level)),
    hp: maxHp, maxHp, mp: maxMp, maxMp,
  };
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
    img.onerror = () => resolve(null);
    img.decoding = 'async';
    img.src = src;
  });
}

export default function RealmRoom({ profile, hero, realmId, circleId = null, hqTile = null, hqFacing = 'South', onExit }) {
  const map = worldMapById(realmId);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const G = useRef(null);
  const modRef = useRef(null);
  const rewardRef = useRef(null);
  const exitRef = useRef(null);
  const presenceCtrlRef = useRef(null);
  const timers = useRef({});
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState('');
  const [usingHero, setUsingHero] = useState(false);
  const [hasMount, setHasMount] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [, setHudTick] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  const [battle, setBattle] = useState({ on: false, hp: 0, maxHp: 0 });
  const battleRef = useRef(battle);
  // User-adjustable camera zoom multiplier on top of the realm's base camZoom
  // (v1.5 §18 follow-up: a settings slider, since the fixed camZoom fix alone
  // isn't always the right size for every screen/eye). Persisted like
  // sfx/ambient volume; read via a ref inside the rAF draw loop so the slider
  // doesn't need to tear down/rebuild the render effect on every drag tick.
  const [camZoomMul, setCamZoomMul] = useState(() => {
    try { return parseFloat(localStorage.getItem('lashira_realm_camzoom')) || 1; } catch { return 1; }
  });
  const camZoomMulRef = useRef(camZoomMul);
  camZoomMulRef.current = camZoomMul;
  const setCamZoom = (v) => {
    const clamped = Math.max(0.6, Math.min(2, Number(v) || 1));
    setCamZoomMul(clamped);
    try { localStorage.setItem('lashira_realm_camzoom', String(clamped)); } catch { /* private mode */ }
  };
  const card = useMemo(() => xpCard(profile, hero), [profile?.displayName, profile?.xp, profile?.level, profile?.operator, hero?.spec]);
  const accountType = profile?.role === 'kid' ? 'kid' : 'adult';
  // The card overlaid with the LIVE PvP pool while Arena combat is active —
  // every other realm just shows the flat level-scaled card (no live pool).
  const displayCard = battle.on ? { ...card, hp: battle.hp, maxHp: battle.maxHp } : card;

  const flash = (msg) => {
    setToast(msg);
    window.clearTimeout(timers.current.toast || 0);
    timers.current.toast = window.setTimeout(() => setToast(''), 1600);
  };

  // ---------- PvP (Arena-only; other realms never call ensureRealmCombat so
  // g.combat stays undefined for them and none of this runs) ----------
  // Component-level, NOT nested in either useEffect below — the presence
  // effect's applyIntent('pvp-hit') and the render loop both need these, and a
  // function declared inside only one effect's closure is invisible to the
  // other (see FarmRoom.jsx's pvp-hit bug history for exactly this mistake).
  function syncBattleState(g) {
    const next = { on: g.combat?.on || false, hp: g.combat?.hp || 0, maxHp: g.combat?.maxHp || 0 };
    if (battleRef.current.on !== next.on || battleRef.current.hp !== next.hp || battleRef.current.maxHp !== next.maxHp) {
      battleRef.current = next; setBattle(next);
    }
  }
  // Size + activate this player's PvP pool. Idempotent — safe to call every
  // time combat should be "on" (entering the realm, before applying a hit).
  function ensureRealmCombat(g) {
    const path = realPathId(hero);
    const level = card.level || 1;
    const properMax = pvpMaxHp(path, level);
    if (!g.combat) g.combat = { on: false, hp: properMax, maxHp: properMax };
    if (g.combat.maxHp !== properMax) {
      const frac = g.combat.maxHp > 0 ? g.combat.hp / g.combat.maxHp : 1;
      g.combat.maxHp = properMax;
      g.combat.hp = Math.round(properMax * frac);
    }
    g.combat.on = true;
    return path;
  }
  function peersInRealm(g) {
    const now = performance.now();
    const out = [];
    for (const [id, a] of g.peerActors) out.push({ id, actor: a, tile: actorTileAt(a, now) });
    return out;
  }
  // Broadcast a hit to a specific peer + local feedback at their rendered
  // spot. Victim-authoritative, same trust posture as FarmRoom's PvP: I never
  // touch their hp, they apply it to themselves on the other end.
  function pvpHitPeer(g, targetId, dmg, type) {
    if (!targetId) return;
    presenceCtrlRef.current?.sendIntent?.({ t: 'pvp-hit', targetId, dmg, type, by: profile?.id });
    const a = g.peerActors.get(targetId);
    if (a) {
      const [px, py] = entityPxOf(a);
      g.floats = g.floats || [];
      g.floats.push({ x: px + TILE / 2, y: py + TILE - 26, text: '-' + dmg, start: performance.now(), ttl: 820 });
    }
  }
  // Kid-safe KO: heal to full + report the KO onto the circle's pvp_rank
  // (the DOWNED player reports it — same trust posture as FarmRoom's PvP).
  function faintRealmPlayer(g, winnerId) {
    if (!g.combat) return;
    g.combat.hp = g.combat.maxHp;
    flash('💫 Fainted! Recovering…');
    if (winnerId && circleId) recordPvpKo({ circleId, winnerId });
    syncBattleState(g);
  }

  const savePos = async (clearRealm = false) => {
    const g = G.current;
    if (!g) return;
    const prev = g.openworld || {};
    const positions = { ...(prev.realmPositionsById || {}) };
    positions[map.id] = { tile: [...g.player.tile], facing: g.player.facing };
    const payload = {
      ...prev,
      currentRealmId: clearRealm ? null : map.id,
      hqTile: hqTile || prev.hqTile || map.hqReturn,
      hqFacing: hqFacing || prev.hqFacing || 'South',
      realmPositionsById: positions,
      caps: prev.caps || {},
    };
    g.openworld = payload;
    try { await saveOpenworldState(profile, null, payload); } catch { /* keep local */ }
  };

  // ---------- boot ----------
  useEffect(() => {
    let live = true;
    (async () => {
      setReady(false);
      const [img, loaded, tables, effectsAll] = await Promise.all([
        loadImage(worldAssetUrl(map)),
        loadOpenworldState(profile, null).catch(() => ({ data: null })),
        loadMotionTables(),
        loadEffects().catch(() => ({})), // shared spell-VFX catalog (same one FarmRoom casts) — a realm's skill cast should look identical
      ]);
      const avatarSpec = hero?.spec || defaultFarmerSpec();
      const resources = tables ? await loadPlayerResources(avatarSpec) : null;
      if (!live) return;

      const saved = loaded?.data || {};
      const savedPos = saved.realmPositionsById?.[map.id];
      const spawn = savedPos?.tile || map.spawn || [30, 24];

      const reward = makeRewardSession({ profile, circleId });
      reward.bindCaps(saved.caps || {});
      await reward.ensureLoaded();
      rewardRef.current = reward;

      G.current = {
        map, img, tables, resources,
        heroOk: !!(tables && resources && Object.keys(resources).length),
        hasWeapon: !!resources?.weapon,
        openworld: { ...saved, currentRealmId: map.id, caps: saved.caps || {} },
        held: new Set(), stick: null, cam: { camX: 0, camY: 0, z: 1 },
        player: { tile: [...spawn], from: [...spawn], moveT: 1, moveStart: 0, facing: savedPos?.facing || 'South', mounted: false, oneShot: null, oneShotStart: 0 },
        peerActors: new Map(), floats: [], combat: null,
        effectsAll: effectsAll || {}, spellFx: [], // the same shared spell-VFX system FarmRoom's doSkill casts
      };
      if (map.pvp) { ensureRealmCombat(G.current); syncBattleState(G.current); }

      // build the module (the realm's habit loop)
      const api = makeApi(G.current, reward);
      const module = getRealmModule(map.id)(api);
      module._api = api;
      modRef.current = module;

      setUsingHero(!!hero?.spec && G.current.heroOk);
      setHasMount(!!resources?.mount);
      setMounted(false);
      setReady(true);
      savePos(false);
      if (import.meta.env.DEV) window.__realm = G;
    })();
    return () => {
      live = false;
      Object.values(timers.current).forEach((t) => window.clearTimeout(t));
      modRef.current?.cleanup?.();
      rewardRef.current?.flush?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.id, profile?.id, hero?.spec, circleId]);

  // ---------- live circle presence (per-realm instance) ----------
  // Reuses FarmRoom's exact joinFarmPresence module — it's already generic
  // over the channel topic, so a realm-scoped topic (`<circle>::realm::<id>`)
  // is enough to give each of the 5 realms its own shared instance without
  // touching farm-presence.js at all: whoever opens the same realm in the same
  // circle sees each other; someone in Kitchen never sees someone in Bloomwall.
  useEffect(() => {
    if (!ready || !circleId || !profile || profile.guest) return undefined;
    const g = G.current; if (!g) return undefined;
    let closed = false;
    const topic = `${circleId}::realm::${map.id}`;

    const applyIntent = (intent) => {
      if (closed) return;
      if (intent?.t === 'pvp-hit') {
        // Victim-authoritative, same trust posture + gate as FarmRoom's PvP
        // (see that file's history): the attacker already verified the zone/
        // target before sending, so we don't re-check anything here — just
        // apply it if it's aimed at me.
        if (String(intent.targetId) !== String(profile.id)) return;
        const gg = G.current; if (!gg) return;
        const raw = Number(intent.dmg) || 0;
        const dmg = Math.max(0, Math.round(raw * resistMul(realPathId(hero), intent.type)));
        ensureRealmCombat(gg);
        if (dmg > 0) gg.combat.hp = Math.max(0, gg.combat.hp - dmg);
        const [mpx, mpy] = entityPxOf(gg.player);
        gg.floats = gg.floats || [];
        gg.floats.push({ x: mpx + TILE / 2, y: mpy + TILE - 26, text: '-' + dmg, start: performance.now(), ttl: 820 });
        flash(`💥 took ${dmg} · hp ${gg.combat.hp}/${gg.combat.maxHp}`);
        if (gg.combat.hp <= 0) faintRealmPlayer(gg, intent.by); else syncBattleState(gg);
      }
    };

    const applyPeers = (peers) => {
      if (closed || !G.current) return;
      const now = performance.now();
      const live = new Set();
      for (const peer of peers || []) {
        const tile = Array.isArray(peer.tile) ? peer.tile : null;
        if (!tile) continue;
        const id = String(peer.id || '');
        if (!id || id === String(profile.id)) continue;
        live.add(id);
        let actor = g.peerActors.get(id);
        if (!actor) {
          actor = { id, name: peer.name || 'Farmer', tile, from: [...tile], moveT: 1, moveStart: now, facing: peer.facing || 'South', speedMs: REMOTE_WALK_MS };
          g.peerActors.set(id, actor);
        } else {
          if (actor.tile[0] !== tile[0] || actor.tile[1] !== tile[1]) {
            actor.from = actorTileAt(actor, now); actor.tile = tile; actor.moveT = 0; actor.moveStart = now;
          }
          actor.name = peer.name || actor.name;
          actor.facing = peer.facing || actor.facing;
        }
      }
      for (const id of [...g.peerActors.keys()]) if (!live.has(id)) g.peerActors.delete(id);
    };

    const ctrl = joinFarmPresence({
      circleId: topic, profile, hero,
      onPeers: applyPeers,
      onIntent: applyIntent,
      onSnapshot: () => {},
      onStateRequest: () => {},
      onKicked: () => {},
    });
    presenceCtrlRef.current = ctrl;

    // Lightweight position heartbeat — realms don't need the farm's
    // instant-on-change optimization; a steady 500ms tick keeps peers'
    // rendered positions close enough for a habit-loop realm's pace.
    const hb = window.setInterval(() => {
      const gg = G.current; if (!gg) return;
      ctrl.update({ name: profile.displayName || 'Farmer', tile: [...gg.player.tile], facing: gg.player.facing });
    }, 500);

    return () => {
      closed = true;
      window.clearInterval(hb);
      ctrl.leave();
      if (presenceCtrlRef.current === ctrl) presenceCtrlRef.current = null;
      G.current?.peerActors?.clear?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, map.id, circleId, profile?.id, profile?.guest]);

  // the api handed to modules — the ONLY surface a realm loop touches
  function makeApi(g, reward) {
    return {
      realm: map, accountType, TILE, W, H, WORLD_W, WORLD_H,
      now: () => performance.now(),
      player: () => g.player,
      flash,
      bumpHud: () => setHudTick((n) => (n + 1) & 0xffff),
      grant: (rewards, opts) => reward.grant(map.id, rewards, opts),
      getMeter: () => reward.getMeter(map.id),
      getTotals: () => reward.getTotals(),
      getBoard: () => reward.getBoard(),
      setBoardBest: (n) => reward.setBoardBest(n),
      getCity: () => reward.getCity(),
      setCity: (p) => reward.setCity(p),
      loopsToday: () => reward.loopsToday(map.id),
      exit: () => exitRef.current?.(),
      // the player's real combat identity (class path + level + equipped skill),
      // derived the same way FarmRoom does (path is inferred from the weapon
      // spec — there's no separate class picker yet). Lets a realm's "hero
      // skill" action use the player's actual Skill Forge skill instead of a
      // bespoke hardcoded number.
      heroCombat: () => {
        const path = realPathId(hero);
        const level = card.level || 1;
        // All 3 real equipped skill slots (name/fx/manaCost/cdMs from the shared
        // SKILL_SLOTS, name/effect from the hero's Skill Forge tier) + each
        // slot's path-scaled magic power. `skill`/`skillPower` (slot 0) stay for
        // back-compat with arena.js; `skills` is the full kit the ActionCluster
        // controller renders (v1.5 §18.4).
        const slots = battleSkillsFor(hero?.spec?.skills, path, level);
        const skills = slots.map((sk) => ({ ...sk, power: pathSkillPower(sk, path, level) }));
        return {
          path, level, skills, skill: skills[0], skillPower: skills[0].power,
          physPower: pathPhysPower(path, level), mp: card.mp, maxMp: card.maxMp,
        };
      },
      // give the module a way to face the player toward a tile (juice)
      facePlayer: (tx, ty) => {
        const p = g.player; const dx = tx - p.tile[0], dy = ty - p.tile[1];
        if (Math.abs(dx) > Math.abs(dy)) p.facing = dx >= 0 ? 'East' : 'West';
        else if (dy !== 0) p.facing = dy > 0 ? 'South' : 'North';
        p.oneShot = 'Get'; p.oneShotStart = performance.now();
      },
      // The real character-animation contract every realm's controller should
      // use for its combat actions (matches FarmRoom's real farm combat):
      //   'strike' -> Swing/Attack/Pierce/Shoot (physical — sword/weapon)
      //   'cast'   -> Spell (magic skill — Bloomwall's Hero Skill, Arena's Burst, …)
      //   'pickup' -> Get (gather/serve/collect — same as facePlayer's default)
      // Call AFTER facePlayer (or directly) so facing is already set for the pose.
      playMotion: (kind) => {
        const p = g.player;
        const motion = kind === 'strike' ? attackMotionBase(g)
          : kind === 'cast' ? castMotionBase(g)
          : 'Get';
        p.oneShot = motion; p.oneShotStart = performance.now();
      },
      // Play a skill's real spell VFX (the same shared effect catalog/animation
      // FarmRoom's doSkill casts — a realm's cast should look identical, not
      // just play the body-swing pose). `fx` = the skill's effect id; `tile` =
      // where the effect anchors (target tile for a burst, the caster's own
      // tile for a self-heal).
      castEffect: (fx, tile) => {
        if (fx == null || !tile) return;
        const t = [Math.round(tile[0]), Math.round(tile[1])];
        spawnEffect(g.spellFx, g.effectsAll, fx, t, (eff) => loadEffectImage(effectSheetUrl(eff)));
      },
      // Live circle-mates sharing this realm right now — {id, name, tile}. Only
      // meaningful in realms that opt into PvP (Arena); other realms still get
      // the list (for co-op flavor) but nothing calls pvpHit there.
      peers: () => peersInRealm(g).map(({ id, actor, tile }) => ({ id, name: actor.name, tile })),
      // Send a PvP hit at a peer (victim-authoritative — see pvpHitPeer above).
      pvpHit: (targetId, dmg, type = 'phys') => pvpHitPeer(g, targetId, dmg, type),
    };
  }

  // ---------- render + input loop ----------
  useEffect(() => {
    if (!ready) return undefined;
    const canvas = canvasRef.current, wrap = wrapRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !wrap || !ctx) return undefined;
    let raf = 0, lastNow = performance.now();

    const resize = () => {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const r = wrap.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(r.width * dpr));
      canvas.height = Math.max(1, Math.floor(r.height * dpr));
      canvas.style.width = r.width + 'px'; canvas.style.height = r.height + 'px';
      const g = G.current; if (g) { g.viewportW = canvas.width; g.viewportH = canvas.height; g.dpr = dpr; }
    };
    resize();
    window.addEventListener('resize', resize);

    const playerMotion = (g) => {
      const p = g.player;
      if (p.mounted && g.resources?.mount) return 'Riding' + p.facing;
      if (p.moveT < 1) return (g.hasWeapon ? 'WeaponWalk' : 'NormalWalk') + p.facing;
      return (g.hasWeapon ? 'WeaponStandBy' : 'NormalStandBy') + p.facing;
    };
    const drawPlayer = (g, ctx2, now, footX, footY) => {
      const p = g.player;
      if (g.heroOk) {
        // Emotes (Victory, Smile, …) are bare/non-directional motions — same
        // lookup rule FarmRoom's oneShot uses — everything else gets a facing suffix.
        const oneShotMotion = p.oneShot ? (EMOTES.includes(p.oneShot) ? p.oneShot : p.oneShot + p.facing) : null;
        const hasOne = !!oneShotMotion && stepCount(g.tables, oneShotMotion) > 0;
        const motion = hasOne ? oneShotMotion : playerMotion(g);
        const n = stepCount(g.tables, motion);
        const s = hasOne ? Math.min(n - 1, Math.floor((now - p.oneShotStart) / 160))
          : p.moveT < 1 ? Math.floor(p.moveT * n) % n : Math.floor(now / 340) % n;
        if (hasOne && (now - p.oneShotStart) / 160 >= n) p.oneShot = null;
        const list = resolveStep(g.tables, g.resources, motion, s);
        const bb = list.length ? drawListBBox([list]) : null;
        if (bb) { paintStep(ctx2, list, { x: footX - bb.cx, y: footY - bb.y1 }, 1); return; }
      }
      drawPlaceholderFarmer(ctx2, footX, footY, FACE_WORD[p.facing]);
    };
    const dirFromHeld = (g) => {
      for (const k of g.held) if (DIR_BY_KEY[k]) return DIR_BY_KEY[k];
      if (g.stick) {
        if (Math.abs(g.stick.x) > Math.abs(g.stick.y)) return g.stick.x > 0 ? 'East' : 'West';
        if (Math.abs(g.stick.y) > 0.18) return g.stick.y > 0 ? 'South' : 'North';
      }
      return null;
    };
    const step = (g, now) => {
      const mod = modRef.current;
      if (mod && mod.movement === false) return; // board/menu realms freeze walking
      const p = g.player;
      const wm = p.walkMs || WALK_MS; // modules can set p.walkMs for a Dash burst
      if (p.moveT < 1) { p.moveT = Math.min(1, (now - p.moveStart) / wm); if (p.moveT >= 1) { p.from = [...p.tile]; savePosDebounced(); } return; }
      const dir = dirFromHeld(g); if (!dir) return;
      p.facing = dir;
      const [dx, dy] = DELTA[dir];
      const nx = p.tile[0] + dx, ny = p.tile[1] + dy;
      if (blockedAt(nx, ny)) return;
      p.from = [...p.tile]; p.tile = [nx, ny]; p.moveStart = now; p.moveT = 0;
    };

    let posTimer = 0;
    const savePosDebounced = () => { window.clearTimeout(posTimer); posTimer = window.setTimeout(() => savePos(false), 500); };

    // Circle-mates sharing this realm — placeholder farmer + nameplate (no
    // per-peer hero-art loading yet, same honest fallback FarmRoom uses when a
    // hero isn't loaded). Drawn UNDER the local player so the local player
    // always reads as "you" when standing on the same tile.
    const drawPeer = (ctx2, now, a) => {
      const [tx, ty] = actorTileAt(a, now);
      const footX = tx * TILE + TILE / 2, footY = ty * TILE + TILE;
      ctx2.save();
      ctx2.fillStyle = 'rgba(0,0,0,.22)';
      ctx2.beginPath(); ctx2.ellipse(footX, footY - 8, 15, 6, 0, 0, Math.PI * 2); ctx2.fill();
      ctx2.restore();
      drawPlaceholderFarmer(ctx2, footX, footY, FACE_WORD[a.facing || 'South']);
      ctx2.save();
      ctx2.font = '700 11px system-ui'; ctx2.textAlign = 'center';
      ctx2.strokeStyle = 'rgba(0,0,0,.75)'; ctx2.lineWidth = 3;
      ctx2.strokeText(a.name || 'Farmer', footX, footY - TILE * 1.35);
      ctx2.fillStyle = '#fff'; ctx2.fillText(a.name || 'Farmer', footX, footY - TILE * 1.35);
      ctx2.restore();
    };
    // Floating "-N" damage text from a received pvp-hit (see the presence
    // effect's applyIntent below), world-space so it tracks the player.
    const drawFloats = (ctx2, now) => {
      const g = G.current; if (!g?.floats?.length) return;
      ctx2.save(); ctx2.font = '700 13px system-ui'; ctx2.textAlign = 'center';
      for (let i = g.floats.length - 1; i >= 0; i--) {
        const f = g.floats[i]; const life = now - f.start;
        if (life > f.ttl) { g.floats.splice(i, 1); continue; }
        const y = f.y - life / 30; const alpha = Math.max(0, 1 - life / f.ttl);
        ctx2.globalAlpha = alpha;
        ctx2.strokeStyle = 'rgba(0,0,0,.75)'; ctx2.lineWidth = 3; ctx2.strokeText(f.text, f.x, y);
        ctx2.fillStyle = '#ff6a6a'; ctx2.fillText(f.text, f.x, y);
      }
      ctx2.restore();
    };

    const draw = (now) => {
      const g = G.current; if (!g) { raf = requestAnimationFrame(draw); return; }
      const dt = Math.min(64, now - lastNow); lastNow = now;
      step(g, now);
      modRef.current?.tick?.(dt, now);
      const dpr = g.dpr || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const vw = canvas.width / dpr, vh = canvas.height / dpr;
      ctx.clearRect(0, 0, vw, vh);
      const [px, py] = entityPxOf(g.player);
      const zoom = Math.max(vw / WORLD_W, vh / WORLD_H, (map.camZoom ?? 0.42) * camZoomMulRef.current);
      const camX = Math.max(0, Math.min(WORLD_W - vw / zoom, px - vw / zoom / 2 + TILE / 2));
      const camY = Math.max(0, Math.min(WORLD_H - vh / zoom, py - vh / zoom / 2 + TILE / 2));
      g.cam = { camX, camY, z: zoom };

      ctx.save();
      ctx.scale(zoom, zoom);
      ctx.translate(-camX, -camY);
      if (g.img) ctx.drawImage(g.img, 0, 0, WORLD_W, WORLD_H);
      else { ctx.fillStyle = '#8ec56c'; ctx.fillRect(0, 0, WORLD_W, WORLD_H); }
      // module world-space overlay UNDER the player (pads, path, stations)
      modRef.current?.drawUnder?.(ctx, now);
      if (g.peerActors?.size) for (const a of g.peerActors.values()) drawPeer(ctx, now, a);
      // shadow + player
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      ctx.beginPath(); ctx.ellipse(px + TILE / 2, py + TILE - 8, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
      if (modRef.current?.movement !== false) drawPlayer(g, ctx, now, px + TILE / 2, py + TILE);
      // module world-space overlay OVER the player (enemies, popups)
      modRef.current?.drawOver?.(ctx, now);
      if (g.spellFx?.length) g.spellFx = g.spellFx.filter((f) => drawEffect(ctx, f, now, TILE));
      drawFloats(ctx, now);
      ctx.restore();

      // reflect time for cooldown rings ~10fps
      if (!draw._t || now - draw._t > 90) { draw._t = now; setNowMs(now); }
      raf = requestAnimationFrame(draw);
    };

    const down = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const g = G.current; if (!g) return;
      if (DIR_BY_KEY[k]) { g.held.add(k); e.preventDefault(); }
      else if (k === 'Escape') exit();
      // Desktop shortcuts for the real ActionCluster (matches FarmRoom's battle
      // keys): Space = basic attack, 1/2/3 = the 3 equipped skill slots.
      else if (k === ' ') { e.preventDefault(); modRef.current?.onAction?.('attack'); }
      else if (k === '1' || k === '2' || k === '3') { modRef.current?.onAction?.('skill:' + (Number(k) - 1)); }
    };
    const up = (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; G.current?.held.delete(k); };

    // pointer: a TAP (small move) hits the module; a DRAG is the joystick
    let ptr = null, moved = false;
    const toTile = (e) => {
      const g = G.current, rect = canvas.getBoundingClientRect(), z = g.cam.z || 1;
      const wx = (e.clientX - rect.left) / z + g.cam.camX;
      const wy = (e.clientY - rect.top) / z + g.cam.camY;
      return [Math.floor(wx / TILE), Math.floor(wy / TILE)];
    };
    const onPointerDown = (e) => {
      if (e.button != null && e.button !== 0) return;
      // Audio may only start from a gesture; switch the bed to this realm's theme.
      sfx.arm(); ambient.setRealm(map.id); ambient.start();
      ptr = { id: e.pointerId, x0: e.clientX, y0: e.clientY }; moved = false;
      try { canvas.setPointerCapture(e.pointerId); } catch {}
    };
    const onPointerMove = (e) => {
      if (!ptr || e.pointerId !== ptr.id) return;
      const dx = e.clientX - ptr.x0, dy = e.clientY - ptr.y0, dist = Math.hypot(dx, dy);
      if (dist > 12) moved = true;
      const g = G.current; if (!g) return;
      if (moved && modRef.current?.movement !== false) {
        const mag = Math.min(1, dist / 66);
        g.stick = { x: (dx / dist) * mag, y: (dy / dist) * mag };
      }
    };
    const onPointerUp = (e) => {
      if (!ptr || e.pointerId !== ptr.id) return;
      const g = G.current;
      if (!moved && g) { const [tx, ty] = toTile(e); modRef.current?.onTapWorld?.(tx, ty); }
      if (g) g.stick = null;
      ptr = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      window.clearTimeout(posTimer);
      savePos(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, map.id]);

  const exit = () => {
    // persist caps back into personal blob before leaving
    const g = G.current;
    if (g && rewardRef.current) g.openworld = { ...g.openworld, caps: rewardRef.current.getCircle && g.openworld.caps };
    rewardRef.current?.flush?.();
    savePos(true).finally(() => onExit?.(map.hqReturn));
  };
  // Mount + emote — the SAME cosmetic actions the farm's cluster has, always
  // present in the real ActionCluster (not something each realm module has to
  // ask for). Mount toggles the existing 'Riding' motion (playerMotion() above
  // already supports it); emote plays a bare, non-directional oneShot.
  const toggleMount = () => {
    const g = G.current; if (!g) return;
    g.player.mounted = !g.player.mounted;
    setMounted(g.player.mounted);
  };
  const doEmote = (name) => {
    const g = G.current; if (!g) return;
    const p = g.player; if (p.oneShot) return;
    p.oneShot = name; p.oneShotStart = performance.now();
  };

  exitRef.current = exit;
  const mod = modRef.current;
  const controller = ready && mod ? mod.controller() : { primary: null, ring: [] };
  const hud = ready && mod ? mod.hud() : {};
  const Overlay = mod?.Overlay || null;

  return (
    <RealmShell
      card={displayCard}
      realmName={map.name}
      realmColor={map.color}
      shortName={map.shortName}
      theme={map.theme}
      objective={hud.objective}
      meter={hud.meter}
      controller={controller}
      onAction={(id) => modRef.current?.onAction?.(id)}
      onExit={exit}
      now={nowMs}
      heroNote={!usingHero ? 'Placeholder farmer — build your hero in Kingdom Heroes.' : ''}
      capsNote={ready ? hud.caps : ''}
      camZoom={camZoomMul}
      onCamZoom={setCamZoom}
      hasMount={hasMount}
      mounted={mounted}
      onToggleMount={toggleMount}
      onEmote={doEmote}
    >
      <canvas ref={canvasRef} tabIndex={0} />
      <div className="room-canvas-wrap" ref={wrapRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      {!ready && <div className="room-loading">Opening {map.name}…</div>}
      {toast && <div className="toasts"><div className="toast">{toast}</div></div>}
      {ready && Overlay && <Overlay mod={modRef.current} api={modRef.current._api} tick={nowMs} />}
    </RealmShell>
  );
}
