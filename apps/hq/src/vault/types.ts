// HQ Vault — core types for the founder knowledge workspace.
// Local-first: everything here serializes to localStorage, no backend required.

export type Product = 'HQ' | 'KinetikCircle' | 'ArgantaLabs' | 'LashiraBloom' | 'Investor' | 'Research'
// Note types follow the main Arganta knowledge base: the classic vault types plus
// the KB's structural types (moc, layer, journey, lesson, atlas, map, method).
export type NoteType =
  | 'note' | 'strategy' | 'decision' | 'prompt' | 'research' | 'plan' | 'spec'
  | 'moc' | 'layer' | 'journey' | 'lesson' | 'atlas' | 'map' | 'method'
// Status follows the main KB's living-document vocabulary; the legacy vault
// statuses stay valid so older snapshots keep loading.
export type NoteStatus =
  | 'living' | 'baseline' | 'frozen' | 'current' | 'superseded'
  | 'seed' | 'draft' | 'active' | 'shipped' | 'archived'
export type Confidence = 'low' | 'medium' | 'high'

export interface Frontmatter {
  title: string
  product: Product
  type: NoteType
  status: NoteStatus
  tags: string[]
  updated: string          // ISO date (yyyy-mm-dd) — accepts `date:` from main-KB notes
  owner: string
  confidence: Confidence
  // main-KB layer fields — optional, present on layer/stack notes
  maturity?: string        // hardened | proven | functional | drifting | zero
  leverage?: string        // high | medium | low | highest | meta
  health?: string          // green | amber | red
  layer?: string           // e.g. data | engine | app-ui | agentic | distribution
  [key: string]: string | string[] | undefined
}

export interface VaultNote {
  id: string               // stable slug, doubles as filename (id + '.md')
  fm: Frontmatter
  body: string             // markdown body without frontmatter block
  createdAt: number
  updatedAt: number
}

export interface WikiLink {
  raw: string               // full match incl. brackets
  target: string             // link target text
  alias?: string             // display alias if [[target|alias]]
  start: number               // index in body
}

// ---- Graph ----
export interface GraphNode {
  id: string
  title: string
  product: Product
  type: NoteType
  tags: string[]
  linkCount: number          // in + out degree
  orphan: boolean
}
export interface GraphEdge { source: string; target: string }
export interface VaultGraph { nodes: GraphNode[]; edges: GraphEdge[] }

// ---- Canvas (JSON-Canvas-inspired) ----
export type CanvasCardType = 'note' | 'text'
export interface CanvasCard {
  id: string
  type: CanvasCardType
  x: number; y: number
  w: number; h: number
  noteId?: string            // when type === 'note'
  text?: string              // when type === 'text'
  color?: string             // accent key: 'violet' | 'teal' | 'rose' | 'amber' | 'sky' | 'graphite'
}
export interface CanvasEdge { id: string; fromCard: string; toCard: string; label?: string }
export interface CanvasState { cards: CanvasCard[]; edges: CanvasEdge[] }

// ---- Settings ----
// 'hq' follows the Circle HQ shell theme (default) so the Vault never clashes
// with the rest of the operator surface; dark/light are explicit overrides.
export type VaultTheme = 'hq' | 'dark' | 'light'
export type AccentKey = 'indigo' | 'iris' | 'ember' | 'jade' | 'aurum' | 'rose'
export interface VaultSettings {
  theme: VaultTheme
  accent: AccentKey
  fontSize: number           // editor font size px
  compact: boolean
  leftOpen: boolean
  rightOpen: boolean
  graphDensity: number       // 0.5 .. 1.5 — spacing multiplier
}

export const DEFAULT_SETTINGS: VaultSettings = {
  theme: 'hq', accent: 'indigo', fontSize: 15, compact: false,
  leftOpen: true, rightOpen: true, graphDensity: 1,
}

// ---- Persisted snapshot ----
export interface VaultSnapshot {
  version: 1
  seedVersion?: string       // which seed edition first populated this snapshot
  notes: Record<string, VaultNote>
  canvas: CanvasState
  settings: VaultSettings
  tabs: string[]
  active: string | null
  pinned: string[]
  savedAt: number
}

export const PRODUCTS: Product[] = ['HQ', 'KinetikCircle', 'ArgantaLabs', 'LashiraBloom', 'Investor', 'Research']

// Product identity colors — used by graph nodes, explorer dots, bases chips.
export const PRODUCT_COLOR: Record<Product, string> = {
  HQ: '#8b7cf6',            // iris — the founder spine
  KinetikCircle: '#38bdf8', // sky — family OS
  ArgantaLabs: '#f0a24b',   // ember — learning engine
  LashiraBloom: '#4ade80',  // jade — the world/retention layer
  Investor: '#f472b6',      // rose — capital narrative
  Research: '#94a3b8',      // slate — inputs
}

export const STATUS_LABEL: Record<NoteStatus, string> = {
  living: 'Living', baseline: 'Baseline', frozen: 'Frozen', current: 'Current', superseded: 'Superseded',
  seed: 'Seed', draft: 'Draft', active: 'Active', shipped: 'Shipped', archived: 'Archived',
}

// Seed edition. The vault's localStorage key derives from this, so bumping it
// guarantees a fresh reseed — an old snapshot can never shadow a new seed.
export const SEED_VERSION = '2026-07-12-graph-319'

export const slugify = (s: string) =>
  s.trim().toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled'

export const todayISO = () => new Date().toISOString().slice(0, 10)

export const uid = () => Math.random().toString(36).slice(2, 9)
