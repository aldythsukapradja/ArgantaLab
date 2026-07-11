// HQ Vault graph v3 — grouping dimensions, colours, and radial-cluster layout.
//
// Three orthogonal ways to colour/group the same graph:
//   • product — the horizontal cut (what am I building). Fully attributed today.
//   • layer   — the vertical cut (where in the stack). Ordered L0→L7, so it gets a
//               sequential gradient; only meaningful once build-graph-nodes.mjs
//               backfills `layer` onto every node (M5).
//   • type    — note kind.
// The engine is colour/group-agnostic: the component hands it a number tint and a
// group key per node via these helpers.

import type { GraphNode, Product } from '../types'
import { PRODUCT_COLOR } from '../types'

export type ColorBy = 'product' | 'layer' | 'type'

export const LAYER_ORDER = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'] as const
export type Layer = typeof LAYER_ORDER[number]

export const LAYER_LABEL: Record<Layer, string> = {
  L0: 'Toolchain', L1: 'Data', L2: 'Engine', L3: 'App / UI',
  L4: 'Assets', L5: 'Agentic', L6: 'Knowledge', L7: 'Distribution',
}

// Ordered bottom→top gradient (deep indigo foundation → warm distribution).
// This is layer's visual superpower: product can only ever be categorical.
export const LAYER_COLOR: Record<Layer, string> = {
  L0: '#4338ca', // indigo — toolchain floor
  L1: '#0ea5e9', // sky — data
  L2: '#06b6d4', // cyan — engine/spine (the moat)
  L3: '#10b981', // emerald — app/ui
  L4: '#84cc16', // lime — assets
  L5: '#eab308', // amber — agentic
  L6: '#f97316', // orange — knowledge base
  L7: '#ef4444', // red — distribution (the gap)
}

const TYPE_COLOR: Record<string, string> = {
  note: '#8b7cf6', strategy: '#f0a24b', decision: '#f472b6', prompt: '#38bdf8',
  research: '#94a3b8', plan: '#4ade80', spec: '#22d3ee',
  moc: '#a78bfa', layer: '#f59e0b', journey: '#34d399', lesson: '#fbbf24',
  atlas: '#60a5fa', map: '#2dd4bf', method: '#c084fc',
}

const FALLBACK = '#94a3b8'

/** #rrggbb → 0xRRGGBB for PIXI tint. */
export function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16) || 0x94a3b8
}

/** The group key a node belongs to under the current dimension. */
export function groupOf(n: GraphNode, by: ColorBy): string {
  if (by === 'product') return n.product
  if (by === 'type') return n.type
  return (n.layer && (LAYER_ORDER as readonly string[]).includes(n.layer)) ? n.layer : 'L?'
}

/** Hex colour for a node under the current dimension. */
export function colorOf(n: GraphNode, by: ColorBy): string {
  if (by === 'product') return PRODUCT_COLOR[n.product as Product] ?? FALLBACK
  if (by === 'type') return TYPE_COLOR[n.type] ?? FALLBACK
  return (n.layer && LAYER_COLOR[n.layer as Layer]) || '#64748b'
}

/** Human label for a group key (layers get their name, others pass through). */
export function groupLabel(key: string, by: ColorBy): string {
  if (by === 'layer') return LAYER_LABEL[key as Layer] ? `${key} · ${LAYER_LABEL[key as Layer]}` : 'Unassigned'
  return key
}

/** Stable, sorted list of the groups present (layers keep L0→L7 order). */
export function groupsPresent(nodes: GraphNode[], by: ColorBy): string[] {
  const set = new Set(nodes.map(n => groupOf(n, by)))
  if (by === 'layer') return [...LAYER_ORDER, 'L?'].filter(g => set.has(g))
  return [...set].sort()
}

/** Radial cluster centroids: groups placed evenly on a ring around the origin.
 *  One group (or ungrouped) collapses to the centre → acts as gentle centering. */
export function ringCentroids(groups: string[], radius: number): Map<string, { x: number; y: number }> {
  const m = new Map<string, { x: number; y: number }>()
  const k = groups.length
  if (k <= 1) { if (k === 1) m.set(groups[0], { x: 0, y: 0 }); return m }
  groups.forEach((g, i) => {
    const a = (i / k) * Math.PI * 2 - Math.PI / 2
    m.set(g, { x: Math.cos(a) * radius, y: Math.sin(a) * radius })
  })
  return m
}

/** Per-node target buffer (tx,ty interleaved by node index) for the worker. */
export function buildTargets(nodes: GraphNode[], by: ColorBy, radius: number): Float32Array {
  const groups = groupsPresent(nodes, by)
  const cen = ringCentroids(groups, radius)
  const out = new Float32Array(nodes.length * 2)
  for (let i = 0; i < nodes.length; i++) {
    const c = cen.get(groupOf(nodes[i], by)) ?? { x: 0, y: 0 }
    out[i * 2] = c.x; out[i * 2 + 1] = c.y
  }
  return out
}
