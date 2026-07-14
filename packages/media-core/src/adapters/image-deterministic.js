// Stage-0 deterministic image adapter. Zero API, zero cost, reproducible:
// the same spec always yields the same PNG bytes. Runs in pure Node.
//
// Not "AI art" — it's procedural brand-poster generation (gradient / rays /
// bauhaus). The point of Stage 0 is a free, instant, deterministic placeholder
// you can escalate FROM once a concept earns premium spend.

import { encodePNG } from '../png.js';
import { MATURITY } from '../contracts.js';

export const PALETTES = {
  dusk: [[24, 20, 48], [124, 58, 173], [239, 128, 96]],
  mint: [[8, 40, 38], [22, 148, 122], [180, 240, 200]],
  grape: [[26, 12, 46], [96, 44, 168], [214, 148, 255]],
  ember: [[36, 12, 12], [176, 52, 40], [255, 196, 96]],
  ocean: [[8, 26, 54], [24, 108, 178], [140, 214, 240]],
};
export const STYLES = ['gradient', 'rays', 'bauhaus'];

/** Deterministic 32-bit hash of a string (FNV-1a). */
function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/** mulberry32 seeded PRNG. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a, b, t) => a + (b - a) * t;
function ramp(stops, t) {
  const seg = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(seg));
  const f = seg - i;
  return [0, 1, 2].map((c) => Math.round(lerp(stops[i][c], stops[i + 1][c], f)));
}

/**
 * @param {object} spec
 * @param {string} [spec.prompt]   free text (drives the seed)
 * @param {number} [spec.width=1024]
 * @param {number} [spec.height=1024]
 * @param {string} [spec.palette]  one of PALETTES; default derived from seed
 * @param {string} [spec.style]    one of STYLES; default derived from seed
 * @param {number} [spec.seed]     explicit seed overrides the prompt hash
 * @returns {{width,height,mime,bytes,seed,palette,style}}
 */
export function generateImage(spec = {}) {
  const width = Math.max(8, Math.min(2048, spec.width || 1024));
  const height = Math.max(8, Math.min(2048, spec.height || 1024));
  const seed = spec.seed != null ? (spec.seed >>> 0) : hashStr(spec.prompt || 'arganta');
  const rand = rng(seed);

  const palKeys = Object.keys(PALETTES);
  const palette = PALETTES[spec.palette] ? spec.palette : palKeys[Math.floor(rand() * palKeys.length)];
  const style = STYLES.includes(spec.style) ? spec.style : STYLES[Math.floor(rand() * STYLES.length)];
  const stops = PALETTES[palette];

  const angle = rand() * Math.PI * 2;
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const rayCount = 6 + Math.floor(rand() * 10);
  const cx = 0.3 + rand() * 0.4, cy = 0.3 + rand() * 0.4;
  // pre-roll a few bauhaus blocks
  const blocks = Array.from({ length: 4 + Math.floor(rand() * 4) }, () => ({
    x: rand(), y: rand(), w: 0.15 + rand() * 0.35, h: 0.15 + rand() * 0.35, c: Math.floor(rand() * stops.length),
  }));

  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width, v = y / height;
      let col;
      if (style === 'gradient') {
        const t = Math.min(1, Math.max(0, (u * dx + v * dy) * 0.5 + 0.5));
        col = ramp(stops, t);
      } else if (style === 'rays') {
        const a = Math.atan2(v - cy, u - cx);
        const t = (Math.sin(a * rayCount) * 0.5 + 0.5) * 0.7 + Math.hypot(u - cx, v - cy) * 0.3;
        col = ramp(stops, Math.min(1, t));
      } else { // bauhaus
        col = stops[0];
        for (const b of blocks) if (u >= b.x && u < b.x + b.w && v >= b.y && v < b.y + b.h) col = stops[b.c];
      }
      const i = (y * width + x) * 4;
      rgba[i] = col[0]; rgba[i + 1] = col[1]; rgba[i + 2] = col[2]; rgba[i + 3] = 255;
    }
  }

  const bytes = encodePNG(width, height, rgba);
  return { width, height, mime: 'image/png', bytes, seed, palette, style };
}

/** Adapter descriptor consumed by the registry. */
export const imageDeterministicAdapter = {
  id: 'deterministic-image',
  kind: 'image',
  tier: 0,
  stage: MATURITY.DETERMINISTIC,
  runtime: 'node',
  cost: 0,
  run(spec) {
    const img = generateImage(spec);
    return {
      mime: img.mime,
      bytes: img.bytes,
      seed: img.seed,
      extra: { width: img.width, height: img.height, palette: img.palette, style: img.style },
    };
  },
};
