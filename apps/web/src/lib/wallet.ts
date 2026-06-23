import { supabase, cloudEnabled } from './supabase'
import { useAppStore } from '@store/appStore'

// ============================================================
//  WALLET (client) — the diamond economy is SERVER-AUTHORITATIVE.
//  Every earn/spend goes through a security-definer RPC that writes the
//  immutable diamond_ledger and returns the new balance; we then snap the
//  store's cached `diamonds` to that authoritative number. The client never
//  decides a balance — it only reflects what the database says.
//
//  UI stays snappy via optimistic updates at the call sites; these helpers
//  reconcile to the truth a moment later (and self-correct on rejection).
// ============================================================

function signedIn(): boolean {
  const s = useAppStore.getState().session
  return cloudEnabled && s !== null && s !== 'loading'
}

async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  if (!signedIn()) return null
  const { data, error } = await supabase.rpc(fn, args)
  if (error) { console.warn(`[wallet] ${fn} →`, error.message); return null }
  return (data ?? null) as T | null
}

const applyBalance = (r: { balance?: number } | null) => {
  if (r && typeof r.balance === 'number') useAppStore.setState({ diamonds: r.balance })
  return r
}

/** Mint diamonds to the signed-in player (lesson/game reward). Server caps apply. */
export async function walletEarn(amount: number, kind = 'earn', reason: string | null = null) {
  return applyBalance(await rpc<{ ok: boolean; granted: number; balance: number }>('wallet_earn',
    { p_amount: Math.round(amount), p_kind: kind, p_reason: reason }))
}

/** Burn diamonds from the signed-in player (a purchase). Server checks balance. */
export async function walletSpend(amount: number, reason: string | null = null) {
  return applyBalance(await rpc<{ ok: boolean; balance: number }>('wallet_spend',
    { p_amount: Math.round(amount), p_reason: reason }))
}

/** Pull the authoritative balance and snap the store to it (truth wins). */
export async function refreshBalance() {
  const b = await rpc<number>('wallet_balance', {})
  if (typeof b === 'number') useAppStore.setState({ diamonds: b })
  return b
}
