// The domain reports — Operations, Product, Growth, Health, Risk, People.
// Deterministic compositions over the graph + engine. Real structural data
// (coverage, verdicts, rosters, provenance) is charted; blind metrics render as
// "—" + badge. Nothing fabricated. All present-able + exportable.

import { ownedBy, coverage, verdictsFor, nodeById, rollupHealth } from '../graph/engine'
import { officeById } from '../graph/agents'
import { AGENTS, officeOf, OFFICE_KEYS, OFFICE_META } from '../agents'
import type { Report, Section } from './types'
import type { OfficeId, GraphNode } from '../graph/types'

function worst(nodes: GraphNode[]) {
  const rank = { green: 0, amber: 1, blind: 2, red: 3 } as const
  let w: keyof typeof rank = 'green'
  for (const n of nodes) { const h = rollupHealth(n).health; if (rank[h] >= rank[w]) w = h }
  return nodes.length ? w : 'blind'
}
function verdictTable(office: OfficeId, title: string): Section {
  const vs = verdictsFor(office).slice(0, 8)
  return {
    id: `${office}-verdicts`, kind: 'table', source: 'partial', title,
    head: ['Surface', 'Verdict', 'Ladders to'],
    rows: vs.map(v => [nodeById(v.targetNode)?.label ?? '', v.kind, nodeById(v.laddersTo)?.label ?? '']),
  }
}
function leverBars(office: OfficeId): Section {
  const owned = ownedBy(office).filter(n => n.metric && n.levers?.length)
  const counts: Record<string, number> = {}
  for (const n of owned) for (const l of n.levers!) counts[l] = (counts[l] ?? 0) + 1
  const color: Record<string, string> = { efficiency: 'var(--acc-text)', depth: 'var(--mag)', frequency: 'var(--ok)', breadth: 'var(--warn)' }
  return {
    id: `${office}-levers`, kind: 'bars', source: 'live', title: 'Owned surfaces by lever', unit: 'count',
    items: Object.entries(counts).map(([l, v]) => ({ label: l, value: v, color: color[l] ?? 'var(--acc)' })),
  }
}
function wrap(id: string, title: string, subtitle: string, owner: OfficeId | 'company', cadence: Report['cadence'], sections: Section[]): Report {
  return { id, title, subtitle, owner, cadence, audience: 'Founder', sections, livePct: coverage(ownedBy(owner === 'company' ? 'operations' : owner)).pct }
}

export function buildOperationsReport(): Report {
  const o = officeById('operations')
  return wrap('ops', 'Operations Report', `${o.chief} · ${o.slice}`, 'operations', 'weekly', [
    { id: 'h', kind: 'headline', source: 'partial', label: 'Retention core', tone: worst(ownedBy('operations')) === 'red' ? 'bad' : 'ok', text: 'CURR + the two hooks across the value stages.', sub: 'Live values land from curr_states() + w2f_weekly().' },
    { id: 'curr', kind: 'kpiRow', source: 'partial', items: [
      { label: 'New', value: '—', sub: 'joined ≤7d' }, { label: 'Current', value: '—', sub: 'both hooks', tone: 'ok' },
      { label: 'At-risk', value: '—', sub: 'one cold', tone: 'warn' }, { label: 'Dormant', value: '—', sub: 'both cold' },
    ] },
    leverBars('operations'),
    verdictTable('operations', 'Surface verdicts — invest / polish / cut'),
    { id: 'f', kind: 'text', source: 'partial', text: 'Retention is the North-Star engine. Verdicts are derived deterministically from each surface’s weight and health; every one ladders to a lever or stage.' },
  ])
}

export function buildProductReport(): Report {
  return wrap('product', 'Product Report', 'CPO (under COO) · adoption, build & ship', 'operations', 'monthly', [
    { id: 'h', kind: 'headline', source: 'partial', label: 'Product', tone: 'warn', text: 'Activation, the build→ship funnel, and world engagement.', sub: 'Feature-view telemetry is the gap; wire hq_event to light it up.' },
    { id: 'k', kind: 'kpiRow', source: 'partial', items: [
      { label: 'Activation', value: '—', sub: 'signup → active' }, { label: 'Builds published', value: '—' },
      { label: 'Shares', value: '—' }, { label: 'World rings', value: '—', sub: '6 worlds live', tone: 'ok' },
    ] },
    verdictTable('operations', 'Product surface verdicts'),
    { id: 'f', kind: 'text', source: 'placeholder', text: 'Build/ship lifecycle events (build_started/completed/published/shared, install_attributed) are the missing spine — see the CTO backlog.' },
  ])
}

export function buildGrowthReport(): Report {
  const breadth = ownedBy('operations').filter(n => n.levers?.includes('breadth'))
  return wrap('growth', 'Growth Report', 'VP Growth · acquisition & virality', 'operations', 'weekly', [
    { id: 'h', kind: 'headline', source: 'partial', label: 'Breadth', tone: 'warn', text: 'The circle-invite k-factor is your cheapest growth.', sub: 'k_factor() reads circle_invites — flips live once the migration runs.' },
    { id: 'k', kind: 'kpiRow', source: 'partial', items: [
      { label: 'k-factor', value: '—', sub: 'invites → joins' }, { label: 'New / wk', value: '—' },
      { label: 'Waitlist', value: '—', sub: 'landing' }, { label: 'Share loop', value: '—' },
    ] },
    { id: 'b', kind: 'bars', source: 'live', title: 'Acquisition surfaces (breadth)', unit: 'count',
      items: [{ label: 'instrumented', value: breadth.filter(n => n.status !== 'placeholder').length, color: 'var(--ok)' }, { label: 'blind', value: breadth.filter(n => n.status === 'placeholder').length, color: 'var(--tx3)' }] },
    { id: 'f', kind: 'text', source: 'partial', text: 'CAC-per-payer is the acquisition trap: cheap installs still cost a fortune per payer at thin conversion (see Treasury). Fix conversion before ad spend.' },
  ])
}

export function buildHealthReport(): Report {
  const cov = coverage()
  const blind = ownedBy('technology').filter(n => n.status === 'placeholder' && n.metric)
  const signals = ownedBy('technology').filter(n => n.role === 'guardrail')
  return wrap('health', 'Health Check', 'CTO · instrumentation, signals & reliability', 'technology', 'weekly', [
    { id: 'h', kind: 'headline', source: 'partial', label: 'Coverage', tone: cov.pct >= 80 ? 'ok' : 'warn', text: `Instrumentation coverage ${cov.pct}% → 80% target.`, sub: `${cov.placeholder} surfaces blind — that is the build backlog, not a failure.` },
    { id: 'g', kind: 'gauge', source: 'live', title: 'Coverage → target', value: cov.pct, target: 80, unit: '%' },
    { id: 'b', kind: 'bars', source: 'live', title: 'Provenance breakdown', unit: 'count', items: [
      { label: 'live', value: cov.live, color: 'var(--ok)' }, { label: 'partial', value: cov.partial, color: 'var(--warn)' },
      { label: 'simulated', value: cov.simulated, color: 'var(--acc)' }, { label: 'blind', value: cov.placeholder, color: 'var(--tx3)' },
    ] },
    { id: 't', kind: 'table', source: 'partial', title: 'Guardrail signals', head: ['Signal', 'Status'], rows: signals.map(s => [s.label, s.status === 'placeholder' ? 'blind' : s.status]) },
    { id: 'bk', kind: 'table', source: 'live', title: 'The blind backlog (INSTRUMENT)', head: ['Surface', 'Wire event'], rows: blind.slice(0, 10).map(n => [n.label, (n.emits?.join(', ') || 'feature_view') + ' → hq_event']) },
  ])
}

export function buildRiskReport(): Report {
  const items = ownedBy('legal')
  return wrap('risk', 'Risk & Compliance', 'GC · trust, holds, consent & IP', 'legal', 'monthly', [
    { id: 'h', kind: 'headline', source: 'placeholder', label: 'Trust', tone: 'warn', text: 'Open holds, consent coverage, UGC and IP.', sub: 'A HOLD freezes revenue — surfaced to Treasury as revenue-at-risk.' },
    { id: 'k', kind: 'kpiRow', source: 'placeholder', items: [
      { label: 'Open holds', value: '—', sub: 'target 0', tone: 'ok' }, { label: 'Consent coverage', value: '—', sub: '%' },
      { label: 'UGC flags', value: '—' }, { label: 'IP assets', value: '—' },
    ] },
    { id: 't', kind: 'table', source: 'partial', title: 'Register', head: ['Item', 'Kind', 'Status'], rows: items.map(n => [n.label, n.kind, n.status === 'placeholder' ? 'blind' : n.status]) },
    { id: 'f', kind: 'text', source: 'placeholder', text: 'Tables ip_asset · risk_hold · ugc_flag are the P2 net-new work; consent scaffold (guardianships + parentGate) is partial today.' },
  ])
}

export function buildPeopleReport(): Report {
  const cost: Record<string, number> = { sonnet: 0.35, haiku: 0.06, det: 0 }
  const perOffice = OFFICE_KEYS.map(o => ({ o, list: AGENTS.filter(a => officeOf(a) === o) })).filter(x => x.list.length)
  const total = AGENTS.length
  const est = AGENTS.reduce((s, a) => s + (cost[a.model] ?? 0), 0)
  return wrap('people', 'Agent Workforce', 'Guildmaster · roster, ROI & token spend', 'roster', 'monthly', [
    { id: 'h', kind: 'headline', source: 'partial', label: 'The Guild', tone: 'ok', text: `${total} agents across ${perOffice.length} offices, ~$${est.toFixed(2)}/mo.`, sub: 'ROI is null until agent_sla · agent_cost track real tokens.' },
    { id: 'k', kind: 'kpiRow', source: 'partial', items: [
      { label: 'Agents', value: String(total), tone: 'ok' }, { label: 'Est. OS cost', value: `$${est.toFixed(2)}/mo` },
      { label: 'Lowest-ROI', value: '—' }, { label: 'SLA attainment', value: '—' },
    ] },
    { id: 'b', kind: 'bars', source: 'live', title: 'Agents by office', unit: 'count',
      items: perOffice.map(({ o, list }) => ({ label: OFFICE_META[o].label.split(' ·')[0], value: list.length, color: OFFICE_META[o].accent })) },
    { id: 't', kind: 'table', source: 'partial', title: 'Roster cost by office', head: ['Office', 'Agents', 'Est / mo'], rows: perOffice.map(({ o, list }) => [OFFICE_META[o].label.split(' ·')[0], list.length, `$${list.reduce((s, a) => s + (cost[a.model] ?? 0), 0).toFixed(2)}`]) },
  ])
}
