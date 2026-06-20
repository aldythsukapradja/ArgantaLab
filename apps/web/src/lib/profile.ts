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
}

// Local progress snapshot taken from the store before a login merge.
export interface LocalProgress {
  learnerName: string
  xp: number
  level: number
  diamonds: number
  completedLessons: string[]
  badges: string[]
  gamesPlayed: string[]
  unlocks: string[]
}

const uniq = (a: string[], b: string[]) => Array.from(new Set([...a, ...b]))

/**
 * Sync the user's profile on login:
 *  - reads the cloud row (auto-created by the signup trigger),
 *  - merges any guest progress made before signing in,
 *  - writes the merged result back, and returns it for the store to hydrate.
 * Returns null if the backend isn't ready (table missing) so the app can
 * keep running on localStorage alone.
 */
export async function syncProfileOnLogin(session: Session, local: LocalProgress): Promise<CloudProfile | null> {
  const user = session.user
  const meta = user.user_metadata ?? {}
  const googleName = (meta.full_name as string) || (meta.name as string) || local.learnerName
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

  const merged: CloudProfile = {
    display_name: (row?.display_name as string) || googleName,
    photo_url: photo ?? (row?.photo_url as string) ?? null,
    xp: Math.max(local.xp, (row?.xp as number) ?? 0),
    level: Math.max(local.level, (row?.level as number) ?? 1),
    diamonds: Math.max(local.diamonds, (row?.diamonds as number) ?? 0),
    completed_lessons: uniq((row?.completed_lessons as string[]) ?? [], local.completedLessons),
    badges: uniq((row?.badges as string[]) ?? [], local.badges),
    games_played: uniq((row?.games_played as string[]) ?? [], local.gamesPlayed),
    unlocks: uniq((row?.unlocks as string[]) ?? [], local.unlocks),
    role: (row?.role as string) ?? 'user',
  }

  try {
    await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      display_name: merged.display_name,
      photo_url: merged.photo_url,
      xp: merged.xp,
      level: merged.level,
      diamonds: merged.diamonds,
      completed_lessons: merged.completed_lessons,
      badges: merged.badges,
      games_played: merged.games_played,
      unlocks: merged.unlocks,
    })
  } catch { /* non-fatal — we still hydrate from the merged value */ }

  return merged
}

/** Push a progress patch for the signed-in user. Silently no-ops on failure. */
export async function saveProfile(userId: string, patch: Record<string, unknown>): Promise<void> {
  try {
    await supabase.from('profiles').update(patch).eq('id', userId)
  } catch { /* offline / table missing — ignore */ }
}
