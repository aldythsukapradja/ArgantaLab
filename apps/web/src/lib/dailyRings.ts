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

// ============================================================
//  THE DAILY CIRCLE  (three distinct actions — not a flat XP bar)
//  A meaningful "circle full" needs varied real effort, so it takes THREE
//  things: focused effort (cloud XP, tamper-proof), a finished lesson, and an
//  explore action (a dungeon clear or a befriend). Only a full circle advances
//  the streak. Targets are tunable knobs — raise them as the kids grow.
// ============================================================
import { getCounters } from './quests'

export const DAILY_CIRCLE_XP = 120 // focused-effort goal (well above the old flat 80)
export const DAILY_DRILLS = 3      // "clear 3 quests" (drill/practice signal)
export const DAILY_RINGS = 6       // all six world rings
export const DAILY_KIN = 1
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
