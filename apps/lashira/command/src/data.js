// Bloom Command reference data. The crop catalog mirrors the game's data-driven
// catalog; players/metrics are illustrative until wired to live Supabase reads.
export const CROPS = [
  { id: 'turnip', name: 'Turnip', emoji: '🥬', season: 'Spring', days: 3, cost: 20, sell: 40, gate: '—' },
  { id: 'potato', name: 'Potato', emoji: '🥔', season: 'Spring', days: 4, cost: 35, sell: 70, gate: '—' },
  { id: 'carrot', name: 'Carrot', emoji: '🥕', season: 'Spring', days: 4, cost: 30, sell: 65, gate: '—' },
  { id: 'strawberry', name: 'Strawberry', emoji: '🍓', season: 'Spring', days: 5, cost: 60, sell: 130, gate: 'numeria·2' },
  { id: 'corn', name: 'Corn', emoji: '🌽', season: 'Summer', days: 6, cost: 70, sell: 160, gate: 'wordveil·3' },
  { id: 'pumpkin', name: 'Pumpkin', emoji: '🎃', season: 'Fall', days: 6, cost: 80, sell: 200, gate: 'life·2' },
];

export const MAPS = [
  { id: 'farm', name: 'Farm', status: 'live', npcs: 1, gate: 'start' },
  { id: 'town', name: 'Town — Bloomridge', status: 'planned', npcs: 12, gate: 'rings·t2' },
  { id: 'city', name: 'City — Arganta City', status: 'planned', npcs: 8, gate: 'rings·t3' },
  { id: 'mining', name: 'Mining — Emberdeep', status: 'planned', npcs: 3, gate: 'rings·t3' },
  { id: 'dungeon', name: 'Dungeon Hub — Hollow Gate', status: 'planned', npcs: 1, gate: 'rings·t4' },
];

export const LIVESTOCK = [
  { id: 'cow', name: 'Cow', emoji: '🐄', produce: 'Milk', sell: 90 },
  { id: 'sheep', name: 'Sheep', emoji: '🐑', produce: 'Wool', sell: 120 },
  { id: 'chicken', name: 'Chicken', emoji: '🐔', produce: 'Egg', sell: 45 },
];

export const PROGRESSION = {
  levelFormula: 'level = 1 + floor(xp / 500)',
  xpRule: 'Adults gain XP by playing (capped). Kids gain XP only by learning the 6 Worlds.',
  statPolicy: [
    { path: 'Farmer', hp: '+per level', speed: '+6%/lvl', stamina: '+4/lvl' },
    { path: 'Hero (RPG-later)', hp: '+28/lvl', atk: '+2.6/lvl', def: '+2.2/lvl' },
  ],
};

export const FARMS = [
  { circle: 'Sukapradja Family', stage: 'Homestead', pct: 92, rings: 5.4 },
  { circle: 'Class 4B', stage: 'Farmhouse', pct: 64, rings: 4.1 },
  { circle: 'Padel Friends', stage: 'Cottage', pct: 38, rings: 2.6 },
];

export const ASSETS = [
  { kind: 'Crops', done: 8, total: 12 },
  { kind: 'Buildings', done: 3, total: 6 },
  { kind: 'Livestock', done: 0, total: 9 },
  { kind: 'Tiles', done: 4, total: 20 },
];

export const QUESTS = [
  { id: 'tut_till', title: 'First furrow', type: 'tutorial', gate: '—', reward: '🌸 30' },
  { id: 'daily_water', title: 'Water 5 crops', type: 'daily', gate: '—', reward: '🌸 20' },
  { id: 'town_intro', title: 'Meet Bloomridge', type: 'story', gate: 'rings·t2', reward: 'unlock Town' },
];

export const CONFIG = [
  { key: 'day.length', value: 'sleep-driven', note: 'crops advance one stage per watered day' },
  { key: 'bloom.starting', value: '120', note: 'new farm purse' },
  { key: 'stamina.base', value: '40', note: '+4 per level' },
  { key: 'currency.wall', value: 'bloom≠diamonds', note: 'schema-enforced' },
  { key: 'seed.gate.mode', value: 'circle-combined-rings', note: 'content unlocks' },
];
