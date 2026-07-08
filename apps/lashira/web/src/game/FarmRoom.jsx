// Canvas-2D farm room — the SAME rendering engine as Kingdom Heroes' arena
// (TestRoom), so the farmer is the player's real composited Heroes character.
// Tile-step movement, nipplejs + WASD, camera-follow. Falls back to a placeholder
// farmer sprite if the Kingdom art host is unreachable.
import { useEffect, useMemo, useRef, useState } from 'react';
import nipplejs from 'nipplejs';
import { FarmLogic } from './farm-logic.js';
import { buildFarmMap, drawAnimalSprite, drawKinSprite, drawMountPlaceholder, drawPlot, drawPlaceholderFarmer, FIELD, PENS, ARENA, inArena, hotspotAt, HOTSPOT_MARKERS, TILE, W, H, WORLD_W, WORLD_H } from './farm-map.js';
import { FarmMechanics } from './farm-mechanics.js';
import { HotspotPanels } from '../ui/HotspotPanels.jsx';
import {
  makeMonster, resolveMelee, resolveSkillSingle, resolveSkillAll, applyHeal, damageMonster,
  tickMonsterState, monsterExpired, skillPower, spawnEffect, drawEffect, battleSkillsFor,
  SKILL_SLOTS, MELEE_DAMAGE, MONSTER_WALK_MS, MONSTER_MAX_HP, PLAYER_MAX_HP, pathMaxHp, pathForWeapon, canAffordSkill,
} from '@arganta/combat';
import { loadFarmArtOverrides } from './farm-art-runtime.js';
import { loadBundledArt } from './farm-art-bundled.js';
import { loadAcquiredKins } from './arganta-kin.js';
import { hasActualKinArt } from './kin-sprite-image.jsx';
import { joinFarmPresence } from './farm-presence.js';
import { loadMotionTables, loadPlayerResources } from '../net/hero.js';
import { resolveStep, paintStep, stepCount, drawListBBox } from '../engine/compositor.js';
import { effects as loadEffects, effectSheetUrl, loadImage as loadEffectImage } from '../engine/data.js';
import { Hud } from '../ui/Hud.jsx';
import { Panels } from '../ui/Panels.jsx';
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

const ARENA_MONSTER_COUNT = 5; // how many roam the arena at once

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
  const [mechSnap, setMechSnap] = useState(null); // mechanics store snapshot (materials/tools/house)
  const mechRef = useRef(null);
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
      const [bundledArt, dbArt, acquiredKins, effectsAll] = await Promise.all([
        loadBundledArt(),
        loadFarmArtOverrides(),
        loadAcquiredKins(profile),
        loadEffects().catch(() => ({})), // Kingdom spell-effect catalog (shared fx)
      ]);
      // Layer priority: DB override > bundled sheet art > procedural placeholder.
      const art = { ...bundledArt, ...dbArt };
      const { canvas: bg, blocked } = buildFarmMap(art);
      let tables = null, resources = null, hasWeapon = false;
      if (hero?.spec) {
        tables = await loadMotionTables();
        if (tables) {
          resources = await loadPlayerResources(hero.spec);
          hasWeapon = !!resources?.weapon;
        }
      }
      if (!live) return;
      const heroOk = !!(tables && resources && Object.keys(resources).length);
      setUsingHero(heroOk);
      if (!profile?.guest) logic.setExternalKins(acquiredKins);
      // Carry live state across a rebuild (this effect re-runs when the hero
      // avatar loads): keep the player where they stand and preserve the peer
      // maps the presence effect populates, so a rebuild never wipes the farmer
      // back to spawn or drops everyone else out of view mid-session.
      const prev = G.current;
      G.current = {
        bg, blocked, tables, resources, hasWeapon, heroOk, art, acquiredKins,
        player: prev?.player || { tile: [12, 12], from: [12, 12], moveT: 1, moveStart: 0, facing: 'South', mounted: false, oneShot: null, oneShotStart: 0, turnHoldDir: null, turnHoldStart: 0 },
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
        if (intent.by === presenceProfileId(profile)) logicRef.current?.rewardKill(intent.name || 'a monster');
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
    if (res?.harvested && res.bloom != null) floatPop(g, res.tx, res.ty, '+' + res.bloom + ' 🌸');
    else if (Array.isArray(res?.harvested)) for (const h of res.harvested) floatPop(g, h.tx, h.ty, '+' + (h.bloom ?? 1) + ' 🌸');
  }
  function doUse() {
    const g = G.current; if (!g) return;
    const p = g.player;
    if (!p.oneShot) { p.oneShot = 'Get'; p.oneShotStart = performance.now(); }
    const [tx, ty] = frontTile();
    // Contextual (same as tapping the land): harvest ripe → plant → clear wilted.
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
    logicRef.current?.flash?.('⚔ Entered the dungeon — clear the beasts!');
  }
  function toggleMount() {
    const g = G.current; if (!g) return;
    if (!g.resources?.mount) return;
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
    for (const base of ['Swing', 'Attack', 'Pierce', 'Shoot']) {
      if (stepCount(g.tables, base + facing) > 0) return base;
    }
    return 'Get';
  }
  function playSwing(g) {
    g.player.oneShot = attackMotionBase(g);
    g.player.oneShotStart = performance.now();
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
      if (res) { spark(g, tx, ty); if (res.killed) logicRef.current?.rewardKill(res.monster.kind || 'a monster'); return true; }
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
    if (!g.combat.on) return;
    const [tx, ty] = frontTile();
    hitTile(g, tx, ty, MELEE_DAMAGE);
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

    if (skill.type === 'heal') {
      const healed = applyHeal(g.combat, skillPower(skill, L));
      castSpell(g, skill, p.tile);
      syncBattleState(g);
      logicRef.current?.flash?.('Mend +' + healed + ' HP');
      return;
    }
    const dmg = skillPower(skill, L);
    const hostSelf = iAmHost(g);
    if (skill.target === 'all') { // Storm — every monster
      if (hostSelf) {
        for (const h of resolveSkillAll(g.monsters, dmg, now)) {
          castSpell(g, skill, h.monster.tile);
          if (h.killed) logicRef.current?.rewardKill(h.monster.kind || 'a monster');
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
      if (res) { castSpell(g, skill, res.monster.tile); if (res.killed) logicRef.current?.rewardKill(res.monster.kind || 'a monster'); }
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
            if (!blockedAt(g, nx, ny)) { p.from = [...p.tile]; p.tile = [nx, ny]; p.moveT = 0; p.moveStart = now; }
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
      const kinds = ['slime', 'bat', 'blob'];
      const m = makeMonster({ id: 'mob:' + (g.monsterSeed >>> 0) + ':' + now, tile, maxHp: MONSTER_MAX_HP });
      m.kind = kinds[Math.floor(monsterRand(g) * kinds.length)];
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
        if (g.monsters.length < ARENA_MONSTER_COUNT && now > g.nextMonsterSpawn) {
          spawnArenaMonster(g, now); g.nextMonsterSpawn = now + 900;
        }
        for (const m of g.monsters) {
          if (m.state === 'die') continue;
          tickMonsterState(m, now);
          if (m.moveT < 1) { m.moveT = Math.min(1, (now - m.moveStart) / MONSTER_WALK_MS); continue; }
          if (now < (m.nextWander || 0)) continue;
          const dirs = Object.keys(DELTA);
          const dir = dirs[Math.floor(monsterRand(g) * 4)];
          const [dx, dy] = DELTA[dir]; const nx = m.tile[0] + dx, ny = m.tile[1] + dy;
          m.facing = dir;
          if (inArena(nx, ny) && !blockedAt(g, nx, ny) && !(nx === p.tile[0] && ny === p.tile[1]) && !g.monsters.some((o) => o !== m && o.state !== 'die' && o.tile[0] === nx && o.tile[1] === ny)) {
            m.from = [...m.tile]; m.tile = [nx, ny]; m.moveT = 0; m.moveStart = now;
          }
          m.nextWander = now + 700 + monsterRand(g) * 1700;
        }
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
        drawAnimalSprite(ctx, e.species, footX, footY + bob, e.facing, frame, g.art, squash);
        // "good ready" badge — a bobbing produce emoji over the animal
        const li = e.livestockId && logicRef.current?.state?.livestock?.find((x) => x.id === e.livestockId);
        if (li && animalGoodReady(li, now)) {
          const em = SPECIES[e.species]?.produceEmoji || '✨';
          const by = footY - (e.species === 'chicken' ? 26 : 44) + Math.sin(now / 260) * 3;
          ctx.save(); ctx.font = '17px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(footX, by, 12, 0, 7); ctx.fill();
          ctx.fillText(em, footX, by + 1); ctx.restore();
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

      // FARM LAYER on top of the basemap — a tilled-plot marker on every empty
      // farmable tile so you can see where to plant; crops draw on planted ones below.
      const fplots = logicRef.current.state.plots;
      for (let ty = FIELD.y0; ty <= FIELD.y1; ty++) for (let tx = FIELD.x0; tx <= FIELD.x1; tx++) {
        if (fplots[tx + ',' + ty]?.cropId) continue;
        ctx.fillStyle = 'rgba(74,48,24,0.30)';
        ctx.fillRect(tx * TILE + 4, ty * TILE + 4, TILE - 8, TILE - 8);
      }

      // plots
      const plots = logicRef.current.state.plots;
      for (const [key, plot] of Object.entries(plots)) { const [tx, ty] = key.split(',').map(Number); drawPlot(ctx, tx, ty, plot, g.art); }

      // target: the tile directly in front of the farmer (filled + outlined so
      // it's unambiguous which tile the tool will act on).
      const [ftx, fty] = [p.tile[0] + DELTA[p.facing][0], p.tile[1] + DELTA[p.facing][1]];
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

      // HOTSPOT STATUS DOTS — green = wired + clickable, red = placeholder not built.
      // Toggle with g.showHotspots (default on). Flip a hotspot's `ported` → dot goes green.
      if (g.showHotspots !== false) {
        const pulse = Math.abs(Math.sin(now / 500));
        for (const mk of HOTSPOT_MARKERS) {
          const wx = mk.x * TILE, wy = mk.y * TILE, c = mk.ported ? '80,220,110' : '235,70,70';
          ctx.beginPath(); ctx.arc(wx, wy, 8 + pulse * 9, 0, 7); ctx.strokeStyle = `rgba(${c},${(0.45 * (1 - pulse) + 0.12).toFixed(2)})`; ctx.lineWidth = 3; ctx.stroke();
          ctx.beginPath(); ctx.arc(wx, wy, 7, 0, 7); ctx.fillStyle = `rgba(${c},0.95)`; ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5; ctx.stroke();
        }
      }
      ctx.restore();
      if (g.stickUI) drawStick(ctx, g); // floating joystick (screen space)
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
      const palette = { slime: '#6fca7a', bat: '#8b6fd0', blob: '#d06f8b' };
      const body = palette[m.mkind || m.kind] || '#6fca7a';
      ctx.save(); ctx.globalAlpha = fade;
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(cx, footY + 2, 13, 5, 0, 0, 7); ctx.fill();
      // body
      const hitFlash = m.state === 'hit' && (now - m.stateStart) < 200;
      ctx.fillStyle = hitFlash ? '#ffffff' : body;
      ctx.beginPath(); ctx.ellipse(cx, by - 12, 14, 12, 0, 0, 7); ctx.fill();
      ctx.fillStyle = hitFlash ? '#ffffff' : '#ffffff'; // eyes
      const ex = m.facing === 'West' ? -4 : m.facing === 'East' ? 4 : 0;
      ctx.beginPath(); ctx.arc(cx - 5 + ex, by - 14, 2.2, 0, 7); ctx.arc(cx + 5 + ex, by - 14, 2.2, 0, 7); ctx.fill();
      if (!hitFlash) { ctx.fillStyle = '#20303a'; ctx.beginPath(); ctx.arc(cx - 5 + ex, by - 14, 1.1, 0, 7); ctx.arc(cx + 5 + ex, by - 14, 1.1, 0, 7); ctx.fill(); }
      // hp bar
      if (m.state !== 'die') {
        const w = 26, hpx = cx - w / 2, hpy = by - 32, frac = Math.max(0, m.hp / (m.maxHp || 100));
        ctx.fillStyle = 'rgba(18,22,32,0.6)'; ctx.fillRect(hpx - 1, hpy - 1, w + 2, 5);
        ctx.fillStyle = frac > 0.5 ? '#57d06a' : frac > 0.25 ? '#e0c020' : '#e0553f';
        ctx.fillRect(hpx, hpy, Math.round(w * frac), 3);
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
        if (hs.kind === 'ore') mechRef.current?.mine(hs);
        else if (hs.kind === 'tree') mechRef.current?.chop(hs);
        else if (hs.kind === 'sell') setPanel('shop');
        else setHotspot(hs);
        return;
      }
      if (tx >= FIELD.x0 && tx <= FIELD.x1 && ty >= FIELD.y0 && ty <= FIELD.y1) {
        popHarvestResult(g, logicRef.current?.tapAt(tx, ty)); faceTo(tx, ty); return;
      }
      let best = null, bestD = 1.3;
      for (const a of g.actors.values()) {
        if (a.kind !== 'animal' || !a.livestockId) continue;
        const [ax, ay] = actorTileAt(a);
        const d = Math.hypot(ax + 0.5 - wx, ay + 0.5 - wy);
        if (d < bestD) { bestD = d; best = a; }
      }
      if (best) { logicRef.current?.tapAnimal(best.livestockId); faceTo(best.tile[0], best.tile[1]); }
    }

    // ---------- unified pointer input: drag = move, tap = interact ----------
    // A press-and-drag ANYWHERE on the canvas is a floating joystick (trackpad +
    // touch friendly — this is the "trackpad logic"); a quick tap interacts.
    let ptr = null;
    const DRAG_DEAD = 12; // px of movement before a press counts as a drag
    function onPointerDown(e) {
      if (e.button != null && e.button !== 0) return;
      ptr = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dragging: false };
      try { canvas.setPointerCapture(e.pointerId); } catch { /* older browsers */ }
    }
    function onPointerMove(e) {
      if (!ptr || e.pointerId !== ptr.id) return;
      const dx = e.clientX - ptr.x0, dy = e.clientY - ptr.y0;
      const dist = Math.hypot(dx, dy);
      if (!ptr.dragging && dist > DRAG_DEAD) ptr.dragging = true;
      if (!ptr.dragging) return;
      const g = G.current; if (!g) return;
      const mag = Math.min(1, dist / 66);           // full tilt at ~66px drag
      g.stick = { x: (dx / (dist || 1)) * mag, y: (dy / (dist || 1)) * mag }; // screen down = +y = South
      const rect = canvas.getBoundingClientRect();
      g.stickUI = { bx: ptr.x0 - rect.left, by: ptr.y0 - rect.top, kx: e.clientX - rect.left, ky: e.clientY - rect.top };
    }
    function onPointerUp(e) {
      if (!ptr || e.pointerId !== ptr.id) return;
      const wasDrag = ptr.dragging; const { x0, y0 } = ptr;
      ptr = null;
      const g = G.current; if (g) { g.stick = null; g.stickUI = null; }
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      if (!wasDrag) onTapInteract(x0, y0); // it was a tap, not a move
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
        {snap && (
          <>
            <Hud snap={snap} game={logicRef.current} onUse={doUse} onSleep={doSleep} onToggleMount={toggleMount} onOpen={setPanel}
              zoom={zoom} setZoom={setZoom} speed={speed} setSpeed={setSpeed} usingHero={usingHero} hero={hero} presence={presence} circleId={circleId}
              getSyncDebug={() => presenceCtrlRef.current?.debug?.() || null}
              battle={battle} battleSkills={battleSkills} onStrike={doStrike} onSkill={doSkill}
              onHarvestAll={doHarvestAll} onPlantAll={doPlantAll} />
            <Panels panel={panel} snap={snap} game={logicRef.current} onClose={() => setPanel(null)} />
            <HotspotPanels hotspot={hotspot} snap={snap} game={logicRef.current} mech={mechSnap}
              mechGame={mechRef.current} onClose={() => setHotspot(null)} onEnterDungeon={enterDungeon} />
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
