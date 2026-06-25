import { supabase, cloudEnabled } from './supabase'
import { useAppStore } from '@store/appStore'

// ============================================================
//  MOUNTS (client) — server-authoritative, mirrors lib/wallet.ts.
//  Ownership + equip live in the cloud (person_mounts / profiles.equipped_mount)
//  and every mutation is a security-definer RPC: the client asks to buy/equip,
//  the server checks the price + balance and decides. We snap the cached diamond
//  balance to whatever the server returns. Degrades to empty/no-op offline.
// ============================================================

export interface MountState { owned: string[]; equipped: string | null }

/** This learner's mounts (default), or — for a guardian — one of their kids'. */
export async function myMounts(personId?: string): Promise<MountState> {
  if (!cloudEnabled) return { owned: [], equipped: null }
  const { data, error } = await supabase.rpc('my_mounts', { p_person: personId ?? null })
  if (error) { console.warn('[mounts] load failed:', error.message); return { owned: [], equipped: null } }
  const r = data as { owned?: string[]; equipped?: string | null }
  return { owned: r?.owned ?? [], equipped: r?.equipped ?? null }
}

/** Buy a mount (server reads the price + burns diamonds atomically). Snaps the
 *  cached balance to the server truth. Returns ok + an error code on rejection. */
export async function buyMount(mountKey: string): Promise<{ ok: boolean; error?: string }> {
  if (!cloudEnabled) return { ok: false, error: 'offline' }
  const { data, error } = await supabase.rpc('buy_mount', { p_mount_key: mountKey })
  if (error) { console.warn('[mounts] buy failed:', error.message); return { ok: false, error: error.message } }
  const r = data as { ok: boolean; error?: string; balance?: number }
  if (typeof r?.balance === 'number') useAppStore.setState({ diamonds: r.balance })
  return { ok: !!r?.ok, error: r?.error }
}

/** Equip an owned mount (or null to ride on foot). */
export async function equipMount(mountKey: string | null): Promise<boolean> {
  if (!cloudEnabled) return false
  const { data, error } = await supabase.rpc('equip_mount', { p_mount_key: mountKey })
  if (error) { console.warn('[mounts] equip failed:', error.message); return false }
  return !!(data as { ok?: boolean })?.ok
}
