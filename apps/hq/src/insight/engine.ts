// insight() — the single call every visual makes. Deterministic rules now;
// flip CIRCLE_HQ_LLM (Registry toggle) later to route through llmInsight()
// behind the SAME signature. Nothing in the UI changes.

import type { Insight, InsightCtx } from '../contract/insight'
import type { MetricSeries, ScorecardTile } from '../contract/metrics'
import { RULES } from './rules'

const NEUTRAL: Insight = {
  ruleId: 'none', source: 'rule', severity: 'info', headline: 'No signal in range.',
}

export function insight(series: MetricSeries, ctx: InsightCtx = {}): Insight {
  for (const rule of RULES) {
    if (rule.applies(series, ctx)) return rule.emit(series, ctx)
  }
  return NEUTRAL
}

/** Convenience: build an insight straight from a scorecard tile. */
export function tileInsight(tile: ScorecardTile, driverHint?: string): Insight {
  const series: MetricSeries = {
    key: tile.key, label: tile.label, unit: tile.unit,
    points: [{ t: 'now', v: tile.value }],
  }
  return insight(series, {
    label: tile.label, unit: tile.unit, benchmarkGreen: tile.benchmarkGreen,
    benchmarkAmber: tile.benchmarkAmber, higherBetter: tile.higherBetter, driverHint,
  } as InsightCtx)
}

/** RAG status for a scorecard tile (drives the dot colour). */
export function tileStatus(t: ScorecardTile): 'success' | 'warn' | 'danger' {
  const hb = t.higherBetter ?? true
  if (hb ? t.value >= t.benchmarkGreen : t.value <= t.benchmarkGreen) return 'success'
  if (hb ? t.value >= t.benchmarkAmber : t.value <= t.benchmarkAmber) return 'warn'
  return 'danger'
}
