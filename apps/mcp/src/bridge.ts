// The Bridge — pure, read-only packet builders over the Circle HQ deterministic
// engine. No MCP here; just functions that assemble what a CEO would see when it
// "polls the offices". server.ts wraps these as MCP tools. Everything reuses the
// HQ engine (apps/hq/src/data/graph/*) — zero rebuild, provenance preserved.

import { NODES } from '../../hq/src/data/graph/seed'
import {
  nodeById, ownedBy, coverage, weakestLever, verdictsFor,
  blastRadius, allConsults, rootCause, sourceHealth,
} from '../../hq/src/data/graph/engine'
import { officeById, OFFICE_ORDER, OFFICE_CHAT } from '../../hq/src/data/graph/agents'
import { runModel, CASE_DEFAULTS, HORIZONS } from '../../hq/src/data/graph/model'
import type { Assumptions, Case } from '../../hq/src/data/graph/model'
import { costAt, LAYERS, TREASURY_PER_ACTIVE, fmtFamilies } from '../../hq/src/data/graph/scaleModel'
import { valuationEstimate, valuationLevers } from '../../hq/src/data/graph/valuation'
import type { GraphNode, GraphEdge, OfficeId, Health, Source, Verdict } from '../../hq/src/data/graph/types'

export const NORTH_STAR = 'ns.w2f'
export const OFFICE_IDS = OFFICE_ORDER as OfficeId[]

export const PROVENANCE_LEGEND: Record<Source, string> = {
  live: 'real, measured data',
  partial: 'some real inputs, some modeled',
  simulated: 'modeled / projected — NOT measured',
  placeholder: 'not wired yet — no data behind it',
}

// The one rule every tool carries into the LLM's context.
export const HONESTY_RULE =
  'Every value carries a `provenance` badge. NEVER present a simulated or ' +
  'placeholder number as if it were live/measured. Say "modeled" or "not yet ' +
  'instrumented" when the badge says so. Words before numbers.'

// ---- health helpers --------------------------------------------------------
const HRANK: Record<Health, number> = { red: 3, blind: 2, amber: 1, green: 0 }
function worstHealth(nodes: GraphNode[]): Health {
  let w: Health = 'green'
  for (const n of nodes) { const h = sourceHealth(n.status); if (HRANK[h] > HRANK[w]) w = h }
  return w
}
function healthMix(nodes: GraphNode[]) {
  const mix = { green: 0, amber: 0, red: 0, blind: 0 }
  for (const n of nodes) mix[sourceHealth(n.status)]++
  return mix
}
function nodeView(n: GraphNode) {
  return {
    id: n.id, label: n.label, kind: n.kind, owner: n.owner ?? null,
    provenance: n.status, health: sourceHealth(n.status),
    metric: n.metric?.label ?? null, note: n.note ?? null,
  }
}
function verdictView(v: Verdict) {
  const t = nodeById(v.targetNode)
  return { kind: v.kind, target: v.targetNode, targetLabel: t?.label ?? v.targetNode, laddersTo: v.laddersTo, by: v.by, status: v.status, rationale: v.rationale ?? null }
}
function consultView(e: GraphEdge) {
  const about = nodeById(e.about ?? '')
  return { from: e.from, to: e.to, about: e.about ?? null, aboutLabel: about?.label ?? null, type: e.consultType ?? null, status: e.status ?? null, note: e.note ?? null }
}
function openVerdicts(o: OfficeId): Verdict[] {
  return verdictsFor(o).filter(v => v.status === 'proposed' || v.status === 'active')
}
function consultsTouching(o: OfficeId): GraphEdge[] {
  return allConsults().filter(e => e.from === o || e.to === o)
}

// ---- the CEO's org snapshot ------------------------------------------------
export function orgBrief() {
  const ns = nodeById(NORTH_STAR)!
  const cov = coverage(NODES)
  const weakest = weakestLever()
  const offices = OFFICE_IDS.map(id => {
    const def = officeById(id)
    const owned = ownedBy(id)
    const open = openVerdicts(id)
    return {
      id, office: def.office, chief: def.chief, slice: def.slice,
      health: worstHealth(owned.length ? owned : [ns]),
      ownedNodes: owned.length,
      healthMix: healthMix(owned),
      openVerdicts: open.length,
      topVerdict: open[0] ? verdictView(open[0]) : null,
      sla: def.sla.map(s => ({ ...s })),
    }
  })
  return {
    northStar: { id: ns.id, label: ns.label, provenance: ns.status, health: sourceHealth(ns.status) },
    coverage: { grounded: cov.live + cov.partial, total: cov.total, pct: cov.pct, live: cov.live, partial: cov.partial, simulated: cov.simulated, placeholder: cov.placeholder },
    weakestLever: weakest ? nodeView(weakest) : null,
    offices,
    resolveQueue: allConsults().filter(e => e.status !== 'answered').map(consultView),
    legend: PROVENANCE_LEGEND,
    honesty: HONESTY_RULE,
  }
}

// ---- office packet (the CEO drilling into one chief) -----------------------
export function officeReport(office: OfficeId) {
  const def = officeById(office)
  const owned = ownedBy(office)
  const chat = OFFICE_CHAT[office]
  const packet: Record<string, unknown> = {
    id: office, office: def.office, chief: def.chief, slice: def.slice,
    brief: chat?.brief ?? null,
    keyQuestions: (chat?.chips ?? []).map(c => c.q),
    sla: def.sla.map(s => ({ ...s })),
    health: worstHealth(owned),
    healthMix: healthMix(owned),
    ownedNodes: owned.map(nodeView),
    openVerdicts: openVerdicts(office).map(verdictView),
    consults: consultsTouching(office).map(consultView),
    legend: PROVENANCE_LEGEND,
    honesty: HONESTY_RULE,
  }
  // office-specific lenses — reuse the same engines the app renders
  if (office === 'treasury') packet.financialModel = financialModel({})
  if (office === 'technology') {
    packet.coverage = orgBrief().coverage
    packet.scaleModel = scaleModel(10000)
  }
  return packet
}

// ---- hierarchical CEO: route a question to the right office(s) -------------
const ROUTES: { office: OfficeId; hints: string[] }[] = [
  { office: 'treasury', hints: ['money', 'cash', 'revenue', 'profit', 'npv', 'break', 'breakeven', 'runway', 'price', 'unit econ', 'margin', 'cac', 'ltv', 'p&l', 'pnl', 'monetiz'] },
  { office: 'technology', hints: ['coverage', 'instrument', 'blind', 'infra', 'architecture', 'scale', 'cost', 'stack', 'activation', 'efficiency', 'event', 'signal', 'engineering', 'latency'] },
  { office: 'operations', hints: ['retention', 'depth', 'frequency', 'hook', 'churn', 'engagement', 'content', 'curr', 'ladder', 'cut', 'deepen', 'breadth', 'acquisition'] },
  { office: 'legal', hints: ['risk', 'consent', 'legal', 'hold', 'ip', 'ugc', 'trust', 'compliance', 'privacy'] },
  { office: 'roster', hints: ['agent', 'roster', 'roi', 'token', 'guild', 'capo', 'workforce', 'replace', 'improve'] },
  { office: 'bridge', hints: ['strategy', 'overall', 'north star', 'priorit', 'resolve', 'decision', 'org', 'everything', 'summary'] },
]
function routeOffices(question: string, focus?: OfficeId): OfficeId[] {
  if (focus) return [focus]
  const q = question.toLowerCase()
  const hit = ROUTES.filter(r => r.hints.some(h => q.includes(h))).map(r => r.office)
  if (hit.includes('bridge') || hit.length === 0) return OFFICE_IDS   // org-wide
  return Array.from(new Set(hit))
}

export function askCeo(question: string, focus?: OfficeId) {
  const routed = routeOffices(question, focus)
  const orgWide = routed.length === OFFICE_IDS.length
  return {
    question,
    routedTo: routed,
    routing: focus ? 'explicit focus' : orgWide ? 'org-wide (no single office matched)' : 'keyword-routed',
    org: orgWide ? orgBrief() : { northStar: orgBrief().northStar, coverage: orgBrief().coverage },
    offices: routed.map(officeReport),
    guidance:
      'You are the CEO of Circle HQ. Synthesize ONE decision-grade answer for the operator ' +
      'from the office packets above. Lead with the call, then the why, then the number (with its ' +
      'provenance). If the deciding number is simulated/placeholder, say so and name the event that ' +
      'would make it live.',
    honesty: HONESTY_RULE,
  }
}

// ---- data tools ------------------------------------------------------------
export interface GraphFilter { kind?: string; office?: OfficeId; source?: Source; lever?: string }
export function graphQuery(f: GraphFilter = {}) {
  let ns = NODES.slice()
  if (f.kind) ns = ns.filter(n => n.kind === f.kind)
  if (f.office) ns = ns.filter(n => n.owner === f.office)
  if (f.source) ns = ns.filter(n => n.status === f.source)
  if (f.lever) ns = ns.filter(n => n.levers?.includes(f.lever as never))
  return { filter: f, count: ns.length, nodes: ns.map(nodeView), legend: PROVENANCE_LEGEND }
}

export function nodeGet(id: string) {
  const n = nodeById(id)
  if (!n) return { error: `no node '${id}'`, hint: 'use graph_query to list ids' }
  const owner = n.owner ? officeById(n.owner) : null
  const isSignal = n.kind === 'signal' || n.kind === 'metric'
  return {
    node: nodeView(n),
    ownedBy: owner ? { id: owner.id, office: owner.office, chief: owner.chief } : null,
    children: NODES.filter(c => c.parent === id).map(nodeView),
    blastRadius: isSignal ? blastRadius(id) : [],
    legend: PROVENANCE_LEGEND,
    honesty: HONESTY_RULE,
  }
}

export function verdictQueue(office?: OfficeId) {
  const list = (office ? [office] : OFFICE_IDS).flatMap(o => openVerdicts(o).map(v => ({ office: o, ...verdictView(v) })))
  return { count: list.length, verdicts: list, note: 'Every verdict LADDERS_TO a lever/stage/coverage node — no orphan opinions.' }
}

export function rootCauseChain() {
  return { chain: rootCause(), note: 'North Star → weakest lever → least-instrumented surface → the missing event. Deterministic RCA.', honesty: HONESTY_RULE }
}

// ---- money & scale (the two quantified engines) ----------------------------
export interface FinInput { case?: Case; months?: number; overrides?: Partial<Assumptions> }
export function financialModel({ case: c = 'mid', months = 24, overrides = {} }: FinInput) {
  const a: Assumptions = { ...CASE_DEFAULTS[c], ...overrides }
  const r = runModel(a, months)
  const sample = (i: number) => { const row = r.rows[i]; return row ? { month: row.m, active: Math.round(row.active), payers: Math.round(row.payers), revenue: Math.round(row.revenue), net: Math.round(row.net), cum: Math.round(row.cum) } : null }
  return {
    provenance: 'simulated' as Source,
    case: c, months, assumptions: a,
    horizons: HORIZONS.map(h => ({ ...h })),
    result: {
      arpu: +r.arpu.toFixed(2),
      contributionPerActive: +r.contributionPerActive.toFixed(4),
      steadyBreakevenActives: r.steadyBreakeven != null ? Math.round(r.steadyBreakeven) : null,
      firstPositiveMonth: r.firstPositiveMonth,
      cumNet: Math.round(r.cumNet),
      npv: Math.round(r.npv),
      endActive: Math.round(r.endActive),
      endPayers: Math.round(r.endPayers),
      householdD30: +r.householdD30.toFixed(3),
    },
    sampleRows: [sample(0), sample(Math.floor(months / 2)), sample(months - 1)].filter(Boolean),
    honesty: HONESTY_RULE + ' This model is `simulated` — every output is a projection, not a measurement.',
  }
}

export function scaleModel(families = 10000) {
  const c = costAt(families)
  const byLayer = LAYERS.map(L => ({ key: L.key, label: L.label, monthly: Math.round((c as never)[L.key]), sub: L.sub, scalesWith: L.scalesWith }))
  const tier = families < 50_000 ? 'Supabase Pro' : families < 300_000 ? 'Pro + compute' : 'Dedicated / replicas'
  return {
    provenance: 'simulated' as Source,
    families, familiesLabel: fmtFamilies(families),
    monthlyTotal: Math.round(c.total),
    perActive: +c.perActive.toFixed(4),
    treasuryLoad: TREASURY_PER_ACTIVE,
    underTreasuryLoad: c.perActive <= TREASURY_PER_ACTIVE,
    dataTier: tier,
    byLayer,
    honesty: HONESTY_RULE + ' Cost shapes are `simulated` — real pricing, projected volumes.',
  }
}

// ---- The Actuary — valuation (owner Treasury) ------------------------------
export function valuation(asOf = 'current') {
  return valuationEstimate(asOf)
}

export function valuationLeverList() {
  return { levers: valuationLevers(), honesty: HONESTY_RULE + ' Impacts are deterministic deltas over the same graph — what would move the number, ranked.' }
}

// history lives in the valuation_snapshot ledger (Supabase); this deterministic
// deployment returns the current point + how to read the series
export function valuationHistory() {
  const e = valuationEstimate('current')
  return {
    note: 'Time series lives in the valuation_snapshot ledger (Supabase). This deployment is deterministic-seed + read-only, so it returns the current point only.',
    current: { asOf: e.asOf, recommended: e.recommended, weightsMode: e.synthesized.weightsMode },
    honesty: HONESTY_RULE,
  }
}

// packages the estimate + a chair-framing template for the CALLING llm to
// synthesize — no server-side model call, same pattern as ceo_ask
export function valuationNarrative(asOf = 'current') {
  const estimate = valuationEstimate(asOf)
  return {
    estimate,
    chairs: {
      VC: 'Price the floor, not the story. Which methods assume a fundraise-ready team this company has not tested?',
      Angel: 'Back the builder. What single milestone most tightens this range, and how cheap is it?',
      CEO: 'Sequencing — what is the fastest path to flip stage.pay live and re-rate?',
      CTO: 'Which instrumentation gaps hold the technology-risk factor down?',
      CFO: 'State the recommended range, its provenance, and the one input that would move it most.',
    },
    guidance: 'You are the Actuary. Give ONE decision-grade valuation read for the founder: the recommended range, the driver of change, and the top lever — each with its provenance. Never present a simulated method as measured.',
    honesty: estimate.honesty,
  }
}
