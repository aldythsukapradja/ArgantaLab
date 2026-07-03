// ============================================================
//  ARGANTA ENGINE — entry point. Bundled to a single IIFE
//  (global ARGANTA) that gameGen embeds into every generated
//  game. ARGANTA.boot(spec, gameId) does the rest.
// ============================================================

import type { GameSpec, GenreKey } from './types'
import { runShell, type ShellMeta } from './shell'
import type { GenreFactory } from './core'

import * as sweet from './genres/sweet'
import * as chomp from './genres/chomp'
import * as snake from './genres/snake'
import * as chess from './genres/chess'
import * as slice from './genres/slice'
import * as horde from './genres/horde'
import * as farm from './genres/farm'
import * as racer from './genres/racer'
import * as sky from './genres/sky'
import * as bubble from './genres/bubble'
import * as blast from './genres/blast'
import * as gate from './genres/gate'
import * as clash from './genres/clash'
import * as dyno from './genres/dyno'
import * as pocket from './genres/pocket'

const REGISTRY: Record<GenreKey, { make: GenreFactory; hint: string; meta: Omit<ShellMeta, 'hint'> }> = {
  sweet:  { make: sweet.make,  hint: sweet.hint,  meta: { genreName: 'Sweet Cascade', analog: 'Candy Crush', emoji: '🍬' } },
  chomp:  { make: chomp.make,  hint: chomp.hint,  meta: { genreName: 'Chomp Maze', analog: 'Pac-Man', emoji: '🟡' } },
  snake:  { make: snake.make,  hint: snake.hint,  meta: { genreName: 'Kin Snake', analog: 'Snake', emoji: '🐍' } },
  chess:  { make: chess.make,  hint: chess.hint,  meta: { genreName: 'Mind Arena', analog: 'chess.com', emoji: '♟️' } },
  slice:  { make: slice.make,  hint: slice.hint,  meta: { genreName: 'Slice Storm', analog: 'Fruit Ninja', emoji: '🍉' } },
  horde:  { make: horde.make,  hint: horde.hint,  meta: { genreName: 'Horde Run', analog: 'Mob Control', emoji: '🧟' } },
  farm:   { make: farm.make,   hint: farm.hint,   meta: { genreName: 'Kin Farm', analog: 'FarmVille', emoji: '🌾' } },
  racer:  { make: racer.make,  hint: racer.hint,  meta: { genreName: 'Turbo Racer', analog: 'Race Master 3D', emoji: '🏎️' } },
  sky:    { make: sky.make,    hint: sky.hint,    meta: { genreName: 'Sky Ace', analog: 'Galaga', emoji: '✈️' } },
  bubble: { make: bubble.make, hint: bubble.hint, meta: { genreName: 'Bubble Burst', analog: 'Bubble Witch', emoji: '🫧' } },
  blast:  { make: blast.make,  hint: blast.hint,  meta: { genreName: 'Blast Maze', analog: 'Bomberman', emoji: '💣' } },
  gate:   { make: gate.make,   hint: gate.hint,   meta: { genreName: 'Keep the Gate', analog: 'Bloons TD', emoji: '🏰' } },
  clash:  { make: clash.make,  hint: clash.hint,  meta: { genreName: 'Arena Clash', analog: 'Street Fighter', emoji: '🥊' } },
  dyno:   { make: dyno.make,   hint: dyno.hint,   meta: { genreName: 'Dyno Brothers', analog: 'Tamagotchi × Pokémon', emoji: '🦖' } },
  pocket: { make: pocket.make, hint: pocket.hint, meta: { genreName: 'Pocket World', analog: 'Toca Boca', emoji: '🏠' } },
}

export function boot(spec: GameSpec, gameId: string) {
  const entry = REGISTRY[spec.genre]
  if (!entry) {
    document.body.innerHTML = `<p style="color:#fff;font-family:sans-serif;padding:40px">Unknown genre: ${spec.genre}</p>`
    return
  }
  runShell(spec, gameId, { ...entry.meta, hint: entry.hint }, entry.make)
}
