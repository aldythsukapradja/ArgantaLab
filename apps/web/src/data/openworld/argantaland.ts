// ============================================================
//  ARGANTALAND · 2D OVERWORLD  (content-as-data, scalable-first)
//  Each world is a tile MAP authored as ASCII rows — to change a map you edit
//  characters here, nothing else. To ADD a map, add one entry to MAPS. The
//  engine (components/openworld/Argantaland.tsx) is generic: it renders any
//  MapDef, handles movement, and rolls weighted wild-kin encounters that come
//  straight from the existing KIN catalog (so adding a kin makes it spawn).
//
//  LEGEND (one char = one tile):
//    #  wall    — blocked
//    .  ground  — walk
//    ,  grass   — walk + wild encounters happen here
//    ~  water   — blocked
//    G  gym     — walk + a guaranteed-rarer encounter (legendary den)
//    S  spawn   — where the avatar starts
// ============================================================

import type { Rarity } from '@/data/cosmetics'
import { KIN } from './kin'

export type Tile = 'wall' | 'ground' | 'grass' | 'water' | 'gym' | 'spawn'

const LEGEND: Record<string, Tile> = {
  '#': 'wall', '.': 'ground', ',': 'grass', '~': 'water', 'G': 'gym', 'S': 'spawn',
}

// Per-biome palette — change a biome's look in ONE place and every map using it
// updates. (grass = the encounter tile, tinted to the world.)
export interface Biome { ground: string; grass: string; water: string; wall: string; gym: string }
const BIOMES: Record<string, Biome> = {
  desert: { ground: '#f6d9a6', grass: '#8fce5a', water: '#7cc7e8', wall: '#c8843c', gym: '#a78bfa' },
  grove:  { ground: '#dceccb', grass: '#7cc04a', water: '#7cc7e8', wall: '#6c9a4e', gym: '#a78bfa' },
  sky:    { ground: '#e6ddfb', grass: '#9bd4ec', water: '#bcd4ff', wall: '#9a86d6', gym: '#facc15' },
  neon:   { ground: '#26324a', grass: '#1f9d57', water: '#0ea5e9', wall: '#0b1220', gym: '#a78bfa' },
  reef:   { ground: '#ffe6c9', grass: '#7fd0a6', water: '#5bb6e8', wall: '#e09a5a', gym: '#a78bfa' },
  meadow: { ground: '#f7e2ec', grass: '#8ed06a', water: '#7cc7e8', wall: '#d98aae', gym: '#a78bfa' },
}

export interface MapDef { world: string; name: string; biome: keyof typeof BIOMES; rows: string[] }

// Keyed by the UPPERCASE world key (matches WORLDS). Each grid is 10 wide × 8 tall
// for the MVP — bump the rows/width freely, the engine reads the dimensions.
export const MAPS: Record<string, MapDef> = {
  NUM: { world: 'NUM', name: 'Numeria Dunes', biome: 'desert', rows: [
    '##########',
    '#S..,,..G#',
    '#..,,,...#',
    '#.,..##.,#',
    '#,,..##..#',
    '#..,...,,#',
    '#.,,,..,.#',
    '##########',
  ] },
  WRD: { world: 'WRD', name: 'Wordveil Grove', biome: 'grove', rows: [
    '##########',
    '#S.,,...G#',
    '#.,,..,,.#',
    '#..,.,,..#',
    '#,,..,...#',
    '#..,,..,,#',
    '#.,..,,,.#',
    '##########',
  ] },
  WON: { world: 'WON', name: 'Wonder Skyfield', biome: 'sky', rows: [
    '##########',
    '#S..,,..G#',
    '#.,,..,,.#',
    '#..~~~~..#',
    '#.,~~~~,,#',
    '#..,..,,.#',
    '#.,,,..,.#',
    '##########',
  ] },
  LOG: { world: 'LOG', name: 'Circuit Wastes', biome: 'neon', rows: [
    '##########',
    '#S.,##..G#',
    '#.,,##,,.#',
    '#..,...,,#',
    '#,,..,,..#',
    '#..##,..,#',
    '#.,##,,,.#',
    '##########',
  ] },
  WLD: { world: 'WLD', name: 'World Lagoon', biome: 'reef', rows: [
    '##########',
    '#S..,,..G#',
    '#.,,~~,,.#',
    '#..~~~~..#',
    '#,,~~~~,,#',
    '#..,,,,..#',
    '#.,,..,,.#',
    '##########',
  ] },
  LIF: { world: 'LIF', name: 'Mood Meadow', biome: 'meadow', rows: [
    '##########',
    '#S,,,..,G#',
    '#.,,,,,,.#',
    '#,,..,,,,#',
    '#,,,,..,,#',
    '#.,,,,,,.#',
    '#,,..,,,.#',
    '##########',
  ] },
}

// ── helpers (the engine + anything else reads through these) ──
export const tileOf = (ch: string): Tile => LEGEND[ch] ?? 'ground'
export const biomeOf = (m: MapDef): Biome => BIOMES[m.biome]
export const isWalkable = (t: Tile): boolean => t !== 'wall' && t !== 'water'
export const mapFor = (world: string): MapDef | undefined => MAPS[world]

export function spawnOf(m: MapDef): { r: number; c: number } {
  for (let r = 0; r < m.rows.length; r++) { const c = m.rows[r].indexOf('S'); if (c >= 0) return { r, c } }
  return { r: 1, c: 1 }
}

// Encounter weighting — common kin are everywhere, legendaries are rare. Tune the
// whole game's spawn feel from this one table.
const WEIGHT: Record<Rarity, number> = { common: 60, rare: 25, epic: 12, legendary: 3 }

/** Weighted-pick a wild kin id for this world. On a `gym` tile, legendaries
 *  dominate (a "den"). Returns null if the world has no kin. */
export function rollEncounter(world: string, gym = false): string | null {
  const all = KIN.filter(k => k.world === world.toLowerCase())
  if (all.length === 0) return null
  const weighted = all.map(k => ({ id: k.id, w: gym ? (k.rarity === 'legendary' ? 70 : k.rarity === 'epic' ? 25 : 5) : WEIGHT[k.rarity] }))
  const total = weighted.reduce((a, b) => a + b.w, 0)
  let roll = Math.random() * total
  for (const x of weighted) { roll -= x.w; if (roll <= 0) return x.id }
  return weighted[0].id
}
