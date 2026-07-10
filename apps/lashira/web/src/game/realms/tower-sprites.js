// Local PixelLab sprites for Bloomwall Pass towers. PNGs are vendored into
// public/farm-art/towers/<type>/<tier>.png (downloaded, NOT fetched at runtime,
// same convention as creature-sprites.js) so the embed CSP never blocks them.
// Lazy-loaded + cached; callers fall back to the icon-badge render until an
// image is ready.

const KINDS = new Set(['sentry', 'bramble', 'frostbud', 'sunspire']);
const cache = new Map(); // path key -> HTMLImageElement

export function hasTowerSprite(type) { return KINDS.has(type); }

function loadImg(key) {
  let img = cache.get(key);
  if (!img) {
    img = new Image();
    img.src = new URL('farm-art/towers/' + key + '.png', document.baseURI).href;
    cache.set(key, img);
  }
  return (img.complete && img.naturalWidth > 0) ? img : null;
}

// tier: 1 or 2. Returns null (caller falls back to icon badge) until loaded.
export function towerSprite(type, tier) {
  if (!KINDS.has(type) || typeof Image === 'undefined') return null;
  return loadImg(type + '/' + (tier === 2 ? '2' : '1'));
}
