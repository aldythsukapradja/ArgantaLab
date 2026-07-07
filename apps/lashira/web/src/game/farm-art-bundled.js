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
// Wired to the NEW original PixelLab library in public/farm-art/lib/ (cozy-cute
// "Stardew + Animal Crossing" set generated 2026-07-08). Old flat files kept for
// reference; everything below points at lib/. The house slot shows a CASTLE option
// (swap lib/castle_opt{1..4}_* to preview the others — see docs/lashirabloom).
const BUNDLED = {
  'lashira.building.house': 'lib/castle_opt1_storybook.png',
  'lashira.building.barn': 'lib/barn.png',
  'lashira.building.coop': 'lib/coop.png',
  'lashira.building.shop': 'lib/produce_stall.png',
  'lashira.prop.well': 'lib/well.png',
  'lashira.prop.shipping_bin': 'lib/shipping_bin.png',
  'lashira.animal.cow': 'lib/cow.png',
  'lashira.animal.sheep': 'lib/sheep.png',
  'lashira.animal.chicken': 'lib/chicken.png',
  'lashira.prop.tree': 'lib/tree_oak.png',
  'lashira.prop.fence': 'lib/fence_straight.png',
  // NOTE: terrain tiles (grass/path) still procedural — the new terrain is a Wang
  // AUTOTILE set (lib/terrain_grass_*.png, 16 tiles each) which needs corner-based
  // autotiling code, not a single repeating tile. Wiring that is the new-map build.
  'lashira.crop.pumpkin.stage3': 'lib/crop_pumpkin.png',
  'lashira.crop.carrot.stage3': 'lib/crop_carrot.png',
  'lashira.crop.turnip.stage3': 'lib/crop_turnip.png',
  'lashira.crop.potato.stage3': 'lib/crop_potato.png',
  'lashira.crop.strawberry.stage3': 'lib/crop_strawberry.png',
  'lashira.crop.corn.stage3': 'lib/crop_corn.png',
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
