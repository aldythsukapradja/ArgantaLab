// =========================================================
//  Cloud sync (best-effort, blob-mirror) — reuses ArgantaLab's
//  Supabase project. No-ops gracefully when Supabase isn't
//  configured or the user isn't signed in, so the app stays
//  fully usable offline / local-first.
// =========================================================
import { supabase, supabaseReady } from '@lib/supabase'
import type { KEvent, Moment } from '@data/seed'

export interface CloudState { events: KEvent[]; moments: Moment[] }

/** Pull the owner's mirrored state, or null if none / unavailable. */
export async function pullState(uid: string): Promise<CloudState | null> {
  if (!supabaseReady) return null
  try {
    const { data, error } = await supabase
      .from('kinetik_state')
      .select('events, moments')
      .eq('user_id', uid)
      .maybeSingle()
    if (error || !data) return null
    return { events: (data.events as KEvent[]) ?? [], moments: (data.moments as Moment[]) ?? [] }
  } catch { return null }
}

/** Mirror the local state up (debounced by the caller). */
export async function pushState(uid: string, state: CloudState): Promise<void> {
  if (!supabaseReady) return
  try {
    await supabase.from('kinetik_state').upsert({
      user_id: uid,
      events: state.events,
      moments: state.moments,
      updated_at: new Date().toISOString(),
    })
  } catch { /* best-effort */ }
}
