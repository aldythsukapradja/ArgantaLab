// Financial report (CFO) — composes the Treasury model into a present-able,
// exportable report. Deterministic; all `simulated` (real family base wires at
// P3). Reuses the same numbers as the interactive cockpit — one model.

import {
  runModel, CASE_DEFAULTS, effArpu, FIXED_MO, PROCESSING, INFRA_REG, REG_MULT,
} from '../graph/model'
import { money, num, type RSeries } from '../../components/rcharts'
import type { Report, Section } from './types'

export function buildFinancialReport(months = 24): Report {
  const a = CASE_DEFAULTS.mid
  const r = runModel(a, months)
  const arpu = effArpu(a.listPrice)

  // 24-mo P&L totals
  let rev = 0, infra = 0, net = 0
  for (const row of r.rows) { rev += row.revenue; infra += row.active * a.infraActive + row.active * REG_MULT * INFRA_REG; net += row.net }
  const proc = rev * PROCESSING, netRev = rev - proc, fixed = FIXED_MO * r.rows.length, cac = netRev - infra - net - fixed
  const mrrEnd = r.rows[r.rows.length - 1].revenue
  const positive = r.contributionPerActive > 0

  const data = r.rows.map((row, i) => ({ i, v: row.cum }))
  const series: RSeries[] = [{ key: 'v', label: 'mid', color: positive ? 'var(--ok)' : 'var(--bad)', fill: true }]

  const sections: Section[] = [
    {
      id: 'verdict', kind: 'headline', source: 'simulated',
      label: 'Bottom line', tone: positive ? 'ok' : 'bad',
      text: positive
        ? `Unit economics positive — break-even ~${r.steadyBreakeven ? Math.round(r.steadyBreakeven) : '—'} active families, cash-positive month ${r.firstPositiveMonth ?? '—'}.`
        : `Unit economics negative — contribution ${money(r.contributionPerActive)}/active is below the infra load.`,
      sub: `Mid case · ${months}mo · base case. Effective ARPU ${money(arpu)}/mo after promo blend.`,
    },
    {
      id: 'kpis', kind: 'kpiRow', source: 'simulated',
      items: [
        { label: 'ARR (run-rate)', value: money(mrrEnd * 12), sub: `${money(mrrEnd)}/mo end` },
        { label: 'Contribution / active', value: money(r.contributionPerActive), tone: positive ? 'ok' : 'bad' },
        { label: `NPV · ${months}mo`, value: money(r.npv), tone: r.npv >= 0 ? 'ok' : 'bad' },
        { label: 'Break-even families', value: r.steadyBreakeven ? String(Math.round(r.steadyBreakeven)) : 'never', tone: r.steadyBreakeven ? undefined : 'bad' },
        { label: 'Families · end', value: num(r.endActive) },
      ],
    },
    { id: 'cash', kind: 'reChart', source: 'simulated', title: 'Cumulative net cashflow', data, series, unit: 'money', months },
    {
      id: 'pl', kind: 'table', source: 'simulated', title: `Income statement · ${months}-mo totals`, strongLast: true,
      head: ['Line', 'Amount'],
      rows: [
        ['Revenue (subscription)', money(rev)],
        ['− Store processing (15%)', money(-proc)],
        ['Net revenue', money(netRev)],
        ['− COGS (infra)', money(-infra)],
        ['− OpEx (fixed)', money(-fixed)],
        ['− OpEx (acquisition)', money(-cac)],
        ['Net income', money(net)],
      ],
    },
    {
      id: 'foot', kind: 'text', source: 'simulated',
      text: 'Diamonds are a bundled perk (a mint), not cash — excluded from the P&L. All figures simulated; the live family base wires via the P3 RPCs. Open the cockpit to change assumptions or compare cases.',
    },
  ]

  return {
    id: 'financial', title: 'Financial Report', subtitle: 'CFO · Treasury — P&L, cashflow and unit economics',
    owner: 'treasury', cadence: 'monthly', audience: 'Founder / Board',
    sections, livePct: 0,
  }
}
