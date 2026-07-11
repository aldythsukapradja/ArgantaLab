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

const KINDS = new Set(['fox', 'squirrel', 'badger', 'boar', 'deer', 'tiger', 'cow', 'sheep', 'chicken']);
// kind -> walk-cycle frame count (template walks = 4 frames, v3 walks = 9). Only
// kinds whose frames are actually downloaded belong here; others stay static.
// 'chicken' walk frames land async (see FarmRoom's animal loop) — until they
// do, creatureFrame's loadImg lookup just misses and falls back to static.
const WALK = new Map([['fox', 4], ['cow', 4], ['sheep', 4], ['chicken', 4], ['deer', 4], ['squirrel', 9], ['badger', 9], ['boar', 9]]);
// Extra non-walk animation states, vendored the same way (creatures/<kind>/<anim>/<dir>/<0..N>.png),
// keyed by a semantic livestock state (see farm-logic.js fedAt/animalGoodReady):
// 'producing' = fed, good not ready yet; 'resting' = idle, not fed. Only used
// when NOT moving (walk always takes priority) — see creatureFrame below.
const STATE_ANIMS = new Map([
  ['cow', { producing: { anim: 'eating', frames: 5, ms: 170 }, resting: { anim: 'rest-idle', frames: 9, ms: 190 } }],
  ['sheep', { resting: { anim: 'idle', frames: 8, ms: 190 } }],
]);
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

// Non-walk state animation frame (eating/rest-idle/idle) — null if the kind
// has no vendored animation for that state, so callers fall back cleanly.
export function creatureStateFrame(kind, state, facing, now) {
  if (!state || typeof Image === 'undefined') return null;
  const spec = STATE_ANIMS.get(kind)?.[state];
  if (!spec) return null;
  const dir = DIR[facing] || 'south';
  const f = Math.floor((now || 0) / spec.ms) % spec.frames;
  return loadImg(kind + '/' + spec.anim + '/' + dir + '/' + f);
}

// The frame to draw: a cycling walk frame when moving + the kind has a walk cycle;
// else a `state` animation (producing/resting) if the kind has one vendored;
// else the static rotation. `now` = performance.now(). Always falls back to the
// static frame if the requested frame hasn't loaded yet (no flicker).
export function creatureFrame(kind, facing, moving, now, state = null) {
  if (!KINDS.has(kind) || typeof Image === 'undefined') return null;
  const dir = DIR[facing] || 'south';
  const frames = WALK.get(kind);
  if (moving && frames) {
    const f = Math.floor((now || 0) / WALK_MS) % frames;
    const walk = loadImg(kind + '/walk/' + dir + '/' + f);
    if (walk) return walk;
  }
  if (!moving && state) {
    const stateImg = creatureStateFrame(kind, state, facing, now);
    if (stateImg) return stateImg;
  }
  return loadImg(kind + '/' + dir);
}
