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

// XP that fills ONE world's daily ring. Recalibrated against MEASURED content
// density (avg item.xp ≈ 10.4, avg single drill round ≈ 48xp / ~2 real minutes
// — see src/data/__pacing_audit.test.ts): at ~25xp/min blended pace, the OLD
// goal of 80 filled in ~3 minutes (one drill round), not the intended ~10 —
// content had grown denser since this was last tuned and nobody revisited it.
// 170xp/ring ≈ 7 minutes/ring; all 6 rings ≈ 41 real minutes, the dominant
// lever for the 45–60 min/day target (the other 3 circle pips layer on top,
// mostly overlapping since drill/kin XP also counts toward its world's ring).
export const DAILY_WORLD_XP_GOAL = 170

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

// ============================================================
//  THE DAILY CIRCLE  (three distinct actions — not a flat XP bar)
//  A meaningful "circle full" needs varied real effort, so it takes THREE
//  things: focused effort (cloud XP, tamper-proof), a finished lesson, and an
//  explore action (a dungeon clear or a befriend). Only a full circle advances
//  the streak. Targets are tunable knobs — raise them as the kids grow.
// ============================================================
import { getCounters } from './quests'

// Recalibrated alongside DAILY_WORLD_XP_GOAL (see comment above) — at old
// values, 3 quick drill rounds (~7 real minutes, ~150xp measured) alone
// cleared BOTH the old effort goal (120) and the old quest goal (3), letting
// "the circle" go full in well under 10 minutes. New values require real
// breadth: rings (unchanged, still the dominant lever) forces all 6 subjects;
// effort and quest now need a genuinely larger, less-gameable slice of the
// same ~45–60 min session, not a side effect of one lucky round.
export const DAILY_CIRCLE_XP = 500 // focused-effort goal (~20 real minutes at measured pace)
export const DAILY_DRILLS = 6      // "clear 6 quests" — roughly one dedicated round per world
export const DAILY_RINGS = 6       // all six world rings
export const DAILY_KIN = 2
const WORLD_KEYS = ['NUM', 'WRD', 'WON', 'LOG', 'WLD', 'LIF']

// The North Star: a core-4 daily set spanning what kids actually do. Every goal
// exposes a count/target so the ring + pills can show real progress (x/y).
export interface DailyCircle {
  effort: boolean; rings: boolean; quest: boolean; kin: boolean
  done: number; full: boolean
  xp: number; goalXp: number
  ringsN: number; ringsGoal: number
  quests: number; questGoal: number
  kins: number; kinGoal: number
}

/** Compute today's circle from cloud XP (effort + rings) + local activity. */
export function dailyCircle(todayXp: Record<string, number>): DailyCircle {
  const xp = Object.values(todayXp).reduce((a, b) => a + (b || 0), 0)
  const c = getCounters().daily
  const ringsN = WORLD_KEYS.filter(k => ringPct(todayXp[k] ?? 0) >= 100).length
  const effort = xp >= DAILY_CIRCLE_XP
  const rings = ringsN >= DAILY_RINGS
  const quest = c.drill >= DAILY_DRILLS
  const kin = c.befriend >= DAILY_KIN
  const done = [effort, rings, quest, kin].filter(Boolean).length
  return {
    effort, rings, quest, kin, done, full: done === 4,
    xp, goalXp: DAILY_CIRCLE_XP,
    ringsN, ringsGoal: DAILY_RINGS,
    quests: c.drill, questGoal: DAILY_DRILLS,
    kins: c.befriend, kinGoal: DAILY_KIN,
  }
}
