export const LASHIRA_ART_SLOTS = [
  { key: 'lashira.terrain.grass', label: 'Grass tile', category: 'terrain', expectedW: 48, expectedH: 48, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js' },
  { key: 'lashira.terrain.path', label: 'Farm path tile', category: 'terrain', expectedW: 48, expectedH: 48, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js' },
  { key: 'lashira.plot.soil.dry', label: 'Dry tilled soil', category: 'field', expectedW: 48, expectedH: 48, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js' },
  { key: 'lashira.plot.soil.watered', label: 'Watered tilled soil', category: 'field', expectedW: 48, expectedH: 48, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js' },
  { key: 'lashira.prop.tree', label: 'Border tree', category: 'prop', expectedW: 48, expectedH: 72, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js' },
  { key: 'lashira.prop.fence', label: 'Field fence', category: 'prop', expectedW: 48, expectedH: 48, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js' },
  { key: 'lashira.prop.well', label: 'Stone well', category: 'prop', expectedW: 48, expectedH: 48, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js' },
  { key: 'lashira.prop.shipping_bin', label: 'Shipping bin', category: 'prop', expectedW: 48, expectedH: 48, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js' },
  { key: 'lashira.building.house', label: 'Farmhouse', category: 'building', expectedW: 144, expectedH: 144, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js' },
  { key: 'lashira.building.barn', label: 'Barn', category: 'building', expectedW: 144, expectedH: 96, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js' },
  { key: 'lashira.building.coop', label: 'Coop', category: 'building', expectedW: 96, expectedH: 96, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js' },
  { key: 'lashira.building.shop', label: 'Sprout shop', category: 'building', expectedW: 96, expectedH: 96, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js' },
  { key: 'lashira.animal.cow', label: 'Cow', category: 'animal', expectedW: 48, expectedH: 40, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js' },
  { key: 'lashira.animal.sheep', label: 'Sheep', category: 'animal', expectedW: 44, expectedH: 38, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js' },
  { key: 'lashira.animal.chicken', label: 'Chicken', category: 'animal', expectedW: 28, expectedH: 30, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js' },
  { key: 'lashira.kin.sprig', label: 'Sprig Kin', category: 'kin', expectedW: 32, expectedH: 40, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js' },
  { key: 'lashira.kin.pip', label: 'Pip Kin', category: 'kin', expectedW: 32, expectedH: 40, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js' },
  { key: 'lashira.kin.bramble', label: 'Bramble Kin', category: 'kin', expectedW: 32, expectedH: 40, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js' },
  { key: 'lashira.mount.placeholder', label: 'Fallback mount', category: 'mount', expectedW: 64, expectedH: 48, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js' },
  { key: 'lashira.farmer.placeholder', label: 'Fallback farmer', category: 'character', expectedW: 32, expectedH: 48, renderer: 'procedural', status: 'wired', sourceFile: 'apps/lashira/web/src/game/farm-map.js' },
];

for (const crop of ['turnip', 'potato', 'carrot', 'strawberry', 'corn', 'pumpkin']) {
  for (let stage = 0; stage <= 3; stage++) {
    LASHIRA_ART_SLOTS.push({
      key: `lashira.crop.${crop}.stage${stage}`,
      label: `${crop[0].toUpperCase()}${crop.slice(1)} stage ${stage}`,
      category: 'crop',
      expectedW: 48,
      expectedH: 48,
      renderer: 'procedural',
      status: stage === 3 ? 'needs-polish' : 'wired',
      sourceFile: 'apps/lashira/web/src/game/farm-map.js',
    });
  }
}

export const LASHIRA_ART_SLOT_BY_KEY = Object.fromEntries(LASHIRA_ART_SLOTS.map((slot) => [slot.key, slot]));
