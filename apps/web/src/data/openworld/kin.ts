// ============================================================
//  ARGANTALAB · OPENWORLD · KIN CATALOG  (content-as-data)
//  "Kin" are the cute creatures you meet in a world's Openworld. You weaken
//  one in a friendly battle, open a Friendship Window, then *befriend* it
//  (answer a final question) so it joins your shared Nexus town — where it
//  roams, grows, breeds, and helps harvest diamonds (Harvest-Moon style).
//
//  Same data-row pattern as cosmetics.ts / abilities.ts: each kin has a
//  `render` art key + pure stats. Adding a kin = one row (+ DB row later).
//  Only a brand-new look needs a new render fn in KinSprite.
// ============================================================

import type { Rarity } from '@/data/cosmetics'

// Weakness element you exploit with a Weakness Break. Readable, not memorized.
export type Element = 'pattern' | 'order' | 'truth' | 'place' | 'wonder' | 'logic'

// A telegraphed enemy behavior + rule (06_COMBAT_DEPTH). Kept tiny on purpose.
export type Gimmick = 'none' | 'shield3' | 'healOnMiss' | 'enrage'

export interface KinDef {
  id: string            // unique, e.g. 'kin:countfox'
  render: string        // sprite art key (KinSprite switches on this)
  name: string
  world: string         // 'num' | 'wrd' | 'won' | 'log' | 'wld' | 'lif'
  habitat: string       // which Nexus habitat it lives in (habitat catalog key)
  element: Element      // weakness to exploit
  gimmick: Gimmick      // its battle tell/rule
  rarity: Rarity
  baseHp: number        // encounter HP
  power: number         // hearts of damage per enemy attack (usually 1)
  color: string         // theme tint for sprite + habitat
  blurb: string         // one-line kid-facing flavor
}

const k = (
  render: string, name: string, world: string, habitat: string,
  element: Element, gimmick: Gimmick, rarity: Rarity,
  baseHp: number, power: number, color: string, blurb: string,
): KinDef => ({ id: `kin:${render}`, render, name, world, habitat, element, gimmick, rarity, baseHp, power, color, blurb })

// ── NUMERIA (num) — the desert of numbers. Built out for the MVP. ──
const NUMERIA: KinDef[] = [
  k('countfox',  'Countfox',  'num', 'dunes',  'pattern', 'none',    'common', 90,  1, '#f59e0b', 'A sandy fox that counts its steps as it trots.'),
  k('addbug',    'Addbug',    'num', 'dunes',  'order',   'none',    'common', 80,  1, '#fbbf24', 'A friendly beetle that loves stacking dots.'),
  k('tenturtle', 'Tenturtle', 'num', 'oasis',  'place',   'shield3', 'rare',   120, 1, '#10b981', 'Carries its shell in tens — break it on the third beat.'),
  k('multimoth', 'Multimoth', 'num', 'dunes',  'pattern', 'enrage',  'rare',   110, 1, '#a855f7', 'Wings beat in times-tables; it speeds up when cornered.'),
  k('zerolion',  'Zerolion',  'num', 'oasis',  'order',   'healOnMiss','epic', 150, 1, '#ef4444', 'A gentle lion that mends itself if you fumble a sum.'),
  k('primeroc',  'Primeroc',  'num', 'peaks',  'pattern', 'shield3', 'legendary', 200, 1, '#6366f1', 'A rare desert roc that only the sharpest minds befriend.'),
]

// ── WORDVEIL (wrd) — the whispering grove of words. ──
//  Rarity ladder mirrors Numeria: a common starter, a shield-breaker rare, a
//  self-mending epic, a shielded legendary. Stats are PROVEN careful-winnable by
//  the roster sweep in sim.ts / engine.test.ts — never assigned by vibe.
const WORDVEIL: KinDef[] = [
  k('letterowl',  'Letterowl',  'wrd', 'grove', 'truth', 'none',       'common',    90,  1, '#3b82f6', 'A wise owl that hoots the true names of things.'),
  k('rhymefrog',  'Rhymefrog',  'wrd', 'grove', 'truth', 'shield3',    'rare',     115, 1, '#2563eb', 'A bouncy frog that croaks in perfect rhyme — shields on the beat.'),
  k('storyfox',   'Storyfox',   'wrd', 'grove', 'truth', 'healOnMiss', 'epic',     145, 1, '#6366f1', 'Its tail is a storybook; a wrong word lets it patch its tale.'),
  k('grammargon', 'Grammargon', 'wrd', 'grove', 'order', 'shield3',    'legendary',195, 1, '#1d4ed8', 'A tiny dragon that guards the rules of grammar.'),
]

// ── LIFE (lif) — the mood meadow of feelings, body & health. ──
const LIFE: KinDef[] = [
  k('moodlamb',    'Moodlamb',    'lif', 'meadow', 'truth',  'none',       'common',    80,  1, '#ec4899', 'A soft lamb whose wool changes color with feelings.'),
  k('pulsepup',    'Pulsepup',    'lif', 'meadow', 'order',  'enrage',     'rare',     112, 1, '#f472b6', 'An eager pup whose heartbeat races faster the longer you play.'),
  k('breezedeer',  'Breezedeer',  'lif', 'meadow', 'truth',  'healOnMiss', 'epic',     145, 1, '#db2777', 'A calm deer that breathes deep and mends when you slip.'),
  k('auroracrane', 'Auroracrane', 'lif', 'meadow', 'wonder', 'shield3',    'legendary',195, 1, '#be185d', 'A graceful crane that dances the northern lights.'),
]

// ── WORLD (wld) — the tide lagoon of geography & history. ──
const WORLD: KinDef[] = [
  k('mapturtle',  'Mapturtle',  'wld', 'lagoon', 'place', 'none',       'common',    95,  1, '#f97316', 'A traveler turtle with a world map on its shell.'),
  k('dunecamel',  'Dunecamel',  'wld', 'lagoon', 'place', 'shield3',    'rare',     115, 1, '#ea580c', 'A patient camel that hoards water — and a stubborn shell-shield.'),
  k('riverotter', 'Riverotter', 'wld', 'lagoon', 'place', 'healOnMiss', 'epic',     145, 1, '#fb923c', 'A playful otter that floats back up whenever you fumble.'),
  k('globewhale', 'Globewhale', 'wld', 'lagoon', 'place', 'shield3',    'legendary',200, 1, '#c2410c', 'A gentle giant carrying whole continents on its back.'),
]

// ── WONDER (won) — the cloud skyfield of science & nature. ──
const WONDER: KinDef[] = [
  k('cloudcat',   'Cloudcat',   'won', 'skyfield', 'wonder', 'none',       'common',    90,  1, '#8b5cf6', 'A fluffy cat that naps on curious little clouds.'),
  k('cometcolt',  'Cometcolt',  'won', 'skyfield', 'wonder', 'enrage',     'rare',     112, 1, '#7c3aed', 'A starry colt that gallops faster as the night goes on.'),
  k('galaxyfawn', 'Galaxyfawn', 'won', 'skyfield', 'wonder', 'healOnMiss', 'epic',     145, 1, '#a855f7', 'A fawn dusted with stars that twinkle back to life.'),
  k('novabear',   'Novabear',   'won', 'skyfield', 'wonder', 'shield3',    'legendary',195, 1, '#6d28d9', 'A cosmic bear cub wrapped in a shield of stardust.'),
]

// ── LOGIC (log) — the neon circuit of code & reasoning. ──
const LOGIC: KinDef[] = [
  k('pixelslime', 'Pixelslime', 'log', 'circuit', 'logic', 'none',       'common',    85,  1, '#22c55e', 'A blocky slime that flips between true and false.'),
  k('mechmouse',  'Mechmouse',  'log', 'circuit', 'logic', 'shield3',    'rare',     115, 1, '#16a34a', 'A clockwork mouse that raises a firewall every third tick.'),
  k('ciphercat',  'Ciphercat',  'log', 'circuit', 'logic', 'healOnMiss', 'epic',     145, 1, '#15803d', 'A sly cat that re-encrypts itself when you guess wrong.'),
  k('datadragon', 'Datadragon', 'log', 'circuit', 'logic', 'shield3',    'legendary',195, 1, '#166534', 'A dragon woven from pure data, guarding the deepest logic.'),
]

export const KIN: KinDef[] = [...NUMERIA, ...WORDVEIL, ...LIFE, ...WORLD, ...WONDER, ...LOGIC]
export const KIN_BY_ID: Record<string, KinDef> = Object.fromEntries(KIN.map(x => [x.id, x]))
export const kin = (id: string): KinDef | undefined => KIN_BY_ID[id]
export const kinForWorld = (world: string): KinDef[] => KIN.filter(x => x.world === world)
