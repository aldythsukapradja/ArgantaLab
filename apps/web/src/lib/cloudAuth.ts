// ============================================================
//  CLOUD AUTH  (Step 2)  — real Supabase accounts for kids & adults
//  Kids have no email, so we use SYNTHETIC-EMAIL auth: a kid named
//  "baginda" becomes the auth user baginda@kids.argantalab.app with
//  the PIN (padded to meet length rules) as the password. The kid is
//  then a genuine auth.user, so every per-user RLS policy works and
//  the grow-up-to-Gmail path is a simple email change later.
//  All calls no-op safely when `cloudEnabled` is false.
// ============================================================
import { supabase, cloudEnabled } from './supabase'
import type { Gender } from './circles'

const KID_DOMAIN = 'kids.argantalab.app'

export const synthEmail = (username: string) =>
  `${username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '')}@${KID_DOMAIN}`

// PINs are 4 digits; Supabase requires 6+ char passwords, so pad with a fixed
// salt. The kid only ever types the PIN — this transform is internal.
const pinToPassword = (pin: string) => `${pin}#aLab`

export interface CloudProfile {
  id: string
  display_name: string
  role: string
  photo_url?: string | null
  friend_code?: string | null
  dob?: string | null
  gender?: string | null
  xp?: number
  level?: number
  last_seen?: string | null
}

export interface CloudResult<T = unknown> { ok: boolean; data?: T; error?: string }

// ── Kid accounts ────────────────────────────────────────────
export async function kidSignup(input: { username: string; pin: string; displayName: string; dob: string; gender: Gender }): Promise<CloudResult> {
  if (!cloudEnabled) return { ok: false, error: 'cloud-disabled' }
  const { data, error } = await supabase.auth.signUp({
    email: synthEmail(input.username),
    password: pinToPassword(input.pin),
    options: {
      data: {
        username: input.username.trim().toLowerCase(),
        display_name: input.displayName.trim(),
        dob: input.dob,
        gender: input.gender,
        role: 'kid',
      },
    },
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data }
}

export async function kidLogin(username: string, pin: string): Promise<CloudResult> {
  if (!cloudEnabled) return { ok: false, error: 'cloud-disabled' }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: synthEmail(username),
    password: pinToPassword(pin),
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data }
}

export async function signOutCloud(): Promise<void> {
  if (!cloudEnabled) return
  try { await supabase.auth.signOut() } catch { /* ignore */ }
}

// ── Guardian linking ────────────────────────────────────────
export async function findByCode(code: string): Promise<CloudProfile | null> {
  if (!cloudEnabled) return null
  const { data, error } = await supabase.rpc('find_by_code', { p_code: code.trim().toUpperCase() })
  if (error || !data || !data.length) return null
  return data[0] as CloudProfile
}

export async function linkKid(code: string): Promise<CloudResult> {
  if (!cloudEnabled) return { ok: false, error: 'cloud-disabled' }
  const { data, error } = await supabase.rpc('link_kid', { p_code: code.trim().toUpperCase() })
  if (error) return { ok: false, error: error.message }
  return { ok: data === true, error: data === true ? undefined : 'No kid found for that code' }
}

/** The kids linked to the signed-in guardian (for the family dashboard). */
export async function listMyKids(): Promise<CloudProfile[]> {
  if (!cloudEnabled) return []
  const { data: u } = await supabase.auth.getUser()
  const uid = u.user?.id
  if (!uid) return []
  const { data } = await supabase
    .from('profiles')
    .select('id,display_name,role,photo_url,friend_code,dob,gender,xp,level,last_seen')
    .eq('guardian_id', uid)
  return (data ?? []) as CloudProfile[]
}

// ── Presence + leaderboard ──────────────────────────────────
export async function touchPresence(): Promise<void> {
  if (!cloudEnabled) return
  try { await supabase.rpc('touch_presence') } catch { /* ignore */ }
}

/** Online if seen within the window (default 2 min). */
export function isOnline(lastSeen?: string | null, windowMs = 120_000): boolean {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < windowMs
}

export async function getKidLeaderboard(top = 20): Promise<CloudProfile[]> {
  if (!cloudEnabled) return []
  const { data } = await supabase.rpc('get_kid_leaderboard', { top })
  return (data ?? []) as CloudProfile[]
}

export async function myFriendCode(): Promise<string | null> {
  if (!cloudEnabled) return null
  const { data: u } = await supabase.auth.getUser()
  const uid = u.user?.id
  if (!uid) return null
  const { data } = await supabase.from('profiles').select('friend_code').eq('id', uid).single()
  return (data?.friend_code as string) ?? null
}
