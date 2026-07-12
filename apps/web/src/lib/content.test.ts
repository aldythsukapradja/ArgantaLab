import { describe, it, expect } from 'vitest'
import { stageFallback } from './content'

describe('stageFallback', () => {
  it('caps neighbours to ±1 stage — never widens further', () => {
    for (const s of ['tiny', 'starter', 'explorer', 'builder', 'champion', 'legend']) {
      expect(stageFallback(s).length).toBeLessThanOrEqual(3)
    }
  })
  it('includes the stage itself plus its immediate neighbours only', () => {
    expect(stageFallback('explorer').sort()).toEqual(['builder', 'explorer', 'starter'].sort())
  })
  it('handles the tiny edge (no lower neighbour) without throwing or padding further', () => {
    const out = stageFallback('tiny')
    expect(out).toContain('tiny')
    expect(out).toContain('starter')
    expect(out).not.toContain('legend')
    expect(out.length).toBe(2)
  })
  it('handles the legend edge (no upper neighbour) without throwing or padding further', () => {
    const out = stageFallback('legend')
    expect(out).toContain('legend')
    expect(out).toContain('champion')
    expect(out).not.toContain('tiny')
    expect(out.length).toBe(2)
  })
  it('falls back to explorer for an unknown stage key', () => {
    expect(stageFallback('nonsense')).toEqual(['explorer'])
  })
})
