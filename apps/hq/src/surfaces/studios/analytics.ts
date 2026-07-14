// Analytics engine — type a question, get the RIGHT chart grounded in real data.
//
// The picker is a deterministic heuristic: it reads the question for (a) an
// explicit chart type and (b) a subject, then binds to a dataset. Datasets are
// computed from the repo's real models (monetization forecast, featured games).
// Offline these baked models ARE the data; wired to Supabase later, the same
// shapes come from RPCs — the UI never changes.

import { PRESETS, DEFAULT_GLOBALS, forecastCurve, computeScenario, type Case } from '../../data/monetization'
import { FEATURED_GAMES } from '../../data/featuredGames'

export type ChartType = 'line' | 'area' | 'bar' | 'pie' | 'heatmap' | 'geo' | 'scatter'

export interface Analysis {
  chart: ChartType
  title: string
  reason: string
  source: string
  data: any[]
  encoding: { x?: string; y?: string; label?: string; value?: string; series?: string[] }
  unit?: 'money' | 'count' | '%'
}

// ---- grounded datasets -----------------------------------------------------
const MAX_FAMILIES = 50000

function revenueForecast() {
  return forecastCurve(PRESETS.mid, DEFAULT_GLOBALS, MAX_FAMILIES, 12).map(p => ({ families: Math.round(p.families), arr: Math.round(p.arr) }))
}
function revenueByCase() {
  return (['low', 'mid', 'high'] as Case[]).map(c => ({ label: c.toUpperCase(), arr: Math.round(computeScenario(PRESETS[c], MAX_FAMILIES, DEFAULT_GLOBALS).arr) }))
}
function driversHeatmap() {
  // 5 drivers × 3 cases, each normalized 0..1 across the row → a real heat grid.
  const rows = [
    { key: 'conv', label: 'Free→paid %' }, { key: 'price', label: 'Price $/mo' },
    { key: 'churn', label: 'Churn %' }, { key: 'iapBuyers', label: 'Diamond buyers %' },
    { key: 'iapSpend', label: 'Diamond spend $' },
  ] as const
  return rows.map(r => {
    const vals = (['low', 'mid', 'high'] as Case[]).map(c => (PRESETS[c] as any)[r.key] as number)
    const max = Math.max(...vals) || 1
    return { row: r.label, low: vals[0] / max, mid: vals[1] / max, high: vals[2] / max, raw: vals }
  })
}
function gamesByGenre() {
  const counts: Record<string, number> = {}
  FEATURED_GAMES.forEach(g => g.tags.forEach(t => { counts[t] = (counts[t] || 0) + 1 }))
  return Object.entries(counts).map(([label, value]) => ({ label, value }))
}
function markets() {
  // Target-market plan (Arganta Family, SEA-first). lat/lon are real; values are
  // the planned family-reach mix — clearly a plan, not measured usage.
  return [
    { country: 'Indonesia', lat: -2.5, lon: 118, value: 42 },
    { country: 'Philippines', lat: 12.9, lon: 122, value: 14 },
    { country: 'Malaysia', lat: 4.2, lon: 102, value: 10 },
    { country: 'Vietnam', lat: 16, lon: 106, value: 9 },
    { country: 'India', lat: 22, lon: 79, value: 12 },
    { country: 'United States', lat: 39, lon: -98, value: 8 },
    { country: 'United Kingdom', lat: 54, lon: -2, value: 5 },
  ]
}

// ---- the picker ------------------------------------------------------------
const has = (q: string, ...w: string[]) => w.some(x => q.includes(x))

export function analyze(question: string): Analysis {
  const q = (question || '').toLowerCase()

  // explicit chart-type override wins
  let forced: ChartType | null = null
  if (has(q, 'heatmap', 'heat map', 'matrix')) forced = 'heatmap'
  else if (has(q, 'world map', 'map', 'geo', 'country', 'countries', 'region', 'market')) forced = 'geo'
  else if (has(q, 'pie', 'donut', 'share', 'breakdown', 'proportion', 'mix')) forced = 'pie'
  else if (has(q, 'scatter', 'correlat', ' vs ')) forced = 'scatter'
  else if (has(q, 'bar', 'compare', 'by case', 'ranking', 'rank')) forced = 'bar'
  else if (has(q, 'line', 'trend', 'over time', 'growth', 'forecast', 'curve', 'projection')) forced = 'line'

  // subject → dataset
  if (has(q, 'market', 'country', 'countries', 'geo', 'region', 'world') || forced === 'geo') {
    return { chart: 'geo', title: 'Target-market reach mix', reason: 'geographic question → world map', source: 'Monetization plan · SEA-first (planned, not measured)', data: markets(), encoding: { label: 'country', value: 'value' }, unit: '%' }
  }
  if (has(q, 'game', 'genre', 'tag', 'category') || (forced === 'pie' && !has(q, 'revenue'))) {
    return { chart: forced === 'bar' ? 'bar' : 'pie', title: 'Featured games by genre', reason: 'categorical breakdown → pie', source: 'data/featuredGames.ts (real)', data: gamesByGenre(), encoding: { label: 'label', value: 'value' }, unit: 'count' }
  }
  if (has(q, 'driver', 'assumption', 'sensitivity') || forced === 'heatmap') {
    return { chart: 'heatmap', title: 'Revenue drivers × scenario', reason: 'multi-factor grid → heatmap', source: 'Monetization presets (real)', data: driversHeatmap(), encoding: { label: 'row', series: ['low', 'mid', 'high'] } }
  }
  if (has(q, 'case', 'scenario', 'low', 'high') || forced === 'bar') {
    return { chart: 'bar', title: 'ARR by scenario (at 50k families)', reason: 'compare discrete cases → bar', source: 'Monetization model (real)', data: revenueByCase(), encoding: { x: 'label', y: 'arr' }, unit: 'money' }
  }
  // default: revenue forecast over families (only line/scatter make sense here)
  return { chart: forced === 'line' || forced === 'scatter' ? forced : 'area', title: 'ARR vs families (mid case)', reason: 'revenue-over-scale question → area/line', source: 'Monetization forecast model (real)', data: revenueForecast(), encoding: { x: 'families', y: 'arr' }, unit: 'money' }
}

export const SAMPLES = [
  'ARR as we scale families', 'revenue by scenario', 'featured games by genre',
  'driver sensitivity heatmap', 'target markets on a world map',
]
