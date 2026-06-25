import { supabase, cloudEnabled } from './supabase'

// The Nexus roster — befriended kin — lives ONLY in the cloud (person_creatures).
// Every mutation goes through a security-definer RPC so the server is the single
// authority: the client asks to befriend or care, it never sets the stats itself.
// Mirrors lib/rewards.ts. Degrades to empty/null when cloud isn't configured so
// dev never breaks.

export interface KinInstance {
  id: number
  owner_id: string
  kin_key: string                 // 'kin:countfox' — content-as-data ref
  world_key: string | null
  nickname: string | null
  count: number                   // how many of this kin type you've befriended
  happiness: number               // 0..100
  growth: 'baby' | 'teen' | 'adult'
  last_cared: string | null
  befriended_at: string
}

/** Snapshot of the town's diamond trickle, from the server (rate is never
 *  trusted from the client). `ratePerDay` = Σ(rarity rate × count × happiness).
 *  `pending` is the fractional amount banked so far; `minted` is the whole
 *  diamonds just paid out (0 on a peek). */
export interface HarvestState {
  ok: boolean
  ratePerDay: number
  pending: number
  minted: number
  balance: number
}

/** Persist an in-game Friendship-Window success. Best-effort: a failed write
 *  never blocks the celebration (the roster reloads when the Nexus opens). */
export async function befriendKin(kinKey: string, world?: string | null, nickname?: string): Promise<KinInstance | null> {
  if (!cloudEnabled) return null
  const { data, error } = await supabase.rpc('befriend_kin', {
    p_kin_key: kinKey, p_world: world ?? null, p_nickname: nickname ?? null,
  })
  if (error) { console.warn('[nexus] befriend failed:', error.message); return null }
  return data as KinInstance
}

/** This learner's town (default), or — for a guardian — one of their kids'. */
export async function nexusRoster(personId?: string): Promise<KinInstance[]> {
  if (!cloudEnabled) return []
  const { data, error } = await supabase.rpc('nexus_roster', { p_person: personId ?? null })
  if (error) { console.warn('[nexus] roster failed:', error.message); return [] }
  return (data as KinInstance[]) ?? []
}

/** Feed or pet a kin → happiness (server caps + cooldowns it). Returns the
 *  fresh row, or null on a no-op/failure. `cooled` means the gentle cooldown
 *  swallowed it — the UI can show a soft "already happy" hint. */
export async function careKin(id: number, action: 'feed' | 'pet'): Promise<{ kin: KinInstance | null; cooled: boolean }> {
  if (!cloudEnabled) return { kin: null, cooled: false }
  const { data, error } = await supabase.rpc('care_kin', { p_id: id, p_action: action })
  if (error) { console.warn('[nexus] care failed:', error.message); return { kin: null, cooled: false } }
  const r = data as { ok: boolean; cooled: boolean; kin: KinInstance }
  return { kin: r?.kin ?? null, cooled: !!r?.cooled }
}

/** Peek (collect=false) or collect (collect=true) the town's diamond trickle.
 *  Peeking computes the live pending without writing; collecting mints the whole
 *  diamonds into the cloud wallet and keeps the remainder. Server-authoritative —
 *  the client never decides the rate or the payout. */
export async function nexusHarvest(collect: boolean): Promise<HarvestState | null> {
  if (!cloudEnabled) return null
  const { data, error } = await supabase.rpc('nexus_harvest', { p_collect: collect })
  if (error) { console.warn('[nexus] harvest failed:', error.message); return null }
  return data as HarvestState
}
