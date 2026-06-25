// Daily & weekly quests — a lightweight re-engagement loop. Counters live in
// localStorage, namespaced PER KID (pkey) so accounts on a shared device don't
// share a counter, and reset on the kid's LOCAL day/week; events bump them via
// bumpQuest().
import { pkey } from './player'
import { localDay } from './day'

const KEY = 'argantalab_quests_v1'

export interface Counters { nodes: number; boss: number; xp: number }
interface QState {
  date: string
  week: string
  daily: Counters
  weekly: Counters
  claimed: string[]      // quest ids claimed (daily ids cleared each day)
}

const today = () => localDay()
function weekId() {
  const d = new Date()
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const wk = Math.ceil((((d.getTime() - jan1.getTime()) / 86400000) + jan1.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${wk}`
}
const zero = (): Counters => ({ nodes: 0, boss: 0, xp: 0 })

function load(): QState {
  let s: QState
  try { s = JSON.parse(localStorage.getItem(pkey(KEY)) || '') } catch { s = null as unknown as QState }
  if (!s) s = { date: today(), week: weekId(), daily: zero(), weekly: zero(), claimed: [] }
  // resets
  if (s.date !== today()) { s.date = today(); s.daily = zero(); s.claimed = s.claimed.filter(id => id.startsWith('w_')) }
  if (s.week !== weekId()) { s.week = weekId(); s.weekly = zero(); s.claimed = s.claimed.filter(id => !id.startsWith('w_')) }
  return s
}
function save(s: QState) { try { localStorage.setItem(pkey(KEY), JSON.stringify(s)) } catch { /* ignore */ } }

export function bumpQuest(kind: 'node' | 'boss' | 'xp', n = 1) {
  const s = load()
  if (kind === 'node') { s.daily.nodes += n; s.weekly.nodes += n }
  else if (kind === 'boss') { s.daily.boss += n; s.weekly.boss += n; s.daily.nodes += n; s.weekly.nodes += n }
  else if (kind === 'xp') { s.daily.xp += n; s.weekly.xp += n }
  save(s)
}

export interface QuestDef {
  id: string
  scope: 'daily' | 'weekly'
  title: string
  icon: string
  metric: (c: Counters) => number
  target: number
  reward: { diamonds?: number; xp?: number }
}

export const QUESTS: QuestDef[] = [
  { id: 'd_nodes', scope: 'daily', title: 'Complete 2 lessons', icon: '📚', metric: c => c.nodes, target: 2, reward: { diamonds: 10 } },
  { id: 'd_xp', scope: 'daily', title: 'Earn 40 XP', icon: '⭐', metric: c => c.xp, target: 40, reward: { diamonds: 8 } },
  { id: 'd_boss', scope: 'daily', title: 'Beat a boss', icon: '👑', metric: c => c.boss, target: 1, reward: { diamonds: 15 } },
  { id: 'w_nodes', scope: 'weekly', title: 'Complete 10 lessons this week', icon: '🏅', metric: c => c.nodes, target: 10, reward: { diamonds: 40, xp: 50 } },
  { id: 'w_boss', scope: 'weekly', title: 'Beat 3 bosses this week', icon: '⚔️', metric: c => c.boss, target: 3, reward: { diamonds: 30 } },
]

/** Raw daily + weekly activity counters (for the parent dashboard). */
export function getCounters(): { daily: Counters; weekly: Counters } {
  const s = load()
  return { daily: s.daily, weekly: s.weekly }
}

export interface QuestView { def: QuestDef; progress: number; done: boolean; claimed: boolean }
export function getQuests(): QuestView[] {
  const s = load()
  return QUESTS.map(def => {
    const c = def.scope === 'daily' ? s.daily : s.weekly
    const progress = Math.min(def.metric(c), def.target)
    return { def, progress, done: progress >= def.target, claimed: s.claimed.includes(def.id) }
  })
}

/** Claim a completed quest's reward. Returns the reward, or null if not claimable. */
export function claimQuest(id: string): { diamonds?: number; xp?: number } | null {
  const s = load()
  const def = QUESTS.find(q => q.id === id)
  if (!def || s.claimed.includes(id)) return null
  const c = def.scope === 'daily' ? s.daily : s.weekly
  if (def.metric(c) < def.target) return null
  s.claimed.push(id)
  save(s)
  return def.reward
}
