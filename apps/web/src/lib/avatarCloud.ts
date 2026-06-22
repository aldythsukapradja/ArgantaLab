import { supabase, cloudEnabled } from './supabase'

// Cross-device sync for the avatar wardrobe (equipped outfit + owned cosmetics).
// One row per user in `avatar_state`. Degrades silently when offline / cloud off.

export async function pushAvatarState(uid: string, outfit: Record<string, string>, owned: string[]): Promise<void> {
  if (!cloudEnabled) return
  try {
    await supabase.from('avatar_state').upsert({
      user_id: uid, outfit, owned, updated_at: new Date().toISOString(),
    })
  } catch { /* offline / table missing — ignore */ }
}

export interface AvatarState { outfit?: Record<string, string>; owned?: string[] }

/** Pull the cloud wardrobe on login. Returns null on first login / no row. */
export async function pullAvatarState(uid: string): Promise<AvatarState | null> {
  if (!cloudEnabled) return null
  try {
    const { data, error } = await supabase.from('avatar_state').select('outfit,owned').eq('user_id', uid).maybeSingle()
    if (error || !data) return null
    return { outfit: (data.outfit as Record<string, string>) ?? undefined, owned: (data.owned as string[]) ?? undefined }
  } catch { return null }
}
