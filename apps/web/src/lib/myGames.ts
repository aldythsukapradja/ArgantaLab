import type { WizardConfig } from '@/data/wizard'

// Locally-saved creations, namespaced per signed-in user so switching accounts
// never shows another account's games. Guests use a shared 'guest' bucket.
// Cloud sync (Supabase `games`) remains the source of truth across devices.
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
}

const BASE = 'argantalab_games_v1'
let owner = 'guest'

/** Set the active games owner (call on login/logout). Migrates the legacy
 *  un-namespaced bucket into the guest bucket once. */
export function setGamesOwner(id: string | null) {
  owner = id || 'guest'
  // one-time migration of the old global key into the guest bucket
  try {
    const legacy = localStorage.getItem(BASE)
    if (legacy && !localStorage.getItem(`${BASE}__guest`)) {
      localStorage.setItem(`${BASE}__guest`, legacy)
      localStorage.removeItem(BASE)
    }
  } catch { /* ignore */ }
}

const keyFor = () => `${BASE}__${owner}`

export function getMyGame(idOrSlug: string): SavedGame | undefined {
  return loadMyGames().find(g => g.id === idOrSlug || g.slug === idOrSlug)
}

export function loadMyGames(): SavedGame[] {
  try { return JSON.parse(localStorage.getItem(keyFor()) || '[]') } catch { return [] }
}

export function saveMyGame(g: SavedGame): SavedGame[] {
  const all = loadMyGames()
  const idx = all.findIndex(x => x.id === g.id)
  if (idx >= 0) all[idx] = g; else all.unshift(g)
  localStorage.setItem(keyFor(), JSON.stringify(all))
  return all
}

export function deleteMyGame(id: string): SavedGame[] {
  const all = loadMyGames().filter(g => g.id !== id)
  localStorage.setItem(keyFor(), JSON.stringify(all))
  return all
}

export function newGameId(): string {
  return 'g_' + Math.random().toString(36).slice(2, 9)
}

/** Replace the current owner's local games with the cloud set (cloud wins).
 *  Used on login so the signed-in user sees exactly their own games. */
export function replaceWithCloud(cloud: SavedGame[]): SavedGame[] {
  const all = [...cloud].sort((a, b) => b.createdAt - a.createdAt)
  localStorage.setItem(keyFor(), JSON.stringify(all))
  return all
}

/** Merge cloud games into the current owner's bucket (cloud wins per id). */
export function mergeCloudGames(cloud: SavedGame[]): SavedGame[] {
  const local = loadMyGames()
  const byId = new Map<string, SavedGame>()
  for (const g of local) byId.set(g.id, g)
  for (const g of cloud) byId.set(g.id, g)
  const all = Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt)
  localStorage.setItem(keyFor(), JSON.stringify(all))
  return all
}
