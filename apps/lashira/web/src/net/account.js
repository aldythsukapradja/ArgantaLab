// Auth + profile for LashiraBloom.
//   Adults  -> Google OAuth (real ArgantaLab identity).
//   Kids    -> username + PIN (synthetic @kids.argantalab.app scheme).
//   Guest   -> always available local profile so the game runs on first click,
//              even before OAuth redirect URLs / RLS are configured for localhost.
// Every network call is wrapped so a failure downgrades to guest, never a crash.
import { supabase, hasSupabase } from './supabase.js';

const KID_DOMAIN = '@kids.argantalab.app';

// OPERATOR (admin) — free everything + unlimited stamina. Gated ONLY to these
// verified account emails (from the Supabase session, not a role/name a client
// could set). Anyone else — kids, other adults, guests — is never operator.
const OPERATOR_EMAILS = ['aldhyt.sukapradja@gmail.com'];
const isOperatorEmail = (email) => OPERATOR_EMAILS.includes((email || '').trim().toLowerCase());
// Kids' real Supabase password is the 4-digit PIN with a fixed suffix — the
// SAME scheme Kingdom Heroes and KinetikCircle use (pinToPassword). Standalone
// login MUST match it or the kid can never sign in outside an embed.
const pinToPassword = (pin) => `${pin}#aLab`;

export function guestProfile(name, role) {
  return {
    id: 'guest',
    guest: true,
    displayName: (name || 'Farmer').trim() || 'Farmer',
    role: role === 'kid' ? 'kid' : 'user',
    diamonds: 0,
    xp: 0,
    level: 1,
  };
}

// Diamonds are a REAL server-authoritative column (migration_character_shop.sql's
// buy_cosmetic_item checks it for real) — unlike Bloom/stamina, which are pure
// client-local state and can just read as Infinity for the operator. So the
// operator's "everything free" treatment here is a real top-up RPC
// (migration_operator_diamonds.sql), re-verified server-side from the JWT — not
// a client flag. Fire-and-forget; on success, use ITS returned balance so the
// UI shows it immediately instead of waiting on a stale read.
async function topUpOperatorDiamonds(fallback) {
  try {
    const { data, error } = await supabase.rpc('grant_operator_diamonds');
    if (!error && data?.ok) return Number(data.balance);
  } catch { /* migration not deployed yet — fall through */ }
  return fallback;
}

async function loadProfileRow(userId, fallbackName, role, email) {
  const operator = isOperatorEmail(email);
  // Try to read the real profile; tolerate RLS / missing columns.
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, diamonds, xp, level, role')
      .eq('id', userId)
      .maybeSingle();
    if (data) {
      const diamonds = operator ? await topUpOperatorDiamonds(data.diamonds ?? 0) : (data.diamonds ?? 0);
      return {
        id: data.id,
        guest: false,
        displayName: data.display_name || fallbackName || 'Farmer',
        role: data.role || role || 'user',
        diamonds: data.diamonds ?? 0,
        xp: data.xp ?? 0,
        level: data.level ?? 1,
        operator,
      };
    }
  } catch (err) {
    console.warn('profile read failed, using session basics:', err?.message || err);
  }
  return {
    id: userId,
    guest: false,
    displayName: fallbackName || 'Farmer',
    role: role || 'user',
    diamonds: 0,
    xp: 0,
    level: 1,
    operator,
  };
}

// Returns a profile if a Supabase session already exists (e.g. after Google
// redirect), else null.
export async function currentProfile() {
  if (!hasSupabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return null;
    const name = user.user_metadata?.full_name || user.email?.split('@')[0];
    return await loadProfileRow(user.id, name, 'user', user.email);
  } catch {
    return null;
  }
}

// Subscribe to auth changes (fires when an embed host injects a session via
// setSession/postMessage). Returns an unsubscribe fn.
export function onAuth(cb) {
  if (!hasSupabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_e, s) => cb(s?.user ?? null));
  return () => data?.subscription?.unsubscribe?.();
}

// Build a LashiraBloom profile from an auth user (used in embed mode where the
// host already holds the session).
export async function profileForUser(user) {
  if (!user) return null;
  const name = user.user_metadata?.full_name || user.email?.split('@')[0];
  const role = (user.email || '').endsWith('@kids.argantalab.app') ? 'kid' : 'user';
  return await loadProfileRow(user.id, name, role, user.email);
}

export async function signInGoogle() {
  if (!hasSupabase) throw new Error('offline');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
  // Redirect happens; currentProfile() picks up the session on return.
}

export async function signInKid(username, pin) {
  if (!hasSupabase) throw new Error('offline');
  const clean = (username || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!clean) throw new Error('Enter a username');
  if (!/^\d{4}$/.test(pin || '')) throw new Error('PIN must be 4 digits');
  const email = clean + KID_DOMAIN;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pinToPassword(pin) });
  if (error) throw error;
  const name = data?.user?.user_metadata?.full_name || clean;
  return await loadProfileRow(data.user.id, name, 'kid', email);
}

export async function signOut() {
  if (hasSupabase) {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
  }
}
