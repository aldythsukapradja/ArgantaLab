// Domain insight builders — same Insight shape as the series engine, so the
// LLM can later replace any of these behind the identical contract. Each
// surface calls one of these so every visual carries an insight.

import type { Insight } from '../contract/insight'
import type { FeatureAdoption, EconomyFlow, CohortRow } from '../contract/metrics'

const round = (n: number) => Math.round(n)

/** Features: flag dead weight + name the hero to propagate. */
export function featureInsight(f: FeatureAdoption[]): Insight {
  const dead = f.find((x) => x.verdict === 'dead') ?? f.find((x) => x.verdict === 'watch')
  const hero = f.find((x) => x.verdict === 'hero')
  if (dead && hero)
    return { ruleId: 'feature-verdict', source: 'rule', severity: 'warn',
      headline: `${dead.label} (${dead.adoptionPct}%, ${dead.trend}) is dead weight — merge or cut. ${hero.label} is your hero — its pattern lifts retention; propagate it via App Builder.`,
      action: 'Propagate hero' }
  if (dead)
    return { ruleId: 'feature-verdict', source: 'rule', severity: 'warn',
      headline: `${dead.label} at ${dead.adoptionPct}% and ${dead.trend} — candidate to cut or merge.`, action: 'Review' }
  if (hero)
    return { ruleId: 'feature-verdict', source: 'rule', severity: 'success',
      headline: `${hero.label} is a hero (${hero.adoptionPct}%) — propagate its pattern to weaker apps.`, action: 'Propagate hero' }
  return { ruleId: 'feature-verdict', source: 'rule', severity: 'info', headline: 'All features in a healthy band.' }
}

/** Economy: earn vs spend imbalance + sink coverage. */
export function economyInsight(e: EconomyFlow): Insight {
  const earn = e.sources.reduce((s, x) => s + x.amount, 0)
  const spend = e.sinks.reduce((s, x) => s + x.amount, 0)
  const cov = e.sinkCoverage
  if (earn > spend * 1.25)
    return { ruleId: 'economy-imbalance', source: 'rule', severity: 'warn',
      headline: `Earn (${round(earn / 1000)}k) outpaces spend (${round(spend / 1000)}k) — sink coverage ${cov.toFixed(2)}× means diamonds are inflating. Add a sink or raise prices before new earn loops.`,
      action: 'Open economy model' }
  if (cov > 1.1)
    return { ruleId: 'economy-imbalance', source: 'rule', severity: 'warn',
      headline: `Spend outpaces earn (coverage ${cov.toFixed(2)}×) — players may run dry. Add an earn loop.` }
  return { ruleId: 'economy-imbalance', source: 'rule', severity: 'success',
    headline: `Economy balanced — sink coverage ${cov.toFixed(2)}×, float healthy.` }
}

/** Audience: find a cohort whose D30 dropped vs the prior cohort. */
export function cohortInsight(rows: CohortRow[]): Insight {
  const done = rows.filter((r) => r.d30 != null)
  for (let i = done.length - 1; i >= 1; i--) {
    const cur = done[i].d30!, prev = done[i - 1].d30!
    if (cur < prev - 3)
      return { ruleId: 'cohort-decay', source: 'rule', severity: 'warn',
        headline: `${done[i].label} D30 fell to ${cur}% (from ${prev}%) — traces to circles that never hit the core loop in week 1. Lever: nudge first activation.`,
        action: 'Show drivers' }
  }
  return { ruleId: 'cohort-decay', source: 'rule', severity: 'success',
    headline: 'Retention holding across cohorts — D30 stable or improving.' }
}
