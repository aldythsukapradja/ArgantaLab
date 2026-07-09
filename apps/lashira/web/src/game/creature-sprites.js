// Local PixelLab sprites for farm creatures. PNGs are vendored into
// public/farm-art/creatures/<kind>/... (downloaded, NOT fetched at runtime) so the
// embed CSP never blocks them. Lazy-loaded + cached; callers fall back to the
// procedural blob until an image is ready.
//
//   creatures/<kind>/<dir>.png              — static rotation (idle / all kinds)
//   creatures/<kind>/walk/<dir>/<0..3>.png  — 4-frame walk cycle (some kinds)
//
// Static art: fox squirrel badger boar deer tiger cow sheep. Walk cycles: fox cow
// sheep. Chicken is still a placeholder.

const KINDS = new Set(['fox', 'squirrel', 'badger', 'boar', 'deer', 'tiger', 'cow', 'sheep']);
const WALK = new Set(['fox', 'cow', 'sheep']); // kinds with a downloaded walk cycle
const DIR = { South: 'south', North: 'north', East: 'east', West: 'west' };
const WALK_FRAMES = 4, WALK_MS = 130; // per-frame duration of the walk cycle
const cache = new Map(); // path key -> HTMLImageElement

export function hasCreatureSprite(kind) { return KINDS.has(kind); }

function loadImg(key) {
  let img = cache.get(key);
  if (!img) {
    img = new Image();
    img.src = new URL('farm-art/creatures/' + key + '.png', document.baseURI).href;
    cache.set(key, img);
  }
  return (img.complete && img.naturalWidth > 0) ? img : null;
}

// Static rotation for a facing (idle / kinds without a walk cycle).
export function creatureImage(kind, facing) {
  if (!KINDS.has(kind) || typeof Image === 'undefined') return null;
  return loadImg(kind + '/' + (DIR[facing] || 'south'));
}

// The frame to draw: a cycling walk frame when moving + the kind has a walk cycle,
// otherwise the static rotation. `now` = performance.now(). Always returns the
// static frame if the walk frame hasn't loaded yet (no flicker).
export function creatureFrame(kind, facing, moving, now) {
  if (!KINDS.has(kind) || typeof Image === 'undefined') return null;
  const dir = DIR[facing] || 'south';
  if (moving && WALK.has(kind)) {
    const f = Math.floor((now || 0) / WALK_MS) % WALK_FRAMES;
    const walk = loadImg(kind + '/walk/' + dir + '/' + f);
    if (walk) return walk;
  }
  return loadImg(kind + '/' + dir);
}
