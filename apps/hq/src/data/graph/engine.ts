// Deterministic engine over the seed graph. No AI, all auditable. The LLM pass
// (P5) fills these same shapes behind the interface. Provenance propagates: any
// value resting on a placeholder input is itself no better than placeholder.

import { NODES, EDGES } from './seed'
import type { GraphNode, GraphEdge, Health, Source, OfficeId, Verdict, VerdictKind } from './types'

const byId = new Map(NODES.map(n => [n.id, n]))
export const nodeById = (id: string): GraphNode | undefined => byId.get(id)

// ---- provenance → health (v1: no metric values yet, so health = grounding) --
export function sourceHealth(s: Source): Health {
  switch (s) {
    case 'live': return 'green'
    case 'partial': return 'amber'
    case 'simulated': return 'amber'
    case 'placeholder': return 'blind'
  }
}

export const childrenOf = (id: string): GraphNode[] => NODES.filter(n => n.parent === id)
export const ownedBy = (office: OfficeId): GraphNode[] => NODES.filter(n => n.owner === office)

// rollup: a parent's health folds its children; flags the weakest child.
export function rollupHealth(node: GraphNode): { health: Health; weakest?: string } {
  const kids = childrenOf(node.id)
  if (kids.length === 0) return { health: sourceHealth(node.status) }
  const rank: Record<Health, number> = { green: 0, amber: 1, blind: 2, red: 3 }
  let worst: Health = sourceHealth(node.status)
  let weakest: string | undefined
  for (const k of kids) {
    const h = rollupHealth(k).health
    if (rank[h] >= rank[worst]) { worst = h; weakest = k.label }
  }
  return { health: worst, weakest }
}

// ---- coverage: the honest instrumentation scoreboard -----------------------
export interface Coverage { live: number; partial: number; simulated: number; placeholder: number; total: number; pct: number }
export function coverage(nodes: GraphNode[] = NODES): Coverage {
  const m = nodes.filter(n => n.metric)
  const c: Coverage = { live: 0, partial: 0, simulated: 0, placeholder: 0, total: m.length, pct: 0 }
  for (const n of m) c[n.status] += 1
  c.pct = c.total ? Math.round(((c.live + c.partial) / c.total) * 100) : 0
  return c
}

// ---- weakest lever: the least-grounded input to W2F (deterministic) --------
export function weakestLever(): GraphNode | null {
  const levers = NODES.filter(n => n.kind === 'lever')
  const rank: Record<Source, number> = { live: 0, partial: 1, simulated: 1, placeholder: 2 }
  const weight = (id: string) => EDGES.find(e => e.kind === 'FEEDS' && e.from === id)?.weight ?? 0
  return [...levers].sort((a, b) =>
    (rank[b.status] - rank[a.status]) || (weight(b.id) - weight(a.id)))[0] ?? null
}

// ---- verdict derivation (the add / keep / polish / cut table) --------------
export function deriveVerdict(n: GraphNode): VerdictKind {
  if (n.role === 'guardrail') return n.status === 'placeholder' ? 'INSTRUMENT' : 'FIX'
  if (n.status === 'placeholder') return 'INSTRUMENT'   // no telemetry -> wire it
  if (n.status === 'simulated') return 'MONETIZE'
  if (n.status === 'partial') return 'POLISH'
  return 'RETAIN'                                        // live & working
}

// which lever/stage a node ladders to (its teeth). Falls back to the North Star.
export function laddersTo(n: GraphNode): string {
  if (n.owner === 'treasury') return 'stage.pay'
  const lever = n.levers?.[0]
  if (lever) return 'lever.' + lever
  if (n.kind === 'valueStage' || n.kind === 'lever') return 'ns.w2f'
  return 'ns.w2f'
}

// strategic teeth: reject any verdict lacking a LADDERS_TO to a real node.
export function validateVerdict(v: Verdict): boolean {
  return !!v.laddersTo && byId.has(v.laddersTo)
}

// Build the verdict queue for an office from its owned metric-bearing nodes.
export function verdictsFor(office: OfficeId): Verdict[] {
  return ownedBy(office).filter(n => n.metric).map((n, i): Verdict => {
    const kind = deriveVerdict(n)
    return {
      id: `v.${office}.${i}`, kind, targetNode: n.id, laddersTo: laddersTo(n),
      by: office, status: 'proposed',
      rationale: reason(kind, n),
    }
  }).filter(validateVerdict)
}
function reason(kind: VerdictKind, n: GraphNode): string {
  switch (kind) {
    case 'INSTRUMENT': return `${n.label} is blind — wire its event before we can optimise it.`
    case 'FIX': return `${n.label} guardrail needs attention.`
    case 'POLISH': return `${n.label} has a partial signal — tighten it toward live.`
    case 'MONETIZE': return `${n.label} is the money surface — model the conversion.`
    default: return `${n.label} is working — protect it.`
  }
}

// ---- spine blast-radius: a red guardrail flags downstream stages -----------
export function blastRadius(signalId: string): string[] {
  const sig = byId.get(signalId)
  if (!sig) return []
  // find the stage this signal's surface sits under (walk up to an owned stage)
  let cur: GraphNode | undefined = sig
  let stage: string | undefined
  while (cur) {
    const up: GraphNode | undefined = cur.parent ? byId.get(cur.parent) : undefined
    if (up?.kind === 'valueStage') { stage = up.id; break }
    cur = up
  }
  const anchor = stage ?? 'stage.learn'
  const out: string[] = []
  let node = anchor
  // follow CONVERTS_TO forward
  for (let i = 0; i < NODES.length; i++) {
    const next = EDGES.find(e => e.kind === 'CONVERTS_TO' && e.from === node)
    if (!next) break
    out.push(next.to); node = next.to
  }
  return out
}

// ---- consults nervous system: open handoffs across office boundaries -------
export function pendingConsults(): GraphEdge[] {
  return EDGES.filter(e => e.kind === 'CONSULTS' && e.status !== 'answered')
}
export function allConsults(): GraphEdge[] {
  return EDGES.filter(e => e.kind === 'CONSULTS')
}
