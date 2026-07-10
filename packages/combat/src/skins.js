// Action-cluster SKINS — shared by both games. Each skin is (1) a bag of CSS
// custom properties that repaint the orbs (consumed by the app's cluster CSS via
// var(--atk-face) etc.) and (2) a set of vendored game-icons.net glyph keys, one
// per slot. Every skin uses a DIFFERENT icon set on purpose, so the best icon
// style can be chosen by comparing them live in Settings.
//
// SCALE: to add a skin, add one entry here (vars + icons). Nothing else changes —
// the Settings selector maps this object, and both games pick it up. To add an
// icon, drop an SVG in ./icons/svg, regen paths.js, and reference its key.

export const CLUSTER_SKINS = {
  brass: {
    id: 'brass',
    name: 'Brass Legion',
    blurb: 'warm metal · fire',
    icons: {
      attack: 'lorc__crossed-swords',
      single: 'delapouite__bolt-spell-cast',
      area: 'lorc__bright-explosion',
      heal: 'delapouite__health-potion',
      mount: 'delapouite__horse-head',
    },
    vars: {
      '--orb-ink': '#fff6e2',
      '--atk-face': 'radial-gradient(circle at 36% 28%, #f6d792 0 6%, #c8814a 40%, #8a4f22 72%, #5c3212 100%)',
      '--atk-edge': '#6a4416',
      '--atk-glow': '#e8a54abb',
      '--skill-face': 'radial-gradient(circle at 36% 28%, #ffe6a0 0 6%, #ffb43a 40%, #c9781a 72%, #7a3f10 100%)',
      '--skill-edge': '#5a3a12',
      '--skill-glow': '#ffb040cc',
      '--util-face': 'radial-gradient(circle at 36% 28%, #dbe2ee 0 6%, #93a0b6 38%, #55627a 74%, #38435a 100%)',
      '--util-edge': '#3a4a64',
      '--util-glow': '#9fb0cccc',
    },
  },
  frost: {
    id: 'frost',
    name: 'Frosted Glass',
    blurb: 'translucent · minimal',
    icons: {
      attack: 'delapouite__sword-brandish',
      single: 'delapouite__sparkles',
      area: 'lorc__circle-sparks',
      heal: 'delapouite__healing',
      mount: 'lorc__horse-head',
    },
    vars: {
      '--orb-ink': '#213548',
      '--atk-face': 'radial-gradient(circle at 36% 26%, rgba(255,255,255,.9) 0 8%, rgba(210,228,248,.55) 48%, rgba(150,180,215,.42) 100%)',
      '--atk-edge': 'rgba(255,255,255,.72)',
      '--atk-glow': '#bcd8ffcc',
      '--skill-face': 'radial-gradient(circle at 36% 26%, rgba(255,244,214,.9) 0 8%, rgba(255,205,130,.5) 50%, rgba(210,165,95,.42) 100%)',
      '--skill-edge': 'rgba(255,228,182,.72)',
      '--skill-glow': '#ffd9a0cc',
      '--util-face': 'radial-gradient(circle at 36% 26%, rgba(232,242,255,.9) 0 8%, rgba(165,190,225,.5) 50%, rgba(95,125,165,.42) 100%)',
      '--util-edge': 'rgba(212,227,247,.72)',
      '--util-glow': '#cfe0ffcc',
    },
  },
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian Neon',
    blurb: 'dark · neon rings',
    icons: {
      attack: 'lorc__sparkling-sabre',
      single: 'lorc__magic-swirl',
      area: 'lorc__explosion-rays',
      heal: 'sbed__health-increase',
      mount: 'delapouite__cavalry',
    },
    vars: {
      '--orb-ink': '#ffe9cf',
      '--atk-face': 'radial-gradient(circle at 36% 34%, #2a2f3a 0 40%, #14171e 72%, #0a0c10 100%)',
      '--atk-edge': '#ff8a3c',
      '--atk-glow': '#ff7a2eff',
      '--skill-face': 'radial-gradient(circle at 50% 42%, rgba(255,170,50,.42), transparent 60%), radial-gradient(circle at 36% 40%, #241f16, #0d0b08 76%)',
      '--skill-edge': '#ffab3a',
      '--skill-glow': '#ffab3aff',
      '--util-face': 'radial-gradient(circle at 50% 42%, rgba(90,180,255,.42), transparent 60%), radial-gradient(circle at 36% 40%, #14181f, #080b10 76%)',
      '--util-edge': '#59b4ff',
      '--util-glow': '#59b4ffff',
    },
  },
};

// Farm tool icons — same vendored game-icons.net set as the combat skins, so the
// farm cluster reads as "the same instrument" as the attack/skill orbs instead of
// a mismatched row of colorful emoji. One shared set (not skin-variant like combat's
// icons.attack/single/etc — farm doesn't need 3 alternates to compare live).
export const FARM_ICONS = {
  plant: 'lorc__sprout',
  harvest: 'lorc__wheat',
  sickle: 'delapouite__sickle',
  work: 'delapouite__watering-can', // the main "work the tile ahead" action, when not in Sickle mode
};

export const SKIN_LIST = Object.values(CLUSTER_SKINS);
export const DEFAULT_SKIN = 'brass';
export function skinOf(id) { return CLUSTER_SKINS[id] || CLUSTER_SKINS[DEFAULT_SKIN]; }

// skill slot id → icon role (falls back to slot order if id is unknown).
export function skinRoleForSkill(skill, index) {
  const byId = { bolt: 'single', storm: 'area', mend: 'heal' };
  return byId[skill?.id] || ['single', 'area', 'heal'][index] || 'single';
}
