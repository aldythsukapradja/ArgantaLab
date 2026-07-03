// ============================================================
//  ARGANTA GAME ENGINE · SHARED TYPES
//  The GameSpec is the single contract between the Studio wizard
//  (which authors it), gameGen (which embeds it), and the engine
//  bundle (which boots from it inside the game iframe).
//  Everything a generated game is — genre, hero, sidekick, world,
//  dials, services — lives in this one JSON-safe object.
// ============================================================

export type GenreKey =
  | 'sweet'   // match-3            (Candy Crush)
  | 'chomp'   // maze muncher       (Pac-Man)
  | 'snake'   // snake              (Snake / slither.io)
  | 'chess'   // chess              (chess.com)
  | 'slice'   // swipe slicer       (Fruit Ninja)
  | 'horde'   // crowd runner       (Mob Control / Z-War IG ads)
  | 'farm'    // farming sim        (FarmVille / Hay Day)
  | 'racer'   // top-down racer     (Race Master 3D)
  | 'sky'     // shmup + upgrades   (Space Invaders / Galaga)
  | 'bubble'  // bubble shooter     (Bubble Witch)
  | 'blast'   // bomber maze        (Bomberman / Dyna Blaster)
  | 'gate'    // tower defense      (Bloons TD)
  | 'clash'   // duel fighter       (Street Fighter)
  | 'dyno'    // raise & battle     (Tamagotchi × Pokémon)
  | 'pocket'  // free-play sandbox  (Toca Boca)

/** What a sidekick mechanically does in-game. Engines interpret per genre. */
export type SidekickPower =
  | 'magnet' | 'scout' | 'shield' | 'boost' | 'zap'
  | 'heal' | 'luck' | 'slow' | 'double' | 'bomb'

export interface HeroSpec {
  name: string        // player display name  ("Aldy")
  initial: string     // 1-char avatar mark   ("A")
  style: string       // costume style key    (legacy chibi fallback)
  palette: string     // costume palette key  (legacy chibi fallback)
  accessory: string   // accessory key        (legacy chibi fallback)
  svg?: string        // the kid's REAL Buddy avatar (serialized SVG, outfit included)
}

export interface SidekickSpec {
  key: string         // catalog key, 'kin:<render>' or 'mount:<id>' for owned ones
  name: string
  emoji: string       // draw fallback (kin sidekicks draw as tinted critters)
  color: string
  power: SidekickPower
}

export interface ServicesSpec {
  db: boolean          // backend fiction master switch (score history)
  leaderboard: boolean // in-game leaderboard UI
  cloudSave: boolean   // save slots UI
  login: boolean       // named vs anonymous scores
}

export type ParamValue = number | string | boolean

export interface GameSpec {
  v: 2
  genre: GenreKey
  title: string
  hero: HeroSpec
  sidekick: SidekickSpec | null
  world: string                 // world key (palette + flavor)
  layout: number                // 0..2 map/layout variant (rng seed component)
  params: Record<string, ParamValue>
  services: ServicesSpec
}

// ── Bridge protocol (game iframe ⇄ parent app via postMessage) ──
export interface BridgeRequest {
  arganta: true
  id: number
  gameId: string
  type: 'ready' | 'save' | 'load' | 'score' | 'leaderboard' | 'quit'
  payload?: unknown
}
export interface BridgeResponse {
  arganta: true
  id: number
  type: 'result'
  ok: boolean
  payload?: unknown
}

export interface SaveSlot { slot: number; data: unknown; label: string; savedAt: number }
export interface ScoreRow { name: string; score: number; at: number; me?: boolean }
