// Local PixelLab rotation sprites for farm creatures. The PNGs are vendored into
// public/farm-art/creatures/<kind>/<dir>.png (downloaded, NOT fetched from an
// external host) so the embed CSP never blocks them. Lazy-loaded + cached; the
// renderer falls back to the procedural blob until an image finishes loading.
//
// Kinds with art today: fox, squirrel, badger, boar, deer (monsters) + cow, sheep
// (livestock). Tiger + chicken are still placeholders.

const KINDS = new Set(['fox', 'squirrel', 'badger', 'boar', 'deer', 'cow', 'sheep']);
const DIR = { South: 'south', North: 'north', East: 'east', West: 'west' };
const cache = new Map(); // "kind/dir" -> HTMLImageElement

export function hasCreatureSprite(kind) { return KINDS.has(kind); }

// Returns a ready-to-draw HTMLImageElement, or null while it loads / if none.
export function creatureImage(kind, facing) {
  if (!KINDS.has(kind) || typeof Image === 'undefined') return null;
  const dir = DIR[facing] || 'south';
  const key = kind + '/' + dir;
  let img = cache.get(key);
  if (!img) {
    img = new Image();
    img.src = new URL('farm-art/creatures/' + key + '.png', document.baseURI).href;
    cache.set(key, img);
  }
  return (img.complete && img.naturalWidth > 0) ? img : null;
}
