import type { WizardConfig } from '@/data/wizard'

// Locally-saved creations. (Cloud sync to a Supabase `games` table comes with
// the Ship/marketplace increment; the shape here is already cloud-ready.)
export interface SavedGame {
  id: string
  title: string
  source: 'wizard' | 'procode'
  config?: WizardConfig
  html: string
  createdAt: number
  plays: number
}

const KEY = 'argantalab_games_v1'

export function loadMyGames(): SavedGame[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

export function saveMyGame(g: SavedGame): SavedGame[] {
  const all = loadMyGames()
  const idx = all.findIndex(x => x.id === g.id)
  if (idx >= 0) all[idx] = g; else all.unshift(g)
  localStorage.setItem(KEY, JSON.stringify(all))
  return all
}

export function deleteMyGame(id: string): SavedGame[] {
  const all = loadMyGames().filter(g => g.id !== id)
  localStorage.setItem(KEY, JSON.stringify(all))
  return all
}

export function newGameId(): string {
  return 'g_' + Math.random().toString(36).slice(2, 9)
}
