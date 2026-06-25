import { describe, it, expect } from 'vitest'
import { localDay, localYesterday } from './day'
import { ringPct, DAILY_WORLD_XP_GOAL } from './dailyRings'

// The daily-ring reset hinges on TWO things being correct: the day boundary is
// the LOCAL calendar day (not UTC — the bug that made yesterday's rings linger
// until 3 AM in Qatar), and the fill math clamps to a clean 0..100.

describe('local-day boundary (ring reset)', () => {
  it('localDay uses the LOCAL calendar, not UTC toISOString', () => {
    const d = new Date(2026, 5, 25, 1, 30) // Jun 25 2026, 01:30 LOCAL
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    expect(localDay(d)).toBe(expected)
    expect(localDay(d)).toBe('2026-06-25')
  })

  it('localYesterday is exactly the local day 24h earlier', () => {
    const now = new Date()
    expect(localYesterday()).toBe(localDay(new Date(now.getTime() - 864e5)))
  })

  it('format is always zero-padded YYYY-MM-DD', () => {
    expect(localDay(new Date(2026, 0, 3))).toBe('2026-01-03')
  })
})

describe('daily ring fill', () => {
  it('empty day = 0%', () => expect(ringPct(0)).toBe(0))
  it('hitting the goal = 100%', () => expect(ringPct(DAILY_WORLD_XP_GOAL)).toBe(100))
  it('overshooting the goal clamps to 100%', () => expect(ringPct(DAILY_WORLD_XP_GOAL * 3)).toBe(100))
  it('half the goal = 50%', () => expect(ringPct(DAILY_WORLD_XP_GOAL / 2)).toBe(50))
  it('negative never underflows', () => expect(ringPct(-50)).toBe(0))
})
