// ============================================================
//  CLOUD AUTH  (Step 2)  — real Supabase accounts for kids & adults
//  Kids have no email, so we use SYNTHETIC-EMAIL auth: a kid named
//  "baginda" becomes the auth user baginda@kids.argantalab.app with
//  the PIN (padded to meet length rules) as the password. The kid is
//  then a genuine auth.user, so every per-user RLS policy works and
//  the grow-up-to-Gmail path is a simple email change later.
//  All calls no-op safely when `cloudEnabled` is false.
// ============================================================
import { createClient } from '@supabase/supabase-js'
import { supabase, cloudEnabled } from './supabase'
import type { Gender } from './circles'

const KID_DOMAIN = 'kids.argantalab.app'

// A throwaway client used to CREATE a kid account without disturbing the
// parent's session. signUp() would otherwise sign the calling client in as the
// new kid; this isolated client (no persisted session) absorbs that instead.
function signupClient() {
  const url = (import.meta.env.VITE_SUPABASE_URL as string) || ''
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || ''
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'alab_signup_tmp' } })
}

export const synthEmail = (username: string) =>
  `${username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '')}@${KID_DOMAIN}`

// PINs are 4 digits; Supabase requires 6+ char passwords, so pad with a fixed
// salt. The kid only ever types the PIN — this transform is internal.
const pinToPassword = (pin: string) => `${pin}#aLab`

export interface CloudProfile {
  id: string
  display_name: string
  role: string
  username?: string | null
  photo_url?: string | null
  friend_code?: string | null
  dob?: string | null
  gender?: string | null
  diamonds?: number
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

// A signed-in PARENT creates a kid's cloud account and stays logged in.
// Uses an isolated client so the parent's session is untouched. The guardian
// link is set authoritatively from the signup metadata (the handle_new_user
// trigger writes guardian_id), so it no longer depends on a transient kid
// session — which never exists when email-confirmation is on. If the kid
// already exists (e.g. created on another device), we self-heal by adopting it.
export async function parentCreateKid(
  input: { username: string; pin: string; displayName: string; dob: string; gender: Gender },
  parentId: string,
): Promise<CloudResult<CloudProfile>> {
  if (!cloudEnabled) return { ok: false, error: 'cloud-disabled' }
  const tmp = signupClient()
  try {
    const { data, error } = await tmp.auth.signUp({
      email: synthEmail(input.username),
      password: pinToPassword(input.pin),
      options: { data: { username: input.username.trim().toLowerCase(), display_name: input.displayName.trim(), dob: input.dob, gender: input.gender, role: 'kid', guardian_id: parentId } },
    })
    if (error) {
      // Already registered (e.g. created earlier / on another device): adopt it
      // by PIN so it links to this guardian instead of failing outright.
      if (/already|registered|exists/i.test(error.message)) {
        const linked = await adoptKid(input.username, input.pin)
        if (linked) return { ok: true, data: { id: 'existing', display_name: input.displayName, role: 'kid' } as CloudProfile }
      }
      return { ok: false, error: error.message }
    }
    const kidId = data.user?.id
    if (!kidId) return { ok: false, error: 'No account created' }
    // Belt-and-suspenders: if a kid session happens to exist, also link directly
    // (covers projects where the trigger metadata path hasn't been applied yet).
    if (data.session) {
      await tmp.from('profiles').update({ guardian_id: parentId }).eq('id', kidId)
    }
    const { data: prof } = await tmp.from('profiles').select('id,display_name,role,friend_code,dob,gender').eq('id', kidId).maybeSingle()
    await tmp.auth.signOut()
    return { ok: true, data: (prof ?? { id: kidId, display_name: input.displayName, role: 'kid' }) as CloudProfile }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// Claim / re-link an existing kid account to the signed-in guardian, proving
// control with the kid's PIN. Repairs kids whose guardian_id was never set
// (orphaned by the old create flow). No-ops safely if the PIN is wrong.
export async function adoptKid(username: string, pin: string): Promise<boolean> {
  if (!cloudEnabled) return false
  const { data, error } = await supabase.rpc('adopt_kid', { p_username: username.trim().toLowerCase(), p_pin: pin })
  if (error) return false
  return data === true
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

/** Every child of the signed-in guardian — guardian_id mirror OR guardianships
 *  (M:N), so co-parented kids appear too. Server-authoritative via my_children(). */
export async function listMyKids(): Promise<CloudProfile[]> {
  if (!cloudEnabled) return []
  const { data, error } = await supabase.rpc('my_children')
  if (error || !data) return []
  // my_children() returns kids only; stamp role so existing filters still work.
  return (data as CloudProfile[]).map(k => ({ ...k, role: 'kid' }))
}

/** Unlink a kid from the signed-in guardian (kid account itself is untouched). */
export async function unlinkKid(kidId: string): Promise<boolean> {
  if (!cloudEnabled) return false
  const { data, error } = await supabase.rpc('unlink_kid', { p_kid: kidId })
  if (error) return false
  return data === true
}

// ── Circles (cloud, server-authoritative) ───────────────────
export interface CloudCircle {
  id: string; name: string; kind: string; emoji: string | null
  accent: string | null; role: string; owner_id: string; member_count: number
}
export interface CircleMember {
  id: string; display_name: string; role: string; photo_url: string | null
  is_kid: boolean; last_seen: string | null
}
export interface PendingInvite {
  id: string; circle_id: string; circle_name: string; circle_kind: string
  role: string; as_guardian: boolean; invited_by_name: string; created_at: string
}

/** Circles the signed-in user owns or belongs to. */
export async function myCircles(): Promise<CloudCircle[]> {
  if (!cloudEnabled) return []
  const { data, error } = await supabase.rpc('my_circles')
  if (error || !data) return []
  return data as CloudCircle[]
}

/** The members (adults + kids) of a circle the caller belongs to. */
export async function circleRoster(circleId: string): Promise<CircleMember[]> {
  if (!cloudEnabled) return []
  const { data, error } = await supabase.rpc('circle_roster', { p_circle: circleId })
  if (error || !data) return []
  return data as CircleMember[]
}

/** Owner/admin invites a registered ADULT (by friend code) into a circle. */
export async function inviteToCircle(circleId: string, code: string, role = 'member', asGuardian = false): Promise<CloudResult> {
  if (!cloudEnabled) return { ok: false, error: 'cloud-disabled' }
  const { error } = await supabase.rpc('invite_to_circle', {
    p_circle: circleId, p_code: code.trim().toUpperCase(), p_role: role, p_as_guardian: asGuardian,
  })
  if (error) return { ok: false, error: error.message.replace(/^.*?:\s*/, '') }
  return { ok: true }
}

/** Pending circle invites awaiting the signed-in user's response. */
export async function myInvites(): Promise<PendingInvite[]> {
  if (!cloudEnabled) return []
  const { data, error } = await supabase.rpc('my_invites')
  if (error || !data) return []
  return data as PendingInvite[]
}

export async function respondToInvite(inviteId: string, accept: boolean): Promise<boolean> {
  if (!cloudEnabled) return false
  const { data, error } = await supabase.rpc('respond_to_invite', { p_invite: inviteId, p_accept: accept })
  if (error) return false
  return data === true
}

/** Parent resets a child's PIN (no plaintext is ever stored — server re-hashes). */
export async function resetKidPin(kidId: string, newPin: string): Promise<CloudResult> {
  if (!cloudEnabled) return { ok: false, error: 'cloud-disabled' }
  const { error } = await supabase.rpc('reset_kid_pin', { p_kid: kidId, p_new_pin: newPin })
  if (error) return { ok: false, error: error.message.replace(/^.*?:\s*/, '') }
  return { ok: true }
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

// ── Friends + social stats + per-kid rings ──────────────────
export interface SocialStats { circles: number; connections: number; friends: number }
export interface Friend { id: string; display_name: string; photo_url: string | null; role: string; last_seen: string | null; source: string }
export interface FriendRequest { id: string; from_id: string; from_name: string; from_photo: string | null; created_at: string }
export interface KidFriend { id: string; display_name: string; photo_url: string | null; status: string }
export interface WorldRing { world: string; pct: number }

export async function socialStats(userId?: string): Promise<SocialStats> {
  if (!cloudEnabled) return { circles: 0, connections: 0, friends: 0 }
  const { data, error } = await supabase.rpc('social_stats', userId ? { p_user: userId } : {})
  if (error || !data) return { circles: 0, connections: 0, friends: 0 }
  return data as SocialStats
}

export async function myFriends(): Promise<Friend[]> {
  if (!cloudEnabled) return []
  const { data, error } = await supabase.rpc('my_friends')
  if (error || !data) return []
  return data as Friend[]
}

export async function myFriendRequests(): Promise<FriendRequest[]> {
  if (!cloudEnabled) return []
  const { data, error } = await supabase.rpc('my_friend_requests')
  if (error || !data) return []
  return data as FriendRequest[]
}

export async function sendFriendRequest(code: string): Promise<CloudResult<{ status: string }>> {
  if (!cloudEnabled) return { ok: false, error: 'cloud-disabled' }
  const { data, error } = await supabase.rpc('send_friend_request', { p_code: code.trim().toUpperCase() })
  if (error) return { ok: false, error: error.message.replace(/^.*?:\s*/, '') }
  return { ok: true, data: data as { status: string } }
}

export async function respondFriendRequest(id: string, accept: boolean): Promise<boolean> {
  if (!cloudEnabled) return false
  const { data, error } = await supabase.rpc('respond_friend_request', { p_id: id, p_accept: accept })
  return !error && data === true
}

export async function removeFriend(userId: string): Promise<boolean> {
  if (!cloudEnabled) return false
  const { data, error } = await supabase.rpc('remove_friend', { p_user: userId })
  return !error && data === true
}

export async function kidFriends(kidId: string): Promise<KidFriend[]> {
  if (!cloudEnabled) return []
  const { data, error } = await supabase.rpc('kid_friends', { p_kid: kidId })
  if (error || !data) return []
  return data as KidFriend[]
}

export async function removeKidFriend(kidId: string, userId: string): Promise<boolean> {
  if (!cloudEnabled) return false
  const { data, error } = await supabase.rpc('remove_kid_friend', { p_kid: kidId, p_user: userId })
  return !error && data === true
}

export async function kidWorldRings(kidId: string): Promise<WorldRing[]> {
  if (!cloudEnabled) return []
  const { data, error } = await supabase.rpc('kid_world_rings', { p_kid: kidId })
  if (error || !data) return []
  return data as WorldRing[]
}
