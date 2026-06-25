import { describe, it, expect } from 'vitest'
import {
  createBattle, onAnswer, castAbility, enemyTelegraph, nextRating, captureChance,
  type PlayerConfig, type EnemyConfig,
} from './engine'
import { simulate, kinToEnemy, STD_PLAYER, STD_ENEMY } from './sim'
import { KIN } from '../../data/openworld/kin'

const enemy: EnemyConfig = { maxHp: 100, power: 1, gimmick: 'shield3', shieldAmount: 16, captureThreshold: 0.25 }
const player: PlayerConfig = { maxHearts: 5, loadout: [], autoHit: 5, energyPerCorrect: 10, mountPerk: null }

describe('combat engine — invariants', () => {
  it('a correct answer grants Energy and chips the enemy; energy is never negative', () => {
    let s = createBattle(player, enemy)
    s = onAnswer(s, { correct: true, energyPerCorrect: 10, autoHit: 5 })
    expect(s.energy).toBe(10)
    expect(s.enemyHp).toBeLessThan(100)
    expect(s.combo).toBe(1)
    expect(s.energy).toBeGreaterThanOrEqual(0)
  })

  it('an ability is a pure no-op when Energy is short', () => {
    const s = createBattle(player, enemy) // 0 energy
    const after = castAbility(s, { id: 'ab:strike', kind: 'strike', cost: 10, power: 14 })
    expect(after).toBe(s) // same reference — nothing happened
  })

  it('Weakness Break strips the enemy shield', () => {
    let s = createBattle(player, enemy)
    s = { ...s, enemyShield: 16, energy: 20 }
    s = castAbility(s, { id: 'ab:break', kind: 'break', cost: 12, power: 12 })
    expect(s.enemyShield).toBe(0)
    expect(s.weaknessOpen).toBe(2)
  })

  it('a wrong answer hands the enemy a turn (loses a heart)', () => {
    let s = createBattle(player, enemy)
    s = onAnswer(s, { correct: false, energyPerCorrect: 10, autoHit: 5 })
    expect(s.hearts).toBe(4)
    expect(s.combo).toBe(0)
  })

  it('opens a Friendship Window at/under the capture threshold', () => {
    let s = createBattle(player, enemy)
    s = { ...s, enemyHp: 20 } // 20% <= 25% threshold
    s = enemyTelegraph(s)     // any settle() re-evaluates status
    expect(s.status).toBe('capture-window')
    expect(captureChance(s)).toBeGreaterThan(0)
    expect(captureChance(s)).toBeLessThanOrEqual(0.97)
  })

  it('Elo rating stays clamped to [1,10]', () => {
    let r = 10
    for (let i = 0; i < 50; i++) r = nextRating(r, 1, true)
    expect(r).toBeLessThanOrEqual(10)
    r = 1
    for (let i = 0; i < 50; i++) r = nextRating(r, 10, false)
    expect(r).toBeGreaterThanOrEqual(1)
  })
})

describe('combat balance — Monte Carlo proof (never tune by vibe)', () => {
  const res = simulate(4000, 20240624, STD_PLAYER, STD_ENEMY)

  it('a careful player can always win', () => {
    expect(res.careful).toBeGreaterThanOrEqual(0.99)
  })

  it('smart play wins around 95%', () => {
    expect(res.smart).toBeGreaterThanOrEqual(0.85)
    expect(res.smart).toBeLessThanOrEqual(1)
  })

  it('naive play is punished (a real risk of losing)', () => {
    expect(res.naive).toBeGreaterThanOrEqual(0.15)
    expect(res.naive).toBeLessThanOrEqual(0.55)
  })

  it('skill clearly matters: smart >> naive', () => {
    expect(res.smart - res.naive).toBeGreaterThanOrEqual(0.35)
  })
})

// Phase H: every world is now a full Openworld. The canon (07_ENGINEERING_LESSONS)
// is that NO combat number ships unproven — so we sweep the WHOLE shipped roster
// through the same kinToEnemy mapping OpenworldPlayer uses and assert a careful
// player can always win each kin. careful has missProb 0, so its outcome is
// deterministic: this is a hard floor, not a statistical hope.
describe('combat balance — every shipped kin is careful-winnable', () => {
  for (const def of KIN) {
    it(`${def.name} (${def.world}/${def.rarity}/${def.gimmick}/hp${def.baseHp}) — careful always wins`, () => {
      const res = simulate(400, 7000 + def.baseHp, STD_PLAYER, kinToEnemy(def))
      expect(res.careful).toBe(1)
    })
  }
})
