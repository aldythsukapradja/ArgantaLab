// GB-3 · Forge configuration — the ONLY thing that differs between the App
// Forge and the Game Forge. Same discipline as the legacy builders/config.ts it
// replaces: pages and panes are fully shared and read their specifics here.
//
// The App Forge carries TWO artifact kinds (application + website) because the
// Website Builder lives inside it as a mode toggle — builder-core/generate.ts
// already supports both, so this is a switch, not a second builder.
import { Gamepad2, Boxes, Globe, LayoutGrid, type LucideIcon } from 'lucide-react'
import { APP_TEMPLATES } from '../../data/appTemplates'
import { PROMPT_CATEGORIES } from '../../data/starterPrompt'
import type { ArtifactKind } from '../../builder-core/generate'

/** Which builder surface is mounted. Distinct from ArtifactKind: the 'app'
 * surface can produce EITHER an application or a website. */
export type ForgeSurface = 'app' | 'game'

export interface ModeOption {
  kind: ArtifactKind
  label: string
  Icon: LucideIcon
  hint: string
}

export interface Starter {
  /** Stable id — a template id, a genre key, or a hand-written starter. */
  id: string
  label: string
  emoji: string
  hint: string
  /** The brief handed to the generator when picked. Written as a real founder
   * sentence, not a prompt-engineering blob — the generator owns the contract. */
  brief: string
  /** For games: the genre this starter locks in. */
  genre?: string
  /** For apps: the template id threaded to create_application. */
  templateId?: string
}

export interface ForgeConfig {
  surface: ForgeSurface
  noun: string
  /** Modes offered in the header. One entry = no toggle rendered. */
  modes: ModeOption[]
  defaultKind: ArtifactKind
  sdkGlobal: string
  starters: Starter[]
  /** Placeholder for the empty-state prompt box. */
  promptPlaceholder: string
  emptyTitle: string
  emptyBlurb: string
}

const APP_CONFIG: ForgeConfig = {
  surface: 'app',
  noun: 'App',
  defaultKind: 'application',
  sdkGlobal: 'CircleApp',
  modes: [
    { kind: 'application', label: 'App', Icon: Boxes, hint: 'An interactive tool with state — tracker, dashboard, planner, CRM' },
    { kind: 'website', label: 'Website', Icon: Globe, hint: 'A presentation page — landing, product, company, portfolio' },
  ],
  promptPlaceholder: 'Describe the app you want — "a chore tracker for my kids with points and a weekly reset"',
  emptyTitle: 'What do you want to build?',
  emptyBlurb: 'Describe it in a sentence. You get a working single-file app in seconds, then refine it by chatting.',
  starters: [
    ...APP_TEMPLATES.slice(0, 6).map((t) => ({
      id: t.id, label: t.name, emoji: t.emoji, hint: t.description,
      brief: t.description || t.name, templateId: t.id,
    })),
    { id: 'landing', label: 'Landing page', emoji: '🚀', hint: 'A product landing page with hero, features and a call to action', brief: 'A product landing page with a hero, three feature sections, pricing and a call to action' },
    { id: 'portfolio', label: 'Portfolio', emoji: '🎨', hint: 'A personal portfolio site with projects and contact', brief: 'A personal portfolio website with an intro, a project grid and a contact section' },
  ],
}

const GAME_CONFIG: ForgeConfig = {
  surface: 'game',
  noun: 'Game',
  defaultKind: 'game',
  sdkGlobal: 'CircleGame',
  // One kind — no toggle. The header renders the genre instead.
  modes: [{ kind: 'game', label: 'Game', Icon: Gamepad2, hint: 'A playable single-file browser game' }],
  promptPlaceholder: 'Describe the game you want — "a snake game that speeds up as you eat"',
  emptyTitle: 'What do you want to play?',
  emptyBlurb: 'Describe it in a sentence. You get a playable single-file game in seconds, then refine it by chatting.',
  starters: [
    { id: 'arcade', genre: 'arcade', label: 'Arcade', emoji: '🕹️', hint: 'Fast, simple, one more go', brief: 'A fast arcade game where you dodge obstacles and collect stars, getting harder as your score climbs' },
    { id: 'puzzle', genre: 'puzzle', label: 'Puzzle', emoji: '🧩', hint: 'Think, match, clear', brief: 'A match-3 puzzle game on a grid where clearing lines scores points' },
    { id: 'platformer', genre: 'platformer', label: 'Platformer', emoji: '🦘', hint: 'Run, jump, reach the flag', brief: 'A side-scrolling platformer where you jump between platforms, avoid hazards and reach the flag' },
    { id: 'shooter', genre: 'shooter', label: 'Shooter', emoji: '🎯', hint: 'Aim, fire, survive the waves', brief: 'A space shooter where waves of enemies descend and you shoot them down before they reach you' },
    { id: 'racing', genre: 'racing', label: 'Racing', emoji: '🏎️', hint: 'Steer, dodge, beat the clock', brief: 'A top-down racing game where you steer between traffic and beat your best lap time' },
    { id: 'tower', genre: 'tower', label: 'Tower defense', emoji: '🏰', hint: 'Place, upgrade, hold the line', brief: 'A tower defense game where you place towers along a path to stop waves of enemies' },
    { id: 'rpg', genre: 'rpg', label: 'RPG', emoji: '⚔️', hint: 'Explore, fight, level up', brief: 'A small turn-based RPG where you explore a dungeon, fight monsters and level up' },
    { id: 'survival', genre: 'survival', label: 'Survival', emoji: '🏕️', hint: 'Gather, craft, last the night', brief: 'A survival game where you gather resources by day and defend your camp at night' },
  ],
}

export function forgeConfig(surface: ForgeSurface): ForgeConfig {
  return surface === 'game' ? GAME_CONFIG : APP_CONFIG
}

/** Genre labels for the header chip — reuses the legacy Game Builder's
 * category vocabulary so a Forge game and a legacy game classify identically. */
export const GENRE_LABEL: Record<string, string> = {
  ...Object.fromEntries(PROMPT_CATEGORIES.map((c) => [c.key, c.label])),
  arcade: 'Arcade', puzzle: 'Puzzle', platformer: 'Platformer', shooter: 'Shooter',
  racing: 'Racing', tower: 'Tower defense', rpg: 'RPG', survival: 'Survival',
  farming: 'Farming', strategy: 'Strategy', rhythm: 'Rhythm', custom: 'Custom',
}

export const KIND_LABEL: Record<ArtifactKind, string> = {
  application: 'App', website: 'Website', game: 'Game',
}

/** The legacy preview runtime (builders/artifact.ts) speaks 'game' | 'app' —
 * a website has no SDK, and gets the app runtime's harmless mock. */
export const legacyKindFor = (k: ArtifactKind): 'game' | 'app' => (k === 'game' ? 'game' : 'app')

export const FORGE_ICON: Record<ForgeSurface, LucideIcon> = { app: LayoutGrid, game: Gamepad2 }
