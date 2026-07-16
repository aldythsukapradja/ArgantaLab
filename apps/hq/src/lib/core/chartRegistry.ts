// C5-B1 · The chart registry — the single deterministic answer to "which chart
// does this question want?".
//
// Why this exists: analyze() (surfaces/studios/analytics.ts) was a 5-branch
// keyword heuristic over baked monetization models whose FALLTHROUGH always
// returned the ARR-vs-families area chart. Any question it didn't recognize
// ("analytics of my arganta stacks") silently got ARR — a wrong chart presented
// as an answer. That's the bug this file kills.
//
// Three rules, in order of importance:
//  1. NEVER guess. If no entry matches well, we return a picker (the founder
//     chooses) — never a plausible-looking wrong chart.
//  2. NEVER fake provenance. Every entry declares measured | modeled | planned,
//     and the card renders that badge. A model's projection is never dressed up
//     as observed usage (same rule the C-suite MCP enforces).
//  3. NEVER invent data. Fetchers read the SAME live.* RPCs the Growth/Portfolio
//     dashboards read. When an RPC returns null (offline, non-operator, or the
//     migration hasn't run), the entry degrades with an honest note instead of
//     falling back to a baked model.

import { live } from '../../data/live'
import { supabase, cloudEnabled } from '../supabase'
import { PRESETS, DEFAULT_GLOBALS, forecastCurve, computeScenario, type Case } from '../../data/monetization'
import { FEATURED_GAMES } from '../../data/featuredGames'
import type { ChartType, Analysis } from '../../surfaces/studios/analytics'

export type Provenance = 'measured' | 'modeled' | 'planned'
export type OfficeKey = 'treasury' | 'operations' | 'technology' | 'portfolio' | 'bridge'

export interface ChartFetch {
  data: any[]
  /** Set when the data is absent/partial — rendered instead of a fake chart. */
  note?: string
}

export interface ChartEntry {
  id: string
  office: OfficeKey
  title: string
  chart: ChartType
  /** Scoring vocabulary. Multi-word terms are matched as phrases. */
  terms: string[]
  provenance: Provenance
  source: string
  reason: string
  unit?: 'money' | 'count' | '%'
  encoding: Analysis['encoding']
  fetch: () => Promise<ChartFetch>
}

/** What the chart block carries. Superset of Analysis so the existing recharts
 * renderer (surfaces/studios/AnalyticsChart) draws it unmodified. */
export interface ChartSpec extends Analysis {
  chartId: string
  office: OfficeKey
  provenance: Provenance
  note?: string
  generatedAt: string
}

/** The other block shape analyze() can return: "I'm not guessing — pick one." */
export interface PickerSpec {
  picker: true
  question: string
  options: { chartId: string; title: string; chart: ChartType; office: OfficeKey; provenance: Provenance }[]
}

export type AnalyzeSpec = ChartSpec | PickerSpec
export const isPicker = (s: unknown): s is PickerSpec => !!s && (s as PickerSpec).picker === true

const OFFLINE = 'No measured data — Supabase is offline or you are not signed in as an operator.'
const NEEDS_MIGRATION = (m: string) => `No rows yet — this reads ${m}; run the migration and let usage accrue.`

// ── helpers ─────────────────────────────────────────────────────────────────
const MAX_FAMILIES = 50000
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const empty = (note: string): ChartFetch => ({ data: [], note })

/** Sum a keyed numeric field into {label,value} rows, biggest first. */
function tally<T>(rows: T[], key: (r: T) => string, val: (r: T) => number): { label: string; value: number }[] {
  const m = new Map<string, number>()
  rows.forEach(r => m.set(key(r), (m.get(key(r)) || 0) + val(r)))
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}

async function agentRuns(limit = 200): Promise<any[] | null> {
  if (!cloudEnabled) return null
  const { data, error } = await supabase.rpc('agent_runs_recent', { p_limit: limit, p_domain: null })
  if (error) return null
  return (data as any[]) || []
}
const runProvider = (r: any) => r.actualProvider || r.actual_provider || 'unknown'
const runModel = (r: any) => r.actualModel || r.actual_model || 'unknown'
const runCost = (r: any) => Number(r.costUsd ?? r.cost_usd ?? 0)
const runClass = (r: any) => (r.actualCostClass ?? r.actual_cost_class ?? null) as number | null
const runAt = (r: any) => String(r.createdAt || r.created_at || '')
const TIER_NAME = ['Sovereign', 'Sponsored', 'Economy', 'Frontier']

// ── the registry ────────────────────────────────────────────────────────────
export const CHART_REGISTRY: ChartEntry[] = [
  // ── TREASURY / CFO ────────────────────────────────────────────────────────
  {
    id: 'arr-vs-families', office: 'treasury', title: 'ARR vs families (mid case)', chart: 'area',
    terms: ['arr', 'arr vs families', 'revenue as we scale', 'revenue vs families', 'revenue curve', 'forecast', 'projection', 'revenue over scale'],
    provenance: 'modeled', source: 'Monetization forecast model · mid preset (a projection, not measured)',
    reason: 'revenue-over-scale question → continuous area', unit: 'money', encoding: { x: 'families', y: 'arr' },
    fetch: async () => ({ data: forecastCurve(PRESETS.mid, DEFAULT_GLOBALS, MAX_FAMILIES, 12).map(p => ({ families: Math.round(p.families), arr: Math.round(p.arr) })) }),
  },
  {
    id: 'arr-by-scenario', office: 'treasury', title: 'ARR by scenario (at 50k families)', chart: 'bar',
    terms: ['scenario', 'case', 'low mid high', 'best case', 'worst case', 'compare scenarios', 'sensitivity of arr'],
    provenance: 'modeled', source: 'Monetization presets low/mid/high (a projection, not measured)',
    reason: 'compare discrete cases → bar', unit: 'money', encoding: { x: 'label', y: 'arr' },
    fetch: async () => ({ data: (['low', 'mid', 'high'] as Case[]).map(c => ({ label: c.toUpperCase(), arr: Math.round(computeScenario(PRESETS[c], MAX_FAMILIES, DEFAULT_GLOBALS).arr) })) }),
  },
  {
    id: 'revenue-drivers', office: 'treasury', title: 'Revenue drivers × scenario', chart: 'heatmap',
    terms: ['driver', 'assumption', 'sensitivity', 'heatmap of drivers', 'what moves revenue', 'levers'],
    provenance: 'modeled', source: 'Monetization presets (a projection, not measured)',
    reason: 'multi-factor grid → heatmap', encoding: { label: 'row', series: ['low', 'mid', 'high'] },
    fetch: async () => {
      const rows = [
        { key: 'conv', label: 'Free→paid %' }, { key: 'price', label: 'Price $/mo' },
        { key: 'churn', label: 'Churn %' }, { key: 'iapBuyers', label: 'Diamond buyers %' },
        { key: 'iapSpend', label: 'Diamond spend $' },
      ] as const
      return {
        data: rows.map(r => {
          const vals = (['low', 'mid', 'high'] as Case[]).map(c => (PRESETS[c] as any)[r.key] as number)
          const max = Math.max(...vals) || 1
          return { row: r.label, low: vals[0] / max, mid: vals[1] / max, high: vals[2] / max, raw: vals }
        }),
      }
    },
  },
  {
    id: 'diamond-mint-burn', office: 'treasury', title: 'Diamond mint vs burn (weekly)', chart: 'line',
    terms: ['diamond', 'mint', 'burn', 'economy', 'currency', 'sink', 'float', 'inflation'],
    provenance: 'measured', source: 'hq_economy RPC over diamond_ledger (real)',
    reason: 'two flows over time → line', unit: 'count', encoding: { x: 'week', y: 'mint', series: ['mint', 'burn'] },
    fetch: async () => {
      const e = await live.economy()
      if (!e) return empty(OFFLINE)
      if (!e.mintBurn?.length) return empty('The economy RPC returned no weekly mint/burn series (needs the v2 RPC).')
      return { data: e.mintBurn.map(p => ({ week: p.week, mint: Math.round(p.mint), burn: Math.round(p.burn) })) }
    },
  },
  {
    id: 'diamond-sources', office: 'treasury', title: 'Where diamonds come from', chart: 'pie',
    terms: ['diamond sources', 'where diamonds', 'mint sources', 'earning breakdown', 'ledger legs'],
    provenance: 'measured', source: 'hq_economy RPC · diamond_ledger legs (real)',
    reason: 'categorical share of one total → pie', unit: 'count', encoding: { label: 'label', value: 'value' },
    fetch: async () => {
      const e = await live.economy()
      if (!e) return empty(OFFLINE)
      const rows = (e.sources || []).filter(s => s.amount > 0)
      if (!rows.length) return empty('No ledger legs recorded yet.')
      return { data: rows.map(s => ({ label: s.kind, value: Math.round(Math.abs(s.amount)) })) }
    },
  },
  {
    id: 'ai-cost-by-day', office: 'treasury', title: 'AI spend by day', chart: 'bar',
    terms: ['ai cost', 'llm cost', 'spend', 'burn rate', 'cost per day', 'how much am i spending', 'model cost'],
    provenance: 'measured', source: 'agent_runs_recent RPC · real logged run costs',
    reason: 'a quantity per discrete day → bar', unit: 'money', encoding: { x: 'label', y: 'value' },
    fetch: async () => {
      const runs = await agentRuns(500)
      if (!runs) return empty(OFFLINE)
      if (!runs.length) return empty('No agent runs logged yet.')
      const rows = tally(runs, r => runAt(r).slice(0, 10) || 'unknown', runCost)
      return { data: rows.sort((a, b) => a.label.localeCompare(b.label)).map(r => ({ label: r.label.slice(5), value: Number(r.value.toFixed(4)) })) }
    },
  },

  // ── OPERATIONS / COO ──────────────────────────────────────────────────────
  {
    id: 'north-star', office: 'operations', title: 'North star — weekly engaged', chart: 'area',
    terms: ['north star', 'northstar', 'weekly engaged', 'engaged learners', 'growth trend', 'are we growing'],
    provenance: 'measured', source: 'hq_growth_overview RPC (real)',
    reason: 'one metric over weeks → area', unit: 'count', encoding: { x: 'week', y: 'value' },
    fetch: async () => {
      const g = await live.growthOverview()
      if (!g) return empty(OFFLINE)
      if (!g.northStar?.length) return empty('No weekly activity recorded yet.')
      return { data: g.northStar.map(p => ({ week: p.week.slice(5), value: p.value })) }
    },
  },
  {
    id: 'active-users', office: 'operations', title: 'Active learners — DAU / WAU / MAU', chart: 'bar',
    terms: ['dau', 'wau', 'mau', 'active users', 'active learners', 'how many active', 'stickiness'],
    provenance: 'measured', source: 'hq_growth_overview RPC (real)',
    reason: 'three discrete totals → bar', unit: 'count', encoding: { x: 'label', y: 'value' },
    fetch: async () => {
      const g = await live.growthOverview()
      if (!g) return empty(OFFLINE)
      return { data: [{ label: 'DAU', value: g.dau }, { label: 'WAU', value: g.wau }, { label: 'MAU', value: g.mau }] }
    },
  },
  {
    id: 'activity-mix', office: 'operations', title: 'What learners actually do (30d)', chart: 'pie',
    terms: ['activity mix', 'what do kids do', 'journey quest drill', 'activity breakdown', 'event types'],
    provenance: 'measured', source: 'hq_growth_overview RPC · activityMix (real)',
    reason: 'share of activity by type → pie', unit: 'count', encoding: { label: 'label', value: 'value' },
    fetch: async () => {
      const g = await live.growthOverview()
      if (!g) return empty(OFFLINE)
      if (!g.activityMix?.length) return empty('The growth RPC returned no activity mix (needs the v2 RPC).')
      return { data: g.activityMix.map(a => ({ label: a.kind, value: a.events })) }
    },
  },
  {
    id: 'app-usage', office: 'operations', title: 'Time on app (by app)', chart: 'bar',
    terms: ['time on app', 'usage by app', 'which app', 'engagement by app', 'time spent', 'minutes per app'],
    provenance: 'measured', source: 'hq_engagement RPC over app_usage_beats (real)',
    reason: 'compare apps on one measure → bar', unit: 'count', encoding: { x: 'label', y: 'value' },
    fetch: async () => {
      const e = await live.engagement(14)
      if (!e) return empty(NEEDS_MIGRATION('migration_hq_engagement.sql'))
      if (!e.apps?.length) return empty('No usage beats recorded in the last 14 days.')
      return { data: e.apps.map(a => ({ label: a.app, value: Math.round(a.seconds / 60) })) }
    },
  },
  {
    id: 'usage-daily', office: 'operations', title: 'Time on app, day by day', chart: 'line',
    terms: ['usage over time', 'daily usage', 'usage trend', 'engagement trend', 'minutes per day'],
    provenance: 'measured', source: 'hq_engagement RPC over app_usage_beats (real)',
    reason: 'a measure across consecutive days → line', unit: 'count', encoding: { x: 'day', y: 'value' },
    fetch: async () => {
      const e = await live.engagement(14)
      if (!e) return empty(NEEDS_MIGRATION('migration_hq_engagement.sql'))
      if (!e.daily?.length) return empty('No usage beats recorded in the last 14 days.')
      const rows = tally(e.daily, d => d.day, d => d.seconds)
      return { data: rows.sort((a, b) => a.label.localeCompare(b.label)).map(r => ({ day: r.label.slice(5), value: Math.round(r.value / 60) })) }
    },
  },
  {
    id: 'usage-punchcard', office: 'operations', title: 'When learners show up', chart: 'heatmap',
    terms: ['when do kids play', 'when learners show up', 'punchcard', 'time of day', 'hour of day', 'peak hours', 'day of week'],
    provenance: 'measured', source: 'hq_engagement RPC · punch (real)',
    reason: 'day × hour grid → heatmap', encoding: { label: 'row', series: ['morning', 'afternoon', 'evening'] },
    fetch: async () => {
      const e = await live.engagement(30)
      if (!e) return empty(NEEDS_MIGRATION('migration_hq_engagement.sql'))
      if (!e.punch?.length) return empty('No usage beats recorded in the last 30 days.')
      // Fold 24 hours into 3 readable bands, normalized per row (same shape the
      // heatmap renderer expects: {row, ...series, raw}).
      const band = (h: number) => (h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening')
      return {
        data: DOW.map((label, dow) => {
          const cells = { morning: 0, afternoon: 0, evening: 0 }
          e.punch.filter(p => p.dow === dow).forEach(p => { cells[band(p.hour) as keyof typeof cells] += p.seconds })
          const raw = [cells.morning, cells.afternoon, cells.evening].map(s => Math.round(s / 60))
          const max = Math.max(...raw) || 1
          return { row: label, morning: raw[0] / max, afternoon: raw[1] / max, evening: raw[2] / max, raw }
        }),
      }
    },
  },
  {
    id: 'power-curve', office: 'operations', title: 'Power-user curve (L14)', chart: 'bar',
    terms: ['power curve', 'power users', 'l14', 'days active', 'habit', 'how often do they come back'],
    provenance: 'measured', source: 'hq_power_curve RPC · a16z L14 histogram (real)',
    reason: 'histogram of a distribution → bar', unit: 'count', encoding: { x: 'label', y: 'value' },
    fetch: async () => {
      const p = await live.powerCurve(14)
      if (!p) return empty(NEEDS_MIGRATION('migration_hq_engagement_v3.sql'))
      if (!p.histogram?.length) return empty('No active-day observations yet.')
      return { data: p.histogram.map(b => ({ label: `${b.daysActive}d`, value: b.users })) }
    },
  },
  {
    id: 'retention-cohorts', office: 'operations', title: 'Retention by signup cohort', chart: 'heatmap',
    terms: ['retention', 'cohort', 'do they come back', 'churn', 'w1 w2 w3', 'stickiness over weeks'],
    provenance: 'measured', source: 'hq_retention RPC (real)',
    reason: 'cohort × week grid → heatmap', encoding: { label: 'row', series: ['W1', 'W2', 'W3'] },
    fetch: async () => {
      const r = await live.retention()
      if (!r) return empty(OFFLINE)
      if (!r.cohorts?.length) return empty('No cohorts with elapsed weeks yet.')
      return {
        data: r.cohorts.slice(0, 8).map(c => {
          const raw = [1, 2, 3].map(i => c.ret[i] ?? 0)
          return { row: `${c.label} (${c.size})`, W1: (raw[0] || 0) / 100, W2: (raw[1] || 0) / 100, W3: (raw[2] || 0) / 100, raw }
        }),
      }
    },
  },
  {
    id: 'acquisition-funnel', office: 'operations', title: 'Signup → active funnel', chart: 'bar',
    terms: ['funnel', 'acquisition', 'activation', 'signup', 'conversion', 'onboarding drop'],
    provenance: 'measured', source: 'hq_acquisition RPC (real)',
    reason: 'ordered stage counts → bar', unit: 'count', encoding: { x: 'label', y: 'value' },
    fetch: async () => {
      const a = await live.acquisition()
      if (!a) return empty(OFFLINE)
      if (!a.funnel?.length) return empty('No funnel data yet.')
      return { data: a.funnel.map(s => ({ label: s.stage, value: s.count })) }
    },
  },

  // ── TECHNOLOGY / CTO ──────────────────────────────────────────────────────
  {
    id: 'runs-by-provider', office: 'technology', title: 'Agent runs by provider', chart: 'pie',
    terms: ['provider', 'which model', 'model usage', 'groq', 'runs by provider', 'who serves'],
    provenance: 'measured', source: 'agent_runs_recent RPC (real)',
    reason: 'share of runs by provider → pie', unit: 'count', encoding: { label: 'label', value: 'value' },
    fetch: async () => {
      const runs = await agentRuns(500)
      if (!runs) return empty(OFFLINE)
      if (!runs.length) return empty('No agent runs logged yet.')
      return { data: tally(runs, runProvider, () => 1) }
    },
  },
  {
    id: 'runs-by-tier', office: 'technology', title: 'Runs by router tier', chart: 'bar',
    terms: ['tier', 'cost class', 'sovereign', 'sponsored', 'economy', 'frontier', 'router', 'routing'],
    provenance: 'measured', source: 'agent_runs_recent RPC · actual_cost_class (real)',
    reason: 'counts across four fixed tiers → bar', unit: 'count', encoding: { x: 'label', y: 'value' },
    fetch: async () => {
      const runs = await agentRuns(500)
      if (!runs) return empty(OFFLINE)
      if (!runs.length) return empty('No agent runs logged yet.')
      const rows = tally(runs, r => { const c = runClass(r); return c == null ? 'unrouted' : `${c} · ${TIER_NAME[c] ?? c}` }, () => 1)
      return { data: rows.sort((a, b) => a.label.localeCompare(b.label)) }
    },
  },
  {
    id: 'run-health', office: 'technology', title: 'Run outcomes (succeeded vs failed)', chart: 'pie',
    terms: ['error rate', 'failures', 'run health', 'reliability', 'succeeded', 'failed', 'is it working'],
    provenance: 'measured', source: 'agent_runs_recent RPC · status (real)',
    reason: 'outcome share → pie', unit: 'count', encoding: { label: 'label', value: 'value' },
    fetch: async () => {
      const runs = await agentRuns(500)
      if (!runs) return empty(OFFLINE)
      if (!runs.length) return empty('No agent runs logged yet.')
      return { data: tally(runs, r => String(r.status || 'unknown'), () => 1) }
    },
  },
  {
    id: 'run-latency', office: 'technology', title: 'Latency by model', chart: 'bar',
    terms: ['latency', 'how fast', 'speed', 'response time', 'slow'],
    provenance: 'measured', source: 'agent_runs_recent RPC · latency_ms (real)',
    reason: 'compare models on one measure → bar', unit: 'count', encoding: { x: 'label', y: 'value' },
    fetch: async () => {
      const runs = await agentRuns(500)
      if (!runs) return empty(OFFLINE)
      if (!runs.length) return empty('No agent runs logged yet.')
      const m = new Map<string, { total: number; n: number }>()
      runs.forEach(r => {
        const k = runModel(r)
        const cur = m.get(k) || { total: 0, n: 0 }
        cur.total += Number(r.latencyMs ?? r.latency_ms ?? 0); cur.n++
        m.set(k, cur)
      })
      return { data: [...m.entries()].map(([label, v]) => ({ label, value: Math.round(v.total / Math.max(1, v.n)) })).sort((a, b) => b.value - a.value).slice(0, 8) }
    },
  },

  // ── PORTFOLIO ─────────────────────────────────────────────────────────────
  {
    id: 'games-by-genre', office: 'portfolio', title: 'Featured games by genre', chart: 'pie',
    terms: ['game', 'genre', 'tag', 'category', 'games by', 'what games'],
    provenance: 'measured', source: 'data/featuredGames.ts (the real shipped roster)',
    reason: 'categorical breakdown → pie', unit: 'count', encoding: { label: 'label', value: 'value' },
    fetch: async () => {
      const counts: Record<string, number> = {}
      FEATURED_GAMES.forEach(g => g.tags.forEach(t => { counts[t] = (counts[t] || 0) + 1 }))
      return { data: Object.entries(counts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value) }
    },
  },
  {
    id: 'content-coverage', office: 'portfolio', title: 'Content coverage — world × stage', chart: 'heatmap',
    terms: ['content', 'coverage', 'worlds', 'stages', 'curriculum', 'how much content', 'gaps'],
    provenance: 'measured', source: 'hq_content_matrix RPC (real)',
    reason: 'world × stage grid → heatmap', encoding: { label: 'row', series: [] },
    fetch: async () => {
      const m = await live.contentMatrix()
      if (!m) return empty(OFFLINE)
      if (!m.cells?.length) return empty('No authored content rows yet.')
      const stages = m.stages.slice(0, 3)
      return {
        data: m.worlds.slice(0, 8).map(w => {
          const raw = stages.map(s => m.cells.find(c => c.world === w.key && c.stage === s.key)?.live ?? 0)
          const max = Math.max(...raw, 1)
          const row: any = { row: w.name, raw }
          stages.forEach((s, i) => { row[s.label] = raw[i] / max })
          return row
        }),
        // series names are dynamic — the renderer reads encoding.series, patched below
      }
    },
  },
  {
    id: 'audience-roles', office: 'portfolio', title: 'Audience by role', chart: 'pie',
    terms: ['audience', 'roles', 'who uses', 'guardians vs kids', 'demographics', 'age band'],
    provenance: 'measured', source: 'hq_audience RPC · aggregate-only (real)',
    reason: 'share by role → pie', unit: 'count', encoding: { label: 'label', value: 'value' },
    fetch: async () => {
      const a = await live.audience()
      if (!a) return empty(OFFLINE)
      if (!a.roles?.length) return empty('No audience rows yet.')
      return { data: a.roles.map(r => ({ label: r.role, value: r.count })) }
    },
  },
  {
    id: 'geo-regions', office: 'portfolio', title: 'Where usage happens (timezone regions)', chart: 'bar',
    terms: ['where are users', 'geo', 'timezone', 'regions', 'countries actual', 'location'],
    provenance: 'measured', source: 'hq_geo RPC · coarse timezone regions, kid-safe (real)',
    reason: 'compare regions on one measure → bar', unit: 'count', encoding: { x: 'label', y: 'value' },
    fetch: async () => {
      const g = await live.geo(30)
      if (!g) return empty(NEEDS_MIGRATION('migration_hq_engagement_v3.sql'))
      if (!g.regions?.length) return empty('No regional sessions in the last 30 days.')
      return { data: g.regions.slice(0, 10).map(r => ({ label: r.tz, value: r.users })) }
    },
  },
  {
    id: 'target-markets', office: 'portfolio', title: 'Target-market reach mix', chart: 'geo',
    terms: ['target market', 'world map', 'which countries should', 'expansion', 'sea', 'market plan'],
    provenance: 'planned', source: 'Monetization plan · SEA-first (a PLAN — not measured usage)',
    reason: 'geographic question → world map', unit: '%', encoding: { label: 'country', value: 'value' },
    fetch: async () => ({
      data: [
        { country: 'Indonesia', lat: -2.5, lon: 118, value: 42 },
        { country: 'Philippines', lat: 12.9, lon: 122, value: 14 },
        { country: 'Malaysia', lat: 4.2, lon: 102, value: 10 },
        { country: 'Vietnam', lat: 16, lon: 106, value: 9 },
        { country: 'India', lat: 22, lon: 79, value: 12 },
        { country: 'United States', lat: 39, lon: -98, value: 8 },
        { country: 'United Kingdom', lat: 54, lon: -2, value: 5 },
      ],
    }),
  },
]

export const chartById = (id: string) => CHART_REGISTRY.find(c => c.id === id) || null
export const chartsForOffice = (office: OfficeKey) => CHART_REGISTRY.filter(c => c.office === office)

// ── the picker ──────────────────────────────────────────────────────────────
// Deterministic term-overlap scorer. A phrase term ("time on app") only scores
// when the whole phrase is present; a single-word term scores on a word-boundary
// match, so "map" never matches "mapping" and "arr" never matches "arganta".
const STOP = new Set(['the', 'a', 'an', 'of', 'my', 'our', 'is', 'are', 'to', 'for', 'me', 'show', 'chart', 'graph', 'plot', 'analytics', 'data', 'and', 'on', 'in', 'what', 'how', 'i', 'we', 'do', 'does', 'give'])

function scoreEntry(entry: ChartEntry, q: string, words: Set<string>): number {
  let score = 0
  for (const term of entry.terms) {
    if (term.includes(' ')) { if (q.includes(term)) score += 2 + term.split(' ').length }
    else if (words.has(term)) score += 2
  }
  // Title words are a weak secondary signal — they let "retention" hit the
  // retention chart even if someone words the question unusually.
  for (const w of entry.title.toLowerCase().split(/[^a-z0-9]+/)) {
    if (w.length > 3 && !STOP.has(w) && words.has(w)) score += 1
  }
  return score
}

export interface PickResult {
  best: ChartEntry | null
  /** Ranked alternates (never includes `best`). */
  alternates: ChartEntry[]
  /** True when nothing scored well enough to answer without guessing. */
  ambiguous: boolean
}

export function pickChart(question: string): PickResult {
  const q = (question || '').toLowerCase()
  const words = new Set(q.split(/[^a-z0-9]+/).filter(w => w && !STOP.has(w)))

  // An explicit chart-type request ("as a pie") is a filter, not a subject —
  // it can't pick a dataset on its own, but it breaks ties among equals.
  let forced: ChartType | null = null
  if (/\bheat ?map\b|\bmatrix\b/.test(q)) forced = 'heatmap'
  else if (/\bworld map\b|\bmap\b/.test(q)) forced = 'geo'
  else if (/\bpie\b|\bdonut\b/.test(q)) forced = 'pie'
  else if (/\bscatter\b/.test(q)) forced = 'scatter'
  else if (/\bbar\b/.test(q)) forced = 'bar'
  else if (/\bline\b/.test(q)) forced = 'line'
  else if (/\barea\b/.test(q)) forced = 'area'

  const scored = CHART_REGISTRY
    .map(e => ({ e, s: scoreEntry(e, q, words) + (forced && e.chart === forced ? 1.5 : 0) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)

  if (!scored.length) return { best: null, alternates: [], ambiguous: true }

  const top = scored[0]
  const second = scored[1]
  // Confident only when the winner is meaningfully ahead. A near-tie is exactly
  // the case where the old code guessed — now we ask instead.
  const confident = top.s >= 3 && (!second || top.s >= second.s * 1.5)
  return {
    best: confident ? top.e : null,
    alternates: (confident ? scored.slice(1) : scored).slice(0, 6).map(x => x.e),
    ambiguous: !confident,
  }
}

/** Suggestions when a question matched nothing at all — one per office, so the
 * picker still teaches what Core can actually chart. */
export const FALLBACK_SUGGESTIONS: string[] = ['north-star', 'app-usage', 'diamond-mint-burn', 'runs-by-provider', 'games-by-genre', 'arr-vs-families']

// ── rendering an entry into a block spec ────────────────────────────────────
export async function buildChartSpec(entry: ChartEntry): Promise<ChartSpec> {
  let fetched: ChartFetch
  try { fetched = await entry.fetch() } catch (err) {
    fetched = { data: [], note: `Data source failed: ${(err as Error)?.message || 'unknown error'}` }
  }
  const spec: ChartSpec = {
    chartId: entry.id, office: entry.office, provenance: entry.provenance,
    chart: entry.chart, title: entry.title, reason: entry.reason, source: entry.source,
    data: fetched.data, encoding: entry.encoding, unit: entry.unit,
    note: fetched.note, generatedAt: new Date().toISOString(),
  }
  // content-coverage's heatmap series are only known after the fetch (they're
  // the live stage labels) — patch encoding from the row shape rather than
  // hard-coding stage names that may not exist in this deployment.
  if (entry.id === 'content-coverage' && fetched.data.length) {
    spec.encoding = { ...entry.encoding, series: Object.keys(fetched.data[0]).filter(k => k !== 'row' && k !== 'raw') }
  }
  return spec
}

export function buildPickerSpec(question: string, entries: ChartEntry[]): PickerSpec {
  return {
    picker: true, question,
    options: entries.map(e => ({ chartId: e.id, title: e.title, chart: e.chart, office: e.office, provenance: e.provenance })),
  }
}

/** The analyze tool's real entry point (C5-B1). Returns a chart OR a picker —
 * never a guess. */
export async function analyzeQuestion(question: string): Promise<AnalyzeSpec> {
  const pick = pickChart(question)
  if (pick.best) return buildChartSpec(pick.best)
  const options = pick.alternates.length
    ? pick.alternates
    : (FALLBACK_SUGGESTIONS.map(chartById).filter(Boolean) as ChartEntry[])
  return buildPickerSpec(question, options)
}
