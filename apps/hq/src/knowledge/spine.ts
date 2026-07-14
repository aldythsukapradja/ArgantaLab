// WS3 — the canonical 8-node spine: the Act V narrative and the hero path.
//
//   Founder → Jarvis → Command → Vault → Data → Architecture → Agents → Products
//
// Each spine node is a CONCEPT that resolves to a REAL vault note (the anchor).
// The anchors below are hand-curated ids that exist in kb.generated.ts. If an
// anchor ever goes missing, resolution flags it and the node renders as the
// "missing source" placeholder — it is never faked as live.

import type { OntologyType } from './ontology'

export interface SpineNode {
  /** stable spine key (also the scene node id for the hero path) */
  key: string
  label: string
  ontology: OntologyType
  /** real vault note id this concept is grounded to */
  anchor: string
  /** one-line story caption used by tours + inspector */
  caption: string
}

export const SPINE: SpineNode[] = [
  { key: 'founder', label: 'Founder', ontology: 'Founder', anchor: 'founder-decisions',
    caption: 'The human at the root — every decision traces back here.' },
  { key: 'jarvis', label: 'Jarvis', ontology: 'Agent', anchor: 'doc-apps-hq-docs-concept-jarvis-ceo-md',
    caption: 'The CEO intelligence — deterministic, provenance-honest, always on.' },
  { key: 'command', label: 'Command', ontology: 'Office', anchor: 'hq',
    caption: 'Circle HQ — the cockpit where the six offices report.' },
  { key: 'vault', label: 'Vault', ontology: 'Document', anchor: 'l6-knowledge-base',
    caption: 'The knowledge base — one markdown truth, 319 living notes.' },
  { key: 'data', label: 'Data', ontology: 'Database', anchor: 'l1-data',
    caption: 'One Supabase — 71 tables, 147 RPCs, the only source of truth.' },
  { key: 'architecture', label: 'Architecture', ontology: 'Architecture', anchor: 'l2-engine-spine',
    caption: 'The engine spine — shared packages every product reuses.' },
  { key: 'agents', label: 'Agents', ontology: 'Agent', anchor: 'l5-agentic',
    caption: 'The agentic layer — offices, skills, tools, approvals.' },
  { key: 'products', label: 'Products', ontology: 'Product', anchor: 'product-loop',
    caption: 'The loop is the product — Organize → Learn → Bloom → Observe.' },
]

export const SPINE_KEYS = SPINE.map((s) => s.key)
export const SPINE_ANCHORS = SPINE.map((s) => s.anchor)
