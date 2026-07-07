// Farm map: layout, collision, and procedural canvas art. The whole ground is
// painted ONCE into an offscreen canvas (like Kingdom's map image), then drawn
// each frame; plots + crops are painted per-frame on top. All placeholder art —
// swap for PixelLab/real farm tiles later.
import { CROPS, cropGrowthFrac, cropHydration, cropStageOf } from '../data/crops.js';
import { drawOverride } from './farm-art-runtime.js';
import { drawActualKinSprite } from './kin-sprite-image.jsx';

export const TILE = 48;                       // matches Kingdom Heroes scale
export const W = 40, H = 26;
export const WORLD_W = W * TILE, WORLD_H = H * TILE;
export const FIELD = { x0: 6, y0: 10, x1: 20, y1: 20 };

// Animal pens, to the RIGHT of the crop field. Bottom line (y1) matches the crop
// field's bottom (y=20) so the whole farm reads as one row of enclosures. Cow +
// sheep stacked under the Barn/Shop; chicken run on the far right. Each animal's
// home wander-rect IS its pen (see FarmRoom.syncWorldActors).
export const PENS = {
  cow: { x0: 23, y0: 10, x1: 31, y1: 14, gate: 'left' },
  sheep: { x0: 23, y0: 16, x1: 31, y1: 20, gate: 'left' },
  chicken: { x0: 33, y0: 12, x1: 37, y1: 20, gate: 'left' },
};

export const BUILDINGS = [
  { key: 'house', type: 'house', tx: 4, ty: 3, w: 3, h: 3, label: 'Home' },
  { key: 'barn', type: 'barn', tx: 10, ty: 3, w: 3, h: 2, label: 'Barn' },
  { key: 'coop', type: 'coop', tx: 15, ty: 3, w: 2, h: 2, label: 'Coop' },
  { key: 'shop', type: 'shop', tx: 24, ty: 3, w: 2, h: 2, label: 'Shop' },
  { key: 'well', type: 'well', tx: 21, ty: 6, w: 1, h: 1, label: 'Well' },
  { key: 'bin', type: 'bin', tx: 8, ty: 7, w: 1, h: 1, label: 'Bin' },
];

export const tileKey = (x, y) => x + ',' + y;

function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
function dots(ctx, seed, count, x0, y0, w, h, c, sz) {
  let s = seed; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  ctx.fillStyle = c;
  for (let i = 0; i < count; i++) ctx.fillRect(x0 + Math.floor(rnd() * (w - sz)), y0 + Math.floor(rnd() * (h - sz)), sz, sz);
}

function drawTree(ctx, x, y, art) {
  const px = x * TILE, py = y * TILE;
  if (drawOverride(ctx, art, 'lashira.prop.tree', px, py - 24, TILE, TILE + 24)) return;
  rect(ctx, px + TILE / 2 - 5, py + TILE - 30, 10, 30, '#7a5230');
  ctx.fillStyle = '#3f8f47'; ctx.beginPath(); ctx.arc(px + TILE / 2, py + TILE - 40, 22, 0, 7); ctx.fill();
  ctx.fillStyle = '#4fa557';
  ctx.beginPath(); ctx.arc(px + TILE / 2 - 10, py + TILE - 34, 14, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(px + TILE / 2 + 10, py + TILE - 34, 14, 0, 7); ctx.fill();
}
function drawFence(ctx, x, y, art) {
  const px = x * TILE, py = y * TILE;
  if (drawOverride(ctx, art, 'lashira.prop.fence', px, py, TILE, TILE)) return;
  rect(ctx, px + 6, py + 16, 6, 26, '#9c7f50'); rect(ctx, px + TILE - 12, py + 16, 6, 26, '#9c7f50');
  rect(ctx, px, py + 20, TILE, 6, '#b89968'); rect(ctx, px, py + 32, TILE, 6, '#b89968');
}
function drawBuilding(ctx, b, art) {
  const px = b.tx * TILE, py = b.ty * TILE, w = b.w * TILE, h = b.h * TILE;
  const key = b.type === 'bin' ? 'lashira.prop.shipping_bin' : b.type === 'well' ? 'lashira.prop.well' : `lashira.building.${b.type}`;
  if (drawOverride(ctx, art, key, px, py, w, h)) return;
  if (b.type === 'house') {
    rect(ctx, px + 6, py + h * 0.38, w - 12, h * 0.62 - 6, '#caa06a');
    for (let yy = py + h * 0.45; yy < py + h - 8; yy += 12) rect(ctx, px + 10, yy, w - 20, 3, '#b58a55');
    ctx.fillStyle = '#b0472e'; ctx.beginPath(); ctx.moveTo(px, py + h * 0.42); ctx.lineTo(px + w / 2, py + 4); ctx.lineTo(px + w, py + h * 0.42); ctx.closePath(); ctx.fill();
    rect(ctx, px + w / 2 - 15, py + h - 38, 30, 34, '#6d4526'); rect(ctx, px + w / 2 - 10, py + h - 30, 20, 20, '#8a5730');
    rect(ctx, px + 22, py + h * 0.5, 20, 20, '#bfe0ef'); rect(ctx, px + w - 42, py + h * 0.5, 20, 20, '#bfe0ef');
  } else if (b.type === 'barn') {
    rect(ctx, px + 5, py + h * 0.34, w - 10, h * 0.66 - 6, '#c0533a');
    ctx.fillStyle = '#7a2f20'; ctx.beginPath(); ctx.moveTo(px, py + h * 0.4); ctx.lineTo(px + w / 2, py + 4); ctx.lineTo(px + w, py + h * 0.4); ctx.closePath(); ctx.fill();
    rect(ctx, px + w / 2 - 22, py + h - 44, 44, 40, '#e6d2a8'); rect(ctx, px + w / 2 - 2, py + h - 44, 4, 40, '#9c7f50');
  } else if (b.type === 'coop') {
    rect(ctx, px + 5, py + h * 0.35, w - 10, h * 0.65 - 6, '#e3c98a');
    ctx.fillStyle = '#a8823f'; ctx.beginPath(); ctx.moveTo(px, py + h * 0.42); ctx.lineTo(px + w / 2, py + 4); ctx.lineTo(px + w, py + h * 0.42); ctx.closePath(); ctx.fill();
    rect(ctx, px + w / 2 - 12, py + h - 30, 24, 26, '#7a5a2c');
  } else if (b.type === 'shop') {
    rect(ctx, px + 4, py + h * 0.42, w - 8, h * 0.58 - 6, '#e7d9b0');
    for (let xx = px; xx < px + w; xx += 24) { rect(ctx, xx, py + 14, 12, 18, '#8b5cf6'); rect(ctx, xx + 12, py + 14, 12, 18, '#e879b9'); }
    rect(ctx, px + 10, py + h - 20, w - 20, 14, '#caa06a');
  } else if (b.type === 'well') {
    rect(ctx, px + 8, py + 20, TILE - 16, TILE - 24, '#8f9aa6'); rect(ctx, px + 12, py + 26, TILE - 24, TILE - 34, '#3a5a70');
    rect(ctx, px + 4, py + 4, 4, 18, '#7a5230'); rect(ctx, px + TILE - 8, py + 4, 4, 18, '#7a5230'); rect(ctx, px + 2, py, TILE - 4, 6, '#7a2f20');
  } else if (b.type === 'bin') {
    rect(ctx, px + 6, py + 14, TILE - 12, TILE - 18, '#8a5730'); rect(ctx, px + 6, py + 14, TILE - 12, 8, '#6d4526'); rect(ctx, px + 12, py + 4, TILE - 24, 12, '#a06a3c');
  }
}

// Build the ground background once. Returns { canvas, blocked:Set }.
export function buildFarmMap(art = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = WORLD_W; canvas.height = WORLD_H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  // grass
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const base = (x + y) % 7 === 0 ? '#78bf56' : '#7cc35a';
    if (!drawOverride(ctx, art, 'lashira.terrain.grass', x * TILE, y * TILE, TILE, TILE)) {
      rect(ctx, x * TILE, y * TILE, TILE, TILE, base);
      dots(ctx, (x * 31 + y * 7 + 3), 6, x * TILE, y * TILE, TILE, TILE, '#8fd06a', 3);
    }
  }
  // path
  for (let y = 6; y <= 10; y++) {
    if (!drawOverride(ctx, art, 'lashira.terrain.path', 5 * TILE, y * TILE, TILE, TILE)) {
      rect(ctx, 5 * TILE, y * TILE, TILE, TILE, '#cbb187'); dots(ctx, y * 5, 8, 5 * TILE, y * TILE, TILE, TILE, '#bda079', 3);
    }
  }

  const blocked = new Set();
  const block = (x, y) => blocked.add(tileKey(x, y));
  const blockRect = (tx, ty, w, h) => { for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) block(x, y); };

  // border trees
  for (let x = 0; x < W; x++) { drawTree(ctx, x, 0, art); block(x, 0); drawTree(ctx, x, H - 1, art); block(x, H - 1); }
  for (let y = 1; y < H - 1; y++) { drawTree(ctx, 0, y, art); block(0, y); drawTree(ctx, W - 1, y, art); block(W - 1, y); }

  // field fence (gap at gate)
  for (let x = FIELD.x0 - 1; x <= FIELD.x1 + 1; x++) {
    if (!(x === FIELD.x0 + 3)) { drawFence(ctx, x, FIELD.y0 - 1, art); block(x, FIELD.y0 - 1); }
    drawFence(ctx, x, FIELD.y1 + 1, art); block(x, FIELD.y1 + 1);
  }
  for (let y = FIELD.y0; y <= FIELD.y1; y++) { drawFence(ctx, FIELD.x0 - 1, y, art); block(FIELD.x0 - 1, y); drawFence(ctx, FIELD.x1 + 1, y, art); block(FIELD.x1 + 1, y); }

  // animal pens (fenced enclosures with a one-tile gate)
  for (const pen of Object.values(PENS)) {
    const mx = Math.floor((pen.x0 + pen.x1) / 2), my = Math.floor((pen.y0 + pen.y1) / 2);
    for (let x = pen.x0 - 1; x <= pen.x1 + 1; x++) {
      if (!(pen.gate === 'top' && x === mx)) { drawFence(ctx, x, pen.y0 - 1, art); block(x, pen.y0 - 1); }
      if (!(pen.gate === 'bottom' && x === mx)) { drawFence(ctx, x, pen.y1 + 1, art); block(x, pen.y1 + 1); }
    }
    for (let y = pen.y0; y <= pen.y1; y++) {
      if (!(pen.gate === 'left' && y === my)) { drawFence(ctx, pen.x0 - 1, y, art); block(pen.x0 - 1, y); }
      if (!(pen.gate === 'right' && y === my)) { drawFence(ctx, pen.x1 + 1, y, art); block(pen.x1 + 1, y); }
    }
  }

  // buildings
  for (const b of BUILDINGS) { drawBuilding(ctx, b, art); blockRect(b.tx, b.ty, b.w, b.h); }
  drawTree(ctx, 3, 20, art); block(3, 20);

  return { canvas, blocked };
}

// Per-frame: draw tilled soil + crop for one plot at world coords.
function leaf(ctx, x, y, flip = 1) {
  ctx.fillStyle = '#4fa557';
  ctx.fillRect(x, y, 9 * flip, 4);
  ctx.fillStyle = '#66bd6d';
  ctx.fillRect(x + 2 * flip, y - 3, 6 * flip, 3);
}

// Floating growth/health bar above a growing crop — fill = growth %, colour =
// state (gold ripe · green growing+hydrated · amber thirsty), blue pip = hydrated.
function drawCropHealthBar(ctx, px, py, frac, hyd, ripe, now) {
  const bw = TILE - 16, bh = 5, bx = px + 8, by = py - 10;
  ctx.fillStyle = 'rgba(18,22,32,0.55)'; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
  ctx.fillStyle = ripe ? '#ffcf3f' : hyd <= 0 ? '#e0a020' : '#43c65a';
  ctx.fillRect(bx, by, Math.max(1, Math.round(bw * frac)), bh);
  if (!ripe) { ctx.fillStyle = hyd > 0 ? '#4aa3e8' : '#8a6a3e'; ctx.fillRect(bx + bw - Math.round(bw * hyd), by + bh + 2, Math.max(2, Math.round(bw * hyd)), 2); }
  if (ripe) { // pulse the ripe bar so "harvest me" reads at a glance
    const a = 0.55 + 0.45 * Math.abs(Math.sin(now / 350));
    ctx.strokeStyle = `rgba(255,222,90,${a.toFixed(2)})`; ctx.lineWidth = 1.5; ctx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);
  }
}

function drawCropPixels(ctx, cropId, stage, px, py, art = {}) {
  if (drawOverride(ctx, art, `lashira.crop.${cropId}.stage${stage}`, px, py, TILE, TILE)) return;
  const cx = px + TILE / 2;
  const base = py + TILE - 10;
  if (stage === 0) {
    rect(ctx, cx - 4, base - 2, 8, 5, '#5a3d1e');
    rect(ctx, cx - 2, base - 7, 4, 5, '#4fa557');
    return;
  }
  if (cropId === 'turnip') {
    const h = [0, 11, 18, 23][stage];
    rect(ctx, cx - 3, base - h, 6, h, '#3f8f47');
    leaf(ctx, cx - 13, base - h + 3); leaf(ctx, cx + 4, base - h, 1);
    if (stage === 3) { rect(ctx, cx - 8, base - 6, 16, 12, '#d7a1e7'); rect(ctx, cx - 5, base - 3, 10, 9, '#f0d5f5'); rect(ctx, cx - 2, base + 6, 4, 4, '#9a6c55'); }
  } else if (cropId === 'potato') {
    const spread = [0, 9, 15, 20][stage];
    for (let i = -spread; i <= spread; i += 8) { rect(ctx, cx + i - 2, base - 9 - Math.abs(i % 3), 5, 10, '#3f8f47'); rect(ctx, cx + i - 5, base - 10, 10, 4, '#5baa62'); }
    if (stage === 3) { rect(ctx, cx - 14, base + 2, 9, 5, '#c8955a'); rect(ctx, cx + 3, base + 1, 11, 6, '#d9b382'); rect(ctx, cx - 2, base + 5, 7, 4, '#b77f47'); }
  } else if (cropId === 'carrot') {
    const h = [0, 10, 18, 25][stage];
    for (let i = -8; i <= 8; i += 8) { rect(ctx, cx + i - 2, base - h, 4, h, '#3f8f47'); leaf(ctx, cx + i - 8, base - h + 2); }
    if (stage === 3) { rect(ctx, cx - 5, base - 4, 10, 14, '#f08a3c'); rect(ctx, cx - 3, base + 10, 6, 4, '#c7642c'); }
  } else if (cropId === 'strawberry') {
    const spread = [0, 9, 15, 19][stage];
    for (let i = -spread; i <= spread; i += 7) { rect(ctx, cx + i - 2, base - 12, 5, 12, '#3f8f47'); rect(ctx, cx + i - 6, base - 10, 12, 5, '#58aa5f'); }
    if (stage === 3) for (let i of [-12, -2, 10]) { rect(ctx, cx + i, base - 8, 5, 6, '#e4425a'); rect(ctx, cx + i + 1, base - 7, 1, 1, '#ffd1d8'); }
  } else if (cropId === 'corn') {
    const h = [0, 15, 26, 34][stage];
    rect(ctx, cx - 3, base - h, 6, h, '#3f8f47');
    rect(ctx, cx - 12, base - h + 11, 9, 5, '#5baa62'); rect(ctx, cx + 3, base - h + 17, 11, 5, '#5baa62');
    if (stage === 3) { rect(ctx, cx + 5, base - 24, 6, 15, '#f2c94c'); rect(ctx, cx + 7, base - 23, 2, 13, '#fff0a6'); }
  } else if (cropId === 'pumpkin') {
    const spread = [0, 10, 18, 23][stage];
    rect(ctx, cx - spread, base - 5, spread * 2, 4, '#3f8f47');
    for (let i = -spread; i <= spread; i += 8) rect(ctx, cx + i, base - 9, 5, 5, '#58aa5f');
    if (stage === 3) { rect(ctx, cx - 14, base - 17, 28, 20, '#e07b2c'); rect(ctx, cx - 9, base - 19, 18, 24, '#f08a3c'); rect(ctx, cx - 2, base - 23, 5, 6, '#5b7d35'); }
  }
}

export function drawPlot(ctx, tx, ty, plot, art = {}) {
  if (!plot?.tilled) return;
  const px = tx * TILE, py = ty * TILE;
  const now = Date.now();
  const hyd = cropHydration(plot, now);
  const wet = hyd > 0; // "watered" look now comes from live hydration, not a flag
  const soilKey = wet ? 'lashira.plot.soil.watered' : 'lashira.plot.soil.dry';
  if (!drawOverride(ctx, art, soilKey, px, py, TILE, TILE)) {
    rect(ctx, px + 3, py + 3, TILE - 6, TILE - 6, wet ? '#5d371b' : '#9a6536');
    rect(ctx, px + 5, py + 5, TILE - 10, 5, wet ? '#76502c' : '#b17843');
    for (let yy = py + 12; yy < py + TILE - 7; yy += 9) rect(ctx, px + 6, yy, TILE - 12, 3, wet ? '#432613' : '#7e4d28');
    dots(ctx, tx * 83 + ty * 19, 5, px + 7, py + 10, TILE - 14, TILE - 16, wet ? '#3b2111' : '#704525', 2);
  }
  if (!plot.cropId) return;
  const frac = cropGrowthFrac(plot, now);
  drawCropPixels(ctx, plot.cropId, cropStageOf(frac), px, py, art);
  drawCropHealthBar(ctx, px, py, frac, hyd, frac >= 1, now);
}

function drawNamedOverride(ctx, art, key, footX, footY, w, h) {
  return drawOverride(ctx, art, key, footX - w / 2, footY - h, w, h);
}

export function drawAnimalSprite(ctx, species, footX, footY, facing = 'South', frame = 0, art = {}, squash = 0) {
  // Chickens are noticeably smaller than cows/sheep.
  const [aw, ah] = species === 'chicken' ? [22, 24] : [50, 42];
  const img = art?.[`lashira.animal.${species}`];
  if (img && img.naturalWidth > 0) {
    // face movement direction (sheet art faces right) + a squash-stretch for the
    // walk bounce (squash 0..1 → wider/flatter).
    const flip = facing === 'West' ? -1 : 1;
    const sw = aw * (1 + squash * 0.12), sh = ah * (1 - squash * 0.12);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.translate(footX, footY + 1); ctx.scale(flip, 1);
    ctx.drawImage(img, -sw / 2, -sh, sw, sh);
    ctx.restore();
    return;
  }
  const dir = facing === 'West' ? -1 : 1;
  const step = frame % 2;
  ctx.save(); ctx.translate(footX, footY); ctx.scale(dir, 1); ctx.imageSmoothingEnabled = false;
  const R = (x, y, w, h, c) => rect(ctx, x, y, w, h, c);
  if (species === 'cow') {
    R(-22, -30, 34, 19, '#f6efe5'); R(-15, -35, 18, 13, '#f6efe5'); R(7, -24, 10, 8, '#f6efe5');
    R(-18, -27, 8, 8, '#4a3a34'); R(1, -30, 9, 12, '#4a3a34'); R(-10, -36, 5, 4, '#e6d8c5');
    R(-11, -31, 2, 2, '#171717'); R(-24, -31, 6, 5, '#e8c7b6'); R(2, -38, 3, 5, '#d8c086'); R(-8, -39, 3, 5, '#d8c086');
    R(-18, -11, 5, 11 + step, '#3f302b'); R(4, -11, 5, 11 - step, '#3f302b'); R(14, -20, 3, 12, '#3f302b');
  } else if (species === 'sheep') {
    for (const [x, y, s] of [[-18, -25, 12], [-8, -30, 15], [5, -26, 13], [-2, -20, 16]]) { R(x, y, s, s, '#f1eee4'); R(x + 2, y + 2, s - 4, s - 4, '#fffaf0'); }
    R(-23, -28, 12, 12, '#4a3a34'); R(-20, -24, 2, 2, '#171717'); R(-21, -12, 5, 10 + step, '#3f302b'); R(8, -12, 5, 10 - step, '#3f302b');
  } else {
    const bob = step ? -1 : 0;
    R(-8, -20 + bob, 16, 16, '#f7d36a'); R(2, -29 + bob, 12, 12, '#ffd878');
    R(12, -25 + bob, 7, 4, '#e98536'); R(5, -34 + bob, 6, 6, '#d4473a'); R(8, -26 + bob, 2, 2, '#171717');
    R(-6, -5, 3, 6, '#d98c3a'); R(5, -5, 3, 6, '#d98c3a'); R(-13, -16 + bob, 7, 8, '#e9b957');
  }
  ctx.restore();
}

export function drawKinSprite(ctx, kin, footX, footY, facing = 'South', frame = 0, art = {}) {
  const renderKey = kin.render || kin.assetKey?.replace(/^kin\./, '') || String(kin.kinKey || kin.id || '').replace(/^kin[:_]/, '');
  const key = `lashira.kin.${renderKey}`;
  if (drawNamedOverride(ctx, art, key, footX, footY, 34, 42)) return;
  if (drawActualKinSprite(ctx, kin, footX, footY, frame)) return;
  const color = typeof kin.color === 'string'
    ? kin.color
    : '#' + Number(kin.color || 0x8fd67a).toString(16).padStart(6, '0');
  const bob = frame % 2 ? -2 : 0;
  ctx.save(); ctx.translate(footX, footY + bob); ctx.imageSmoothingEnabled = false;
  const R = (x, y, w, h, c) => rect(ctx, x, y, w, h, c);
  R(-8, -25, 16, 18, color);
  R(-11, -19, 22, 10, '#ffffff55');
  R(-6, -33, 12, 10, '#f2e6bf');
  R(-4, -30, 2, 2, '#172018'); R(3, -30, 2, 2, '#172018');
  if (/owl|gull|dove|moth|bee|crane|bat|roc/.test(renderKey)) {
    R(-16, -24, 8, 12, color); R(8, -24, 8, 12, color);
  } else if (/turtle|seal|whale|slime|newt|frog/.test(renderKey)) {
    R(-12, -24, 24, 12, color); R(-9, -28, 18, 4, '#ffffff55');
  } else if (/fox|cat|lynx|lion|pup|cub|bear|mouse|koala|bunny|hog/.test(renderKey)) {
    R(-7, -39, 5, 7, color); R(2, -39, 5, 7, color);
  } else {
    R(-3, -39, 6, 7, color);
  }
  R(-15, -22, 6, 5, color); R(9, -22, 6, 5, color);
  if (kin.task === 'water') { R(11, -11, 9, 6, '#79b8e8'); R(18, -8, 3, 3, '#aee4ff'); }
  if (kin.task === 'harvest') { R(10, -13, 8, 8, '#d8a24a'); R(12, -15, 5, 3, '#8fd67a'); }
  ctx.restore();
}

export function drawMountPlaceholder(ctx, footX, footY, facing = 'South', frame = 0, art = {}) {
  if (drawNamedOverride(ctx, art, 'lashira.mount.placeholder', footX, footY, 66, 48)) return;
  const dir = facing === 'West' ? -1 : 1;
  const step = frame % 2;
  ctx.save(); ctx.translate(footX, footY); ctx.scale(dir, 1); ctx.imageSmoothingEnabled = false;
  const R = (x, y, w, h, c) => rect(ctx, x, y, w, h, c);
  R(-28, -31, 42, 21, '#9b6a3c'); R(-19, -39, 18, 15, '#b9824a'); R(9, -29, 12, 8, '#80542f');
  R(-15, -36, 2, 2, '#161616'); R(-20, -43, 5, 7, '#744623'); R(-8, -43, 5, 7, '#744623');
  R(-22, -10, 5, 12 + step, '#53351f'); R(5, -10, 5, 12 - step, '#53351f'); R(15, -24, 5, 16, '#53351f');
  ctx.restore();
}

// Placeholder farmer (used only when the Kingdom Heroes art can't load).
export function drawPlaceholderFarmer(ctx, px, py, facing) {
  const s = 2; const flip = facing === 'left' ? -1 : 1;
  ctx.save(); ctx.translate(px, py); ctx.scale(flip, 1); ctx.imageSmoothingEnabled = false;
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x * s, y * s, w * s, h * s); };
  R(-8, -30, 16, 5, '#e0a24a'); R(-6, -33, 12, 4, '#c98a3a');   // hat
  R(-6, -25, 12, 8, '#f2c9a0');                                  // face
  R(-4, -23, 2, 2, '#2a2a2a'); R(2, -23, 2, 2, '#2a2a2a');       // eyes
  R(-8, -17, 16, 11, '#5b8def'); R(-6, -14, 12, 6, '#3f6fd6');   // body
  R(-8, -6, 5, 6, '#3a3f63'); R(3, -6, 5, 6, '#3a3f63');         // legs
  ctx.restore();
}
