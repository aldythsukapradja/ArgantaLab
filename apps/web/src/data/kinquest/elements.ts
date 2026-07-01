// ============================================================
//  ARGANTALAB · KINQUEST · ELEMENTS  (the type wheel)
//  KinQuest reuses the 6 kin elements from data/openworld/kin.ts as a
//  Pokémon-style type chart. Each element beats the next in the ring:
//    pattern → order → truth → place → wonder → logic → (pattern)
//  "beats" = a super-effective hit (×1.5 before the quiz multiplier).
//  Readable, not memorized: the battle UI shows "Super effective!" so a
//  kid learns the wheel by playing, never by studying it.
// ============================================================

import type { Element } from '@/data/openworld'

// Ring order — each element is strong against the NEXT one in this list.
export const ELEMENT_RING: Element[] = ['pattern', 'order', 'truth', 'place', 'wonder', 'logic']

export const ELEMENT_META: Record<Element, { label: string; icon: string; color: string }> = {
  pattern: { label: 'Pattern', icon: '✶', color: '#f0a83a' },
  order:   { label: 'Order',   icon: '❖', color: '#5ec257' },
  truth:   { label: 'Truth',   icon: '✧', color: '#37a8c4' },
  place:   { label: 'Place',   icon: '◆', color: '#f97316' },
  wonder:  { label: 'Wonder',  icon: '✦', color: '#8b5cf6' },
  logic:   { label: 'Logic',   icon: '⬢', color: '#22c55e' },
}

/** Damage multiplier for `atk` element hitting `def` element.
 *  1.5 super-effective, 0.75 resisted (the reverse edge), 1.0 neutral. */
export function typeMultiplier(atk: Element, def: Element): number {
  const ai = ELEMENT_RING.indexOf(atk)
  const di = ELEMENT_RING.indexOf(def)
  if (ai < 0 || di < 0) return 1
  const n = ELEMENT_RING.length
  if ((ai + 1) % n === di) return 1.5   // atk beats def
  if ((di + 1) % n === ai) return 0.75  // def beats atk → atk is resisted
  return 1
}

export function effectivenessLabel(mult: number): string {
  if (mult > 1) return 'Super effective!'
  if (mult < 1) return 'Not very effective…'
  return ''
}
