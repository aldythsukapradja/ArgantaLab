import type { World } from '@/data/learn'
import { getMastery } from './adaptive'

// Per-node journey progress, kept in localStorage for instant offline play.
// (Cloud node_progress mirroring can be layered on later via Supabase.)

export interface NodeState { status: 'open' | 'done'; stars: number }
const KEY = 'argantalab_nodes_v1'

type Store = Record<string, NodeState>  // keyed `${world}/${nodeKey}`

function load(): Store {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}
function save(s: Store) { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ignore */ } }

export function nodeState(world: string, nodeKey: string): NodeState {
  return load()[`${world}/${nodeKey}`] ?? { status: 'open', stars: 0 }
}

export function setNodeDone(world: string, nodeKey: string, stars: number) {
  const s = load()
  const k = `${world}/${nodeKey}`
  const prev = s[k]?.stars ?? 0
  s[k] = { status: 'done', stars: Math.max(prev, stars) }
  save(s)
}

/** A node is unlocked if it's the first overall, or the previous node is done. */
export function nodeUnlocked(world: World, flatIndex: number): boolean {
  if (flatIndex === 0) return true
  const flat = world.units.flatMap(u => u.nodes)
  const prev = flat[flatIndex - 1]
  return nodeState(world.key, prev.key).status === 'done'
}

/** Ring % = blend of nodes completed and average skill mastery. */
export function worldRing(world: World): number {
  const flat = world.units.flatMap(u => u.nodes)
  const doneCount = flat.filter(n => nodeState(world.key, n.key).status === 'done').length
  const nodePct = flat.length ? doneCount / flat.length : 0
  const skills = world.skills
  const masteryAvg = skills.length ? skills.reduce((a, s) => a + getMastery(world.key, s.key), 0) / skills.length : 0
  return Math.round((nodePct * 0.6 + masteryAvg * 0.4) * 100)
}

export function worldComplete(world: World): boolean {
  return world.units.flatMap(u => u.nodes).every(n => nodeState(world.key, n.key).status === 'done')
}

/** Which badges this world has earned, by its data-driven rules. */
export function earnedBadges(world: World): Set<string> {
  const out = new Set<string>()
  for (const b of world.badges) {
    if (b.rule.type === 'world_complete' && worldComplete(world)) out.add(b.key)
    else if (b.rule.type === 'skill_mastery' && b.rule.skill) {
      const pct = getMastery(world.key, b.rule.skill) * 100
      if (pct >= (b.rule.pct ?? 80)) out.add(b.key)
    }
  }
  return out
}
