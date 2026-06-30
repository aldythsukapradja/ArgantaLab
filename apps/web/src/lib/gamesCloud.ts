import { supabase } from './supabase'
import type { SavedGame } from './myGames'

// Best-effort cloud sync for saved games. All calls degrade silently when the
// backend/table isn't there, so the app always works on localStorage.

export async function pushGame(userId: string, g: SavedGame): Promise<void> {
  try {
    await supabase.from('games').upsert({
      id: g.id, user_id: userId, title: g.title, source: g.source,
      config: g.config ?? null, html: g.html, plays: g.plays, slug: g.slug ?? null,
      category: g.category ?? null,
    })
  } catch { /* ignore */ }
}

export async function deleteGameCloud(userId: string, id: string): Promise<void> {
  try { await supabase.from('games').delete().eq('id', id).eq('user_id', userId) } catch { /* ignore */ }
}

export async function setGameVisibility(userId: string, id: string, visibility: 'private' | 'public', creatorName: string, slug?: string): Promise<void> {
  try {
    const patch: Record<string, unknown> = { visibility, creator_name: creatorName }
    if (slug) patch.slug = slug
    await supabase.from('games').update(patch).eq('id', id).eq('user_id', userId)
  } catch { /* ignore */ }
}

// Public read (anon ok) for the /play/:slug share page. Accepts slug OR id.
export async function fetchPublicGame(slugOrId: string): Promise<{ id: string; title: string; html: string; creator: string; plays: number } | null> {
  try {
    const { data, error } = await supabase.from('games')
      .select('id,title,html,creator_name,plays,visibility')
      .or(`slug.eq.${slugOrId},id.eq.${slugOrId}`).limit(1).maybeSingle()
    if (error || !data || data.visibility !== 'public') return null
    return { id: data.id, title: data.title, html: data.html, creator: data.creator_name ?? 'a kid', plays: data.plays ?? 0 }
  } catch { return null }
}

export interface LeaderRow { id: string; name: string; photo: string | null; xp: number; level: number; games: number }
export async function getLeaderboard(top = 20): Promise<LeaderRow[] | null> {
  try {
    const { data, error } = await supabase.rpc('get_leaderboard', { top })
    if (error || !data) return null
    return (data as Record<string, unknown>[]).map(d => ({
      id: d.id as string, name: (d.display_name as string) ?? 'Creator', photo: (d.photo_url as string) ?? null,
      xp: (d.xp as number) ?? 0, level: (d.level as number) ?? 1, games: Number(d.games ?? 0),
    }))
  } catch { return null }
}

export async function fetchPublicGames(limit = 24): Promise<{ id: string; title: string; html: string; creator: string; plays: number; source: string; category: string }[] | null> {
  try {
    const { data, error } = await supabase.from('games').select('id,title,html,creator_name,plays,source,category').eq('visibility', 'public').order('plays', { ascending: false }).limit(limit)
    if (error) return null
    return (data ?? []).map(d => ({ id: d.id, title: d.title, html: d.html, creator: d.creator_name ?? 'a kid', plays: d.plays ?? 0, source: d.source ?? 'wizard', category: (d.category as string) ?? '' }))
  } catch { return null }
}

export async function bumpPlay(id: string): Promise<void> {
  try { await supabase.rpc('bump_play', { game_id: id }) } catch { /* ignore */ }
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
