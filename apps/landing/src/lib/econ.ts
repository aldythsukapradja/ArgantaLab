// ── ECON — the real unit-economics engine, mirrored from Circle HQ
// (apps/hq/src/data/graph/model.ts + scaleModel.ts). Deterministic. This replaces
// the old stale LTV/CAC guess. Two engines feed the pitch:
//   1) Treasury model  — demand (logistic families) × money → cashflow, NPV, break-even
//   2) Scale model     — per-layer cost 1k→1M families → the "$0.08/active" story

export type CaseKey = 'low' | 'mid' | 'high'

export interface Assumptions {
  conv: number; listPrice: number; infraActive: number; cac: number
  churn: number; cap: number; kidD30: number; parentD30: number
}

export const CASES: Record<CaseKey, Assumptions> = {
  low:  { conv: 0.02, listPrice: 4.99, infraActive: 0.08, cac: 1.5, churn: 0.08, cap: 3000,  kidD30: 0.17, parentD30: 0.29 },
  mid:  { conv: 0.04, listPrice: 6.99, infraActive: 0.08, cac: 1.5, churn: 0.05, cap: 10000, kidD30: 0.19, parentD30: 0.34 },
  high: { conv: 0.08, listPrice: 9.99, infraActive: 0.08, cac: 1.5, churn: 0.03, cap: 25000, kidD30: 0.22, parentD30: 0.45 },
}

export const FIXED_MO = 63          // Supabase 25 + Vercel 20 + misc 15 + agents 3
export const PROCESSING = 0.15      // store cut
export const INFRA_REG = 0.002      // $/registered/mo
export const REG_MULT = 2.0
const DISCOUNT_ANNUAL = 0.15
const A0 = 300

// discount ladder folded into annual (2mo free) + seasonal (Eid/Christmas/Summer)
export function effArpu(list: number): number {
  const annual = list * 10 / 12
  const seasonal = list * (9 + 3 * 0.6) / 12
  return 0.50 * list + 0.35 * annual + 0.15 * seasonal
}
// two-hook household retention — the Growth-Lab math
export function householdD30(a: Assumptions): number {
  return 1 - (1 - a.kidD30) * (1 - a.parentD30)
}
function effectiveCap(a: Assumptions): number { return a.cap * (0.5 + householdD30(a)) }
function logistic(t: number, cap: number): number {
  return Math.max(A0, cap / (1 + Math.exp(-0.32 * (t - 11))))
}

export interface MonthRow { m: number; active: number; payers: number; revenue: number; net: number; cum: number }
export interface ModelResult {
  rows: MonthRow[]; arpu: number; contributionPerActive: number
  steadyBreakeven: number | null; firstPositiveMonth: number | null
  cumNet: number; npv: number; endActive: number; householdD30: number
}

export function runModel(a: Assumptions, months = 24): ModelResult {
  const arpu = effArpu(a.listPrice)
  const rm = Math.pow(1 + DISCOUNT_ANNUAL, 1 / 12) - 1
  const cap = effectiveCap(a)
  const rows: MonthRow[] = []
  let cum = 0, npv = 0, prev = A0, firstPositive: number | null = null
  for (let m = 1; m <= months; m++) {
    const active = logistic(m, cap)
    const registered = active * REG_MULT
    const payers = active * a.conv
    const newActive = Math.max(0, active - prev) + a.churn * prev
    const revenue = payers * arpu
    const net = revenue * (1 - PROCESSING) - (active * a.infraActive + registered * INFRA_REG) - newActive * a.cac - FIXED_MO
    cum += net
    npv += net / Math.pow(1 + rm, m)
    if (firstPositive === null && net > 0) firstPositive = m
    rows.push({ m, active, payers, revenue, net, cum })
    prev = active
  }
  const perActive = a.conv * arpu * (1 - PROCESSING) - a.infraActive - REG_MULT * INFRA_REG
  return {
    rows, arpu, contributionPerActive: perActive,
    steadyBreakeven: perActive > 0 ? FIXED_MO / perActive : null,
    firstPositiveMonth: firstPositive, cumNet: cum, npv,
    endActive: rows[rows.length - 1].active, householdD30: householdD30(a),
  }
}

// ── Scale model — per-active cost falls with scale (economies of scale) ──
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
function baseCompute(f: number): number { return f < 50_000 ? 25 : f < 300_000 ? 135 : 985 }
export function costAt(f: number): { total: number; perActive: number } {
  const t = clamp01((Math.log10(Math.max(1000, f)) - 3) / 3)
  const data = f * lerp(0.030, 0.015, t) + f * lerp(0.020, 0.026, t) + baseCompute(f)
  const infra = f * lerp(0.018, 0.008, t) + 20
  const agent = f * 0.001 + 3
  const aiml = f * lerp(0.006, 0.003, t)
  const ui = f * lerp(0.006, 0.003, t) + 15
  const total = data + infra + agent + aiml + ui
  return { total, perActive: f > 0 ? total / f : 0 }
}
export interface ScalePoint { f: number; perActive: number; total: number }
export function costCurve(points = 24): ScalePoint[] {
  const out: ScalePoint[] = []
  for (let i = 0; i < points; i++) {
    const f = Math.round(Math.pow(10, 3 + (3 * i) / (points - 1)))
    const c = costAt(f)
    out.push({ f, perActive: c.perActive, total: c.total })
  }
  return out
}

// ── precomputed headline for the mid (base) case — cite these anywhere ──
const MID = runModel(CASES.mid, 24)
export const ECON = {
  case: CASES.mid,
  effArpu: MID.arpu,                                   // ~$6.48/mo
  cac: CASES.mid.cac,                                  // $1.50
  contributionPerActive: MID.contributionPerActive,   // ~$0.14
  breakEvenFamilies: MID.steadyBreakeven,              // ~460
  firstPositiveMonth: MID.firstPositiveMonth,
  npv24: MID.npv,
  householdD30: MID.householdD30,                      // ~0.47
  arrRunRate: MID.rows[MID.rows.length - 1].revenue * 12,
  agentOsCostMo: 3,                                    // deterministic-first OS ≈ $2–3/mo
  infraPerActive: CASES.mid.infraActive,              // $0.08
}
