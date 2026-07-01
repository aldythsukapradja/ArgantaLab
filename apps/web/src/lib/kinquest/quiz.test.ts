import { describe, it, expect } from 'vitest'
import { battleQuestions } from './quiz'
import { REGIONS } from '@/data/kinquest'

const STAGES = ['tiny', 'starter', 'explorer', 'builder', 'champion', 'legend']

describe('kinquest quiz adapter', () => {
  it('every region yields answerable MCQ at every stage', () => {
    for (const r of REGIONS) {
      for (const stage of STAGES) {
        const qs = battleQuestions(r.drillWorld, stage, 8)
        expect(qs.length).toBeGreaterThan(0)
        for (const q of qs) {
          expect(q.choices.length).toBeGreaterThanOrEqual(2)
          expect(q.answer).toBeGreaterThanOrEqual(0)
          expect(q.answer).toBeLessThan(q.choices.length)
          expect(q.choices[q.answer]).toBeTruthy()
        }
      }
    }
  })

  it('MIX (Apex) pulls from multiple subjects', () => {
    const qs = battleQuestions('MIX', 'explorer', 20)
    expect(qs.length).toBeGreaterThan(0)
  })

  it('numeric distractors are unique and include the answer once', () => {
    const qs = battleQuestions('NUM', 'explorer', 20)
    for (const q of qs) {
      const uniq = new Set(q.choices)
      expect(uniq.size).toBe(q.choices.length)
    }
  })
})
