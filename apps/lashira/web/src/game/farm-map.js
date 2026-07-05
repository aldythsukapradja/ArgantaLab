// Farm map: layout, collision, and procedural canvas art. The whole ground is
// painted ONCE into an offscreen canvas (like Kingdom's map image), then drawn
// each frame; plots + crops are painted per-frame on top. All placeholder art —
// swap for PixelLab/real farm tiles later.
import { CROPS } from '../data/crops.js';

export const TILE = 48;                       // matches Kingdom Heroes scale
export const W = 40, H = 26;
export const WORLD_W = W * TILE, WORLD_H = H * TILE;
export const FIELD = { x0: 6, y0: 10, x1: 20, y1: 20 };

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

function drawTree(ctx, x, y) {
  const px = x * TILE, py = y * TILE;
  rect(ctx, px + TILE / 2 - 5, py + TILE - 30, 10, 30, '#7a5230');
  ctx.fillStyle = '#3f8f47'; ctx.beginPath(); ctx.arc(px + TILE / 2, py + TILE - 40, 22, 0, 7); ctx.fill();
  ctx.fillStyle = '#4fa557';
  ctx.beginPath(); ctx.arc(px + TILE / 2 - 10, py + TILE - 34, 14, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(px + TILE / 2 + 10, py + TILE - 34, 14, 0, 7); ctx.fill();
}
function drawFence(ctx, x, y) {
  const px = x * TILE, py = y * TILE;
  rect(ctx, px + 6, py + 16, 6, 26, '#9c7f50'); rect(ctx, px + TILE - 12, py + 16, 6, 26, '#9c7f50');
  rect(ctx, px, py + 20, TILE, 6, '#b89968'); rect(ctx, px, py + 32, TILE, 6, '#b89968');
}
function drawBuilding(ctx, b) {
  const px = b.tx * TILE, py = b.ty * TILE, w = b.w * TILE, h = b.h * TILE;
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
export function buildFarmMap() {
  const canvas = document.createElement('canvas');
  canvas.width = WORLD_W; canvas.height = WORLD_H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  // grass
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const base = (x + y) % 7 === 0 ? '#78bf56' : '#7cc35a';
    rect(ctx, x * TILE, y * TILE, TILE, TILE, base);
    dots(ctx, (x * 31 + y * 7 + 3), 6, x * TILE, y * TILE, TILE, TILE, '#8fd06a', 3);
  }
  // path
  for (let y = 6; y <= 10; y++) { rect(ctx, 5 * TILE, y * TILE, TILE, TILE, '#cbb187'); dots(ctx, y * 5, 8, 5 * TILE, y * TILE, TILE, TILE, '#bda079', 3); }

  const blocked = new Set();
  const block = (x, y) => blocked.add(tileKey(x, y));
  const blockRect = (tx, ty, w, h) => { for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) block(x, y); };

  // border trees
  for (let x = 0; x < W; x++) { drawTree(ctx, x, 0); block(x, 0); drawTree(ctx, x, H - 1); block(x, H - 1); }
  for (let y = 1; y < H - 1; y++) { drawTree(ctx, 0, y); block(0, y); drawTree(ctx, W - 1, y); block(W - 1, y); }

  // field fence (gap at gate)
  for (let x = FIELD.x0 - 1; x <= FIELD.x1 + 1; x++) {
    if (!(x === FIELD.x0 + 3)) { drawFence(ctx, x, FIELD.y0 - 1); block(x, FIELD.y0 - 1); }
    drawFence(ctx, x, FIELD.y1 + 1); block(x, FIELD.y1 + 1);
  }
  for (let y = FIELD.y0; y <= FIELD.y1; y++) { drawFence(ctx, FIELD.x0 - 1, y); block(FIELD.x0 - 1, y); drawFence(ctx, FIELD.x1 + 1, y); block(FIELD.x1 + 1, y); }

  // buildings
  for (const b of BUILDINGS) { drawBuilding(ctx, b); blockRect(b.tx, b.ty, b.w, b.h); }
  drawTree(ctx, 23, 9); block(23, 9); drawTree(ctx, 3, 20); block(3, 20);

  return { canvas, blocked };
}

// Per-frame: draw tilled soil + crop for one plot at world coords.
export function drawPlot(ctx, tx, ty, plot) {
  if (!plot?.tilled) return;
  const px = tx * TILE, py = ty * TILE;
  rect(ctx, px + 3, py + 3, TILE - 6, TILE - 6, plot.watered ? '#6d4526' : '#a06a3c');
  for (let yy = py + 8; yy < py + TILE - 6; yy += 9) rect(ctx, px + 5, yy, TILE - 10, 3, plot.watered ? '#573619' : '#8a5730');
  if (!plot.cropId) return;
  const crop = CROPS[plot.cropId];
  const stage = plot.growth <= 0 ? 0 : plot.growth >= crop.days ? 3 : (plot.growth / crop.days) < 0.4 ? 1 : 2;
  const cx = px + TILE / 2;
  if (stage === 0) { rect(ctx, cx - 3, py + TILE - 16, 6, 6, '#5a3d1e'); return; }
  const hh = [0, 12, 22, 30][stage];
  rect(ctx, cx - 3, py + TILE - 10 - hh, 6, hh, '#3f8f47');
  if (stage >= 2) { rect(ctx, cx - 12, py + TILE - 18, 8, 4, '#4fa557'); rect(ctx, cx + 4, py + TILE - 22, 8, 4, '#4fa557'); }
  if (stage === 3) {
    ctx.fillStyle = '#' + crop.color.toString(16).padStart(6, '0');
    ctx.beginPath(); ctx.arc(cx, py + TILE - 12 - hh, 9, 0, 7); ctx.fill();
  }
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
