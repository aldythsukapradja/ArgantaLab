// momentPublish — HQ → KinetikCircle "Remember" feed. HQ and Kinetik share the
// same Supabase project, so a post/video designed here can become a real Moment:
// upload rendered media to the private `moments` bucket, then call the
// security-definer `kinetik_post_moment` RPC (exactly what the Kinetik app calls
// in apps/kinetik/src/repo/momentsRepo.ts).
//
// PREREQUISITE: the signed-in operator must be a MEMBER of the target circle —
// the RPC enforces circle membership. Offline / not-a-member → the RPC errors
// and we surface it honestly (never a fake success).
//
// Generic on purpose: takes already-rendered blobs so both the Content Builder
// (carousel PNGs) and the Video Builder (MP4 / poster PNG) reuse it (S4).

import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'moments'

export interface PublishCircle { id: string; name: string; accent?: string | null }
export interface MomentMedia { blob: Blob; kind: 'photo' | 'video'; ext?: string }
export interface PublishMomentInput {
  circleId: string
  media: MomentMedia[]
  body?: string
  // kinetik_post_moment's p_tags is uuid[] — these are MEMBER IDs to tag people
  // in the post, NOT hashtag strings (hashtags belong in the body). Passing a
  // non-uuid here makes the whole RPC throw "invalid input syntax for type uuid"
  // and silently create nothing, so we hard-filter to uuid-shaped values below.
  memberTags?: string[]
  audience?: string          // default 'circle'
  kind?: string              // moment kind, default 'photo' (or 'video')
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Circles the operator could post into. RLS on `circles` already limits this to
 * what they can see; the RPC further requires membership at publish time. */
export async function listPublishableCircles(supabase: SupabaseClient): Promise<PublishCircle[]> {
  const { data, error } = await supabase.from('circles').select('id, name, accent').order('name')
  if (error || !data) return []
  return data as PublishCircle[]
}

const extFor = (m: MomentMedia) => m.ext || (m.kind === 'video' ? 'mp4' : 'png')

/**
 * Publish rendered media as a Moment. Returns the new post id.
 * Throws on any failure (upload rejected, not a member, RPC error) so the caller
 * shows the real reason — this is a real cross-app write, never faked.
 */
export async function publishMoment(supabase: SupabaseClient, input: PublishMomentInput): Promise<string> {
  if (!input.circleId) throw new Error('Pick a circle first.')
  if (!input.media.length) throw new Error('Nothing to publish — no rendered media.')

  const folder = (crypto as any).randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  const mediaJson: { kind: string; path: string }[] = []
  for (let i = 0; i < input.media.length; i++) {
    const m = input.media[i]
    const path = `${input.circleId}/${folder}/${i}.${extFor(m)}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, m.blob, {
      contentType: m.blob.type || (m.kind === 'video' ? 'video/mp4' : 'image/png'),
      upsert: false,
    })
    if (error) throw new Error(`Upload failed (${m.kind} ${i + 1}): ${error.message}`)
    mediaJson.push({ kind: m.kind, path })
  }

  // Moments from HQ are attributed to the "Kinetik Circle" brand, not the
  // signed-in operator — this is the single automated social channel, so every
  // post reads as the brand. Falls back to the operator-authored RPC when the
  // brand migration (migration_kinetik_circle_brand.sql) hasn't been run yet, so
  // publishing still works pre-migration (just under the operator's name).
  const args = {
    p_circle: input.circleId,
    p_kind: input.kind || (input.media[0]?.kind === 'video' ? 'video' : 'photo'),
    p_body: input.body || null,
    p_audience: input.audience || 'circle',
    p_audience_ids: [],
    p_media: mediaJson,
    p_tags: (input.memberTags || []).filter(t => UUID_RE.test(t)),
    p_is_story: false,
  }

  let { data, error } = await supabase.rpc('kinetik_post_moment_as_brand', args)
  // 404 / PGRST202 / "function does not exist" → brand RPC not deployed yet.
  if (error && /not exist|could not find|PGRST202|schema cache|404/i.test(`${error.message} ${(error as any).code ?? ''}`)) {
    ;({ data, error } = await supabase.rpc('kinetik_post_moment', args))
  }
  if (error) {
    // The most common real cause: operator isn't a member of this circle.
    throw new Error(/permission|member|rls|denied/i.test(error.message)
      ? 'Publish blocked — sign in as a member of this circle to post moments.'
      : error.message)
  }
  return data as string
}
