// Buya (Chonsa) Arena — fullscreen playfield with a Ragnarok-M style HUD.
//
// Scale law: 1 tile = 48px at zoom 1; sprites native pixels; camera clamped.
// Desktop: WASD/arrows + Space/E/R/Q/1-3, HUD docked bottom-right.
// Mobile: virtual joystick bottom-left, big Attack circle + skill circles
// bottom-right, ⚙ settings popup for spawns/skills/zoom.
import { useEffect, useRef, useState } from 'react';
import nipplejs from 'nipplejs';
import TierIcon from '../components/TierIcon.jsx';
import { RANK_TIERS, rankTierIndex } from '../net/account.js';
import * as data from '../engine/data.js';
import { loadJson, loadImage } from '../engine/data.js';
import { resolveStep, paintStep, stepCount } from '../engine/compositor.js';
import { authAvailable, awardMonsterXp } from '../net/account.js';
import { joinArena } from '../net/arenaNet.js';
// Shared combat system — single source of truth (also imported by the farm).
import {
  ATTACK_BY_WEAPON, MELEE_DAMAGE, PVP_DAMAGE, MONSTER_WALK_MS,
  normalizeSkills, resolveMelee, tickMonsterState, monsterExpired,
} from '@arganta/combat';
import { ActionCluster } from '@arganta/combat/cluster';

const TILE = 48;
const WALK_MS = 460;
const TURN_HOLD_MS = 140;
const SPAWN_KIND_MONSTER = 'monster';
const DIR_BY_KEY = {
  ArrowUp: 'North', w: 'North', ArrowDown: 'South', s: 'South',
  ArrowLeft: 'West', a: 'West', ArrowRight: 'East', d: 'East',
};
const DELTA = { North: [0, -1], South: [0, 1], East: [1, 0], West: [-1, 0] };
const MOB_DIR = { South: 'down', North: 'up', East: 'right', West: 'left' };
const fmt = (n) => Number(n || 0).toLocaleString();
const xpProgress = (xp) => Math.round(((Math.max(0, Number(xp || 0)) % 500) / 500) * 100);
const mapLabel = (mapId) => (mapId === 'character_lab' ? 'Character Lab' : mapId === 'buya_arena' ? 'Buya Arena' : (mapId || 'Kingdom').replace(/_/g, ' '));

function sameTile(a, b) {
  return a?.[0] === b?.[0] && a?.[1] === b?.[1];
}

function tileOccupied(g, tile, opts = {}) {
  const { ignorePlayer = false } = opts;
  if (!ignorePlayer && sameTile(g.player.tile, tile)) return true;
  for (const m of g.monsters) {
    if (m.state !== 'die' && sameTile(m.tile, tile)) return true;
  }
  for (const r of Object.values(g.remotes || {})) {
    if ((r.hp ?? 100) > 0 && (sameTile(r.tile, tile) || (r.moveT < 1 && sameTile(r.from, tile)))) {
      return true;
    }
  }
  return false;
}

function uid(prefix = 'id') {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 9)}`;
}

// ---- canvas badge images (rank crest + guardian shield) ----
// The DOM HUD uses <TierIcon>; canvas nameplates can't, so we rasterize the same
// crest to an <img> once per tier and drawImage it on the nameplate. Same for
// the guardian shield. Cached at module scope so it's built once.
function shadeHex(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + Math.round(255 * pct)));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) + Math.round(255 * pct)));
  const b = Math.min(255, Math.max(0, (n & 255) + Math.round(255 * pct)));
  return `rgb(${r},${g},${b})`;
}
function svgImage(svg) {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return img;
}
const CREST_CACHE = [];
function crestImage(tierIndex) {
  const i = Math.max(0, Math.min(RANK_TIERS.length - 1, tierIndex | 0));
  if (CREST_CACHE[i]) return CREST_CACHE[i];
  const t = RANK_TIERS[i];
  const light = shadeHex(t.color, 0.2), dark = shadeHex(t.color, -0.28);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56">` +
    `<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient>` +
    `<radialGradient id="b" cx="50%" cy="42%" r="60%"><stop offset="0" stop-color="${t.color}" stop-opacity="0.28"/><stop offset="1" stop-color="${t.color}" stop-opacity="0"/></radialGradient></defs>` +
    `<circle cx="28" cy="28" r="26" fill="url(#b)"/>` +
    `<path d="M28 5 L47 15 V33 L28 51 L9 33 V15 Z" fill="url(#a)" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M28 5 L47 15 L28 27 L9 15 Z" fill="#ffffff" opacity="0.22"/>` +
    `<text x="28" y="35" text-anchor="middle" font-size="20" font-weight="800" fill="#ffffff" font-family="system-ui,sans-serif">${t.glyph}</text>` +
    `<ellipse cx="20" cy="16" rx="5" ry="2.6" fill="#ffffff" opacity="0.55" transform="rotate(-24 20 16)"/></svg>`;
  CREST_CACHE[i] = svgImage(svg);
  return CREST_CACHE[i];
}
let SHIELD_IMG = null;
function shieldImage() {
  if (SHIELD_IMG) return SHIELD_IMG;
  SHIELD_IMG = svgImage(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">` +
    `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fd0a6"/><stop offset="1" stop-color="#1f8863"/></linearGradient></defs>` +
    `<path d="M12 2 4 5v6c0 4.6 3.3 8.5 8 9.8 4.7-1.3 8-5.2 8-9.8V5z" fill="url(#s)" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<path d="M8.6 11.8l2.3 2.3 4-4.2" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  );
  return SHIELD_IMG;
}

// ---- crisp HUD/control icons (emoji renders inconsistently; SVG stays sharp) ----
const IconHeart = () => (
  <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true">
    <path d="M12 21s-7.2-4.6-9.7-8.7C.6 9 2.6 5.4 6.2 5.4c2.1 0 3.6 1.2 4.6 2.6 1-1.4 2.5-2.6 4.6-2.6 3.6 0 5.6 3.6 3.9 6.9C19.2 16.4 12 21 12 21z" />
  </svg>
);
const IconMana = () => (
  <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true">
    <path d="M12 2.5c0 0 7 7.6 7 12.2A7 7 0 0 1 5 14.7C5 10.1 12 2.5 12 2.5z" />
  </svg>
);
const IconHand = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" /><path d="M11 11.5V4a1.5 1.5 0 0 1 3 0v8" />
    <path d="M14 12V6.5a1.5 1.5 0 0 1 3 0V13" /><path d="M17 12.5a1.5 1.5 0 0 1 3 0V16a5 5 0 0 1-5 5h-2.3a5 5 0 0 1-3.5-1.5L5 15.5a1.6 1.6 0 0 1 2.3-2.3L9 15" />
  </svg>
);
const IconMount = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
    <path d="M3 5c1.6.2 2.7 1 3.5 2.3L8 9l3.5-.4c2.6-.3 5 .8 6.6 2.9l1.9 2.5-2 .3-1.6-1.4-.6 3.9c-.1.9-.9 1.5-1.8 1.4-.8-.1-1.4-.9-1.3-1.7l.5-3.4-2.9.3-1.2 3.7c-.3.8-1.1 1.2-1.9 1-.8-.3-1.2-1.1-1-1.9l1.1-3.4c-1.3-.7-2.2-2-2.4-3.6L3 5z" />
  </svg>
);
const IconFriends = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6" /><path d="M17.5 14.4A5.5 5.5 0 0 1 20.5 19" />
  </svg>
);

export default function TestRoom({ spec, account, onPlayerState }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const stickZoneRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [spawnList, setSpawnList] = useState([]);
  const [spawnPick, setSpawnPick] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [skills, setSkills] = useState(() => normalizeSkills(spec.skills));
  // Camera zoom: default 1×, but remembered per character (the Camera slider in
  // settings writes it back). So each hero keeps its own preferred framing.
  const zoomKey = account?.character?.id ? `kingdom-zoom:${account.character.id}` : null;
  const [zoom, setZoom] = useState(() => {
    if (zoomKey && typeof localStorage !== 'undefined') {
      const saved = Number(localStorage.getItem(zoomKey));
      if (Number.isFinite(saved) && saved >= 0.5 && saved <= 3) return saved;
    }
    return 1.0;
  });
  const [hudState, setHudState] = useState({ hp: 100, maxHp: 100, mp: 40, maxMp: 40 });
  const [peerList, setPeerList] = useState([]);
  const G = useRef(null);

  useEffect(() => {
    setSkills(normalizeSkills(spec.skills));
  }, [JSON.stringify(spec.skills || null)]);

  function keepCanvasFocus(e) {
    e.preventDefault();
    canvasRef.current?.focus({ preventScroll: true });
  }

  // ---------- init ----------
  useEffect(() => {
    let live = true;
    (async () => {
      const [tables, bg, coreMonsters, links, mobsAll, effectsAll] = await Promise.all([
        data.motionTables(),
        loadImage(data.dataUrl('/data/assets/map-images/chonsa-arena-room.png')),
        loadJson(data.dataUrl('/data/core/monsters.json')),
        fetch(data.dataUrl('/data/links/monster-links.json')).then((r) => (r.ok ? r.json() : []), () => []),
        data.monsters(),
        data.effects(),
      ]);
      const resources = await loadPlayerResources(spec);
      const linked = links
        .filter((l) => l.status !== 'rejected')
        .map((l) => {
          const mon = coreMonsters.find((m) => m.id === l.monsterId);
          return mon ? {
            monsterTemplateId: mon.id,
            name: mon.name,
            xp: mon.defaultExperience || 0,
            mobId: l.mobId,
            paletteId: l.paletteId,
          } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (!live) return;
      const stats = account?.stats || {};
      const maxHp = Number(stats.maxHp || 100);
      const maxMp = Number(stats.maxMp || 40);
      G.current = {
        tables, bg, mobsAll, effectsAll, linked,
        gridW: Math.round(bg.width / TILE),
        gridH: Math.round(bg.height / TILE),
        player: {
          resources, tile: [8, 8], from: [8, 8], moveT: 1, facing: 'South',
          mounted: false, oneShot: null, oneShotStart: 0, hp: maxHp, maxHp, mp: maxMp, maxMp,
          turnHoldDir: null, turnHoldStart: 0,
          name: account?.character?.name || account?.profile?.display_name || 'you',
          displayName: account?.profile?.display_name || account?.profile?.displayName || account?.character?.name || 'you',
          accountType: account?.accountType || 'adult',
          rank: account?.profile?.rank || null,
          guardian: account?.guardian || null,
        },
        monsters: [], monsterIds: new Set(), fx: [], zoom: 1.6, viewportW: 0, viewportH: 0, dpr: 1, stick: null, held: new Set(),
        weaponCat: spec.weapon?.cat || null,
        remotes: {}, net: null,
      };
      setHudState({ hp: maxHp, maxHp, mp: maxMp, maxMp });
      setSpawnList(linked);
      setSpawnPick(linked[0]?.name || '');
      setReady(true);
      console.log('[room] init ok', { grid: [G.current.gridW, G.current.gridH], linked: linked.length });
    })().catch((err) => console.error('[room] init failed:', err));
    return () => { live = false; };
  }, [JSON.stringify(spec), account?.character?.id, account?.stats?.maxHp, account?.stats?.maxMp]);

  useEffect(() => {
    if (G.current) G.current.zoom = zoom;
    if (zoomKey) { try { localStorage.setItem(zoomKey, String(zoom)); } catch { /* ignore */ } }
  }, [zoom, zoomKey]);

  async function loadPlayerResources(spec_) {
    const keys = ['body', 'coat', 'face', 'hair', 'helmet', 'weapon', 'shield', 'mantle', 'shoes', 'neck', 'facedec', 'hairdec'];
    const out = {};
    await Promise.all(keys.map(async (key) => {
      const sel = spec_[key];
      if (!sel || sel.id == null) return;
      const cat = sel.cat || key;
      const parts = await data.charParts(cat);
      const part = parts.find((p) => p.id === sel.id);
      if (!part?.sheet) return;
      let sheet;
      if (sel.palette != null && sel.palette !== part.palette_id && part.idx_sheet) {
        const { tintedSheet } = await import('../engine/palettes.js');
        const palettes = await data.charPalettes(cat);
        sheet = await tintedSheet(loadImage(data.idxSheetUrl(cat, part)), palettes[sel.palette] || palettes[0], `${cat}:${part.id}:${sel.palette}`);
      } else {
        sheet = await loadImage(data.sheetUrl(cat, part));
      }
      out[key] = { part, sheet };
    }));
    if (spec_.mount?.id != null) {
      const all = await data.mounts();
      const creature = all[spec_.mount.id];
      if (creature?.sheet) out.mount = { creature, sheet: await loadImage(data.mountSheetUrl(creature)) };
    }
    return out;
  }

  // ---------- multiplayer (MP-0: intents over Supabase Realtime) ----------
  useEffect(() => {
    if (!ready || !authAvailable || !account?.character) return;
    const g = G.current;

    async function addRemote(id, meta) {
      if (g.remotes[id]) { Object.assign(g.remotes[id].meta, meta); return; }
      const remote = {
        id, meta,
        tile: meta.tile || [4, 4], from: null, moveT: 1, moveStart: 0,
        facing: meta.facing || 'South', oneShot: null, oneShotStart: 0,
        hp: meta.hp ?? meta.maxHp ?? 100, maxHp: meta.maxHp ?? 100, resources: null,
      };
      g.remotes[id] = remote;
      remote.resources = await loadPlayerResources(meta.spec || {});
    }

    const net = joinArena({
      me: {
        characterId: account.character.id,
        profileId: account.profile?.id || account.user?.id || null,
        name: account.character.name,
        displayName: account.profile?.display_name || account.profile?.displayName || account.character.name,
        accountType: account.accountType,
        rank: account.profile?.rank || null,
        stats: account.stats || null,
        guardian: account.guardian || null,
        sessionToken: account.session?.sessionToken || null,
        spec, tile: g.player.tile, facing: g.player.facing,
        hp: g.player.hp, maxHp: g.player.maxHp, mp: g.player.mp, maxMp: g.player.maxMp,
      },
      onPeers: (peers) => {
        for (const id of Object.keys(g.remotes)) {
          if (!peers[id]) delete g.remotes[id];
        }
        setPeerList(Object.entries(peers).map(([id, meta]) => ({
          id,
          profile_id: meta.profileId || meta.profile_id || null,
          character_id: id,
          character_name: meta.name || meta.characterName || 'Friend',
          display_name: meta.displayName || meta.display_name || meta.name || 'Friend',
          map_id: 'buya_arena',
          status: 'online',
          source: 'arena_peer',
        })));
        for (const [id, meta] of Object.entries(peers)) addRemote(id, meta);
      },
      onEvent: (ev) => {
        const r = g.remotes[ev.from];
        if (ev.type === 'move' && r) {
          r.from = [...r.tile]; r.tile = ev.tile; r.facing = ev.facing;
          if (sameTile(r.from, r.tile)) {
            r.moveT = 1; r.moveStart = performance.now();
          } else {
            r.moveT = 0; r.moveStart = performance.now();
          }
        } else if (ev.type === 'action' && r) {
          r.oneShot = ev.motion; r.oneShotStart = performance.now();
          setTimeout(() => { if (r.oneShot === ev.motion) r.oneShot = null; }, 1200);
        } else if (ev.type === 'spawn') {
          spawnEntityFromIntent(g, ev);
        } else if (ev.type === 'monster_move') {
          applyMonsterMove(g, ev);
        } else if (ev.type === 'monster_state') {
          applyMonsterState(g, ev);
        } else if (ev.type === 'hp' && r) {
          r.hp = ev.hp;
        } else if (ev.type === 'attack' && ev.target === account.character.id) {
          // MP-0 referee rule: the victim validates and applies its own damage
          const p = g.player;
          const dist = r ? Math.abs(r.tile[0] - p.tile[0]) + Math.abs(r.tile[1] - p.tile[1]) : 99;
          if (dist <= 1) {
            p.hp = Math.max(0, p.hp - PVP_DAMAGE);
            setHudState((h) => ({ ...h, hp: p.hp, maxHp: p.maxHp, mp: p.mp, maxMp: p.maxMp }));
            net.send('hp', { hp: p.hp });
            if (p.hp <= 0) {
              pushToast(`☠ Defeated by ${r?.meta?.name || 'a rival'} — respawning`);
              net.send('defeat', { by: ev.from });
              p.tile = [8, 13]; p.from = [...p.tile]; p.moveT = 1; p.hp = p.maxHp;
              setHudState((h) => ({ ...h, hp: p.hp, maxHp: p.maxHp, mp: p.mp, maxMp: p.maxMp }));
              net.send('move', { tile: p.tile, facing: p.facing });
              net.send('hp', { hp: p.hp });
            }
          }
        } else if (ev.type === 'defeat' && ev.by === account.character.id) {
          pushToast(`🏆 You defeated ${g.remotes[ev.from]?.meta?.name || 'a rival'}!`);
        }
      },
    });
    g.net = net;
    return () => { net.leave(); g.net = null; g.remotes = {}; setPeerList([]); };
  }, [ready, account?.character?.id, account?.session?.sessionToken, JSON.stringify(account?.profile?.rank || null)]);

  // ---------- shared actions (keyboard + HUD) ----------
  function startOneShot(motion) {
    const g = G.current; if (!g) return;
    const p = g.player;
    if (p.oneShot) return false;
    p.oneShot = motion;
    p.oneShotStart = performance.now();
    g.net?.send('action', { motion });
    return true;
  }
  function doAttack() {
    const g = G.current; if (!g) return;
    const motion = ATTACK_BY_WEAPON[g.weaponCat] || 'Swing';
    if (!startOneShot(motion)) return;
    strike(g);
  }
  function doSkill(i) {
    const g = G.current; if (!g) return;
    const cost = Number(skills[i]?.manaCost || 0);
    if (cost > 0 && g.player.mp < cost) {
      pushToast('Not enough MP.');
      return;
    }
    if (!startOneShot('Spell')) return;
    if (cost > 0) {
      g.player.mp = Math.max(0, g.player.mp - cost);
      setHudState((h) => ({ ...h, mp: g.player.mp, maxMp: g.player.maxMp }));
    }
    spawnEffect(g, skills[i]?.fx ?? 22, g.player);
  }
  function doTake() { startOneShot('Get'); }
  function doEmote() { startOneShot('Victory'); }
  function toggleMount() {
    const g = G.current; if (!g) return;
    g.player.mounted = !g.player.mounted && !!g.player.resources.mount;
  }

  function spawnEffect(g, id, at) {
    const eff = g.effectsAll[id];
    if (!eff?.sheet || !eff.animation?.length) return;
    loadImage(data.effectSheetUrl(eff)).then((sheet) => {
      g.fx.push({ eff, sheet, at, start: performance.now() });
    });
  }
  function strike(g) {
    const [dx, dy] = DELTA[g.player.facing];
    const tx = g.player.tile[0] + dx, ty = g.player.tile[1] + dy;
    // PvP first: attack intent at the player standing on the faced tile
    const victim = Object.values(g.remotes || {}).find(
      (r) => r.hp > 0 && r.tile[0] === tx && r.tile[1] === ty
    );
    if (victim) {
      setTimeout(() => g.net?.send('attack', { target: victim.id }), 180);
      return;
    }
    setTimeout(() => {
      const res = resolveMelee(g.monsters, tx, ty, MELEE_DAMAGE, performance.now());
      if (!res) return;
      const m = res.monster;
      if (res.killed) {
        g.net?.send('monster_state', { id: m.id, state: 'die', hp: 0 });
        rewardMonsterKill(m);
      } else {
        g.net?.send('monster_state', { id: m.id, state: 'hit', hp: m.hp });
      }
    }, 180);
  }
  async function rewardMonsterKill(monster) {
    if (monster.rewarded) return;
    monster.rewarded = true;
    if (account?.accountType === 'kid') {
      pushToast(`You defeated ${monster.name}.`);
      return;
    }
    if (!monster.monsterTemplateId) {
      pushToast(`You defeated ${monster.name}.`);
      return;
    }
    const reward = await awardMonsterXp(monster.monsterTemplateId, {
      monsterName: monster.name,
      arena: 'buya_arena',
      clientMobId: monster.mobId,
    });
    if (reward?.error) {
      pushToast(`You defeated ${monster.name}.`);
      return;
    }
    pushToast(reward?.toast || `You defeated ${monster.name}.`);
    onPlayerState?.(reward);
  }
  function pushToast(text) {
    setToasts((t) => [...t.slice(-4), { id: Math.random(), text }]);
    setTimeout(() => setToasts((t) => t.slice(1)), 2600);
  }
  function randomOpenTile(g) {
    for (let i = 0; i < 80; i++) {
      const tile = [3 + Math.floor(Math.random() * (g.gridW - 6)), 3 + Math.floor(Math.random() * (g.gridH - 6))];
      if (!tileOccupied(g, tile)) return tile;
    }
    return [Math.max(1, Math.min(g.gridW - 2, g.player.tile[0] + 1)), g.player.tile[1]];
  }

  function addMonster(g, payload) {
    if (!payload?.id || g.monsterIds.has(payload.id)) return;
    const mob = g.mobsAll[payload.mobId];
    if (!mob?.sheet) return;
    g.monsterIds.add(payload.id);
    loadImage(data.monsterSheetUrl(mob)).then((sheet) => {
      if (!G.current || g.monsters.some((m) => m.id === payload.id)) return;
      g.monsters.push({
        id: payload.id,
        kind: payload.kind || SPAWN_KIND_MONSTER,
        friendly: payload.kind === 'guardian',
        name: payload.name || `mob #${payload.mobId}`,
        xp: payload.xp || 0,
        monsterTemplateId: payload.monsterTemplateId || null,
        guardianId: payload.guardianId || null,
        mobId: payload.mobId,
        paletteId: payload.paletteId ?? null,
        ownerId: payload.ownerId || null,
        aiOwnerId: payload.aiOwnerId || payload.ownerId || null,
        source: payload.source || 'settings',
        mob, sheet,
        tile: payload.tile || randomOpenTile(g),
        from: null, moveT: 1, facing: payload.facing || 'South',
        hp: payload.hp || 100, maxHp: payload.maxHp || 100, state: 'stand', stateStart: 0,
        nextWander: performance.now() + 800 + Math.random() * 1200,
      });
    }).catch(() => g.monsterIds.delete(payload.id));
  }

  function spawnEntityFromIntent(g, ev) {
    if (ev.kind === SPAWN_KIND_MONSTER || ev.kind === 'guardian') addMonster(g, ev.entity);
  }

  function spawnMonster(name, source = 'settings') {
    const g = G.current; if (!g) return;
    const pick = g.linked.find((l) => l.name === (name || spawnPick));
    if (!pick) return;
    const payload = {
      id: uid('monster'),
      kind: SPAWN_KIND_MONSTER,
      ownerId: account?.character?.id || null,
      aiOwnerId: account?.character?.id || null,
      source,
      name: pick.name,
      xp: pick.xp,
      monsterTemplateId: pick.monsterTemplateId,
      mobId: pick.mobId,
      paletteId: pick.paletteId ?? null,
      tile: randomOpenTile(g),
      facing: 'South',
      hp: 100,
      maxHp: 100,
    };
    addMonster(g, payload);
    g.net?.send('spawn', { kind: SPAWN_KIND_MONSTER, entity: payload });
  }

  function spawnGuardian() {
    const g = G.current; if (!g) return;
    const guardian = account?.guardian;
    if (!guardian?.clientMobId) {
      pushToast('No equipped guardian sprite is available yet.');
      return;
    }
    const payload = {
      id: uid('guardian'),
      kind: 'guardian',
      ownerId: account?.character?.id || null,
      aiOwnerId: account?.character?.id || null,
      source: 'guardian',
      guardianId: guardian.id,
      name: guardian.displayName,
      xp: 0,
      monsterTemplateId: null,
      mobId: guardian.clientMobId,
      paletteId: guardian.clientPaletteId ?? null,
      tile: randomOpenTile(g),
      facing: 'South',
      hp: guardian.maxHp || 100,
      maxHp: guardian.maxHp || 100,
    };
    addMonster(g, payload);
    g.net?.send('spawn', { kind: 'guardian', entity: payload });
  }

  function findMonster(g, id) {
    return g.monsters.find((m) => m.id === id);
  }

  function applyMonsterMove(g, ev) {
    const m = findMonster(g, ev.id);
    if (!m || m.aiOwnerId === account?.character?.id) return;
    m.from = Array.isArray(ev.from) ? ev.from : [...m.tile];
    m.tile = Array.isArray(ev.tile) ? ev.tile : m.tile;
    m.facing = ev.facing || m.facing;
    m.moveT = sameTile(m.from, m.tile) ? 1 : 0;
    m.moveStart = performance.now();
    m.nextWander = Infinity;
  }

  function applyMonsterState(g, ev) {
    const m = findMonster(g, ev.id);
    if (!m) return;
    m.hp = ev.hp ?? m.hp;
    m.state = ev.state || m.state;
    m.stateStart = performance.now();
    if (m.state === 'stand') m.nextWander = Infinity;
  }

  // ---------- keyboard ----------
  useEffect(() => {
    if (!ready) return;
    function down(e) {
      const g = G.current; if (!g) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (DIR_BY_KEY[k]) { g.held.add(k); e.preventDefault(); }
      else if (k === 'r') toggleMount();
      else if (k === ' ') { doAttack(); e.preventDefault(); }   // Space = attack
      else if (k === 'e') doTake();
      else if (k === 'q') doEmote();
      else if (k === '1' || k === '2' || k === '3') doSkill(Number(k) - 1);
    }
    function up(e) {
      const g = G.current; if (!g) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      g.held.delete(k);
    }
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [ready, skills]);

  // ---------- canvas sizing ----------
  useEffect(() => {
    if (!ready) return;
    const wrap = wrapRef.current, canvas = canvasRef.current;
    function fit() {
      // Guard against a transient 0-size read (iframe reflow, tab
      // backgrounding, OS DPI change mid-layout). Resizing the canvas to 0
      // and back caused exactly the "huge void + oversized sprite" glitch:
      // a 0-height canvas makes viewH = 0/z, and the next frame's camera
      // clamp math divides/centers against that garbage before the real
      // size lands. Skipping zero reads keeps the last-known-good size.
      const r = wrap.getBoundingClientRect();
      const w = Math.floor(r.width), h = Math.floor(r.height);
      if (w > 0 && h > 0) {
        const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const bw = Math.floor(w * dpr), bh = Math.floor(h * dpr);
        if (canvas.width !== bw || canvas.height !== bh) {
          canvas.width = bw;
          canvas.height = bh;
        }
        const g = G.current;
        if (g) {
          g.viewportW = w;
          g.viewportH = h;
          g.dpr = dpr;
        }
      }
    }
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
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
      if (g.stick) {
        const { x, y } = g.stick;
        if (Math.hypot(x, y) > 0.3) {
          return Math.abs(x) > Math.abs(y) ? (x > 0 ? 'East' : 'West') : (y > 0 ? 'South' : 'North');
        }
      }
      return null;
    }

    function tick(now) {
      try { tickInner(now); } catch (err) {
        if (!tick._err) { tick._err = true; console.error('room tick error:', err); }
      }
      raf = requestAnimationFrame(tick);
    }

    function tickInner(now) {
      const g = G.current; if (!g) return;
      const p = g.player;

      if (p.moveT < 1) {
        p.moveT = Math.min(1, (now - p.moveStart) / (p.mounted ? WALK_MS * 0.6 : WALK_MS));
      } else if (!p.oneShot) {
        const dir = heldDirection(g);
        if (dir) {
          if (p.facing !== dir) {
            p.facing = dir;
            p.turnHoldDir = dir;
            p.turnHoldStart = now;
            if (p.sentFacing !== p.facing) {
              g.net?.send('move', { tile: p.tile, facing: p.facing });
              p.sentFacing = p.facing;
            }
            draw(g, ctx, canvas, now);
            window.__room = g;
            return;
          }
          if (p.turnHoldDir === dir && now - p.turnHoldStart < TURN_HOLD_MS) {
            draw(g, ctx, canvas, now);
            window.__room = g;
            return;
          }
          const [dx, dy] = DELTA[dir];
          const nx = p.tile[0] + dx, ny = p.tile[1] + dy;
          if (nx >= 1 && ny >= 1 && nx < g.gridW - 1 && ny < g.gridH - 1) {
            const nextTile = [nx, ny];
            if (!tileOccupied(g, nextTile, { ignorePlayer: true })) {
              p.from = [...p.tile]; p.tile = nextTile;
              p.moveT = 0; p.moveStart = now;
              p.turnHoldDir = null; p.turnHoldStart = 0;
              g.net?.send('move', { tile: p.tile, facing: p.facing });
              p.sentFacing = p.facing;
            }
          } else if (p.sentFacing !== p.facing) {
            g.net?.send('move', { tile: p.tile, facing: p.facing }); // turn only
            p.sentFacing = p.facing;
          }
        } else {
          p.turnHoldDir = null;
          p.turnHoldStart = 0;
        }
      }
      if (p.oneShot) {
        const motion = p.oneShot === 'Victory' ? 'Victory' : p.oneShot + p.facing;
        const n = stepCount(g.tables, motion);
        if (now - p.oneShotStart > n * 200 + 80) p.oneShot = null;
      }

      for (const m of g.monsters) {
        if (m.state === 'die') continue;
        tickMonsterState(m, now);
        if (m.moveT < 1) m.moveT = Math.min(1, (now - m.moveStart) / MONSTER_WALK_MS);
        else if (m.aiOwnerId !== account?.character?.id) continue;
        else if (m.state === 'stand' && now > m.nextWander) {
          const dirs = Object.keys(DELTA);
          const dir = dirs[Math.floor(Math.random() * 4)];
          const [dx, dy] = DELTA[dir];
          const nx = m.tile[0] + dx, ny = m.tile[1] + dy;
          m.facing = dir;
          if (nx >= 1 && ny >= 1 && nx < g.gridW - 1 && ny < g.gridH - 1 &&
              !tileOccupied(g, [nx, ny])) {
            m.from = [...m.tile]; m.tile = [nx, ny]; m.moveT = 0; m.moveStart = now;
            g.net?.send('monster_move', { id: m.id, from: m.from, tile: m.tile, facing: m.facing });
          } else {
            g.net?.send('monster_move', { id: m.id, from: m.tile, tile: m.tile, facing: m.facing });
          }
          m.nextWander = now + 700 + Math.random() * 1600;
        }
      }
      g.monsters = g.monsters.filter((m) => {
        const keep = !monsterExpired(m, now);
        if (!keep) g.monsterIds.delete(m.id);
        return keep;
      });

      draw(g, ctx, canvas, now);
      window.__room = g;
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  function entityPx(e) {
    const t = e.moveT ?? 1;
    const fx = e.from && t < 1 ? e.from[0] + (e.tile[0] - e.from[0]) * t : e.tile[0];
    const fy = e.from && t < 1 ? e.from[1] + (e.tile[1] - e.from[1]) * t : e.tile[1];
    return [fx * TILE, fy * TILE];
  }

  function draw(g, ctx, canvas, now) {
    // Defensive guards: a 0-size canvas (mid-resize) or an out-of-range
    // zoom must never reach the camera math below — either produces
    // Infinity/NaN that briefly renders as a giant void + oversized sprite.
    const cssW = g.viewportW || canvas.clientWidth || canvas.width;
    const cssH = g.viewportH || canvas.clientHeight || canvas.height;
    if (cssW <= 0 || cssH <= 0 || canvas.width === 0 || canvas.height === 0) return;
    const z = Math.min(5, Math.max(0.5, g.zoom || 1.6));
    const p = g.player;
    const [ppx, ppy] = entityPx(p);
    const viewW = cssW / z, viewH = cssH / z;
    const mapW = g.gridW * TILE, mapH = g.gridH * TILE;
    let camX = ppx + TILE / 2 - viewW / 2;
    let camY = ppy + TILE / 2 - viewH / 2;
    camX = mapW > viewW ? Math.max(0, Math.min(camX, mapW - viewW)) : (mapW - viewW) / 2;
    camY = mapH > viewH ? Math.max(0, Math.min(camY, mapH - viewH)) : (mapH - viewH) / 2;

    ctx.save();
    ctx.setTransform(g.dpr || 1, 0, 0, g.dpr || 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.scale(z, z);
    ctx.translate(-camX, -camY);
    ctx.drawImage(g.bg, 0, 0);

    const ents = [
      { kind: 'player', y: ppy },
      ...g.monsters.map((m) => ({ kind: 'mob', m, y: entityPx(m)[1] })),
      ...Object.values(g.remotes || {}).map((r) => ({ kind: 'remote', r, y: entityPx(r)[1] })),
    ].sort((a, b) => a.y - b.y);
    for (const e of ents) {
      if (e.kind === 'player') drawPlayer(g, ctx, now);
      else if (e.kind === 'remote') drawRemote(g, ctx, e.r, now);
      else drawMonster(g, ctx, e.m, now);
    }
    g.fx = g.fx.filter((f) => drawEffect(g, ctx, f, now));

    // nameplates + hp bars over every player
    drawNameplate(ctx, g.player, entityPx(g.player), true);
    for (const r of Object.values(g.remotes || {})) drawNameplate(ctx, r, entityPx(r), false);
    ctx.restore();
  }

  function drawNameplate(ctx, ent, [px, py], isMe) {
    const name = isMe ? ent.name : ent.meta?.name || '…';
    const rank = isMe ? ent.rank : ent.meta?.rank;
    const cx = px + TILE / 2;
    const crest = crestImage(rankTierIndex(rank));
    const iconSz = 14, padX = 5, gap = 3;
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(name).width;
    const boxW = padX + iconSz + gap + tw + padX;
    const boxX = cx - boxW / 2, boxY = py - 80;
    ctx.fillStyle = isMe ? '#1d9d55cc' : '#000a';
    ctx.fillRect(boxX, boxY, boxW, 16);
    if (crest.complete && crest.naturalWidth) ctx.drawImage(crest, boxX + padX, boxY + 1, iconSz, iconSz);
    ctx.fillStyle = '#fff';
    ctx.fillText(name, boxX + padX + iconSz + gap, boxY + 8.5);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const hp = ent.hp ?? 100;
    if (hp < (ent.maxHp ?? 100)) {
      ctx.fillStyle = '#000a';
      ctx.fillRect(px + 6, py - 64, TILE - 12, 4);
      ctx.fillStyle = hp > 30 ? '#3c5' : '#e33';
      ctx.fillRect(px + 7, py - 63, (TILE - 14) * (hp / (ent.maxHp ?? 100)), 2);
    }
  }

  function drawRemote(g, ctx, r, now) {
    if (!r.resources) return;
    if (r.moveT < 1) r.moveT = Math.min(1, (now - r.moveStart) / WALK_MS);
    const hasWeapon = !!r.resources.weapon;
    const mounted = !!r.resources.mount;
    const motion = r.oneShot
      ? (r.oneShot === 'Victory' ? 'Victory' : r.oneShot.match(/South|North|East|West/) ? r.oneShot : r.oneShot + r.facing)
      : mounted ? 'Riding' + r.facing
      : r.moveT < 1 ? (hasWeapon ? 'WeaponWalk' : 'NormalWalk') + r.facing
      : (hasWeapon ? 'WeaponStandBy' : 'NormalStandBy') + r.facing;
    const n = stepCount(g.tables, motion);
    const step = r.oneShot
      ? Math.min(n - 1, Math.floor((now - r.oneShotStart) / 200))
      : r.moveT < 1 ? Math.floor(r.moveT * n) % n : Math.floor(now / 340) % n;
    const list = resolveStep(g.tables, r.resources, motion, step);
    const [px, py] = entityPx(r);
    paintStep(ctx, list, { x: px + TILE / 2 - 24, y: py + TILE - 48 }, 1);
  }

  function playerMotion(g) {
    const p = g.player;
    if (p.oneShot) return p.oneShot === 'Victory' ? 'Victory' : p.oneShot + p.facing;
    if (p.mounted) return 'Riding' + p.facing;
    const hasWeapon = !!p.resources.weapon;
    if (p.moveT < 1) return (hasWeapon ? 'WeaponWalk' : 'NormalWalk') + p.facing;
    return (hasWeapon ? 'WeaponStandBy' : 'NormalStandBy') + p.facing;
  }

  function drawPlayer(g, ctx, now) {
    const p = g.player;
    const motion = playerMotion(g);
    const n = stepCount(g.tables, motion);
    let step;
    if (p.oneShot) step = Math.min(n - 1, Math.floor((now - p.oneShotStart) / 200));
    else if (p.moveT < 1) step = Math.floor(p.moveT * n) % n;
    else step = Math.floor(now / 340) % n;
    const res = { ...p.resources };
    if (!p.mounted) delete res.mount;
    const list = resolveStep(g.tables, res, motion, step);
    const [px, py] = entityPx(p);
    paintStep(ctx, list, { x: px + TILE / 2 - 24, y: py + TILE - 48 }, 1);
  }

  function drawMonster(g, ctx, m, now) {
    const dirWord = MOB_DIR[m.facing];
    const animName =
      m.state === 'die' ? 'death'
      : m.state === 'hit' ? `hit_${dirWord}`
      : m.moveT < 1 ? `walk_${dirWord}` : `stand_${dirWord}`;
    const anim = m.mob.animations[animName]
      || m.mob.animations[`stand_${dirWord}`]
      || Object.values(m.mob.animations).find((a) => a?.length);
    if (!anim?.length) return;
    const idx = m.state === 'die'
      ? Math.min(anim.length - 1, Math.floor((now - m.stateStart) / 220))
      : Math.floor(now / 260) % anim.length;
    const fm = m.mob.frames[anim[idx].frame];
    if (!fm) return;
    const [px, py] = entityPx(m);
    const ax = px + TILE / 2 - 24 + m.mob.origin[0] + fm.fx;
    const ay = py + TILE - 8 + m.mob.origin[1] + fm.fy;
    ctx.globalAlpha = m.state === 'die' ? Math.max(0, 1 - (now - m.stateStart) / 1400) : 1;
    ctx.drawImage(m.sheet, fm.x + fm.fx, fm.y + fm.fy, fm.w, fm.h, ax, ay, fm.w, fm.h);
    ctx.globalAlpha = 1;
    if (m.friendly) {
      const cx = px + TILE / 2;
      const shield = shieldImage();
      const iconSz = 12, padX = 5, gap = 3;
      ctx.font = '9px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(m.name).width;
      const boxW = padX + iconSz + gap + tw + padX;
      const boxX = cx - boxW / 2, boxY = py - 40;
      ctx.fillStyle = '#104d42cc';
      ctx.fillRect(boxX, boxY, boxW, 15);
      if (shield.complete && shield.naturalWidth) ctx.drawImage(shield, boxX + padX, boxY + 1.5, iconSz, iconSz);
      ctx.fillStyle = '#fff';
      ctx.fillText(m.name, boxX + padX + iconSz + gap, boxY + 8);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
    }
    if (m.state !== 'die' && m.hp < m.maxHp) {
      ctx.fillStyle = '#000a';
      ctx.fillRect(px + 4, py - 8, TILE - 8, 5);
      ctx.fillStyle = '#e33';
      ctx.fillRect(px + 5, py - 7, (TILE - 10) * (m.hp / m.maxHp), 3);
    }
  }

  function drawEffect(g, ctx, f, now) {
    let t = now - f.start;
    for (const s of f.eff.animation) {
      const d = Math.min(1500, Math.max(60, s.delay || 100));
      if (t < d) {
        const fm = f.eff.frames[s.frame];
        if (!fm) return true;
        const [px, py] = entityPx(f.at);
        ctx.globalAlpha = s.alpha != null ? s.alpha : 1;
        ctx.drawImage(
          f.sheet, fm.x + fm.fx, fm.y + fm.fy, fm.w, fm.h,
          px + TILE / 2 - 24 + f.eff.origin[0] + fm.fx,
          py + TILE - 8 + f.eff.origin[1] + fm.fy,
          fm.w, fm.h
        );
        ctx.globalAlpha = 1;
        return true;
      }
      t -= d;
    }
    return false;
  }

  // ---------- virtual joystick (nipplejs) ----------
  // Touch anywhere in the bottom-left zone spawns a joystick under the thumb.
  // nipplejs gives a normalized vector + force; we scale by force and flip Y
  // (nipplejs Y points up, our world Y points down/South) into g.stick, which
  // heldDirection() already reads with a dead-zone. Multitouch means you can
  // steer and tap Attack/skills at the same time. Skipped on desktop (WASD),
  // where the zone is display:none (clientWidth 0).
  useEffect(() => {
    if (!ready) return undefined;
    const zone = stickZoneRef.current;
    if (!zone) return undefined;
    let manager = null;
    let raf = 0;
    let tries = 0;
    const onMove = (_e, d) => {
      const g = G.current;
      if (!g || !d.vector) return;
      const f = Math.min(1, d.force || 0);
      g.stick = { x: d.vector.x * f, y: -d.vector.y * f };
    };
    const onEnd = () => {
      const g = G.current;
      if (g) g.stick = null;
    };
    const setup = () => {
      // Desktop hides the zone (display:none -> width 0): steer with WASD, no
      // joystick. A width of 0 while still displayed just means layout hasn't
      // settled yet — retry a few frames before giving up, so the joystick is
      // never dead on a real device due to init timing.
      if (zone.clientWidth === 0) {
        if (getComputedStyle(zone).display !== 'none' && tries++ < 20) {
          raf = requestAnimationFrame(setup);
        }
        return;
      }
      manager = nipplejs.create({
        zone,
        mode: 'dynamic',
        color: 'rgba(255,255,255,0.55)',
        size: 112,
        threshold: 0.15,
        fadeTime: 120,
        restJoystick: true,
      });
      manager.on('move', onMove);
      manager.on('end', onEnd);
    };
    raf = requestAnimationFrame(setup);
    return () => {
      cancelAnimationFrame(raf);
      if (manager) manager.destroy();
      const g = G.current;
      if (g) g.stick = null;
    };
  }, [ready]);

  const profile = account?.profile || {};
  const rank = profile.rank || { glyph: '*', name: 'Spark', color: '#f0a83a' };
  const heroName = account?.character?.name || profile.display_name || profile.displayName || 'Player';
  const displayName = profile.display_name || profile.displayName || heroName;
  const dbOnlineFriends = (account?.friends || []).filter((f) => f.status === 'online' || f.status === 'away');
  const peerFriends = peerList.filter((p) => !dbOnlineFriends.some((f) => (
    (f.character_id && f.character_id === p.character_id) || (f.profile_id && p.profile_id && f.profile_id === p.profile_id)
  )));
  const onlineFriends = [...dbOnlineFriends, ...peerFriends];

  return (
    <div className="room-full">
      <div className="room-canvas" ref={wrapRef}>
        <canvas ref={canvasRef} tabIndex={0} />
        {!ready && <div className="room-loading">Loading Chonsa Arena…</div>}
        <div className="arena-toasts">
          {toasts.map((t) => <div key={t.id} className="arena-toast">{t.text}</div>)}
        </div>

        {/* top bar — just the settings gear (keyboard hints removed) */}
        <div className="hud-top">
          <button type="button" className="hud-gear" onPointerDown={keepCanvasFocus} onClick={() => setShowSettings(true)}>⚙</button>
        </div>

        <div className="unit-frame">
          <div className="unit-rank" title={rank.name}>
            <TierIcon color={rank.color} glyph={rank.glyph} size={46} />
          </div>
          <div className="unit-main">
            <div className="unit-name">
              <b>{heroName}</b>
              <span>{displayName} · Lv {fmt(profile.level || 1)}</span>
            </div>
            <div className="unit-exp"><span style={{ width: `${xpProgress(profile.xp)}%` }} /></div>
            <div className="unit-bars">
              <div className="bar hp"><span style={{ width: `${Math.max(0, Math.min(100, (hudState.hp / Math.max(1, hudState.maxHp)) * 100))}%` }} /><b><IconHeart /> {fmt(hudState.hp)}/{fmt(hudState.maxHp)}</b></div>
              <div className="bar mp"><span style={{ width: `${Math.max(0, Math.min(100, (hudState.mp / Math.max(1, hudState.maxMp)) * 100))}%` }} /><b><IconMana /> {fmt(hudState.mp)}/{fmt(hudState.maxMp)}</b></div>
            </div>
          </div>
        </div>

        <div className="arena-presence" role="button" tabIndex={0} onClick={() => setShowSettings(true)}>
          <div className="ap-head">
            <span className="ap-ico"><IconFriends /></span>
            <b>Friends online</b>
            <span className="ap-count">{onlineFriends.filter((f) => f.status !== 'offline').length}</span>
          </div>
          {onlineFriends.length ? onlineFriends.slice(0, 4).map((f) => (
            <div className="ap-row" key={`${f.source || 'friend'}:${f.character_id || f.profile_id}`}>
              <span className={`ap-dot ${f.status || 'online'}`} />
              <b>{f.character_name || f.display_name}</b>
              <small>{mapLabel(f.map_id)}</small>
            </div>
          )) : <div className="ap-empty">No friends online yet.</div>}
        </div>

        {/* joystick zone (touch / small screens) — nipplejs renders into this */}
        <div className="stick-zone" ref={stickZoneRef} />

        {/* action cluster — shared @arganta/combat component (canonical) */}
        <ActionCluster
          skills={skills}
          onSkill={doSkill}
          onAttack={doAttack}
          onButtonPointerDown={keepCanvasFocus}
          utils={[
            { key: 'take', icon: <IconHand />, onClick: doTake, title: 'take / crouch' },
            { key: 'mount', icon: <IconMount />, onClick: toggleMount, title: 'mount' },
          ]}
        />
      </div>

      {showSettings && (
        <div className="browser-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="settings">
            <div className="browser-head"><b>Arena settings</b>
              <button className="closex" onClick={() => setShowSettings(false)}>✕</button></div>
            <div className="settings-body">
              <section>
                <h4>Friends online ({onlineFriends.filter((f) => f.status !== 'offline').length})</h4>
                {onlineFriends.length ? (
                  onlineFriends.slice(0, 8).map((f) => (
                    <div className="settings-friend-row" key={`${f.source || 'friend'}:${f.character_id || f.profile_id}`}>
                      <b>{f.character_name || f.display_name}</b>
                      <small>{mapLabel(f.map_id)}</small>
                    </div>
                  ))
                ) : (
                  <p className="settings-empty">No friends online yet.</p>
                )}
              </section>
              <section>
                <h4>Spawn monster</h4>
                <div className="setrow">
                  <select value={spawnPick} onChange={(e) => setSpawnPick(e.target.value)}>
                    {spawnList.map((l) => <option key={l.name}>{l.name}</option>)}
                  </select>
                  <button onClick={() => spawnMonster()}>Spawn</button>
                </div>
              </section>
              <section>
                <h4>Guardian</h4>
                <div className="setrow">
                  <label>{account?.guardian?.displayName || 'None'}</label>
                  <button onClick={spawnGuardian} disabled={!account?.guardian}>Spawn guardian</button>
                </div>
                {account?.guardian && (
                  <div className="setrow guardian-stats">
                    <small>{fmt(account.guardian.maxHp)} HP · ATK {fmt(account.guardian.attack)}</small>
                  </div>
                )}
              </section>
              <section>
                <h4>Skill slots</h4>
                {skills.map((s, i) => (
                  <div className="setrow" key={i}>
                    <label>{s.name || `Skill ${i + 1}`}</label>
                    <input type="number" min="0" max="647" value={s.fx}
                      onChange={(e) => setSkills((arr) => arr.map((x, j) => j === i ? { ...x, fx: Number(e.target.value) } : x))} />
                    <button onClick={() => doSkill(i)}>test</button>
                  </div>
                ))}
              </section>
              <section>
                <h4>Camera</h4>
                <div className="setrow">
                  <label>zoom</label>
                  <input type="range" min="0.5" max="3" step="0.1" value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))} />
                  <span>{zoom.toFixed(1)}×</span>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
