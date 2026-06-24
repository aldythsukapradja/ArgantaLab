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
  what: string       // plain-English "what is this" (executive altitude)
  detail: string     // driver / context (consulting altitude, on click)
}

export interface HeroCard {
  key: string
  label: string
  value: string
  sub: string
  tone: Tone
  what: string       // plain-English definition for non-experts
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
      sub: o.wowPct == null ? 'WoW —' : `${signed(o.wowPct)} WoW`, tone: toneWow(o.wowPct),
      what: 'How many unique kids actually used the app in the last 7 days — the truest pulse of real usage. "WoW" is the change versus the week before.' },
    { key: 'stick', label: 'Stickiness · DAU/MAU', value: o.stickiness == null ? '—' : pct(o.stickiness),
      sub: `> ${BENCHMARKS.stickiness.good}% benchmark`, tone: toneStick(o.stickiness),
      what: 'Of everyone who used the app this month (MAU = monthly active users), the share who show up on an average day (DAU = daily active users). Higher means more of a daily habit. Above 20% is strong for a consumer app.' },
    { key: 'new', label: 'New learners · 7d', value: compact(o.newLearners7d),
      sub: o.newWowPct == null ? 'WoW —' : `${signed(o.newWowPct)} WoW`, tone: toneWow(o.newWowPct),
      what: 'How many brand-new kids signed up in the last 7 days — your top-of-funnel growth. "WoW" compares it to the prior week.' },
    { key: 'acc', label: 'Accuracy · 30d', value: o.accuracyPct == null ? '—' : pct(o.accuracyPct),
      sub: 'healthy 55–85%', tone: toneAcc(o.accuracyPct),
      what: 'The average share of questions answered correctly over 30 days. Too low (<55%) means content is too hard; too high (>85%) means it is too easy to drive real learning.' },
  ]
}

export function buildScorecard(o: GrowthOverview): ScoreRow[] {
  const wauMau = o.mau > 0 ? Math.round((o.wau / o.mau) * 1000) / 10 : null
  return [
    { key: 'stick', label: 'DAU / MAU', value: o.stickiness == null ? '—' : pct(o.stickiness), tone: toneStick(o.stickiness),
      note: `> ${BENCHMARKS.stickiness.good}% strong · > ${BENCHMARKS.stickiness.elite}% elite`,
      what: 'Of everyone active this month, the share active on an average day. The single best daily-habit signal.',
      detail: `${compact(o.dau)} daily / ${compact(o.mau)} monthly active. The truest engagement signal pre-revenue.` },
    { key: 'wauMau', label: 'WAU / MAU', value: wauMau == null ? '—' : pct(wauMau), tone: toneStick(wauMau),
      note: '> 50% strong weekly habit',
      what: 'Of everyone active this month, the share active in a given week — a gentler habit gauge than DAU/MAU.',
      detail: `${compact(o.wau)} weekly / ${compact(o.mau)} monthly active. Useful when usage is weekly rather than daily.` },
    { key: 'wow', label: 'WoW growth', value: signed(o.wowPct), tone: toneWow(o.wowPct),
      note: `> ${BENCHMARKS.wow.good}% good · > ${BENCHMARKS.wow.elite}% elite (YC)`,
      what: 'How much weekly active users grew versus the prior week. Sustained 10%+ is elite, early-stage rocket growth.',
      detail: `Weekly active went ${compact(o.wauPrev)} → ${compact(o.wau)}. Sustained 7%+ weekly is the YC default-alive bar.` },
    { key: 'depth', label: 'Depth · attempts/active', value: String(o.depth), tone: toneDepth(o.depth),
      note: `> ${BENCHMARKS.depth.good} healthy · > ${BENCHMARKS.depth.elite} deep`,
      what: 'How many questions each active learner attempts per week — a proxy for how strong the habit is.',
      detail: `${compact(o.attempts7d)} attempts across ${compact(o.wau)} weekly actives. Proxies habit strength and content sufficiency.` },
    { key: 'acc', label: 'Accuracy · 30d', value: o.accuracyPct == null ? '—' : pct(o.accuracyPct), tone: toneAcc(o.accuracyPct),
      note: 'healthy 55–85% band',
      what: 'Average % of questions answered correctly. The sweet spot keeps kids challenged but succeeding.',
      detail: 'Below 55% suggests content is outrunning learners; above 85% suggests it is too easy to drive mastery gains.' },
    { key: 'mau', label: 'Monthly reach · MAU', value: compact(o.mau), tone: 'info',
      note: 'unique learners / 30d',
      what: 'How many unique kids used the app at least once in the last 30 days — your total monthly reach.',
      detail: `${compact(o.mau)} monthly active out of ${compact(o.learners)} total signups.` },
    { key: 'retention', label: 'D30 retention', value: '—', tone: 'pending',
      note: '> 35% top-quartile edtech',
      what: 'Of kids who joined, the share still active 30 days later. The #1 number investors check — it proves the product keeps people.',
      detail: 'The cohort triangle lives in the Retention sub-tab via hq_retention(). Reads the same item_attempts — no new instrumentation.' },
    { key: 'kfactor', label: 'k-factor', value: '—', tone: 'pending',
      note: '> 0.5 assisted · > 1 viral',
      what: 'How many new users each existing user brings in through invites. Above 1 means the product grows itself, virally.',
      detail: 'Needs invite→join events from the circle-invite flow. Until then virality is uninstrumented.' },
    { key: 'nrr', label: 'NRR', value: '—', tone: 'pending',
      note: '> 110% good · > 130% elite',
      what: 'Net revenue retention — whether existing customers spend more or less over a year. Above 100% means revenue grows even with zero new sign-ups.',
      detail: 'Activates once monetization events flow through hq_event. Engagement-stage today.' },
    { key: 'rule40', label: 'Rule of 40', value: '—', tone: 'pending',
      note: 'growth % + margin > 40',
      what: 'A balance test for scaling companies: your growth rate plus profit margin should exceed 40%.',
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
