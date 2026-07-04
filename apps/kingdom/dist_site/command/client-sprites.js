// ClientArt — loads the real NexusTK client library (data/client/) and renders
// live sprites: cropped frames, palette recoloring via .idx sheets, and
// per-frame-duration animation. Vanilla JS, no build step.
window.ClientArt = (function () {
  const BASE = '../data/client/';
  const jsonCache = {};
  const imgCache = {};

  async function loadJson(rel) {
    if (!jsonCache[rel]) {
      jsonCache[rel] = fetch(BASE + rel).then((r) => {
        if (!r.ok) throw new Error('missing ' + rel);
        return r.json();
      });
    }
    return jsonCache[rel];
  }
  async function loadLinks(name) {
    const key = '../data/links/' + name;
    if (!jsonCache[key]) {
      jsonCache[key] = fetch(key).then((r) => (r.ok ? r.json() : []), () => []);
    }
    return jsonCache[key];
  }
  function loadImg(rel) {
    if (!imgCache[rel]) {
      imgCache[rel] = new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error('img ' + rel));
        im.src = BASE + rel;
      });
    }
    return imgCache[rel];
  }

  // ------- data accessors (all lazy) -------
  const manifest = () => loadJson('manifest.json');
  const extractor = () => loadJson('extractor-manifest.json');
  const mobs = () => loadJson('monsters/parts.json');
  const mobPalettes = () => loadJson('monsters/palettes.json');
  const mounts = () => loadJson('mounts/parts.json');
  const mountPalettes = () => loadJson('mounts/palettes.json');
  const effects = () => loadJson('effects/effects.json');
  const effectPalettes = () => loadJson('effects/palettes.json');
  const itemsMeta = () => loadJson('items/items.json');
  const itemPalettes = () => loadJson('items/palettes.json');
  const charParts = (cat) => loadJson(`char/${cat}/parts.json`);
  const charPalettes = (cat) => loadJson(`char/${cat}/palettes.json`);
  const monsterLinks = () => loadLinks('monster-links.json');
  const itemLinks = () => loadLinks('item-links.json');

  // ------- frame rendering -------
  // meta: {x,y,fx,fy,w,h} inside a sheet; draws the FULL CELL (cell_w/cell_h)
  // so the in-game anchor alignment inside the cell is preserved.
  function drawCell(ctx, sheet, part, frameIdx, dx, dy, scale = 1) {
    const fm = part.frames[frameIdx];
    if (!fm) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      sheet,
      fm.x, fm.y, part.cell_w, part.cell_h,
      dx, dy, part.cell_w * scale, part.cell_h * scale
    );
  }

  // Recolor a cell region from an .idx sheet through a palette (256x[r,g,b]).
  function recolorCell(idxSheet, part, frameIdx, palette) {
    const fm = part.frames[frameIdx];
    const c = document.createElement('canvas');
    c.width = part.cell_w;
    c.height = part.cell_h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(idxSheet, fm.x, fm.y, part.cell_w, part.cell_h, 0, 0, part.cell_w, part.cell_h);
    const d = ctx.getImageData(0, 0, part.cell_w, part.cell_h);
    const px = d.data;
    for (let i = 0; i < px.length; i += 4) {
      const idx = px[i]; // grayscale: R = palette index
      if (idx === 0) { px[i + 3] = 0; continue; }
      const col = palette[idx] || [255, 0, 255];
      px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = 255;
    }
    ctx.putImageData(d, 0, 0);
    return c;
  }

  // ------- animation driver -------
  // One rAF loop advances every registered <canvas data-anim>. Frames:
  // [{draw:(ctx)=>void, ms:number}]. Auto-unregisters when detached.
  const anims = new Set();
  function animate(canvas, frames) {
    if (!frames.length) return;
    const st = { canvas, frames, i: 0, t: performance.now() };
    anims.add(st);
    paint(st);
  }
  function paint(st) {
    const ctx = st.canvas.getContext('2d');
    ctx.clearRect(0, 0, st.canvas.width, st.canvas.height);
    st.frames[st.i].draw(ctx);
  }
  function tick(now) {
    for (const st of [...anims]) {
      if (!st.canvas.isConnected) { anims.delete(st); continue; }
      if (now - st.t >= st.frames[st.i].ms) {
        st.t = now;
        st.i = (st.i + 1) % st.frames.length;
        paint(st);
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  const clampMs = (d) => Math.min(1500, Math.max(90, Number(d) || 250));

  // ------- high-level: creature preview canvas -------
  // Creature (mob/mount) with optional palette override; animName picks the
  // sequence (default stand_down, falls back to first non-empty).
  async function creatureCanvas(creature, opts = {}) {
    const {
      folder = 'monsters', paletteId = null, animName = null,
      scale = 2, palettesPromise = null,
    } = opts;
    if (!creature || !creature.sheet) return null;
    const anims_ = creature.animations || {};
    const seq =
      (animName && anims_[animName]?.length && anims_[animName]) ||
      (anims_.stand_down?.length && anims_.stand_down) ||
      Object.values(anims_).find((s) => s && s.length);
    if (!seq) return null;

    const needRecolor = paletteId != null && paletteId !== creature.palette_id && creature.idx_sheet;
    const canvas = document.createElement('canvas');
    canvas.width = creature.cell_w * scale;
    canvas.height = creature.cell_h * scale;
    canvas.className = 'client-sprite';

    if (needRecolor) {
      const [idxSheet, palettes] = await Promise.all([
        loadImg(`${folder}/${creature.idx_sheet}`),
        palettesPromise || (folder === 'mounts' ? mountPalettes() : mobPalettes()),
      ]);
      const pal = palettes[paletteId] || palettes[0];
      const frames = seq
        .filter((s) => creature.frames[s.frame])
        .map((s) => {
          const cell = recolorCell(idxSheet, creature, s.frame, pal);
          return {
            ms: clampMs(s.duration),
            draw: (ctx) => {
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(cell, 0, 0, canvas.width, canvas.height);
            },
          };
        });
      animate(canvas, frames);
    } else {
      const sheet = await loadImg(`${folder}/${creature.sheet}`);
      const frames = seq
        .filter((s) => creature.frames[s.frame])
        .map((s) => ({
          ms: clampMs(s.duration),
          draw: (ctx) => drawCell(ctx, sheet, creature, s.frame, 0, 0, scale),
        }));
      animate(canvas, frames);
    }
    return canvas;
  }

  // Character part preview (idle-south by default, walk optional).
  async function partCanvas(cat, part, opts = {}) {
    const { animName = 'NormalStandBySouth', scale = 2, paletteId = null } = opts;
    if (!part.sheet) return null;
    const anims_ = part.animations || {};
    const seq =
      (anims_[animName]?.length && anims_[animName]) ||
      (anims_.NormalStandBySouth?.length && anims_.NormalStandBySouth) ||
      Object.values(anims_).find((s) => s && s.length);
    if (!seq) return null;
    const canvas = document.createElement('canvas');
    canvas.width = part.cell_w * scale;
    canvas.height = part.cell_h * scale;
    canvas.className = 'client-sprite';
    if (paletteId != null && paletteId !== part.palette_id && part.idx_sheet) {
      const [idxSheet, palettes] = await Promise.all([
        loadImg(`char/${cat}/${part.idx_sheet}`), charPalettes(cat),
      ]);
      const pal = palettes[paletteId] || palettes[0];
      const frames = seq.filter((s) => part.frames[s.frame]).map((s) => {
        const cell = recolorCell(idxSheet, part, s.frame, pal);
        return {
          ms: 320,
          draw: (ctx) => {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(cell, 0, 0, canvas.width, canvas.height);
          },
        };
      });
      animate(canvas, frames);
    } else {
      const sheet = await loadImg(`char/${cat}/${part.sheet}`);
      const frames = seq.filter((s) => part.frames[s.frame]).map((s) => ({
        ms: 320,
        draw: (ctx) => drawCell(ctx, sheet, part, s.frame, 0, 0, scale),
      }));
      animate(canvas, frames);
    }
    return canvas;
  }

  // Item icon canvas (recolors through the linked palette when given).
  async function iconCanvas(iconIndex, opts = {}) {
    const { paletteId = null, scale = 1 } = opts;
    const meta = await itemsMeta();
    const m = meta.icons[iconIndex];
    if (!m) return null;
    const canvas = document.createElement('canvas');
    canvas.width = m.w * scale;
    canvas.height = m.h * scale;
    canvas.className = 'client-sprite';
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    if (paletteId != null && paletteId !== m.palette_id) {
      const [idxSheet, palettes] = await Promise.all([
        loadImg('items/items_sheet.idx.png'), itemPalettes(),
      ]);
      const pal = palettes[paletteId] || palettes[0];
      const part = { frames: [{ x: m.x, y: m.y }], cell_w: m.w, cell_h: m.h };
      const cell = recolorCell(idxSheet, part, 0, pal);
      ctx.drawImage(cell, 0, 0, canvas.width, canvas.height);
    } else {
      const sheet = await loadImg('items/items_sheet.png');
      ctx.drawImage(sheet, m.x, m.y, m.w, m.h, 0, 0, canvas.width, canvas.height);
    }
    return canvas;
  }

  // Effect preview with real per-frame delays.
  async function effectCanvas(eff, opts = {}) {
    const { scale = 2 } = opts;
    if (!eff.sheet || !eff.animation?.length) return null;
    const sheet = await loadImg(`effects/${eff.sheet}`);
    const canvas = document.createElement('canvas');
    canvas.width = eff.cell_w * scale;
    canvas.height = eff.cell_h * scale;
    canvas.className = 'client-sprite';
    const part = { frames: eff.frames, cell_w: eff.cell_w, cell_h: eff.cell_h };
    const frames = eff.animation
      .filter((s) => eff.frames[s.frame])
      .map((s) => ({
        ms: clampMs(s.delay),
        draw: (ctx) => {
          ctx.globalAlpha = s.alpha != null ? s.alpha : 1;
          drawCell(ctx, sheet, part, s.frame, 0, 0, scale);
          ctx.globalAlpha = 1;
        },
      }));
    animate(canvas, frames);
    return canvas;
  }

  return {
    manifest, extractor, mobs, mobPalettes, mounts, mountPalettes,
    effects, effectPalettes, itemsMeta, itemPalettes, charParts, charPalettes,
    monsterLinks, itemLinks, loadImg,
    creatureCanvas, partCanvas, iconCanvas, effectCanvas,
  };
})();
