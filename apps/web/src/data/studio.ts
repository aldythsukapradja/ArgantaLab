// ============================================================
//  ARGANTA STUDIO — catalogue for the v2 Game Wizard
//  15 genres (each an analog of a viral game), the Hero System
//  (avatar + per-genre costume + sidekick), worlds, engine-room
//  dials and backend services. Everything compiles down to a
//  GameSpec (engine/types.ts) that the engine bundle boots from.
// ============================================================

import type { GameSpec, GenreKey, ParamValue, SidekickPower } from '@/engine/types'

export type { GameSpec, GenreKey }
type Rarity = 'rare' | 'epic' | 'legendary'

// ── Engine-room dials ─────────────────────────────────────────
export interface ParamDef {
  key: string
  label: string
  type: 'slider' | 'pick' | 'toggle'
  min?: number; max?: number; step?: number
  opts?: { key: string; label: string }[]
  def: number | string | boolean
  hint?: string
}

// ── Genres ────────────────────────────────────────────────────
export interface GenreDef {
  key: GenreKey
  name: string
  analog: string        // the viral game it's an analog of (shown as "inspired by")
  emoji: string
  tagline: string
  tags: string[]
  stars: 1 | 2 | 3      // "engine complexity" flavor
  fit: string           // hero costume flavor label for this genre
  sidekickRole: string  // what the sidekick does here (kid-facing)
  price?: number
  rarity?: Rarity
  params: ParamDef[]
}

const slider = (key: string, label: string, min: number, max: number, def: number, hint?: string, step = 1): ParamDef =>
  ({ key, label, type: 'slider', min, max, step, def, hint })
const pick = (key: string, label: string, opts: [string, string][], def: string, hint?: string): ParamDef =>
  ({ key, label, type: 'pick', opts: opts.map(([k, l]) => ({ key: k, label: l })), def, hint })
const toggle = (key: string, label: string, def: boolean, hint?: string): ParamDef =>
  ({ key, label, type: 'toggle', def, hint })

/** Popularity-sorted (display order = array order). */
export const GENRES: GenreDef[] = [
  {
    key: 'sweet', name: 'Sweet Cascade', analog: 'Candy Crush', emoji: '🍬',
    tagline: 'Swap, match, cascade. Beat the level goal before moves run out.',
    tags: ['Puzzle', 'Match-3'], stars: 2, fit: 'Candy Chef', sidekickRole: 'gives you one free booster per level',
    params: [
      slider('moves', 'Moves per level', 12, 40, 24, 'let moves = 24 — fewer moves, spicier puzzle'),
      slider('colors', 'Candy colors', 4, 6, 5, 'more colors = harder matches'),
      pick('goal', 'Level goal', [['score', 'Score target'], ['clear', 'Clear the jelly']], 'score'),
    ],
  },
  {
    key: 'chomp', name: 'Chomp Maze', analog: 'Pac-Man', emoji: '🟡',
    tagline: 'Eat every dot, dodge the ghosts — power pellets flip the hunt.',
    tags: ['Arcade', 'Maze'], stars: 2, fit: 'Maze Runner', sidekickRole: 'shows you where one ghost is heading',
    params: [
      slider('ghosts', 'Ghosts', 1, 4, 3),
      slider('ghostSpeed', 'Ghost speed', 1, 5, 3, 'a JS variable: ghostSpeed = 3'),
      toggle('tunnels', 'Side tunnels', true, 'wrap around the edges'),
    ],
  },
  {
    key: 'snake', name: 'Kin Snake', analog: 'Snake / slither.io', emoji: '🐍',
    tagline: 'Eat to grow. Don’t bite yourself. How long can you get?',
    tags: ['Arcade', 'Classic'], stars: 1, fit: 'Serpent Tamer', sidekickRole: 'magnetizes nearby food toward you',
    params: [
      slider('speed', 'Start speed', 1, 5, 2),
      toggle('walls', 'Solid walls', false, 'off = wrap around the edges'),
      slider('growth', 'Growth per bite', 1, 4, 2),
    ],
  },
  {
    key: 'chess', name: 'Mind Arena', analog: 'chess.com', emoji: '♟️',
    tagline: 'Real chess against a thinking machine. Five brain levels.',
    tags: ['Strategy', 'Brain'], stars: 3, fit: 'Grandmaster', sidekickRole: 'whispers a hint move when you ask',
    params: [
      slider('ai', 'Machine brain level', 0, 4, 1, 'minimax search depth — real AI!'),
      toggle('hints', 'Hint button', true),
    ],
  },
  {
    key: 'slice', name: 'Slice Storm', analog: 'Fruit Ninja', emoji: '🍉',
    tagline: 'Swipe to slice. Combo the fruit, never the bombs.',
    tags: ['Action', 'Reflex'], stars: 1, fit: 'Blade Ninja', sidekickRole: 'flicks one bomb away per game',
    params: [
      slider('spawn', 'Fruit per wave', 1, 5, 3),
      slider('bombs', 'Bomb chance %', 0, 30, 12),
      slider('gravity', 'Gravity', 1, 5, 3),
    ],
  },
  {
    key: 'horde', name: 'Horde Run', analog: 'Mob Control', emoji: '🧟',
    tagline: 'Run the gauntlet. Math gates grow your army — zombies shrink it.',
    tags: ['Runner', 'Math'], stars: 2, fit: 'Squad Captain', sidekickRole: 'runs point with its own blaster',
    params: [
      slider('length', 'Track length', 3, 10, 5, 'gates per run'),
      pick('math', 'Gate math', [['add', 'Plus & minus'], ['mult', 'Times & divide'], ['mix', 'Mix it all']], 'mix', 'the gates are real arithmetic!'),
      slider('zombies', 'Zombie waves', 1, 5, 3),
    ],
  },
  {
    key: 'farm', name: 'Kin Farm', analog: 'FarmVille', emoji: '🌾',
    tagline: 'Plant, water, harvest, sell. Crops keep growing while you’re away.',
    tags: ['Sim', 'Chill'], stars: 2, fit: 'Farmhand', sidekickRole: 'waters one thirsty crop for free',
    params: [
      slider('plots', 'Starting plots', 4, 9, 6),
      pick('pace', 'Crop speed', [['zen', 'Zen (slow)'], ['normal', 'Normal'], ['sprint', 'Sprint (fast)']], 'normal'),
    ],
  },
  {
    key: 'racer', name: 'Turbo Racer', analog: 'Race Master 3D', emoji: '🏎️',
    tagline: 'Weave the traffic, grab the boosts, chase the best lap.',
    tags: ['Racing', 'Arcade'], stars: 1, fit: 'Speed Demon', sidekickRole: 'shouts out obstacles before they hit',
    params: [
      slider('traffic', 'Traffic density', 1, 5, 3),
      slider('boosts', 'Boost pads', 0, 5, 2),
      slider('speed', 'Top speed', 1, 5, 3),
    ],
  },
  {
    key: 'sky', name: 'Sky Ace', analog: 'Galaga', emoji: '✈️',
    tagline: 'Blast the waves. Your ship evolves into cooler machines.',
    tags: ['Shooter', 'Upgrades'], stars: 2, fit: 'Ace Pilot', sidekickRole: 'flies wing and takes pot-shots',
    params: [
      slider('waves', 'Waves to win', 3, 10, 5),
      pick('tree', 'Upgrade path', [['guns', 'More guns'], ['speed', 'More speed'], ['tank', 'More armor']], 'guns', 'your 3-tier upgrade tree'),
      slider('enemySpeed', 'Enemy speed', 1, 5, 3),
    ],
  },
  {
    key: 'bubble', name: 'Bubble Burst', analog: 'Bubble Witch', emoji: '🫧',
    tagline: 'Aim, bounce, pop. Match three to burst the ceiling down.',
    tags: ['Puzzle', 'Aim'], stars: 2, fit: 'Bubble Mage', sidekickRole: 'shows your bounce line',
    params: [
      slider('rows', 'Starting rows', 3, 7, 4),
      slider('colors', 'Bubble colors', 3, 6, 4),
      toggle('drop', 'Ceiling drops', true, 'the ceiling creeps down over time'),
    ],
  },
  {
    key: 'blast', name: 'Blast Maze', analog: 'Bomberman', emoji: '💣',
    tagline: 'Drop bombs, break blocks, trap the critters. Don’t nuke yourself.',
    tags: ['Arcade', 'Maze'], stars: 2, fit: 'Demolition Pro', sidekickRole: 'sniffs out hidden power-ups',
    params: [
      slider('enemies', 'Critters', 2, 6, 3),
      slider('blast', 'Blast reach', 1, 4, 2),
      slider('density', 'Block density %', 40, 90, 65),
    ],
  },
  {
    key: 'gate', name: 'Keep the Gate', analog: 'Bloons TD', emoji: '🏰',
    tagline: 'Place your towers, hold the path, survive every wave.',
    tags: ['Strategy', 'Defense'], stars: 3, fit: 'Gate Warden', sidekickRole: 'patrols the path as a free unit',
    price: 40, rarity: 'rare',
    params: [
      slider('waves', 'Waves to win', 5, 15, 8),
      slider('gold', 'Starting gold', 60, 200, 100, 'your economy variable'),
      slider('lives', 'Gate lives', 3, 10, 5),
    ],
  },
  {
    key: 'clash', name: 'Arena Clash', analog: 'Street Fighter', emoji: '🥊',
    tagline: 'Best of three. Read your rival, land the combo.',
    tags: ['Fighting', 'Versus'], stars: 3, fit: 'Arena Champion', sidekickRole: 'corner coach — one cheer-heal per match',
    price: 60, rarity: 'epic',
    params: [
      slider('rounds', 'Rounds to win', 1, 3, 2),
      slider('aiLevel', 'Rival skill', 1, 5, 2),
      slider('hp', 'Health bars', 60, 150, 100),
    ],
  },
  {
    key: 'dyno', name: 'Dyno Brothers', analog: 'Tamagotchi × Pokémon', emoji: '🦖',
    tagline: 'Hatch the egg. Feed it, train it, battle it into cooler forms.',
    tags: ['Raise', 'Battle'], stars: 3, fit: 'Dino Ranger', sidekickRole: 'the caretaker buddy — cheers your dino in battle',
    price: 60, rarity: 'epic',
    params: [
      pick('species', 'Egg type', [['rex', 'Rex line'], ['tri', 'Tri line'], ['raptor', 'Raptor line'], ['bronto', 'Bronto line']], 'rex'),
      slider('battles', 'Battles per stage', 2, 5, 3),
    ],
  },
  {
    key: 'pocket', name: 'Pocket World', analog: 'Toca Boca', emoji: '🏠',
    tagline: 'No score, no rush. Decorate rooms, dress up, just play.',
    tags: ['Sandbox', 'Chill'], stars: 1, fit: 'World Maker', sidekickRole: 'a pet that follows you room to room',
    params: [
      slider('rooms', 'Rooms', 2, 5, 3),
      pick('set', 'Play set', [['home', 'Cozy Home'], ['cafe', 'Kitten Café'], ['spa', 'Sky Spa']], 'home'),
    ],
  },
]

export const genreDef = (key: string): GenreDef | undefined => GENRES.find(g => g.key === key)

// ── Hero costumes ─────────────────────────────────────────────
export interface CostumeStyle { key: string; label: string; emoji: string; price?: number; rarity?: Rarity }
export const COSTUME_STYLES: CostumeStyle[] = [
  { key: 'scout',  label: 'Scout',  emoji: '🧢' },
  { key: 'shadow', label: 'Shadow', emoji: '🕶️' },
  { key: 'royal',  label: 'Royal',  emoji: '👑' },
  { key: 'neon',   label: 'Neon',   emoji: '⚡', price: 40,  rarity: 'rare' },
  { key: 'cosmic', label: 'Cosmic', emoji: '🌌', price: 80,  rarity: 'epic' },
  { key: 'golden', label: 'Golden', emoji: '✨', price: 150, rarity: 'legendary' },
]

export interface Palette { key: string; label: string; a: string; b: string; skin: string }
export const PALETTES: Palette[] = [
  { key: 'ember',   label: 'Ember',   a: '#ef4444', b: '#f97316', skin: '#fcd9b8' },
  { key: 'ocean',   label: 'Ocean',   a: '#3b82f6', b: '#06b6d4', skin: '#fcd9b8' },
  { key: 'forest',  label: 'Forest',  a: '#22c55e', b: '#84cc16', skin: '#e8b98a' },
  { key: 'berry',   label: 'Berry',   a: '#a855f7', b: '#ec4899', skin: '#fcd9b8' },
  { key: 'sunny',   label: 'Sunny',   a: '#eab308', b: '#f59e0b', skin: '#a16a3c' },
  { key: 'frost',   label: 'Frost',   a: '#67e8f9', b: '#a5b4fc', skin: '#fcd9b8' },
  { key: 'shadow',  label: 'Shadow',  a: '#475569', b: '#1e293b', skin: '#e8b98a' },
  { key: 'rainbow', label: 'Rainbow', a: '#f472b6', b: '#38bdf8', skin: '#fcd9b8' },
]

export interface Accessory { key: string; label: string; emoji: string; price?: number; rarity?: Rarity }
export const ACCESSORIES: Accessory[] = [
  { key: 'none',  label: 'None',       emoji: '➖' },
  { key: 'cap',   label: 'Cap',        emoji: '🧢' },
  { key: 'scarf', label: 'Hero Scarf', emoji: '🧣' },
  { key: 'halo',  label: 'Halo',       emoji: '😇', price: 30,  rarity: 'rare' },
  { key: 'crown', label: 'Crown',      emoji: '👑', price: 70,  rarity: 'epic' },
  { key: 'aura',  label: 'Star Aura',  emoji: '💫', price: 120, rarity: 'legendary' },
]

// ── Sidekick shop ─────────────────────────────────────────────
export interface SidekickDef {
  key: string; name: string; emoji: string; color: string
  power: SidekickPower; perk: string
  price?: number; rarity?: Rarity
}
export const SIDEKICKS: SidekickDef[] = [
  { key: 'sk_pip',    name: 'Pip',     emoji: '🐤', color: '#fbbf24', power: 'luck',   perk: 'Lucky finds show up more often' },
  { key: 'sk_bolt',   name: 'Bolt',    emoji: '🐕', color: '#a16a3c', power: 'boost',  perk: 'Short bursts of extra speed' },
  { key: 'sk_muffin', name: 'Muffin',  emoji: '🐱', color: '#f472b6', power: 'magnet', perk: 'Pulls goodies toward you' },
  { key: 'sk_tank',   name: 'Tank',    emoji: '🐢', color: '#22c55e', power: 'shield', perk: 'Blocks one hit per game' },
  { key: 'sk_echo',   name: 'Echo',    emoji: '🦉', color: '#818cf8', power: 'scout',  perk: 'Reveals what’s coming', price: 40, rarity: 'rare' },
  { key: 'sk_zappy',  name: 'Zappy',   emoji: '🤖', color: '#38bdf8', power: 'zap',    perk: 'Zaps one enemy per wave', price: 60, rarity: 'rare' },
  { key: 'sk_nurse',  name: 'Clover',  emoji: '🐰', color: '#86efac', power: 'heal',   perk: 'One heal when you need it', price: 60, rarity: 'rare' },
  { key: 'sk_frosty', name: 'Frosty',  emoji: '🐧', color: '#93c5fd', power: 'slow',   perk: 'Slows everything briefly', price: 90, rarity: 'epic' },
  { key: 'sk_gem',    name: 'Gemmy',   emoji: '🐉', color: '#c084fc', power: 'double', perk: 'Double score windows', price: 120, rarity: 'epic' },
  { key: 'sk_nova',   name: 'Nova',    emoji: '🦊', color: '#fb923c', power: 'bomb',   perk: 'One screen-clearing boom', price: 200, rarity: 'legendary' },
]

// ── Worlds (palettes live in the engine — single source) ──────
export { STUDIO_WORLDS, worldDef, type WorldDef } from '@/engine/worlds'
import { STUDIO_WORLDS } from '@/engine/worlds'

export const LAYOUTS = ['Layout A', 'Layout B', 'Layout C'] as const

// ── Backend services (Backend Bay) ────────────────────────────
export const SERVICES = [
  { key: 'db' as const,          label: 'Database',    emoji: '🗄️', line: 'creating scores table…', kid: 'A notebook your game never loses — it remembers every score.' },
  { key: 'leaderboard' as const, label: 'Leaderboard', emoji: '🏆', line: 'indexing top scores…',   kid: 'Shows who’s best — your circle and the world.' },
  { key: 'cloudSave' as const,   label: 'Cloud Save',  emoji: '☁️', line: 'provisioning save slots…', kid: 'Three save files, like a real console memory card.' },
  { key: 'login' as const,       label: 'Login',       emoji: '🔑', line: 'enabling player auth…',  kid: 'Scores carry your name instead of “anonymous”.' },
]

// ── Spec assembly ─────────────────────────────────────────────
export function defaultSpec(): GameSpec {
  return {
    v: 2, genre: '' as GenreKey, title: '',
    hero: { name: 'Player', initial: 'P', style: 'scout', palette: 'ocean', accessory: 'none' },
    sidekick: null,
    world: '', layout: 0, params: {},
    services: { db: true, leaderboard: true, cloudSave: true, login: true },
  }
}

export function defaultParams(genre: GenreKey): Record<string, ParamValue> {
  const g = genreDef(genre)
  const out: Record<string, ParamValue> = {}
  for (const p of g?.params ?? []) out[p.key] = p.def
  return out
}

export function suggestSpecTitle(s: GameSpec): string {
  const g = genreDef(s.genre); const w = STUDIO_WORLDS.find(x => x.key === s.world)
  if (!g) return 'My Game'
  const flavor = w && w.key !== 'space' ? w.label.split(' ')[0] : ''
  return [flavor, g.name].filter(Boolean).join(' ').trim() || 'My Game'
}

// Everything diamond-purchasable in the studio (for the Shop page later).
export function studioShopItems(): { kind: string; key: string; label: string; emoji: string; price: number; rarity?: Rarity }[] {
  const rows: { kind: string; key: string; label: string; emoji: string; price: number; rarity?: Rarity }[] = []
  for (const g of GENRES) if (g.price) rows.push({ kind: 'genre', key: g.key, label: g.name, emoji: g.emoji, price: g.price, rarity: g.rarity })
  for (const c of COSTUME_STYLES) if (c.price) rows.push({ kind: 'costume', key: `cs_${c.key}`, label: `${c.label} Costume`, emoji: c.emoji, price: c.price, rarity: c.rarity })
  for (const a of ACCESSORIES) if (a.price) rows.push({ kind: 'accessory', key: `ac_${a.key}`, label: a.label, emoji: a.emoji, price: a.price, rarity: a.rarity })
  for (const s of SIDEKICKS) if (s.price) rows.push({ kind: 'sidekick', key: s.key, label: s.name, emoji: s.emoji, price: s.price, rarity: s.rarity })
  for (const w of STUDIO_WORLDS) if (w.price) rows.push({ kind: 'world', key: w.key, label: w.label, emoji: w.emoji, price: w.price, rarity: w.rarity })
  return rows
}
