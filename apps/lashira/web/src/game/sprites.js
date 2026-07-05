// Programmatic pixel-art sprite factory. Draws every texture on an offscreen
// canvas (nearest-neighbour) so the build has ZERO external asset files and is
// guaranteed to render. Swap for PixelLab art later via the same texture keys.
import { Texture } from 'pixi.js';

export const TILE = 32;

function makeTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  draw(g, w, h);
  const t = Texture.from(c);
  if (t.source) t.source.scaleMode = 'nearest';
  return t;
}

// tiny helper: fill a rect
function r(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }

// scatter a few dots deterministically for texture
function dots(g, seed, count, w, h, col, size = 2) {
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  g.fillStyle = col;
  for (let i = 0; i < count; i++) {
    g.fillRect(Math.floor(rnd() * (w - size)), Math.floor(rnd() * (h - size)), size, size);
  }
}

export function buildSprites() {
  const S = {};

  // ---- ground ----
  S.grass = makeTex(TILE, TILE, (g) => {
    r(g, 0, 0, TILE, TILE, '#7cc35a');
    dots(g, 7, 10, TILE, TILE, '#8fd06a');
    dots(g, 31, 6, TILE, TILE, '#6bb14c');
  });
  S.grass2 = makeTex(TILE, TILE, (g) => {
    r(g, 0, 0, TILE, TILE, '#78bf56');
    dots(g, 13, 12, TILE, TILE, '#88cc63');
    r(g, 6, 20, 3, 4, '#4f9c3a'); r(g, 22, 8, 3, 4, '#4f9c3a');
  });
  S.path = makeTex(TILE, TILE, (g) => {
    r(g, 0, 0, TILE, TILE, '#cbb187');
    dots(g, 5, 14, TILE, TILE, '#bda079', 2);
  });
  S.water = makeTex(TILE, TILE, (g) => {
    r(g, 0, 0, TILE, TILE, '#4aa6c9');
    dots(g, 9, 8, TILE, TILE, '#6dbdd9', 3);
  });

  // ---- soil ----
  S.soil = makeTex(TILE, TILE, (g) => {
    r(g, 0, 0, TILE, TILE, '#7cc35a');
    r(g, 2, 2, TILE - 4, TILE - 4, '#a06a3c');
    for (let y = 5; y < TILE - 4; y += 6) r(g, 3, y, TILE - 6, 2, '#8a5730');
  });
  S.soilWet = makeTex(TILE, TILE, (g) => {
    r(g, 0, 0, TILE, TILE, '#7cc35a');
    r(g, 2, 2, TILE - 4, TILE - 4, '#6d4526');
    for (let y = 5; y < TILE - 4; y += 6) r(g, 3, y, TILE - 6, 2, '#573619');
  });

  // ---- farmer (facing down; flipped for left/right at runtime) ----
  S.farmer = makeTex(24, 30, (g) => {
    r(g, 7, 2, 10, 5, '#c98a3a');      // hat brim base
    r(g, 8, 0, 8, 4, '#e0a24a');       // hat top
    r(g, 8, 7, 8, 6, '#f2c9a0');       // face
    r(g, 9, 9, 2, 2, '#2a2a2a'); r(g, 13, 9, 2, 2, '#2a2a2a'); // eyes
    r(g, 6, 13, 12, 9, '#5b8def');     // shirt (overalls blue)
    r(g, 8, 15, 8, 5, '#3f6fd6');
    r(g, 6, 22, 4, 7, '#3a3f63'); r(g, 14, 22, 4, 7, '#3a3f63'); // legs
    r(g, 4, 14, 3, 6, '#f2c9a0'); r(g, 17, 14, 3, 6, '#f2c9a0'); // arms
  });

  // ---- buildings ----
  S.house = makeTex(TILE * 3, TILE * 3, (g, w, h) => {
    r(g, 4, 34, w - 8, h - 38, '#caa06a');        // walls
    r(g, 4, 34, w - 8, h - 38, '#caa06a');
    for (let y = 40; y < h - 6; y += 8) r(g, 6, y, w - 12, 2, '#b58a55');
    g.fillStyle = '#b0472e'; g.beginPath();       // roof
    g.moveTo(0, 40); g.lineTo(w / 2, 2); g.lineTo(w, 40); g.closePath(); g.fill();
    r(g, w / 2 - 10, h - 26, 20, 22, '#6d4526');  // door
    r(g, w / 2 - 6, h - 20, 12, 12, '#8a5730');
    r(g, 16, 46, 14, 14, '#bfe0ef'); r(g, w - 30, 46, 14, 14, '#bfe0ef'); // windows
  });
  S.barn = makeTex(TILE * 3, TILE * 2, (g, w, h) => {
    r(g, 3, 22, w - 6, h - 26, '#c0533a');        // red walls
    g.fillStyle = '#7a2f20'; g.beginPath();
    g.moveTo(0, 26); g.lineTo(w / 2, 2); g.lineTo(w, 26); g.closePath(); g.fill();
    r(g, w / 2 - 14, h - 30, 28, 26, '#e6d2a8');  // big door
    r(g, w / 2 - 1, h - 30, 2, 26, '#9c7f50');
    r(g, w / 2 - 14, h - 30, 28, 2, '#9c7f50');
  });
  S.coop = makeTex(TILE * 2, Math.floor(TILE * 1.6), (g, w, h) => {
    r(g, 3, 16, w - 6, h - 20, '#e3c98a');
    g.fillStyle = '#a8823f'; g.beginPath();
    g.moveTo(0, 20); g.lineTo(w / 2, 2); g.lineTo(w, 20); g.closePath(); g.fill();
    r(g, w / 2 - 8, h - 20, 16, 16, '#7a5a2c');
  });
  S.shop = makeTex(TILE * 2, Math.floor(TILE * 1.7), (g, w, h) => {
    r(g, 2, 20, w - 4, h - 24, '#e7d9b0');        // stall
    g.fillStyle = '#8b5cf6';                       // striped awning
    for (let x = 0; x < w; x += 12) r(g, x, 8, 6, 12, '#8b5cf6');
    for (let x = 6; x < w; x += 12) r(g, x, 8, 6, 12, '#e879b9');
    r(g, 6, h - 14, w - 12, 10, '#caa06a');
  });
  S.bin = makeTex(TILE, Math.floor(TILE * 0.9), (g, w, h) => {
    r(g, 3, 8, w - 6, h - 10, '#8a5730');
    r(g, 3, 8, w - 6, 5, '#6d4526');
    r(g, 6, 2, w - 12, 8, '#a06a3c');
  });

  // ---- props ----
  S.tree = makeTex(TILE, TILE * 2, (g, w, h) => {
    r(g, w / 2 - 3, h - 20, 6, 20, '#7a5230');    // trunk
    g.fillStyle = '#3f8f47'; g.beginPath();
    g.arc(w / 2, h - 30, 14, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4fa557';
    g.beginPath(); g.arc(w / 2 - 6, h - 26, 9, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(w / 2 + 6, h - 26, 9, 0, Math.PI * 2); g.fill();
  });
  S.fence = makeTex(TILE, TILE, (g, w, h) => {
    r(g, 4, 10, 4, 18, '#9c7f50'); r(g, w - 8, 10, 4, 18, '#9c7f50');
    r(g, 0, 14, w, 4, '#b89968'); r(g, 0, 22, w, 4, '#b89968');
  });
  S.well = makeTex(TILE, TILE, (g, w, h) => {
    r(g, 6, 14, w - 12, h - 16, '#8f9aa6');
    r(g, 6, 14, w - 12, 5, '#6f7a86');
    r(g, 8, 18, w - 16, h - 22, '#3a5a70');       // water
    r(g, 4, 4, 3, 12, '#7a5230'); r(g, w - 7, 4, 3, 12, '#7a5230');
    r(g, 2, 2, w - 4, 4, '#7a2f20');              // roof beam
  });

  // ---- animals ----
  S.cow = makeTex(26, 20, (g) => {
    r(g, 3, 6, 20, 11, '#f4f4f4'); r(g, 1, 8, 5, 8, '#f4f4f4');
    r(g, 6, 8, 5, 4, '#3a3a3a'); r(g, 15, 11, 5, 4, '#3a3a3a'); // spots
    r(g, 1, 9, 3, 2, '#2a2a2a'); r(g, 5, 16, 3, 4, '#c98a3a'); r(g, 18, 16, 3, 4, '#c98a3a');
  });
  S.sheep = makeTex(26, 20, (g) => {
    r(g, 4, 5, 18, 12, '#f0eee6'); dots(g, 3, 16, 22, 15, '#dedad0', 3);
    r(g, 2, 8, 5, 6, '#3a3a3a'); r(g, 6, 16, 3, 4, '#3a3a3a'); r(g, 17, 16, 3, 4, '#3a3a3a');
  });
  S.chicken = makeTex(18, 16, (g) => {
    r(g, 4, 5, 10, 8, '#f6f2e8'); r(g, 12, 3, 5, 5, '#f6f2e8');
    r(g, 12, 2, 4, 3, '#e04a4a'); r(g, 16, 5, 2, 2, '#f0a83a'); r(g, 6, 13, 2, 3, '#f0a83a'); r(g, 10, 13, 2, 3, '#f0a83a');
  });

  // ---- kin (harvest sprite) ----
  S.kin = (color) => makeTex(18, 18, (g) => {
    const hex = '#' + color.toString(16).padStart(6, '0');
    g.fillStyle = hex; g.beginPath(); g.arc(9, 10, 7, 0, Math.PI * 2); g.fill();
    r(g, 6, 6, 2, 2, '#1f2340'); r(g, 10, 6, 2, 2, '#1f2340'); // eyes
    r(g, 7, 1, 4, 4, '#4fa557');                                // leaf
  });

  return S;
}

// Crop texture cache, keyed by cropId:stage. stage 0..3 (seed, sprout, grow, ripe)
const cropCache = new Map();
export function cropTex(crop, stage) {
  const key = crop.id + ':' + stage;
  if (cropCache.has(key)) return cropCache.get(key);
  const fruit = '#' + crop.color.toString(16).padStart(6, '0');
  const t = makeTex(TILE, TILE, (g) => {
    if (stage === 0) { r(g, TILE / 2 - 2, TILE - 12, 4, 4, '#5a3d1e'); return; }
    const hh = [0, 8, 16, 20][stage];
    r(g, TILE / 2 - 2, TILE - 6 - hh, 4, hh, '#3f8f47');   // stem
    if (stage >= 2) { r(g, TILE / 2 - 8, TILE - 12, 5, 3, '#4fa557'); r(g, TILE / 2 + 3, TILE - 14, 5, 3, '#4fa557'); }
    if (stage === 3) { g.fillStyle = fruit; g.beginPath(); g.arc(TILE / 2, TILE - 8 - hh, 6, 0, Math.PI * 2); g.fill(); }
  });
  cropCache.set(key, t);
  return t;
}
