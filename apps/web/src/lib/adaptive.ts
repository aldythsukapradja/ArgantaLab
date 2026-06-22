import { supabase } from './supabase'
import type { Item } from '@/data/learn'
import { pkey } from './player'
import { memStore } from './memStore'

// Adaptive engine (DoodleMaths / Leitner style). Mastery + spaced-repetition box
// per skill live in localStorage for instant, offline play; best-effort mirrored
// to the cloud `skill_mastery` table for the signed-in user. Namespaced per player.

export interface SkillState { mastery: number; box: number; lastSeen: number }
const KEY = 'argantalab_mastery_v1'

type Store = Record<string, SkillState>  // keyed by `${world}/${skill}`

function load(): Store {
  try { return JSON.parse(memStore.getItem(pkey(KEY)) || '{}') } catch { return {} }
}
function save(s: Store) { try { memStore.setItem(pkey(KEY), JSON.stringify(s)) } catch { /* ignore */ } }

export function getMastery(world: string, skill: string): number {
  return load()[`${world}/${skill}`]?.mastery ?? 0
}

export function recordAttempt(world: string, skill: string, correct: boolean) {
  const store = load()
  const k = `${world}/${skill}`
  const cur = store[k] ?? { mastery: 0, box: 1, lastSeen: 0 }
  const mastery = Math.max(0, Math.min(1, cur.mastery + (correct ? 0.2 : -0.15)))
  const box = correct ? Math.min(5, cur.box + 1) : 1   // wrong → back to box 1 (resurface soon)
  store[k] = { mastery, box, lastSeen: Date.now() }
  save(store)
  // best-effort cloud mirror
  supabase.auth.getUser().then(({ data }) => {
    const uid = data.user?.id
    if (!uid) return
    supabase.from('skill_mastery').upsert({
      user_id: uid, world_key: world, skill_key: skill, mastery, box, last_seen: new Date().toISOString(),
    }).then(() => {}, () => {})
  }, () => {})
}

/**
 * Pick `count` items for a node from a candidate pool.
 * Strategy: weakest skills first (low mastery resurfaces), difficulty near the
 * learner's current band, light shuffle so it never feels identical.
 */
export function pickItems(candidates: Item[], count: number): Item[] {
  if (candidates.length <= count) return shuffle(candidates)
  const scored = candidates.map(i => {
    const m = getMastery(i.world, i.skill)
    // lower mastery → higher priority; add jitter for variety
    const priority = (1 - m) + Math.random() * 0.4
    return { i, priority }
  })
  scored.sort((a, b) => b.priority - a.priority)
  return scored.slice(0, count).map(s => s.i)
}

/** Mistake-repair: an easier item of the same skill to re-queue after a miss. */
export function repairItem(pool: Item[], missed: Item, alreadyUsed: Set<string>): Item | null {
  const easier = pool
    .filter(i => i.skill === missed.skill && !alreadyUsed.has(i.id) && i.id !== missed.id)
    .sort((a, b) => a.difficulty - b.difficulty)
  return easier[0] ?? null
}

function shuffle<T>(a: T[]): T[] {
  const arr = [...a]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export { shuffle }
