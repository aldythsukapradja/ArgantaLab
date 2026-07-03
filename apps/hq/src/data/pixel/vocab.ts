// The controlled vocabulary — the ONLY place new categories get added. The
// viewer's facets, an agent's tagging, and the adapters all read from here, so
// classifications stay consistent instead of drifting into synonyms. Adding a
// category is a one-line edit; no type change, no redeploy of logic.
//
// Grounded in how the real libraries classify:
//   • Kenney       → packs by genre/use   → `domain`
//   • OpenGameArt  → art type + license   → `kind` + `tier`/`license`
//   • LPC          → canonical animations → `animations`
//   • Lospec       → palette shape        → palettes.ts
import type { License, Tier } from './types'

export const VOCAB = {
  // genre / use — the "what do I reach for this for" axis (Kenney-style)
  domain: [
    'rpg', 'platformer', 'roguelike', 'shmup', 'topdown', 'metroidvania',
    'ui', 'cinematic', 'marketing', 'avatar', 'world', 'animation', 'tileset', 'portrait',
  ],
  // what the asset IS (OpenGameArt art-type axis)
  kind: [
    'character', 'creature', 'tile', 'tileset', 'prop', 'item', 'weapon',
    'background', 'environment', 'icon', 'ui-element', 'effect', 'portrait', 'vehicle', 'font',
  ],
  characterType: [
    'hero', 'npc', 'enemy', 'boss', 'monster', 'mount', 'companion', 'villager', 'merchant', 'critter',
  ],
  theme: [
    'fantasy', 'sci-fi', 'medieval', 'modern', 'horror', 'cute', 'cyberpunk',
    'post-apocalyptic', 'nature', 'dungeon', 'urban', 'space', 'underwater',
    'seasonal-halloween', 'seasonal-winter',
  ],
  style: [
    'retro-8bit', '16bit', 'modern-hd-pixel', 'monochrome', '1bit', 'gameboy', 'isometric', 'demake',
  ],
  perspective: ['top-down', 'side', 'isometric', 'portrait', 'front-facing'],
  // animation names — LPC canon + common general motions
  animation: [
    'idle', 'walk', 'run', 'jump', 'cast', 'thrust', 'shoot', 'slash', 'hurt',
    'die', 'attack', 'bow', 'climb', 'spin', 'bounce', 'flap', 'emote',
  ],
} as const

export type VocabField = keyof typeof VOCAB
export const isKnown = (field: VocabField, v: string): boolean => (VOCAB[field] as readonly string[]).includes(v)

// ---- tier policy: the license → tier → what-you-may-do mapping --------------
export interface TierPolicy {
  tier: Tier
  label: string
  shippable: boolean        // may the raw pixels ship in a product?
  attribution: boolean      // must you credit the author?
  color: string             // themed chip color
  rule: string              // one-line human rule
}
export const TIERS: Record<Tier, TierPolicy> = {
  T0: { tier: 'T0', label: 'Vault',           shippable: true,  attribution: false, color: 'var(--ok)',   rule: 'Public-domain / CC0 — copy it, ship it, no credit needed.' },
  T1: { tier: 'T1', label: 'Reference-only',  shippable: false, attribution: true,  color: 'var(--warn)', rule: 'Attribution required — use as style reference for generation, never ship the pixels.' },
  T2: { tier: 'T2', label: 'Excluded',        shippable: false, attribution: false, color: 'var(--bad)',  rule: 'Proprietary / ripped — do not use. Catalogued only so the vault can recognise and warn.' },
}

// The mapping that decides tier from a license — the single source of legal truth.
export const LICENSE_TIER: Record<License, Tier> = {
  'CC0': 'T0', 'PublicDomain': 'T0',
  'CC-BY-3.0': 'T1', 'CC-BY-4.0': 'T1', 'CC-BY-SA-3.0': 'T1', 'CC-BY-SA-4.0': 'T1',
  'OGA-BY-3.0': 'T1', 'OGA-BY-4.0': 'T1', 'GPL-2.0': 'T1', 'GPL-3.0': 'T1',
  'Proprietary': 'T2', 'Unknown': 'T2',
}
export const tierForLicense = (l: License): Tier => LICENSE_TIER[l] ?? 'T2'

// ---- source registry: porting a new source is adding one row + one adapter --
export interface SourceMeta {
  name: string
  label: string
  defaultTier: Tier
  defaultLicense: License
  url: string
  note: string              // how to port / what the adapter reads
  status: 'live' | 'planned'
}
export const SOURCES: SourceMeta[] = [
  { name: 'kenney', label: 'Kenney', defaultTier: 'T0', defaultLicense: 'CC0', url: 'https://kenney.nl',
    note: 'Adapter reads a hand-curated pack list; 60k+ CC0 assets. Ship-as-is.', status: 'live' },
  { name: 'opengameart', label: 'OpenGameArt', defaultTier: 'T1', defaultLicense: 'OGA-BY-4.0', url: 'https://opengameart.org',
    note: 'Adapter parses the nyuuzyou/OpenGameArt-OGA-BY-4.0 JSONL dump; per-item license sets tier.', status: 'live' },
  { name: 'lpc', label: 'Liberated Pixel Cup', defaultTier: 'T1', defaultLicense: 'CC-BY-SA-3.0', url: 'https://lpc.opengameart.org',
    note: 'Universal LPC generator parts; canonical 64×64 animation set. CC-BY-SA/GPL → reference-only.', status: 'live' },
  { name: 'lospec', label: 'Lospec', defaultTier: 'T0', defaultLicense: 'PublicDomain', url: 'https://lospec.com/palette-list',
    note: 'Palette adapter: {name, author, colors[]}. 4,300+ palettes, public domain.', status: 'live' },
  { name: 'pixellab', label: 'PixelLab (generated)', defaultTier: 'T0', defaultLicense: 'CC0', url: 'https://pixellab.ai',
    note: 'Your own generations via the PixelLab MCP — original work, you own it. Lands in Ingest.', status: 'live' },
  { name: 'itch-cc0', label: 'itch.io (CC0 tag)', defaultTier: 'T0', defaultLicense: 'CC0', url: 'https://itch.io/game-assets/assets-cc0',
    note: 'Per-item CC0-tagged packs. Planned adapter — manual curation until then.', status: 'planned' },
]
export const sourceMeta = (name: string): SourceMeta | undefined => SOURCES.find(s => s.name === name)
