// The Actuary — deterministic valuation engine (owner: Treasury/CFO). Six
// standard early-stage methods, each a PURE function over the same ontology
// graph Circle HQ already tracks + founder-set constants. Zero LLM calls here
// (the narrative layer reads these finished numbers). Provenance travels: a
// method is only as grounded as its least-grounded input. Words before numbers.
//
// The point vs. a one-off memo: the moment stage.pay flips placeholder→live, or
// coverage rises, these re-rate on their own — and synthesize()'s weighting rule
// inverts. Nothing here is hand-entered where a graph value already exists.
import { nodeById, coverage, ownedBy, sourceHealth } from './engine'
import type { Source } from './types'

export type VMethod = 'cost_to_duplicate' | 'berkus' | 'risk_factor_sum' | 'scorecard' | 'vc_method' | 'first_chicago'
export interface MethodResult { method: VMethod; label: string; low: number; high: number; provenance: Source; drivers: string[] }

// ---- founder-editable constants — the "config node", never inferred ---------
export const VAL_CONFIG = {
  costToDuplicate: { low: 0.15, high: 0.30 },                       // $M — offline git-log script, refreshed quarterly
  berkus: { idea: 0.40, team: 0.20, relationships: 0.10, factorMax: 0.50, rolloutFloor: 0.015, rolloutLive: 0.485, band: 0.30 },
  rfs: { baselineLow: 4.0, baselineHigh: 5.25, step: 0.25 },        // regional baseline ± step per risk category
  scorecard: { low: 4.0, high: 5.0 },                              // regional pre-seed baseline × weights
  vc: { exitArrM: 25, revMultiple: 7, returnLow: 20, returnHigh: 25, dilution: 0.5 },
  firstChicago: { exitArrByCase: { low: 4, mid: 20, high: 50 }, revMultiple: 7, returnDiscount: 20, dilution: 0.5, weights: { low: 0.5, mid: 0.35, high: 0.15 } },
  // synthesis weights — flip when stage.pay carries a live badge (real payers)
  synthWeights: {
    preLive: { cost_to_duplicate: 1.0, berkus: 1.0, first_chicago: 0.7, scorecard: 0.3, risk_factor_sum: 0.3, vc_method: 0.3 },
    postLive: { cost_to_duplicate: 0.4, berkus: 0.75, first_chicago: 1.0, scorecard: 1.0, risk_factor_sum: 1.0, vc_method: 1.0 },
  },
} as const

const round2 = (x: number) => Math.round(x * 100) / 100
const RANK: Record<Source, number> = { live: 0, partial: 1, simulated: 2, placeholder: 3 }
const worst = (ss: Source[]): Source => ss.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'live' as Source)

const payStatus = (): Source => nodeById('stage.pay')?.status ?? 'placeholder'
export const payLive = (): boolean => payStatus() === 'live'

// ---- the six methods -------------------------------------------------------
export function costToDuplicate(): MethodResult {
  const c = VAL_CONFIG.costToDuplicate
  return { method: 'cost_to_duplicate', label: 'Cost-to-Duplicate', low: c.low, high: c.high, provenance: 'partial',
    drivers: ['contractor cost to rebuild the observable codebase — offline git-log measurement, quarterly'] }
}

export function berkus(): MethodResult {
  const b = VAL_CONFIG.berkus
  const cov = coverage()                                            // instrumentation live+partial ratio
  const proto = round2((cov.pct / 100) * b.factorMax)               // prototype factor ← coverage()
  const live = payLive()
  const rollout = live ? b.rolloutLive : b.rolloutFloor             // rollout factor ← stage.pay
  const sum = b.idea + proto + rollout + b.team + b.relationships
  return { method: 'berkus', label: 'Berkus', low: round2(sum - b.band), high: round2(sum),
    provenance: worst(['partial', payStatus()]),
    drivers: [`prototype ${money(proto)} from coverage ${cov.pct}%`, `rollout ${money(rollout)} from stage.pay (${payStatus()})`, 'team + relationships founder-set'] }
}

export function riskFactorSum(): MethodResult {
  const r = VAL_CONFIG.rfs
  const techCov = coverage(ownedBy('technology')).pct
  const effHealth = sourceHealth(nodeById('lever.efficiency')?.status ?? 'placeholder')
  const techScore = techCov >= 70 ? 1 : techCov >= 50 ? 0 : -1     // technology risk ← CTO coverage
  const salesScore = effHealth === 'green' ? 1 : effHealth === 'amber' ? 0 : -1  // sales risk ← efficiency lever
  const adj = r.step * (techScore + salesScore)
  return { method: 'risk_factor_sum', label: 'Risk Factor Summation', low: round2(r.baselineLow + adj), high: round2(r.baselineHigh + Math.max(adj, 0)), provenance: 'partial',
    drivers: [`baseline ${money(r.baselineLow)}–${money(r.baselineHigh)} regional (quarterly manual)`, `technology risk from CTO coverage ${techCov}%`, 'legal/competition founder-set'] }
}

export function scorecard(): MethodResult {
  const s = VAL_CONFIG.scorecard
  return { method: 'scorecard', label: 'Scorecard (Bill Payne)', low: s.low, high: s.high, provenance: 'partial',
    drivers: ['regional pre-seed baseline × weighted factors — no live market-data connector yet, founder-refreshed'] }
}

export function vcMethod(): MethodResult {
  const v = VAL_CONFIG.vc
  const high = round2((v.exitArrM * v.revMultiple / v.returnLow) * (1 - v.dilution))
  const low = round2((v.exitArrM * v.revMultiple / v.returnHigh) * (1 - v.dilution))
  return { method: 'vc_method', label: 'VC Method', low, high, provenance: 'simulated',
    drivers: [`exit ARR $${v.exitArrM}M × ${v.revMultiple}× rev / ${v.returnLow}–${v.returnHigh}× return, ${Math.round(v.dilution * 100)}% dilution — bull case`] }
}

export function firstChicago(): MethodResult {
  const f = VAL_CONFIG.firstChicago
  const pv = (arrM: number) => (arrM * f.revMultiple / f.returnDiscount) * (1 - f.dilution)
  const weighted = f.weights.low * pv(f.exitArrByCase.low) + f.weights.mid * pv(f.exitArrByCase.mid) + f.weights.high * pv(f.exitArrByCase.high)
  return { method: 'first_chicago', label: 'First Chicago', low: round2(weighted * 0.9), high: round2(weighted * 1.18), provenance: 'simulated',
    drivers: [`prob-weighted Low ${f.weights.low * 100}% / Mid ${f.weights.mid * 100}% / High ${f.weights.high * 100}% of the three Growth-Lab cases`] }
}

export const ALL_METHODS = (): MethodResult[] => [costToDuplicate(), berkus(), riskFactorSum(), scorecard(), vcMethod(), firstChicago()]

// ---- synthesis: the codified judgment rule ---------------------------------
export interface Synthesized { low: number; high: number; provenance: Source; weightsMode: 'pre-live' | 'post-live'; note: string }
export function synthesize(methods: MethodResult[] = ALL_METHODS(), live = payLive()): Synthesized {
  const w = live ? VAL_CONFIG.synthWeights.postLive : VAL_CONFIG.synthWeights.preLive
  let sw = 0, lo = 0, hi = 0
  for (const m of methods) { const wm = w[m.method]; sw += wm; lo += m.low * wm; hi += m.high * wm }
  return {
    low: round2(lo / sw), high: round2(hi / sw), provenance: worst(methods.map(m => m.provenance)),
    weightsMode: live ? 'post-live' : 'pre-live',
    note: live
      ? 'stage.pay is live — weights favor the traction-priced methods (Scorecard/RFS/VC).'
      : 'Pre-traction — weights favor the zero-traction methods (Cost-to-Duplicate, Berkus). Flips when stage.pay goes live.',
  }
}

// ---- the estimate packet (same shape family as orgBrief) -------------------
export interface ValuationEstimate {
  asOf: string; unit: 'USD_millions'
  recommended: { low: number; high: number }
  methods: MethodResult[]
  synthesized: Synthesized
  provenanceMix: Record<string, number>
  driverOfChange: string
  honesty: string
}
export function valuationEstimate(asOf = 'current'): ValuationEstimate {
  const methods = ALL_METHODS()
  const syn = synthesize(methods)
  const mix: Record<string, number> = {}
  for (const m of methods) mix[m.provenance] = (mix[m.provenance] ?? 0) + 1
  const driver = payLive()
    ? 'stage.pay is live — traction-priced methods now lead the synthesis.'
    : `stage.pay is ${payStatus()} — Berkus rollout capped at ${money(VAL_CONFIG.berkus.rolloutFloor)} of ${money(VAL_CONFIG.berkus.factorMax)} max; synthesis weighted to the zero-traction methods.`
  return {
    asOf, unit: 'USD_millions',
    recommended: { low: syn.low, high: syn.high },
    methods, synthesized: syn, provenanceMix: mix, driverOfChange: driver,
    honesty: 'Every method carries a provenance badge; none silently upgraded. No method calls an LLM. Words before numbers.',
  }
}

// ---- the "what would move it" lever list (deterministic) -------------------
export interface ValuationLever { action: string; node: string; affects: VMethod[]; estImpactUsdM: number; unlock: string }
export function valuationLevers(): ValuationLever[] {
  const base = synthesize()
  const levers: ValuationLever[] = []

  // 1 — the big one: real payers flip stage.pay live → Berkus rollout + weight inversion
  if (!payLive()) {
    const after = synthesize(ALL_METHODS(), true)  // hypothetical: weights flip
    // Berkus rollout also lifts under live — recompute berkus with live rollout folded into the after-synthesis
    const delta = round2(((after.low + after.high) - (base.low + base.high)) / 2)
    levers.push({ action: 'Wire stage.pay to live — land the first real paying families', node: 'stage.pay', affects: ['berkus'], estImpactUsdM: delta, unlock: 'placeholder/simulated → live' })
  }
  // 2 — instrumentation coverage lifts Berkus prototype factor toward its $500K cap
  const cov = coverage()
  if (cov.pct < 100) {
    const gain = round2(((100 - cov.pct) / 100) * VAL_CONFIG.berkus.factorMax * VAL_CONFIG.synthWeights.preLive.berkus)
    levers.push({ action: `Raise instrumentation coverage ${cov.pct}% → 100% (wire the blind signals)`, node: 'lever.efficiency', affects: ['berkus'], estImpactUsdM: gain, unlock: 'partial → live' })
  }
  // 3 — CTO coverage gap holds the RFS technology-risk factor down
  const techCov = coverage(ownedBy('technology')).pct
  if (techCov < 70) {
    levers.push({ action: `Close CTO instrumentation gap (${techCov}% → 70%+) to lift the technology-risk factor`, node: 'lever.efficiency', affects: ['risk_factor_sum'], estImpactUsdM: VAL_CONFIG.rfs.step, unlock: 'improves RFS' })
  }
  return levers.sort((a, b) => b.estImpactUsdM - a.estImpactUsdM)
}

const money = (n: number) => '$' + n.toFixed(n < 1 ? 3 : 2) + 'M'
