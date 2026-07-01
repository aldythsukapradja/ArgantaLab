// Live investor metrics from Circle HQ.
//  The raw hq_* RPCs are operator-gated, so a public pitch reads a single PII-safe
//  aggregate: hq_public_pitch() (recommended) — draft SQL in apps/landing/HQ_PUBLIC_PITCH.sql.
//  Until Supabase env vars are set (or the RPC exists) fetchPitch() returns null and
//  the deck shows benchmark-forward "live soon" values — never a fake number.
import { useEffect, useState } from 'react'

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Investor-safe aggregate shape (a flat subset of GrowthOverview + PortfolioVc +
// EconomyData + schema insights + kinetik stats). All optional — missing = "live soon".
export interface PitchData {
  wau?: number; dau?: number; mau?: number; stickiness?: number | null; wowPct?: number | null
  depth?: number; accuracyPct?: number | null; newLearners7d?: number
  learners?: number; kids?: number; circles?: number; worldsLive?: number; itemsLive?: number
  gamesPublic?: number; attemptsTotal?: number
  activationRate?: number | null; d30?: number | null; d1?: number | null
  lessonsPerKidDay?: number | null; screenMinPerKidDay?: number | null
  spentPerActiveKid?: number | null; kFactor?: number | null; flywheelCount?: number; familiesTotal?: number
  econFloat?: number; econMinted?: number; econSpent?: number; econCoverage?: number | null
  kinetikCircles?: number; kinetikMembers?: number; kinetikPosts?: number
  generatedAt?: string
}

export async function fetchPitch(): Promise<PitchData | null> {
  if (!URL || !KEY) return null
  try {
    const r = await fetch(`${URL}/rest/v1/rpc/hq_public_pitch`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!r.ok) return null
    const data = await r.json()
    return (data ?? null) as PitchData | null
  } catch { return null }
}

export function useHqPitch(): { data: PitchData | null; loading: boolean } {
  const [data, setData] = useState<PitchData | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { let on = true; fetchPitch().then(d => { if (on) { setData(d); setLoading(false) } }); return () => { on = false } }, [])
  return { data, loading }
}

// ── unit economics (deterministic — real now, mirrors apps/hq monetization.ts) ──
export interface Case { conv: number; price: number; churn: number; iapBuyers: number; iapSpend: number }
const PRESETS: Record<'low' | 'mid' | 'high', Case> = {
  low: { conv: 0.02, price: 5.99, churn: 0.08, iapBuyers: 0.03, iapSpend: 4 },
  mid: { conv: 0.05, price: 7.99, churn: 0.05, iapBuyers: 0.07, iapSpend: 8 },
  high: { conv: 0.10, price: 9.99, churn: 0.03, iapBuyers: 0.12, iapSpend: 15 },
}
const MARGIN = 0.85, CAC = 25
export interface UnitEcon { label: string; ltv: number; ltvCac: number; payback: number; arpu: number; arrPer100k: number }
function calc(c: Case, label: string): UnitEcon {
  const grossPerSub = c.price * MARGIN
  const ltv = grossPerSub / c.churn
  const arpu = c.conv * c.price + c.iapBuyers * c.iapSpend
  return { label, ltv, ltvCac: ltv / CAC, payback: CAC / grossPerSub, arpu, arrPer100k: arpu * 100000 * 12 }
}
export const UNIT_ECON: Record<'low' | 'mid' | 'high', UnitEcon> = {
  low: calc(PRESETS.low, 'Low'), mid: calc(PRESETS.mid, 'Mid'), high: calc(PRESETS.high, 'High'),
}

// ── chart series, recalculated straight from the HQ model ──────────────────
// (mirrors apps/hq monetization.ts + growth.ts benchmarks so every chart renders
//  deterministically, live-data or not — never a fake claim, always the model.)

// CAC payback: cumulative gross contribution of one acquired subscriber vs CAC.
// Retention S(k) = (1-churn)^(k-1); C(t) = grossPerSub · Σ S(k). Crosses CAC at payback.
export function paybackCurve(key: 'low' | 'mid' | 'high' = 'mid', months = 18) {
  const c = PRESETS[key]
  const grossPerSub = c.price * MARGIN
  const cum: number[] = []
  let acc = 0
  for (let t = 0; t <= months; t++) {
    if (t > 0) acc += grossPerSub * Math.pow(1 - c.churn, t - 1)
    cum.push(acc)
  }
  const paybackMo = CAC / grossPerSub
  return { cum, cac: CAC, months, paybackMo, ltv: grossPerSub / c.churn }
}

// Weekly-active compounding — the "default alive" curve. 7% = YC bar, 10% = elite.
export function growthCurve(base = 100, weeks = 12) {
  const slow: number[] = [], fast: number[] = []
  for (let w = 0; w <= weeks; w++) { slow.push(base * Math.pow(1.07, w)); fast.push(base * Math.pow(1.10, w)) }
  return { weeks, slow, fast }
}

// Retention decay vs day-since-signup — top-quartile edtech target vs typical.
// Anchored to BENCHMARKS (D30 > 35% = top-quartile). Live D1/D30 overlaid when present.
export const RETENTION_DAYS = [0, 1, 7, 14, 30]
export function retentionCurve() {
  return {
    days: RETENTION_DAYS,
    target: [100, 55, 44, 39, 36],   // top-quartile edtech
    typical: [100, 40, 25, 19, 15],  // category average
  }
}

// ARR fan vs installed families — driver-based, Low/Mid/High (forecastCurve logic).
export function arrFan(maxFamilies = 100_000, steps = 8) {
  const mk = (c: Case) => {
    const out: number[] = []
    for (let i = 0; i <= steps; i++) {
      const f = (maxFamilies * i) / steps
      const arpu = c.conv * c.price + c.iapBuyers * c.iapSpend
      out.push(arpu * f * 12)
    }
    return out
  }
  const families = Array.from({ length: steps + 1 }, (_, i) => (maxFamilies * i) / steps)
  return { families, low: mk(PRESETS.low), mid: mk(PRESETS.mid), high: mk(PRESETS.high) }
}
