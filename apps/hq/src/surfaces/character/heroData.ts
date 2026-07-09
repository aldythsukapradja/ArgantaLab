import { supabase, cloudEnabled } from '../../lib/supabase'

// Character data for the Forge. HQ reads + writes the SAME canonical character the
// games use (kingdom_characters / kingdom_character_appearance), so editing here is
// the single source of truth — LashiraBloom + Kingdom Heroes read it back via
// kingdom_get_player_state(). These are the exact RPCs Kingdom's own Character Lab
// calls; HQ just drives them from the operator's session.

export interface HeroState {
  profile: any
  character: any
  spec: any | null      // the compositor loadout (synced > draft > legacy)
  synced: boolean
}

export async function loadOperatorCharacter(): Promise<HeroState | null> {
  if (!cloudEnabled) return null
  try {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user) return null
    const { data, error } = await supabase.rpc('kingdom_get_player_state')
    if (error || !data) return null
    const loadout = data.loadout || {}
    const spec = loadout.syncedSpec || loadout.draftSpec || data.character?.spec || null
    return { profile: data.profile || null, character: data.character || null, spec, synced: !!loadout.syncedSpec }
  } catch (e) {
    console.warn('[forge] player-state unavailable:', (e as any)?.message || e)
    return null
  }
}

// Save the composed spec as the player's character. Writes the draft, then syncs
// it to the live build both games render. Returns a short status the UI can show.
export async function saveOperatorCharacter(spec: any): Promise<{ ok: boolean; message: string }> {
  if (!cloudEnabled) return { ok: false, message: 'Offline — sign in to save.' }
  try {
    const { error: e1 } = await supabase.rpc('kingdom_save_character_draft', { p_spec: spec })
    if (e1) return { ok: false, message: e1.message }
    const { error: e2 } = await supabase.rpc('kingdom_sync_character_build')
    // Some deployments haven't run the sync RPC migration; the draft still saved.
    if (e2) return { ok: true, message: 'Draft saved (sync RPC not deployed — games read the draft).' }
    return { ok: true, message: 'Saved & synced — the games read this now.' }
  } catch (e) {
    return { ok: false, message: (e as any)?.message || 'Save failed.' }
  }
}
