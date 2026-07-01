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
