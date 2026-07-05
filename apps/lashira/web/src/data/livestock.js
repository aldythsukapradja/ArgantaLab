// Livestock (separate from Kins). Feed daily -> produce on next sleep.
export const SPECIES = {
  cow: { id: 'cow', name: 'Cow', emoji: '🐄', produce: 'milk', produceEmoji: '🥛', produceName: 'Milk', sell: 90, home: 'barn' },
  sheep: { id: 'sheep', name: 'Sheep', emoji: '🐑', produce: 'wool', produceEmoji: '🧶', produceName: 'Wool', sell: 120, home: 'barn' },
  chicken: { id: 'chicken', name: 'Chicken', emoji: '🐔', produce: 'egg', produceEmoji: '🥚', produceName: 'Egg', sell: 45, home: 'coop' },
};

// Starter animals a fresh farm begins with.
export const STARTER_LIVESTOCK = [
  { species: 'cow', name: 'Daisy' },
  { species: 'sheep', name: 'Wooly' },
  { species: 'chicken', name: 'Cluck' },
];
