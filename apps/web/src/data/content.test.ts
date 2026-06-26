import { describe, it, expect } from 'vitest'
import { LOCAL_ITEMS, type Item } from './learn'

// Battle-test EVERY question's payload so a broken item (answer index out of
// range, a cloze answer that isn't an option, a sort bucket that doesn't exist…)
// can never ship. Validates the well-defined interaction types; skips free-form
// ones (party/label/pte/etc.).
function problem(item: Item): string | null {
  const p = item.payload as Record<string, unknown>
  const arr = (k: string) => Array.isArray(p[k]) ? (p[k] as unknown[]) : null
  switch (item.type) {
    case 'mcq': case 'map': {
      const c = arr('choices'); if (!c || c.length < 2) return 'choices<2'
      const a = p.answer; if (typeof a !== 'number' || a < 0 || a >= c.length) return 'answer-range'
      // NB: duplicate choices are allowed — "odd one out" items repeat on purpose.
      return null
    }
    case 'multi': {
      const c = arr('choices'); if (!c || c.length < 2) return 'choices<2'
      const a = arr('answers'); if (!a || a.length === 0 || a.some(x => typeof x !== 'number' || x < 0 || x >= c.length)) return 'answers-range'
      return null
    }
    case 'type': case 'speed':
      if (p.answer == null && !arr('questions')) return 'no-answer'
      return null
    case 'cloze': {
      const o = arr('options'); if (!o || o.length < 2) return 'options<2'
      if (p.answer == null || !o.includes(p.answer)) return 'answer-not-in-options'
      return null
    }
    case 'match': {
      const pr = arr('pairs'); if (!pr || pr.length < 2) return 'pairs<2'
      if (pr.some(x => !Array.isArray(x) || x.length < 2)) return 'pair-shape'
      return null
    }
    case 'sort': {
      const b = arr('buckets'), it2 = arr('items')
      if (!b || !it2 || b.length < 2 || it2.length < 1) return 'sort-shape'
      if (it2.some(x => { const bk = (x as { bucket?: unknown }).bucket; return typeof bk !== 'number' || bk < 0 || bk >= b.length })) return 'bucket-range'
      return null
    }
    case 'seq':
      if (!arr('items') || (arr('items')!.length) < 2) return 'seq<2'
      return null
    case 'bank':
      if (!arr('tiles') || !arr('answer')) return 'bank-shape'
      return null
    default:
      return null
  }
}

describe('content integrity (all bundled items)', () => {
  it('has a healthy bank size', () => {
    expect(LOCAL_ITEMS.length).toBeGreaterThan(500)
  })
  it('every item id is unique', () => {
    const ids = LOCAL_ITEMS.map(i => i.id)
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
    expect(dupes).toEqual([])
  })
  it('every validated item has a coherent, answerable payload', () => {
    const bad = LOCAL_ITEMS.map(i => ({ id: i.id, type: i.type, why: problem(i) })).filter(x => x.why)
    if (bad.length) console.log('[content] bad items:', bad.slice(0, 30))
    expect(bad.length).toBe(0)
  })
  it('covers all six stages', () => {
    const stages = new Set(LOCAL_ITEMS.map(i => i.stage))
    for (const s of ['tiny', 'starter', 'explorer', 'builder', 'champion', 'legend']) expect(stages.has(s)).toBe(true)
  })
  it('covers all six worlds', () => {
    const worlds = new Set(LOCAL_ITEMS.map(i => i.world))
    for (const w of ['NUM', 'WRD', 'WON', 'LOG', 'WLD', 'LIF']) expect(worlds.has(w)).toBe(true)
  })
})
