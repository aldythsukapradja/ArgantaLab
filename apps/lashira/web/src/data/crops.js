// Crop catalog. `days` = waterings-then-sleeps to ripen. `color` drives the
// placeholder sprite's fruit. Data-driven so new crops = new rows (RPG-maker
// spine principle). `ring` marks a learning-gated seed (shown locked for kids).
export const CROPS = {
  turnip: { id: 'turnip', name: 'Turnip', emoji: '🥬', season: 'spring', days: 3, seedCost: 20, sell: 40, color: 0xe0a3e8, ring: null },
  potato: { id: 'potato', name: 'Potato', emoji: '🥔', season: 'spring', days: 4, seedCost: 35, sell: 70, color: 0xd9b382, ring: null },
  carrot: { id: 'carrot', name: 'Carrot', emoji: '🥕', season: 'spring', days: 4, seedCost: 30, sell: 65, color: 0xf08a3c, ring: null },
  strawberry: { id: 'strawberry', name: 'Strawberry', emoji: '🍓', season: 'spring', days: 5, seedCost: 60, sell: 130, color: 0xe4425a, ring: 'numeria' },
  corn: { id: 'corn', name: 'Corn', emoji: '🌽', season: 'summer', days: 6, seedCost: 70, sell: 160, color: 0xf2c94c, ring: 'wordveil' },
  pumpkin: { id: 'pumpkin', name: 'Pumpkin', emoji: '🎃', season: 'fall', days: 6, seedCost: 80, sell: 200, color: 0xe07b2c, ring: 'life' },
};

export const SEASONS = ['spring', 'summer', 'fall', 'winter'];
export const DAYS_PER_SEASON = 14;

// Starter seeds available in the shop from day one (no learning gate).
export const STARTER_SEEDS = ['turnip', 'potato', 'carrot'];
