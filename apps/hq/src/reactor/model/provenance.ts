import type { Provenance, ReactorNode } from './layers'

// ─────────────────────────────────────────────────────────────────────────
// Provenance-resolution seam (O6).
//
// Node specs carry an authored *base* provenance (conservative — see layers.ts).
// At runtime a node may be upgradeable if a real system is actually reachable
// (e.g. Vault HQ → 'live' once notes are loaded, Supabase → 'live' when the
// client is configured). This module is the ONE place that maps
// (node, availability snapshot) → the provenance to display.
//
// Opus defines the interface + resolver; the Sonnet stream fills PROVENANCE_RULES
// with real checks. A node with no rule keeps its authored provenance, and a
// rule may only ever be as generous as the evidence — never fabricate 'live'.
// ─────────────────────────────────────────────────────────────────────────

export interface ProvenanceContext {
  /** Supabase client configured (VITE keys present). */
  cloudEnabled: boolean
  /** Vault notes currently loaded (hq_vault). */
  vaultNoteCount: number
  /** The five product front-ends that exist in the repo today. */
  liveProducts: readonly string[]
}

export const DEFAULT_PROVENANCE_CONTEXT: ProvenanceContext = {
  cloudEnabled: false,
  vaultNoteCount: 0,
  liveProducts: ['ArgantaLab', 'KinetikCircle', 'LashiraBloom', 'Circle HQ', 'Landing'],
}

/** A per-node upgrade rule. Return null to fall back to the authored value. */
export type ProvenanceRule = (ctx: ProvenanceContext) => Provenance | null

// Keyed by node.name. The Sonnet stream (S1) fills these with real checks, e.g.
//   'Vault HQ':  ctx => ctx.vaultNoteCount > 0 ? 'live' : 'partial',
//   'Supabase':  ctx => ctx.cloudEnabled ? 'live' : 'partial',
export const PROVENANCE_RULES: Record<string, ProvenanceRule> = {}

export function resolveProvenance(
  node: ReactorNode,
  ctx: ProvenanceContext = DEFAULT_PROVENANCE_CONTEXT,
): Provenance {
  const rule = PROVENANCE_RULES[node.name]
  return rule?.(ctx) ?? node.provenance
}
