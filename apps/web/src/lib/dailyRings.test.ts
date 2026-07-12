import { describe, it, expect } from 'vitest'
import {
  ringPct, dailyCircle, DAILY_WORLD_XP_GOAL, DAILY_CIRCLE_XP, DAILY_DRILLS, DAILY_RINGS, DAILY_KIN,
} from './dailyRings'
import { FOCUS_XP, RINGS_GOAL, DRILLS_GOAL, BEFRIEND_GOAL } from './quests'

describe('ringPct', () => {
  it('is 0 at zero xp and 100 at the goal', () => {
    expect(ringPct(0)).toBe(0)
    expect(ringPct(DAILY_WORLD_XP_GOAL)).toBe(100)
  })
  it('clamps above the goal instead of exceeding 100', () => {
    expect(ringPct(DAILY_WORLD_XP_GOAL * 3)).toBe(100)
  })
})

describe('dailyCircle — regression guard against the "3 rounds = 100%" bug', () => {
  const zeroXp = { NUM: 0, WRD: 0, WON: 0, LOG: 0, WLD: 0, LIF: 0 }

  it('is not full on zero activity', () => {
    expect(dailyCircle(zeroXp).full).toBe(false)
  })

  it('a single drill round\'s worth of xp (measured ~48) does not clear the effort goal alone', () => {
    // This is the exact scenario that broke before recalibration: one quick
    // round used to exceed the old 120xp effort goal outright.
    const oneRoundWorth = { ...zeroXp, NUM: 48 }
    expect(dailyCircle(oneRoundWorth).effort).toBe(false)
  })

  it('filling all 6 rings requires real per-world xp, not a single-world dump', () => {
    const oneWorldOnly = { ...zeroXp, NUM: DAILY_WORLD_XP_GOAL * 10 }
    const c = dailyCircle(oneWorldOnly)
    expect(c.rings).toBe(false)          // only 1 of 6 rings can be full
    expect(c.full).toBe(false)
  })

  it('is full only once every pip individually clears its (raised) goal', () => {
    const allRingsFull = Object.fromEntries(
      Object.keys(zeroXp).map(k => [k, DAILY_WORLD_XP_GOAL]),
    ) as Record<string, number>
    const c = dailyCircle(allRingsFull)
    expect(c.rings).toBe(true)
    expect(c.ringsN).toBe(DAILY_RINGS)
    // effort uses the SAME xp pool as rings, so filling every ring at exactly
    // the goal also happens to clear effort here — that's expected overlap,
    // not a bypass (quest/kin are independent local counters, still gating).
    expect(c.effort).toBe(DAILY_WORLD_XP_GOAL * 6 >= DAILY_CIRCLE_XP)
  })

  it('goal constants are non-trivial (guards against re-lowering back to the old easy values)', () => {
    expect(DAILY_WORLD_XP_GOAL).toBeGreaterThan(80)   // old value
    expect(DAILY_CIRCLE_XP).toBeGreaterThan(120)      // old value
    expect(DAILY_DRILLS).toBeGreaterThan(3)           // old value — the literal "3 rounds" bug
    expect(DAILY_KIN).toBeGreaterThanOrEqual(1)
  })
})

describe('quest-chain mirror stays in lockstep with dailyRings.ts', () => {
  // quests.ts can't import dailyRings.ts (circular import), so it keeps its
  // own copy of these thresholds. This test is the tripwire for that copy
  // drifting out of sync again, the way it silently did before this audit.
  it('FOCUS_XP / RINGS_GOAL / DRILLS_GOAL / BEFRIEND_GOAL match the dailyRings source of truth', () => {
    expect(FOCUS_XP).toBe(DAILY_CIRCLE_XP)
    expect(RINGS_GOAL).toBe(DAILY_RINGS)
    expect(DRILLS_GOAL).toBe(DAILY_DRILLS)
    expect(BEFRIEND_GOAL).toBe(DAILY_KIN)
  })
})
