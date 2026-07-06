// HQ Vault — link graph: backlinks, outgoing/broken links, graph building and
// a compact force simulation for the graph view (dependency-free).

import type { VaultNote, VaultGraph, GraphNode, GraphEdge } from './types'
import { parseWikiLinks, resolveWikiLink } from './markdown'

export interface LinkIndex {
  outgoing: Record<string, string[]>            // noteId -> resolved target ids (deduped)
  backlinks: Record<string, string[]>            // noteId -> ids of notes linking to it
  broken: Record<string, string[]>               // noteId -> unresolved link targets (raw text)
}

export function buildBacklinks(notes: Record<string, VaultNote>): LinkIndex {
  const outgoing: Record<string, string[]> = {}
  const backlinks: Record<string, string[]> = {}
  const broken: Record<string, string[]> = {}
  for (const id of Object.keys(notes)) { outgoing[id] = []; backlinks[id] = []; broken[id] = [] }

  for (const note of Object.values(notes)) {
    const seen = new Set<string>()
    const missing = new Set<string>()
    for (const link of parseWikiLinks(note.body)) {
      const target = resolveWikiLink(link.target, notes)
      if (target && target !== note.id) seen.add(target)
      else if (!target) missing.add(link.target)
    }
    outgoing[note.id] = [...seen]
    broken[note.id] = [...missing]
    for (const t of seen) backlinks[t].push(note.id)
  }
  return { outgoing, backlinks, broken }
}

/** Unlinked mentions: notes whose body contains the title of `id` as plain text
 *  without a wikilink around it. Cheap heuristic, good enough for a founder vault. */
export function unlinkedMentions(id: string, notes: Record<string, VaultNote>, index: LinkIndex): string[] {
  const title = notes[id]?.fm.title
  if (!title || title.length < 3) return []
  const t = title.toLowerCase()
  const out: string[] = []
  for (const n of Object.values(notes)) {
    if (n.id === id) continue
    if (index.outgoing[n.id]?.includes(id)) continue
    const body = n.body.toLowerCase()
    let idx = body.indexOf(t)
    let found = false
    while (idx >= 0 && !found) {
      // skip occurrences inside [[...]]
      const before = body.lastIndexOf('[[', idx)
      const close = body.lastIndexOf(']]', idx)
      if (before === -1 || close > before) found = true
      else idx = body.indexOf(t, idx + 1)
    }
    if (found) out.push(n.id)
  }
  return out
}

export function buildGraph(notes: Record<string, VaultNote>, index?: LinkIndex): VaultGraph {
  const ix = index || buildBacklinks(notes)
  const edges: GraphEdge[] = []
  for (const [source, targets] of Object.entries(ix.outgoing))
    for (const target of targets) edges.push({ source, target })
  const nodes: GraphNode[] = Object.values(notes).map(n => {
    const deg = (ix.outgoing[n.id]?.length || 0) + (ix.backlinks[n.id]?.length || 0)
    return {
      id: n.id, title: n.fm.title, product: n.fm.product, type: n.fm.type,
      tags: n.fm.tags, linkCount: deg, orphan: deg === 0,
    }
  })
  return { nodes, edges }
}

// ---------- Force simulation ----------

export interface SimNode {
  id: string
  x: number; y: number
  vx: number; vy: number
  r: number                  // visual radius (degree-scaled)
  fixed?: boolean            // pinned while dragging
}

export interface Sim {
  nodes: SimNode[]
  byId: Map<string, SimNode>
  edges: { a: SimNode; b: SimNode }[]
  alpha: number
}

/** Seed positions deterministically on product-clustered rings so the first
 *  paint already looks organized; the simulation then relaxes it. */
export function createSim(graph: VaultGraph, width: number, height: number): Sim {
  const products = [...new Set(graph.nodes.map(n => n.product))]
  const cx = width / 2, cy = height / 2
  const nodes: SimNode[] = graph.nodes.map((n, i) => {
    const pi = products.indexOf(n.product)
    const clusterAngle = (pi / Math.max(1, products.length)) * Math.PI * 2
    const clusterR = Math.min(width, height) * 0.27
    const ccx = cx + Math.cos(clusterAngle) * clusterR
    const ccy = cy + Math.sin(clusterAngle) * clusterR
    const a = (i * 2.399963) % (Math.PI * 2) // golden angle scatter
    const rr = 26 + (i % 7) * 14
    return {
      id: n.id,
      x: ccx + Math.cos(a) * rr, y: ccy + Math.sin(a) * rr,
      vx: 0, vy: 0,
      r: 5 + Math.min(11, Math.sqrt(n.linkCount) * 3.2),
    }
  })
  const byId = new Map(nodes.map(n => [n.id, n]))
  const edges = graph.edges
    .map(e => ({ a: byId.get(e.source)!, b: byId.get(e.target)! }))
    .filter(e => e.a && e.b)
  return { nodes, byId, edges, alpha: 1 }
}

/** One simulation tick. density scales spacing (bigger = airier). */
export function tickSim(sim: Sim, width: number, height: number, density = 1) {
  const { nodes, edges } = sim
  const alpha = sim.alpha
  if (alpha < 0.003) return
  const cx = width / 2, cy = height / 2
  const repulsion = 1450 * density * density
  const springLen = 108 * density
  const springK = 0.045

  // pairwise repulsion — fine for a few hundred nodes
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j]
      let dx = a.x - b.x, dy = a.y - b.y
      let d2 = dx * dx + dy * dy
      if (d2 < 1) { dx = (Math.random() - 0.5); dy = (Math.random() - 0.5); d2 = 1 }
      if (d2 > 340_000) continue
      const f = (repulsion / d2) * alpha
      const d = Math.sqrt(d2)
      const fx = (dx / d) * f, fy = (dy / d) * f
      if (!a.fixed) { a.vx += fx; a.vy += fy }
      if (!b.fixed) { b.vx -= fx; b.vy -= fy }
    }
  }
  // springs
  for (const { a, b } of edges) {
    const dx = b.x - a.x, dy = b.y - a.y
    const d = Math.max(1, Math.sqrt(dx * dx + dy * dy))
    const f = (d - springLen) * springK * alpha
    const fx = (dx / d) * f, fy = (dy / d) * f
    if (!a.fixed) { a.vx += fx; a.vy += fy }
    if (!b.fixed) { b.vx -= fx; b.vy -= fy }
  }
  // gentle centering + integrate
  for (const n of nodes) {
    if (n.fixed) { n.vx = 0; n.vy = 0; continue }
    n.vx += (cx - n.x) * 0.0035 * alpha
    n.vy += (cy - n.y) * 0.0035 * alpha
    n.vx *= 0.82; n.vy *= 0.82
    n.x += n.vx; n.y += n.vy
  }
  sim.alpha = Math.max(0, alpha * 0.985)
}

export const reheat = (sim: Sim, to = 0.6) => { sim.alpha = Math.max(sim.alpha, to) }
