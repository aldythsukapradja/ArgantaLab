// ============================================================
//  PLAYER NAMESPACE  — namespaces the local LEARN CACHE by account
//  Identity, wallet, and progress are owned by the cloud (each player is
//  their own Supabase session). This only scopes the session-level learn
//  cache (rings/mastery in memStore) to the signed-in account's id so two
//  accounts on one device never share cached state. No wallet, no PINs,
//  no identity is persisted here.
// ============================================================

const PKEY = 'argantalab_player_v1'

let _id = 'owner'
try { _id = localStorage.getItem(PKEY) || 'owner' } catch { /* ignore */ }

export function getPlayerId(): string { return _id }

export function setPlayerId(id: string) {
  _id = id || 'owner'
  try { localStorage.setItem(PKEY, _id) } catch { /* ignore */ }
}

/** Namespace a cache base key by the active account.
 *  The owner keeps the original (un-suffixed) key for back-compat. */
export function pkey(base: string): string {
  return _id === 'owner' ? base : `${base}__${_id}`
}
