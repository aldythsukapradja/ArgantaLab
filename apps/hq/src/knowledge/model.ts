// WS3 — the cortex model. Turns the REAL vault (all kb notes + link graph) into
// a dense, brain-shaped neural constellation:
//   • every real note becomes a neuron, placed by ontology → hemisphere +
//     THINK/KNOW/DO cognition band (see brain.ts),
//   • real wikilinks become white-matter tracts (cross-hemisphere = callosum),
//   • the 8-node canonical spine stays flagged as deep hero structure,
//   • ontology type + provenance + cognition attached to every node,
//   • positions are deterministic + persisted so spatial memory holds.

import type { VaultNote } from '../vault/types'
import { buildBacklinks, buildGraph, buildSuggestedEdges } from '../vault/graph'
import { deriveOntologyType, type OntologyType } from './ontology'
import { deriveProvenance, type Provenance, type EdgeProvenance } from './provenance'
import { brainPosition, cognitionOf, hemisphereOf, type Cognition, type Hemisphere } from './brain'
import { SPINE } from './spine'

export interface KNode {
  id: string                 // note id (spine anchors keep their real id)
  noteId: string | null      // real vault note id (null = missing source)
  label: string
  ontology: OntologyType
  provenance: Provenance
  cognition: Cognition
  hemisphere: Hemisphere
  spine: boolean
  spineIndex: number         // 0..7 for hero nodes, -1 otherwise
  pos: [number, number, number]
  r: number
  summary: string
  degree: number
}

export interface KEdge {
  a: string
  b: string
  provenance: EdgeProvenance
  spine: boolean
  callosal: boolean          // crosses hemispheres (corpus callosum)
}

export interface KModel {
  nodes: KNode[]
  edges: KEdge[]
  byId: Map<string, KNode>
  index: Map<string, number> // node id → instance index
  missing: string[]          // spine keys whose anchor note is missing
  counts: { total: number; think: number; know: number; do: number; left: number; right: number }
}

const LAYOUT_KEY = 'knowledge_cortex_v1'
const SPINE_ANCHOR = new Map(SPINE.map((s) => [s.anchor, s]))

function firstParagraph(body: string | undefined): string {
  if (!body || typeof body !== 'string') return ''
  const m = body.split(/\n\s*\n/).map((s) => s.trim()).find((s) => s && !s.startsWith('#') && !s.startsWith('>') && !s.startsWith('|') && !s.startsWith('```'))
  if (!m) return ''
  const plain = m.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, t, a) => a || t).replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim()
  return plain.length > 180 ? plain.slice(0, 180) + '…' : plain
}

function loadLayout(): Record<string, [number, number, number]> {
  try { return JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}') } catch { return {} }
}
function saveLayout(map: Record<string, [number, number, number]>) {
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(map)) } catch { /* quota — non-fatal */ }
}

export function buildKnowledgeModel(notes: Record<string, VaultNote>): KModel {
  // Guard against a broken/empty vault store (null notes, corrupted snapshot) so
  // the surface degrades to an empty cortex instead of crashing to a blank.
  if (!notes || typeof notes !== 'object') notes = {}
  const ix = buildBacklinks(notes)
  const graph = buildGraph(notes, ix)
  const suggested = buildSuggestedEdges(notes, ix)
  const degreeOf = (id: string) => (ix.outgoing[id]?.length || 0) + (ix.backlinks[id]?.length || 0)

  const persisted = loadLayout()
  const layout: Record<string, [number, number, number]> = {}

  const nodes: KNode[] = []
  const byId = new Map<string, KNode>()
  const index = new Map<string, number>()
  const counts = { total: 0, think: 0, know: 0, do: 0, left: 0, right: 0 }

  // every real note → a neuron. Guard each note so one malformed row (e.g. a
  // hand-created note missing frontmatter fields) can never blank the surface.
  const ids = Object.keys(notes)
  ids.forEach((id) => {
    try {
      const note = notes[id]
      if (!note || !note.fm) return
      const spine = SPINE_ANCHOR.get(id)
      const ontology = spine ? spine.ontology : deriveOntologyType(note)
      const cognition = cognitionOf(ontology)
      const hemisphere = hemisphereOf(ontology)
      const pos = persisted[id] || brainPosition(id, cognition, hemisphere)
      layout[id] = pos
      const deg = degreeOf(id)
      const kn: KNode = {
        id,
        noteId: id,
        label: (spine ? spine.label : note.fm.title) || id,
        ontology,
        provenance: deriveProvenance(note),
        cognition,
        hemisphere,
        spine: !!spine,
        spineIndex: spine ? SPINE.findIndex((s) => s.anchor === id) : -1,
        pos,
        r: spine ? 1.05 : 0.38 + Math.min(0.62, Math.sqrt(deg) * 0.13),
        summary: spine ? spine.caption : firstParagraph(note.body),
        degree: deg,
      }
      index.set(id, nodes.length)
      nodes.push(kn)
      byId.set(id, kn)
      counts.total++
      counts[cognition]++
      if (hemisphere === 'left') counts.left++
      else if (hemisphere === 'right') counts.right++
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[cortex] skipped note', id, e)
    }
  })

  // spine anchors that don't resolve → record as missing (still rare)
  const missing = SPINE.filter((s) => !notes[s.anchor]).map((s) => s.key)

  // real wikilink tracts
  const edges: KEdge[] = []
  const seen = new Set<string>()
  const pushEdge = (a: string, b: string, provenance: EdgeProvenance) => {
    const na = byId.get(a), nb = byId.get(b)
    if (!na || !nb) return
    const key = a < b ? a + '|' + b : b + '|' + a
    if (seen.has(key)) return
    seen.add(key)
    const callosal = na.hemisphere !== 'mid' && nb.hemisphere !== 'mid' && na.hemisphere !== nb.hemisphere
    edges.push({ a, b, provenance, spine: false, callosal })
  }
  for (const e of graph.edges) pushEdge(e.source, e.target, 'confirmed')
  for (const e of suggested) pushEdge(e.source, e.target, 'suggested')

  // hero-path edges (the canonical spine sequence) — always present + flagged
  for (let i = 0; i < SPINE.length - 1; i++) {
    const a = SPINE[i].anchor, b = SPINE[i + 1].anchor
    if (!byId.get(a) || !byId.get(b)) continue
    const na = byId.get(a)!, nb = byId.get(b)!
    edges.push({ a, b, provenance: 'confirmed', spine: true, callosal: na.hemisphere !== 'mid' && nb.hemisphere !== 'mid' && na.hemisphere !== nb.hemisphere })
  }

  saveLayout(layout)
  return { nodes, edges, byId, index, missing, counts }
}
