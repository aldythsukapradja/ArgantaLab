// Board deck + Investor update — cross-office compositions (the CEO's roll-up as
// a present-able deck). Deterministic; reuses the office headlines, the Treasury
// model, and the graph. Provenance travels into every slide.

import { officeHeadline } from './daily'
import { OFFICE_ORDER } from '../graph/agents'
import { coverage, allConsults } from '../graph/engine'
import { runModel, CASE_DEFAULTS } from '../graph/model'
import { money, num, type RSeries } from '../../components/rcharts'
import type { Report, Section, ConsultItem } from './types'
import type { OfficeId } from '../graph/types'

const PRIORITY: Record<string, number> = { legal: 0, bridge: 1, technology: 2, operations: 3, treasury: 4, roster: 5 }
function resolveItems(): ConsultItem[] {
  return allConsults().filter(c => c.status === 'open' && c.consultType === 'flag')
    .map(c => ({ id: c.id, from: c.from as OfficeId, to: c.to as OfficeId, note: c.note ?? '', status: c.status ?? 'open', priority: PRIORITY[c.from as string] ?? 9 }))
    .sort((a, b) => a.priority - b.priority)
}

export function buildBoardDeck(): Report {
  const cov = coverage()
  const lines = OFFICE_ORDER.map(officeHeadline)
  const mid = runModel(CASE_DEFAULTS.mid, 24)
  const cash = mid.rows.map((row, i) => ({ i, v: row.cum }))
  const series: RSeries[] = [{ key: 'v', label: 'mid', color: mid.contributionPerActive > 0 ? 'var(--ok)' : 'var(--bad)', fill: true }]
  const reds = lines.filter(l => l.health === 'red').length

  const sections: Section[] = [
    { id: 'cover', kind: 'headline', source: 'partial', label: 'Board deck', tone: reds ? 'warn' : 'ok', text: 'Weekly Two-Hook Families — the retained household is the company.', sub: 'A child learned AND a parent coordinated, same week. Everything ladders to this.' },
    { id: 'kpis', kind: 'kpiRow', source: 'partial', items: [
      { label: 'North Star · W2F', value: '—', sub: 'weekly' },
      { label: 'Coverage', value: `${cov.pct}%`, sub: '→ 80%', tone: cov.pct >= 80 ? 'ok' : 'warn' },
      { label: 'Break-even', value: mid.steadyBreakeven ? `${Math.round(mid.steadyBreakeven)} fam` : 'never', tone: mid.steadyBreakeven ? undefined : 'bad' },
      { label: 'NPV · 24mo (mid)', value: money(mid.npv), tone: mid.npv >= 0 ? 'ok' : 'bad' },
    ] },
    { id: 'chiefs', kind: 'chiefLines', source: 'partial', title: 'The six offices', lines },
    { id: 'cash', kind: 'reChart', source: 'simulated', title: 'Cashflow · mid case · 24mo', data: cash, series, unit: 'money', months: 24 },
    { id: 'decisions', kind: 'consults', source: 'partial', title: 'Decisions for the board', items: resolveItems() },
    { id: 'asks', kind: 'text', source: 'partial', text: 'Asks: (1) validate the North-Star query on live data, (2) fund the instrumentation backlog to lift coverage past 80%, (3) approve the Mid-case pricing to protect unit economics.' },
  ]
  return { id: 'board', title: 'Board Deck', subtitle: 'CEO · monthly — North Star, offices, financials, decisions', owner: 'company', cadence: 'monthly', audience: 'Board', sections, livePct: cov.pct }
}

export function buildInvestorUpdate(): Report {
  const cov = coverage()
  const mid = runModel(CASE_DEFAULTS.mid, 24)
  const cash = mid.rows.map((row, i) => ({ i, v: row.cum }))
  const series: RSeries[] = [{ key: 'v', label: 'mid', color: 'var(--ok)', fill: true }]
  const sections: Section[] = [
    { id: 'h', kind: 'headline', source: 'partial', label: 'Investor update', tone: 'ok', text: 'Two customers who never conflict — the kid’s pull, the parent’s stick.', sub: 'The North Star can only rise if both products work. Traction is the retained household.' },
    { id: 'k', kind: 'kpiRow', source: 'partial', items: [
      { label: 'Weekly two-hook families', value: '—', sub: 'the north star' },
      { label: 'Families · mo24 (mid)', value: num(mid.endActive) },
      { label: 'ARR run-rate', value: money(mid.rows[mid.rows.length - 1].revenue * 12) },
      { label: 'Break-even', value: mid.steadyBreakeven ? `${Math.round(mid.steadyBreakeven)} fam` : 'never' },
    ] },
    { id: 'c', kind: 'reChart', source: 'simulated', title: 'Cashflow trajectory (mid)', data: cash, series, unit: 'money', months: 24 },
    { id: 'hi', kind: 'text', source: 'partial', text: `Highlights: North-Star query is buildable from real tables; unit economics positive at Mid (break-even ~${mid.steadyBreakeven ? Math.round(mid.steadyBreakeven) : '—'} families); the diamond economy is cosmetic-only (no pay-to-win).` },
    { id: 'lo', kind: 'text', source: 'partial', text: `Watch-items: Low case is structurally underwater until conversion clears ~2%; instrumentation coverage at ${cov.pct}% (${cov.placeholder} surfaces blind).` },
    { id: 'ask', kind: 'text', source: 'partial', text: 'Ask: intros to family/edtech operators in Doha + Indonesia; feedback on the Mid-case pricing.' },
  ]
  return { id: 'investor', title: 'Investor Update', subtitle: 'IR · monthly — traction, KPIs, asks', owner: 'treasury', cadence: 'monthly', audience: 'Investors', sections, livePct: cov.pct }
}
