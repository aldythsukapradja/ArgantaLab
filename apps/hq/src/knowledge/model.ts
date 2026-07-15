// WS3 — the cortex model. Turns the REAL vault into a wrinkled two-hemisphere
// brain: every note is a neuron placed in one of the 7 reactor-spine regions
// (Command Core … Sense) on the cortical surface; real wikilinks become curved
// axons; and Command Core is wired as the central hub (a thalamic radiation to
// every region) so it never reads as unlinked.

import type { VaultNote } from '../vault/types'
import { buildBacklinks, buildGraph, buildSuggestedEdges } from '../vault/graph'
import { deriveOntologyType, type OntologyType } from './ontology'
import { deriveProvenance, type Provenance, type EdgeProvenance } from './provenance'
import { regionOf, hemisphereOf, triadOf, regionPoint, REGIONS, type RegionId, type Triad, type Hemisphere } from './brain'

export interface KNode {
  id: string
  noteId: string | null
  label: string
  ontology: OntologyType
  provenance: Provenance
  region: RegionId
  triad: Triad
  hemisphere: Hemisphere
  hero: boolean              // brightest representative of its region (gets a label)
  pos: [number, number, number]
  r: number
  summary: string
  degree: number
}

export interface KEdge {
  a: string
  b: string
  provenance: EdgeProvenance
  hub: boolean               // Command-Core radiation (brighter, always drawn)
}

export interface KModel {
  nodes: KNode[]
  edges: KEdge[]
  byId: Map<string, KNode>
  index: Map<string, number>
  commandId: string | null   // the hub node
  regionCounts: Record<RegionId, number>
  triadCounts: Record<Triad, number>
  hemiCounts: { left: number; right: number }
}

const LAYOUT_KEY = 'knowledge_brain_v6'

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
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(map)) } catch { /* quota */ }
}

export function buildKnowledgeModel(notes: Record<string, VaultNote>): KModel {
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
  const regionCounts: Record<RegionId, number> = { command: 0, think: 0, know: 0, orchestrate: 0, act: 0, experience: 0, sense: 0 }
  const triadCounts: Record<Triad, number> = { think: 0, know: 0, do: 0 }
  const hemiCounts = { left: 0, right: 0 }

  Object.keys(notes).forEach((id) => {
    try {
      const note = notes[id]
      if (!note || !note.fm) return
      const ontology = deriveOntologyType(note)
      const region = regionOf(ontology)
      const triad = triadOf(region)
      const hemisphere = region === 'command' ? 'mid' : hemisphereOf(ontology)
      const pos = persisted[id] || regionPoint(id, region, hemisphere)
      layout[id] = pos
      const deg = degreeOf(id)
      const kn: KNode = {
        id, noteId: id, label: note.fm.title || id, ontology,
        provenance: deriveProvenance(note), region, triad, hemisphere, hero: false, pos,
        // small neurons — points, not balloons. Gentle degree scaling only.
        r: 0.10 + Math.min(0.10, Math.sqrt(deg) * 0.028),
        summary: firstParagraph(note.body), degree: deg,
      }
      index.set(id, nodes.length)
      nodes.push(kn); byId.set(id, kn)
      regionCounts[region]++; triadCounts[triad]++
      if (hemisphere === 'left') hemiCounts.left++; else if (hemisphere === 'right') hemiCounts.right++
    } catch { /* skip malformed note */ }
  })

  // hero per region = highest-degree node → gets the floating region label + size
  const heroByRegion = new Map<RegionId, KNode>()
  for (const n of nodes) {
    const cur = heroByRegion.get(n.region)
    if (!cur || n.degree > cur.degree) heroByRegion.set(n.region, n)
  }
  // heroes read as heroes via their label + ring, not size — keep them small
  for (const h of heroByRegion.values()) { h.hero = true; h.r = Math.max(h.r, 0.2) }
  const commandHero = heroByRegion.get('command') || null
  const commandId = commandHero?.id || null

  // real wikilink axons
  const edges: KEdge[] = []
  const seen = new Set<string>()
  const push = (a: string, b: string, provenance: EdgeProvenance, hub = false) => {
    if (a === b || !byId.get(a) || !byId.get(b)) return
    const key = a < b ? a + '|' + b : b + '|' + a
    if (seen.has(key)) return
    seen.add(key)
    edges.push({ a, b, provenance, hub })
  }
  for (const e of graph.edges) push(e.source, e.target, 'confirmed')
  for (const e of suggested) push(e.source, e.target, 'suggested')

  // Command-Core radiation: link every region's hero to the command hub, so
  // Command Core is visibly the center everything reports to (thalamic relay).
  if (commandId) {
    for (const h of heroByRegion.values()) if (h.id !== commandId) push(commandId, h.id, 'confirmed', true)
    // and pull a few high-degree nodes per region toward command for density
    const byRegion = new Map<RegionId, KNode[]>()
    for (const n of nodes) { const a = byRegion.get(n.region) || []; a.push(n); byRegion.set(n.region, a) }
    for (const [rid, list] of byRegion) {
      if (rid === 'command') continue
      list.sort((a, b) => b.degree - a.degree)
      for (const n of list.slice(0, 2)) push(commandId, n.id, 'confirmed', true)
    }
  }

  saveLayout(layout)
  return { nodes, edges, byId, index, commandId, regionCounts, triadCounts, hemiCounts }
}

export { REGIONS }
