import type { Item } from '@/data/learn'
import { pkey } from './player'
import { memStore } from './memStore'

// Adaptive engine (DoodleMaths / Leitner style). Mastery + spaced-repetition box
// per skill live in localStorage for instant, offline play; best-effort mirrored
// to the cloud `skill_mastery` table for the signed-in user. Namespaced per player.

export interface SkillState { mastery: number; box: number; lastSeen: number; rating?: number; n?: number }
const KEY = 'argantalab_mastery_v1'

type Store = Record<string, SkillState>  // keyed by `${world}/${skill}`

function load(): Store {
  try { return JSON.parse(memStore.getItem(pkey(KEY)) || '{}') } catch { return {} }
}
function save(s: Store) { try { memStore.setItem(pkey(KEY), JSON.stringify(s)) } catch { /* ignore */ } }

export function getMastery(world: string, skill: string): number {
  return load()[`${world}/${skill}`]?.mastery ?? 0
}

// ── Item difficulty ratings (Wave 1 seed, static) ──────────────
// Every item gets a deterministic rating derived from its stage band and its
// 1..5 difficulty rung. This is the fixed "item side" of the Elo model below —
// only the learner's rating floats.
const STAGE_ORDER = ['tiny', 'starter', 'explorer', 'builder', 'champion', 'legend']
export function seedRating(item: Pick<Item, 'stage' | 'difficulty'>): number {
  const stageIdx = Math.max(0, STAGE_ORDER.indexOf(item.stage))
  const rung = Math.max(1, Math.min(5, item.difficulty))
  return 400 + stageIdx * 200 + (rung - 1) * 40   // tiny/d1=400 … legend/d5=1560
}

// ── Elo-style ZPD targeting ─────────────────────────────────────
// Item ratings are static (seedRating); the learner's per-skill rating floats
// so item selection can target ~75% predicted success (the Zone of Proximal
// Development) instead of a raw mastery/random mix. See
// docs/curriculum-wave2-spec.md for the full design rationale.
const ELO_SCALE = 400
export function expectedSuccess(itemRating: number, learnerRating: number): number {
  return 1 / (1 + Math.pow(10, (itemRating - learnerRating) / ELO_SCALE))
}
function kFactor(n: number): number { return n < 5 ? 40 : n < 20 ? 24 : 16 }
function coldStartRating(stage: string): number {
  const idx = Math.max(0, STAGE_ORDER.indexOf(stage))
  return 400 + idx * 200 + 260
}
export function getRating(world: string, skill: string, stage: string): number {
  return load()[`${world}/${skill}`]?.rating ?? coldStartRating(stage)
}

export function recordAttempt(world: string, skill: string, correct: boolean, itemRating: number, stage: string) {
  const store = load()
  const k = `${world}/${skill}`
  const cur = store[k] ?? { mastery: 0, box: 1, lastSeen: 0 }
  const mastery = Math.max(0, Math.min(1, cur.mastery + (correct ? 0.2 : -0.15)))
  const box = correct ? Math.min(5, cur.box + 1) : 1   // wrong → back to box 1 (resurface soon)
  const n = cur.n ?? 0
  const Ru = cur.rating ?? coldStartRating(stage)
  const E = expectedSuccess(itemRating, Ru)
  const rating = Ru + kFactor(n) * ((correct ? 1 : 0) - E)
  store[k] = { mastery, box, lastSeen: Date.now(), rating, n: n + 1 }
  save(store)
  // NOTE: the cloud is updated by the log_learn_event RPC (see lib/analytics.ts),
  // which is now the single writer of cloud skill_mastery. This local store only
  // drives instant, offline, this-session UI for the active player.
}

/**
 * Pick `count` items for a node from a candidate pool.
 * Strategy: target the Zone of Proximal Development — the item whose predicted
 * success (given the learner's floating rating) is closest to 0.75, with a
 * light jitter so a session never feels identical twice.
 */
export function pickItems(candidates: Item[], count: number, stage: string): Item[] {
  if (candidates.length <= count) return shuffle(candidates)
  const scored = candidates.map(i => {
    const Ru = getRating(i.world, i.skill, stage)
    const E = expectedSuccess(seedRating(i), Ru)
    const score = Math.abs(E - 0.75) + Math.random() * 0.05
    return { i, score }
  })
  scored.sort((a, b) => a.score - b.score)
  return scored.slice(0, count).map(s => s.i)
}

/** Mistake-repair: queue an item of the same skill targeting ~85% success — reliably
 *  easier than what was just missed, but not trivial. */
export function repairItem(pool: Item[], missed: Item, alreadyUsed: Set<string>, stage: string): Item | null {
  const Ru = getRating(missed.world, missed.skill, stage)
  const cands = pool.filter(i => i.skill === missed.skill && !alreadyUsed.has(i.id) && i.id !== missed.id)
  if (!cands.length) return null
  return cands.sort((a, b) =>
    Math.abs(expectedSuccess(seedRating(a), Ru) - 0.85) -
    Math.abs(expectedSuccess(seedRating(b), Ru) - 0.85))[0]
}

function shuffle<T>(a: T[]): T[] {
  const arr = [...a]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export { shuffle }
