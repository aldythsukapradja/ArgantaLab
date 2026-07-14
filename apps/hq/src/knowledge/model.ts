// WS3 — the graph model. Turns the REAL vault (kb notes + link graph) into a
// curated, grounded, spatially-stable 3D constellation:
//   • the 8-node hero spine (Act V), each grounded to a real note,
//   • plus each spine node's real 1-hop neighbourhood (bounded for perf),
//   • ontology type + provenance attached to every node,
//   • deterministic seeded 3D positions, persisted so spatial memory holds.

import type { VaultNote } from '../vault/types'
import { buildBacklinks, buildGraph, buildSuggestedEdges } from '../vault/graph'
import { deriveOntologyType, type OntologyType } from './ontology'
import { deriveProvenance, type Provenance, type EdgeProvenance } from './provenance'
import { SPINE } from './spine'

export interface KNode {
  id: string                 // scene id: spine key for hero nodes, else the note id
  noteId: string | null      // real vault note id (null = missing source)
  label: string
  ontology: OntologyType
  provenance: Provenance
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
  spine: boolean             // hero-path edge (the canonical sequence)
}

export interface KModel {
  nodes: KNode[]
  edges: KEdge[]
  byId: Map<string, KNode>
  missing: string[]          // spine keys whose anchor note is missing
}

const LAYOUT_KEY = 'knowledge_layout_v1'
const MAX_NEIGHBORS = 11     // per spine node
const HERO_SPAN = 13         // spine arc half-width

// --- deterministic hash → unit helpers (stable positions from a node id) ---
function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0) / 4294967295
}
const hash2 = (s: string) => hash(s + '::b')
const hash3 = (s: string) => hash(s + '::c')

function firstParagraph(body: string): string {
  const m = body.split(/\n\s*\n/).map((s) => s.trim()).find((s) => s && !s.startsWith('#') && !s.startsWith('>') && !s.startsWith('|') && !s.startsWith('```'))
  if (!m) return ''
  const plain = m.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, t, a) => a || t).replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim()
  return plain.length > 180 ? plain.slice(0, 180) + '…' : plain
}

// Hero spine positions: a slow, rising S-curve through space so the path reads
// as a journey left→right. Fixed, never seeded — this is the memorable anchor.
function spinePos(i: number): [number, number, number] {
  const t = i / (SPINE.length - 1)      // 0..1
  const x = (t - 0.5) * 2 * HERO_SPAN
  const y = Math.sin(t * Math.PI * 1.15) * 3.2 - 0.4
  const z = Math.sin(t * Math.PI * 2) * 4.2
  return [x, y, z]
}

// Neighbour positions: a deterministic point on a shell around its spine parent.
function neighborPos(parent: [number, number, number], id: string, k: number): [number, number, number] {
  const u = hash(id), v = hash2(id), w = hash3(id)
  const theta = u * Math.PI * 2
  const phi = Math.acos(2 * v - 1)
  const radius = 3.1 + w * 2.6 + (k % 3) * 0.35
  return [
    parent[0] + Math.sin(phi) * Math.cos(theta) * radius,
    parent[1] + Math.cos(phi) * radius * 0.72,
    parent[2] + Math.sin(phi) * Math.sin(theta) * radius,
  ]
}

function loadLayout(): Record<string, [number, number, number]> {
  try { return JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}') } catch { return {} }
}
function saveLayout(map: Record<string, [number, number, number]>) {
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(map)) } catch { /* quota — non-fatal */ }
}

export function buildKnowledgeModel(notes: Record<string, VaultNote>): KModel {
  const index = buildBacklinks(notes)
  const graph = buildGraph(notes, index)
  const suggested = buildSuggestedEdges(notes, index)
  const degreeOf = (id: string) => (index.outgoing[id]?.length || 0) + (index.backlinks[id]?.length || 0)

  const persisted = loadLayout()
  const layout: Record<string, [number, number, number]> = {}
  const posFor = (id: string, fallback: [number, number, number]): [number, number, number] => {
    const p = persisted[id] || fallback
    layout[id] = p
    return p
  }

  const nodes: KNode[] = []
  const byId = new Map<string, KNode>()
  const missing: string[] = []
  const claimed = new Set<string>()       // note ids already placed (spine wins)

  // --- hero spine ---
  SPINE.forEach((s, i) => {
    const note = notes[s.anchor]
    if (!note) missing.push(s.key)
    const pos = posFor(s.key, spinePos(i))
    const kn: KNode = {
      id: s.key,
      noteId: note ? s.anchor : null,
      label: s.label,
      ontology: s.ontology,
      provenance: deriveProvenance(note),
      spine: true,
      spineIndex: i,
      pos,
      r: 1.0,
      summary: s.caption,
      degree: note ? degreeOf(s.anchor) : 0,
    }
    nodes.push(kn); byId.set(kn.id, kn)
    if (note) claimed.add(s.anchor)
  })

  // --- real 1-hop neighbourhoods ---
  const edges: KEdge[] = []
  // hero-path edges (the canonical narrative sequence) — always confirmed
  for (let i = 0; i < SPINE.length - 1; i++) edges.push({ a: SPINE[i].key, b: SPINE[i + 1].key, provenance: 'confirmed', spine: true })

  const neighborOwner = new Map<string, string>()   // noteId -> owning spine key

  SPINE.forEach((s) => {
    if (!notes[s.anchor]) return
    const parentPos = byId.get(s.key)!.pos
    const neigh = new Set<string>([...(index.outgoing[s.anchor] || []), ...(index.backlinks[s.anchor] || [])])
    const picks = [...neigh]
      .filter((nid) => nid !== s.anchor && !claimed.has(nid) && notes[nid])
      .sort((a, b) => degreeOf(b) - degreeOf(a))
      .slice(0, MAX_NEIGHBORS)

    picks.forEach((nid, k) => {
      claimed.add(nid)
      neighborOwner.set(nid, s.key)
      const note = notes[nid]
      const pos = posFor(nid, neighborPos(parentPos, nid, k))
      const deg = degreeOf(nid)
      const kn: KNode = {
        id: nid,
        noteId: nid,
        label: note.fm.title,
        ontology: deriveOntologyType(note),
        provenance: deriveProvenance(note),
        spine: false,
        spineIndex: -1,
        pos,
        r: 0.42 + Math.min(0.34, Math.sqrt(deg) * 0.09),
        summary: firstParagraph(note.body),
        degree: deg,
      }
      nodes.push(kn); byId.set(kn.id, kn)
      // spine → neighbour edge (real link, so confirmed)
      edges.push({ a: s.key, b: nid, provenance: 'confirmed', spine: false })
    })
  })

  // real links BETWEEN selected neighbours (cross-links make it feel alive)
  for (const e of graph.edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue
    if (byId.get(e.source)!.spine || byId.get(e.target)!.spine) continue
    edges.push({ a: e.source, b: e.target, provenance: 'confirmed', spine: false })
  }
  // suggested links among selected nodes (dotted)
  for (const e of suggested) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue
    edges.push({ a: e.source, b: e.target, provenance: 'suggested', spine: false })
  }

  saveLayout(layout)
  return { nodes, edges, byId, missing }
}
