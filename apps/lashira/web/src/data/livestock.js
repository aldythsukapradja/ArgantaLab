// Livestock (separate from Kins). Feed -> after a REAL-TIME timer the good is
// ready to collect (milk/wool/egg). No day cycle involved.
export const SPECIES = {
  cow: { id: 'cow', name: 'Cow', emoji: '🐄', produce: 'milk', produceEmoji: '🥛', produceName: 'Milk', sell: 90, buy: 260, home: 'barn' },
  sheep: { id: 'sheep', name: 'Sheep', emoji: '🐑', produce: 'wool', produceEmoji: '🧶', produceName: 'Wool', sell: 120, buy: 300, home: 'barn' },
  chicken: { id: 'chicken', name: 'Chicken', emoji: '🐔', produce: 'egg', produceEmoji: '🥚', produceName: 'Egg', sell: 45, buy: 140, home: 'coop' },
};

// Pens have room for more than the starter 5 — this is the growth ceiling a
// player can buy up to per species.
export const MAX_PER_SPECIES = 8;

// Time from feeding until the animal's good is ready (testing = short).
export const GOODS_MS = 90000; // 1.5 min

export function animalGoodReady(a, now = Date.now()) {
  return !!a?.fedAt && (now - a.fedAt) >= GOODS_MS;
}
export function animalGoodFrac(a, now = Date.now()) {
  if (!a?.fedAt) return 0;
  return Math.max(0, Math.min(1, (now - a.fedAt) / GOODS_MS));
}

export const ANIMAL_NAMES = {
  cow: ['Daisy', 'Bessie', 'Clover', 'Maple', 'Moochi', 'Buttercup', 'Rosie', 'Hazel'],
  sheep: ['Wooly', 'Cloud', 'Cotton', 'Fleece', 'Mallow', 'Puff', 'Drizzle', 'Marsh'],
  chicken: ['Cluck', 'Pip', 'Sunny', 'Pebble', 'Nugget', 'Biscuit', 'Ginger', 'Speckles'],
};
// A fresh farm begins with 5 of each species (one per starter pen slot); pens
// have room to grow to MAX_PER_SPECIES via the Shop.
export const STARTER_LIVESTOCK = ['cow', 'sheep', 'chicken'].flatMap((species) =>
  ANIMAL_NAMES[species].slice(0, 5).map((name, i) => ({ id: `li_${species}_${i}`, species, name, affection: 40, fedAt: null })),
);
