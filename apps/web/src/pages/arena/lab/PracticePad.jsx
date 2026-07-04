// PracticePad — plain-ground mini room inside the Composer, mirroring the
// arena's player mechanics (tile walking, one-shots, spell effects, mount)
// so a loadout can be tested without leaving the page. No monsters here —
// Buya Arena covers map + monster mechanics.
import { useEffect, useRef, useState } from 'react';
import * as data from '../engine/data.js';
import { loadImage } from '../engine/data.js';
import { resolveStep, paintStep, stepCount } from '../engine/compositor.js';

const TILE = 48;
const WALK_MS = 460;
const DIR_BY_KEY = {
  ArrowUp: 'North', w: 'North', ArrowDown: 'South', s: 'South',
  ArrowLeft: 'West', a: 'West', ArrowRight: 'East', d: 'East',
};
const DELTA = { North: [0, -1], South: [0, 1], East: [1, 0], West: [-1, 0] };
const GRID = 9;

const fmt = (n) => Number(n || 0).toLocaleString();

export default function PracticePad({ spec, skills = [{ fx: 22 }, { fx: 1 }, { fx: 131 }], skillTest = null, fxId = 22, account = null }) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  const G = useRef(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const [tables, effectsAll] = await Promise.all([data.motionTables(), data.effects()]);
      const resources = await loadResources(spec);
      if (!live) return;
      G.current = {
        tables, effectsAll, resources,
        player: { tile: [4, 4], from: [4, 4], moveT: 1, facing: 'South', mounted: false, oneShot: null, oneShotStart: 0 },
        fx: [], held: new Set(),
      };
      setReady(true);
      console.log('[pad] init ok');
    })().catch((e) => console.error('[pad] init failed', e));
    return () => { live = false; };
  }, [JSON.stringify(spec)]);

  async function loadResources(spec_) {
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
      } else sheet = await loadImage(data.sheetUrl(cat, part));
      out[key] = { part, sheet };
    }));
    if (spec_.mount?.id != null) {
      const all = await data.mounts();
      const creature = all[spec_.mount.id];
      if (creature?.sheet) out.mount = { creature, sheet: await loadImage(data.mountSheetUrl(creature)) };
    }
    return out;
  }

  function oneShot(motion) {
    const p = G.current?.player;
    if (!p || p.oneShot) return;
    p.oneShot = motion; p.oneShotStart = performance.now();
  }
  function cast(castFxId = skills[0]?.fx ?? fxId) {
    const g = G.current; if (!g) return;
    oneShot('Spell');
    const eff = g.effectsAll[castFxId];
    if (!eff?.sheet || !eff.animation?.length) return;
    loadImage(data.effectSheetUrl(eff)).then((sheet) =>
      g.fx.push({ eff, sheet, at: g.player, start: performance.now() }));
  }

  useEffect(() => {
    if (!ready || !skillTest) return;
    cast(skillTest.fx);
  }, [ready, skillTest]);

  // keyboard only while the pad has focus (avoid stealing from the page)
  function onKeyDown(e) {
    const g = G.current; if (!g) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (DIR_BY_KEY[k]) { g.held.add(k); e.preventDefault(); }
    else if (k === '1' || k === '2' || k === '3') { cast(skills[Number(k) - 1]?.fx ?? fxId); e.preventDefault(); }
    else if (k === ' ') { cast(skills[0]?.fx ?? fxId); e.preventDefault(); }
    else if (k === 'e') oneShot('Get');
    else if (k === 'q') oneShot('Victory');
    else if (k === 'r') g.player.mounted = !g.player.mounted && !!g.resources.mount;
  }
  function onKeyUp(e) {
    const g = G.current; if (!g) return;
    g.held.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  }

  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf;
    function tick(now) {
      try { inner(now); } catch (err) {
        if (!tick._e) { tick._e = true; console.error('[pad] tick', err); }
      }
      raf = requestAnimationFrame(tick);
    }
    function inner(now) {
      const g = G.current; if (!g) return;
      const p = g.player;
      if (p.moveT < 1) p.moveT = Math.min(1, (now - p.moveStart) / (p.mounted ? WALK_MS * 0.6 : WALK_MS));
      else if (!p.oneShot && g.held.size) {
        const k = [...g.held].find((x) => DIR_BY_KEY[x]);
        if (k) {
          const dir = DIR_BY_KEY[k];
          p.facing = dir;
          const [dx, dy] = DELTA[dir];
          const nx = p.tile[0] + dx, ny = p.tile[1] + dy;
          if (nx >= 0 && ny >= 0 && nx < GRID && ny < GRID) {
            p.from = [...p.tile]; p.tile = [nx, ny]; p.moveT = 0; p.moveStart = now;
          }
        }
      }
      if (p.oneShot) {
        const motion = p.oneShot === 'Victory' ? 'Victory' : p.oneShot + p.facing;
        if (now - p.oneShotStart > stepCount(g.tables, motion) * 200 + 80) p.oneShot = null;
      }
      draw(g, ctx, canvas, now);
      window.__pad = g;
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
    const p = g.player;
    ctx.imageSmoothingEnabled = false;
    // plain grass-toned ground
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#79975a' : '#82a161';
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
    const motion = p.oneShot
      ? (p.oneShot === 'Victory' ? 'Victory' : p.oneShot + p.facing)
      : p.mounted ? 'Riding' + p.facing
      : p.moveT < 1 ? (g.resources.weapon ? 'WeaponWalk' : 'NormalWalk') + p.facing
      : (g.resources.weapon ? 'WeaponStandBy' : 'NormalStandBy') + p.facing;
    const n = stepCount(g.tables, motion);
    let step;
    if (p.oneShot) step = Math.min(n - 1, Math.floor((now - p.oneShotStart) / 200));
    else if (p.moveT < 1) step = Math.floor(p.moveT * n) % n;
    else step = Math.floor(now / 340) % n;
    const res = { ...g.resources };
    if (!p.mounted) delete res.mount;
    const [px, py] = entityPx(p);
    paintStep(ctx, resolveStep(g.tables, res, motion, step), { x: px + TILE / 2 - 24, y: py + TILE - 48 }, 1);

    g.fx = g.fx.filter((f) => {
      let t = now - f.start;
      for (const s of f.eff.animation) {
        const d = Math.min(1500, Math.max(60, s.delay || 100));
        if (t < d) {
          const fm = f.eff.frames[s.frame];
          if (!fm) return true;
          ctx.globalAlpha = s.alpha != null ? s.alpha : 1;
          ctx.drawImage(f.sheet, fm.x + fm.fx, fm.y + fm.fy, fm.w, fm.h,
            px + TILE / 2 - 24 + f.eff.origin[0] + fm.fx,
            py + TILE - 8 + f.eff.origin[1] + fm.fy, fm.w, fm.h);
          ctx.globalAlpha = 1;
          return true;
        }
        t -= d;
      }
      return false;
    });
  }

  return (
    <div className="pad">
      <div className="pad-head">
        <b>Practice ground</b>
        <small>Draft preview · click, then WASD · Space skill 1 · 1/2/3 skills · E take · R mount · Q emote</small>
      </div>
      {account?.stats && (
        <div className="pad-status">
          <div>
            <small>Hero</small>
            <b>{account.character?.name || account.profile?.display_name}</b>
            <span>{fmt(account.stats.maxHp)} HP · {fmt(account.stats.maxMp)} MP · ATK {fmt(account.stats.attack)}</span>
          </div>
          {account.guardian && (
            <div>
              <small>Guardian</small>
              <b>{account.guardian.displayName}</b>
              <span>{fmt(account.guardian.maxHp)} HP · ATK {fmt(account.guardian.attack)}</span>
            </div>
          )}
        </div>
      )}
      <canvas
        ref={canvasRef} width={GRID * TILE} height={GRID * TILE}
        tabIndex={0} onKeyDown={onKeyDown} onKeyUp={onKeyUp}
      />
      <div className="pad-btns">
        {skills.map((skill, i) => (
          <button key={i} onClick={() => cast(skill.fx)}>
            {skill.name || `Skill ${i + 1}`} <small>#{skill.fx}</small>
          </button>
        ))}
        <button onClick={() => oneShot('Swing')}>attack</button>
        <button onClick={() => oneShot('Get')}>take</button>
        <button onClick={() => { const g = G.current; if (g) g.player.mounted = !g.player.mounted && !!g.resources.mount; }}>mount</button>
      </div>
    </div>
  );
}
