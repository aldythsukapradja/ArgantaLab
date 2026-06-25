// =========================================================
//  MOMENTS ("Remember") data layer. Reads go through the
//  kinetik_* security-definer RPCs (so authors/reactors resolve
//  past per-row profile RLS); media lives in the private `moments`
//  Storage bucket and is shown via short-lived signed URLs.
//  Everything is real — no mock data.
// =========================================================
import { supabase } from '@lib/supabase'

const BUCKET = 'moments'
const SIGN_TTL = 60 * 60 // 1h signed URLs

export interface MAuthor { id: string; name: string; photo: string | null; role: string }
export interface MMedia { kind: 'photo' | 'video'; path: string; url?: string; w?: number; h?: number; duration?: number }
export interface MPost {
  id: string; kind: string; body: string | null; audience: string; createdAt: string
  rewardTotal: number; reactionCount: number; commentCount: number
  author: MAuthor; media: MMedia[]; tags: string[]
  reactions: Record<string, number>; myReaction: string | null
  reactors: { name: string; photo: string | null }[]
}
export interface MStoryItem { id: string; body: string | null; createdAt: string; media: { kind: string; path: string; url?: string }[] }
export interface MStoryGroup { author: MAuthor; last: string; seen: boolean; items: MStoryItem[] }
export interface MAlbum { id: string; title: string; coverPath: string | null; coverUrl?: string; count: number; createdAt: string }
export interface MMilestone {
  id: string; title: string; body: string | null; kind: string; ref: string | null
  diamonds: number; mediaPath: string | null; mediaUrl?: string; createdAt: string
  kid: { id: string; name: string; photo: string | null } | null
  author: { id: string; name: string } | null
}
export interface MComment { id: string; body: string; parentId: string | null; createdAt: string; author: { id: string; name: string; photo: string | null } }

// ── signed-URL helpers ──
async function signMany(paths: string[]): Promise<Record<string, string>> {
  const uniq = Array.from(new Set(paths.filter(Boolean)))
  if (!uniq.length) return {}
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(uniq, SIGN_TTL)
  if (error || !data) return {}
  const out: Record<string, string> = {}
  for (const d of data) if (d.path && d.signedUrl) out[d.path] = d.signedUrl
  return out
}

function mapAuthor(a: any): MAuthor { return { id: a?.id, name: a?.name || 'Member', photo: a?.photo ?? null, role: a?.role || '' } }
function mapPost(r: any, urls: Record<string, string>): MPost {
  return {
    id: r.id, kind: r.kind, body: r.body ?? null, audience: r.audience, createdAt: r.created_at,
    rewardTotal: r.reward_total ?? 0, reactionCount: r.reaction_count ?? 0, commentCount: r.comment_count ?? 0,
    author: mapAuthor(r.author),
    media: (r.media ?? []).map((m: any) => ({ kind: m.kind, path: m.path, url: urls[m.path], w: m.w, h: m.h, duration: m.duration })),
    tags: r.tags ?? [], reactions: r.reactions ?? {}, myReaction: r.my_reaction ?? null,
    reactors: (r.reactors ?? []).map((x: any) => ({ name: x.name, photo: x.photo ?? null })),
  }
}

// ── reads ──
/** Count of real moments (kinetik_post, excluding ephemeral stories) in a circle. */
export async function fetchMomentCount(circleId: string): Promise<number> {
  const { count, error } = await supabase
    .from('kinetik_post')
    .select('id', { count: 'exact', head: true })
    .eq('circle_id', circleId)
    .neq('kind', 'story')
  if (error) return 0
  return count ?? 0
}

export async function fetchFeed(circleId: string, kind: string | null = null, before?: string): Promise<MPost[]> {
  const { data, error } = await supabase.rpc('kinetik_feed', { p_circle: circleId, p_kind: kind, p_before: before ?? null })
  if (error) throw error
  const rows = (data ?? []) as any[]
  const urls = await signMany(rows.flatMap(r => (r.media ?? []).map((m: any) => m.path)))
  return rows.map(r => mapPost(r, urls))
}

export async function fetchStories(circleId: string): Promise<MStoryGroup[]> {
  const { data, error } = await supabase.rpc('kinetik_stories', { p_circle: circleId })
  if (error) throw error
  const groups = (data ?? []) as any[]
  const urls = await signMany(groups.flatMap(g => (g.items ?? []).flatMap((i: any) => (i.media ?? []).map((m: any) => m.path))))
  return groups.map(g => ({
    author: mapAuthor(g.author), last: g.last, seen: !!g.seen,
    items: (g.items ?? []).map((i: any) => ({ id: i.id, body: i.body ?? null, createdAt: i.created_at, media: (i.media ?? []).map((m: any) => ({ kind: m.kind, path: m.path, url: urls[m.path] })) })),
  }))
}

export async function fetchAlbums(circleId: string): Promise<MAlbum[]> {
  const { data, error } = await supabase.rpc('kinetik_albums', { p_circle: circleId })
  if (error) throw error
  const rows = (data ?? []) as any[]
  const urls = await signMany(rows.map(r => r.cover_path).filter(Boolean))
  return rows.map(r => ({ id: r.id, title: r.title, coverPath: r.cover_path ?? null, coverUrl: r.cover_path ? urls[r.cover_path] : undefined, count: r.count ?? 0, createdAt: r.created_at }))
}

export async function fetchMilestones(circleId: string): Promise<MMilestone[]> {
  const { data, error } = await supabase.rpc('kinetik_milestones', { p_circle: circleId })
  if (error) throw error
  const rows = (data ?? []) as any[]
  const urls = await signMany(rows.map(r => r.media_path).filter(Boolean))
  return rows.map(r => ({
    id: r.id, title: r.title, body: r.body ?? null, kind: r.kind, ref: r.ref ?? null,
    diamonds: r.diamonds ?? 0, mediaPath: r.media_path ?? null, mediaUrl: r.media_path ? urls[r.media_path] : undefined,
    createdAt: r.created_at, kid: r.kid ?? null, author: r.author ?? null,
  }))
}

export async function fetchAlbumPosts(albumId: string): Promise<MPost[]> {
  const { data, error } = await supabase.rpc('kinetik_album_posts', { p_album: albumId })
  if (error) throw error
  const rows = (data ?? []) as any[]
  const urls = await signMany(rows.flatMap(r => (r.media ?? []).map((m: any) => m.path)))
  return rows.map(r => mapPost(r, urls))
}

export async function fetchComments(postId: string): Promise<MComment[]> {
  const { data, error } = await supabase.rpc('kinetik_comments', { p_post: postId })
  if (error) throw error
  return ((data ?? []) as any[]).map(c => ({ id: c.id, body: c.body, parentId: c.parent_id ?? null, createdAt: c.created_at, author: { id: c.author?.id, name: c.author?.name || 'Member', photo: c.author?.photo ?? null } }))
}

// ── writes ──
export interface NewMedia { file: File; kind: 'photo' | 'video' }
export async function postMoment(opts: {
  circleId: string; kind: string; body: string; audience: string; audienceIds?: string[]
  media?: NewMedia[]; tags?: string[]; isStory?: boolean
}): Promise<string> {
  const folder = (crypto as any).randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  const mediaJson: { kind: string; path: string }[] = []
  for (let i = 0; i < (opts.media?.length ?? 0); i++) {
    const m = opts.media![i]
    const ext = m.file.name.split('.').pop() || (m.kind === 'video' ? 'mp4' : 'jpg')
    const path = `${opts.circleId}/${folder}/${i}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, m.file, { contentType: m.file.type, upsert: false })
    if (error) throw error
    mediaJson.push({ kind: m.kind, path })
  }
  const { data, error } = await supabase.rpc('kinetik_post_moment', {
    p_circle: opts.circleId, p_kind: opts.kind, p_body: opts.body || null,
    p_audience: opts.audience, p_audience_ids: opts.audienceIds ?? [],
    p_media: mediaJson, p_tags: opts.tags ?? [], p_is_story: !!opts.isStory,
  })
  if (error) throw error
  return data as string
}

export async function toggleReaction(postId: string, emoji: string | null): Promise<void> {
  const { error } = await supabase.rpc('kinetik_toggle_reaction', { p_post: postId, p_emoji: emoji })
  if (error) throw error
}
export async function addComment(postId: string, body: string, parentId?: string): Promise<string> {
  const { data, error } = await supabase.rpc('kinetik_add_comment', { p_post: postId, p_body: body, p_parent: parentId ?? null })
  if (error) throw error
  return data as string
}
export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from('kinetik_comment').delete().eq('id', id)
  if (error) throw error
}
export async function rewardMoment(postId: string, amount: number): Promise<number> {
  const { data, error } = await supabase.rpc('kinetik_reward_moment', { p_post: postId, p_amount: amount })
  if (error) throw error
  return data as number
}
export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase.from('kinetik_post').delete().eq('id', postId)
  if (error) throw error
}
export async function updatePost(postId: string, patch: { body?: string; createdAt?: string }): Promise<void> {
  const { error } = await supabase.rpc('kinetik_update_post', { p_post: postId, p_body: patch.body ?? null, p_created_at: patch.createdAt ?? null })
  if (error) throw error
}
export async function createAlbum(circleId: string, title: string, postIds: string[] = []): Promise<string> {
  const { data, error } = await supabase.rpc('kinetik_create_album', { p_circle: circleId, p_title: title, p_post_ids: postIds })
  if (error) throw error
  return data as string
}
export async function addToAlbum(albumId: string, postId: string): Promise<void> {
  const { error } = await supabase.rpc('kinetik_add_to_album', { p_album: albumId, p_post: postId })
  if (error) throw error
}
export async function setAlbumCover(albumId: string, coverPath: string): Promise<void> {
  const { error } = await supabase.from('kinetik_album').update({ cover_path: coverPath }).eq('id', albumId)
  if (error) throw error
}
export async function updateMilestone(id: string, patch: { title?: string; body?: string; kidId?: string; createdAt?: string }): Promise<void> {
  const { error } = await supabase.rpc('kinetik_update_milestone', { p_id: id, p_title: patch.title ?? null, p_body: patch.body ?? null, p_kid: patch.kidId ?? null, p_created_at: patch.createdAt ?? null })
  if (error) throw error
}
export async function deleteMilestone(id: string): Promise<void> {
  const { error } = await supabase.from('kinetik_milestone').delete().eq('id', id)
  if (error) throw error
}
export async function addMilestone(circleId: string, title: string, body?: string, kidId?: string): Promise<string> {
  const { data, error } = await supabase.rpc('kinetik_add_milestone', { p_circle: circleId, p_title: title, p_body: body ?? null, p_kid: kidId ?? null, p_media_path: null })
  if (error) throw error
  return data as string
}
export async function markStoryViewed(postId: string): Promise<void> {
  try { await supabase.rpc('kinetik_mark_story_viewed', { p_post: postId }) } catch { /* best-effort */ }
}
