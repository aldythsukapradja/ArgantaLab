import { supabase, cloudEnabled } from './supabase'

// Diamond reward system. profiles.diamonds is the cached balance; diamond_ledger
// is the immutable history. All mutations go through security-definer RPCs so the
// guardrails (guardian-only, no overspend, no negative) live in the database.

export interface RewardRow { amount: number; reason: string | null; kind: string; at: string }

/** A grown-up's own diamond balance (their reward budget). */
export async function getMyDiamonds(): Promise<number> {
  if (!cloudEnabled) return 0
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return 0
  const { data } = await supabase.from('profiles').select('diamonds').eq('id', u.user.id).maybeSingle()
  return data?.diamonds ?? 0
}

/** Idempotent: gives a grown-up their 50,000 starter pack once. Returns balance. */
export async function ensureStarterPack(): Promise<number> {
  if (!cloudEnabled) return 0
  const { data, error } = await supabase.rpc('grant_starter_pack')
  if (error) return getMyDiamonds()
  return (data as number) ?? 0
}

/** Parent gives diamonds to one of their kids. Throws a friendly message on failure. */
export async function grantDiamonds(kidId: string, amount: number, reason: string) {
  const { data, error } = await supabase.rpc('grant_diamonds', {
    p_to: kidId, p_amount: amount, p_reason: reason || null,
  })
  if (error) {
    const m = error.message || ''
    if (m.includes('insufficient')) throw new Error("You don't have enough diamonds for that.")
    if (m.includes('not your child')) throw new Error('You can only reward your own children.')
    if (m.includes('positive')) throw new Error('Pick an amount above zero.')
    throw new Error('Could not send diamonds. Try again.')
  }
  return data as { ok: boolean; fromBalance: number; toBalance: number }
}

/** Give (delta>0, from your budget) or take (delta<0, clamped at 0) a kid's diamonds. */
export async function adjustKidDiamonds(kidId: string, delta: number, reason: string) {
  const { data, error } = await supabase.rpc('adjust_kid_diamonds', { p_kid: kidId, p_delta: delta, p_reason: reason || null })
  if (error) {
    const m = error.message || ''
    if (m.includes('insufficient')) throw new Error("You don't have enough diamonds for that.")
    if (m.includes('not your child')) throw new Error('You can only reward your own children.')
    if (m.includes('non-zero')) throw new Error('Pick an amount above zero.')
    throw new Error('Could not update diamonds. Try again.')
  }
  return data as { ok: boolean; kidBalance: number; fromBalance: number }
}

/** Recent rewards this grown-up has SENT (for the history feed). */
export async function recentRewardsSent(limit = 10): Promise<(RewardRow & { to: string })[]> {
  if (!cloudEnabled) return []
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return []
  const { data } = await supabase
    .from('diamond_ledger')
    .select('amount, reason, kind, created_at, to_user')
    .eq('from_user', u.user.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []).map(r => ({ amount: r.amount, reason: r.reason, kind: r.kind, at: r.created_at, to: r.to_user }))
}
