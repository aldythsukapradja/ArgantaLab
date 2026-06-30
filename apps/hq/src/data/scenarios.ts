import { live } from './live'
import type { ChartData } from '../components/charts'
import { chartColor } from '../components/charts'
import { kindLabel } from './growth'
import { PRESETS, DEFAULT_GLOBALS, computeScenario } from './monetization'

// Operating scenarios — the important questions the agent OS answers. Each one
// declares its owning executive, the agents it convenes, the SQL sources it
// reads, and a `run()` that turns live data into a chart + narrative. The CEO
// Agent orchestrates these; the registry is scalable — add a Scenario object to
// light up a new card everywhere.

export interface ScenarioResult {
  chart: ChartData
  headline: string
  insight: string
}

export interface Scenario {
  id: string
  title: string
  question: string
  ownerId: string            // executive agent that owns the answer
  participantIds: string[]   // agents the orchestrator convenes
  sources: string[]          // SQL tables / RPCs read
  chartKind: ChartData['kind']
  /** null = offline or no signal yet (caller shows an honest empty state) */
  run: () => Promise<ScenarioResult | null>
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'growth-review',
    title: 'Weekly Growth Review',
    question: 'Are weekly active learners growing, and is the trend healthy?',
    ownerId: 'coo', participantIds: ['vp-growth', 'retention'],
    sources: ['hq_growth_overview', 'item_attempts', 'profiles'], chartKind: 'line',
    run: async () => {
      const g = await live.growthOverview()
      if (!g) return null
      const last = g.northStar.at(-1)?.value ?? 0
      return {
        chart: { kind: 'line', points: g.northStar },
        headline: `${last} weekly active learners${g.wowPct != null ? ` · ${g.wowPct > 0 ? '+' : ''}${g.wowPct}% WoW` : ''}`,
        insight: g.wowPct == null
          ? 'North-star is tracking; week-over-week comparison needs a second week of data.'
          : g.wowPct >= 0
            ? `Weekly active is up ${g.wowPct}% — the loop is compounding. VP Growth: protect the share card.`
            : `Weekly active fell ${Math.abs(g.wowPct)}% — Retention Analyst flags a habit gap; prioritise the daily-quest loop.`,
      }
    },
  },
  {
    id: 'retention-triangle',
    title: 'Retention Triangle',
    question: 'Do weekly cohorts keep coming back, or decay after signup?',
    ownerId: 'vp-growth', participantIds: ['retention'],
    sources: ['hq_retention', 'item_attempts'], chartKind: 'cohort',
    run: async () => {
      const r = await live.retention()
      if (!r || r.cohorts.length === 0) return null
      const w1 = r.cohorts.map(c => c.ret[1]).filter((v): v is number => v != null)
      const avgW1 = w1.length ? Math.round(w1.reduce((a, b) => a + b, 0) / w1.length) : null
      return {
        chart: { kind: 'cohort', data: r },
        headline: avgW1 == null ? `${r.cohorts.length} cohorts tracked` : `Week-1 retention ~${avgW1}% across ${r.cohorts.length} cohorts`,
        insight: avgW1 == null ? 'Cohorts are forming; retention curves fill in as weeks elapse.'
          : avgW1 >= 35 ? `Week-1 retention ${avgW1}% is top-quartile for edtech — the activation moment is landing.`
            : `Week-1 retention ${avgW1}% is below the 35% bar — fix onboarding before spending on acquisition.`,
      }
    },
  },
  {
    id: 'acquisition-funnel',
    title: 'Acquisition Funnel',
    question: 'Where do new joiners drop off on the way to habit?',
    ownerId: 'vp-growth', participantIds: ['acquisition'],
    sources: ['hq_acquisition', 'profiles'], chartKind: 'bars',
    run: async () => {
      const a = await live.acquisition()
      if (!a || a.funnel.length === 0) return null
      const bars = a.funnel.map((s, i) => ({ label: s.stage, value: s.count, color: chartColor(i) }))
      const top = a.funnel[0].count, bottom = a.funnel.at(-1)!.count
      const through = top > 0 ? Math.round((100 * bottom) / top) : 0
      return {
        chart: { kind: 'bars', bars },
        headline: `${through}% make it from ${a.funnel[0].stage.toLowerCase()} to ${a.funnel.at(-1)!.stage.toLowerCase()}`,
        insight: `Acquisition Analyst: the steepest drop marks the highest-leverage onboarding fix. End-to-end throughput is ${through}%.`,
      }
    },
  },
  {
    id: 'diamond-economy',
    title: 'Diamond Economy',
    question: 'Is the diamond economy balanced, or are diamonds inflating?',
    ownerId: 'cfo', participantIds: ['cfo'],
    sources: ['hq_economy', 'diamond_ledger'], chartKind: 'bars',
    run: async () => {
      const e = await live.economy()
      if (!e || e.sources.length === 0) return null
      // Hold out the one-time starter grant so the recurring earn loop is visible.
      const loop = e.sources.filter(s => s.kind !== 'starter')
      const isSink = (k: string, flow?: string) => flow ? flow === 'sink' : ['spend', 'deduct'].includes(k)
      const bars = loop.map((s, i) => ({
        label: kindLabel(s.kind), value: s.amount,
        color: isSink(s.kind, s.flow) ? 'var(--mag)' : chartColor(i),
      }))
      return {
        chart: { kind: 'bars', bars },
        headline: `${e.coverage == null ? '—' : e.coverage + '%'} sink coverage · float ${e.float}`,
        insight: e.coverage == null ? 'No diamond flows yet — minted vs spent appears as play happens.'
          : e.coverage >= 50 ? `Sink coverage ${e.coverage}% is healthy — burn keeps pace with the recurring mint (starter grant held out).`
            : `CFO: sink coverage ${e.coverage}% is low — diamonds mint faster than they’re spent. Add a shop sink before inflation sets in.`,
      }
    },
  },
  {
    id: 'monetization-forecast',
    title: 'Monetization Forecast',
    question: 'If we switch on revenue, how much do we make at scale?',
    ownerId: 'cfo', participantIds: ['ir', 'vp-growth'],
    sources: ['hq_economy', 'monetization model'], chartKind: 'bars',
    run: async () => {
      const fam = 10_000
      const cases: { k: 'low' | 'mid' | 'high'; label: string }[] = [
        { k: 'low', label: 'Low' }, { k: 'mid', label: 'Mid' }, { k: 'high', label: 'High' },
      ]
      const bars = cases.map((c, i) => ({
        label: c.label, value: Math.round(computeScenario(PRESETS[c.k], fam, DEFAULT_GLOBALS).arr),
        color: c.k === 'high' ? 'var(--ok)' : c.k === 'mid' ? 'var(--acc)' : chartColor(i),
      }))
      const mid = computeScenario(PRESETS.mid, fam, DEFAULT_GLOBALS)
      return {
        chart: { kind: 'bars', bars, unit: ' ARR' },
        headline: `Mid case ≈ $${Math.round(mid.arr / 1000)}k ARR at 10k families`,
        insight: `Subscription + diamond IAP. Mid-case LTV:CAC ${mid.ltvCac == null ? '—' : mid.ltvCac.toFixed(1) + '×'}, payback ${mid.paybackMo == null ? '—' : Math.round(mid.paybackMo) + 'mo'} — clears the fundable bar. Drag the drivers in Growth → Monetization to reshape the fan.`,
      }
    },
  },
  {
    id: 'content-coverage',
    title: 'Content Coverage',
    question: 'Is the curriculum live across every world, or are there gaps?',
    ownerId: 'cpo', participantIds: ['learn-dir', 'content-writer'],
    sources: ['hq_content_matrix'], chartKind: 'bars',
    run: async () => {
      const c = await live.contentMatrix()
      if (!c || c.worlds.length === 0) return null
      const byWorld = new Map<string, number>()
      for (const cell of c.cells) byWorld.set(cell.world, (byWorld.get(cell.world) || 0) + cell.live)
      const bars = c.worlds
        .map((w, i) => ({ label: w.name, value: byWorld.get(w.key) || 0, color: chartColor(i) }))
        .sort((a, b) => b.value - a.value)
      const livePct = c.totals.authored > 0 ? Math.round((100 * c.totals.live) / c.totals.authored) : 0
      return {
        chart: { kind: 'bars', bars, unit: ' live' },
        headline: `${c.totals.live} live items · ${livePct}% of authored`,
        insight: livePct >= 80 ? `Coverage is strong (${livePct}% live). Learning Director: balance interaction types next.`
          : `Content Writer: ${100 - livePct}% of authored items aren’t live yet — push the backlog before opening new worlds.`,
      }
    },
  },
]

export const scenarioById = (id: string) => SCENARIOS.find(s => s.id === id)
