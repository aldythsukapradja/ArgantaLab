// Canvas-2D farm room — the SAME rendering engine as Kingdom Heroes' arena
// (TestRoom), so the farmer is the player's real composited Heroes character.
// Tile-step movement, nipplejs + WASD, camera-follow. Falls back to a placeholder
// farmer sprite if the Kingdom art host is unreachable.
import { useEffect, useMemo, useRef, useState } from 'react';
import nipplejs from 'nipplejs';
import { FarmLogic } from './farm-logic.js';
import { buildFarmMap, drawAnimalSprite, drawKinSprite, drawMountPlaceholder, drawPlot, drawPlaceholderFarmer, FIELD, PENS, ARENA, ARENA_GATE_X, ARENA_WALL_Y, CASTLE, SPAWN, ZONES_ANNOT, HARVEST_NODES, inArena, hotspotAt, TILE, W, H, WORLD_W, WORLD_H } from './farm-map.js';
import { FarmMechanics } from './farm-mechanics.js';
import { HotspotPanels } from '../ui/HotspotPanels.jsx';
import {
  makeMonster, resolveMelee, resolveSkillSingle, resolveSkillAll, applyHeal, damageMonster,
  tickMonsterState, monsterExpired, spawnEffect, drawEffect, battleSkillsFor,
  SKILL_SLOTS, MELEE_DAMAGE, MONSTER_WALK_MS, MONSTER_MAX_HP, PLAYER_MAX_HP, pathMaxHp, pathForWeapon, canAffordSkill,
  monsterOf, outgoingDamage, rollDrops, SPAWN_TUNING, pathSkillPower, pathPower, armorDef,
  MONSTER_AGGRO_RANGE, MONSTER_ATTACK_WINDUP_MS, MONSTER_ATTACK_RECOVER_MS, MONSTER_ATTACK_COOLDOWN_MS, MONSTER_FAINT_MS,
} from '@arganta/combat';
import { loadFarmArtOverrides } from './farm-art-runtime.js';
import { creatureFrame } from './creature-sprites.js';
import { loadBundledArt } from './farm-art-bundled.js';
import { loadAcquiredKins } from './arganta-kin.js';
import { hasActualKinArt } from './kin-sprite-image.jsx';
import { joinFarmPresence } from './farm-presence.js';
import { loadMotionTables, loadPlayerResources } from '../net/hero.js';
import { defaultFarmerSpec } from '../net/characterRegistry.js';
import { resolveStep, paintStep, stepCount, drawListBBox } from '../engine/compositor.js';
import { effects as loadEffects, effectSheetUrl, loadImage as loadEffectImage } from '../engine/data.js';
import { Hud } from '../ui/Hud.jsx';
import { Panels } from '../ui/Panels.jsx';
import { TileFan } from '../ui/TileFan.jsx';
import { sfx } from '../audio/sfx.js';
import { ambient } from '../audio/ambient.js';
import { CROPS, cropIsRipe } from '../data/crops.js';
import { SPECIES, animalGoodReady } from '../data/livestock.js';

const DIR_BY_KEY = { ArrowUp: 'North', w: 'North', ArrowDown: 'South', s: 'South', ArrowLeft: 'West', a: 'West', ArrowRight: 'East', d: 'East' };
const DELTA = { North: [0, -1], South: [0, 1], East: [1, 0], West: [-1, 0] };
const FACE_WORD = { North: 'up', South: 'down', East: 'right', West: 'left' };
const WALK_MS = 460;        // matches Kingdom Heroes' walk cadence (1 tile / 460ms)
const REMOTE_WALK_MS = 460;
const ANIMAL_VISUAL_COUNT = 5;
const DIRS = [['East', 1, 0], ['West', -1, 0], ['South', 0, 1], ['North', 0, -1]];
const KIN_STARTS = [[7, 12], [13, 16], [18, 11], [23, 14], [28, 10], [9, 18], [18, 19], [27, 18], [32, 13], [12, 7], [21, 7], [30, 7]];

function blockedAt(g, tx, ty) {
  return tx < 1 || ty < 1 || tx >= W - 1 || ty >= H - 1 || g.blocked.has(tx + ',' + ty);
}

function borderAt(tx, ty) {
  return tx < 1 || ty < 1 || tx >= W - 1 || ty >= H - 1;
}

function inField(tx, ty) {
  return tx >= FIELD.x0 && tx <= FIELD.x1 && ty >= FIELD.y0 && ty <= FIELD.y1;
}

// Is a live monster on (or moving through) this tile? Used for BODY-BLOCKING —
// the player can't overlap a monster (checks the tile AND a mid-step `from` so
// you can't slip through one during its walk). `self` excludes a monster from its
// own check (monster-vs-monster movement).
function monsterAt(g, tx, ty, self = null) {
  return g.monsters.some((o) => o !== self && o.state !== 'die'
    && ((o.tile[0] === tx && o.tile[1] === ty)
      || (o.from && o.moveT < 1 && o.from[0] === tx && o.from[1] === ty)));
}
const chebyshev = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
function faceToward(from, to) {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 'East' : 'West';
  return dy >= 0 ? 'South' : 'North';
}

const ARENA_MONSTER_COUNT = 5; // how many roam the arena at once
// on-map shop building id → unified Shop sub-tab (tapping a shop deep-links there).
const SHOP_TAB_FOR = { seed: 'seeds', general: 'general', smith: 'forge', animal: 'animals', cosmetic: 'cosmetics', market: 'sell' };

// Deterministic per-id seed (FNV-1a over the whole string) so every actor gets a
// distinct RNG stream even when ids share a length (li_cow_0 … li_cow_4).
function hashId(id) {
  let h = 2166136261 >>> 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return (h || 1) >>> 0;
}

function nearestOpenNeighbor(g, center, from = center) {
  const options = [
    [center[0] + 1, center[1]], [center[0] - 1, center[1]],
    [center[0], center[1] + 1], [center[0], center[1] - 1],
    [center[0] + 1, center[1] + 1], [center[0] - 1, center[1] + 1],
    [center[0] + 1, center[1] - 1], [center[0] - 1, center[1] - 1],
  ].filter(([tx, ty]) => !blockedAt(g, tx, ty));
  options.sort((a, b) => (
    Math.abs(a[0] - from[0]) + Math.abs(a[1] - from[1])
  ) - (
    Math.abs(b[0] - from[0]) + Math.abs(b[1] - from[1])
  ));
  return options[0] || null;
}

function sameTile(a, b) {
  return !!a && !!b && Number(a[0]) === Number(b[0]) && Number(a[1]) === Number(b[1]);
}

function readTile(value) {
  if (Array.isArray(value) && value.length >= 2) {
    const x = Number(value[0]), y = Number(value[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
  }
  if (value && typeof value === 'object') {
    const x = Number(value.x), y = Number(value.y);
    return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
  }
  return null;
}

function actorTileAt(e, now = performance.now()) {
  const t = e.moveT ?? 1;
  if (e.from && t < 1) {
    const p = Math.max(0, Math.min(1, (now - e.moveStart) / (e.speedMs || REMOTE_WALK_MS)));
    return [
      e.from[0] + (e.tile[0] - e.from[0]) * p,
      e.from[1] + (e.tile[1] - e.from[1]) * p,
    ];
  }
  return [...(e.tile || [12, 12])];
}

function heroSpecKey(spec) {
  if (!spec) return '';
  try { return JSON.stringify(spec); } catch { return String(spec); }
}

function presenceProfileId(profile) {
  return String(profile?.id || '');
}

function presenceHostId(g, profile) {
  const ids = [presenceProfileId(profile), ...g.peerActors.keys()].filter(Boolean).sort();
  return ids[0] || '';
}

// Ownership model: mounts and KINS are OWNER-simulated — every player broadcasts
// their own, tagged with their display name so peers can label whose Kin is whose.
// Animals (cows/sheep/chickens) are shared world critters simulated by ONE host
// (lowest user id in presence) to avoid duplicate ghost herds.
function worldActorSnapshots(g, isHost, ownerName) {
  const out = [];
  for (const e of g.actors.values()) {
    if (e.kind === 'mount') {
      out.push({
        id: e.id,
        kind: 'mount',
        tile: [...(e.tile || [12, 12])],
        facing: e.facing || 'South',
        mode: e.mode || 'wander',
        hidden: !!e.hidden,
      });
    } else if (e.kind === 'kin') {
      out.push({
        id: e.id,
        kind: 'kin',
        owner: ownerName || '',
        tile: [...(e.tile || [12, 12])],
        facing: e.facing || 'South',
        kin: e.kin || null,
      });
    } else if (isHost && e.kind === 'animal') {
      out.push({
        id: e.id,
        kind: 'animal',
        species: e.species,
        name: e.name || e.species,
        tile: [...(e.tile || [12, 12])],
        facing: e.facing || 'South',
      });
    }
  }
  // Arena monsters are shared world critters simulated by the SAME host that owns
  // the animals — so every circle member fights the same monsters (positions + hp
  // + state authoritative from the host, like the herd).
  if (isHost) {
    for (const m of g.monsters) {
      out.push({
        id: m.id,
        kind: 'monster',
        mkind: m.kind || 'slime',
        tile: [...(m.tile || [0, 0])],
        facing: m.facing || 'South',
        hp: m.hp, maxHp: m.maxHp, state: m.state || 'stand',
      });
    }
  }
  return out;
}

// Compact profile-card stats broadcast on presence so peers can render each
// other's full UnitCard in the live popup (see UnitCard.cardFromPeer).
function presenceCardFrom(snap) {
  if (!snap) return null;
  return {
    level: snap.level, path: snap.path, pathName: snap.pathName, pathIcon: snap.pathIcon,
    title: snap.title, xp: snap.xp, xpPct: snap.xpPct, xpCur: snap.xpCur, xpReq: snap.xpReq,
    maxHp: snap.maxHp, stamina: snap.stamina, maxStamina: snap.maxStamina,
  };
}

export default function FarmRoom({ profile, hero, circleId = null }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const stickRef = useRef(null);
  const G = useRef(null);
  const logicRef = useRef(null);
  // Presence controller lives in its OWN ref, decoupled from G.current. The init
  // effect rebuilds G.current whenever profile fields change (e.g. the hero loads
  // and updates diamonds/xp), which used to orphan a G.current.presenceCtrl — the
  // channel stayed joined but publishPresence saw null and never broadcast, so
  // peers saw nothing move. Keeping it here means a G.current rebuild can't sever
  // the live channel from the game loop.
  const presenceCtrlRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [snap, setSnap] = useState(null);
  const [panel, setPanel] = useState(null);
  const [hotspot, setHotspot] = useState(null);   // shop/castle/dungeon/dock popup
  const [tileFan, setTileFan] = useState(null);   // radial tile action menu (plant/harvest/sickle)
  const [shopTab, setShopTab] = useState('seeds'); // unified Shop initial sub-tab
  // Harvest-juice pop for actions taken from the tile fan (render scope, so it
  // can't reach the effect-local floatPop — pushes straight to G.current.floats).
  const popFanResult = (r) => {
    const g = G.current; if (!g || !r) return;
    const list = Array.isArray(r.harvested) ? r.harvested : (r.emoji ? [{ tx: r.tx, ty: r.ty, emoji: r.emoji }] : []);
    for (const h of list) g.floats.push({ x: h.tx * TILE + TILE / 2, y: h.ty * TILE + TILE - 22, text: '+' + (h.emoji || '🌾'), start: performance.now(), ttl: 950 });
  };
  const [mechSnap, setMechSnap] = useState(null); // mechanics store snapshot (materials/tools/house)
  const mechRef = useRef(null);
  const [showLegend, setShowLegend] = useState(true); // labelled-overlay legend
  // Developer mode — OPERATOR ONLY. Shows the red/green collision overlay + map
  // key. Off for everyone by default; a non-operator can never turn it on (the
  // toggle only appears for operators, and the draw is gated on snap.operator).
  const [devMode, setDevMode] = useState(() => { try { return localStorage.getItem('lashira_dev_mode') === '1'; } catch { return false; } });
  const toggleDev = () => setDevMode((v) => { const nv = !v; try { localStorage.setItem('lashira_dev_mode', nv ? '1' : '0'); } catch { /* ignore */ } return nv; });
  const devOn = !!(snap?.operator && devMode); // effective dev overlay (operator-gated)
  useEffect(() => { if (G.current) G.current.devOverlay = devOn; }, [devOn]);
  const [castleSkin, setCastleSkin] = useState(() => (typeof localStorage !== 'undefined' && localStorage.getItem('lashira_castle_skin')) || 'storybook');
  useEffect(() => { if (G.current) G.current.castleSkin = castleSkin; try { localStorage.setItem('lashira_castle_skin', castleSkin); } catch {} }, [castleSkin]);
  // Periodically clear legacy/orphaned plot records so nothing lingers forever.
  useEffect(() => { const t = window.setInterval(() => logicRef.current?.sweepStalePlots?.(), 30000); return () => window.clearInterval(t); }, []);
  const [zoom, setZoom] = useState(1); // default 1x on every screen size; adjustable in Settings
  // Walk speed multiplier (1x = Kingdom cadence, up to 3x). Persisted per browser.
  const [speed, setSpeed] = useState(() => {
    const s = Number(typeof localStorage !== 'undefined' && localStorage.getItem('lashira_speed'));
    return Number.isFinite(s) && s >= 1 && s <= 3 ? s : 1.5;
  });
  const [usingHero, setUsingHero] = useState(false);
  const [presence, setPresence] = useState({ count: 0, names: [], peers: [] });
  const [kickedBy, setKickedBy] = useState(null); // session singleton: newer login elsewhere
  const [daySplash, setDaySplash] = useState(null); // shared New Day banner (local sleep, peer intent, or adopted snapshot)
  const [battle, setBattle] = useState({ on: false, hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP }); // mirror of g.combat for the HUD
  const battleRef = useRef({ on: false, hp: PLAYER_MAX_HP });
  const lastDayEventRef = useRef(0);
  const splashTimerRef = useRef(0);
  const heroPresenceKey = heroSpecKey(hero?.spec);
  // Battle skills = shared behaviour (Bolt/Storm/Mend) + the hero's OWN spell
  // effects from their Kingdom character (Kingdom is the source of truth for fx).
  const battleSkills = useMemo(() => battleSkillsFor(hero?.spec?.skills), [heroPresenceKey]);
  const battleSkillsRef = useRef(battleSkills);
  useEffect(() => { battleSkillsRef.current = battleSkills; if (G.current) G.current.battleSkills = battleSkills; }, [battleSkills]);
  // Class path (warrior/rogue/poet/mage) → HP/MP curves. Derived from the hero's
  // weapon for now (defaults to warrior until a real class picker exists).
  useEffect(() => {
    const w = hero?.spec?.weapon;
    const weaponStr = typeof w === 'string' ? w : (w?.cat || w?.name || w?.id || '');
    logicRef.current?.setPath?.(pathForWeapon(weaponStr));
  }, [heroPresenceKey]);

  // ---------- init ----------
  useEffect(() => {
    let live = true;
    const logic = new FarmLogic(profile, circleId);
    logicRef.current = logic;
    if (import.meta.env.DEV) { window.__farm = logic; window.__G = G; window.__mech = mechRef; }

    (async () => {
      await logic.ready;
      logic.sweepStalePlots(); // clear legacy-stuck / orphaned (field-resize) plot records
      const [bundledArt, dbArt, acquiredKins, effectsAll] = await Promise.all([
        loadBundledArt(),
        loadFarmArtOverrides(),
        loadAcquiredKins(profile),
        loadEffects().catch(() => ({})), // Kingdom spell-effect catalog (shared fx)
      ]);
      // Layer priority: DB override > bundled sheet art > procedural placeholder.
      const art = { ...bundledArt, ...dbArt };
      const { canvas: bg, blocked } = buildFarmMap(art);
      // Avatar art: the player's real Kingdom hero when they have one, otherwise
      // the "default-farmer" preset Circle HQ publishes (the single source of
      // truth for the fallback look). Either way it composites through the same
      // engine; a genuine failure still drops to the procedural placeholder.
      const avatarSpec = hero?.spec || defaultFarmerSpec();
      let tables = null, resources = null, hasWeapon = false;
      if (avatarSpec) {
        tables = await loadMotionTables();
        if (tables) {
          resources = await loadPlayerResources(avatarSpec);
          hasWeapon = !!resources?.weapon;
        }
      }
      if (!live) return;
      const heroOk = !!(tables && resources && Object.keys(resources).length);
      setUsingHero(!!hero?.spec && heroOk); // HUD "your hero" copy = real hero only
      if (!profile?.guest) logic.setExternalKins(acquiredKins);
      // Carry live state across a rebuild (this effect re-runs when the hero
      // avatar loads): keep the player where they stand and preserve the peer
      // maps the presence effect populates, so a rebuild never wipes the farmer
      // back to spawn or drops everyone else out of view mid-session.
      const prev = G.current;
      // Fresh spawn = the castle courtyard (SPAWN); nudge to the nearest open tile
      // if that exact one is solid under the current castle skin.
      const spawnTile = (() => {
        const [sx, sy] = SPAWN;
        if (!blocked.has(sx + ',' + sy)) return [sx, sy];
        for (const [dx, dy] of [[0, 1], [0, 2], [1, 0], [-1, 0], [1, 1], [-1, 1], [0, 3]]) {
          if (!blocked.has((sx + dx) + ',' + (sy + dy))) return [sx + dx, sy + dy];
        }
        return [sx, sy];
      })();
      G.current = {
        bg, blocked, tables, resources, hasWeapon, heroOk, art, acquiredKins,
        player: prev?.player || { tile: [...spawnTile], from: [...spawnTile], moveT: 1, moveStart: 0, facing: 'South', mounted: false, oneShot: null, oneShotStart: 0, turnHoldDir: null, turnHoldStart: 0 },
        held: prev?.held || new Set(), stick: prev?.stick || null, zoom, speed, viewportW: prev?.viewportW || 0, viewportH: prev?.viewportH || 0, dpr: prev?.dpr || 1,
        actors: prev?.actors || new Map(), peerActors: prev?.peerActors || new Map(), peerWorldActors: prev?.peerWorldActors || new Map(), pendingMountCall: false,
        lastPresenceSnapshot: '', lastPresenceAt: 0,
        // Battle mode (shared @arganta/combat). `on` tracks whether the player is
        // in the arena; monsters roam only there; combat HP is separate from farm
        // stamina (skills spend stamina). fx = transient hit sparks for feedback.
        combat: prev?.combat || { on: false, hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP, deadUntil: 0 },
        monsters: prev?.monsters || [], monsterSeed: 1, fx: prev?.fx || [], nextMonsterSpawn: 0,
        effectsAll: effectsAll || {}, spellFx: prev?.spellFx || [], battleSkills: battleSkillsRef.current,
        floats: prev?.floats || [], // floating "+1 🥬" harvest-juice pops
        cursorTile: prev?.cursorTile || null, // last tapped/acted-on tile (drives the white target box)
      };
      // Live sync is intent-based: FarmLogic emits a tiny granular intent for
      // every local mutation, and the channel fans it out. UI updates ride the
      // normal subscribe → snapshot path.
      logic.intentSink = (intent) => presenceCtrlRef.current?.sendIntent?.(intent);
      const unsub = logic.subscribe((next) => {
        setSnap(next);
        // New Day splash — fires on the SAME calendar change everywhere: the
        // sleeper, peers applying the day intent, and joiners adopting a
        // further-along snapshot. Makes the sync trigger visible on all screens.
        const ev = next.dayEvent;
        if (ev?.at && ev.at !== lastDayEventRef.current) {
          lastDayEventRef.current = ev.at;
          setDaySplash(ev);
          clearTimeout(splashTimerRef.current);
          splashTimerRef.current = setTimeout(() => setDaySplash(null), 2800);
        }
      });
      G.current._unsub = unsub;
      setReady(true);
    })();

    return () => {
      live = false;
      G.current?._unsub?.();
      logic.flushSave?.();
    };
  }, [profile?.id, profile?.displayName, profile?.guest, profile?.diamonds, profile?.xp, profile?.level, profile?.role, heroPresenceKey, circleId]);

  useEffect(() => { if (G.current) G.current.zoom = zoom; }, [zoom]);

  // Mechanics store (materials/tools/nodes/house) — decoupled from currency. See
  // docs/lashirabloom/HANDOFF-mechanics-vs-economy.md.
  useEffect(() => {
    const m = new FarmMechanics(profile?.id || 'guest', () => logicRef.current);
    mechRef.current = m;
    const unsub = m.subscribe(setMechSnap);
    return () => unsub();
  }, [profile?.id]);
  useEffect(() => {
    if (G.current) G.current.speed = speed;
    try { localStorage.setItem('lashira_speed', String(speed)); } catch { /* quota */ }
  }, [speed]);

  useEffect(() => {
    if (!ready) return undefined;
    const save = () => { logicRef.current?.flushSave?.(); };
    window.addEventListener('pagehide', save);
    window.addEventListener('beforeunload', save);
    return () => {
      window.removeEventListener('pagehide', save);
      window.removeEventListener('beforeunload', save);
    };
  }, [ready]);

  // ---------- live circle presence ----------
  useEffect(() => {
    if (!ready) return undefined;
    const g = G.current;
    if (!g) return undefined;

    presenceCtrlRef.current?.leave?.();
    presenceCtrlRef.current = null;
    g.peerActors.clear();
    g.peerWorldActors.clear();
    setPresence({ count: 0, names: [], peers: [] });

    if (!circleId || !profile || profile.guest) return undefined;

    let closed = false;
    // Peer's granular change → apply per-field (never re-emitted).
    const applyIntent = (intent) => {
      if (closed) return;
      // Combat intents are NOT farm state — handle them here, not in FarmLogic.
      if (intent?.t === 'mob-hit') {
        const g = G.current; if (!g) return;
        const hostSelf = !circleId || presenceHostId(g, profile) === presenceProfileId(profile);
        if (!hostSelf) return; // only the host owns authoritative monster hp
        const m = g.monsters.find((x) => x.id === intent.id && x.state !== 'die');
        if (!m) return;
        const res = damageMonster(m, Number(intent.dmg) || 0, performance.now());
        if (res.killed) presenceCtrlRef.current?.sendIntent?.({ t: 'mob-dead', id: m.id, by: intent.by, name: m.kind || 'a monster' });
        return;
      }
      if (intent?.t === 'mob-dead') {
        if (intent.by === presenceProfileId(profile)) rewardAndLoot(intent.name || 'a monster');
        return;
      }
      if (intent?.t === 'spell') { // a peer cast a skill — show its VFX here too
        const g = G.current; if (g) spawnSpellFx(g, intent.fx, intent.tile);
        return;
      }
      logicRef.current?.applyIntent?.(intent);
    };
    // Snapshot response → adopt only if the peer's rev is ahead of ours.
    const applySnapshot = (payload) => {
      if (closed || !payload?.data) return;
      logicRef.current?.applySnapshot?.(payload.data, payload.rev);
    };
    // A late joiner asked for the current farm — answer with ours.
    const answerStateRequest = () => {
      if (closed) return;
      const logic = logicRef.current;
      const ctrl = presenceCtrlRef.current;
      if (!logic || !ctrl) return;
      ctrl.sendSnapshot({ data: logic.serialize(), rev: logic.state?.rev || 0 });
    };
    // Newer login for this user elsewhere → this tab freezes and steps aside.
    const onKicked = () => {
      if (closed) return;
      logicRef.current?.freeze?.();
      presenceCtrlRef.current = null;
      setKickedBy(true);
    };
    const applyPeers = (peers) => {
      if (closed || !G.current) return;
      const now = performance.now();
      const live = new Set();
      const liveWorld = new Set();
      const names = [];
      const peerCards = []; // {id, name, card} for the live popup's UnitCards
      const rows = [];
      for (const peer of peers || []) {
        const tile = readTile(peer.tile);
        if (!tile) continue;
        const id = String(peer.id || '');
        if (!id || id === presenceProfileId(profile)) continue;
        rows.push({ id, peer, tile });
        live.add(id);
        names.push(peer.name || 'Farmer');
        peerCards.push({ id, name: peer.name || 'Farmer', card: peer.card || null });
        let actor = g.peerActors.get(id);
        if (!actor) {
          actor = {
            id,
            kind: 'remote',
            peer,
            name: peer.name || 'Farmer',
            tile,
            from: [...tile],
            moveT: 1,
            moveStart: now,
            facing: peer.facing || 'South',
            mounted: !!peer.mounted,
            speedMs: REMOTE_WALK_MS,
            resources: null,
            heroOk: false,
            hasWeapon: false,
            specKey: '',
            loading: null,
          };
          g.peerActors.set(id, actor);
        } else {
          const currentTile = actorTileAt(actor, now);
          if (!sameTile(actor.tile, tile)) {
            actor.from = currentTile;
            actor.tile = tile;
            actor.moveT = 0;
            actor.moveStart = now;
          }
          actor.peer = peer;
          actor.name = peer.name || actor.name || 'Farmer';
          actor.facing = peer.facing || actor.facing || 'South';
          actor.mounted = !!peer.mounted;
        }

        const key = heroSpecKey(peer.heroSpec);
        if (!key) {
          actor.specKey = '';
          actor.resources = null;
          actor.heroOk = false;
          actor.loading = null;
        } else if (actor.specKey !== key) {
          actor.specKey = key;
          actor.resources = null;
          actor.heroOk = false;
          const tablesReady = g.tables
            ? Promise.resolve(g.tables)
            : (g.tablesLoading ||= loadMotionTables().then((tables) => {
              g.tables = tables;
              return tables;
            }).catch(() => null));
          actor.loading = Promise.all([tablesReady, loadPlayerResources(peer.heroSpec)]).then(([tables, resources]) => {
            const current = G.current?.peerActors?.get(id);
            if (!current || current.specKey !== key) return;
            current.resources = resources;
            current.hasWeapon = !!resources?.weapon;
            current.heroOk = !!(tables && resources && Object.keys(resources).length);
          }).catch(() => {});
        }
      }

      const host = [presenceProfileId(profile), ...live].filter(Boolean).sort()[0] || '';
      for (const { id, peer } of rows) {
        for (const fa of peer.actors || []) {
          if (!fa || !fa.id) continue;
          const kind = fa.kind === 'animal' ? 'animal' : fa.kind === 'kin' ? 'kin' : fa.kind === 'mount' ? 'mount' : fa.kind === 'monster' ? 'monster' : null;
          if (!kind) continue;
          // Kins + mounts are OWNER-simulated (every peer's are shown, with an
          // owner tag); animals AND arena monsters come only from the elected host.
          if ((kind === 'animal' || kind === 'monster') && id !== host) continue;
          const tile = readTile(fa.tile);
          if (!tile) continue;
          const wid = id + ':' + fa.id;
          liveWorld.add(wid);
          let actor = g.peerWorldActors.get(wid);
          if (!actor) {
            actor = {
              id: wid,
              sourceId: fa.id,
              ownerId: id,
              owner: fa.owner || peer.name || '',
              kind,
              peerMount: kind === 'mount',
              tile,
              from: [...tile],
              moveT: 1,
              moveStart: now,
              speedMs: REMOTE_WALK_MS,
              facing: fa.facing || 'South',
              mode: fa.mode || 'wander',
              hidden: !!fa.hidden,
              kin: fa.kin || null,
              species: fa.species || null,
              name: fa.name || fa.species || null,
              mkind: fa.mkind || null,
              hp: fa.hp, maxHp: fa.maxHp, state: fa.state || 'stand', stateStart: 0, seed: hashId(wid),
            };
            g.peerWorldActors.set(wid, actor);
          } else {
            const currentTile = actorTileAt(actor, now);
            if (!sameTile(actor.tile, tile)) {
              actor.from = currentTile;
              actor.tile = tile;
              actor.moveT = 0;
              actor.moveStart = now;
            }
            actor.facing = fa.facing || actor.facing || 'South';
            actor.mode = fa.mode || actor.mode || 'wander';
            actor.hidden = !!fa.hidden;
            actor.kin = fa.kin || actor.kin || null;
            actor.species = fa.species || actor.species || null;
            actor.name = fa.name || actor.name || fa.species || null;
            actor.owner = fa.owner || peer.name || actor.owner || '';
            if (kind === 'monster') {
              actor.hp = fa.hp ?? actor.hp; actor.maxHp = fa.maxHp ?? actor.maxHp;
              actor.mkind = fa.mkind || actor.mkind;
              if (fa.state && fa.state !== actor.state) { actor.state = fa.state; if (fa.state === 'die') actor.stateStart = now; }
            }
          }
        }
      }
      for (const id of [...g.peerActors.keys()]) if (!live.has(id)) g.peerActors.delete(id);
      for (const id of [...g.peerWorldActors.keys()]) if (!liveWorld.has(id)) g.peerWorldActors.delete(id);
      setPresence({ count: names.length, names: names.slice(0, 4), peers: peerCards });
    };

    const ctrl = joinFarmPresence({
      circleId, profile, hero,
      onPeers: applyPeers,
      onIntent: applyIntent,
      onSnapshot: applySnapshot,
      onStateRequest: answerStateRequest,
      onKicked,
    });
    presenceCtrlRef.current = ctrl;
    if (G.current) { G.current.lastPresenceSnapshot = ''; G.current.lastPresenceAt = 0; }
    ctrl.update({
      name: profile.displayName || 'Farmer',
      tile: [...g.player.tile],
      facing: g.player.facing,
      mounted: !!g.player.mounted,
      heroSpec: hero?.spec || null,
      card: presenceCardFrom(logicRef.current?.snapshot?.()),
      actors: worldActorSnapshots(g, true, profile.displayName || 'Farmer'),
    });
    // Late-joiner convergence: ask the room for its freshest farm. Whoever
    // answers with a higher rev than ours wins (applySnapshot gates on rev).
    ctrl.requestState();

    return () => {
      closed = true;
      ctrl.leave();
      if (presenceCtrlRef.current === ctrl) presenceCtrlRef.current = null;
      if (G.current) {
        G.current.peerActors?.clear?.();
        G.current.peerWorldActors?.clear?.();
      }
      setPresence({ count: 0, names: [], peers: [] });
    };
    // Keyed on STABLE identity only (like Kingdom's arena effect). displayName &
    // heroPresenceKey are intentionally excluded: they change when the hero
    // loads mid-session, and re-running here would open a SECOND channel on the
    // same topic that never subscribes. The live heartbeat (publishPresence)
    // already streams the fresh name/heroSpec every tick, so peers still get the
    // updated avatar without re-subscribing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, circleId, profile?.id, profile?.guest]);

  // ---------- actions ----------
  function frontTile() {
    const p = G.current.player; const [dx, dy] = DELTA[p.facing];
    return [p.tile[0] + dx, p.tile[1] + dy];
  }
  // Floating "+1 🥬" harvest pop (FarmVille juice) at a tile.
  function floatPop(g, tx, ty, text) {
    g.floats.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE - 22, text, start: performance.now(), ttl: 950 });
    if (g.floats.length > 40) g.floats.shift();
  }
  function popHarvestResult(g, res) {
    if (!res) return;
    // Bulk harvest → a pop at each tile; single harvest → one pop. Harvest now
    // yields the crop ITEM (into the bag), so the juice shows the crop emoji.
    if (Array.isArray(res.harvested)) { for (const h of res.harvested) floatPop(g, h.tx, h.ty, '+' + (h.emoji || '🌾')); return; }
    if (res.emoji && res.tx != null) floatPop(g, res.tx, res.ty, '+' + res.emoji);
  }
  function doUse() {
    const g = G.current; if (!g) return;
    const p = g.player;
    const [tx, ty] = frontTile();
    g.cursorTile = [tx, ty]; // manual swing button acts on the faced tile — sync the highlight to it
    // Facing an ore/tree node → SWING to gather (the weapon IS the tool). The front
    // tile is adjacent by definition, so no distance check needed here.
    const hs = hotspotAt(tx, ty);
    if (hs && (hs.kind === 'ore' || hs.kind === 'tree')) { playSwing(g); gatherNode(g, hs); return; }
    if (!p.oneShot) { p.oneShot = 'Get'; p.oneShotStart = performance.now(); }
    // Contextual (same as tapping the land): sickle removes → harvest ripe → plant.
    popHarvestResult(g, logicRef.current.tapAt(tx, ty));
  }
  // Bulk actions for the HUD — FarmVille "do the whole field in one tap".
  function doHarvestAll() {
    const g = G.current; if (!g) return;
    popHarvestResult(g, logicRef.current?.harvestAll?.());
  }
  function doPlantAll() { logicRef.current?.plantAll?.(); }
  function doSleep() { logicRef.current?.sleep(); }
  // Dungeon v1: the Hollow Gate drops you into the battleground arena (existing
  // combat). Real instanced floor + Tiger boss + loot-on-clear is a follow-up.
  function enterDungeon() {
    const g = G.current; if (!g) return;
    setHotspot(null);
    g.player.tile = [28, 38]; g.player.from = [28, 38]; g.player.moveT = 1;
    // Spawn the Tiger BOSS (host-owned, one at a time). Big HP + a token/gem drop
    // on clear — the top of the gather→craft→fight loop.
    if (iAmHost(g) && !g.monsters.some((m) => m.kind === 'tiger' && m.state !== 'die')) {
      const t = monsterOf('tiger');
      const boss = makeMonster({ id: 'boss:tiger:' + Date.now(), tile: [30, 40], maxHp: t.hp });
      boss.kind = 'tiger'; boss.atk = t.atk; boss.boss = true;
      boss.seed = (g.monsterSeed = (g.monsterSeed >>> 0) + 1);
      boss.nextWander = performance.now() + 800;
      g.monsters.push(boss);
    }
    logicRef.current?.flash?.('⚔ The Tiger stirs… clear the dungeon!');
  }
  function toggleMount() {
    const g = G.current; if (!g) return;
    if (!g.resources?.mount) return;
    sfx.play('mount');
    const mount = g.actors.get('mount:equipped');
    if (g.player.mounted) {
      g.player.mounted = false;
      if (mount) {
        const tile = nearestOpenNeighbor(g, g.player.tile, mount.tile) || g.player.tile;
        mount.tile = [...tile]; mount.from = [...tile]; mount.moveT = 1;
        mount.mode = 'wander'; mount.hidden = false; mount.speedMs = 620; mount.idleUntil = performance.now() + 260;
      }
      return;
    }
    // Ride IMMEDIATELY on R (like Kingdom) — no calling the mount to walk over.
    if (mount) {
      mount.mode = 'ridden'; mount.hidden = true;
      mount.tile = [...g.player.tile]; mount.from = [...g.player.tile]; mount.moveT = 1;
    }
    g.player.mounted = true;
    g.pendingMountCall = false;
  }

  // ---------- battle actions (bottom-right cluster in the arena) ----------
  function spark(g, tx, ty) {
    g.fx.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, start: performance.now(), ttl: 320 });
  }
  // The hero's weapon swing (falls back through Attack/Pierce/Shoot, then to the
  // 'Get' pickup only if it has no attack frames at all — so it never "bows").
  function attackMotionBase(g) {
    const facing = g.player.facing;
    if (g.tables) { // no hero motion tables (guest / hero not loaded yet) → 'Get' pickup
      for (const base of ['Swing', 'Attack', 'Pierce', 'Shoot']) {
        if (stepCount(g.tables, base + facing) > 0) return base;
      }
    }
    return 'Get';
  }
  function playSwing(g) {
    g.player.oneShot = attackMotionBase(g);
    g.player.oneShotStart = performance.now();
    sfx.play('swing');
  }
  // ---- SWING-TO-GATHER: the weapon swing IS the tool. ----
  const GATHER_ICON = { wood: '🪵', stone: '🪨', ore: '🟨', gem: '🔷' };
  // Chebyshev distance from the player to a node's rect ≤ 1 (you're next to it).
  function nodeAdjacent(g, hs) {
    const [px, py] = g.player.tile, r = hs.rect;
    const nx = Math.max(r.x0, Math.min(px, r.x1)), ny = Math.max(r.y0, Math.min(py, r.y1));
    return Math.abs(px - nx) <= 1 && Math.abs(py - ny) <= 1;
  }
  // Mine/chop a node: chip spark on the node + a rising +yield float. mine()/chop()
  // handle the cooldown + tier gate (they flash the reason and return null if blocked).
  function gatherNode(g, hs) {
    const m = mechRef.current; if (!m) return;
    const res = hs.kind === 'ore' ? m.mine(hs) : m.chop(hs);
    const gx = hs.rect.x0, gy = hs.rect.y0;
    spark(g, gx, gy);
    if (res) floatPop(g, gx, gy, Object.entries(res).map(([k, v]) => '+' + v + (GATHER_ICON[k] || '')).join(' '));
  }
  function iAmHost(g) { return !circleId || presenceHostId(g, profile) === presenceProfileId(profile); }
  // A non-host's view of a host monster on a tile (peerWorldActors), for hitting.
  function peerMonsterAt(g, tx, ty) {
    for (const a of g.peerWorldActors.values()) {
      if (a.kind !== 'monster' || a.state === 'die') continue;
      const [ax, ay] = actorTileAt(a, performance.now()).map(Math.round);
      if (ax === tx && ay === ty) return a;
    }
    return null;
  }
  // Apply `dmg` to whatever monster is on (tx,ty): host hits its own authoritative
  // monster; a non-host optimistically flashes and sends a mob-hit intent to the
  // host, which owns hp/death (Kingdom's victim-referee model, host = referee).
  function hitTile(g, tx, ty, dmg) {
    const now = performance.now();
    if (iAmHost(g)) {
      const res = resolveMelee(g.monsters, tx, ty, dmg, now);
      if (res) { spark(g, tx, ty); sfx.play(res.killed ? 'die' : 'hit'); if (res.killed) rewardAndLoot(res.monster.kind || 'a monster'); return true; }
      return false;
    }
    const a = peerMonsterAt(g, tx, ty);
    if (!a) return false;
    spark(g, tx, ty);
    a.hp = Math.max(0, (a.hp || 0) - dmg); // optimistic; host broadcast is authoritative
    presenceCtrlRef.current?.sendIntent?.({ t: 'mob-hit', id: a.sourceId, dmg, by: presenceProfileId(profile) });
    return true;
  }
  // Basic attack — always plays the weapon swing; deals MELEE_DAMAGE to the faced
  // tile when in the arena. Outside the arena it's just the swing (nothing to hit).
  function doStrike() {
    const g = G.current; if (!g) return;
    playSwing(g);
    if (!g.combat.on) {
      // outside the arena the swing GATHERS: mine/chop a ready ore/tree in front.
      const [ftx, fty] = frontTile();
      const hs = hotspotAt(ftx, fty);
      if (hs && (hs.kind === 'ore' || hs.kind === 'tree')) gatherNode(g, hs);
      return;
    }
    const [tx, ty] = frontTile();
    // Physical strike scaled by the path's `phy` multiplier (tunable from HQ), then
    // the equipped weapon's flat ATK on top. Warrior hits big, mage small.
    const base = MELEE_DAMAGE * pathPower(playerPath()).phy;
    hitTile(g, tx, ty, playerDamage(base));
  }
  // The player's combat path (from equipped weapon until an explicit class picker).
  function playerPath() { return logicRef.current?.path || 'warrior'; }
  // Player's dealt damage = (path-scaled) base + the equipped weapon's ATK.
  function playerDamage(base) {
    return outgoingDamage(base, logicRef.current?.state?.weaponTier ?? 1);
  }
  // A kill I earned: Bloom/XP (bestiary) + rolled material drops (mech store).
  // This is what closes the loop — mobs now feed the crafting economy.
  function rewardAndLoot(kind) {
    logicRef.current?.rewardKill(kind);
    mechRef.current?.grantDrops(rollDrops(kind));
  }
  // Spawn a spell VFX locally (shared effect system).
  function spawnSpellFx(g, fx, tile) {
    if (fx == null || !tile) return;
    spawnEffect(g.spellFx, g.effectsAll, fx, tile, (eff) => loadEffectImage(effectSheetUrl(eff)));
  }
  // Play a skill's spell VFX at a tile AND broadcast it so every circle member
  // sees the same spell (fx ids are the shared Kingdom effect catalog).
  function castSpell(g, skill, atTile) {
    if (!atTile) return;
    const tile = [Math.round(atTile[0]), Math.round(atTile[1])];
    spawnSpellFx(g, skill.fx, tile);
    presenceCtrlRef.current?.sendIntent?.({ t: 'spell', fx: skill.fx, tile });
  }
  function nearestPeerMonster(g, now) {
    let best = null, bd = Infinity; const p = g.player;
    for (const a of g.peerWorldActors.values()) {
      if (a.kind !== 'monster' || a.state === 'die') continue;
      const [ax, ay] = actorTileAt(a, now);
      const d = Math.abs(ax - p.tile[0]) + Math.abs(ay - p.tile[1]);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }
  // Hit a peer (host-owned) monster: optimistic flash + spell + mob-hit intent.
  function peerHit(g, a, skill, dmg) {
    if (!a) return false;
    castSpell(g, skill, a.tile);
    a.hp = Math.max(0, (a.hp || 0) - dmg);
    presenceCtrlRef.current?.sendIntent?.({ t: 'mob-hit', id: a.sourceId, dmg, by: presenceProfileId(profile) });
    return true;
  }
  // Skill i — Bolt (single), Storm (all), Mend (heal). MP = stamina; damage/heal
  // scale with level via the shared skillPower. Damage still routes through the
  // host referee (host applies; a non-host sends mob-hit intents).
  function doSkill(i) {
    const g = G.current; if (!g || !g.combat.on) return;
    const skill = (g.battleSkills || SKILL_SLOTS)[i]; if (!skill) return;
    const cost = Number(skill.manaCost || 0);
    const isOp = !!logicRef.current?.isOperator?.();
    const stamina = isOp ? Infinity : (logicRef.current?.state?.stamina ?? 0); // operator: unlimited
    if (!canAffordSkill(stamina, skill)) { logicRef.current?.flash?.('Too tired for ' + (skill.name || 'that skill')); return; }
    if (cost > 0 && !logicRef.current?.spendStamina(cost)) return;
    playSwing(g);
    const p = g.player;
    const L = logicRef.current?._level?.() ?? 1;
    const now = performance.now();

    const path = playerPath();
    if (skill.type === 'heal') {
      // Mend scales with the path's magic multiplier — casters heal more.
      const healed = applyHeal(g.combat, pathSkillPower(skill, path, L));
      castSpell(g, skill, p.tile);
      syncBattleState(g);
      logicRef.current?.flash?.('Mend +' + healed + ' HP');
      return;
    }
    // Magic damage scaled by the path's `mag` multiplier (tunable from HQ), + weapon ATK.
    const dmg = playerDamage(pathSkillPower(skill, path, L));
    const hostSelf = iAmHost(g);
    if (skill.target === 'all') { // Storm — every monster
      if (hostSelf) {
        for (const h of resolveSkillAll(g.monsters, dmg, now)) {
          castSpell(g, skill, h.monster.tile);
          if (h.killed) rewardAndLoot(h.monster.kind || 'a monster');
        }
      } else {
        for (const a of [...g.peerWorldActors.values()]) {
          if (a.kind === 'monster' && a.state !== 'die') peerHit(g, a, skill, dmg);
        }
      }
      return;
    }
    // Bolt — single target (faced tile, else nearest)
    if (hostSelf) {
      const res = resolveSkillSingle(g.monsters, p.tile, DELTA[p.facing], dmg, now);
      if (res) { castSpell(g, skill, res.monster.tile); if (res.killed) rewardAndLoot(res.monster.kind || 'a monster'); }
      else spark(g, ...frontTile());
    } else {
      const target = peerMonsterAt(g, ...frontTile()) || nearestPeerMonster(g, now);
      if (!peerHit(g, target, skill, dmg)) spark(g, ...frontTile());
    }
  }

  // ---------- keyboard ----------
  useEffect(() => {
    if (!ready) return;
    const g = G.current;
    function down(e) {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (DIR_BY_KEY[k]) { g.held.add(k); e.preventDefault(); }
      else if (k === ' ' || k === 'e') {
        // In the crop field, Space works the land; ANYWHERE ELSE it's a hit (swing).
        const gg = G.current;
        if (gg && inField(gg.player.tile[0], gg.player.tile[1])) doUse();
        else doStrike();
        e.preventDefault();
      }
      else if (k === 'r') toggleMount();
      else if (k === '1') doSkill(0);
      else if (k === '2') doSkill(1);
      else if (k === '3') doSkill(2);
    }
    function up(e) { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; g.held.delete(k); }
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [ready]);

  // ---------- canvas sizing ----------
  useEffect(() => {
    if (!ready) return;
    const wrap = wrapRef.current, canvas = canvasRef.current;
    function fit() {
      const r = wrap.getBoundingClientRect();
      const w = Math.floor(r.width), h = Math.floor(r.height);
      if (w > 0 && h > 0) {
        const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const bw = Math.floor(w * dpr), bh = Math.floor(h * dpr);
        if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
        const g = G.current; if (g) { g.viewportW = w; g.viewportH = h; g.dpr = dpr; }
      }
    }
    fit();
    const ro = new ResizeObserver(fit); ro.observe(wrap);
    return () => ro.disconnect();
  }, [ready]);

  // ---------- game loop ----------
  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf;

    function heldDirection(g) {
      for (const k of g.held) if (DIR_BY_KEY[k]) return DIR_BY_KEY[k];
      if (g.stick) { const { x, y } = g.stick; if (Math.hypot(x, y) > 0.3) return Math.abs(x) > Math.abs(y) ? (x > 0 ? 'East' : 'West') : (y > 0 ? 'South' : 'North'); }
      return null;
    }

    function ensureActor(g, id, init) {
      // Seed from the FULL id string (FNV-ish), not id.length — same-species ids
      // (li_cow_0..4) are all the same length, so length-based seeds collided and
      // every cow/sheep/chicken shared one RNG stream → they walked in lockstep.
      if (!g.actors.has(id)) g.actors.set(id, { id, from: [...init.tile], moveT: 1, moveStart: 0, facing: 'South', idleUntil: 0, seed: hashId(id), ...init });
      return g.actors.get(id);
    }
    function syncWorldActors(g) {
      const live = new Set();
      const state = logicRef.current?.state;
      if (!state) return;
      // 5 spread start tiles inside a pen rect (corners + centre).
      const penStarts = (p) => {
        const cx = Math.round((p.x0 + p.x1) / 2), cy = Math.round((p.y0 + p.y1) / 2);
        return [[p.x0, p.y0], [p.x1, p.y0], [cx, cy], [p.x0, p.y1], [p.x1, p.y1]];
      };
      const animalConfig = {
        cow: { names: ['Daisy', 'Bessie', 'Clover', 'Maple', 'Moochi'], home: PENS.cow, starts: penStarts(PENS.cow), speedMs: 1500 },
        sheep: { names: ['Wooly', 'Cloud', 'Cotton', 'Fleece', 'Mallow'], home: PENS.sheep, starts: penStarts(PENS.sheep), speedMs: 1450 },
        chicken: { names: ['Cluck', 'Pip', 'Sunny', 'Pebble', 'Nugget'], home: PENS.chicken, starts: penStarts(PENS.chicken), speedMs: 1050 },
      };
      for (const species of ['cow', 'sheep', 'chicken']) {
        const config = animalConfig[species];
        const saved = (state.livestock || []).filter((a) => a.species === species);
        for (let i = 0; i < ANIMAL_VISUAL_COUNT; i++) {
          const source = saved[i] || saved[0] || {};
          const id = `animal:${species}:${i}`; live.add(id);
          const start = config.starts[i] || config.starts[0];
          const ent = ensureActor(g, id, {
            kind: 'animal',
            species,
            name: source.name || config.names[i] || species,
            tile: start,
            home: config.home,
            speedMs: config.speedMs,
          });
          ent.species = species;
          ent.name = source.name || config.names[i] || species;
          ent.home = config.home;
          ent.speedMs = config.speedMs;
          ent.livestockId = source.id || null; // links the sprite to its livestock record (feed/collect)
        }
      }
      // The Kins this player has DEPLOYED (loadout picker in the Kin panel, per-user,
      // max 6). activeKins() already applies the loadout + cap; slice is a safety net.
      const kinSource = (logicRef.current?.activeKins?.() || state.kins || []).slice(0, 6);
      kinSource.forEach((k, i) => {
        const id = 'kin:' + k.id; live.add(id);
        const start = KIN_STARTS[i % KIN_STARTS.length];
        const home = {
          x0: Math.max(2, start[0] - 4),
          y0: Math.max(2, start[1] - 3),
          x1: Math.min(W - 3, start[0] + 4),
          y1: Math.min(H - 3, start[1] + 3),
        };
        const ent = ensureActor(g, id, { kind: 'kin', kin: k, tile: start, home, speedMs: 760 + (i % 3) * 90 });
        ent.kin = k; ent.name = k.name; ent.home = home;
      });
      if (g.resources?.mount) {
        const id = 'mount:equipped'; live.add(id);
        const p = g.player;
        const mountHome = { x0: 2, y0: 2, x1: W - 3, y1: H - 3 };
        const ent = ensureActor(g, id, { kind: 'mount', tile: [Math.max(7, p.tile[0] - 3), Math.max(6, p.tile[1] - 2)], home: mountHome, speedMs: 620, mode: 'wander', hidden: false });
        ent.home = mountHome;
        if (p.mounted) ent.mode = 'ridden';
        else if (g.pendingMountCall) { ent.mode = 'called'; ent.speedMs = 170; ent.idleUntil = 0; ent.callStartedAt = performance.now(); g.pendingMountCall = false; }
        else if (!ent.mode || ent.mode === 'ridden') ent.mode = 'wander';
        if (!p.mounted && ent.mode !== 'called') ent.speedMs = 620;
      }
      for (const id of [...g.actors.keys()]) if (!live.has(id)) g.actors.delete(id);
    }
    function actorRand(e) {
      e.seed = (e.seed * 1664525 + 1013904223) >>> 0;
      return e.seed / 4294967296;
    }
    function moveChoice(g, e) {
      let target = null;
      if (e.kind === 'mount' && e.mode === 'called') {
        target = g.player.tile;
      } else if (e.kind === 'kin' && e.kin?.task) {
        const plots = logicRef.current?.state?.plots || {};
        for (const [key, plot] of Object.entries(plots)) {
          if (!plot?.cropId) continue;
          const [tx, ty] = key.split(',').map(Number);
          const ripe = cropIsRipe(plot);
          // water Kin fusses over growing crops; harvest Kin heads for ripe ones
          if (e.kin.task === 'water' && !ripe) { target = [tx, ty]; break; }
          if (e.kin.task === 'harvest' && ripe) { target = [tx, ty]; break; }
        }
      }
      const dirs = target
        ? [...DIRS].sort((a, b) => {
          const da = Math.abs(e.tile[0] + a[1] - target[0]) + Math.abs(e.tile[1] + a[2] - target[1]);
          const db = Math.abs(e.tile[0] + b[1] - target[0]) + Math.abs(e.tile[1] + b[2] - target[1]);
          return da - db;
        })
        : [['North', 0, -1], ['South', 0, 1], ['West', -1, 0], ['East', 1, 0]].sort(() => actorRand(e) - 0.5);
      for (const [dir, dx, dy] of dirs) {
        const nx = e.tile[0] + dx, ny = e.tile[1] + dy;
        const inHome = nx >= e.home.x0 && nx <= e.home.x1 && ny >= e.home.y0 && ny <= e.home.y1;
        // mounts avoid crops — but only refuse to ENTER the field from OUTSIDE; a
        // mount already inside (e.g. spawned near the farmer) must be able to walk
        // out, else it gets trapped when all neighbours are field tiles.
        if (e.kind === 'mount' && e.mode !== 'called' && inField(nx, ny) && !inField(e.tile[0], e.tile[1])) continue;
        const passable = e.kind === 'mount' && e.mode === 'called' ? !borderAt(nx, ny) : !blockedAt(g, nx, ny);
        if ((target || inHome) && passable) return [dir, nx, ny];
      }
      return null;
    }
    function stepWorldActors(g, now) {
      syncWorldActors(g);
      for (const e of g.actors.values()) {
        if (e.kind === 'mount' && g.player.mounted) {
          e.mode = 'ridden';
          e.idleUntil = now + 1000;
          continue;
        }
        if (e.moveT < 1) {
          e.moveT = Math.min(1, (now - e.moveStart) / (e.speedMs || 700));
          continue;
        }
        if (e.kind === 'mount' && e.mode === 'called') {
          const dist = Math.abs(e.tile[0] - g.player.tile[0]) + Math.abs(e.tile[1] - g.player.tile[1]);
          if (dist <= 1) {
            g.player.mounted = true;
            e.mode = 'ridden';
            e.hidden = true;
            e.idleUntil = now + 1000;
            continue;
          }
          e.idleUntil = 0;
        }
        if (!e.idleUntil) e.idleUntil = now + (e.kind === 'animal' ? 1100 + actorRand(e) * 2400 : 400 + actorRand(e) * 1200);
        if (now < e.idleUntil) continue;
        const pick = moveChoice(g, e);
        if (pick) {
          const [dir, nx, ny] = pick;
          e.facing = dir; e.from = [...e.tile]; e.tile = [nx, ny]; e.moveT = 0; e.moveStart = now;
          e.idleUntil = now + (e.kind === 'mount' && e.mode === 'called' ? 20 : e.kind === 'animal' ? 1000 + actorRand(e) * 2600 : e.kind === 'kin' && e.kin?.task ? 120 : 500 + actorRand(e) * 1000);
        } else e.idleUntil = now + 800;
      }
    }
    function stepPeerActors(g, now) {
      for (const e of g.peerActors.values()) {
        if (e.moveT < 1) e.moveT = Math.min(1, (now - e.moveStart) / (e.speedMs || REMOTE_WALK_MS));
      }
      for (const e of g.peerWorldActors.values()) {
        if (e.moveT < 1) e.moveT = Math.min(1, (now - e.moveStart) / (e.speedMs || REMOTE_WALK_MS));
      }
    }
    function publishPresence(g, now, force = false) {
      const ctrl = presenceCtrlRef.current;
      if (!ctrl) return;
      const p = g.player;
      const isHost = presenceHostId(g, profile) === presenceProfileId(profile);
      const actors = worldActorSnapshots(g, isHost, profile?.displayName || 'Farmer');
      const actorStamp = actors.map((a) => `${a.id}:${a.tile[0]},${a.tile[1]}:${a.facing}:${a.mode || ''}:${a.hidden ? 1 : 0}:${a.hp ?? ''}:${a.state ?? ''}`).join('|');
      const snapshot = `${p.tile[0]},${p.tile[1]}:${p.facing}:${p.mounted ? 1 : 0}:${heroPresenceKey}:${actorStamp}`;
      if (!force && snapshot === g.lastPresenceSnapshot && now - g.lastPresenceAt < 2500) return;
      g.lastPresenceSnapshot = snapshot;
      g.lastPresenceAt = now;
      ctrl.update({
        name: profile?.displayName || 'Farmer',
        tile: [...p.tile],
        facing: p.facing,
        mounted: !!p.mounted,
        heroSpec: hero?.spec || null,
        card: presenceCardFrom(logicRef.current?.snapshot?.()),
        actors,
      });
    }

    // Presence heartbeat on a TIMER, not requestAnimationFrame — a backgrounded /
    // minimized tab (where rAF throttles to ~0) keeps its position, mount, kins
    // and (if host) animals visible to the circle. Farm STATE never rides the
    // heartbeat: state changes are granular intents sent at the moment they
    // happen, so there is nothing here that could clobber a peer's live edits.
    const heartbeat = window.setInterval(() => {
      const g = G.current;
      if (!g || !presenceCtrlRef.current) return;
      publishPresence(g, performance.now(), true);
    }, 2000);

    function tick(now) {
      try { step(now); } catch (err) { if (!tick._e) { tick._e = true; console.error('farm tick error', err); } }
      raf = requestAnimationFrame(tick);
    }
    function step(now) {
      const g = G.current; if (!g) return; const p = g.player;
      // mounted moves faster (WALK_MS * 0.6); the Settings speed slider (1x-3x)
      // divides the walk time so higher = faster.
      const walkMs = (p.mounted ? WALK_MS * 0.6 : WALK_MS) / (g.speed || 1);
      if (p.moveT < 1) p.moveT = Math.min(1, (now - p.moveStart) / walkMs);
      else if (!p.oneShot) {
        const dir = heldDirection(g);
        if (dir) {
          if (p.facing !== dir) { p.facing = dir; p.turnHoldDir = dir; p.turnHoldStart = now; }
          else if (!(p.turnHoldDir === dir && now - p.turnHoldStart < 90)) {
            const [dx, dy] = DELTA[dir]; const nx = p.tile[0] + dx, ny = p.tile[1] + dy;
            // body-block: map collision OR a live monster tile (no overlapping mobs).
            if (!blockedAt(g, nx, ny) && !monsterAt(g, nx, ny)) { p.from = [...p.tile]; p.tile = [nx, ny]; p.moveT = 0; p.moveStart = now; }
            p.turnHoldDir = null;
          }
        } else { p.turnHoldDir = null; }
      }
      if (p.oneShot && now - p.oneShotStart > 480) p.oneShot = null;
      stepWorldActors(g, now);
      stepPeerActors(g, now);
      stepBattle(g, now);
      publishPresence(g, now);
      draw(g, ctx, canvas, now);
    }

    // ---------- battle mode ----------
    function monsterRand(g) { g.monsterSeed = (g.monsterSeed * 1664525 + 1013904223) >>> 0; return g.monsterSeed / 4294967296; }
    function arenaOpenTile(g) {
      for (let i = 0; i < 60; i++) {
        const tx = ARENA.x0 + Math.floor(monsterRand(g) * (ARENA.x1 - ARENA.x0 + 1));
        const ty = ARENA.y0 + Math.floor(monsterRand(g) * (ARENA.y1 - ARENA.y0 + 1));
        if (blockedAt(g, tx, ty)) continue;
        if (g.player.tile[0] === tx && g.player.tile[1] === ty) continue;
        if (g.monsters.some((m) => m.tile[0] === tx && m.tile[1] === ty)) continue;
        return [tx, ty];
      }
      return [ARENA.x0 + 1, ARENA.y0 + 1];
    }
    function spawnArenaMonster(g, now) {
      const tile = arenaOpenTile(g);
      // Kid-safe woodland roster (bestiary), rescaled HP so combat isn't trivial.
      // Roster comes from the tuning pipeline (SPAWN_TUNING) so HQ can change it.
      const kinds = (SPAWN_TUNING.roster && SPAWN_TUNING.roster.length) ? SPAWN_TUNING.roster : ['squirrel', 'fox', 'badger', 'boar', 'deer'];
      const kind = kinds[Math.floor(monsterRand(g) * kinds.length)];
      const mob = monsterOf(kind);
      const m = makeMonster({ id: 'mob:' + (g.monsterSeed >>> 0) + ':' + now, tile, maxHp: mob.hp });
      m.kind = kind;
      m.atk = mob.atk;
      m.nextWander = now + 400 + monsterRand(g) * 1400;
      m.seed = (g.monsterSeed >>> 0);
      g.monsters.push(m);
    }
    function stepBattle(g, now) {
      const p = g.player;
      // Local battle mode follows MY position (each client toggles its own HUD).
      const on = inArena(p.tile[0], p.tile[1]) && (!g.combat.deadUntil || now > g.combat.deadUntil);
      if (on !== g.combat.on) {
        g.combat.on = on;
        if (on) { // size the HP pool to the hero's level + path, FULL on entry
          const lg = logicRef.current;
          g.combat.maxHp = pathMaxHp(lg?.path || 'warrior', lg?._level?.() ?? 1);
          g.combat.hp = g.combat.maxHp; // enter at full HP — the init hp was a flat
          // 100 that never refilled to the level-scaled max (the "HP = 100" bug).
        }
        syncBattleState(g);
      }
      // Monsters are shared: only the elected host simulates them (same rule as
      // the herd), then broadcasts positions/hp/state in the heartbeat. Non-host
      // clients render the host's monsters via peerWorldActors and never simulate.
      const hostSelf = !circleId || presenceHostId(g, profile) === presenceProfileId(profile);
      if (hostSelf) {
        if (g.monsters.length < (SPAWN_TUNING.maxConcurrent || ARENA_MONSTER_COUNT) && now > g.nextMonsterSpawn) {
          spawnArenaMonster(g, now); g.nextMonsterSpawn = now + (SPAWN_TUNING.intervalMs || 900);
        }
        for (const m of g.monsters) stepMonsterAI(g, m, now, p);
        g.monsters = g.monsters.filter((m) => !monsterExpired(m, now));
      } else if (g.monsters.length) {
        g.monsters = []; // host owns the monsters; drop any we simulated as host earlier
      }
      g.fx = g.fx.filter((f) => now - f.start < f.ttl);
    }
    function syncBattleState(g) {
      const next = { on: g.combat.on, hp: g.combat.hp, maxHp: g.combat.maxHp };
      if (battleRef.current.on !== next.on || battleRef.current.hp !== next.hp) {
        battleRef.current = next; setBattle(next);
      }
    }

    // Host-simulated monster AI: chase the player when in range, then TELEGRAPH an
    // attack (windup you can step out of) and strike on a cooldown; otherwise
    // wander. Movement is collision-aware (map + other mobs + the player).
    function stepMonsterAI(g, m, now, p) {
      if (m.state === 'die') return;
      tickMonsterState(m, now);
      if (m.moveT < 1) { m.moveT = Math.min(1, (now - m.moveStart) / MONSTER_WALK_MS); return; }
      // mid-attack: land the blow at the end of the windup (only if still adjacent
      // — stepping away dodges it), then recover back to standing.
      if (m.state === 'attack') {
        if (!m.struck && now - m.stateStart >= MONSTER_ATTACK_WINDUP_MS) {
          m.struck = true;
          if (g.combat.on && !faintActive(g, now) && chebyshev(m.tile, p.tile) <= 1) monsterStrikePlayer(g, m, now);
        }
        if (now - m.stateStart >= MONSTER_ATTACK_WINDUP_MS + MONSTER_ATTACK_RECOVER_MS) { m.state = 'stand'; m.struck = false; }
        return;
      }
      const range = chebyshev(m.tile, p.tile);
      const aggro = g.combat.on && !faintActive(g, now) && range <= (m.aggro || MONSTER_AGGRO_RANGE);
      if (aggro && range <= 1) {
        m.facing = faceToward(m.tile, p.tile);
        if (now >= (m.nextAttack || 0)) { m.state = 'attack'; m.stateStart = now; m.struck = false; m.nextAttack = now + (m.atkMs || MONSTER_ATTACK_COOLDOWN_MS); sfx.play('monsterAttack'); }
        return;
      }
      if (now < (m.nextWander || 0)) return;
      const dir = aggro ? faceToward(m.tile, p.tile) : Object.keys(DELTA)[Math.floor(monsterRand(g) * 4)];
      const [dx, dy] = DELTA[dir]; const nx = m.tile[0] + dx, ny = m.tile[1] + dy;
      m.facing = dir;
      if (inArena(nx, ny) && !blockedAt(g, nx, ny) && !(nx === p.tile[0] && ny === p.tile[1]) && !monsterAt(g, nx, ny, m)) {
        m.from = [...m.tile]; m.tile = [nx, ny]; m.moveT = 0; m.moveStart = now;
      }
      m.nextWander = now + (aggro ? 130 : 700 + monsterRand(g) * 1700); // chase faster than idle
    }
    function faintActive(g, now) { return g.combat.deadUntil && now < g.combat.deadUntil; }
    // A monster's blow lands on the player: armor DEF mitigates half its value;
    // spark + floating damage for feedback; 0 HP → faint (harmless knockback+heal).
    function monsterStrikePlayer(g, m, now) {
      const def = armorDef(logicRef.current?.state?.armorTier ?? 1);
      const dmg = Math.max(1, Math.round((Number(m.atk) || 6) - def * 0.5));
      g.combat.hp = Math.max(0, g.combat.hp - dmg);
      const [px, py] = entityPx(g.player);
      g.fx.push({ x: px + TILE / 2, y: py + TILE / 2, start: performance.now(), ttl: 320 });
      g.floats.push({ x: px + TILE / 2, y: py + TILE - 26, text: '-' + dmg, start: performance.now(), ttl: 820 });
      sfx.play('hurt');
      if (g.combat.hp <= 0) faintPlayer(g, now); else syncBattleState(g);
    }
    // Faint = kid-safe: no loss. Knock the player north of the arena wall (combat
    // toggles off there), heal to full, brief timeout before you can re-enter.
    function faintPlayer(g, now) {
      g.combat.deadUntil = now + MONSTER_FAINT_MS;
      g.combat.hp = g.combat.maxHp;
      const safe = [ARENA_GATE_X, ARENA_WALL_Y - 1];
      g.player.tile = [...safe]; g.player.from = [...safe]; g.player.moveT = 1;
      g.floats.push({ x: safe[0] * TILE + TILE / 2, y: safe[1] * TILE, text: '💫 Fainted! Recovering…', start: performance.now(), ttl: 1600 });
      sfx.play('faint');
      g.combat.on = false; syncBattleState(g);
    }

    function entityPx(e) {
      const t = e.moveT ?? 1;
      const fx = e.from && t < 1 ? e.from[0] + (e.tile[0] - e.from[0]) * t : e.tile[0];
      const fy = e.from && t < 1 ? e.from[1] + (e.tile[1] - e.from[1]) * t : e.tile[1];
      return [fx * TILE, fy * TILE];
    }

    function playerMotion(g) {
      const p = g.player;
      // mount check copied AS IS from Kingdom Heroes' playerMotion(): the
      // compositor only draws the mount layer for a motion literally named
      // 'Riding'+facing (Motion.tbl decides the draw order per motion).
      if (p.mounted && g.resources?.mount) return 'Riding' + p.facing;
      const w = g.hasWeapon;
      if (p.moveT < 1) return (w ? 'WeaponWalk' : 'NormalWalk') + p.facing;
      return (w ? 'WeaponStandBy' : 'NormalStandBy') + p.facing;
    }
    function remoteMotion(e) {
      if (e.mounted && e.resources?.mount) return 'Riding' + e.facing;
      const w = e.hasWeapon;
      if (e.moveT < 1) return (w ? 'WeaponWalk' : 'NormalWalk') + e.facing;
      return (w ? 'WeaponStandBy' : 'NormalStandBy') + e.facing;
    }

    // Draws the farmer with its bottom-center EXACTLY on the foot point (tile
    // center-bottom), computed from the sprite's real bounding box — so the
    // avatar always stands on its shadow/tile regardless of per-frame origins.
    // Returns the head-top Y for the nameplate.
    function drawPlayer(g, ctx, now, footX, footY) {
      const p = g.player;
      if (g.heroOk) {
        // oneShot holds the motion BASE ('Get' for farm work, a weapon swing for
        // an attack). Fall back to the idle/walk motion if the hero has no frames
        // for that base — so an attack never freezes on a missing animation.
        const oneShotMotion = p.oneShot ? p.oneShot + p.facing : null;
        const hasOne = !!oneShotMotion && stepCount(g.tables, oneShotMotion) > 0;
        const motion = hasOne ? oneShotMotion : playerMotion(g);
        const n = stepCount(g.tables, motion);
        let s;
        if (hasOne) s = Math.min(n - 1, Math.floor((now - p.oneShotStart) / 160));
        else if (p.moveT < 1) s = Math.floor(p.moveT * n) % n;
        else s = Math.floor(now / 340) % n;
        const list = resolveStep(g.tables, g.resources, motion, s);
        const bb = list.length ? drawListBBox([list]) : null;
        if (bb) {
          paintStep(ctx, list, { x: footX - bb.cx, y: footY - bb.y1 }, 1);
          return footY - (bb.y1 - bb.y0);
        }
      }
      drawPlaceholderFarmer(ctx, footX, footY, FACE_WORD[p.facing]);
      return footY - 40;
    }
    function drawRemotePlayer(g, ctx, now, e, footX, footY) {
      if (e.heroOk) {
        const motion = remoteMotion(e);
        const n = stepCount(g.tables, motion);
        const s = e.moveT < 1 ? Math.floor(e.moveT * n) % n : Math.floor(now / 340) % n;
        const list = resolveStep(g.tables, e.resources, motion, s);
        const bb = list.length ? drawListBBox([list]) : null;
        if (bb) {
          paintStep(ctx, list, { x: footX - bb.cx, y: footY - bb.y1 }, 1);
          return footY - (bb.y1 - bb.y0);
        }
      }
      drawPlaceholderFarmer(ctx, footX, footY, FACE_WORD[e.facing]);
      return footY - 40;
    }
    // Render a mount from a Kingdom mount RESOURCE (works for the local player and
    // for peers — a peer's mount resource comes from their broadcast heroSpec).
    function drawMountFromRes(ctx, res, facing, now, footX, footY) {
      const animName = { North: 'walk_up', South: 'walk_down', East: 'walk_right', West: 'walk_left' }[facing] || 'walk_down';
      const anim = res?.creature?.animations?.[animName];
      if (res?.sheet && anim?.length) {
        const frame = anim[Math.floor(now / 220) % anim.length];
        const fm = res.creature.frames?.[frame.frame];
        if (fm) {
          const list = [{
            sheet: res.sheet,
            sx: fm.x + fm.fx, sy: fm.y + fm.fy, w: fm.w, h: fm.h,
            dx: res.creature.origin[0] + fm.fx, dy: res.creature.origin[1] + fm.fy,
          }];
          const bb = drawListBBox([list]);
          if (bb) { paintStep(ctx, list, { x: footX - bb.cx, y: footY - bb.y1 }, 1); return true; }
        }
      }
      return false;
    }
    function drawWorldActor(g, ctx, e, now, footX, footY) {
      const frame = e.moveT < 1 ? Math.floor(e.moveT * 2) : Math.floor(now / 420);
      if (e.kind === 'animal') {
        // Each animal bounces on its OWN phase (from its seed) so the herd never
        // moves in lockstep. Chickens hop; cows/sheep waddle; a gentle idle
        // breathe when standing still.
        const moving = e.moveT < 1;
        const phase = ((e.seed || 1) % 1000) / 1000 * Math.PI * 2;
        const spd = e.species === 'chicken' ? 150 : 300;
        const s = Math.sin(now / spd + phase);
        let bob = 0, squash = 0;
        if (e.species === 'chicken') { bob = moving ? -Math.abs(s) * 7 : -Math.abs(Math.sin(now / 600 + phase)) * 1.5; squash = moving ? Math.abs(s) * 0.6 : 0; }
        else { bob = (moving ? s * 2.5 : Math.sin(now / 700 + phase) * 0.8); squash = moving ? (s * 0.5 + 0.5) * 0.5 : 0; }
        drawAnimalSprite(ctx, e.species, footX, footY + bob, e.facing, frame, g.art, squash, moving, now);
        // "good ready" badge — the produce LOGO (milk/wool/egg) on a coloured disc,
        // bobbing over the animal when its good is ripe to collect.
        const li = e.livestockId && logicRef.current?.state?.livestock?.find((x) => x.id === e.livestockId);
        if (li && animalGoodReady(li, now)) {
          const sp = SPECIES[e.species];
          const by = footY - (e.species === 'chicken' ? 30 : 52) + Math.sin(now / 260) * 3;
          const R = 13;
          const bg = { milk: '#3f8fd0', wool: '#c069a8', egg: '#dd9a2b' }[sp?.produce] || '#555';
          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
          ctx.beginPath(); ctx.arc(footX, by, R, 0, 7); ctx.fillStyle = bg; ctx.fill();
          ctx.shadowColor = 'transparent';
          ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.stroke();
          const icon = g.art['lashira.produce.' + sp?.produce];
          if (icon && icon.naturalWidth > 0) { const s = R * 1.55; ctx.drawImage(icon, footX - s / 2, by - s / 2, s, s); }
          else { ctx.font = '15px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sp?.produceEmoji || '✨', footX, by + 1); }
          ctx.restore();
        }
      }
      else if (e.kind === 'kin') drawKinSprite(ctx, e.kin, footX, footY, e.facing, frame, g.art);
      else if (e.kind === 'mount' && e.peerMount) {
        // Peer's mount → their REAL Kingdom mount skin (loaded from their heroSpec
        // into the owner's peerActor.resources); placeholder only while loading.
        const ownerRes = g.peerActors.get(e.ownerId)?.resources?.mount;
        if (!(ownerRes && drawMountFromRes(ctx, ownerRes, e.facing, now, footX, footY))) {
          drawMountPlaceholder(ctx, footX, footY, e.facing, Math.floor(now / 260), g.art);
        }
      } else if (e.kind === 'mount') {
        if (!drawMountFromRes(ctx, g.resources?.mount, e.facing, now, footX, footY)) {
          drawMountPlaceholder(ctx, footX, footY, e.facing, Math.floor(now / 260), g.art);
        }
      }
    }
    function drawActorShadow(g, ctx, a) {
      const wide = a.type === 'player' ? g.player.mounted : a.e?.kind === 'mount' || a.e?.kind === 'remote' && a.e.mounted || a.e?.species === 'cow';
      const rx = wide ? 20 : 10;
      const ry = wide ? 5 : 3.5;
      ctx.fillStyle = 'rgba(35, 62, 28, 0.16)';
      ctx.beginPath();
      ctx.ellipse(a.footX, a.footY + 1, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    function drawNameplate(ctx, label) {
      const small = !!label.small;
      ctx.font = (small ? '8px' : '11px') + ' Inter, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(label.name).width; const bw = tw + (small ? 8 : 16);
      const ny = small ? label.headTop : Math.min(label.headTop - 12, label.footY - 44);
      ctx.fillStyle = label.fill || '#1d9d55dd';
      ctx.fillRect(label.footX - bw / 2, ny - (small ? 6 : 9), bw, small ? 12 : 17);
      ctx.fillStyle = '#fff';
      ctx.fillText(label.name, label.footX, ny + (small ? 0.5 : 0));
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }

    function draw(g, ctx, canvas, now) {
      const cssW = g.viewportW || canvas.clientWidth, cssH = g.viewportH || canvas.clientHeight;
      if (cssW <= 0 || cssH <= 0 || !canvas.width || !canvas.height) return;
      const z = Math.min(4, Math.max(0.1, g.zoom || 1));
      const p = g.player; const [ppx, ppy] = entityPx(p);
      const viewW = cssW / z, viewH = cssH / z;
      let camX = ppx + TILE / 2 - viewW / 2, camY = ppy + TILE / 2 - viewH / 2;
      camX = WORLD_W > viewW ? Math.max(0, Math.min(camX, WORLD_W - viewW)) : (WORLD_W - viewW) / 2;
      camY = WORLD_H > viewH ? Math.max(0, Math.min(camY, WORLD_H - viewH)) : (WORLD_H - viewH) / 2;
      g.cam = { camX, camY, z }; // remembered so tap-to-farm can map screen → world tile

      ctx.save();
      ctx.setTransform(g.dpr || 1, 0, 0, g.dpr || 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#7cc35a'; ctx.fillRect(0, 0, cssW, cssH);
      ctx.scale(z, z); ctx.translate(-Math.round(camX), -Math.round(camY));
      ctx.drawImage(g.bg, 0, 0);

      // FARM LAYER — soil that MATCHES the basemap's tilled plot (#7b4c23) so it blends
      // seamlessly while covering the baked-in crops; live crops draw on top below.
      // Subtle furrows (tilled rows), not plank lines.
      for (let ty = FIELD.y0; ty <= FIELD.y1; ty++) for (let tx = FIELD.x0; tx <= FIELD.x1; tx++) {
        const px = tx * TILE, py = ty * TILE;
        ctx.fillStyle = '#7b4c23'; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(58,34,14,0.30)';               // furrow shadow
        for (let yy = py + 9; yy < py + TILE - 3; yy += 12) ctx.fillRect(px + 3, yy, TILE - 6, 2);
        ctx.fillStyle = 'rgba(150,102,58,0.22)';             // furrow highlight
        for (let yy = py + 9; yy < py + TILE - 3; yy += 12) ctx.fillRect(px + 3, yy + 2, TILE - 6, 1);
      }

      // CASTLE — drawn per-frame from the chosen skin (swappable in the Castle panel),
      // bottom-anchored at its foot at NATIVE aspect so it sits centered on the plaza.
      const cskin = g.art['lashira.castleskin.' + (g.castleSkin || 'storybook')];
      if (cskin && cskin.naturalWidth > 0) {
        const dw = CASTLE.w * TILE, dh = dw * (cskin.naturalHeight / cskin.naturalWidth);
        // CENTER-anchored on the plaza disc so the building sits dead-middle.
        ctx.drawImage(cskin, CASTLE.cx * TILE - dw / 2, CASTLE.cy * TILE - dh / 2, dw, dh);
      }

      // HARVEST NODES — ore (Mine) + trees (Forest). Draw the READY sprite while
      // gatherable, the DEPLETED sprite (small_rock / stump) during the respawn
      // cooldown, plus a pulsing ready-ring or a regrow arc so state is obvious.
      const mech = mechRef.current;
      if (mech) {
        for (const n of HARVEST_NODES) {
          const isTree = n.kind === 'tree';
          const ready = mech.nodeReady(n.id, isTree ? 'tree' : 'ore');
          const key = ready ? n.art : n.depleted;
          const img = key && g.art[key];
          const tx = n.rect.x0, ty = n.rect.y0;
          // trees are 2 wide × drawn tall (canopy up); ore is a single tile.
          const dw = isTree ? 2 * TILE : TILE, dh = isTree ? 3 * TILE : TILE;
          const dx = tx * TILE, dy = isTree ? (ty - 1) * TILE : ty * TILE;
          if (img && img.naturalWidth > 0) ctx.drawImage(img, dx, dy, dw, dh);
          const cx = dx + dw / 2, gy = (ty + (isTree ? 1 : 0.5)) * TILE;
          if (ready) {
            // pulsing ring — green = gather now, amber = tool-tier locked (gold/gem/oak)
            const locked = (n.ore === 'gold' || n.ore === 'gem') ? (mech.state.tools.pickaxe < 2)
              : n.hard ? (mech.state.tools.axe < 2) : false;
            const pulse = Math.abs(Math.sin(now / 480));
            ctx.beginPath(); ctx.arc(cx, gy, 9 + pulse * 5, 0, 7);
            ctx.strokeStyle = locked ? `rgba(240,180,60,${(0.5 * (1 - pulse) + 0.2).toFixed(2)})` : `rgba(90,220,120,${(0.5 * (1 - pulse) + 0.2).toFixed(2)})`;
            ctx.lineWidth = 3; ctx.stroke();
          } else {
            // regrow arc (fills as the node recovers)
            const frac = mech.nodeFrac(n.id, isTree ? 'tree' : 'ore');
            ctx.beginPath(); ctx.arc(cx, gy, 8, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2.5; ctx.stroke();
          }
        }
      }

      // plots
      const plots = logicRef.current.state.plots;
      for (const [key, plot] of Object.entries(plots)) { const [tx, ty] = key.split(',').map(Number); drawPlot(ctx, tx, ty, plot, g.art); }

      // target: the tile you last TAPPED/acted on (filled + outlined so it's
      // unambiguous which tile the tool acted on) — NOT the character's facing.
      // Falls back to the tile ahead of the farmer only until the first tap.
      const [ftx, fty] = g.cursorTile || [p.tile[0] + DELTA[p.facing][0], p.tile[1] + DELTA[p.facing][1]];
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(ftx * TILE + 2, fty * TILE + 2, TILE - 4, TILE - 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
      ctx.strokeRect(ftx * TILE + 2, fty * TILE + 2, TILE - 4, TILE - 4);

      const footX = ppx + TILE / 2, footY = ppy + TILE - 5;
      let headTop = footY - 40;
      const actors = [];
      const hostIsSelf = !circleId || presenceHostId(g, profile) === presenceProfileId(profile);
      const myName = logicRef.current?.profile?.displayName || 'Farmer';
      for (const e of g.actors.values()) {
        if (e.kind === 'mount' && p.mounted) continue;
        // My kins are always mine to draw (owner-simulated); animals draw only
        // on the elected host so the shared herd exists exactly once.
        if (e.kind === 'animal' && !hostIsSelf) continue;
        const [ex, ey] = entityPx(e);
        actors.push({ type: 'world', e, owner: e.kind === 'kin' ? myName : null, footX: ex + TILE / 2, footY: ey + TILE - 5 });
      }
      for (const e of g.peerWorldActors.values()) {
        if (e.hidden) continue;
        const [ex, ey] = entityPx(e);
        if (e.kind === 'monster') { actors.push({ type: 'monster', e, footX: ex + TILE / 2, footY: ey + TILE - 5 }); continue; }
        actors.push({ type: 'world', e, owner: e.kind === 'kin' ? (e.owner || '') : null, footX: ex + TILE / 2, footY: ey + TILE - 5 });
      }
      for (const e of g.peerActors.values()) {
        const [ex, ey] = entityPx(e);
        actors.push({ type: 'remote', e, footX: ex + TILE / 2, footY: ey + TILE - 5 });
      }
      for (const m of g.monsters) {
        const [ex, ey] = entityPx(m);
        actors.push({ type: 'monster', e: m, footX: ex + TILE / 2, footY: ey + TILE - 5 });
      }
      actors.push({ type: 'player', footX, footY });
      actors.sort((a, b) => a.footY - b.footY);
      const labels = [];
      for (const a of actors) {
        const actualKin = a.e?.kind === 'kin' && hasActualKinArt(a.e.kin);
        if (a.type !== 'monster' && !actualKin) drawActorShadow(g, ctx, a);
        if (a.type === 'monster') {
          drawMonster(g, ctx, a.e, now, a.footX, a.footY);
        } else if (a.type === 'player') {
          headTop = drawPlayer(g, ctx, now, a.footX, a.footY);
          labels.push({ name: logicRef.current.profile?.displayName || 'Farmer', footX: a.footX, footY: a.footY, headTop, fill: '#1d9d55dd' });
        } else if (a.type === 'remote') {
          const remoteTop = drawRemotePlayer(g, ctx, now, a.e, a.footX, a.footY);
          labels.push({ name: a.e.name || 'Farmer', footX: a.footX, footY: a.footY, headTop: remoteTop, fill: '#4f46e5dd' });
        } else {
          drawWorldActor(g, ctx, a.e, now, a.footX, a.footY);
          // Kin owner tag — tiny pill so it's obvious whose Kin is whose,
          // color-matched to the owner's nameplate (green = you, indigo = peer).
          if (a.owner) {
            const mine = a.owner === myName;
            labels.push({ name: a.owner, footX: a.footX, footY: a.footY, headTop: a.footY - 30, fill: mine ? '#1d9d55bb' : '#4f46e5bb', small: true });
          }
        }
      }
      for (const label of labels) drawNameplate(ctx, label);
      for (const f of g.fx) drawSpark(ctx, f, now);
      // shared spell VFX (skill effects) — kept while still animating
      if (g.spellFx?.length) g.spellFx = g.spellFx.filter((f) => drawEffect(ctx, f, now, TILE));
      // harvest-juice floats (rise + fade)
      if (g.floats?.length) { for (const f of g.floats) drawFloat(ctx, f, now); g.floats = g.floats.filter((f) => now - f.start < f.ttl); }

      // ── LABELLED DEBUG OVERLAY (operator dev-mode only) ───────────────────
      // Blocked tiles get a red WASH + a thick red seam = "cannot walk here".
      if (g.devOverlay) {
        ctx.fillStyle = 'rgba(230,40,40,0.12)';
        for (const key of g.blocked) { const [bx, by] = key.split(',').map(Number); ctx.fillRect(bx * TILE, by * TILE, TILE, TILE); }
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        for (const key of g.blocked) {
          const [bx, by] = key.split(',').map(Number); const px = bx * TILE, py = by * TILE;
          if (!g.blocked.has(bx + ',' + (by - 1))) { ctx.moveTo(px, py); ctx.lineTo(px + TILE, py); }
          if (!g.blocked.has(bx + ',' + (by + 1))) { ctx.moveTo(px, py + TILE); ctx.lineTo(px + TILE, py + TILE); }
          if (!g.blocked.has((bx - 1) + ',' + by)) { ctx.moveTo(px, py); ctx.lineTo(px, py + TILE); }
          if (!g.blocked.has((bx + 1) + ',' + by)) { ctx.moveTo(px + TILE, py); ctx.lineTo(px + TILE, py + TILE); }
        }
        ctx.strokeStyle = 'rgba(120,0,0,0.55)'; ctx.lineWidth = 7; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,60,60,0.95)'; ctx.lineWidth = 3.5; ctx.stroke();
        ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
      }

      // Zone boundary boxes — FARM emphasised (thick yellow = "keep clear, don't
      // paint on top"); CASTLE gold (swappable sprite); others thin (green=walk,
      // white=solid). Numbered badges are drawn screen-space below.
      if (g.devOverlay) {
        for (const zn of ZONES_ANNOT) {
          if (!zn.rect) continue;
          const rx = zn.rect.x0 * TILE, ry = zn.rect.y0 * TILE;
          const rw = (zn.rect.x1 - zn.rect.x0 + 1) * TILE, rh = (zn.rect.y1 - zn.rect.y0 + 1) * TILE;
          ctx.save();
          if (zn.noDraw) { ctx.setLineDash([16, 10]); ctx.lineDashOffset = -(now / 50) % 26; ctx.strokeStyle = 'rgba(255,214,0,0.98)'; ctx.lineWidth = 6; }
          else if (zn.custom) { ctx.setLineDash([10, 7]); ctx.lineDashOffset = -(now / 60) % 17; ctx.strokeStyle = 'rgba(255,180,40,0.95)'; ctx.lineWidth = 3; }
          else { ctx.setLineDash([6, 5]); ctx.strokeStyle = zn.walk ? 'rgba(120,235,150,0.8)' : 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; }
          ctx.strokeRect(rx + 2, ry + 2, rw - 4, rh - 4);
          ctx.restore();
        }
      }
      ctx.restore();

      drawAmbientFx(g, ctx, cssW, cssH, now); // drifting petals + light motes (screen space)

      // NUMBERED BADGES — screen space so they stay big at any map zoom. Green = you
      // can walk here, red = solid/no-walk. Numbers key to the on-screen legend.
      if (g.devOverlay && g.cam) {
        const { camX, camY, z } = g.cam;
        ctx.save(); ctx.setTransform(g.dpr || 1, 0, 0, g.dpr || 1, 0, 0);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 15px system-ui';
        for (const zn of ZONES_ANNOT) {
          const sx = (zn.cx * TILE - camX) * z, sy = (zn.cy * TILE - camY) * z;
          if (sx < -30 || sy < -30 || sx > cssW + 30 || sy > cssH + 30) continue;
          const col = zn.walk ? '#1f9d4d' : '#d23030';
          ctx.beginPath(); ctx.arc(sx, sy, 14, 0, 7); ctx.fillStyle = col; ctx.fill();
          ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.fillText(String(zn.n), sx, sy + 0.5);
        }
        ctx.restore(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      }
      if (g.stickUI) drawStick(ctx, g); // floating joystick (screen space)
    }
    // Ambient background FX (screen space): cozy cherry-blossom petals drifting
    // down + soft rising light motes. Deterministic, cheap, decorative. Honors
    // prefers-reduced-motion. Season/zone-aware tinting can hook in here later.
    function drawAmbientFx(g, ctx, w, h, now) {
      let A = g.ambient;
      if (!A) {
        g.reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        const rnd = (a, b) => a + Math.random() * (b - a);
        A = g.ambient = {
          last: now,
          petals: Array.from({ length: 18 }, () => ({ x: rnd(0, w), y: rnd(0, h), s: rnd(4, 8), vy: rnd(10, 26), vx: rnd(-8, 8), ph: rnd(0, 6.28), sp: rnd(0.6, 1.6), rot: rnd(0, 6.28) })),
          motes: Array.from({ length: 14 }, () => ({ x: rnd(0, w), y: rnd(0, h), r: rnd(1, 2.6), vy: rnd(-6, -2), vx: rnd(-4, 4), ph: rnd(0, 6.28), a: rnd(0.2, 0.5) })),
        };
      }
      if (g.reduceMotion) return;
      const dt = Math.min(0.05, (now - A.last) / 1000); A.last = now;
      ctx.save();
      ctx.setTransform(g.dpr || 1, 0, 0, g.dpr || 1, 0, 0);
      for (const p of A.petals) {
        p.ph += dt * p.sp;
        p.x += (p.vx + Math.sin(p.ph) * 14) * dt; p.y += p.vy * dt; p.rot += dt * p.sp;
        if (p.y > h + 12) { p.y = -12; p.x = Math.random() * w; }
        if (p.x < -14) p.x = w + 14; else if (p.x > w + 14) p.x = -14;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffc7de';
        ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.6, 0, 0, 6.283); ctx.fill();
        ctx.restore();
      }
      for (const m of A.motes) {
        m.ph += dt; m.x += (m.vx + Math.sin(m.ph) * 8) * dt; m.y += m.vy * dt;
        if (m.y < -8) { m.y = h + 8; m.x = Math.random() * w; }
        ctx.globalAlpha = m.a * (0.5 + 0.5 * Math.sin(m.ph * 2));
        ctx.fillStyle = '#fffbe6';
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.283); ctx.fill();
      }
      ctx.restore();
    }
    // The drag-joystick: a base ring at the press point + a knob at the thumb.
    function drawStick(ctx, g) {
      const s = g.stickUI; if (!s) return;
      const R = 42;
      ctx.save();
      ctx.setTransform(g.dpr || 1, 0, 0, g.dpr || 1, 0, 0);
      ctx.beginPath(); ctx.arc(s.bx, s.by, R, 0, 7);
      ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.38)'; ctx.lineWidth = 2; ctx.stroke();
      let kx = s.kx - s.bx, ky = s.ky - s.by; const d = Math.hypot(kx, ky) || 1;
      const r = Math.min(R, d); kx = s.bx + (kx / d) * r; ky = s.by + (ky / d) * r;
      ctx.beginPath(); ctx.arc(kx, ky, 19, 0, 7);
      ctx.fillStyle = 'rgba(255,255,255,0.72)'; ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 6; ctx.fill();
      ctx.restore();
    }
    // A rising, fading "+1 🥬" text pop.
    function drawFloat(ctx, f, now) {
      const t = (now - f.start) / f.ttl; if (t >= 1) return;
      ctx.save(); ctx.globalAlpha = 1 - t;
      ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(12,16,24,0.65)';
      ctx.fillStyle = '#fff';
      const y = f.y - t * 26;
      ctx.strokeText(f.text, f.x, y); ctx.fillText(f.text, f.x, y);
      ctx.restore(); ctx.textAlign = 'left';
    }
    // A monster: procedural blob (art later) with facing, a hit flash, a death
    // fade, and a hp bar. Colour by kind so the arena isn't monotone.
    function drawMonster(g, ctx, m, now, footX, footY) {
      const fade = m.state === 'die' ? Math.max(0, 1 - (now - m.stateStart) / 1400) : 1;
      if (fade <= 0) return;
      const bob = m.moveT < 1 ? Math.sin(now / 90 + (m.seed || 0)) * 2 : Math.sin(now / 400 + (m.seed || 0)) * 1;
      const cx = footX, by = footY + bob;
      const scl = m.boss ? 3.4 : 1; // the Tiger boss looms MUCH larger (~4 tiles)
      // colour from the bestiary (placeholder until the PixelLab sheets land).
      const body = monsterOf(m.mkind || m.kind).color || '#6fca7a';
      ctx.save(); ctx.globalAlpha = fade;
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(cx, footY + 2, 13 * scl, 5 * scl, 0, 0, 7); ctx.fill();
      // body — PixelLab sprite if the kind has one loaded, else the procedural blob
      const hitFlash = m.state === 'hit' && (now - m.stateStart) < 200;
      const sprite = creatureFrame(m.kind, m.facing, m.moveT < 1 && m.state !== 'die', now);
      if (sprite) {
        const iw = sprite.naturalWidth || 68, ih = sprite.naturalHeight || 68;
        const s = scl * (TILE * 1.3) / iw;
        const w = iw * s, h = ih * s;
        if (hitFlash) ctx.globalAlpha = fade * 0.5; // flash = brief fade on hit
        ctx.imageSmoothingEnabled = false; // CRISP pixel art (no bilinear blur when scaled up)
        ctx.drawImage(sprite, cx - w / 2, footY + 8 - h, w, h);
        ctx.imageSmoothingEnabled = true;
        ctx.globalAlpha = fade;
      } else {
        ctx.fillStyle = hitFlash ? '#ffffff' : body;
        ctx.beginPath(); ctx.ellipse(cx, by - 12 * scl, 14 * scl, 12 * scl, 0, 0, 7); ctx.fill();
        if (m.boss) { ctx.strokeStyle = '#3a1d05'; ctx.lineWidth = 2; ctx.stroke(); } // boss rim
        ctx.fillStyle = '#ffffff'; // eyes
        const ex = (m.facing === 'West' ? -4 : m.facing === 'East' ? 4 : 0) * scl;
        ctx.beginPath(); ctx.arc(cx - 5 * scl + ex, by - 14 * scl, 2.2 * scl, 0, 7); ctx.arc(cx + 5 * scl + ex, by - 14 * scl, 2.2 * scl, 0, 7); ctx.fill();
        if (!hitFlash) { ctx.fillStyle = '#20303a'; ctx.beginPath(); ctx.arc(cx - 5 * scl + ex, by - 14 * scl, 1.1 * scl, 0, 7); ctx.arc(cx + 5 * scl + ex, by - 14 * scl, 1.1 * scl, 0, 7); ctx.fill(); }
      }
      // ATTACK TELEGRAPH — a pulsing red "!" during the windup so the strike is
      // readable (step out of range to dodge it).
      if (m.state === 'attack' && (now - m.stateStart) < MONSTER_ATTACK_WINDUP_MS) {
        const t = (now - m.stateStart) / MONSTER_ATTACK_WINDUP_MS;
        ctx.globalAlpha = fade * (0.45 + 0.55 * Math.abs(Math.sin(now / 45)));
        ctx.fillStyle = '#ff3b30';
        ctx.font = 'bold ' + Math.round(20 * scl) + 'px system-ui';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('!', cx, by - 30 * scl - t * 4);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.globalAlpha = fade;
      }
      // hp bar
      if (m.state !== 'die') {
        const w = 26, hpx = cx - w / 2, hpy = by - 32, frac = Math.max(0, m.hp / (m.maxHp || 100));
        ctx.fillStyle = 'rgba(18,22,32,0.6)'; ctx.fillRect(hpx - 1, hpy - 1, w + 2, 5);
        ctx.fillStyle = frac > 0.5 ? '#57d06a' : frac > 0.25 ? '#e0c020' : '#e0553f';
        ctx.fillRect(hpx, hpy, Math.round(w * frac), 3);
        // NAMEPLATE — the mob's bestiary name on a pill above the hp bar. Boss = gold
        // + 👑; elites (deer/boar) amber; common mobs slate.
        const def = monsterOf(m.mkind || m.kind);
        const label = (m.boss ? '👑 ' : '') + (def.name || 'Beast');
        const pill = m.boss ? 'rgba(150,90,10,0.94)' : (def.hp >= 1500 ? 'rgba(120,70,20,0.9)' : 'rgba(28,32,46,0.85)');
        ctx.font = (m.boss ? 'bold 13px' : '600 11px') + ' system-ui, sans-serif';
        const nh = m.boss ? 18 : 15, nw = ctx.measureText(label).width + 12, nx = cx - nw / 2, ny = hpy - 5 - nh;
        ctx.fillStyle = pill;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(nx, ny, nw, nh, 7); ctx.fill(); } else ctx.fillRect(nx, ny, nw, nh);
        if (m.boss) { ctx.strokeStyle = 'rgba(255,215,120,0.9)'; ctx.lineWidth = 1.5; if (ctx.roundRect) ctx.stroke(); }
        ctx.fillStyle = m.boss ? '#ffe9a8' : '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, cx, ny + nh / 2 + 0.5);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      }
      ctx.restore();
    }
    // Hit spark — a quick expanding ring where a blow lands.
    function drawSpark(ctx, f, now) {
      const t = (now - f.start) / f.ttl; if (t >= 1) return;
      ctx.save(); ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = '#fff2b0'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(f.x, f.y - 14, 6 + t * 16, 0, 7); ctx.stroke();
      ctx.restore();
    }
    // A quick TAP (not a drag) interacts with the world at (clientX, clientY):
    // arena strike · landmark hotspot · crop plot · pen animal.
    function onTapInteract(clientX, clientY) {
      const g = G.current; if (!g || !g.cam) return;
      const rect = canvas.getBoundingClientRect();
      const wx = (g.cam.camX + (clientX - rect.left) / g.cam.z) / TILE;
      const wy = (g.cam.camY + (clientY - rect.top) / g.cam.z) / TILE;
      const tx = Math.floor(wx), ty = Math.floor(wy);
      g.cursorTile = [tx, ty]; // the white target box follows the tap, not the character's facing
      const faceTo = (gx, gy) => {
        const dx = gx - g.player.tile[0], dy = gy - g.player.tile[1];
        if (Math.abs(dx) > Math.abs(dy)) g.player.facing = dx >= 0 ? 'East' : 'West';
        else if (dy !== 0) g.player.facing = dy > 0 ? 'South' : 'North';
        g.player.oneShot = 'Get'; g.player.oneShotStart = performance.now();
      };
      if (g.combat.on) { faceTo(tx, ty); doStrike(); return; } // arena: tap = strike
      const hs = hotspotAt(tx, ty); // shops/castle/dungeon/mining/forestry/fishing
      if (hs) {
        faceTo(tx, ty);
        if (hs.kind === 'ore' || hs.kind === 'tree') {
          // swing to gather — but only if you're standing next to the node.
          if (nodeAdjacent(g, hs)) { playSwing(g); gatherNode(g, hs); }
          else mechRef.current?.flash?.('Get closer to swing');
        }
        else if (hs.kind === 'sell') { setShopTab('sell'); setPanel('shop'); }
        else if (hs.kind === 'shop') { setShopTab(SHOP_TAB_FOR[hs.id] || 'seeds'); setPanel('shop'); }
        else setHotspot(hs);
        return;
      }
      if (tx >= FIELD.x0 && tx <= FIELD.x1 && ty >= FIELD.y0 && ty <= FIELD.y1) {
        faceTo(tx, ty);
        const lg = logicRef.current;
        const plot = lg?.state?.plots?.[tx + ',' + ty];
        const ripe = !!(plot?.cropId && cropIsRipe(plot));
        // HYBRID: sickle tool or a ripe crop = instant action (fast path);
        // an empty/growing tile fans out the action menu at the tap point.
        if (lg?.state?.tool === 'sickle' || ripe) { popHarvestResult(g, lg?.tapAt(tx, ty)); return; }
        setTileFan({ x: clientX - rect.left, y: clientY - rect.top, tx, ty });
        return;
      }
      let best = null, bestD = 1.3;
      for (const a of g.actors.values()) {
        if (a.kind !== 'animal' || !a.livestockId) continue;
        const [ax, ay] = actorTileAt(a);
        const d = Math.hypot(ax + 0.5 - wx, ay + 0.5 - wy);
        if (d < bestD) { bestD = d; best = a; }
      }
      if (best) { g.cursorTile = [...best.tile]; logicRef.current?.tapAnimal(best.livestockId); faceTo(best.tile[0], best.tile[1]); }
    }

    // Open the tile fan on ANY field tile (used by long-press — gives the full
    // menu, including Harvest/Sickle on a ripe tile that a plain tap would fast-path).
    function openFieldFan(clientX, clientY) {
      const g = G.current; if (!g || !g.cam || g.combat.on) return false;
      const rect = canvas.getBoundingClientRect();
      const tx = Math.floor((g.cam.camX + (clientX - rect.left) / g.cam.z) / TILE);
      const ty = Math.floor((g.cam.camY + (clientY - rect.top) / g.cam.z) / TILE);
      if (!(tx >= FIELD.x0 && tx <= FIELD.x1 && ty >= FIELD.y0 && ty <= FIELD.y1)) return false;
      g.cursorTile = [tx, ty];
      setTileFan({ x: clientX - rect.left, y: clientY - rect.top, tx, ty });
      return true;
    }

    // ---------- unified pointer input: drag = move, tap = interact ----------
    // A press-and-drag ANYWHERE on the canvas is a floating joystick (trackpad +
    // touch friendly — this is the "trackpad logic"); a quick tap interacts; a
    // press held still (~450ms) long-presses → full tile fan-out.
    let ptr = null;
    const DRAG_DEAD = 12; // px of movement before a press counts as a drag
    const LONGPRESS_MS = 450;
    function onPointerDown(e) {
      if (e.button != null && e.button !== 0) return;
      sfx.arm(); ambient.start(); // audio contexts may only start from a user gesture
      ptr = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dragging: false, longFired: false, lpTimer: 0 };
      try { canvas.setPointerCapture(e.pointerId); } catch { /* older browsers */ }
      const px = e.clientX, py = e.clientY, self = ptr;
      self.lpTimer = window.setTimeout(() => {
        if (ptr === self && !self.dragging && openFieldFan(px, py)) self.longFired = true;
      }, LONGPRESS_MS);
    }
    function onPointerMove(e) {
      if (!ptr || e.pointerId !== ptr.id) return;
      const dx = e.clientX - ptr.x0, dy = e.clientY - ptr.y0;
      const dist = Math.hypot(dx, dy);
      if (!ptr.dragging && dist > DRAG_DEAD) { ptr.dragging = true; window.clearTimeout(ptr.lpTimer); }
      if (!ptr.dragging) return;
      const g = G.current; if (!g) return;
      const mag = Math.min(1, dist / 66);           // full tilt at ~66px drag
      g.stick = { x: (dx / (dist || 1)) * mag, y: (dy / (dist || 1)) * mag }; // screen down = +y = South
      const rect = canvas.getBoundingClientRect();
      g.stickUI = { bx: ptr.x0 - rect.left, by: ptr.y0 - rect.top, kx: e.clientX - rect.left, ky: e.clientY - rect.top };
    }
    function onPointerUp(e) {
      if (!ptr || e.pointerId !== ptr.id) return;
      window.clearTimeout(ptr.lpTimer);
      const wasDrag = ptr.dragging; const longFired = ptr.longFired; const { x0, y0 } = ptr;
      ptr = null;
      const g = G.current; if (g) { g.stick = null; g.stickUI = null; }
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      if (!wasDrag && !longFired) onTapInteract(x0, y0); // it was a tap, not a move or long-press
    }
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf); window.clearInterval(heartbeat);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    };
  }, [ready, profile?.displayName, heroPresenceKey]);

  // ---------- nipplejs ----------
  useEffect(() => {
    if (!ready) return undefined;
    const zone = stickRef.current; if (!zone) return undefined;
    let manager = null, raf = 0, tries = 0;
    const onMove = (_e, d) => { const g = G.current; if (!g || !d.vector) return; const f = Math.min(1, d.force || 0); g.stick = { x: d.vector.x * f, y: -d.vector.y * f }; };
    const onEnd = () => { const g = G.current; if (g) g.stick = null; };
    const setup = () => {
      if (zone.clientWidth === 0) { if (getComputedStyle(zone).display !== 'none' && tries++ < 20) raf = requestAnimationFrame(setup); return; }
      // exact Kingdom Heroes joystick config (bottom-left, dynamic under-thumb).
      manager = nipplejs.create({ zone, mode: 'dynamic', color: 'rgba(255,255,255,0.55)', size: 112, threshold: 0.15, fadeTime: 120, restJoystick: true });
      manager.on('move', onMove); manager.on('end', onEnd);
    };
    raf = requestAnimationFrame(setup);
    return () => { cancelAnimationFrame(raf); if (manager) manager.destroy(); const g = G.current; if (g) g.stick = null; };
  }, [ready]);

  return (
    <div className="room-full">
      <div className="room-canvas" ref={wrapRef}>
        <canvas ref={canvasRef} tabIndex={0} />
        {!ready && <div className="room-loading">Growing your valley…</div>}
        <div className="stick-zone" ref={stickRef} />
        {devOn && (
          <div className="map-legend">
            <button className="map-legend-head" onClick={() => setShowLegend((v) => !v)}>
              🗺️ Map key <span>{showLegend ? '▾' : '▸'}</span>
            </button>
            {showLegend && (
              <div className="map-legend-body">
                <div className="map-legend-note"><span className="lg-walk" /> walk · <span className="lg-block" /> no-walk</div>
                {ZONES_ANNOT.map((z) => (
                  <div className="map-legend-row" key={z.n}>
                    <span className={'lg-num ' + (z.walk ? 'lg-walk' : 'lg-block')}>{z.n}</span>
                    <span className="lg-label">{z.label}{z.custom ? ' 🎨' : ''}{z.noDraw ? ' ⛔art' : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {snap && (
          <>
            <Hud snap={snap} game={logicRef.current} onUse={doUse} onSleep={doSleep} onToggleMount={toggleMount} onOpen={(name) => { if (name === 'shop') setShopTab('seeds'); setPanel(name); }}
              zoom={zoom} setZoom={setZoom} speed={speed} setSpeed={setSpeed} usingHero={usingHero} hero={hero} presence={presence} circleId={circleId}
              getSyncDebug={() => presenceCtrlRef.current?.debug?.() || null}
              battle={battle} battleSkills={battleSkills} onStrike={doStrike} onSkill={doSkill}
              onHarvestAll={doHarvestAll} onPlantAll={doPlantAll} devMode={devMode} onToggleDev={toggleDev} />
            <Panels panel={panel} snap={snap} game={logicRef.current} mech={mechSnap} mechGame={mechRef.current} shopTab={shopTab} onClose={() => setPanel(null)} />
            {tileFan && (
              <TileFan fan={tileFan} game={logicRef.current} snap={snap}
                onResult={popFanResult} onClose={() => setTileFan(null)} />
            )}
            <HotspotPanels hotspot={hotspot} snap={snap} game={logicRef.current} mech={mechSnap}
              mechGame={mechRef.current} onClose={() => setHotspot(null)} onEnterDungeon={enterDungeon}
              castleSkin={castleSkin} onCastleSkin={setCastleSkin} />
          </>
        )}
        {daySplash && (
          <div className="day-splash" aria-live="polite">
            <div className="day-splash-card">
              <span className="ds-sun">☀</span>
              <b>Day {daySplash.day}</b>
              <em>{daySplash.season}</em>
            </div>
          </div>
        )}
        {kickedBy && (
          <div className="kicked-overlay">
            <div className="kicked-card">
              <b>Signed in on another device</b>
              <p>This farm session was taken over by a newer login. Nothing was lost — your progress lives in the circle save.</p>
              <button onClick={() => window.location.reload()}>Play here instead</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
