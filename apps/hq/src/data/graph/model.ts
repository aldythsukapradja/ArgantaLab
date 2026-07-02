// Treasury model — the Growth-Lab demand engine × the money engine, unified.
// Deterministic; mirrors scratch/treasury_model.py. Everything here is
// `simulated` provenance: real family base wires in at P3, rates stay modelled.
//
//   demand sliders (retention/virality) ─▶ family curve ─▶ × conv × ARPU ─▶ revenue
//   money sliders  ───────────────────────────────────▶ − cost stack ─▶ cashflow ─▶ NPV

export type Case = 'low' | 'mid' | 'high'

export interface Assumptions {
  // money engine
  conv: number        // free → paid (fraction of families)
  listPrice: number   // subscription $/mo (list; discounts applied in effArpu)
  infraActive: number // $/active family/mo  (the swing variable)
  cac: number         // $/net-new active family
  churn: number
  cap: number         // demand ceiling (families) over the horizon
  // demand engine (Growth Lab)
  kidD30: number      // kid D30 retention (fraction)
  parentD30: number   // parent D30 retention (fraction) — the multiplier
}

export const CASE_DEFAULTS: Record<Case, Assumptions> = {
  low:  { conv: 0.02, listPrice: 4.99, infraActive: 0.08, cac: 1.5, churn: 0.08, cap: 3000,  kidD30: 0.17, parentD30: 0.29 },
  mid:  { conv: 0.04, listPrice: 6.99, infraActive: 0.08, cac: 1.5, churn: 0.05, cap: 10000, kidD30: 0.19, parentD30: 0.34 },
  high: { conv: 0.08, listPrice: 9.99, infraActive: 0.08, cac: 1.5, churn: 0.03, cap: 25000, kidD30: 0.22, parentD30: 0.45 },
}

// shared cost stack
export const FIXED_MO = 63          // Supabase 25 + Vercel 20 + misc 15 + agents 3
export const PROCESSING = 0.15      // store cut
export const INFRA_REG = 0.002      // $/registered/mo
export const REG_MULT = 2.0
export const DIAMOND_GRANT = 10000  // 💎/subscriber/mo (a mint, not cash)
const DISCOUNT_ANNUAL = 0.15
const HORIZON = 24
const A0 = 300

// discount ladder folded into annual (2mo free) + seasonal (Eid/Christmas/Summer)
export function effArpu(list: number): number {
  const annual = list * 10 / 12
  const seasonal = list * (9 + 3 * 0.6) / 12
  return 0.50 * list + 0.35 * annual + 0.15 * seasonal
}

// two-hook household retention — the Growth Lab math. Lifts the effective cap.
export function householdD30(a: Assumptions): number {
  return 1 - (1 - a.kidD30) * (1 - a.parentD30)
}
function effectiveCap(a: Assumptions): number {
  // retention scales how much of the ceiling is actually held (0.5..1.5×)
  return a.cap * (0.5 + householdD30(a))
}

function logistic(t: number, cap: number): number {
  const L = cap / (1 + Math.exp(-0.32 * (t - 11)))
  return Math.max(A0, L)
}

export interface MonthRow { m: number; active: number; payers: number; revenue: number; net: number; cum: number }
export interface ModelResult {
  rows: MonthRow[]
  arpu: number
  contributionPerActive: number   // the knife-edge vs infra load
  steadyBreakeven: number | null  // active families for +cashflow (null = never)
  firstPositiveMonth: number | null
  cumNet: number
  npv: number
  endActive: number
  endPayers: number
  diamondMintEnd: number
  householdD30: number
}

export function runModel(a: Assumptions): ModelResult {
  const arpu = effArpu(a.listPrice)
  const rm = Math.pow(1 + DISCOUNT_ANNUAL, 1 / 12) - 1
  const cap = effectiveCap(a)
  const rows: MonthRow[] = []
  let cum = 0, npv = 0, prev = A0, firstPositive: number | null = null
  for (let m = 1; m <= HORIZON; m++) {
    const active = logistic(m, cap)
    const registered = active * REG_MULT
    const payers = active * a.conv
    const newActive = Math.max(0, active - prev) + a.churn * prev
    const revenue = payers * arpu
    const netRev = revenue * (1 - PROCESSING)
    const infra = active * a.infraActive + registered * INFRA_REG
    const cacCost = newActive * a.cac
    const net = netRev - infra - cacCost - FIXED_MO
    cum += net
    npv += net / Math.pow(1 + rm, m)
    if (firstPositive === null && net > 0) firstPositive = m
    rows.push({ m, active, payers, revenue, net, cum })
    prev = active
  }
  const perActive = a.conv * arpu * (1 - PROCESSING) - a.infraActive - REG_MULT * INFRA_REG
  const steadyBreakeven = perActive > 0 ? FIXED_MO / perActive : null
  const end = rows[rows.length - 1]
  return {
    rows, arpu, contributionPerActive: perActive, steadyBreakeven,
    firstPositiveMonth: firstPositive, cumNet: cum, npv,
    endActive: end.active, endPayers: end.payers,
    diamondMintEnd: end.payers * DIAMOND_GRANT, householdD30: householdD30(a),
  }
}

export interface SliderMeta { key: keyof Assumptions; label: string; min: number; max: number; step: number; unit: '%' | '$'; pct?: boolean }
export const SLIDERS: SliderMeta[] = [
  { key: 'parentD30', label: 'Parent D30 (the multiplier)', min: 10, max: 55, step: 1, unit: '%', pct: true },
  { key: 'conv', label: 'Free → paid conversion', min: 0.5, max: 12, step: 0.5, unit: '%', pct: true },
  { key: 'infraActive', label: 'Infra $ / active (the swing)', min: 0.02, max: 0.2, step: 0.01, unit: '$' },
  { key: 'listPrice', label: 'Subscription price / mo', min: 2.99, max: 14.99, step: 1, unit: '$' },
]
