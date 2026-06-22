// The deterministic InsightRule library. Each rule reads a MetricSeries + ctx
// and emits a one-sentence, investor-grade insight. The LLM swaps in behind
// the same interface later (see engine.ts + the Registry toggle).

import type { InsightRule } from '../contract/insight'

const last = (s: { points: { v: number }[] }) => s.points[s.points.length - 1]?.v ?? 0
const fmt = (v: number, unit?: string) => `${Math.round(v * 10) / 10}${unit ?? ''}`

// ── BenchmarkGap: a value vs its green/amber threshold (the scorecard rule) ──
export const BenchmarkGap: InsightRule = {
  id: 'benchmark-gap',
  type: 'benchmark',
  applies: (_s, ctx) => ctx.benchmarkGreen !== undefined,
  emit: (s, ctx) => {
    const v = last(s)
    const hb = ctx.higherBetter ?? true
    const green = ctx.benchmarkGreen!
    const amber = ctx.benchmarkAmber ?? green
    const meetsGreen = hb ? v >= green : v <= green
    const meetsAmber = hb ? v >= amber : v <= amber
    const label = ctx.label ?? s.label
    const driver = ctx.driverHint
    if (meetsGreen)
      return { ruleId: 'benchmark-gap', source: 'rule', severity: 'success',
        headline: `${label} at ${fmt(v, s.unit)} — ${hb ? 'above' : 'within'} the ${fmt(green, s.unit)} bar investors reward.`, driver }
    if (meetsAmber)
      return { ruleId: 'benchmark-gap', source: 'rule', severity: 'warn',
        headline: `${label} at ${fmt(v, s.unit)} — below the ${fmt(green, s.unit)} target; prep a narrative before sharing.`, driver,
        action: 'Open in Studio' }
    return { ruleId: 'benchmark-gap', source: 'rule', severity: 'danger',
      headline: `${label} at ${fmt(v, s.unit)} — under the ${fmt(amber, s.unit)} floor; this drags the raise.`, driver,
      action: 'Investigate' }
  },
}

// ── TrendShift: direction + magnitude of a series over the window ──
export const TrendShift: InsightRule = {
  id: 'trend-shift',
  type: 'trend',
  applies: (s) => s.points.length >= 2,
  emit: (s, ctx) => {
    const v = last(s)
    const prev = s.points[0].v
    const pct = prev !== 0 ? ((v - prev) / Math.abs(prev)) * 100 : 0
    const label = ctx.label ?? s.label
    const driver = ctx.driverHint
    if (Math.abs(pct) < 2)
      return { ruleId: 'trend-shift', source: 'rule', severity: 'info',
        headline: `${label} is holding steady (${pct >= 0 ? '+' : ''}${Math.round(pct)}%).`, driver }
    if (pct > 0)
      return { ruleId: 'trend-shift', source: 'rule', severity: 'success',
        headline: `${label} up ${Math.round(pct)}% over the window${driver ? `, driven by ${driver}` : ''}.`, driver }
    return { ruleId: 'trend-shift', source: 'rule', severity: 'warn',
      headline: `${label} down ${Math.round(Math.abs(pct))}% over the window${driver ? `; traced to ${driver}` : ''}.`, driver,
      action: 'Show drivers' }
  },
}

export const RULES: InsightRule[] = [BenchmarkGap, TrendShift]
