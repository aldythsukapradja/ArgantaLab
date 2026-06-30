import type { WizardConfig } from '@/data/wizard'
import { memStore } from './memStore'

// Session-only game cache (in memory, namespaced per signed-in user). The cloud
// `games` table is the single source of truth; this is just hydrated from it.
export interface SavedGame {
  id: string
  title: string
  source: 'wizard' | 'procode'
  config?: WizardConfig
  html: string
  createdAt: number
  plays: number
  published?: boolean
  slug?: string
  category?: string
  desc?: string
}

const BASE = 'argantalab_games_v1'
let owner = 'guest'

/** Set the active games owner (call on login/logout). */
export function setGamesOwner(id: string | null) {
  owner = id || 'guest'
}

const keyFor = () => `${BASE}__${owner}`

export function getMyGame(idOrSlug: string): SavedGame | undefined {
  return loadMyGames().find(g => g.id === idOrSlug || g.slug === idOrSlug)
}

export function loadMyGames(): SavedGame[] {
  try { return JSON.parse(memStore.getItem(keyFor()) || '[]') } catch { return [] }
}

export function saveMyGame(g: SavedGame): SavedGame[] {
  const all = loadMyGames()
  const idx = all.findIndex(x => x.id === g.id)
  if (idx >= 0) all[idx] = g; else all.unshift(g)
  memStore.setItem(keyFor(), JSON.stringify(all))
  return all
}

export function deleteMyGame(id: string): SavedGame[] {
  const all = loadMyGames().filter(g => g.id !== id)
  memStore.setItem(keyFor(), JSON.stringify(all))
  return all
}

export function newGameId(): string {
  return 'g_' + Math.random().toString(36).slice(2, 9)
}

/** Replace the current owner's local games with the cloud set (cloud wins).
 *  Used on login so the signed-in user sees exactly their own games. */
export function replaceWithCloud(cloud: SavedGame[]): SavedGame[] {
  const all = [...cloud].sort((a, b) => b.createdAt - a.createdAt)
  memStore.setItem(keyFor(), JSON.stringify(all))
  return all
}

/** Merge cloud games into the current owner's bucket (cloud wins per id). */
export function mergeCloudGames(cloud: SavedGame[]): SavedGame[] {
  const local = loadMyGames()
  const byId = new Map<string, SavedGame>()
  for (const g of local) byId.set(g.id, g)
  for (const g of cloud) byId.set(g.id, g)
  const all = Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt)
  memStore.setItem(keyFor(), JSON.stringify(all))
  return all
}
