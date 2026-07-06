// ArgantaLab Nexus Kin catalog subset for LashiraBloom farm rendering.
// Mirrors apps/web/src/data/openworld/kin.ts: render key is the asset identity.

const rows = [
  ['countfox', 'Countfox', 'num', 'dunes', 'pattern', 'common', '#f59e0b'],
  ['addbug', 'Addbug', 'num', 'dunes', 'order', 'common', '#fbbf24'],
  ['tenturtle', 'Tenturtle', 'num', 'oasis', 'place', 'rare', '#10b981'],
  ['multimoth', 'Multimoth', 'num', 'dunes', 'pattern', 'rare', '#a855f7'],
  ['zerolion', 'Zerolion', 'num', 'oasis', 'order', 'epic', '#ef4444'],
  ['primeroc', 'Primeroc', 'num', 'peaks', 'pattern', 'legendary', '#6366f1'],
  ['sumseal', 'Sumseal', 'num', 'oasis', 'order', 'common', '#38bdf8'],
  ['dividove', 'Dividove', 'num', 'dunes', 'pattern', 'rare', '#c084fc'],

  ['letterowl', 'Letterowl', 'wrd', 'grove', 'truth', 'common', '#3b82f6'],
  ['rhymefrog', 'Rhymefrog', 'wrd', 'grove', 'truth', 'rare', '#2563eb'],
  ['storyfox', 'Storyfox', 'wrd', 'grove', 'truth', 'epic', '#6366f1'],
  ['grammargon', 'Grammargon', 'wrd', 'grove', 'order', 'legendary', '#1d4ed8'],
  ['spellynx', 'Spellynx', 'wrd', 'grove', 'truth', 'rare', '#60a5fa'],
  ['vowelcub', 'Vowelcub', 'wrd', 'grove', 'truth', 'common', '#3b82f6'],
  ['syllabee', 'Syllabee', 'wrd', 'grove', 'order', 'common', '#2563eb'],
  ['punctuapup', 'Punctuapup', 'wrd', 'grove', 'order', 'epic', '#6366f1'],

  ['moodlamb', 'Moodlamb', 'lif', 'meadow', 'truth', 'common', '#ec4899'],
  ['pulsepup', 'Pulsepup', 'lif', 'meadow', 'order', 'rare', '#f472b6'],
  ['breezedeer', 'Breezedeer', 'lif', 'meadow', 'truth', 'epic', '#db2777'],
  ['auroracrane', 'Auroracrane', 'lif', 'meadow', 'wonder', 'legendary', '#be185d'],
  ['calmkoala', 'Calmkoala', 'lif', 'meadow', 'truth', 'common', '#f472b6'],
  ['joyfawn', 'Joyfawn', 'lif', 'meadow', 'truth', 'common', '#fb7185'],
  ['restbunny', 'Restbunny', 'lif', 'meadow', 'order', 'rare', '#ec4899'],
  ['hearthog', 'Hearthog', 'lif', 'meadow', 'wonder', 'epic', '#db2777'],

  ['mapturtle', 'Mapturtle', 'wld', 'lagoon', 'place', 'common', '#f97316'],
  ['dunecamel', 'Dunecamel', 'wld', 'lagoon', 'place', 'rare', '#ea580c'],
  ['riverotter', 'Riverotter', 'wld', 'lagoon', 'place', 'epic', '#fb923c'],
  ['globewhale', 'Globewhale', 'wld', 'lagoon', 'place', 'legendary', '#c2410c'],
  ['compassgull', 'Compassgull', 'wld', 'lagoon', 'place', 'common', '#fb923c'],
  ['peakyak', 'Peakyak', 'wld', 'lagoon', 'place', 'common', '#f97316'],
  ['deltafrog', 'Deltafrog', 'wld', 'lagoon', 'place', 'rare', '#ea580c'],
  ['atlasram', 'Atlasram', 'wld', 'lagoon', 'place', 'epic', '#9a3412'],

  ['cloudcat', 'Cloudcat', 'won', 'skyfield', 'wonder', 'common', '#8b5cf6'],
  ['cometcolt', 'Cometcolt', 'won', 'skyfield', 'wonder', 'rare', '#7c3aed'],
  ['galaxyfawn', 'Galaxyfawn', 'won', 'skyfield', 'wonder', 'epic', '#a855f7'],
  ['novabear', 'Novabear', 'won', 'skyfield', 'wonder', 'legendary', '#6d28d9'],
  ['sproutling', 'Sproutling', 'won', 'skyfield', 'wonder', 'common', '#a78bfa'],
  ['sparkmoth', 'Sparkmoth', 'won', 'skyfield', 'wonder', 'common', '#8b5cf6'],
  ['tidalnewt', 'Tidalnewt', 'won', 'skyfield', 'wonder', 'rare', '#7c3aed'],
  ['emberfox', 'Emberfox', 'won', 'skyfield', 'wonder', 'epic', '#a855f7'],

  ['pixelslime', 'Pixelslime', 'log', 'circuit', 'logic', 'common', '#22c55e'],
  ['mechmouse', 'Mechmouse', 'log', 'circuit', 'logic', 'rare', '#16a34a'],
  ['ciphercat', 'Ciphercat', 'log', 'circuit', 'logic', 'epic', '#15803d'],
  ['datadragon', 'Datadragon', 'log', 'circuit', 'logic', 'legendary', '#166534'],
  ['loopbat', 'Loopbat', 'log', 'circuit', 'logic', 'common', '#4ade80'],
  ['bytebee', 'Bytebee', 'log', 'circuit', 'logic', 'common', '#22c55e'],
  ['nullowl', 'Nullowl', 'log', 'circuit', 'logic', 'rare', '#16a34a'],
  ['stackcrab', 'Stackcrab', 'log', 'circuit', 'logic', 'epic', '#15803d'],
];

export const ARGANTA_KINS = rows.map(([render, name, world, habitat, element, rarity, color]) => ({
  id: `kin:${render}`,
  render,
  name,
  world,
  habitat,
  element,
  rarity,
  color,
  assetKey: `kin.${render}`,
}));

export const ARGANTA_KIN_BY_ID = Object.fromEntries(ARGANTA_KINS.map((k) => [k.id, k]));
export const argantaKin = (id) => ARGANTA_KIN_BY_ID[id];
