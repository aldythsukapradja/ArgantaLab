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
// kind -> walk-cycle frame count (template walks = 4 frames, v3 walks = 9). Only
// kinds whose frames are actually downloaded belong here; others stay static.
const WALK = new Map([['fox', 4], ['cow', 4], ['sheep', 4], ['deer', 4], ['squirrel', 9], ['badger', 9], ['boar', 9]]);
const DIR = { South: 'south', North: 'north', East: 'east', West: 'west' };
const WALK_MS = 130; // per-frame duration of the walk cycle
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
  const frames = WALK.get(kind);
  if (moving && frames) {
    const f = Math.floor((now || 0) / WALK_MS) % frames;
    const walk = loadImg(kind + '/walk/' + dir + '/' + f);
    if (walk) return walk;
  }
  return loadImg(kind + '/' + dir);
}
