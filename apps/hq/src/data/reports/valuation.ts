// Valuation report (CFO · The Actuary) — composes the six-method engine into a
// present-able, exportable report. Deterministic; every section carries the
// provenance it actually earns. Reuses the same numbers as the interactive
// panel — one engine, one truth.
import { valuationEstimate, valuationLevers } from '../graph/valuation'
import type { Report, Section } from './types'
import type { Source } from '../graph/types'

const M = (n: number) => '$' + n.toFixed(n < 1 ? 2 : 2) + 'M'

export function buildValuationReport(): Report {
  const e = valuationEstimate('current')
  const levers = valuationLevers()

  const sections: Section[] = [
    {
      id: 'verdict', kind: 'headline', source: e.synthesized.provenance,
      label: 'Recommended pre-money range', tone: 'mut',
      text: `${M(e.recommended.low)} – ${M(e.recommended.high)}`,
      sub: `${e.synthesized.weightsMode} weighting · ${e.driverOfChange}`,
    },
    {
      id: 'kpis', kind: 'kpiRow', source: e.synthesized.provenance,
      items: [
        { label: 'Recommended low', value: M(e.recommended.low) },
        { label: 'Recommended high', value: M(e.recommended.high) },
        { label: 'Methods', value: String(e.methods.length) },
        { label: 'Top lever', value: levers[0] ? '+' + M(levers[0].estImpactUsdM) : '—', tone: 'ok' },
      ],
    },
    {
      id: 'methods', kind: 'table', source: 'partial', title: 'Six methods (USD millions, pre-money)', strongLast: true,
      head: ['Method', 'Low', 'High', 'Provenance'],
      rows: [
        ...e.methods.map(m => [m.label, M(m.low), M(m.high), m.provenance] as (string | number)[]),
        ['Synthesized', M(e.recommended.low), M(e.recommended.high), e.synthesized.provenance],
      ],
    },
    {
      id: 'bars', kind: 'bars', source: 'simulated', title: 'Method high-ends', unit: 'money',
      items: e.methods.map(m => ({ label: m.label, value: m.high * 1e6, color: barColor(m.provenance) })),
    },
    {
      id: 'levers', kind: 'table', source: 'partial', title: 'What would move it — ranked',
      head: ['Lever', 'Est. impact', 'Unlock'],
      rows: levers.map(l => [l.action, '+' + M(l.estImpactUsdM), l.unlock] as (string | number)[]),
    },
    {
      id: 'foot', kind: 'text', source: e.synthesized.provenance,
      text: 'Computed live off the ontology graph + founder-set constants — no method calls an LLM, none silently upgraded. The range re-rates when stage.pay flips to live or coverage rises; the synthesis weights invert at first real payers. Words before numbers.',
    },
  ]

  return {
    id: 'valuation', title: 'Valuation Report', subtitle: 'CFO · The Actuary — six-method pre-money range',
    owner: 'treasury', cadence: 'monthly', audience: 'Founder / Board',
    sections, livePct: 0,
  }
}

function barColor(p: Source): string {
  return p === 'partial' ? 'var(--warn)' : p === 'simulated' ? 'var(--acc-text)' : p === 'live' ? 'var(--ok)' : 'var(--tx3)'
}
