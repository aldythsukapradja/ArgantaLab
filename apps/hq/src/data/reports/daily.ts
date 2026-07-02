// The on-demand Daily C-Level Briefing — composed from the six office headlines.
// Deterministic: real facts + fixed phrasing. Same chief sentence that feeds the
// Bridge roll-up (one source). Values are "—" until the RPCs wire (honest).

import { OFFICE_ORDER, officeById, OFFICE_CHAT } from '../graph/agents'
import {
  ownedBy, rollupHealth, verdictsFor, coverage, weakestLever, allConsults, nodeById,
} from '../graph/engine'
import { NORTHSTAR } from '../graph/seed'
import type { OfficeId, Health, GraphNode } from '../graph/types'
import type { Report, Section, ChiefLine, ConsultItem } from './types'

function worst(nodes: GraphNode[]): Health {
  const rank = { green: 0, amber: 1, blind: 2, red: 3 } as const
  let w: keyof typeof rank = 'green'
  for (const n of nodes) { const h = rollupHealth(n).health; if (rank[h] >= rank[w]) w = h }
  return nodes.length ? w : 'blind'
}

// One chief's north-star-laddered line.
export function officeHeadline(office: OfficeId): ChiefLine {
  const o = officeById(office)
  const owned = ownedBy(office).filter(n => n.metric)
  const sla = o.sla[0]
  const v = verdictsFor(office)[0]
  return {
    office, chief: o.chief,
    headline: o.slice,
    metricLabel: sla.label,
    value: '—',
    badge: sla.source,
    action: v ? `${v.kind} · ${nodeById(v.targetNode)?.label ?? ''}` : 'Hold — steady',
    laddersTo: v ? (nodeById(v.laddersTo)?.label ?? 'W2F') : 'Weekly Two-Hook Families',
    health: worst(owned),
  }
}

const PRIORITY: Record<string, number> = { legal: 0, bridge: 1, technology: 2, operations: 3, treasury: 4, roster: 5 }

export function buildDailyBriefing(): Report {
  const cov = coverage()
  const lines = OFFICE_ORDER.map(officeHeadline)
  const reds = lines.filter(l => l.health === 'red').length
  const orgHealth: Health = lines.some(l => l.health === 'red') ? 'red'
    : lines.some(l => l.health === 'amber') ? 'amber'
    : lines.every(l => l.health === 'blind') ? 'blind' : 'green'

  // "The one thing" — deterministic: weakest lever feeding the North Star.
  const weak = weakestLever()

  // Cross-office consults, priority-ordered (Trust > NorthStar > Retention > Money).
  const consultItems: ConsultItem[] = allConsults()
    .filter(c => c.status !== 'answered')
    .map(c => ({
      id: c.id, from: c.from as OfficeId, to: c.to as OfficeId,
      note: c.note ?? '', status: c.status ?? 'open',
      priority: PRIORITY[c.from as string] ?? 9,
    }))
    .sort((a, b) => a.priority - b.priority)

  const sections: Section[] = [
    {
      id: 'cover', kind: 'kpiRow', source: NORTHSTAR.metric!.source,
      items: [
        { label: 'North Star · W2F', value: '—', sub: 'weekly two-hook families', tone: undefined },
        { label: 'Org health', value: orgHealth === 'green' ? 'Healthy' : orgHealth === 'amber' ? 'Watch' : orgHealth === 'red' ? 'Red' : 'Blind', tone: orgHealth === 'green' ? 'ok' : orgHealth === 'red' ? 'bad' : 'warn' },
        { label: 'Coverage', value: `${cov.pct}%`, sub: `→ 80% · ${cov.placeholder} blind`, tone: cov.pct >= 80 ? 'ok' : 'warn' },
        { label: 'Offices in the red', value: String(reds), sub: `${OFFICE_ORDER.length} offices`, tone: reds > 0 ? 'bad' : 'ok' },
      ],
    },
    {
      id: 'onething', kind: 'headline', source: weak?.status ?? 'placeholder',
      label: 'The one thing today',
      text: weak ? `Strengthen ${weak.label}` : 'Instrument the graph — most surfaces are blind',
      sub: weak ? `Weakest input to the North Star · owned by ${officeById(weak.owner ?? 'operations').office}. ${weak.note ?? ''}` : 'Wire the missing events so the signals can compute.',
      tone: 'warn',
    },
    { id: 'chiefs', kind: 'chiefLines', source: 'partial', title: 'The six chiefs', lines },
    { id: 'consults', kind: 'consults', source: 'partial', title: 'Consults & what needs you', items: consultItems },
    {
      id: 'footer', kind: 'text', source: cov.pct >= 50 ? 'partial' : 'placeholder',
      text: `${cov.pct}% of the graph is grounded in real data; the rest is the instrumentation backlog. Ask any chief to go deeper. Deterministic brief — values populate when the RPCs wire.`,
    },
  ]

  return {
    id: 'daily-brief', title: 'Daily C-Level Briefing',
    subtitle: OFFICE_CHAT.bridge.brief,
    owner: 'company', cadence: 'daily', audience: 'Founder',
    sections, livePct: cov.pct,
  }
}
