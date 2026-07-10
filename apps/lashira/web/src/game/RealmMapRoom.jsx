import { useEffect, useMemo, useRef, useState } from 'react';
import { computeRank, loadMotionTables, loadPlayerResources } from '../net/hero.js';
import { defaultFarmerSpec } from '../net/characterRegistry.js';
import { drawPlaceholderFarmer, TILE, W, H, WORLD_W, WORLD_H } from './farm-map.js';
import { loadOpenworldState, saveOpenworldState } from './openworld-save.js';
import { worldAssetUrl, worldMapById } from './world-map-registry.js';
import { resolveStep, paintStep, stepCount, drawListBBox } from '../engine/compositor.js';
import { UnitCard } from '../ui/UnitCard.jsx';

const DIR_BY_KEY = { ArrowUp: 'North', w: 'North', ArrowDown: 'South', s: 'South', ArrowLeft: 'West', a: 'West', ArrowRight: 'East', d: 'East' };
const DELTA = { North: [0, -1], South: [0, 1], East: [1, 0], West: [-1, 0] };
const FACE_WORD = { North: 'up', South: 'down', East: 'right', West: 'left' };
const WALK_MS = 460;
const EMOTES = ['Victory', 'Bow', 'Cheer', 'Laugh', 'Wave'];

function blockedAt(tx, ty) {
  return tx < 1 || ty < 1 || tx >= W - 1 || ty >= H - 1;
}

function xpCard(profile, battle = null) {
  const xp = Number(profile?.xp || 0);
  const level = Number(profile?.level || 1);
  const xpCur = Math.max(0, xp % 500);
  const xpReq = 500;
  const maxHp = 100 + Math.max(0, level - 1) * 10;
  const maxMp = 100 + Math.max(0, level - 1) * 4;
  return {
    rank: computeRank(xp),
    name: profile?.displayName || 'Farmer',
    pathIcon: '✦',
    pathName: 'Guardian',
    title: 'Explorer',
    level,
    xpPct: Math.round((xpCur / xpReq) * 100),
    xpCur,
    xpReq,
    hp: battle?.hp ?? maxHp,
    maxHp,
    mp: maxMp,
    maxMp,
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

export default function RealmMapRoom({ profile, hero, realmId, hqTile = null, hqFacing = 'South', onExit }) {
  const map = worldMapById(realmId);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const G = useRef(null);
  const saveTimerRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState('');
  const [usingHero, setUsingHero] = useState(false);
  const card = useMemo(() => xpCard(profile), [profile?.displayName, profile?.xp, profile?.level]);

  const flash = (msg) => {
    setToast(msg);
    window.clearTimeout(saveTimerRef.current?.toast || 0);
    const t = window.setTimeout(() => setToast(''), 1500);
    saveTimerRef.current = { ...(saveTimerRef.current || {}), toast: t };
  };

  const saveNow = async (clearRealm = false) => {
    const g = G.current;
    if (!g) return;
    const previous = g.openworld || {};
    const realmPositionsById = { ...(previous.realmPositionsById || {}) };
    realmPositionsById[map.id] = { tile: [...g.player.tile], facing: g.player.facing };
    const payload = {
      ...previous,
      currentRealmId: clearRealm ? null : map.id,
      hqTile: hqTile || previous.hqTile || map.hqReturn,
      hqFacing: hqFacing || previous.hqFacing || 'South',
      realmPositionsById,
    };
    g.openworld = payload;
    try {
      await saveOpenworldState(profile, null, payload);
    } catch (err) {
      console.warn('[openworld] save failed:', err?.message || err);
      flash('Cloud save retrying');
    }
  };

  const queueSave = () => {
    window.clearTimeout(saveTimerRef.current?.save || 0);
    const t = window.setTimeout(() => saveNow(false), 450);
    saveTimerRef.current = { ...(saveTimerRef.current || {}), save: t };
  };

  useEffect(() => {
    let live = true;
    (async () => {
      setReady(false);
      const [img, loaded, tables] = await Promise.all([
        loadImage(worldAssetUrl(map)),
        loadOpenworldState(profile, null).catch(() => ({ data: null })),
        loadMotionTables(),
      ]);
      const avatarSpec = hero?.spec || defaultFarmerSpec();
      const resources = tables ? await loadPlayerResources(avatarSpec) : null;
      if (!live) return;

      const saved = loaded?.data || {};
      const savedPos = saved.realmPositionsById?.[map.id];
      const spawn = savedPos?.tile || map.spawn || [30, 24];
      G.current = {
        map,
        img,
        openworld: {
          ...saved,
          currentRealmId: map.id,
          hqTile: hqTile || saved.hqTile || map.hqReturn,
          hqFacing: hqFacing || saved.hqFacing || 'South',
          realmPositionsById: saved.realmPositionsById || {},
        },
        tables,
        resources,
        heroOk: !!(tables && resources && Object.keys(resources).length),
        hasWeapon: !!resources?.weapon,
        held: new Set(),
        stick: null,
        cam: { camX: 0, camY: 0, z: 1 },
        player: {
          tile: [...spawn],
          from: [...spawn],
          moveT: 1,
          moveStart: 0,
          facing: savedPos?.facing || 'South',
          mounted: false,
          oneShot: null,
          oneShotStart: 0,
        },
      };
      setUsingHero(!!hero?.spec && G.current.heroOk);
      setReady(true);
      saveNow(false);
    })();
    return () => {
      live = false;
      window.clearTimeout(saveTimerRef.current?.save || 0);
      window.clearTimeout(saveTimerRef.current?.toast || 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.id, profile?.id, hero?.spec]);

  useEffect(() => {
    if (!ready) return undefined;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !wrap || !ctx) return undefined;

    let raf = 0;
    const resize = () => {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const r = wrap.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(r.width * dpr));
      canvas.height = Math.max(1, Math.floor(r.height * dpr));
      canvas.style.width = r.width + 'px';
      canvas.style.height = r.height + 'px';
      const g = G.current;
      if (g) { g.viewportW = canvas.width; g.viewportH = canvas.height; g.dpr = dpr; }
    };
    resize();
    window.addEventListener('resize', resize);

    function entityPx(e) {
      const t = e.moveT ?? 1;
      const fx = e.from && t < 1 ? e.from[0] + (e.tile[0] - e.from[0]) * t : e.tile[0];
      const fy = e.from && t < 1 ? e.from[1] + (e.tile[1] - e.from[1]) * t : e.tile[1];
      return [fx * TILE, fy * TILE];
    }

    function playerMotion(g) {
      const p = g.player;
      if (p.mounted && g.resources?.mount) return 'Riding' + p.facing;
      if (p.moveT < 1) return (g.hasWeapon ? 'WeaponWalk' : 'NormalWalk') + p.facing;
      return (g.hasWeapon ? 'WeaponStandBy' : 'NormalStandBy') + p.facing;
    }

    function drawPlayer(g, ctx2, now, footX, footY) {
      const p = g.player;
      if (g.heroOk) {
        const oneShotMotion = p.oneShot ? (EMOTES.includes(p.oneShot) ? p.oneShot : p.oneShot + p.facing) : null;
        const hasOne = !!oneShotMotion && stepCount(g.tables, oneShotMotion) > 0;
        const motion = hasOne ? oneShotMotion : playerMotion(g);
        const n = stepCount(g.tables, motion);
        const s = hasOne ? Math.min(n - 1, Math.floor((now - p.oneShotStart) / 160))
          : p.moveT < 1 ? Math.floor(p.moveT * n) % n
            : Math.floor(now / 340) % n;
        const list = resolveStep(g.tables, g.resources, motion, s);
        const bb = list.length ? drawListBBox([list]) : null;
        if (bb) {
          paintStep(ctx2, list, { x: footX - bb.cx, y: footY - bb.y1 }, 1);
          return;
        }
      }
      drawPlaceholderFarmer(ctx2, footX, footY, FACE_WORD[p.facing]);
    }

    function dirFromHeld(g) {
      for (const k of g.held) if (DIR_BY_KEY[k]) return DIR_BY_KEY[k];
      if (g.stick) {
        if (Math.abs(g.stick.x) > Math.abs(g.stick.y)) return g.stick.x > 0 ? 'East' : 'West';
        if (Math.abs(g.stick.y) > 0.18) return g.stick.y > 0 ? 'South' : 'North';
      }
      return null;
    }

    function step(g, now) {
      const p = g.player;
      if (p.moveT < 1) {
        p.moveT = Math.min(1, (now - p.moveStart) / WALK_MS);
        if (p.moveT >= 1) { p.from = [...p.tile]; queueSave(); }
        return;
      }
      const dir = dirFromHeld(g);
      if (!dir) return;
      p.facing = dir;
      const [dx, dy] = DELTA[dir];
      const nx = p.tile[0] + dx, ny = p.tile[1] + dy;
      if (blockedAt(nx, ny)) return;
      p.from = [...p.tile];
      p.tile = [nx, ny];
      p.moveStart = now;
      p.moveT = 0;
    }

    function draw(now) {
      const g = G.current;
      if (!g) return;
      step(g, now);
      const dpr = g.dpr || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const vw = canvas.width / dpr, vh = canvas.height / dpr;
      ctx.clearRect(0, 0, vw, vh);
      const [px, py] = entityPx(g.player);
      const zoom = Math.max(vw / WORLD_W, vh / WORLD_H, 0.42);
      const camX = Math.max(0, Math.min(WORLD_W - vw / zoom, px - vw / zoom / 2 + TILE / 2));
      const camY = Math.max(0, Math.min(WORLD_H - vh / zoom, py - vh / zoom / 2 + TILE / 2));
      g.cam = { camX, camY, z: zoom };

      ctx.save();
      ctx.scale(zoom, zoom);
      ctx.translate(-camX, -camY);
      if (g.img) ctx.drawImage(g.img, 0, 0, WORLD_W, WORLD_H);
      else {
        ctx.fillStyle = '#8ec56c';
        ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      }
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      ctx.beginPath();
      ctx.ellipse(px + TILE / 2, py + TILE - 8, 15, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      drawPlayer(g, ctx, now, px + TILE / 2, py + TILE);
      ctx.restore();
      raf = requestAnimationFrame(draw);
    }

    const down = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const g = G.current;
      if (!g) return;
      if (DIR_BY_KEY[k]) { g.held.add(k); e.preventDefault(); }
      else if (k === 'e' || k === 'Enter') { flash(map.name); e.preventDefault(); }
      else if (k === 'Escape') { saveNow(true).finally(() => onExit?.(map.hqReturn)); }
    };
    const up = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      G.current?.held.delete(k);
    };

    let ptr = null;
    function onPointerDown(e) {
      if (e.button != null && e.button !== 0) return;
      ptr = { id: e.pointerId, x0: e.clientX, y0: e.clientY };
      try { canvas.setPointerCapture(e.pointerId); } catch {}
    }
    function onPointerMove(e) {
      if (!ptr || e.pointerId !== ptr.id) return;
      const dx = e.clientX - ptr.x0, dy = e.clientY - ptr.y0;
      const dist = Math.hypot(dx, dy);
      const g = G.current;
      if (!g || dist < 10) return;
      const mag = Math.min(1, dist / 66);
      g.stick = { x: (dx / dist) * mag, y: (dy / dist) * mag };
    }
    function onPointerUp(e) {
      if (!ptr || e.pointerId !== ptr.id) return;
      G.current && (G.current.stick = null);
      ptr = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
    }

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
      saveNow(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, map.id]);

  const act = (label) => {
    const g = G.current;
    if (g?.player) {
      g.player.oneShot = 'Get';
      g.player.oneShotStart = performance.now();
    }
    flash(label + ': ' + map.name);
  };

  const exit = () => {
    saveNow(true).finally(() => onExit?.(map.hqReturn));
  };

  return (
    <div className="room-full">
      <div className="room-canvas realm-room" ref={wrapRef} style={{ '--realm-color': map.color }}>
        <canvas ref={canvasRef} tabIndex={0} />
        {!ready && <div className="room-loading">Opening {map.name}...</div>}
        {toast && <div className="toasts"><div className="toast">{toast}</div></div>}
        {!usingHero && <div className="hero-note">Placeholder farmer - build your hero in Kingdom Heroes and it appears here.</div>}
        <div className="left-stack">
          <UnitCard card={card} />
          <div className="res-strip">
            <span className="res res-wood">Realm</span>
            <span className="res res-bloom">{map.shortName}</span>
            <span className="res-div" aria-hidden="true" />
            <span className="res res-diamond">{map.theme}</span>
          </div>
        </div>
        <div className="zone-pill">{map.name}</div>
        <div className="realm-settings">
          <button type="button" className="hud-gear" onClick={exit} title="Return to HQ">↩</button>
        </div>
        <div className="cluster farm realm-cluster">
          <div className="small-ring">
            <button type="button" className="skill-circle util" onClick={exit} title="Return to HQ">↩</button>
            <button type="button" className="skill-circle util" onClick={() => act(map.actions[1])} title={map.actions[1]}>?</button>
            <button type="button" className="skill-circle util" onClick={() => act(map.actions[2])} title={map.actions[2]}>◇</button>
            <button type="button" className="skill-circle util" onClick={() => act('Mount')} title="Mount">♞</button>
            <button type="button" className="skill-circle util emote" onClick={() => act('Emote')} title="Emote">☺</button>
          </div>
          <button type="button" className="attack-circle" onClick={() => act(map.actions[0])} title={map.actions[0]}>
            <span>{map.actions[0]}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
