// ============================================================
//  ARGANTALAB · KINQUEST · MOVES
//  Every kin knows two moves in battle:
//    • a QUICK move — reliable, low power, NO quiz (a 6-year-old can spam it)
//    • a FOCUS move — its element special: fires an academic quiz first;
//      a correct answer powers it up (×1.5), a wrong answer weakens it (×0.4).
//  Plus two universal actions handled by the engine: Guard and Befriend.
//  Move art is a name+emoji+base power — pure data, swappable later.
// ============================================================

import type { Element } from '@/data/openworld'

export interface Move {
  id: string
  name: string
  emoji: string
  power: number
  quiz: boolean        // does firing this move ask an academic question?
  element: Element | null
}

// The shared basic — no quiz, always lands, small chip damage.
export const QUICK_MOVE: Move = { id: 'quick', name: 'Tackle', emoji: '💥', power: 10, quiz: false, element: null }

// One signature FOCUS move per element — quiz-powered, the real damage.
export const FOCUS_MOVE: Record<Element, Move> = {
  pattern: { id: 'f_pattern', name: 'Pattern Blast', emoji: '✶', power: 26, quiz: true, element: 'pattern' },
  order:   { id: 'f_order',   name: 'Order Strike',  emoji: '❖', power: 26, quiz: true, element: 'order' },
  truth:   { id: 'f_truth',   name: 'Truth Beam',    emoji: '✧', power: 26, quiz: true, element: 'truth' },
  place:   { id: 'f_place',   name: 'Terra Slam',    emoji: '◆', power: 26, quiz: true, element: 'place' },
  wonder:  { id: 'f_wonder',  name: 'Wonder Nova',   emoji: '✦', power: 26, quiz: true, element: 'wonder' },
  logic:   { id: 'f_logic',   name: 'Logic Bolt',    emoji: '⬢', power: 26, quiz: true, element: 'logic' },
}

/** The 2-move set a kin brings into battle, derived from its element. */
export function movesFor(element: Element): Move[] {
  return [QUICK_MOVE, FOCUS_MOVE[element]]
}
