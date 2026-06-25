import { supabase, cloudEnabled } from './supabase'
import { tzOffsetMin } from './day'

// ============================================================
//  DAILY ACTIVITY RINGS  (Home only — resets every local day)
//  The Home rings answer "what did you learn TODAY", so they must empty at the
//  kid's local midnight. They read the cloud event log (learn_event) — the same
//  server truth the parent dashboard uses — never localStorage, so they're
//  per-kid, tamper-proof, and survive device changes. The lifetime growth rings
//  (worldRing in learnProgress.ts) stay on the Profile/Learn pages unchanged.
// ============================================================

// XP that fills ONE world's daily ring. Single tunable knob: calibrated so a
// focused ~10-minute subject session fills a ring, and the 45–60 min/day target
// lights up several rings across the orbit. Bump this to make the goal harder.
export const DAILY_WORLD_XP_GOAL = 80

/** Today's XP per world (UPPERCASE world key → xp), from the cloud event log,
 *  scoped to the kid's LOCAL day. Server-authoritative; empty when offline or
 *  before the migration is applied (rings then read 0 = graceful, not broken). */
export async function todayWorldXp(kidId?: string): Promise<Record<string, number>> {
  if (!cloudEnabled) return {}
  let me = kidId
  if (!me) { const { data } = await supabase.auth.getUser(); me = data.user?.id }
  if (!me) return {}
  const { data, error } = await supabase.rpc('kid_today_rings', { p_kid: me, p_tz_offset: tzOffsetMin() })
  if (error) { console.warn('[rings] today failed:', error.message); return {} }
  const out: Record<string, number> = {}
  for (const r of (data as { world: string; xp: number }[]) ?? []) out[r.world] = r.xp ?? 0
  return out
}

/** Today's XP in one world → ring fill percent (0..100). */
export function ringPct(xp: number): number {
  return Math.max(0, Math.min(100, Math.round((xp / DAILY_WORLD_XP_GOAL) * 100)))
}
