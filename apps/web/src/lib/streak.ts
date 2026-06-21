// Simple daily streak, kept in localStorage. Call touchStreak() once when the
// app opens; getStreak() to read the current count.

const KEY = 'argantalab_streak_v1'
const today = () => new Date().toISOString().slice(0, 10)

interface S { last: string; count: number }

function load(): S {
  try { return JSON.parse(localStorage.getItem(KEY) || '') } catch { return { last: '', count: 0 } }
}

export function getStreak(): number {
  const s = load()
  const t = today()
  if (s.last === t) return s.count
  // if last activity was before yesterday, the streak is stale
  const yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10)
  return s.last === yest ? s.count : 0
}

export function touchStreak(): number {
  const s = load()
  const t = today()
  if (s.last === t) return s.count
  const yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10)
  const count = s.last === yest ? s.count + 1 : 1
  try { localStorage.setItem(KEY, JSON.stringify({ last: t, count })) } catch { /* ignore */ }
  return count
}
