// Farm map: layout, collision, and procedural canvas art. The whole ground is
// painted ONCE into an offscreen canvas (like Kingdom's map image), then drawn
// each frame; plots + crops are painted per-frame on top. All placeholder art —
// swap for PixelLab/real farm tiles later.
import { CROPS, cropGrowthFrac, cropStageOf, cropIsWithered, cropFreshFrac } from '../data/crops.js';
import { drawOverride } from './farm-art-runtime.js';
import { drawActualKinSprite } from './kin-sprite-image.jsx';

export const TILE = 48;                       // matches Kingdom Heroes scale
export const W = 60, H = 48;                  // one overworld: all zones + castle center
export const WORLD_W = W * TILE, WORLD_H = H * TILE;

// Crop field — the Farm (NW), biggest zone. Pre-tilled soil, open (no fence).
export const FIELD = { x0: 4, y0: 5, x1: 26, y1: 16 };  // snapped to the basemap's tilled soil

// Named zones (terrain painting + prop placement).
export const ZONES = {
  garden:  { x0: 2,  y0: 19, x1: 20, y1: 27 },   // flowers + greenhouse (W)
  plaza:   { x0: 23, y0: 18, x1: 36, y1: 30 },   // shops ring the castle (center)
  forest:  { x0: 38, y0: 18, x1: 46, y1: 30 },   // wood (E, inner — swapped)
  mining:  { x0: 48, y0: 18, x1: 57, y1: 30 },   // stone/gold + dungeon gate (E, outer — swapped)
  fishing: { x0: 2,  y0: 29, x1: 16, y1: 45 },   // lake (SW)
};

// Martial south band (combat mode): battleground (left) + PvP arena (right, PVP.x0).
// inArena() flips combat on across the whole band; monsters roam here.
export const ARENA = { x0: 17, y0: 33, x1: 57, y1: 45 };
export const PVP = { x0: 40, y0: 33, x1: 57, y1: 45 };
export const ARENA_WALL_Y = 32;               // wall dividing the mid-zones from the martial south
export const ARENA_GATE_X = 28;               // 2-wide gate (ARENA_GATE_X .. +1)

// Animal pens (NE): cow | sheep | chicken columns, combined ≈ farm size.
export const PENS = {
  cow: { x0: 35, y0: 4, x1: 40, y1: 15, gate: 'bottom' },
  sheep: { x0: 42, y0: 4, x1: 47, y1: 15, gate: 'bottom' },
  chicken: { x0: 49, y0: 4, x1: 55, y1: 15, gate: 'bottom' },
};

// Castle sits DEAD CENTER (map center tile 30,24). 6×6 → drawn 288×288, centered.
export const BUILDINGS = [
  { key: 'house', type: 'house', tx: 27, ty: 21, w: 6, h: 6, label: 'Castle' },
  { key: 'barn', type: 'barn', tx: 35, ty: 2, w: 3, h: 2, label: 'Barn' },
  { key: 'coop', type: 'coop', tx: 50, ty: 2, w: 2, h: 2, label: 'Coop' },
  { key: 'shop', type: 'shop', tx: 30, ty: 16, w: 2, h: 2, label: 'Market' },
  { key: 'well', type: 'well', tx: 21, ty: 18, w: 1, h: 1, label: 'Well' },
  { key: 'bin', type: 'bin', tx: 22, ty: 3, w: 1, h: 1, label: 'Bin' },
];

// Baked landmark / decoration art (placed by buildFarmMap). solid = blocks movement.
export const PLACEMENTS = [
  // garden (W)
  { key: 'lashira.lib.greenhouse', tx: 3, ty: 20, w: 3, h: 3, solid: true },
  { key: 'lashira.lib.flowers', tx: 8, ty: 21, w: 1, h: 1 },
  { key: 'lashira.lib.flowers', tx: 12, ty: 24, w: 1, h: 1 },
  { key: 'lashira.lib.flowers', tx: 16, ty: 21, w: 1, h: 1 },
  { key: 'lashira.lib.flowers', tx: 10, ty: 26, w: 1, h: 1 },
  { key: 'lashira.lib.flowers', tx: 18, ty: 25, w: 1, h: 1 },
  // farm extras
  { key: 'lashira.lib.windmill', tx: 24, ty: 4, w: 2, h: 3, solid: true },
  { key: 'lashira.lib.scarecrow', tx: 13, ty: 9, w: 1, h: 1 },
  // plaza — shops ring the castle
  { key: 'lashira.lib.fountain', tx: 29, ty: 18, w: 2, h: 2, solid: true },
  { key: 'lashira.lib.shop_seed', tx: 23, ty: 19, w: 2, h: 2, solid: true },
  { key: 'lashira.lib.shop_general', tx: 34, ty: 19, w: 2, h: 2, solid: true },
  { key: 'lashira.lib.shop_blacksmith', tx: 23, ty: 28, w: 2, h: 2, solid: true },
  { key: 'lashira.lib.shop_animal', tx: 34, ty: 28, w: 2, h: 2, solid: true },
  { key: 'lashira.lib.shop_cosmetics', tx: 28, ty: 28, w: 2, h: 2, solid: true },
  // mining (E, outer — swapped) — dungeon gate + ores
  { key: 'lashira.lib.dungeon_gate', tx: 48, ty: 18, w: 2, h: 2, solid: true },
  { key: 'lashira.lib.ore_gold', tx: 51, ty: 21, w: 1, h: 1, solid: true },
  { key: 'lashira.lib.ore_copper', tx: 54, ty: 19, w: 1, h: 1, solid: true },
  { key: 'lashira.lib.ore_iron', tx: 50, ty: 26, w: 1, h: 1, solid: true },
  { key: 'lashira.lib.ore_gem', tx: 55, ty: 27, w: 1, h: 1, solid: true },
  { key: 'lashira.lib.boulder', tx: 53, ty: 24, w: 1, h: 1, solid: true },
  { key: 'lashira.lib.mine_cart', tx: 49, ty: 29, w: 1, h: 1 },
  // forest (E, inner — swapped)
  { key: 'lashira.lib.tree_pine', tx: 39, ty: 19, w: 2, h: 2, solid: true },
  { key: 'lashira.lib.tree_pine', tx: 44, ty: 20, w: 2, h: 2, solid: true },
  { key: 'lashira.lib.tree_oak', tx: 41, ty: 24, w: 2, h: 2, solid: true },
  { key: 'lashira.lib.tree_pine', tx: 39, ty: 26, w: 2, h: 2, solid: true },
  { key: 'lashira.lib.bush', tx: 46, ty: 24, w: 1, h: 1 },
  { key: 'lashira.lib.mushroom', tx: 43, ty: 29, w: 1, h: 1 },
  { key: 'lashira.lib.stump', tx: 38, ty: 29, w: 1, h: 1 },
  { key: 'lashira.lib.woodlog', tx: 46, ty: 29, w: 1, h: 1 },
  // fishing (SW)
  { key: 'lashira.lib.fishing_dock', tx: 6, ty: 33, w: 3, h: 2 },
  { key: 'lashira.lib.fishing_reeds', tx: 3, ty: 31, w: 1, h: 1 },
  { key: 'lashira.lib.fishing_reeds', tx: 14, ty: 32, w: 1, h: 1 },
  { key: 'lashira.lib.fishing_reeds', tx: 4, ty: 43, w: 1, h: 1 },
  // pen troughs (feed + water per pen)
  { key: 'lashira.lib.trough_feed', tx: 36, ty: 5, w: 1, h: 1 },
  { key: 'lashira.lib.trough_water', tx: 39, ty: 13, w: 1, h: 1 },
  { key: 'lashira.lib.trough_feed', tx: 43, ty: 5, w: 1, h: 1 },
  { key: 'lashira.lib.trough_water', tx: 46, ty: 13, w: 1, h: 1 },
  { key: 'lashira.lib.trough_feed', tx: 50, ty: 5, w: 1, h: 1 },
  { key: 'lashira.lib.trough_water', tx: 53, ty: 13, w: 1, h: 1 },
  // more forest fill (E, inner — swapped)
  { key: 'lashira.lib.tree_oak', tx: 45, ty: 27, w: 2, h: 2, solid: true },
  { key: 'lashira.lib.tree_pine', tx: 42, ty: 27, w: 2, h: 2, solid: true },
  { key: 'lashira.lib.bush', tx: 40, ty: 22, w: 1, h: 1 },
  // martial south
  { key: 'lashira.lib.signpost', tx: 30, ty: 33, w: 1, h: 1 },
  { key: 'lashira.lib.arena_wall', tx: 41, ty: 33, w: 2, h: 1, solid: true },
  { key: 'lashira.lib.scoreboard', tx: 48, ty: 34, w: 1, h: 2, solid: true },
  { key: 'lashira.lib.stump', tx: 24, ty: 39, w: 1, h: 1 },
  { key: 'lashira.lib.stump', tx: 34, ty: 42, w: 1, h: 1 },
];

export const tileKey = (x, y) => x + ',' + y;

// ---- HOTSPOTS: the interaction registry. FarmRoom.onTap → hotspotAt() → dispatch.
// One row per interactive landmark; adding a mechanic = one row + one handler.
export const HOTSPOTS = [
  { kind: 'castle', id: 'castle', rect: { x0: 27, y0: 21, x1: 32, y1: 26 } },
  { kind: 'shop', id: 'seed', rect: { x0: 9, y0: 17, x1: 11, y1: 19 } },
  { kind: 'shop', id: 'general', ported: false, rect: { x0: 13, y0: 20, x1: 15, y1: 22 } },
  { kind: 'shop', id: 'smith', rect: { x0: 18, y0: 23, x1: 20, y1: 25 } },
  { kind: 'shop', id: 'animal', ported: false, rect: { x0: 5, y0: 23, x1: 7, y1: 25 } },
  { kind: 'shop', id: 'cosmetic', ported: false, rect: { x0: 9, y0: 26, x1: 11, y1: 28 } },
  { kind: 'sell', id: 'market', rect: { x0: 30, y0: 16, x1: 31, y1: 17 } },
  { kind: 'dungeon', id: 'dungeon', ported: false, rect: { x0: 48, y0: 18, x1: 49, y1: 19 } },
  { kind: 'ore', id: 'ore@51,21', ore: 'gold', rect: { x0: 51, y0: 21, x1: 51, y1: 21 } },
  { kind: 'ore', id: 'ore@54,19', ore: 'copper', rect: { x0: 54, y0: 19, x1: 54, y1: 19 } },
  { kind: 'ore', id: 'ore@50,26', ore: 'iron', rect: { x0: 50, y0: 26, x1: 50, y1: 26 } },
  { kind: 'ore', id: 'ore@55,27', ore: 'gem', rect: { x0: 55, y0: 27, x1: 55, y1: 27 } },
  { kind: 'ore', id: 'ore@53,24', ore: 'stone', rect: { x0: 53, y0: 24, x1: 53, y1: 24 } },
  { kind: 'dock', id: 'dock', rect: { x0: 9, y0: 35, x1: 12, y1: 36 } },
];
// forest trees (match the tree PLACEMENTS; hard = oak → needs Tier-2 axe)
for (const [x, y, hard] of [[39, 19, false], [44, 20, false], [41, 24, true], [39, 26, false], [45, 27, true], [42, 27, false]]) {
  HOTSPOTS.push({ kind: 'tree', id: `tree@${x},${y}`, hard, rect: { x0: x, y0: y, x1: x + 1, y1: y + 1 } });
}
export function hotspotAt(tx, ty) {
  for (const h of HOTSPOTS) { const r = h.rect; if (tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1) return h; }
  return null;
}

// Status markers for the on-map overlay: one dot per interactive point (tile-center
// coords). ported=true → green (wired + works), false → red (placeholder). Built
// from HOTSPOTS + the zone hotspots (farm/animals/battleground/pvp) that route
// through other tap paths. As a mechanic is wired, flip its `ported` → its dot goes green.
export const HOTSPOT_MARKERS = (() => {
  const m = [];
  for (const h of HOTSPOTS) m.push({ x: (h.rect.x0 + h.rect.x1 + 1) / 2, y: (h.rect.y0 + h.rect.y1 + 1) / 2, ported: h.ported !== false });
  m.push({ x: (FIELD.x0 + FIELD.x1 + 1) / 2, y: (FIELD.y0 + FIELD.y1 + 1) / 2, ported: true });        // farm
  for (const p of Object.values(PENS)) m.push({ x: (p.x0 + p.x1 + 1) / 2, y: (p.y0 + p.y1 + 1) / 2, ported: true }); // animals
  m.push({ x: (ARENA.x0 + PVP.x0) / 2, y: (ARENA.y0 + ARENA.y1 + 1) / 2, ported: true });               // battleground
  m.push({ x: (PVP.x0 + PVP.x1 + 1) / 2, y: (PVP.y0 + PVP.y1 + 1) / 2, ported: false });                 // pvp
  return m;
})();

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
function drawFence(ctx, x, y, art, vertical = false) {
  const px = x * TILE, py = y * TILE;
  if (vertical && drawOverride(ctx, art, 'lashira.lib.fence_vertical', px, py, TILE, TILE)) return;
  if (drawOverride(ctx, art, 'lashira.prop.fence', px, py, TILE, TILE)) return;
  if (vertical) {
    rect(ctx, px + 20, py, 8, TILE, '#b89968'); rect(ctx, px + 34, py, 8, TILE, '#b89968');
    rect(ctx, px + 16, py + 6, 20, 6, '#9c7f50'); rect(ctx, px + 16, py + TILE - 12, 20, 6, '#9c7f50');
    return;
  }
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

  const blocked = new Set();
  const block = (x, y) => blocked.add(tileKey(x, y));
  const blockRect = (tx, ty, w, h) => { for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) block(x, y); };
  const fillZone = (r, base, tint, seed) => {
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
      rect(ctx, x * TILE, y * TILE, TILE, TILE, base);
      if (tint) dots(ctx, x * seed + y * 13 + 1, 5, x * TILE, y * TILE, TILE, TILE, tint, 3);
    }
  };
  const pathTile = (x, y) => { rect(ctx, x * TILE, y * TILE, TILE, TILE, '#cdb384'); dots(ctx, x * 17 + y * 5, 3, x * TILE, y * TILE, TILE, TILE, '#c0a675', 2); };

  // base grass (soft, no checker)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    rect(ctx, x * TILE, y * TILE, TILE, TILE, '#7cc35a');
    dots(ctx, (x * 31 + y * 7 + 3), 5, x * TILE, y * TILE, TILE, TILE, '#86ca63', 3);
  }
  // zone terrains — flat + gentle speckle (no checkerboard)
  fillZone(ZONES.forest, '#5e9e3f', '#6aac4b', 17);
  fillZone(ZONES.mining, '#9b988f', '#a7a49c', 23);
  fillZone(ZONES.plaza, '#d6c6a0', '#e0d2ae', 11);
  // fishing water
  for (let y = ZONES.fishing.y0; y <= ZONES.fishing.y1; y++) for (let x = ZONES.fishing.x0; x <= ZONES.fishing.x1; x++) {
    rect(ctx, x * TILE, y * TILE, TILE, TILE, '#4b90d0');
    dots(ctx, x * 13 + y * 3, 3, x * TILE, y * TILE, TILE, TILE, '#579cdc', 3);
    block(x, y);
  }
  // martial south: battleground (trodden) + pvp (sand)
  for (let y = ARENA.y0; y <= ARENA.y1; y++) for (let x = ARENA.x0; x <= ARENA.x1; x++) {
    const pvp = x >= PVP.x0;
    rect(ctx, x * TILE, y * TILE, TILE, TILE, pvp ? '#dcc48a' : '#c2a06a');
    dots(ctx, x * 37 + y * 11, 4, x * TILE, y * TILE, TILE, TILE, pvp ? '#e4ce98' : '#b08a55', 3);
  }
  // ROYAL ROADS — stone paths radiating from the castle courtyard (kingdom structure)
  for (let y = 2; y < ZONES.plaza.y0; y++) { pathTile(29, y); pathTile(30, y); }   // N approach
  for (let x = 2; x <= 26; x++) { pathTile(x, 23); pathTile(x, 24); }               // W road → garden
  for (let x = 33; x <= 47; x++) { pathTile(x, 23); pathTile(x, 24); }              // E road → mining
  for (let y = 27; y <= 33; y++) { pathTile(28, y); pathTile(29, y); }              // S spur → arena gate
  // field soil (baked; crops paint on top per-frame)
  for (let y = FIELD.y0; y <= FIELD.y1; y++) for (let x = FIELD.x0; x <= FIELD.x1; x++) drawSoilTile(ctx, x, y, art);

  // border trees
  for (let x = 0; x < W; x++) { drawTree(ctx, x, 0, art); block(x, 0); drawTree(ctx, x, H - 1, art); block(x, H - 1); }
  for (let y = 1; y < H - 1; y++) { drawTree(ctx, 0, y, art); block(0, y); drawTree(ctx, W - 1, y, art); block(W - 1, y); }

  // animal pens (fenced enclosures with a one-tile gate)
  for (const pen of Object.values(PENS)) {
    const mx = Math.floor((pen.x0 + pen.x1) / 2), my = Math.floor((pen.y0 + pen.y1) / 2);
    for (let x = pen.x0 - 1; x <= pen.x1 + 1; x++) {
      if (!(pen.gate === 'top' && x === mx)) { drawFence(ctx, x, pen.y0 - 1, art); block(x, pen.y0 - 1); }
      if (!(pen.gate === 'bottom' && x === mx)) { drawFence(ctx, x, pen.y1 + 1, art); block(x, pen.y1 + 1); }
    }
    for (let y = pen.y0; y <= pen.y1; y++) {
      if (!(pen.gate === 'left' && y === my)) { drawFence(ctx, pen.x0 - 1, y, art, true); block(pen.x0 - 1, y); }
      if (!(pen.gate === 'right' && y === my)) { drawFence(ctx, pen.x1 + 1, y, art, true); block(pen.x1 + 1, y); }
    }
  }

  // buildings (castle centered)
  for (const b of BUILDINGS) { drawBuilding(ctx, b, art); blockRect(b.tx, b.ty, b.w, b.h); }

  // baked landmark + decoration placements
  for (const p of PLACEMENTS) {
    drawOverride(ctx, art, p.key, p.tx * TILE, p.ty * TILE, p.w * TILE, p.h * TILE);
    if (p.solid) blockRect(p.tx, p.ty, p.w, p.h);
  }
  // WALKWAY — the wooden bridge (detected from basemap.png) spans the pond at
  // y35-36 and meets the EAST shore (x17 grass). Make the bridge deck walkable so
  // you can walk out over the water; deep water stays blocked.
  for (let x = 9; x <= 16; x++) for (let y = 35; y <= 36; y++) blocked.delete(tileKey(x, y));

  // dividing wall (mid-zones ↕ martial south) with a 2-wide gate
  for (let x = ARENA.x0; x < W - 1; x++) {
    if (x === ARENA_GATE_X || x === ARENA_GATE_X + 1) continue; // gate
    drawFence(ctx, x, ARENA_WALL_Y, art); block(x, ARENA_WALL_Y);
  }

  // lily pads scattered on the lake
  for (let y = ZONES.fishing.y0; y <= ZONES.fishing.y1; y++) for (let x = ZONES.fishing.x0; x <= ZONES.fishing.x1; x++) {
    if (((x * 331 + y * 97 + 5) >>> 0) % 100 < 9) drawOverride(ctx, art, 'lashira.lib.lily_pad', x * TILE, y * TILE, TILE, TILE);
  }

  // lush decoration scatter on OPEN grass (baked, non-blocking) — fills the space
  // between zones so the world reads full, Animal-Crossing style.
  const inR = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
  const penArea = (x, y) => x >= 33 && x <= 57 && y >= 2 && y <= 17;       // keep the pens tidy
  const onRoad = (x, y) => ((x === 29 || x === 30) && y < ZONES.plaza.y0)
    || ((y === 23 || y === 24) && ((x >= 2 && x <= 26) || (x >= 33 && x <= 47)))
    || ((x === 28 || x === 29) && y >= 27 && y <= 33);
  const inZone = (x, y) => inR(FIELD, x, y) || inR(ZONES.garden, x, y) || inR(ZONES.plaza, x, y)
    || inR(ZONES.mining, x, y) || inR(ZONES.forest, x, y) || inR(ZONES.fishing, x, y) || inR(ARENA, x, y)
    || penArea(x, y) || onRoad(x, y);
  // sparse, tasteful — just occasional grass tufts + the odd flower (no weed clutter)
  const DECO = ['lashira.lib.grass_tuft', 'lashira.lib.grass_tuft', 'lashira.lib.flowers'];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (blocked.has(tileKey(x, y)) || inZone(x, y)) continue;
    let s = (x * 2749 + y * 911 + 7) >>> 0; s = (s * 1103515245 + 12345) >>> 0;
    if ((s % 1000) < 45) drawOverride(ctx, art, DECO[(s >>> 8) % DECO.length], x * TILE, y * TILE, TILE, TILE);
  }

  // ===== BASEMAP — the hand-quality image IS the map, painted over everything above
  // (the procedural art is only a fallback if the image fails to load). Dynamic actors
  // + clickable component sprites render on top. Verified against the red-dot map. =====
  if (drawOverride(ctx, art, 'lashira.basemap', 0, 0, WORLD_W, WORLD_H)) {
    // hide the red placement dots baked into the reference image by cloning a clean
    // patch of ground from just above each (coords are the image's 1394x1128 space).
    const sx = WORLD_W / 1394, sy = WORLD_H / 1128, R = 30;
    for (const [ix, iy] of BASEMAP_DOTS) {
      const wx = Math.round(ix * sx), wy = Math.round(iy * sy);
      if (wy - R - 78 < 0) continue;
      ctx.drawImage(canvas, wx - R, wy - R - 78, R * 2, R * 2, wx - R, wy - R, R * 2, R * 2);
    }
    // clickable component sprites the image lacks (castle + shops), drawn ON TOP
    for (const p of ONTOP) { drawOverride(ctx, art, p.key, p.tx * TILE, p.ty * TILE, p.w * TILE, p.h * TILE); if (p.solid) blockRect(p.tx, p.ty, p.w, p.h); }
  } else if (typeof console !== 'undefined') {
    console.warn('[farm] basemap.png NOT loaded — showing the ugly procedural fallback. Check farm-art-bundled.js "lashira.basemap".');
  }

  return { canvas, blocked };
}

// Red placement dots baked into basemap.png (image 1394x1128 coords) — cloned over
// with nearby ground so they don't show. Detected 2026-07-08.
const BASEMAP_DOTS = [
  [380, 266], [1182, 278], [845, 279], [1006, 279], [696, 301], [254, 332], [523, 333],
  [258, 448], [352, 516], [696, 532], [925, 572], [171, 573], [466, 573], [1201, 576],
  [266, 635], [954, 798], [232, 818], [276, 847], [496, 877], [696, 878], [1088, 906],
  [608, 914], [802, 915], [226, 952],
];

// Clickable component sprites the reference image LACKS (no castle, no shops) —
// drawn ON TOP of the basemap so they're visible + tappable. Positions match the
// castle + shop HOTSPOTS. solid = blocks movement.
const ONTOP = [
  { key: 'lashira.building.house', tx: 26, ty: 17, w: 6, h: 7, solid: true },   // castle at plaza center
  { key: 'lashira.lib.shop_seed', tx: 9, ty: 16, w: 2, h: 2, solid: true },
  { key: 'lashira.lib.shop_general', tx: 13, ty: 19, w: 2, h: 2, solid: true },
  { key: 'lashira.lib.shop_blacksmith', tx: 18, ty: 22, w: 2, h: 2, solid: true },
  { key: 'lashira.lib.shop_animal', tx: 5, ty: 22, w: 2, h: 2, solid: true },
  { key: 'lashira.lib.shop_cosmetics', tx: 9, ty: 25, w: 2, h: 2, solid: true },
];

// Is a tile inside the battle arena?
export function inArena(tx, ty) {
  return tx >= ARENA.x0 && tx <= ARENA.x1 && ty >= ARENA.y0 && ty <= ARENA.y1;
}

// Per-frame: draw tilled soil + crop for one plot at world coords.
function leaf(ctx, x, y, flip = 1) {
  ctx.fillStyle = '#4fa557';
  ctx.fillRect(x, y, 9 * flip, 4);
  ctx.fillStyle = '#66bd6d';
  ctx.fillRect(x + 2 * flip, y - 3, 6 * flip, 3);
}

// Floating growth/health bar above a growing crop — fill = growth %, green while
// growing, gold + pulsing when ripe (harvest me!). No hydration pip (no watering).
function drawCropHealthBar(ctx, px, py, frac, ripe, now) {
  const bw = TILE - 16, bh = 5, bx = px + 8, by = py - 10;
  ctx.fillStyle = 'rgba(18,22,32,0.55)'; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
  ctx.fillStyle = ripe ? '#ffcf3f' : '#43c65a';
  ctx.fillRect(bx, by, Math.max(1, Math.round(bw * frac)), bh);
  if (ripe) { // pulse the ripe bar so "harvest me" reads at a glance
    const a = 0.55 + 0.45 * Math.abs(Math.sin(now / 350));
    ctx.strokeStyle = `rgba(255,222,90,${a.toFixed(2)})`; ctx.lineWidth = 1.5; ctx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);
  }
}

// One soil tile — baked into the map background (whole field is soil). Dry look.
function drawSoilTile(ctx, tx, ty, art = {}) {
  const px = tx * TILE, py = ty * TILE;
  if (drawOverride(ctx, art, 'lashira.plot.soil.dry', px, py, TILE, TILE)) return;
  rect(ctx, px + 3, py + 3, TILE - 6, TILE - 6, '#9a6536');
  rect(ctx, px + 5, py + 5, TILE - 10, 5, '#b17843');
  for (let yy = py + 12; yy < py + TILE - 7; yy += 9) rect(ctx, px + 6, yy, TILE - 12, 3, '#7e4d28');
  dots(ctx, tx * 83 + ty * 19, 5, px + 7, py + 10, TILE - 14, TILE - 16, '#704525', 2);
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

// A withered crop — droopy brown X so "lost, clear me" reads at a glance.
function drawWiltedCrop(ctx, px, py) {
  const cx = px + TILE / 2, base = py + TILE - 12;
  ctx.strokeStyle = '#7c5a34'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 8, base); ctx.lineTo(cx + 7, base - 12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 6, base + 1); ctx.lineTo(cx - 7, base - 11); ctx.stroke();
  ctx.fillStyle = '#5f4425'; ctx.beginPath(); ctx.arc(cx + 7, base - 12, 2.4, 0, 7); ctx.arc(cx - 7, base - 11, 2.4, 0, 7); ctx.fill();
}

// Per-frame: draw the CROP + a bar for one plot. Soil is baked into the map bg, so
// this only paints what grows on top. Ripe crops show a FRESH bar that shrinks +
// reddens (harvest me before I wilt); withered crops show the wilt.
export function drawPlot(ctx, tx, ty, plot, art = {}) {
  if (!plot?.cropId) return;
  const px = tx * TILE, py = ty * TILE;
  const now = Date.now();
  if (cropIsWithered(plot, now)) { drawWiltedCrop(ctx, px, py); return; }
  const frac = cropGrowthFrac(plot, now);
  const ripe = frac >= 1;
  drawCropPixels(ctx, plot.cropId, cropStageOf(frac), px, py, art);
  if (ripe) drawFreshBar(ctx, px, py, cropFreshFrac(plot, now), now);
  else drawCropHealthBar(ctx, px, py, frac, false, now);
}
// Ripe countdown: full gold → shrinks to red, pulses faster as it empties.
function drawFreshBar(ctx, px, py, fresh, now) {
  const bw = TILE - 16, bh = 5, bx = px + 8, by = py - 10;
  ctx.fillStyle = 'rgba(18,22,32,0.55)'; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
  const warn = fresh < 0.35;
  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(now / (warn ? 200 : 360)));
  ctx.fillStyle = warn ? `rgba(224,85,63,${pulse.toFixed(2)})` : '#ffcf3f';
  ctx.fillRect(bx, by, Math.max(1, Math.round(bw * fresh)), bh);
  const a = 0.5 + 0.5 * Math.abs(Math.sin(now / 350));
  ctx.strokeStyle = warn ? `rgba(224,85,63,${a.toFixed(2)})` : `rgba(255,222,90,${a.toFixed(2)})`;
  ctx.lineWidth = 1.5; ctx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);
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
