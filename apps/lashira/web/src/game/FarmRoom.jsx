// Canvas-2D farm room — the SAME rendering engine as Kingdom Heroes' arena
// (TestRoom), so the farmer is the player's real composited Heroes character.
// Tile-step movement, nipplejs + WASD, camera-follow. Falls back to a placeholder
// farmer sprite if the Kingdom art host is unreachable.
import { useEffect, useRef, useState } from 'react';
import nipplejs from 'nipplejs';
import { FarmLogic } from './farm-logic.js';
import { buildFarmMap, drawPlot, drawPlaceholderFarmer, TILE, W, H, WORLD_W, WORLD_H, FIELD, BUILDINGS } from './farm-map.js';
import { loadMotionTables, loadPlayerResources } from '../net/hero.js';
import { resolveStep, paintStep, stepCount, drawListBBox } from '../engine/compositor.js';
import { Hud } from '../ui/Hud.jsx';
import { Panels } from '../ui/Panels.jsx';

const DIR_BY_KEY = { ArrowUp: 'North', w: 'North', ArrowDown: 'South', s: 'South', ArrowLeft: 'West', a: 'West', ArrowRight: 'East', d: 'East' };
const DELTA = { North: [0, -1], South: [0, 1], East: [1, 0], West: [-1, 0] };
const FACE_WORD = { North: 'up', South: 'down', East: 'right', West: 'left' };
const WALK_MS = 260;

export default function FarmRoom({ profile, hero, circleId = null }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const stickRef = useRef(null);
  const G = useRef(null);
  const logicRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [snap, setSnap] = useState(null);
  const [panel, setPanel] = useState(null);
  const [zoom, setZoom] = useState(1); // default 1x on every screen size; adjustable in Settings
  const [usingHero, setUsingHero] = useState(false);

  // ---------- init ----------
  useEffect(() => {
    let live = true;
    const logic = new FarmLogic(profile, circleId);
    logicRef.current = logic;
    if (import.meta.env.DEV) window.__farm = logic;

    (async () => {
      const { canvas: bg, blocked } = buildFarmMap();
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
      G.current = {
        bg, blocked, tables, resources, hasWeapon, heroOk,
        player: { tile: [12, 12], from: [12, 12], moveT: 1, moveStart: 0, facing: 'South', mounted: false, oneShot: null, oneShotStart: 0, turnHoldDir: null, turnHoldStart: 0 },
        held: new Set(), stick: null, zoom, viewportW: 0, viewportH: 0, dpr: 1,
      };
      const unsub = logic.subscribe(setSnap);
      G.current._unsub = unsub;
      setReady(true);
    })();

    return () => {
      live = false;
      G.current?._unsub?.();
      logic.save();
    };
  }, [profile, hero, circleId]);

  useEffect(() => { if (G.current) G.current.zoom = zoom; }, [zoom]);

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
  // Mount toggle — copied AS IS from Kingdom Heroes' toggleMount(): a silent
  // no-op when no mount is equipped, exactly matching Kingdom's own behavior
  // (the util button is never hidden/disabled, it just does nothing).
  function toggleMount() {
    const g = G.current; if (!g) return;
    g.player.mounted = !g.player.mounted && !!g.resources?.mount;
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
    function blockedAt(g, tx, ty) { return tx < 1 || ty < 1 || tx >= W - 1 || ty >= H - 1 || g.blocked.has(tx + ',' + ty); }

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

    function draw(g, ctx, canvas, now) {
      const cssW = g.viewportW || canvas.clientWidth, cssH = g.viewportH || canvas.clientHeight;
      if (cssW <= 0 || cssH <= 0 || !canvas.width || !canvas.height) return;
      const z = Math.min(4, Math.max(0.6, g.zoom || 1.6));
      const p = g.player; const [ppx, ppy] = entityPx(p);
      const viewW = cssW / z, viewH = cssH / z;
      let camX = ppx + TILE / 2 - viewW / 2, camY = ppy + TILE / 2 - viewH / 2;
      camX = WORLD_W > viewW ? Math.max(0, Math.min(camX, WORLD_W - viewW)) : (WORLD_W - viewW) / 2;
      camY = WORLD_H > viewH ? Math.max(0, Math.min(camY, WORLD_H - viewH)) : (WORLD_H - viewH) / 2;

      ctx.save();
      ctx.setTransform(g.dpr || 1, 0, 0, g.dpr || 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#0a0a0c'; ctx.fillRect(0, 0, cssW, cssH);
      ctx.scale(z, z); ctx.translate(-Math.round(camX), -Math.round(camY));
      ctx.drawImage(g.bg, 0, 0);

      // plots
      const plots = logicRef.current.state.plots;
      for (const [key, plot] of Object.entries(plots)) { const [tx, ty] = key.split(',').map(Number); drawPlot(ctx, tx, ty, plot); }

      // target: the tile directly in front of the farmer (filled + outlined so
      // it's unambiguous which tile the tool will act on).
      const [ftx, fty] = [p.tile[0] + DELTA[p.facing][0], p.tile[1] + DELTA[p.facing][1]];
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(ftx * TILE + 2, fty * TILE + 2, TILE - 4, TILE - 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
      ctx.strokeRect(ftx * TILE + 2, fty * TILE + 2, TILE - 4, TILE - 4);

      // the farmer's foot point = tile center-bottom; shadow + sprite share it.
      // Widened when mounted (a horse+rider silhouette is much broader than a
      // standing farmer) — the shadow itself has no Kingdom equivalent to copy.
      const footX = ppx + TILE / 2, footY = ppy + TILE - 5;
      ctx.fillStyle = 'rgba(0,0,0,0.24)';
      ctx.beginPath();
      ctx.ellipse(footX, footY, p.mounted ? 26 : 16, p.mounted ? 8 : 6, 0, 0, Math.PI * 2);
      ctx.fill();

      const headTop = drawPlayer(g, ctx, now, footX, footY);

      // nameplate floats just above the head
      const name = logicRef.current.profile?.displayName || 'Farmer';
      ctx.font = '11px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(name).width; const bw = tw + 16;
      const ny = Math.min(headTop - 12, footY - 44);
      ctx.fillStyle = '#1d9d55dd'; ctx.fillRect(footX - bw / 2, ny - 9, bw, 17);
      ctx.fillStyle = '#fff'; ctx.fillText(name, footX, ny);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready]);

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
              zoom={zoom} setZoom={setZoom} usingHero={usingHero} hero={hero} />
            <Panels panel={panel} snap={snap} game={logicRef.current} onClose={() => setPanel(null)} />
          </>
        )}
      </div>
    </div>
  );
}
