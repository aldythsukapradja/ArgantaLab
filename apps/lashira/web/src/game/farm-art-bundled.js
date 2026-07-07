// Static farm art bundled WITH the game — sliced from the LashiraBloom component
// sheet (reference/component-sheet.png), parchment background keyed out, and
// downscaled. This is the BASE art layer: it needs no admin, no DB write, and
// ships for everyone. Live `lashira_pixel_art` rows layer ON TOP of this
// (loadFarmArtOverrides), and any slot with no art at all falls back to the
// procedural placeholder (drawOverride returns false). So art degrades safely:
//   DB override  >  bundled sheet art  >  procedural placeholder
//
// Files live in public/farm-art and are served at /farm-art/* from the game
// origin (works standalone and inside the KinetikCircle iframe).
const BUNDLED = {
  'lashira.building.house': 'house.png',
  'lashira.building.barn': 'barn.png',
  'lashira.building.coop': 'coop.png',
  'lashira.building.shop': 'shop.png',
  'lashira.animal.cow': 'cow.png',
  'lashira.animal.sheep': 'sheep.png',
  'lashira.animal.chicken': 'chicken.png',
  'lashira.prop.tree': 'tree.png',
  'lashira.prop.fence': 'fence.png',
  // NOTE: terrain tiles (grass/path) intentionally NOT overridden — the sheet's
  // grass tile isn't seamless, so repeating it across the whole ground produced
  // vertical seams. The flat procedural ground stays clean; revisit only with a
  // properly tileable terrain tile.
  'lashira.crop.pumpkin.stage3': 'crop_pumpkin.png',
  'lashira.crop.carrot.stage3': 'crop_carrot.png',
  'lashira.crop.turnip.stage3': 'crop_turnip.png',
};

// Resolve against the document base so it works under any deploy path.
function url(file) {
  try { return new URL('farm-art/' + file, document.baseURI).href; } catch { return '/farm-art/' + file; }
}

const cache = new Map();
function loadImage(src) {
  if (!cache.has(src)) {
    cache.set(src, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve((img.naturalWidth > 0 && img.naturalHeight > 0) ? img : null);
      img.onerror = () => resolve(null);
      img.decoding = 'async';
      img.src = src;
    }));
  }
  return cache.get(src);
}

export async function loadBundledArt() {
  if (typeof Image === 'undefined') return {};
  const entries = await Promise.all(Object.entries(BUNDLED).map(async ([key, file]) => {
    const img = await loadImage(url(file));
    return img ? [key, img] : null; // a missing/broken bundle file just drops that slot → procedural
  }));
  return Object.fromEntries(entries.filter(Boolean));
}
