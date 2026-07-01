// ============================================================
//  SEASONAL RANK  (within-circle ladder, resets every 3 months)
//  Points are earned ONLY from learning (hooked into addXp). Tiers/stars are
//  derived client-side from the season's points; standings are scoped to the
//  kid's circle. Everything degrades to empty offline. Server side: rank_points
//  table + add_rank_points / season_points RPCs (see supabase/rank.sql).
// ============================================================

import { supabase, cloudEnabled } from './supabase'

// ArgantaLab's own ladder — a creator/explorer growth arc, not metals.
export interface Tier { name: string; color: string; glyph: string }
export const TIERS: Tier[] = [
  { name: 'Spark',      color: '#f0a83a', glyph: '✦' }, // just getting started
  { name: 'Explorer',   color: '#5ec257', glyph: '❖' },
  { name: 'Adventurer', color: '#37a8c4', glyph: '✧' },
  { name: 'Maker',      color: '#7a4fd0', glyph: '✶' },
  { name: 'Sage',       color: '#d9a520', glyph: '★' },
  { name: 'Luminary',   color: '#d4476b', glyph: '✷' }, // the top of the arc
]
const POINTS_PER_STAR = 40
const STARS_PER_TIER = 5

/** Current season id, e.g. "2026-Q3". Matches season_of() on the server. */
export function seasonId(d = new Date()): string {
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`
}
/** Days until the current season ends (next quarter boundary). */
export function seasonEndsInDays(d = new Date()): number {
  const end = new Date(d.getFullYear(), (Math.floor(d.getMonth() / 3) + 1) * 3, 1)
  return Math.max(0, Math.ceil((end.getTime() - d.getTime()) / 86400000))
}

export interface RankTier { tierIdx: number; tier: Tier; star: number; starsPer: number; points: number }
export function tierOf(points: number): RankTier {
  const stars = Math.floor(Math.max(0, points) / POINTS_PER_STAR)
  const tierIdx = Math.min(TIERS.length - 1, Math.floor(stars / STARS_PER_TIER))
  const star = tierIdx >= TIERS.length - 1 ? STARS_PER_TIER : stars % STARS_PER_TIER
  return { tierIdx, tier: TIERS[tierIdx], star, starsPer: STARS_PER_TIER, points }
}

/** Award season points for a learning event (best-effort; called from addXp). */
export async function addRankPoints(points: number): Promise<void> {
  if (!cloudEnabled || points <= 0) return
  try { await supabase.rpc('add_rank_points', { p_points: Math.round(points) }) } catch { /* ignore */ }
}

/** This kid's points in the current season. */
export async function myRankPoints(): Promise<number> {
  if (!cloudEnabled) return 0
  try {
    const { data: u } = await supabase.auth.getUser()
    const id = u.user?.id
    if (!id) return 0
    const { data } = await supabase.from('rank_points').select('points').eq('kid_id', id).eq('season', seasonId()).maybeSingle()
    return (data?.points as number) ?? 0
  } catch { return 0 }
}

/** Season points for a set of members (circle standings). id → points. */
export async function seasonPoints(ids: string[]): Promise<Record<string, number>> {
  if (!cloudEnabled || ids.length === 0) return {}
  try {
    const { data } = await supabase.rpc('season_points', { p_ids: ids })
    const out: Record<string, number> = {}
    for (const r of (data as { kid_id: string; points: number }[]) ?? []) out[r.kid_id] = r.points ?? 0
    return out
  } catch { return {} }
}
