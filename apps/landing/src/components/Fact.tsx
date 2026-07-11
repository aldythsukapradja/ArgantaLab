// ── Fact — a number with a PROVENANCE chip. The HQ knowledge graph's honesty rule
// made visual: every displayed value declares whether it is measured, modeled or
// pending. This is the differentiator, not a disclaimer — investors trust a deck
// that marks its own uncertainty. Never render a modeled number as if it were live.
import type { ReactNode } from 'react'

export type Provenance = 'live' | 'modeled' | 'pending'

const CHIP: Record<Provenance, { dot: string; label: string; cls: string }> = {
  live:    { dot: '●', label: 'live',    cls: 'fact-live' },
  modeled: { dot: '◐', label: 'modeled', cls: 'fact-modeled' },
  pending: { dot: '○', label: 'pending', cls: 'fact-pending' },
}

// A metric with value + provenance + one-line definition (title on hover/tap).
export function Fact({ label, value, prov, what, bench }: {
  label: string; value: string | null; prov?: Provenance; what?: string; bench?: string
}) {
  // null value → pending, regardless of declared prov (honest fallback)
  const p = value == null ? 'pending' : (prov ?? 'live')
  const c = CHIP[p]
  return (
    <div className="fact" title={what}>
      <span className="fact-l">{label}</span>
      <b className={`fact-v${value == null ? ' soon' : ''}`}>{value ?? 'live soon'}</b>
      {bench && <span className="fact-bench">{bench}</span>}
      <span className={`fact-chip ${c.cls}`}><i>{c.dot}</i>{c.label}</span>
    </div>
  )
}

// The legend that teaches the three chips (deck cover slide).
export function ProvLegend({ children }: { children?: ReactNode }) {
  return (
    <div className="prov-legend">
      {(['live', 'modeled', 'pending'] as Provenance[]).map(p => {
        const c = CHIP[p]
        return <span key={p} className={`fact-chip ${c.cls}`}><i>{c.dot}</i>{c.label}</span>
      })}
      {children}
    </div>
  )
}
