// Daily & weekly quests — a lightweight re-engagement loop. Counters live in
// localStorage, namespaced PER KID (pkey) so accounts on a shared device don't
// share a counter, and reset on the kid's LOCAL day/week; events bump them via
// bumpQuest(). The daily quests form ONE guided CHAIN that threads every surface
// of the app: Learn → Explore → Befriend → Build → Show.
import { pkey } from './player'
import { localDay } from './day'

const KEY = 'argantalab_quests_v1'

export interface Counters { nodes: number; boss: number; xp: number; befriend: number; dungeon: number; publish: number; drill: number; harvest: number }
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
const zero = (): Counters => ({ nodes: 0, boss: 0, xp: 0, befriend: 0, dungeon: 0, publish: 0, drill: 0, harvest: 0 })

function load(): QState {
  let s: QState
  try { s = JSON.parse(localStorage.getItem(pkey(KEY)) || '') } catch { s = null as unknown as QState }
  if (!s) s = { date: today(), week: weekId(), daily: zero(), weekly: zero(), claimed: [] }
  // back-fill any newly-added counters on older saved state
  s.daily = { ...zero(), ...s.daily }; s.weekly = { ...zero(), ...s.weekly }
  // resets
  if (s.date !== today()) { s.date = today(); s.daily = zero(); s.claimed = s.claimed.filter(id => id.startsWith('w_')) }
  if (s.week !== weekId()) { s.week = weekId(); s.weekly = zero(); s.claimed = s.claimed.filter(id => !id.startsWith('w_')) }
  return s
}
function save(s: QState) { try { localStorage.setItem(pkey(KEY), JSON.stringify(s)) } catch { /* ignore */ } }

export type QuestKind = 'node' | 'boss' | 'xp' | 'befriend' | 'dungeon' | 'publish' | 'drill' | 'harvest'

export function bumpQuest(kind: QuestKind, n = 1) {
  const s = load()
  const both = (k: keyof Counters, v: number) => { s.daily[k] += v; s.weekly[k] += v }
  if (kind === 'node') both('nodes', n)
  else if (kind === 'boss') { both('boss', n); both('nodes', n) }
  else if (kind === 'xp') both('xp', n)
  else if (kind === 'befriend') both('befriend', n)
  else if (kind === 'dungeon') both('dungeon', n)
  else if (kind === 'publish') both('publish', n)
  else if (kind === 'drill') both('drill', n)
  else if (kind === 'harvest') both('harvest', n)
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
  step?: number          // chain order (daily quests only)
  label?: string         // the chain stage name (Learn / Explore / …)
  route?: string         // tab to open when the kid taps this step
}

export const QUESTS: QuestDef[] = [
  // ── the daily chain: one quest line through every surface ──
  { id: 'd_learn',    scope: 'daily', step: 1, label: 'Learn',    title: 'Finish 2 lessons',    icon: '📚', metric: c => c.nodes,    target: 2, reward: { diamonds: 10 }, route: 'learn' },
  { id: 'd_explore',  scope: 'daily', step: 2, label: 'Explore',  title: 'Clear a dungeon',     icon: '🗺️', metric: c => c.dungeon,  target: 1, reward: { diamonds: 12 }, route: 'kinworld' },
  { id: 'd_befriend', scope: 'daily', step: 3, label: 'Befriend', title: 'Befriend a kin',      icon: '💗', metric: c => c.befriend, target: 1, reward: { diamonds: 15 }, route: 'kinworld' },
  { id: 'd_build',    scope: 'daily', step: 4, label: 'Build',    title: 'Publish a game',      icon: '🛠️', metric: c => c.publish,  target: 1, reward: { diamonds: 20 }, route: 'lab' },
  { id: 'd_show',     scope: 'daily', step: 5, label: 'Show',     title: 'Earn 80 XP today',    icon: '⭐', metric: c => c.xp,       target: 80, reward: { diamonds: 12 }, route: 'arganta' },
  // ── weekly ──
  { id: 'w_nodes', scope: 'weekly', title: 'Complete 10 lessons this week', icon: '🏅', metric: c => c.nodes, target: 10, reward: { diamonds: 40, xp: 50 } },
  { id: 'w_dungeon', scope: 'weekly', title: 'Clear 3 dungeons this week', icon: '🗺️', metric: c => c.dungeon, target: 3, reward: { diamonds: 30 } },
  { id: 'w_harvest', scope: 'weekly', title: 'Harvest your town 3 times', icon: '🌾', metric: c => c.harvest, target: 3, reward: { diamonds: 25 } },
  { id: 'w_befriend', scope: 'weekly', title: 'Befriend 3 kin this week', icon: '🐾', metric: c => c.befriend, target: 3, reward: { diamonds: 30 } },
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
