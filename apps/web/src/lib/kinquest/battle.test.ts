import { describe, it, expect } from 'vitest'
import {
  createBattle, playerMove, guard, enemyTurn, attemptBefriend, befriendChance, flee,
  type Combatant,
} from './battle'
import { makeCombatant, makeWildEnemy, maxHpFor, powerFor } from './party'
import { QUICK_MOVE, FOCUS_MOVE, movesFor } from '@/data/kinquest'
import { KIN } from '@/data/openworld/kin'

const mk = (over: Partial<Combatant> = {}): Combatant => ({
  renderKey: 'countfox', name: 'Countfox', element: 'pattern', level: 5,
  hp: 100, maxHp: 100, power: 20, tier: 0, color: '#f59e0b', ...over,
})

describe('kinquest battle — turn flow', () => {
  it('opens on the player turn, active, with an intro event', () => {
    const s = createBattle(mk(), mk({ name: 'Addbug', element: 'order' }))
    expect(s.turn).toBe('player')
    expect(s.status).toBe('active')
    expect(s.lastEvent?.kind).toBe('start')
  })

  it('a player move damages the enemy and passes the turn', () => {
    const s0 = createBattle(mk(), mk({ name: 'Addbug', element: 'order' }))
    const s1 = playerMove(s0, QUICK_MOVE)
    expect(s1.enemy.hp).toBeLessThan(s0.enemy.hp)
    expect(s1.turn).toBe('enemy')
    expect(s1.lastEvent?.kind).toBe('move')
  })

  it('is a pure no-op when it is not the player turn', () => {
    let s = createBattle(mk(), mk())
    s = playerMove(s, QUICK_MOVE)     // now enemy turn
    const again = playerMove(s, QUICK_MOVE)
    expect(again).toBe(s)             // same reference — nothing happened
  })

  it('enemy turn only runs on the enemy turn, then returns to player', () => {
    let s = createBattle(mk(), mk())
    const noop = enemyTurn(s)          // still player turn
    expect(noop).toBe(s)
    s = playerMove(s, QUICK_MOVE)
    s = enemyTurn(s)
    expect(s.turn).toBe('player')
    expect(s.player.hp).toBeLessThan(100)
  })
})

describe('kinquest battle — quiz multiplier', () => {
  it('a correct FOCUS answer hits harder than a wrong one', () => {
    const enemy = mk({ name: 'E', element: 'truth', hp: 999, maxHp: 999 })
    const right = playerMove(createBattle(mk(), enemy), FOCUS_MOVE.pattern, { quizCorrect: true })
    const wrong = playerMove(createBattle(mk(), enemy), FOCUS_MOVE.pattern, { quizCorrect: false })
    const rightDmg = 999 - right.enemy.hp
    const wrongDmg = 999 - wrong.enemy.hp
    expect(rightDmg).toBeGreaterThan(wrongDmg)
  })

  it('a wrong FOCUS answer still deals at least 1 damage', () => {
    const s = playerMove(createBattle(mk(), mk({ hp: 999, maxHp: 999 })), FOCUS_MOVE.pattern, { quizCorrect: false })
    expect(999 - s.enemy.hp).toBeGreaterThanOrEqual(1)
  })
})

describe('kinquest battle — type advantage', () => {
  it('super-effective (pattern→order) beats neutral', () => {
    const superHit = playerMove(createBattle(mk(), mk({ element: 'order', hp: 999, maxHp: 999 })), FOCUS_MOVE.pattern, { quizCorrect: true })
    const neutral  = playerMove(createBattle(mk(), mk({ element: 'wonder', hp: 999, maxHp: 999 })), FOCUS_MOVE.pattern, { quizCorrect: true })
    expect(superHit.lastEvent?.effectiveness).toBeGreaterThan(1)
    expect(999 - superHit.enemy.hp).toBeGreaterThan(999 - neutral.enemy.hp)
  })
})

describe('kinquest battle — guard', () => {
  it('guard softens the next enemy hit', () => {
    const enemy = mk({ power: 40, level: 10 })
    const unguarded = enemyTurn(playerMove(createBattle(mk(), enemy), QUICK_MOVE))
    const guarded = enemyTurn(guard(createBattle(mk(), enemy)))
    const unguardedDmg = 100 - unguarded.player.hp
    const guardedDmg = 100 - guarded.player.hp
    expect(guardedDmg).toBeLessThan(unguardedDmg)
  })
})

describe('kinquest battle — befriend', () => {
  it('cannot befriend a healthy wild kin', () => {
    const s = createBattle(mk(), mk({ hp: 100, maxHp: 100 }))
    expect(befriendChance(s)).toBe(0)
  })

  it('can befriend a weakened wild kin', () => {
    const s = createBattle(mk(), mk({ hp: 10, maxHp: 100 }))
    expect(befriendChance(s)).toBeGreaterThan(0)
  })

  it('never befriends a Keeper (boss) kin', () => {
    const s = createBattle(mk(), mk({ hp: 1, maxHp: 100 }), { isKeeper: true })
    expect(befriendChance(s)).toBe(0)
    const after = attemptBefriend(s, { roll: 0 })
    expect(after.status).not.toBe('befriended')
  })

  it('a successful roll befriends the kin', () => {
    const s = createBattle(mk(), mk({ hp: 5, maxHp: 100 }))
    const after = attemptBefriend(s, { roll: 0, quizCorrect: true })
    expect(after.status).toBe('befriended')
  })

  it('a failed befriend hands the enemy a turn', () => {
    const s = createBattle(mk(), mk({ hp: 5, maxHp: 100 }))
    const after = attemptBefriend(s, { roll: 0.99 })
    expect(after.status).toBe('active')
    expect(after.turn).toBe('enemy')
  })
})

describe('kinquest battle — win/lose terminal states', () => {
  it('reducing enemy HP to 0 wins the battle', () => {
    const s = createBattle(mk({ power: 999, level: 20 }), mk({ hp: 5, maxHp: 5 }))
    const after = playerMove(s, FOCUS_MOVE.pattern, { quizCorrect: true })
    expect(after.status).toBe('win')
  })

  it('the player fainting loses the battle', () => {
    let s = createBattle(mk({ hp: 3, maxHp: 3 }), mk({ power: 999, level: 20 }))
    s = playerMove(s, QUICK_MOVE)
    s = enemyTurn(s)
    expect(s.status).toBe('lose')
  })

  it('flee works on wild battles but not Keepers', () => {
    expect(flee(createBattle(mk(), mk())).status).toBe('fled')
    expect(flee(createBattle(mk(), mk(), { isKeeper: true })).status).toBe('active')
  })
})

describe('kinquest party factory', () => {
  it('every catalog kin builds a valid combatant with positive stats', () => {
    for (const k of KIN) {
      const render = k.id.replace('kin:', '')
      const c = makeCombatant(render, 5, 0)
      expect(c.maxHp).toBeGreaterThan(0)
      expect(c.power).toBeGreaterThan(0)
      expect(c.hp).toBe(c.maxHp)
      expect(movesFor(c.element).length).toBe(2)
    }
  })

  it('higher level and tier yield bigger stats', () => {
    expect(maxHpFor('countfox', 20, 0)).toBeGreaterThan(maxHpFor('countfox', 5, 0))
    expect(powerFor('countfox', 5, 2)).toBeGreaterThan(powerFor('countfox', 5, 0))
  })

  it('a wild enemy is built at tier 0', () => {
    expect(makeWildEnemy('addbug', 4).tier).toBe(0)
  })
})

// ── full multi-kin battle orchestration (mirrors KinBattle.tsx transitions) ──
// This drives the EXACT sequence the battle UI performs: player acts, enemy
// retaliates, on an enemy faint the next team member enters (player HP kept),
// on a player faint the next living kin swaps in (enemy HP kept). It proves the
// Keeper-team + party-swap flow always terminates and never corrupts state.
function simulateFullBattle(
  party: Combatant[], team: Combatant[], isKeeper: boolean, answerRate: number,
): { outcome: string; turns: number } {
  let pIdx = 0, eIdx = 0
  let s = createBattle({ ...party[pIdx] }, { ...team[eIdx] }, { isKeeper })
  const hp = party.map(k => k.maxHp)   // live player HP per party slot
  let turns = 0
  let guards = 0

  while (s.status === 'active' && turns < 500) {
    turns++
    if (s.turn === 'player') {
      const correct = Math.random() < answerRate
      if (s.player.hp < s.player.maxHp * 0.28 && guards < 3) { s = guard(s); guards++ }
      else s = playerMove(s, FOCUS_MOVE[s.player.element], { quizCorrect: correct, variance: 0.9 + Math.random() * 0.2 })

      hp[pIdx] = s.player.hp
      if (s.status === 'win') {
        // enemy fainted → next team member, or overall victory
        if (eIdx + 1 < team.length) {
          eIdx++
          s = createBattle({ ...party[pIdx], hp: hp[pIdx] }, { ...team[eIdx] }, { isKeeper })
        } else break // win
      }
    } else {
      s = enemyTurn(s, { variance: 0.9 + Math.random() * 0.2 })
      hp[pIdx] = s.player.hp
      if (s.status === 'lose') {
        // active kin fainted → swap in the next living kin, or defeat
        const nextI = party.findIndex((_, i) => i !== pIdx && hp[i] > 0)
        if (nextI >= 0) {
          hp[pIdx] = 0
          pIdx = nextI
          s = createBattle({ ...party[pIdx], hp: hp[pIdx] }, { ...s.enemy }, { isKeeper })
        } else break // lose
      }
    }
    // invariants that must hold every single turn
    expect(s.player.hp).toBeGreaterThanOrEqual(0)
    expect(s.enemy.hp).toBeGreaterThanOrEqual(0)
    expect(s.player.hp).toBeLessThanOrEqual(s.player.maxHp)
  }
  const outcome = s.status === 'win' ? 'win' : s.status === 'lose' ? 'lose' : (s.enemy.hp <= 0 ? 'win' : 'lose')
  return { outcome, turns }
}

describe('kinquest battle — full Keeper orchestration', () => {
  it('a Keeper battle (3-kin team vs 2-kin party) always terminates cleanly', () => {
    for (let t = 0; t < 100; t++) {
      const party = [makeCombatant('countfox', 12, 30), makeCombatant('letterowl', 11, 20)]
      const team = [makeWildEnemy('addbug', 8), makeWildEnemy('tenturtle', 9), makeWildEnemy('primeroc', 10)]
      const { outcome, turns } = simulateFullBattle(party, team, true, 0.85)
      expect(['win', 'lose']).toContain(outcome)
      expect(turns).toBeLessThan(500)   // never an infinite loop / stuck state
    }
  })

  it('a strong, well-answering party beats a level-matched Keeper most of the time', () => {
    let wins = 0
    const trials = 120
    for (let t = 0; t < trials; t++) {
      const party = [makeCombatant('countfox', 10, 30), makeCombatant('cloudcat', 9, 20)]
      const team = [makeWildEnemy('addbug', 6), makeWildEnemy('sumseal', 7), makeWildEnemy('zerolion', 8)]
      if (simulateFullBattle(party, team, true, 0.88).outcome === 'win') wins++
    }
    expect(wins / trials).toBeGreaterThan(0.6)
  })
})

// ── a full winnable battle simulation (careful play beats a same-level wild) ──
describe('kinquest battle — winnability sim', () => {
  it('a level-matched player who answers well reliably wins a wild battle', () => {
    let wins = 0
    const trials = 200
    for (let t = 0; t < trials; t++) {
      let s = createBattle(makeCombatant('countfox', 6, 0), makeWildEnemy('addbug', 5))
      let guardCount = 0
      while (s.status === 'active') {
        if (s.turn === 'player') {
          // careful player answers correctly ~85% of the time
          const correct = Math.random() < 0.85
          if (s.player.hp < s.player.maxHp * 0.3 && guardCount < 2) { s = guard(s); guardCount++ }
          else s = playerMove(s, FOCUS_MOVE.pattern, { quizCorrect: correct, variance: 0.9 + Math.random() * 0.2 })
        } else {
          s = enemyTurn(s, { variance: 0.9 + Math.random() * 0.2 })
        }
      }
      if (s.status === 'win' || s.status === 'befriended') wins++
    }
    // Should win the large majority — the game must feel fair, not brutal.
    expect(wins / trials).toBeGreaterThan(0.7)
  })
})
