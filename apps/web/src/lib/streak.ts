// Daily streak. Namespaced PER KID (pkey) so two accounts on one device never
// share a streak, and bounded to the kid's LOCAL day (localDay) so it rolls at
// local midnight, not UTC. Call touchStreak() once when the app opens;
// getStreak() to read the current count.
import { pkey } from './player'
import { localDay, localYesterday } from './day'

const KEY = 'argantalab_streak_v1'
const today = () => localDay()

interface S { last: string; count: number }

function load(): S {
  try { return JSON.parse(localStorage.getItem(pkey(KEY)) || '') } catch { return { last: '', count: 0 } }
}

export function getStreak(): number {
  const s = load()
  if (s.last === today()) return s.count
  // if last activity was before yesterday, the streak is stale
  return s.last === localYesterday() ? s.count : 0
}

export function touchStreak(): number {
  const s = load()
  const t = today()
  if (s.last === t) return s.count
  const count = s.last === localYesterday() ? s.count + 1 : 1
  try { localStorage.setItem(pkey(KEY), JSON.stringify({ last: t, count })) } catch { /* ignore */ }
  return count
}
