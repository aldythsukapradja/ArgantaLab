// ============================================================
//  ARGANTALAB · OPENWORLD · WORLD CATALOG  (content-as-data)
//  One row per world's explorable Openworld: its biome, the readable battle
//  gimmick that makes its kin feel different, an optional mount gate (some
//  worlds need a swim/flier mount to enter — giving mounts real purpose),
//  and the pool of kin that appear there.
//
//  Maps MUST feel different per world (user canon) — that difference lives
//  here as data, not as forked code. Numeria is built out; the rest are
//  seeded thin and grow as DATA.
// ============================================================

import { kinForWorld } from './kin'

export type MountGate = 'none' | 'swim' | 'flier'

export interface OpenworldDef {
  world: string         // matches NAV world tab: num/wrd/won/log/wld/lif
  name: string          // the place name
  biome: string         // art/background key for OpenworldStage
  gimmickLabel: string  // kid-facing description of the world's battle twist
  mountGate: MountGate  // entry requirement (gives mounts a reason to exist)
  accent: string        // theme tint
  intro: string         // one-line flavor shown on entry
}

const WORLD_DEFS: OpenworldDef[] = [
  { world: 'num', name: 'Numeria Dunes',   biome: 'desert',  gimmickLabel: 'Foes raise a number-shield every 3rd turn — time your Break.', mountGate: 'none',  accent: '#f59e0b', intro: 'Sunlit dunes where numbers roam. Befriend the Countfox!' },
  { world: 'wrd', name: 'Wordveil Grove',  biome: 'forest',  gimmickLabel: 'Names come scrambled — fix the word to land your hit.',          mountGate: 'none',  accent: '#3b82f6', intro: 'A misty grove of whispered words.' },
  { world: 'lif', name: 'Mood Meadow',     biome: 'meadow',  gimmickLabel: 'A kin’s mood shifts its weakness each turn — read the feeling.',  mountGate: 'none',  accent: '#ec4899', intro: 'A gentle meadow for our youngest explorers.' },
  { world: 'wld', name: 'World Lagoon',    biome: 'reef',    gimmickLabel: 'The tide rises and falls — place it on the map to strike.',       mountGate: 'swim',  accent: '#f97316', intro: 'A tidal reef — you’ll need a swim mount to wade in.' },
  { world: 'won', name: 'Wonder Skyfield', biome: 'sky',     gimmickLabel: 'The weakness is hidden — predict, test, explain to reveal it.',   mountGate: 'flier', accent: '#8b5cf6', intro: 'Floating sky-isles — only fliers reach them.' },
  { world: 'log', name: 'Circuit Wastes',  biome: 'neon',    gimmickLabel: 'Logic gates flip true/false — debug to deal damage.',            mountGate: 'none',  accent: '#22c55e', intro: 'A neon grid where logic bends.' },
]

export interface World extends OpenworldDef { kinIds: string[] }

export const OPENWORLDS: World[] = WORLD_DEFS.map(d => ({ ...d, kinIds: kinForWorld(d.world).map(x => x.id) }))
export const OPENWORLD_BY_WORLD: Record<string, World> = Object.fromEntries(OPENWORLDS.map(w => [w.world, w]))
export const openworld = (world: string): World | undefined => OPENWORLD_BY_WORLD[world]
