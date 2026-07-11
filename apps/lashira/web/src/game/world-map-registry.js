export const OPENWORLD_GAME_ID = 'builtin:openworld';
export const OPENWORLD_SAVE_SLOT = 'default';

export const WORLD_MAPS = {
  lashira_keep: {
    id: 'lashira_keep',
    name: 'Lashira Keep',
    shortName: 'Keep',
    theme: 'city / stronghold',
    file: 'Worldmap/lashira-keep.png',
    hqHotspot: { x0: 27, y0: 21, x1: 32, y1: 26 },
    // marker: circular badge center (tile-corner units, i.e. (x0+x1+1)/2) + icon
    marker: [30, 24], icon: '🏰',
    hqReturn: [30, 25],
    spawn: [30, 24],
    color: '#7c6cff',
    actions: ['Command', 'Inspect', 'Map'],
  },
  bloomwall_pass: {
    id: 'bloomwall_pass',
    name: 'Bloomwall Pass',
    shortName: 'Pass',
    theme: 'defense / adventure',
    file: 'Worldmap/bloomwall-pass.png',
    hqHotspot: { x0: 28, y0: 32, x1: 31, y1: 33 },
    marker: [30, 33], icon: '🛡️',
    hqReturn: [30, 33],
    spawn: [30, 40],
    color: '#2ca64e',
    actions: ['Scout', 'Inspect', 'Map'],
    // Tower defense needs to read tower/monster/hero detail clearly — the
    // default 0.42 open-world floor (tuned for wandering the whole map) makes
    // everything too small. Tighter zoom follows the player around the lane
    // instead of showing the whole 60x48 world at once.
    camZoom: 1.05,
  },
  hearthrush_kitchen: {
    id: 'hearthrush_kitchen',
    name: 'Hearthrush Kitchen',
    shortName: 'Kitchen',
    theme: 'cooking / service',
    file: 'Worldmap/hearthrush-kitchen.png',
    // x29 only — leaves the Market sell hotspot (x30-31) reachable (fixes BT-1
    // shadowing; the kitchen counter sits beside the market, not on top of it).
    hqHotspot: { x0: 29, y0: 16, x1: 29, y1: 17 },
    marker: [29.5, 17], icon: '🍽️',
    hqReturn: [30, 18],
    spawn: [30, 36],
    color: '#f6a42c',
    actions: ['Prep', 'Inspect', 'Map'],
  },
  fountain_festival: {
    id: 'fountain_festival',
    name: 'Fountain Festival',
    shortName: 'Festival',
    theme: 'events / puzzle',
    file: 'Worldmap/fountain-festival.png',
    hqHotspot: { x0: 14, y0: 26, x1: 16, y1: 29 },
    marker: [15.5, 28], icon: '🎡',
    hqReturn: [15, 29],
    spawn: [30, 26],
    color: '#e53770',
    actions: ['Play', 'Inspect', 'Map'],
  },
  emberring_arena: {
    id: 'emberring_arena',
    name: 'Emberring Arena',
    shortName: 'Arena',
    theme: 'social competition',
    file: 'Worldmap/emberring-arena.png',
    hqHotspot: { x0: 47, y0: 37, x1: 48, y1: 39 },
    marker: [48, 38.5], icon: '⚔️',
    hqReturn: [48, 38],
    spawn: [30, 28],
    color: '#da2a31',
    actions: ['Ready', 'Inspect', 'Map'],
    pvp: true, // the only realm with a live-PvP combat pool (RealmRoom gates it on this)
  },
};

export const WORLD_PORTALS = Object.values(WORLD_MAPS);

export function worldMapById(id) {
  return WORLD_MAPS[id] || WORLD_MAPS.lashira_keep;
}

export function worldAssetUrl(map) {
  const file = typeof map === 'string' ? worldMapById(map).file : map?.file;
  try { return new URL('farm-art/' + file, document.baseURI).href; } catch { return '/farm-art/' + file; }
}
