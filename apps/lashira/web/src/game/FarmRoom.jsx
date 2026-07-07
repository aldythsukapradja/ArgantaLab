// Canvas-2D farm room — the SAME rendering engine as Kingdom Heroes' arena
// (TestRoom), so the farmer is the player's real composited Heroes character.
// Tile-step movement, nipplejs + WASD, camera-follow. Falls back to a placeholder
// farmer sprite if the Kingdom art host is unreachable.
import { useEffect, useRef, useState } from 'react';
import nipplejs from 'nipplejs';
import { FarmLogic } from './farm-logic.js';
import { buildFarmMap, drawAnimalSprite, drawKinSprite, drawMountPlaceholder, drawPlot, drawPlaceholderFarmer, FIELD, TILE, W, H, WORLD_W, WORLD_H } from './farm-map.js';
import { loadFarmArtOverrides } from './farm-art-runtime.js';
import { loadAcquiredKins } from './arganta-kin.js';
import { hasActualKinArt } from './kin-sprite-image.jsx';
import { joinFarmPresence } from './farm-presence.js';
import { loadMotionTables, loadPlayerResources } from '../net/hero.js';
import { resolveStep, paintStep, stepCount, drawListBBox } from '../engine/compositor.js';
import { Hud } from '../ui/Hud.jsx';
import { Panels } from '../ui/Panels.jsx';
import { CROPS } from '../data/crops.js';

const DIR_BY_KEY = { ArrowUp: 'North', w: 'North', ArrowDown: 'South', s: 'South', ArrowLeft: 'West', a: 'West', ArrowRight: 'East', d: 'East' };
const DELTA = { North: [0, -1], South: [0, 1], East: [1, 0], West: [-1, 0] };
const FACE_WORD = { North: 'up', South: 'down', East: 'right', West: 'left' };
const WALK_MS = 260;
const REMOTE_WALK_MS = 280;
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
  return out;
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
  const [zoom, setZoom] = useState(1); // default 1x on every screen size; adjustable in Settings
  const [usingHero, setUsingHero] = useState(false);
  const [presence, setPresence] = useState({ count: 0, names: [] });
  const [kickedBy, setKickedBy] = useState(null); // session singleton: newer login elsewhere
  const [daySplash, setDaySplash] = useState(null); // shared New Day banner (local sleep, peer intent, or adopted snapshot)
  const lastDayEventRef = useRef(0);
  const splashTimerRef = useRef(0);
  const heroPresenceKey = heroSpecKey(hero?.spec);

  // ---------- init ----------
  useEffect(() => {
    let live = true;
    const logic = new FarmLogic(profile, circleId);
    logicRef.current = logic;
    if (import.meta.env.DEV) window.__farm = logic;

    (async () => {
      await logic.ready;
      const [art, acquiredKins] = await Promise.all([
        loadFarmArtOverrides(),
        loadAcquiredKins(profile),
      ]);
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
        held: prev?.held || new Set(), stick: prev?.stick || null, zoom, viewportW: prev?.viewportW || 0, viewportH: prev?.viewportH || 0, dpr: prev?.dpr || 1,
        actors: prev?.actors || new Map(), peerActors: prev?.peerActors || new Map(), peerWorldActors: prev?.peerWorldActors || new Map(), pendingMountCall: false,
        lastPresenceSnapshot: '', lastPresenceAt: 0,
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
    setPresence({ count: 0, names: [] });

    if (!circleId || !profile || profile.guest) return undefined;

    let closed = false;
    // Peer's granular change → apply per-field (never re-emitted).
    const applyIntent = (intent) => {
      if (closed) return;
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
      const rows = [];
      for (const peer of peers || []) {
        const tile = readTile(peer.tile);
        if (!tile) continue;
        const id = String(peer.id || '');
        if (!id || id === presenceProfileId(profile)) continue;
        rows.push({ id, peer, tile });
        live.add(id);
        names.push(peer.name || 'Farmer');
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
          const kind = fa.kind === 'animal' ? 'animal' : fa.kind === 'kin' ? 'kin' : fa.kind === 'mount' ? 'mount' : null;
          if (!kind) continue;
          // Kins + mounts are OWNER-simulated (every peer's are shown, with an
          // owner tag); animals come only from the elected host.
          if (kind === 'animal' && id !== host) continue;
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
          }
        }
      }
      for (const id of [...g.peerActors.keys()]) if (!live.has(id)) g.peerActors.delete(id);
      for (const id of [...g.peerWorldActors.keys()]) if (!liveWorld.has(id)) g.peerWorldActors.delete(id);
      setPresence({ count: names.length, names: names.slice(0, 4) });
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
      setPresence({ count: 0, names: [] });
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
  function doUse() {
    const g = G.current; if (!g) return;
    const p = g.player;
    if (!p.oneShot) { p.oneShot = 'Get'; p.oneShotStart = performance.now(); }
    const [tx, ty] = frontTile();
    logicRef.current.actionAt(tx, ty);
  }
  function doSleep() { logicRef.current?.sleep(); }
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
    if (mount) {
      mount.mode = 'called';
      mount.hidden = false;
      mount.speedMs = 170;
      mount.idleUntil = 0;
      mount.callStartedAt = performance.now();
    } else {
      g.pendingMountCall = true;
    }
  }

  // ---------- keyboard ----------
  useEffect(() => {
    if (!ready) return;
    const g = G.current;
    function down(e) {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (DIR_BY_KEY[k]) { g.held.add(k); e.preventDefault(); }
      else if (k === ' ' || k === 'e') { doUse(); e.preventDefault(); }
      else if (k === 'r') toggleMount();
      else if (k === '1') logicRef.current.setTool('hoe');
      else if (k === '2') logicRef.current.setTool('seed');
      else if (k === '3') logicRef.current.setTool('can');
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
      if (!g.actors.has(id)) g.actors.set(id, { id, from: [...init.tile], moveT: 1, moveStart: 0, facing: 'South', idleUntil: 0, seed: id.length * 997, ...init });
      return g.actors.get(id);
    }
    function syncWorldActors(g) {
      const live = new Set();
      const state = logicRef.current?.state;
      if (!state) return;
      const animalConfig = {
        cow: {
          names: ['Daisy', 'Bessie', 'Clover', 'Maple', 'Moochi'],
          home: { x0: 8, y0: 5, x1: 15, y1: 8 },
          starts: [[9, 6], [11, 6], [13, 6], [10, 8], [14, 8]],
          speedMs: 1500,
        },
        sheep: {
          names: ['Wooly', 'Cloud', 'Cotton', 'Fleece', 'Mallow'],
          home: { x0: 14, y0: 5, x1: 21, y1: 8 },
          starts: [[15, 6], [17, 6], [19, 6], [16, 8], [20, 8]],
          speedMs: 1450,
        },
        chicken: {
          names: ['Cluck', 'Pip', 'Sunny', 'Pebble', 'Nugget'],
          home: { x0: 16, y0: 5, x1: 24, y1: 8 },
          starts: [[17, 6], [19, 6], [22, 6], [18, 8], [23, 8]],
          speedMs: 1050,
        },
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
        }
      }
      // Max 6 active Kins per player on the shared farm (loadout picker will let
      // the player choose which — for now the first 6 of the acquired roster).
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
          if (!plot?.tilled || !plot.cropId) continue;
          const [tx, ty] = key.split(',').map(Number);
          if (e.kin.task === 'water' && !plot.watered) { target = [tx, ty]; break; }
          if (e.kin.task === 'harvest' && plot.growth >= (CROPS[plot.cropId]?.days || 999)) { target = [tx, ty]; break; }
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
        if (e.kind === 'mount' && e.mode !== 'called' && inField(nx, ny)) continue;
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
      const actorStamp = actors.map((a) => `${a.id}:${a.tile[0]},${a.tile[1]}:${a.facing}:${a.mode || ''}:${a.hidden ? 1 : 0}`).join('|');
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
      // mounted moves faster — copied AS IS from Kingdom Heroes (WALK_MS * 0.6).
      if (p.moveT < 1) p.moveT = Math.min(1, (now - p.moveStart) / (p.mounted ? WALK_MS * 0.6 : WALK_MS));
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
      publishPresence(g, now);
      draw(g, ctx, canvas, now);
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
        const motion = p.oneShot ? 'Get' + p.facing : playerMotion(g);
        const n = stepCount(g.tables, motion);
        let s;
        if (p.oneShot) s = Math.min(n - 1, Math.floor((now - p.oneShotStart) / 160));
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
    function drawKingdomMount(g, ctx, e, now, footX, footY) {
      const res = g.resources?.mount;
      const animName = { North: 'walk_up', South: 'walk_down', East: 'walk_right', West: 'walk_left' }[e.facing] || 'walk_down';
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
          if (bb) { paintStep(ctx, list, { x: footX - bb.cx, y: footY - bb.y1 }, 1); return; }
        }
      }
      drawMountPlaceholder(ctx, footX, footY, e.facing, Math.floor(now / 260), g.art);
    }
    function drawWorldActor(g, ctx, e, now, footX, footY) {
      const frame = e.moveT < 1 ? Math.floor(e.moveT * 2) : Math.floor(now / 420);
      if (e.kind === 'animal') drawAnimalSprite(ctx, e.species, footX, footY, e.facing, frame, g.art);
      else if (e.kind === 'kin') drawKinSprite(ctx, e.kin, footX, footY, e.facing, frame, g.art);
      else if (e.kind === 'mount' && e.peerMount) drawMountPlaceholder(ctx, footX, footY, e.facing, Math.floor(now / 260), g.art);
      else if (e.kind === 'mount') drawKingdomMount(g, ctx, e, now, footX, footY);
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

      ctx.save();
      ctx.setTransform(g.dpr || 1, 0, 0, g.dpr || 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#7cc35a'; ctx.fillRect(0, 0, cssW, cssH);
      ctx.scale(z, z); ctx.translate(-Math.round(camX), -Math.round(camY));
      ctx.drawImage(g.bg, 0, 0);

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
        actors.push({ type: 'world', e, owner: e.kind === 'kin' ? (e.owner || '') : null, footX: ex + TILE / 2, footY: ey + TILE - 5 });
      }
      for (const e of g.peerActors.values()) {
        const [ex, ey] = entityPx(e);
        actors.push({ type: 'remote', e, footX: ex + TILE / 2, footY: ey + TILE - 5 });
      }
      actors.push({ type: 'player', footX, footY });
      actors.sort((a, b) => a.footY - b.footY);
      const labels = [];
      for (const a of actors) {
        const actualKin = a.e?.kind === 'kin' && hasActualKinArt(a.e.kin);
        if (!actualKin) drawActorShadow(g, ctx, a);
        if (a.type === 'player') {
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
      ctx.restore();
    }
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.clearInterval(heartbeat); };
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
              zoom={zoom} setZoom={setZoom} usingHero={usingHero} hero={hero} presence={presence} circleId={circleId} />
            <Panels panel={panel} snap={snap} game={logicRef.current} onClose={() => setPanel(null)} />
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
