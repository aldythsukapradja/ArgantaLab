// Growth analytics — benchmark library + deterministic scorecard & insight.
// The "VC layer": every metric carries its edtech/consumer quartile and a
// verdict. Pending (revenue-dependent) ratios are shown honestly, never faked.
// Same pure-function contract as the rest of HQ; an LLM can swap behind these.

import type { GrowthOverview } from './types'
import { pct, compact } from '../lib/format'

export type Tone = 'success' | 'info' | 'warning' | 'danger' | 'pending'

export interface ScoreRow {
  key: string
  label: string
  value: string
  tone: Tone
  note: string       // benchmark verdict (VC altitude)
  detail: string     // driver / context (consulting altitude, on click)
}

export interface HeroCard {
  key: string
  label: string
  value: string
  sub: string
  tone: Tone
}

// Editable thresholds — later promotable to a BenchmarkRef table.
export const BENCHMARKS = {
  stickiness: { good: 20, elite: 50 },   // DAU/MAU %
  wow: { good: 5, elite: 10 },           // WAU WoW %
  depth: { good: 4, elite: 8 },          // attempts / active
  accuracy: { lo: 55, hi: 85 },          // healthy accuracy band %
}

const toneStick = (v: number | null): Tone =>
  v == null ? 'pending' : v >= BENCHMARKS.stickiness.elite ? 'success' : v >= BENCHMARKS.stickiness.good ? 'success' : v >= 10 ? 'info' : 'warning'
const toneWow = (v: number | null): Tone =>
  v == null ? 'pending' : v >= BENCHMARKS.wow.elite ? 'success' : v >= BENCHMARKS.wow.good ? 'info' : v >= 0 ? 'warning' : 'danger'
const toneDepth = (v: number): Tone =>
  v >= BENCHMARKS.depth.elite ? 'success' : v >= BENCHMARKS.depth.good ? 'info' : v > 0 ? 'warning' : 'pending'
const toneAcc = (v: number | null): Tone =>
  v == null ? 'pending' : v >= BENCHMARKS.accuracy.lo && v <= BENCHMARKS.accuracy.hi ? 'success' : v < BENCHMARKS.accuracy.lo ? 'warning' : 'info'

const signed = (v: number | null) => (v == null ? '—' : (v > 0 ? '+' : '') + v + '%')

export function heroCards(o: GrowthOverview): HeroCard[] {
  return [
    { key: 'wau', label: 'Weekly active learners', value: compact(o.wau),
      sub: o.wowPct == null ? 'WoW —' : `${signed(o.wowPct)} WoW`, tone: toneWow(o.wowPct) },
    { key: 'stick', label: 'Stickiness · DAU/MAU', value: o.stickiness == null ? '—' : pct(o.stickiness),
      sub: `> ${BENCHMARKS.stickiness.good}% benchmark`, tone: toneStick(o.stickiness) },
    { key: 'new', label: 'New learners · 7d', value: compact(o.newLearners7d),
      sub: o.newWowPct == null ? 'WoW —' : `${signed(o.newWowPct)} WoW`, tone: toneWow(o.newWowPct) },
    { key: 'acc', label: 'Accuracy · 30d', value: o.accuracyPct == null ? '—' : pct(o.accuracyPct),
      sub: 'healthy 55–85%', tone: toneAcc(o.accuracyPct) },
  ]
}

export function buildScorecard(o: GrowthOverview): ScoreRow[] {
  return [
    { key: 'stick', label: 'DAU / MAU', value: o.stickiness == null ? '—' : pct(o.stickiness), tone: toneStick(o.stickiness),
      note: `> ${BENCHMARKS.stickiness.good}% strong · > ${BENCHMARKS.stickiness.elite}% elite`,
      detail: `${compact(o.dau)} daily / ${compact(o.mau)} monthly active. Stickiness is the share of monthly learners who show up on a given day — the truest engagement signal pre-revenue.` },
    { key: 'wow', label: 'WoW growth', value: signed(o.wowPct), tone: toneWow(o.wowPct),
      note: `> ${BENCHMARKS.wow.good}% good · > ${BENCHMARKS.wow.elite}% elite (YC)`,
      detail: `Weekly active went ${compact(o.wauPrev)} → ${compact(o.wau)}. Sustained 7%+ weekly is the YC default-alive bar.` },
    { key: 'depth', label: 'Depth · attempts/active', value: String(o.depth), tone: toneDepth(o.depth),
      note: `> ${BENCHMARKS.depth.good} healthy · > ${BENCHMARKS.depth.elite} deep`,
      detail: `${compact(o.attempts7d)} attempts across ${compact(o.wau)} weekly actives. Depth proxies habit strength and content sufficiency.` },
    { key: 'acc', label: 'Accuracy · 30d', value: o.accuracyPct == null ? '—' : pct(o.accuracyPct), tone: toneAcc(o.accuracyPct),
      note: 'healthy 55–85% band',
      detail: 'Below 55% suggests content is outrunning learners; above 85% suggests it is too easy to drive mastery gains.' },
    { key: 'retention', label: 'D30 retention', value: '—', tone: 'pending',
      note: 'one RPC away (hq_retention)',
      detail: 'The cohort triangle lands in the Retention sub-tab (P2) via hq_retention(). It reads the same item_attempts — no new instrumentation.' },
    { key: 'kfactor', label: 'k-factor', value: '—', tone: 'pending',
      note: '> 0.5 assisted · > 1 viral',
      detail: 'Needs invite→join events from the circle-invite flow. Until then virality is uninstrumented.' },
    { key: 'nrr', label: 'NRR', value: '—', tone: 'pending',
      note: '> 110% good · > 130% elite',
      detail: 'Activates once monetization events flow through hq_event. Engagement-stage today.' },
    { key: 'rule40', label: 'Rule of 40', value: '—', tone: 'pending',
      note: 'growth % + margin > 40',
      detail: 'Requires revenue. Surfaced now so the path to the revenue scorecard is explicit.' },
  ]
}

export interface GrowthInsight { tone: Tone; headline: string; body: string }

export function growthInsight(o: GrowthOverview): GrowthInsight {
  if (o.attemptsTotal === 0) {
    return { tone: 'pending', headline: 'No learning activity yet', body: 'Every metric lights up from the first answered lesson — these are real aggregates, never placeholders.' }
  }
  const strongRetention = o.stickiness != null && o.stickiness >= BENCHMARKS.stickiness.good
  const strongGrowth = o.wowPct != null && o.wowPct >= BENCHMARKS.wow.elite
  if (strongRetention && strongGrowth) {
    return { tone: 'success', headline: 'Engagement is unicorn-track',
      body: `${pct(o.stickiness)} stickiness and ${signed(o.wowPct)} weekly growth both clear top-quartile edtech. Monetization isn't switched on yet, so revenue ratios stay pending — next lever is virality.` }
  }
  if (o.wowPct != null && o.wowPct < 0) {
    return { tone: 'warning', headline: 'Weekly actives are contracting',
      body: `WAU fell ${signed(o.wowPct)} (${compact(o.wauPrev)} → ${compact(o.wau)}). Re-engagement is the priority before chasing acquisition.` }
  }
  return { tone: 'info', headline: 'Healthy engagement core',
    body: `${compact(o.wau)} weekly actives at ${o.stickiness == null ? '—' : pct(o.stickiness)} stickiness. Deepen the habit loop to push stickiness past the ${BENCHMARKS.stickiness.good}% bar.` }
}
