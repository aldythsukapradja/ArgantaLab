import { describe, it, expect } from 'vitest'
import { xpToNext, xpForWin, applyXp, KIN_MAX_LEVEL } from './growth'
import { createBattle, useHeal, befriendChance, type Combatant } from './battle'

const mk = (over: Partial<Combatant> = {}): Combatant => ({
  renderKey: 'countfox', name: 'Countfox', element: 'pattern', level: 5,
  hp: 100, maxHp: 100, power: 20, tier: 0, color: '#f59e0b', ...over,
})

describe('kinquest growth — xp curve', () => {
  it('thresholds rise with level', () => {
    expect(xpToNext(2)).toBeGreaterThan(xpToNext(1))
    expect(xpToNext(20)).toBeGreaterThan(xpToNext(10))
  })

  it('keepers pay more than a same-level wild', () => {
    expect(xpForWin(8, true)).toBeGreaterThan(xpForWin(8, false))
  })

  it('applyXp rolls over thresholds and can multi-level', () => {
    const r = applyXp(1, 0, xpToNext(1) + xpToNext(2) + 5)
    expect(r.level).toBe(3)
    expect(r.xp).toBe(5)
    expect(r.levelsGained).toBe(2)
  })

  it('caps at max level', () => {
    const r = applyXp(KIN_MAX_LEVEL, 0, 99999)
    expect(r.level).toBe(KIN_MAX_LEVEL)
    expect(r.xp).toBe(0)
  })

  it('a typical wild win never levels more than twice at low levels', () => {
    for (let lvl = 1; lvl <= 10; lvl++) {
      const r = applyXp(lvl, 0, xpForWin(lvl))
      expect(r.levelsGained).toBeLessThanOrEqual(2)
    }
  })
})

describe('kinquest battle — items', () => {
  it('useHeal restores hp and passes the turn', () => {
    let s = createBattle(mk({ hp: 30 }), mk())
    s = useHeal(s, 0.5)
    expect(s.player.hp).toBe(80)
    expect(s.turn).toBe('enemy')
  })

  it('useHeal is a pure no-op at full hp', () => {
    const s = createBattle(mk(), mk())
    expect(useHeal(s, 0.5)).toBe(s)
  })

  it('a bond berry raises the befriend chance', () => {
    const s = createBattle(mk(), mk({ hp: 20, maxHp: 100 }))
    expect(befriendChance(s, false, 0.22)).toBeGreaterThan(befriendChance(s, false, 0))
  })
})
