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
  // HAND-QUALITY BASEMAP — the whole map is this one image (drawn over everything in
  // buildFarmMap). DO NOT REMOVE: without it the map silently falls back to the ugly
  // procedural tiles. Dynamic actors + clickable component sprites render on top.
  'lashira.basemap': 'basemap.png',
  'lashira.building.house': 'lib/castle_opt1_storybook.png',
  // CASTLE SKINS — pickable in the Castle panel. Old house + tiers → castle options.
  'lashira.castleskin.house': 'house.png',
  'lashira.castleskin.shack': 'lib/house_t1_shack.png',
  'lashira.castleskin.cottage': 'lib/house_t2_cottage.png',
  'lashira.castleskin.farmhouse': 'lib/house_t3_farmhouse.png',
  'lashira.castleskin.storybook': 'lib/castle_opt1_storybook.png',
  'lashira.castleskin.fairytale': 'lib/castle_opt2_fairytale.png',
  'lashira.castleskin.royal': 'lib/castle_opt3_royal.png',
  'lashira.castleskin.whimsical': 'lib/castle_opt4_whimsical.png',
  'lashira.building.barn': 'lib/barn.png',
  'lashira.building.coop': 'lib/coop.png',
  'lashira.building.shop': 'lib/produce_stall.png',
  'lashira.prop.well': 'lib/well.png',
  'lashira.prop.shipping_bin': 'lib/shipping_bin.png',
  // Cow / sheep / chicken deliberately have NO bundled sheet here: the live
  // animals render from the PixelLab 4-direction creature sprites + walk /
  // eating / rest-idle / idle animations under public/farm-art/creatures/
  // (see creature-sprites.js). A bundled 'lashira.animal.<species>' key would
  // SHADOW that path — drawAnimalSprite only reaches creatureFrame when the
  // key is absent — so these are left out on purpose. (lib/cow|sheep|chicken.png
  // remain on disk for the HQ Pixel Vault / DB-override path only.)
  // Produce "ready to collect" badge icons (game-icons.net, CC BY 3.0 — see
  // public/farm-art/produce/CREDITS.md). Shown over an animal when its good is ripe.
  'lashira.produce.milk': 'produce/milk.svg',
  'lashira.produce.wool': 'produce/wool.svg',
  'lashira.produce.egg': 'produce/egg.svg',
  // Map-marker + animal-HUD icons — hand-authored flat SVGs (own art, no
  // license needed), replacing raw emoji canvas fillText which silently
  // fails to render on some mobile browsers/webviews (no emoji-font
  // fallback for canvas text). See drawMapMarkers / drawWorldActor.
  'lashira.marker.castle': 'marker/castle.svg',
  'lashira.marker.shield': 'marker/shield.svg',
  'lashira.marker.cooking': 'marker/cooking.svg',
  'lashira.marker.festival': 'marker/festival.svg',
  'lashira.marker.sword': 'marker/sword.svg',
  'lashira.marker.seed': 'marker/seed.svg',
  'lashira.marker.cart': 'marker/cart.svg',
  'lashira.marker.anvil': 'marker/anvil.svg',
  'lashira.marker.livestock': 'marker/livestock.svg',
  'lashira.marker.ribbon': 'marker/ribbon.svg',
  'lashira.marker.coin': 'marker/coin.svg',
  'lashira.marker.trophy': 'marker/trophy.svg',
  'lashira.marker.fish': 'marker/fish.svg',
  'lashira.icon.feed': 'marker/feed.svg',
  'lashira.icon.heart_low': 'marker/heart_low.svg',
  'lashira.icon.heart_mid': 'marker/heart_mid.svg',
  'lashira.icon.heart_high': 'marker/heart_high.svg',
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
  // Zone decoration / landmark art — baked into the map by farm-map PLACEMENTS.
  'lashira.lib.shop_seed': 'lib/shop_seed.png',
  'lashira.lib.shop_general': 'lib/shop_general.png',
  'lashira.lib.shop_blacksmith': 'lib/shop_blacksmith.png',
  'lashira.lib.shop_animal': 'lib/shop_animal.png',
  'lashira.lib.shop_cosmetics': 'lib/shop_cosmetics.png',
  'lashira.lib.greenhouse': 'lib/greenhouse_t3.png',
  'lashira.lib.silo': 'lib/silo.png',
  'lashira.lib.windmill': 'lib/windmill.png',
  'lashira.lib.scarecrow': 'lib/scarecrow.png',
  'lashira.lib.fountain': 'lib/fountain.png',
  'lashira.lib.signpost': 'lib/signpost.png',
  'lashira.lib.flowers': 'lib/flowers.png',
  'lashira.lib.tree_oak': 'lib/tree_oak.png',
  'lashira.lib.tree_pine': 'lib/tree_pine.png',
  'lashira.lib.bush': 'lib/bush.png',
  'lashira.lib.mushroom': 'lib/mushroom.png',
  'lashira.lib.stump': 'lib/tree_stump.png',
  'lashira.lib.woodlog': 'lib/woodlog_pile.png',
  'lashira.lib.ore_gold': 'lib/ore_gold.png',
  'lashira.lib.ore_copper': 'lib/ore_copper.png',
  'lashira.lib.ore_iron': 'lib/ore_iron.png',
  'lashira.lib.ore_gem': 'lib/ore_gem.png',
  'lashira.lib.boulder': 'lib/boulder.png',
  'lashira.lib.mine_cart': 'lib/mine_cart.png',
  'lashira.lib.dungeon_gate': 'lib/dungeon_gate.png',
  'lashira.lib.fishing_dock': 'lib/fishing_dock.png',
  'lashira.lib.fishing_reeds': 'lib/fishing_reeds.png',
  'lashira.lib.arena_wall': 'lib/arena_wall.png',
  'lashira.lib.arena_gate': 'lib/arena_gate.png',
  'lashira.lib.scoreboard': 'lib/scoreboard.png',
  'lashira.lib.grass_tuft': 'lib/grass_tuft.png',
  'lashira.lib.small_rock': 'lib/small_rock.png',
  'lashira.lib.lily_pad': 'lib/lily_pad.png',
  'lashira.lib.fence_vertical': 'lib/fence_vertical.png',
  'lashira.lib.trough_feed': 'lib/trough_feed.png',
  'lashira.lib.trough_water': 'lib/trough_water.png',
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
