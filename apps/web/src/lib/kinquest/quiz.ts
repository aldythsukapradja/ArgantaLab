// ============================================================
//  ARGANTALAB · KINQUEST · QUIZ ADAPTER
//  Battles are powered by REAL schoolwork. This pulls multiple-choice
//  questions straight from the drill generators (data/drills.ts), scaled to
//  the kid's own stage (year level) — so a Keeper fight in Numeria is a wall
//  of *their* maths, and the same fight is easier for a 6-year-old than a
//  10-year-old. Zero new question content: one source of truth for learning.
//
//  We keep only quick-tap MCQ: catalog `mcq` items already have choices, and
//  numeric `type` items are converted to 4-way MCQ with near-miss distractors.
//  Visual drills (clock/flag) and multi-step ones (match/sort/seq) are skipped
//  — a battle turn needs a single tap.
// ============================================================

import { DRILLS_BY_WORLD, type DrillItem } from '@/data/drills'

export interface BattleQuestion {
  prompt: string
  choices: string[]
  answer: number       // index into choices
  skill: string
  explanation?: string
}

const shuffle = <T,>(a: T[]): T[] => {
  const s = [...a]
  for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[s[i], s[j]] = [s[j], s[i]] }
  return s
}

// Build 3 near-miss numeric distractors around a correct number.
function numericDistractors(answer: number): string[] {
  const out = new Set<string>()
  const deltas = [1, -1, 2, -2, 10, -10, 3, 5]
  for (const d of shuffle(deltas)) {
    const v = answer + d
    if (v >= 0 && v !== answer) out.add(String(v))
    if (out.size >= 3) break
  }
  // pad if we somehow came up short (tiny answers)
  let pad = answer + 4
  while (out.size < 3) { if (pad !== answer && pad >= 0) out.add(String(pad)); pad++ }
  return [...out].slice(0, 3)
}

// Turn one DrillItem into a BattleQuestion, or null if it isn't tap-friendly.
function toQuestion(item: DrillItem): BattleQuestion | null {
  const p = item.payload as Record<string, unknown> | undefined
  if (!p) return null

  // Already MCQ-shaped: choices + numeric answer index (mcq)
  if (Array.isArray(p.choices) && typeof p.answer === 'number' && item.type === 'mcq') {
    const choices = p.choices as string[]
    if (choices.length >= 2) {
      return { prompt: item.prompt, choices, answer: p.answer, skill: item.skill, explanation: item.explanation }
    }
  }

  // Numeric typed → synthesize a 4-way MCQ
  if (item.type === 'type' && typeof p.answer === 'string' && /^-?\d+$/.test(p.answer)) {
    const n = parseInt(p.answer, 10)
    const distract = numericDistractors(n)
    const choices = shuffle([p.answer as string, ...distract])
    return { prompt: item.prompt, choices, answer: choices.indexOf(p.answer as string), skill: item.skill, explanation: item.explanation }
  }

  return null
}

/** A fresh batch of battle questions for a drill world + stage. `world` may be 'MIX'. */
export function battleQuestions(world: string, stage: string, n = 12): BattleQuestion[] {
  const worlds = world === 'MIX' ? Object.keys(DRILLS_BY_WORLD) : [world]
  const pool: BattleQuestion[] = []

  for (const w of worlds) {
    const drills = DRILLS_BY_WORLD[w] ?? []
    for (const d of drills) {
      let items: DrillItem[] = []
      try { items = d.gen(stage) } catch { items = [] }
      for (const it of items) {
        const q = toQuestion(it)
        if (q) pool.push(q)
      }
    }
  }

  const picked = shuffle(pool).slice(0, n)
  // Absolute fallback so a battle is never unanswerable if a world had no MCQ.
  if (picked.length === 0) {
    return [{ prompt: '2 + 3 = ?', choices: ['5', '4', '6', '3'], answer: 0, skill: 'arith' }]
  }
  return picked
}

/** One question generator that never runs dry — cycles a pre-fetched batch. */
export function makeQuizFeed(world: string, stage: string): () => BattleQuestion {
  let batch = battleQuestions(world, stage, 16)
  let i = 0
  return () => {
    if (i >= batch.length) { batch = battleQuestions(world, stage, 16); i = 0 }
    return batch[i++]
  }
}
