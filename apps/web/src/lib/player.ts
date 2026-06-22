// ============================================================
//  PLAYER SESSION  — who is using the app right now
//  'owner' = the grown-up / account holder. 'kid_<id>' = a child.
//  This namespaces local progress (rings, mastery) so each kid has
//  their OWN worlds, and stores a per-player identity snapshot
//  (name, avatar, wallet, cosmetics) so switching is a clean swap.
// ============================================================

const PKEY = 'argantalab_player_v1'
const SNAP = 'argantalab_psnap_v1'

let _id = 'owner'
try { _id = localStorage.getItem(PKEY) || 'owner' } catch { /* ignore */ }

export function getPlayerId(): string { return _id }

export function setPlayerId(id: string) {
  _id = id || 'owner'
  try { localStorage.setItem(PKEY, _id) } catch { /* ignore */ }
}

/** Namespace a localStorage base key by the active player.
 *  The owner keeps the original (un-suffixed) key for back-compat. */
export function pkey(base: string): string {
  return _id === 'owner' ? base : `${base}__${_id}`
}

// ── per-player identity snapshot ────────────────────────────
export interface PlayerSnapshot {
  learnerName: string
  avatar: string
  xp: number
  level: number
  diamonds: number
  unlocks: string[]
  badges: string[]
  completedLessons: string[]
  gamesPlayed: string[]
  costume: string | null
  outfit: Record<string, string>
  ownedCosmetics: string[]
}

function loadAll(): Record<string, PlayerSnapshot> {
  try { return JSON.parse(localStorage.getItem(SNAP) || '{}') } catch { return {} }
}

export function saveSnapshot(playerId: string, snap: PlayerSnapshot) {
  const all = loadAll()
  all[playerId] = snap
  try { localStorage.setItem(SNAP, JSON.stringify(all)) } catch { /* ignore */ }
}

export function loadSnapshot(playerId: string): PlayerSnapshot | null {
  return loadAll()[playerId] ?? null
}
