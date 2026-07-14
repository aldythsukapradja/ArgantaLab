// Cinema persistence seam. Default is the offline zustand-persist store
// (localStorage). These functions sync the same shape to Supabase once the
// migration (supabase/cinema/01_cinema.sql) is run and the founder is signed in.
// All calls no-op safely when cloud is disabled, so the UI never breaks offline.
import { supabase, cloudEnabled } from '../lib/supabase'
import type { SceneEdit, CinemaVersion } from './store'

const BUCKET = 'cinema-audio'

async function uid(): Promise<string | null> {
  if (!cloudEnabled) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

export interface CloudScenario {
  overrides: Record<string, SceneEdit>
  versions: CinemaVersion[]
}

/** Pull the founder's saved scenario (edits + versions) from Supabase. */
export async function pullScenario(): Promise<CloudScenario | null> {
  const user = await uid(); if (!user) return null
  const [{ data: edits }, { data: vers }] = await Promise.all([
    supabase.from('cinema_scene_edits').select('*').eq('user_id', user),
    supabase.from('cinema_versions').select('*').eq('user_id', user).order('created_at', { ascending: false }),
  ])
  const overrides: Record<string, SceneEdit> = {}
  for (const r of edits ?? []) {
    const e: SceneEdit = {}
    if (r.idea) e.idea = r.idea
    if (r.title) e.title = r.title
    if (r.voice) e.voice = r.voice
    if (r.narration) e.narration = r.narration
    if (r.audio_path) { e.audioSrc = publicAudioUrl(r.audio_path); e.audioName = r.audio_name ?? undefined }
    overrides[r.scene_id] = e
  }
  const versions: CinemaVersion[] = (vers ?? []).map(v => ({ id: v.id, label: v.label, ts: new Date(v.created_at).getTime(), overrides: v.snapshot }))
  return { overrides, versions }
}

/** Upsert one scene's edit. Call on edit (debounced by the caller). */
export async function pushSceneEdit(sceneId: string, edit: SceneEdit): Promise<void> {
  const user = await uid(); if (!user) return
  await supabase.from('cinema_scene_edits').upsert({
    user_id: user, scene_id: sceneId,
    idea: edit.idea ?? null, title: edit.title ?? null, voice: edit.voice ?? null,
    narration: edit.narration ?? null, audio_name: edit.audioName ?? null,
    updated_at: new Date().toISOString(),
  })
}

export async function deleteSceneEdit(sceneId: string): Promise<void> {
  const user = await uid(); if (!user) return
  await supabase.from('cinema_scene_edits').delete().eq('user_id', user).eq('scene_id', sceneId)
}

/** Upload a replacement clip to the private bucket; returns its object path. */
export async function uploadAudio(sceneId: string, file: Blob, ext = 'mp3'): Promise<string | null> {
  const user = await uid(); if (!user) return null
  const path = `${user}/${sceneId}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: (file as File).type || 'audio/mpeg' })
  if (error) return null
  await supabase.from('cinema_scene_edits').update({ audio_path: path }).eq('user_id', user).eq('scene_id', sceneId)
  return path
}

export function publicAudioUrl(path: string): string {
  // private bucket → signed access is created on demand; for read we use a signed URL elsewhere.
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/** Save a version snapshot to the cloud. */
export async function pushVersion(v: CinemaVersion): Promise<void> {
  const user = await uid(); if (!user) return
  await supabase.from('cinema_versions').insert({ id: v.id, user_id: user, label: v.label, snapshot: v.overrides, created_at: new Date(v.ts).toISOString() })
}

export const cloudReady = cloudEnabled
