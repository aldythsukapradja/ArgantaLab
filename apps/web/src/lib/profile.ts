import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Shape we hydrate the store with.
export interface CloudProfile {
  display_name: string
  photo_url: string | null
  xp: number
  level: number
  diamonds: number
  completed_lessons: string[]
  badges: string[]
  games_played: string[]
  unlocks: string[]
  role: string
  dob: string | null
}

/**
 * Sync the signed-in user's profile on login. The cloud row (auto-created by
 * the signup trigger) is the SINGLE SOURCE OF TRUTH — we read it verbatim and
 * hydrate the store from it. We deliberately do NOT merge any leftover store
 * values: those may belong to a *different* player (e.g. the parent we just
 * switched away from), and merging them up is exactly what used to leak the
 * parent's 50k diamonds onto a kid. Returns null if the backend isn't ready.
 */
export async function syncProfileOnLogin(session: Session): Promise<CloudProfile | null> {
  const user = session.user
  const meta = user.user_metadata ?? {}
  const fallbackName = (meta.display_name as string) || (meta.full_name as string) || (meta.name as string) || (user.email?.split('@')[0] ?? 'Player')
  const photo = (meta.avatar_url as string) || (meta.picture as string) || null

  let row: Record<string, unknown> | null = null
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    if (error) {
      // 42P01 = undefined_table → backend not set up yet; degrade gracefully.
      if (error.code === '42P01' || /relation .* does not exist/i.test(error.message)) return null
      // Any other error: also degrade rather than break the app.
      return null
    }
    row = data
  } catch {
    return null
  }

  const profile: CloudProfile = {
    display_name: (row?.display_name as string) || fallbackName,
    photo_url: (row?.photo_url as string) ?? photo,
    xp: (row?.xp as number) ?? 0,
    level: (row?.level as number) ?? 1,
    diamonds: (row?.diamonds as number) ?? 0,
    completed_lessons: (row?.completed_lessons as string[]) ?? [],
    badges: (row?.badges as string[]) ?? [],
    games_played: (row?.games_played as string[]) ?? [],
    unlocks: (row?.unlocks as string[]) ?? [],
    role: (row?.role as string) ?? 'user',
    dob: (row?.dob as string) ?? (row?.birthday as string) ?? null,
  }

  // Only backfill identity fields that the cloud row is missing (e.g. a brand-new
  // Google parent whose display_name/photo haven't been written yet). Never touch
  // xp/diamonds/progress here — the row owns those.
  if (!row?.display_name || (!row?.photo_url && photo)) {
    try {
      await supabase.from('profiles').update({
        display_name: profile.display_name,
        photo_url: profile.photo_url,
      }).eq('id', user.id)
    } catch { /* non-fatal */ }
  }

  return profile
}

/** Push a progress patch for the signed-in user. Silently no-ops on failure. */
export async function saveProfile(userId: string, patch: Record<string, unknown>): Promise<void> {
  try {
    await supabase.from('profiles').update(patch).eq('id', userId)
  } catch { /* offline / table missing — ignore */ }
}
