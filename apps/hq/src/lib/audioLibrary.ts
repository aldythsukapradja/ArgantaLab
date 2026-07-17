// Audio Media Library client (S1) — the single source of truth for Arganta
// audio (music · sfx · voice). Schema: supabase/migration_audio_media.sql.
// Save uploads bytes to the private audio-artifacts bucket + inserts an
// audio_asset row with the signed-in admin session (RLS: is_admin). Read is
// any authed user. Consumers: Video Studio, Post Studio, Cinema, game publish.
import { supabase, cloudEnabled } from './supabase'

export type AudioKind = 'music' | 'sfx' | 'voice' | 'anthem'

export interface AudioAsset {
  id: string
  name: string
  kind: AudioKind
  prompt?: string | null
  voice_id?: string | null
  duration_sec?: number | null
  mime: string
  bytes?: number | null
  provider?: string | null
  tags: string[]
  storage_path: string
  source_ref?: string | null
  created_at: string
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'audio'
const shortId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5)

export async function listAudioAssets(kind?: AudioKind): Promise<AudioAsset[]> {
  if (!cloudEnabled) return []
  try {
    const { data: sess } = await supabase.auth.getSession()
    if (!sess.session) return []
    let q = supabase.from('audio_asset').select('*').eq('status', 'ready').order('created_at', { ascending: false }).limit(500)
    if (kind) q = q.eq('kind', kind)
    const { data, error } = await q
    if (error) return []
    return (data ?? []) as AudioAsset[]
  } catch { return [] }
}

/** Save a recorded/rendered audio blob into the library. Returns the new id, or
 * throws with a reason (e.g. not admin, bucket missing). Best-effort at call
 * sites: keep the local download regardless. */
export async function saveAudioAsset(blob: Blob, meta: {
  name: string; kind: AudioKind; prompt?: string; voiceId?: string;
  durationSec?: number; tags?: string[]; provider?: string; sourceRef?: string
}): Promise<string> {
  if (!cloudEnabled) throw new Error('offline — audio library needs Supabase')
  const ext = blob.type.includes('mpeg') ? 'mp3' : blob.type.includes('flac') ? 'flac'
    : blob.type.includes('wav') ? 'wav' : 'webm'
  const id = `audio.${meta.kind}.${slug(meta.name)}-${shortId()}`
  const month = new Date().toISOString().slice(0, 7)
  const path = `${meta.kind}/${month}/${slug(meta.name)}-${id.split('-').pop()}.${ext}`

  const up = await supabase.storage.from('audio-artifacts').upload(path, blob, { contentType: blob.type || 'audio/webm', upsert: true })
  if (up.error) throw new Error(`upload failed (admin + migration_audio_media.sql?): ${up.error.message}`)

  const { error } = await supabase.from('audio_asset').insert({
    id, name: meta.name, kind: meta.kind, prompt: meta.prompt ?? null,
    voice_id: meta.voiceId ?? null, duration_sec: meta.durationSec ?? null,
    mime: blob.type || 'audio/webm', bytes: blob.size, provider: meta.provider ?? 'browser-record',
    tags: meta.tags ?? [], storage_path: path, source_ref: meta.sourceRef ?? null,
  })
  if (error) throw new Error(`audio_asset insert failed: ${error.message}`)
  return id
}

const signCache = new Map<string, string>()
export async function signedAudioUrl(path: string): Promise<string | null> {
  if (signCache.has(path)) return signCache.get(path)!
  try {
    const { data } = await supabase.storage.from('audio-artifacts').createSignedUrl(path, 3600)
    if (data?.signedUrl) { signCache.set(path, data.signedUrl); return data.signedUrl }
  } catch { /* fall through */ }
  return null
}
