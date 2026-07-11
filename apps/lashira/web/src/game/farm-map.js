// Farm map: layout, collision, and procedural canvas art. The whole ground is
// painted ONCE into an offscreen canvas (like Kingdom's map image), then drawn
// each frame; plots + crops are painted per-frame on top. All placeholder art —
// swap for PixelLab/real farm tiles later.
import { CROPS, cropGrowthFrac, cropStageOf } from '../data/crops.js';
import { drawOverride } from './farm-art-runtime.js';
import { creatureFrame } from './creature-sprites.js';
import { drawActualKinSprite } from './kin-sprite-image.jsx';
import { WORLD_PORTALS } from './world-map-registry.js';

export const TILE = 48;                       // matches Kingdom Heroes scale
export const W = 60, H = 48;                  // one overworld: all zones + castle center
export const WORLD_W = W * TILE, WORLD_H = H * TILE;

// Crop field — the Farm (NW), biggest zone. Pre-tilled soil, open (no fence).
export const FIELD = { x0: 7, y0: 6, x1: 26, y1: 15 };  // basemap's fenced tilled plot (top extended 1 row to the player's edge; bottom kept off the fence)

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
// Where a PvP loser respawns: the bottom (south edge) of the PvP courtyard
// itself, NOT ejected all the way back out through the outer ARENA_GATE_X
// gate (that's the PvE-faint behavior) — a duel loss just knocks you to the
// near edge of the ring, still inside the arena, so the fight can continue.
export const PVP_GATE = [Math.round((PVP.x0 + PVP.x1) / 2), PVP.y1 - 1];
// Measured directly against the basemap art (pixel-scanned the fence/gate
// pixels, not eyeballed): the wall's real fence row sits at tile 33 and the
// ornate gate + garden path sit at tiles 30-31 — the old 32/28 values were
// blocking/opening tiles a full 1-2 tiles off from what the art shows, so a
// creature standing perfectly in-bounds could visually clip the fence.
export const ARENA_WALL_Y = 33;               // wall dividing the mid-zones from the martial south
export const ARENA_GATE_X = 30;               // 2-wide gate (ARENA_GATE_X .. +1)

// Animal pens (NE): cow | sheep | chicken columns, combined ≈ farm size.
export const PENS = {
  cow: { x0: 35, y0: 6, x1: 40, y1: 14, gate: 'bottom' },
  sheep: { x0: 42, y0: 6, x1: 47, y1: 14, gate: 'bottom' },
  chicken: { x0: 49, y0: 6, x1: 55, y1: 14, gate: 'bottom' },
};

// Castle sits DEAD CENTER (map center tile 30,24). 6×6 → drawn 288×288, centered.
export const BUILDINGS = [
  { key: 'house', type: 'house', tx: 27, ty: 21, w: 6, h: 6, label: 'Castle' },
  { key: 'barn', type: 'barn', tx: 35, ty: 2, w: 3, h: 2, label: 'Barn' },
  { key: 'coop', type: 'coop', tx: 50, ty: 2, w: 2, h: 2, label: 'Coop' },
  { key: 'shop', type: 'shop', tx: 22, ty: 16, w: 2, h: 2, label: 'Market' },
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
  ...WORLD_PORTALS.map((p) => ({ kind: 'realm', id: p.id, portal: p, rect: p.hqHotspot })),
  { kind: 'castle', id: 'castle', rect: { x0: 27, y0: 21, x1: 32, y1: 26 } },
  { kind: 'shop', id: 'seed', rect: { x0: 9, y0: 17, x1: 11, y1: 19 } },
  { kind: 'shop', id: 'general', ported: false, rect: { x0: 13, y0: 20, x1: 15, y1: 22 } },
  // smith + animal moved off the W royal road (y23-24) south into the garden's
  // clear band (y25-27) — their old rects straddled the walking path.
  { kind: 'shop', id: 'smith', rect: { x0: 18, y0: 25, x1: 20, y1: 27 } },
  { kind: 'shop', id: 'animal', ported: false, rect: { x0: 5, y0: 25, x1: 7, y1: 27 } },
  { kind: 'shop', id: 'cosmetic', ported: false, rect: { x0: 9, y0: 26, x1: 11, y1: 28 } },
  { kind: 'sell', id: 'market', rect: { x0: 22, y0: 16, x1: 23, y1: 17 } },
  // Badge/tap-zone only, relocated to the battleground band near the arena
  // gate — the dungeon-gate ART is still baked into the mine's basemap tiles
  // (48,18); this is a placeholder move until that art gets its own asset.
  { kind: 'dungeon', id: 'dungeon', ported: false, rect: { x0: 34, y0: 34, x1: 35, y1: 35 } },
  { kind: 'dock', id: 'dock', rect: { x0: 12, y0: 37, x1: 15, y1: 38 } },
  // the scoreboard prop already sits inside the PvP rectangle — the natural
  // spot for the circle rank board (tap it to see who's winning).
  { kind: 'pvprank', id: 'pvprank', rect: { x0: 48, y0: 34, x1: 48, y1: 35 } },
];

// ── HARVEST NODES: ore (Mine, tx45-59) + trees (Forest grove, tx37-44) mapped onto
// the basemap deposits. Each node draws its READY sprite while gatherable and its
// DEPLETED sprite (small_rock / stump) during the respawn cooldown. mine()/chop()
// read node.ore / node.hard and tier-gate internally (gold+gem = T2 pickaxe, oak = T2 axe).
const ORE_ART = { stone: 'lashira.lib.boulder', copper: 'lashira.lib.ore_copper', iron: 'lashira.lib.ore_iron', gold: 'lashira.lib.ore_gold', gem: 'lashira.lib.ore_gem' };
const ORE_NODES = [ // [ore, x, y]  (✓ = pixel-confirmed on the basemap)
  ['gem', 47, 29], ['gold', 50, 24], ['copper', 49, 30], ['iron', 53, 22], ['stone', 51, 31],
  ['copper', 56, 25], ['gold', 57, 20], ['iron', 52, 27], ['stone', 55, 30],
];
const TREE_NODES = [ // [x, y, hard]  (hard = oak, needs Tier-2 axe)
  [38, 17, false], [42, 18, false], [37, 20, false], [43, 21, true], [39, 23, false],
  [41, 26, true], [38, 28, false], [43, 28, false], [40, 30, false],
];
for (const [ore, x, y] of ORE_NODES) {
  HOTSPOTS.push({ kind: 'ore', id: `ore@${x},${y}`, ore, art: ORE_ART[ore], depleted: 'lashira.lib.small_rock', rect: { x0: x, y0: y, x1: x, y1: y } });
}
for (const [x, y, hard] of TREE_NODES) {
  HOTSPOTS.push({ kind: 'tree', id: `tree@${x},${y}`, hard, art: hard ? 'lashira.lib.tree_oak' : 'lashira.lib.tree_pine', depleted: 'lashira.lib.stump', rect: { x0: x, y0: y, x1: x + 1, y1: y + 1 } });
}
// Render + collision list for FarmRoom (the ore/tree hotspots, in draw order: trees behind).
export const HARVEST_NODES = HOTSPOTS.filter((h) => h.kind === 'ore' || h.kind === 'tree');
export function hotspotAt(tx, ty) {
  for (const h of HOTSPOTS) { const r = h.rect; if (tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1) return h; }
  return null;
}

// Status markers for the on-map overlay: one dot per interactive point (tile-center
// coords). ported=true → green (wired + works), false → red (placeholder). Built
// from HOTSPOTS + the zone hotspots (farm/animals/battleground/pvp) that route
// through other tap paths. As a mechanic is wired, flip its `ported` → its dot goes green.
const HOTSPOT_LABEL = {
  lashira_keep: 'Lashira Keep', bloomwall_pass: 'Bloomwall Pass', hearthrush_kitchen: 'Hearthrush Kitchen',
  fountain_festival: 'Fountain Festival', emberring_arena: 'Emberring Arena',
  castle: '🏰 Castle', seed: '🌱 Seed Shop', general: '🛒 General Store', smith: '⚒️ Blacksmith',
  animal: '🐮 Animal Shop', cosmetic: '🎀 Cosmetics', market: '💰 Market', dungeon: '⚔️ Dungeon', dock: '🎣 Fishing',
  pvprank: '🏆 PvP Rank',
};
const PEN_LABEL = { cow: '🐄 Cow Pasture', sheep: '🐑 Sheep Pen', chicken: '🐔 Chicken Coop' };
function markerLabel(h) {
  if (h.kind === 'ore') return '⛏️ ' + h.ore[0].toUpperCase() + h.ore.slice(1) + ' Node';
  if (h.kind === 'tree') return h.hard ? '🌳 Oak (T2 axe)' : '🌲 Tree';
  if (h.kind === 'realm') return h.portal?.name || HOTSPOT_LABEL[h.id] || h.id;
  return HOTSPOT_LABEL[h.id] || h.id;
}
export const HOTSPOT_MARKERS = (() => {
  const m = [];
  for (const h of HOTSPOTS) m.push({ x: (h.rect.x0 + h.rect.x1 + 1) / 2, y: (h.rect.y0 + h.rect.y1 + 1) / 2, ported: h.ported !== false, label: markerLabel(h) });
  m.push({ x: (FIELD.x0 + FIELD.x1 + 1) / 2, y: (FIELD.y0 + FIELD.y1 + 1) / 2, ported: true, label: '🌾 Farm' });                 // farm
  for (const [k, p] of Object.entries(PENS)) m.push({ x: (p.x0 + p.x1 + 1) / 2, y: (p.y0 + p.y1 + 1) / 2, ported: true, label: PEN_LABEL[k] || k }); // animals
  m.push({ x: (ARENA.x0 + PVP.x0) / 2, y: (ARENA.y0 + ARENA.y1 + 1) / 2, ported: true, label: '🗡️ Battleground' });               // battleground
  m.push({ x: (PVP.x0 + PVP.x1 + 1) / 2, y: (PVP.y0 + PVP.y1 + 1) / 2, ported: true, label: '🏟️ PvP Arena' });                   // pvp
  return m;
})();

// ── MAP MARKERS: the floating circular "logo" badges drawn over each landmark
// (the same look as the 🎣 fishing beacon, unified for every hotspot). Each is a
// screen-space badge whose tap is hit-tested BEFORE the arena combat-strike branch,
// which is what makes the Emberring Arena (and every landmark) reliably clickable
// even while standing inside the on-map combat band. Excludes gather nodes (ore/
// tree — they have their own ready-rings), the castle (its footprint stays tappable
// via the rect fallback, and the Keep badge already sits on it), and the dock (its
// dedicated 🎣 beacon is the reference visual and keeps its fast-travel teleport).
const MARKER_ICON = { seed: '🌱', general: '🛒', smith: '⚒️', animal: '🐮', cosmetic: '🎀', market: '💰', dungeon: '⚔️', pvprank: '🏆' };
// iconKey → 'lashira.marker.<key>' image (see farm-art-bundled.js). Preferred
// over the emoji above, which stays only as a last-resort fallback if the
// image somehow fails to load (canvas fillText has no emoji-font fallback,
// so raw emoji can silently render blank on some mobile browsers/webviews).
const MARKER_ICON_KEY = { seed: 'seed', general: 'cart', smith: 'anvil', animal: 'livestock', cosmetic: 'ribbon', market: 'coin', dungeon: 'sword', pvprank: 'trophy' };
const REALM_ICON_KEY = { lashira_keep: 'castle', bloomwall_pass: 'shield', hearthrush_kitchen: 'cooking', fountain_festival: 'festival', emberring_arena: 'sword' };
const MARKER_COLOR = { shop: '#5aa9ff', sell: '#f2b23a', dungeon: '#b46bff', pvprank: '#ffcf3a' };
export const MAP_MARKERS = (() => {
  const out = [];
  for (const h of HOTSPOTS) {
    if (h.kind === 'ore' || h.kind === 'tree' || h.kind === 'castle' || h.kind === 'dock') continue;
    const isRealm = h.kind === 'realm';
    const src = isRealm && Array.isArray(h.portal?.marker) ? h.portal.marker : [(h.rect.x0 + h.rect.x1 + 1) / 2, (h.rect.y0 + h.rect.y1 + 1) / 2];
    out.push({
      kind: h.kind,
      id: h.id,
      portal: h.portal || null,
      cx: src[0],
      cy: src[1],
      icon: isRealm ? (h.portal?.icon || '⭐') : (MARKER_ICON[h.id] || '📍'),
      iconKey: isRealm ? (REALM_ICON_KEY[h.id] || null) : (MARKER_ICON_KEY[h.id] || null),
      color: isRealm ? (h.portal?.color || '#8ef5ff') : (MARKER_COLOR[h.kind] || '#8ef5ff'),
      name: markerLabel(h),
      lift: 0.9, // tiles lifted above the tile-center so the badge floats over the art
    });
  }
  return out;
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
    // pond is an OVAL (measured from basemap: ~center 9,38.5), not the full zone —
    // so the grassy SW shore stays walkable. Bridge deck is re-opened below.
    const dx = (x - 9) / 6.2, dy = (y - 38.5) / 6.5;
    if (dx * dx + dy * dy <= 1) block(x, y);
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

  // animal pens (fenced enclosures) — full perimeter blocked here; the wide
  // bottom gates + side passages are carved open AFTER harvest-node blocking
  // below (must run last, see PEN_OPENINGS carve).
  for (const pen of Object.values(PENS)) {
    for (let x = pen.x0 - 1; x <= pen.x1 + 1; x++) {
      drawFence(ctx, x, pen.y0 - 1, art); block(x, pen.y0 - 1);
      drawFence(ctx, x, pen.y1 + 1, art); block(x, pen.y1 + 1);
    }
    for (let y = pen.y0; y <= pen.y1; y++) {
      drawFence(ctx, pen.x0 - 1, y, art, true); block(pen.x0 - 1, y);
      drawFence(ctx, pen.x1 + 1, y, art, true); block(pen.x1 + 1, y);
    }
  }

  // COLLISION MODEL: the basemap IMAGE is the map, so collision is NOT derived from
  // these procedural props anymore (they're painted under the image = invisible, and
  // their footprints don't line up with the art). We only draw them as a fallback and
  // block a small hand-picked set that MATCHES the basemap: map border, pond water,
  // pen fences, the arena divider, the ON-TOP shops + castle base. Everything else is
  // walkable. (Refine trees/rocks/walls from a dev-mode screenshot later.)
  for (const b of BUILDINGS) drawBuilding(ctx, b, art);           // draw only (no block)
  for (const p of PLACEMENTS) drawOverride(ctx, art, p.key, p.tx * TILE, p.ty * TILE, p.w * TILE, p.h * TILE); // draw only (no block)
  // WALKWAY — the wooden bridge spans the pond and meets the EAST shore. Make
  // the bridge deck walkable so you can walk out over the water; deep water
  // stays blocked. RE-MEASURED against basemap.png (2026-07-10, pixel-sampled:
  // the deck's real footprint is image x≈240-380/y≈860-940 → tile x≈10-16.4,
  // y≈36.6-38.9) — the original x9-16/y35-36 carve was 2 tiles too far north,
  // which is why the dock hotspot rendered floating in open water instead of
  // on the bridge (see the dev no-walk overlay). Widened +1 tile of margin.
  for (let x = 9; x <= 17; x++) for (let y = 36; y <= 39; y++) blocked.delete(tileKey(x, y));

  // dividing wall (mid-zones ↕ martial south) with a 2-wide gate
  for (let x = ARENA.x0; x < W - 1; x++) {
    if (x === ARENA_GATE_X || x === ARENA_GATE_X + 1) continue; // gate
    drawFence(ctx, x, ARENA_WALL_Y, art); block(x, ARENA_WALL_Y);
  }

  // harvest nodes (ore + trees) block their footprint — solid whether ripe or depleted.
  for (const n of HARVEST_NODES) blockRect(n.rect.x0, n.rect.y0, n.rect.x1 - n.rect.x0 + 1, n.rect.y1 - n.rect.y0 + 1);

  // ROAD FIX — the tree harvest node at (39,23) sits astride the E royal road
  // (y23-24, garden→mining), blocking the path. Carve its footprint walkable
  // AFTER the harvest-node block loop above (must run last or it gets
  // re-blocked) — tree sprite unchanged, still harvestable via hotspotAt,
  // just no longer solid, same pattern as the bridge deck carve above.
  for (let x = 39; x <= 40; x++) for (let y = 23; y <= 24; y++) blocked.delete(tileKey(x, y));

  // PEN OPENINGS — wide bottom gates (cow/sheep only, no chicken gate) + side
  // passages between pens (cow↔sheep at x41, sheep↔chicken at x48). Carved
  // AFTER the pen perimeter block above (player-only; animals stay rect-
  // clamped to PENS via moveChoice()'s inHome check, so they can't reach
  // these openings regardless).
  const PEN_OPENINGS = [
    '36,15', '37,15', '38,15', '39,15', // cow bottom gate (x36-39)
    '43,15', '44,15', '45,15', '46,15', // sheep bottom gate (x43-46)
    '41,9',                             // cow <-> sheep side passage
    '48,9',                             // sheep <-> chicken side passage
  ];
  for (const k of PEN_OPENINGS) { const [ox, oy] = k.split(',').map(Number); blocked.delete(tileKey(ox, oy)); }

  // PEN BUILDINGS — the barn/coop shed sprites baked into the basemap art had
  // no collision at all (walk-through). Solid footprints matching the art;
  // none of these overlap the openings carved above.
  blockRect(35, 12, 2, 2); // cow barn
  blockRect(44, 6, 4, 3);  // sheep barn
  blockRect(51, 6, 5, 4);  // chicken coop (top)
  blockRect(53, 12, 3, 2); // chicken shed (bottom)

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
    // The current basemap is clean. Older builds cloned square patches over red
    // placement dots; on the new art that patcher creates visible square artifacts.
    // Keep the intended component sprites and collision, but do no patch cloning.
    for (const p of ONTOP) { if (!p.noDraw) drawOverride(ctx, art, p.key, p.tx * TILE, p.ty * TILE, p.w * TILE, p.h * TILE); if (p.solid) blockRect(p.tx, p.ty, p.w, p.h); }
  } else if (typeof console !== 'undefined') {
    console.warn('[farm] basemap.png NOT loaded — showing the ugly procedural fallback. Check farm-art-bundled.js "lashira.basemap".');
  }

  return { canvas, blocked };
}

// Castle footprint, centered on the plaza crossroads. Collision-only here; the
// SPRITE is drawn per-frame in FarmRoom so its skin is swappable (Castle panel).
// Castle is anchored by its FOOT (base-center) on the plaza roundabout — measured
// from the basemap the cobble disc centers near tile (29.7, 22.8). The sprite is drawn
// bottom-anchored at (footX,footY) at native aspect, width = w tiles, rising upward, so
// the building sits centered IN the circle. base* = the small solid footprint that
// blocks movement + is outlined in dev mode.
// CENTER-anchored on the plaza roundabout. Measured from the basemap via calibrated
// cobble detection: the disc spans tx26-33 (8 tiles wide) x ty19-25, center (29.5, 22).
// The sprite is drawn centered on (cx,cy) at native aspect, width = w tiles (fills the
// disc). base* = the solid footprint under the building.
export const CASTLE = { cx: 30.5, cy: 20.5, w: 8, baseTx: 29, baseTy: 21, baseW: 4, baseH: 3 };

// Player spawn — the courtyard directly in front of the castle door (south of the
// solid base at y21–23, clear of the shops at y19/y28). Fresh sessions start here
// instead of mid-field, so you "arrive home" at the castle. If it ever ends up
// solid (skin swap), FarmRoom nudges to the nearest open neighbour.
export const SPAWN = [30, 25];

// ── NUMBERED ANNOTATION ZONES ─────────────────────────────────────────────
// One entry per meaningful place, for the labelled debug overlay (screen-space
// numbered badges + legend). `walk:true` = players can walk here; `walk:false`
// = solid / no-walk. `rect` (tile bounds) draws a boundary box; point-only zones
// use cx/cy. This drives ONLY the overlay — real collision still comes from `blocked`.
const _zc = (r) => [(r.x0 + r.x1 + 1) / 2, (r.y0 + r.y1 + 1) / 2];
const _sr = (id) => (HOTSPOTS.find((h) => h.id === id) || { rect: { x0: 0, y0: 0, x1: 0, y1: 0 } }).rect;

// World-space anchor for the always-on fishing beacon (FarmRoom draws a
// pulsing 🎣 marker here every frame, screen-projected via the camera, so
// players can SEE where the dock hotspot is instead of hunting for it).
// Derived from the real dock rect so it can never drift out of sync with it.
const [_dockCx, _dockCy] = _zc(_sr('dock'));
export const DOCK_MARKER = { cx: _dockCx, cy: _dockCy };
export const ZONES_ANNOT = [
  { label: 'Farm', walk: true, rect: FIELD, noDraw: true },     // ← Gemini: keep clear
  { label: 'Castle', walk: false, rect: { x0: CASTLE.baseTx, y0: CASTLE.baseTy, x1: CASTLE.baseTx + CASTLE.baseW - 1, y1: CASTLE.baseTy + CASTLE.baseH - 1 }, custom: true },
  { label: 'Greenhouse', walk: false, cx: 7, cy: 21 },
  { label: 'Seed Shop', walk: false, rect: _sr('seed') },
  { label: 'General Store', walk: false, rect: _sr('general') },
  { label: 'Blacksmith', walk: false, rect: _sr('smith') },
  { label: 'Animal Shop', walk: false, rect: _sr('animal') },
  { label: 'Cosmetics', walk: false, rect: _sr('cosmetic') },
  { label: 'Market (sell)', walk: false, rect: _sr('market') },
  { label: 'Cow Pasture', walk: true, rect: PENS.cow },
  { label: 'Sheep Pen', walk: true, rect: PENS.sheep },
  { label: 'Chicken Coop', walk: true, rect: PENS.chicken },
  { label: 'Forest (chop)', walk: false, cx: (ZONES.forest.x0 + ZONES.forest.x1) / 2, cy: (ZONES.forest.y0 + ZONES.forest.y1) / 2 },
  { label: 'Mine (dig)', walk: false, cx: (ZONES.mining.x0 + ZONES.mining.x1) / 2, cy: (ZONES.mining.y0 + ZONES.mining.y1) / 2 },
  { label: 'Dungeon Gate', walk: false, rect: _sr('dungeon') },
  { label: 'Fishing Dock', walk: true, rect: _sr('dock') },
  { label: 'Pond (water)', walk: false, cx: 5, cy: 40 },
  { label: 'Battleground', walk: true, rect: ARENA },
  { label: 'PvP Arena', walk: true, rect: PVP },
].map((z, i) => { const [cx, cy] = z.rect ? _zc(z.rect) : [z.cx, z.cy]; return { n: i + 1, ...z, cx, cy }; });

// Clickable component sprites the reference image LACKS (shops) — drawn ON TOP of the
// basemap so they're visible + tappable. Positions match the shop HOTSPOTS. solid = blocks.
const ONTOP = [
  { key: 'lashira.building.house', tx: CASTLE.baseTx, ty: CASTLE.baseTy, w: CASTLE.baseW, h: CASTLE.baseH, solid: true, noDraw: true }, // castle: base footprint blocks only
  { key: 'lashira.lib.shop_seed', tx: 9, ty: 16, w: 2, h: 2, solid: true },
  { key: 'lashira.lib.shop_general', tx: 13, ty: 19, w: 2, h: 2, solid: true },
  { key: 'lashira.lib.shop_blacksmith', tx: 18, ty: 25, w: 2, h: 2, solid: true },
  { key: 'lashira.lib.shop_animal', tx: 5, ty: 25, w: 2, h: 2, solid: true },
  { key: 'lashira.lib.shop_cosmetics', tx: 9, ty: 25, w: 2, h: 2, solid: true },
];

// Is a tile inside the battle arena?
export function inArena(tx, ty) {
  return tx >= ARENA.x0 && tx <= ARENA.x1 && ty >= ARENA.y0 && ty <= ARENA.y1;
}
// The PvP sub-rectangle specifically (right portion of the martial band) — for
// the fair player-vs-player ruleset (see @arganta/combat pvp.js). Monsters are
// kept OUT of this rectangle (see spawnArenaMonster in FarmRoom.jsx) so PvP
// reads as its own arena, not "fight a boar while also dueling a friend".
export function inPvp(tx, ty) {
  return tx >= PVP.x0 && tx <= PVP.x1 && ty >= PVP.y0 && ty <= PVP.y1;
}
// Battleground = the arena band MINUS the PvP rectangle — where monsters
// spawn/roam (PvE only).
export const BATTLEGROUND = { x0: ARENA.x0, y0: ARENA.y0, x1: PVP.x0 - 1, y1: ARENA.y1 };

// The clickable castle footprint (matches the 'castle' HOTSPOT rect) — used by
// zoneOf so standing at/near home base reads "Castle" rather than "Shops".
const CASTLE_RECT = { x0: 27, y0: 21, x1: 32, y1: 26 };

// Location-aware zone resolver: which named place is tile (tx,ty) in? Returns
// { key, label } for the HUD's zone pill. Specific/nested zones (pens, PvP,
// castle) are checked BEFORE the broader ones they sit inside, so the most
// meaningful name wins. Anything not in a named zone reads as open meadow.
export function zoneOf(tx, ty) {
  const inR = (r) => r && tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1;
  // animal pens (NE) — most specific
  if (inR(PENS.cow)) return { key: 'cow', label: '🐄 Cow Pasture' };
  if (inR(PENS.sheep)) return { key: 'sheep', label: '🐑 Sheep Pen' };
  if (inR(PENS.chicken)) return { key: 'chicken', label: '🐔 Chicken Coop' };
  // martial south — PvP rectangle before the wider hunting band it sits in
  if (inPvp(tx, ty)) return { key: 'pvp', label: '⚔️ PvP Arena' };
  if (inR(ARENA)) return { key: 'hunting', label: '🗡️ Hunting Ground' };
  // farm field
  if (inR(FIELD)) return { key: 'farm', label: '🌾 Farm' };
  // east zones
  if (inR(ZONES.mining)) return { key: 'mining', label: '⛏️ Mines' };
  if (inR(ZONES.forest)) return { key: 'forest', label: '🌲 Forest' };
  // west / SW
  if (inR(ZONES.fishing)) return { key: 'fishing', label: '🎣 Fishing Lake' };
  if (inR(ZONES.garden)) return { key: 'garden', label: '🌷 Garden' };
  // central plaza — castle (home base) before the shops that ring it
  if (inR(CASTLE_RECT)) return { key: 'castle', label: '🏰 Castle' };
  if (inR(ZONES.plaza)) return { key: 'shops', label: '🛒 Shops' };
  return { key: 'meadow', label: '🌿 Meadow' };
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

// Per-frame: draw the CROP + a status marker for one plot. Soil is baked into the
// map bg, so this only paints what grows on top. Ripe crops no longer expire —
// they wait for you (and regrow after harvest) — so instead of a wither countdown
// they show a cheerful "ready" tick badge, the same visual language as the animal
// good-ready disc.
export function drawPlot(ctx, tx, ty, plot, art = {}) {
  if (!plot?.cropId) return;
  const px = tx * TILE, py = ty * TILE;
  const now = Date.now();
  const frac = cropGrowthFrac(plot, now);
  const ripe = frac >= 1;
  drawCropPixels(ctx, plot.cropId, cropStageOf(frac), px, py, art);
  if (ripe) drawReadyBadge(ctx, px, py, now);
  else drawCropHealthBar(ctx, px, py, frac, false, now);
}
// Ripe: a small green disc with a white checkmark, gently bobbing above the crop.
function drawReadyBadge(ctx, px, py, now) {
  const cx = px + TILE / 2, cy = py - 6 + Math.sin(now / 320) * 2.5;
  const R = 9;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fillStyle = '#3fae56'; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 3.8, cy); ctx.lineTo(cx - 0.8, cy + 3); ctx.lineTo(cx + 4.2, cy - 3.4); ctx.stroke();
  ctx.restore();
}

function drawNamedOverride(ctx, art, key, footX, footY, w, h) {
  return drawOverride(ctx, art, key, footX - w / 2, footY - h, w, h);
}

export function drawAnimalSprite(ctx, species, footX, footY, facing = 'South', frame = 0, art = {}, squash = 0, moving = false, now = 0, state = null) {
  // Sized to read next to the (Kingdom-scale) farmer: cows/sheep ~1.5 tiles, chickens
  // smaller. Chickens are noticeably smaller than cows/sheep.
  // PixelLab rotation sprite (facing-correct, no flip) for cow/sheep/chicken,
  // if no art override is set; falls through to the hand-drawn placeholder
  // below only if the image genuinely fails to load.
  // `state` ('producing'/'resting', from the livestock feed/produce cycle) picks
  // an eating/idle animation when not moving, if the species has one vendored.
  if (!art?.[`lashira.animal.${species}`]) {
    const px = creatureFrame(species, facing, moving, now, state);
    if (px) {
      const iw = px.naturalWidth || 68, ih = px.naturalHeight || 68;
      // BIGGER livestock — sprites have ~30% transparent padding, so a larger
      // target height makes the animal read at ~1.6 tiles next to the farmer.
      const targetH = species === 'chicken' ? 84 : 112;
      const s = targetH / ih, w = iw * s, h = ih * s;
      ctx.save(); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(px, footX - w / 2, footY + 4 - h, w, h);
      ctx.restore();
      return;
    }
  }
  const [aw, ah] = species === 'chicken' ? [56, 60] : [96, 80];
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
