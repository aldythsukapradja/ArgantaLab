// ── Contract 2: InsightRule ──────────────────────────────────────────────
// Every chart/KPI/table carries an insight() result. Deterministic rules run
// first; the LLM swaps in behind the SAME interface later (Registry toggle).

import type { MetricSeries } from './metrics'

export type InsightSeverity = 'info' | 'success' | 'warn' | 'danger'

export interface Insight {
  ruleId: string
  severity: InsightSeverity
  headline: string
  driver?: string
  action?: string
  source: 'rule' | 'llm'
}

export interface InsightCtx {
  label?: string
  product?: string
  benchmarkGreen?: number
  benchmarkAmber?: number
  higherBetter?: boolean
  /** free-form attribution the caller already knows (e.g. top driver child). */
  driverHint?: string
}

export interface InsightRule {
  id: string
  type: string
  applies(s: MetricSeries, ctx: InsightCtx): boolean
  emit(s: MetricSeries, ctx: InsightCtx): Insight
}
