import { describe, it, expect, beforeEach } from 'vitest'
import type { Item } from '@/data/learn'
import { memStore } from './memStore'
import {
  expectedSuccess, recordAttempt, getRating, seedRating, pickItems, repairItem,
} from './adaptive'
import { masteryLevel } from './parentDash'

// adaptive.ts stores under a player-namespaced key in memStore; clear between
// tests so state never leaks across cases.
beforeEach(() => { memStore.clear() })

function mkItem(over: Partial<Item> = {}): Item {
  return {
    id: over.id ?? 'x', world: 'NUM', skill: 'arith', type: 'mcq',
    stage: 'explorer', difficulty: 2, prompt: '?', payload: {}, xp: 10, diamonds: 0,
    ...over,
  }
}

describe('expectedSuccess', () => {
  it('is 0.5 when item and learner ratings are equal', () => {
    expect(expectedSuccess(1000, 1000)).toBeCloseTo(0.5, 6)
  })
  it('is ~0.75 when the item is 190 points below the learner', () => {
    // 10^(-190/400) ≈ 0.333 → 1/(1+0.333) ≈ 0.75
    expect(expectedSuccess(1000 - 190, 1000)).toBeCloseTo(0.75, 2)
  })
  it('is low when the item is far above the learner', () => {
    expect(expectedSuccess(1000 + 400, 1000)).toBeLessThan(0.1)
  })
})

describe('recordAttempt', () => {
  it('raises the learner rating on a correct answer', () => {
    const before = getRating('NUM', 'arith', 'explorer')
    recordAttempt('NUM', 'arith', true, before, 'explorer')
    expect(getRating('NUM', 'arith', 'explorer')).toBeGreaterThan(before)
  })
  it('lowers the learner rating on a wrong answer', () => {
    const before = getRating('NUM', 'arith', 'explorer')
    recordAttempt('NUM', 'arith', false, before, 'explorer')
    expect(getRating('NUM', 'arith', 'explorer')).toBeLessThan(before)
  })
  it('applies a larger update early (n<5, K=40) than once established (n>=20, K=16)', () => {
    // Fresh skill: first attempt uses K=40.
    const r0 = getRating('NUM', 'times', 'explorer')
    recordAttempt('NUM', 'times', true, r0, 'explorer')
    const firstDelta = getRating('NUM', 'times', 'explorer') - r0

    // A different, already-established skill: prime it to n=20 with neutral
    // (alternating) outcomes so the rating stays near its start point, then
    // measure the 21st update from the same starting expectation gap.
    let r = getRating('NUM', 'fractions', 'explorer')
    for (let i = 0; i < 20; i++) recordAttempt('NUM', 'fractions', i % 2 === 0, r, 'explorer')
    const established = getRating('NUM', 'fractions', 'explorer')
    recordAttempt('NUM', 'fractions', true, r0, 'explorer') // same item rating as the fresh-skill case
    const laterDelta = getRating('NUM', 'fractions', 'explorer') - established

    expect(Math.abs(firstDelta)).toBeGreaterThan(Math.abs(laterDelta))
  })
})

describe('cold start', () => {
  it('seeds an unseen skill at STAGE_BASE + 260 for that stage', () => {
    // explorer stageIdx=2 → base 400+2*200=800 → cold start 1060
    expect(getRating('WON', 'biology', 'explorer')).toBe(1060)
    // tiny stageIdx=0 → base 400 → cold start 660
    expect(getRating('WON', 'biology', 'tiny')).toBe(660)
  })
})

describe('pickItems', () => {
  const pool: Item[] = [1, 2, 3, 4, 5].map(d => mkItem({ id: `d${d}`, difficulty: d }))

  it('targets items near 0.75 predicted success for the learner\'s current rating', () => {
    // Seed a low rating in this skill so easy items (low seedRating) are the ZPD match.
    recordAttempt('NUM', 'arith', false, seedRating(mkItem({ difficulty: 1 })), 'explorer')
    recordAttempt('NUM', 'arith', false, seedRating(mkItem({ difficulty: 1 })), 'explorer')
    const picked = pickItems(pool, 1, 'explorer')
    // Low-rated learner should be steered toward the easier end of the pool, not the hardest.
    expect(picked[0].difficulty).toBeLessThanOrEqual(3)
  })

  it('steers a high-rated learner toward harder items than a low-rated learner', () => {
    for (let i = 0; i < 6; i++) recordAttempt('NUM', 'geometry', true, seedRating(mkItem({ difficulty: 5 })), 'explorer')
    const highPicked = pickItems(pool.map(p => ({ ...p, skill: 'geometry' })), 1, 'explorer')

    for (let i = 0; i < 6; i++) recordAttempt('NUM', 'placevalue', false, seedRating(mkItem({ difficulty: 1 })), 'explorer')
    const lowPicked = pickItems(pool.map(p => ({ ...p, skill: 'placevalue' })), 1, 'explorer')

    expect(highPicked[0].difficulty).toBeGreaterThanOrEqual(lowPicked[0].difficulty)
  })

  it('returns the full (shuffled) pool untouched when candidates <= count', () => {
    const small = pool.slice(0, 2)
    const picked = pickItems(small, 5, 'explorer')
    expect(picked).toHaveLength(2)
    expect(new Set(picked.map(i => i.id))).toEqual(new Set(small.map(i => i.id)))
  })
})

describe('repairItem', () => {
  it('offers an easier item of the same skill targeting ~85% success', () => {
    const missed = mkItem({ id: 'miss', difficulty: 4 })
    const pool = [missed, mkItem({ id: 'easy', difficulty: 1 }), mkItem({ id: 'hard', difficulty: 5 })]
    const repair = repairItem(pool, missed, new Set(), 'explorer')
    expect(repair).not.toBeNull()
    expect(repair!.id).not.toBe('miss')
  })
  it('returns null when no other candidate of the same skill exists', () => {
    const missed = mkItem({ id: 'miss' })
    const repair = repairItem([missed], missed, new Set(), 'explorer')
    expect(repair).toBeNull()
  })
})

describe('masteryLevel', () => {
  it.each([
    [undefined, false, 'not-started'],
    [{ mastery: 0, box: 1 }, true, 'attempted'],
    [{ mastery: 0.2, box: 1 }, true, 'attempted'],
    [{ mastery: 0.4, box: 1 }, true, 'familiar'],
    [{ mastery: 0.7, box: 1 }, true, 'proficient'],
    [{ mastery: 0.9, box: 2 }, true, 'proficient'],   // high mastery but box<4 → not yet mastered
    [{ mastery: 0.9, box: 4 }, true, 'mastered'],
  ] as const)('%o attempted=%s -> %s', (m, attempted, expected) => {
    expect(masteryLevel(m as { mastery: number; box: number } | undefined, attempted)).toBe(expected)
  })
})
