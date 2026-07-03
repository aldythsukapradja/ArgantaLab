// Pixel Vault — the type spine. Two namespaces per item is the load-bearing
// idea: `source` is owned by the ingest adapter (a re-sync overwrites it), while
// `curated` is owned by you / an agent (a re-sync must never touch it). That
// separation is what makes "port a new source" and "keep my tags" both safe.

// License → tier is the whole legal policy, in one mapping (see vocab.ts).
export type Tier = 'T0' | 'T1' | 'T2'
// T0 = public-domain / CC0 — ship as-is, no attribution.
// T1 = attribution required (CC-BY, CC-BY-SA, OGA-BY, GPL) — reference only, never ship the pixels.
// T2 = proprietary / ripped — excluded from use; catalogued only so the vault can *recognise* and warn.

export type License =
  | 'CC0' | 'PublicDomain'
  | 'CC-BY-3.0' | 'CC-BY-4.0' | 'CC-BY-SA-3.0' | 'CC-BY-SA-4.0'
  | 'OGA-BY-3.0' | 'OGA-BY-4.0' | 'GPL-2.0' | 'GPL-3.0'
  | 'Proprietary' | 'Unknown'

// Open string, not an enum — new sources must not require a code change.
export type SourceName = string

export interface ItemSource {
  name: SourceName          // 'kenney' | 'opengameart' | 'lpc' | 'lospec' | 'pixellab' | …
  sourceId: string          // upstream id/slug — the dedupe key on re-sync
  pack?: string             // e.g. 'Pixel Platformer'
  url: string               // where it came from (attribution + provenance)
  author?: string
  license: License
  tier: Tier
  fetchedAt: string         // ISO — provenance
  checksum?: string         // detects changed/removed upstream on re-sync
}

export interface ItemCurated {
  domain: string[]          // genre / use axis — 'rpg' | 'cinematic' | 'ui' | …
  kind: string              // what it IS — 'character' | 'tile' | 'background' | …
  isCharacter: boolean
  characterType?: string    // 'hero' | 'enemy' | 'mount' | … (only if isCharacter)
  theme: string[]           // 'fantasy' | 'sci-fi' | 'cute' | …
  style?: string            // 'retro-8bit' | '16bit' | 'isometric' | …
  groupId?: string          // bundle spanning kinds/sources — 'hero-party-4', 'cutscene-forest'
  tags: string[]            // always present, even before structured fields are filled
  verified: boolean         // human/agent-classified (true) vs adapter-guessed (false)
}

export interface ItemForm {
  size: { w: number; h: number }
  perspective?: string      // 'top-down' | 'side' | 'isometric' | 'portrait'
  paletteId?: string
  colorCount?: number
  swatch?: string[]         // a few representative hex colors, for the catalogue card
}

export interface Animation {
  name: string              // 'idle' | 'walk' | 'cast' | … (LPC-grounded, see vocab)
  frames: number
  fps: number
  directions: 1 | 4 | 8
  loop: boolean
}

export interface VaultItem {
  id: string                // IMMUTABLE — 'ref.kenney.pixel-platformer.coin_gold'
  name: string              // display, mutable
  source: ItemSource
  curated: ItemCurated
  form: ItemForm
  animations: Animation[]
  relationships: { derivedFrom?: string[]; usedBy?: string[]; relatedTo?: string[] }
  status?: 'draft' | 'published' | 'deprecated'   // canonical (Library) items only
}

// ---- palettes (Lospec-shaped) ----------------------------------------------
export interface Palette {
  id: string
  name: string
  author?: string
  colors: string[]          // hex, no '#'-optional; stored with '#'
  source: SourceName        // 'canonical' | 'lospec'
  license: License
  tags: string[]
  usedBy: number            // how many catalogue items reference it
}

// ---- usage (the render-key coverage x-ray over the other apps) --------------
export type UsageState = 'wired' | 'placeholder' | 'missing'
export interface UsageSite {
  id: string                // 'web.openworld.kin.render.ember_pup'
  app: 'argantalab' | 'kinetikcircle' | 'landing' | 'hq'
  surface: string           // 'Openworld · Kin'
  key: string               // the literal render/sprite key found in source
  resolvedAssetId?: string  // → VaultItem.id if wired
  state: UsageState
  sourceFile: string        // click-through target
}

// ---- ingest queue (PixelLab output awaiting review) -------------------------
export interface IngestItem {
  id: string
  suggestedName: string
  generatedVia: string      // 'pixellab'
  styleRefId?: string       // the reference it was generated against
  size: { w: number; h: number }
  swatch?: string[]
  suggestedTags: string[]
  status: 'pending' | 'rejected' | 'promoted'
}

// ---- query surface (shared by the viewer and the MCP Bridge) ----------------
export interface QueryFilter {
  domain?: string
  kind?: string
  theme?: string
  characterType?: string
  style?: string
  groupId?: string
  tier?: Tier
  source?: string
  canonical?: boolean       // true = your own Library assets (status set); false = external references
  animated?: boolean        // has ≥1 animation
  q?: string                // free-text over name/tags/id
  includeUnverified?: boolean   // default false — facet/counts trust verified only
  limit?: number
  offset?: number
}

export interface FacetCount { value: string; count: number }
export interface Facets {
  scope: Partial<QueryFilter>
  total: number
  facets: Record<string, FacetCount[]>
  honesty: string
}
