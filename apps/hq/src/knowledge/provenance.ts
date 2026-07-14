// WS3 — provenance derivation. The honesty rule: a node is encoded by how REAL
// its backing is, and that encoding must be unmistakable. A simulated node
// rendered as live is a truth violation, so derivation is conservative — when in
// doubt we drop a rank, never claim more than the source supports.

import type { VaultNote } from '../vault/types'

export type Provenance = 'live' | 'partial' | 'simulated' | 'placeholder'
export type EdgeProvenance = 'confirmed' | 'suggested'

// Visual contract (mirrors the spec table). The scene reads these to build
// materials; the legend reads them to explain the encoding.
export const PROVENANCE_META: Record<Provenance, { label: string; hint: string; color: string }> = {
  live: { label: 'Live', hint: 'Solid, luminous — grounded in a hardened source', color: '#4ade80' },
  partial: { label: 'Partial', hint: 'Translucent — real but still functional / in progress', color: '#38bdf8' },
  simulated: { label: 'Simulated', hint: 'Amber wireframe — modelled, not measured', color: '#f59e0b' },
  placeholder: { label: 'Placeholder', hint: 'Hollow — planned, or no source resolved yet', color: '#64748b' },
}

export const EDGE_META: Record<EdgeProvenance, { label: string; hint: string }> = {
  confirmed: { label: 'Confirmed link', hint: 'A real [[wikilink]] in the vault' },
  suggested: { label: 'Suggested link', hint: 'Inferred by shared tags / unlinked mention' },
}

/** Derive node provenance from a resolved vault note. `undefined` note means the
 *  node has NO real source → placeholder (the "missing source" state). */
export function deriveProvenance(note: VaultNote | undefined): Provenance {
  if (!note) return 'placeholder'
  const m = String(note.fm.maturity || '').toLowerCase()
  const s = String(note.fm.status || '').toLowerCase()
  const h = String(note.fm.health || '').toLowerCase()

  // maturity is the strongest signal when present
  if (m === 'hardened' || m === 'proven') return 'live'
  if (m === 'functional') return 'partial'
  if (m === 'drifting') return 'simulated'
  if (m === 'zero') return 'placeholder'

  // health can only ever downgrade a claim
  if (h === 'red') return 'simulated'

  // fall back to living-document status
  if (s === 'living' || s === 'shipped' || s === 'current') return 'live'
  if (s === 'active' || s === 'baseline' || s === 'draft') return 'partial'
  if (s === 'seed') return 'simulated'
  if (s === 'archived' || s === 'superseded' || s === 'frozen') return 'placeholder'

  return 'partial'
}
