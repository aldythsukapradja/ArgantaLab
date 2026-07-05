// Palette recoloring: draws a part's .idx sheet through a palette into an
// offscreen canvas (client-style dyeing). LRU-cached per (key, paletteId).

const cache = new Map(); // key -> canvas
const MAX = 48;

export async function tintedSheet(idxImagePromise, palette, cacheKey) {
  if (cache.has(cacheKey)) {
    const v = cache.get(cacheKey);
    cache.delete(cacheKey);
    cache.set(cacheKey, v); // refresh LRU position
    return v;
  }
  const idxImg = await idxImagePromise;
  const c = document.createElement('canvas');
  c.width = idxImg.width;
  c.height = idxImg.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(idxImg, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  const px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    const idx = px[i]; // grayscale sheet: R channel = palette index
    if (idx === 0) {
      px[i + 3] = 0;
      continue;
    }
    const col = palette[idx] || [255, 0, 255];
    px[i] = col[0];
    px[i + 1] = col[1];
    px[i + 2] = col[2];
    px[i + 3] = 255;
  }
  ctx.putImageData(d, 0, 0);
  cache.set(cacheKey, c);
  if (cache.size > MAX) cache.delete(cache.keys().next().value);
  return c;
}
