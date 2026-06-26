// =========================================================
//  BROADCAST ("Discover") data layer. Platform-authored posts
//  by KinetikCircle that keep the feed alive between real family
//  moments. One global row reaches every circle; reactions/views
//  are tracked centrally. Read via the kinetik_broadcast_* RPCs.
// =========================================================
import { supabase } from '@lib/supabase'

export interface BcastPost {
  id: string
  format: string
  theme: string
  title: string
  body: string | null
  mediaKind: 'none' | 'image' | 'video'
  mediaUrl: string | null
  source: string | null
  emoji: string | null
  accent: string | null
  publishedAt: string
  reactionCount: number
  viewCount: number
  reactions: Record<string, number>
  myReaction: string | null
}

function map(r: any): BcastPost {
  return {
    id: r.id, format: r.format, theme: r.theme, title: r.title, body: r.body ?? null,
    mediaKind: (r.media_kind as BcastPost['mediaKind']) || 'none', mediaUrl: r.media_url ?? null,
    source: r.source ?? null, emoji: r.emoji ?? null, accent: r.accent ?? null,
    publishedAt: r.published_at, reactionCount: r.reaction_count ?? 0, viewCount: r.view_count ?? 0,
    reactions: r.reactions ?? {}, myReaction: r.my_reaction ?? null,
  }
}

export async function fetchBroadcasts(limit = 12): Promise<BcastPost[]> {
  const { data, error } = await supabase.rpc('kinetik_broadcast_feed', { p_limit: limit, p_before: null })
  if (error) throw error
  return ((data ?? []) as any[]).map(map)
}

export async function reactBroadcast(id: string, emoji: string | null): Promise<void> {
  const { error } = await supabase.rpc('kinetik_broadcast_react', { p_broadcast: id, p_emoji: emoji })
  if (error) throw error
}

export async function seenBroadcast(id: string): Promise<void> {
  try { await supabase.rpc('kinetik_broadcast_seen', { p_broadcast: id }) } catch { /* best-effort */ }
}
