import { supabase } from './supabase'
import type { SavedGame } from './myGames'

// Best-effort cloud sync for saved games. All calls degrade silently when the
// backend/table isn't there, so the app always works on localStorage.

export async function pushGame(userId: string, g: SavedGame): Promise<void> {
  try {
    await supabase.from('games').upsert({
      id: g.id, user_id: userId, title: g.title, source: g.source,
      config: g.config ?? null, html: g.html, plays: g.plays,
    })
  } catch { /* ignore */ }
}

export async function deleteGameCloud(userId: string, id: string): Promise<void> {
  try { await supabase.from('games').delete().eq('id', id).eq('user_id', userId) } catch { /* ignore */ }
}

export async function pullGames(userId: string): Promise<SavedGame[] | null> {
  try {
    const { data, error } = await supabase.from('games').select('*').eq('user_id', userId)
    if (error) return null
    return (data ?? []).map(r => ({
      id: r.id as string,
      title: r.title as string,
      source: (r.source as 'wizard' | 'procode') ?? 'procode',
      config: (r.config as SavedGame['config']) ?? undefined,
      html: r.html as string,
      createdAt: r.created_at ? Date.parse(r.created_at as string) : Date.now(),
      plays: (r.plays as number) ?? 0,
    }))
  } catch { return null }
}
