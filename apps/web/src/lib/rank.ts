// ============================================================
//  RANK  (creator/explorer growth arc, driven by REAL XP)
//  The rank number IS the learner's actual profile XP (all-time) — the very same
//  XP shown everywhere else, read straight from profiles.xp. No separate counter,
//  no cap. Tiers use a hand-tuned rising curve calibrated so the top is a real
//  grind (a ~2.2k-XP/day kid reaches Luminary in ~70+ days) while early tiers come
//  quick. Circle standings come from season_points(ids) → profiles.xp (SECURITY
//  DEFINER RPC). Everything degrades to empty offline.
// ============================================================

import { supabase, cloudEnabled } from './supabase'

// ArgantaLab's own ladder — a creator/explorer growth arc, not metals.
// `at` = XP needed to reach the tier. The gaps widen hard on purpose:
// Spark/Explorer come in days; Luminary is the summit of a dedicated season.
export interface Tier { name: string; color: string; glyph: string; at: number }
export const TIERS: Tier[] = [
  { name: 'Spark',      color: '#f0a83a', glyph: '✦', at: 0 },       // just getting started
  { name: 'Explorer',   color: '#5ec257', glyph: '❖', at: 5000 },
  { name: 'Adventurer', color: '#37a8c4', glyph: '✧', at: 15000 },
  { name: 'Maker',      color: '#7a4fd0', glyph: '✶', at: 40000 },
  { name: 'Sage',       color: '#d9a520', glyph: '★', at: 85000 },
  { name: 'Luminary',   color: '#d4476b', glyph: '✷', at: 160000 }, // the summit
]
const STARS_PER_TIER = 5
/** The XP that crowns the ladder (reaching this = Luminary). */
export const TOP_POINTS = TIERS[TIERS.length - 1].at

export interface RankTier { tierIdx: number; tier: Tier; star: number; starsPer: number; points: number; nextAt: number; frac: number }
export function tierOf(points: number): RankTier {
  const p = Math.max(0, points)
  let idx = 0
  for (let i = 0; i < TIERS.length; i++) if (p >= TIERS[i].at) idx = i
  const tier = TIERS[idx]
  const isTop = idx >= TIERS.length - 1
  const nextAt = isTop ? tier.at : TIERS[idx + 1].at
  const span = nextAt - tier.at
  const frac = isTop ? 1 : span > 0 ? (p - tier.at) / span : 1
  const star = isTop ? STARS_PER_TIER : Math.min(STARS_PER_TIER, Math.floor(frac * STARS_PER_TIER))
  return { tierIdx: idx, tier, star, starsPer: STARS_PER_TIER, points: p, nextAt, frac: Math.min(1, frac) }
}

/** This learner's rank score = their real profile XP (all-time). */
export async function myRankPoints(): Promise<number> {
  if (!cloudEnabled) return 0
  try {
    const { data: u } = await supabase.auth.getUser()
    const id = u.user?.id
    if (!id) return 0
    const { data } = await supabase.from('profiles').select('xp').eq('id', id).maybeSingle()
    return (data?.xp as number) ?? 0
  } catch { return 0 }
}

/** Rank scores (profile XP) for a set of members — circle standings. id → xp. */
export async function seasonPoints(ids: string[]): Promise<Record<string, number>> {
  if (!cloudEnabled || ids.length === 0) return {}
  try {
    const { data } = await supabase.rpc('season_points', { p_ids: ids })
    const out: Record<string, number> = {}
    for (const r of (data as { kid_id: string; points: number }[]) ?? []) out[r.kid_id] = r.points ?? 0
    return out
  } catch { return {} }
}
