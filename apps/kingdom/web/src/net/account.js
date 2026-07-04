// Account layer for MP-0 — identical auth logic to KinetikCircle:
//   adults: Google OAuth
//   kids:   username + PIN via synthetic email (username@kids.argantalab.app,
//           password `${pin}#aLab`) — a real auth.user, same as apps/kinetik.
// Diamonds are read from the EXISTING kinetik `profiles.diamonds` mirror
// (ArgantaLabs is the source of truth; we only display).
import { createClient } from '@supabase/supabase-js';

// Normalize the configured Supabase URL. Vercel's env var is easy to set
// wrong (bare project ref `abcd1234`, missing protocol, stray quotes/space).
// A bad value used to crash createClient and white-screen the WHOLE app; now
// we repair what we can and otherwise degrade to offline mode.
function resolveSupabaseUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let u = raw.trim().replace(/^['"]|['"]$/g, ''); // strip stray quotes
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) {
    try { new URL(u); return u; } catch { return null; }
  }
  // bare host or bare project ref -> build the full URL
  if (/\.supabase\.co$/i.test(u)) return 'https://' + u;          // host only
  if (/^[a-z0-9]{16,}$/i.test(u)) return `https://${u}.supabase.co`; // ref only
  return null;
}

const url = resolveSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

function makeClient() {
  if (!url || !anon) return null;
  try {
    return createClient(url, anon);
  } catch (err) {
    console.error('Supabase disabled — invalid config:', err?.message || err);
    return null;
  }
}

export const supabase = makeClient();
export const authAvailable = !!supabase;

const KID_DOMAIN = 'kids.argantalab.app';
const synthEmail = (u) => `${u.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '')}@${KID_DOMAIN}`;
const pinToPassword = (pin) => `${pin}#aLab`;

export const isKidUser = (user) => (user?.email || '').endsWith('@' + KID_DOMAIN);

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
}
export async function signInKid(username, pin) {
  return supabase.auth.signInWithPassword({
    email: synthEmail(username),
    password: pinToPassword(pin),
  });
}
export const signOut = () => supabase.auth.signOut();
export const onAuth = (cb) => supabase.auth.onAuthStateChange((_e, session) => cb(session?.user ?? null));
export const currentUser = async () => (await supabase.auth.getUser()).data.user;

// ---- kinetik profile (display name, avatar, DIAMONDS mirror) ----
export async function fetchKinetikProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('display_name, photo_url, diamonds, xp, level, role')
    .eq('id', userId)
    .maybeSingle();
  return data || null;
}

// ---- kingdom character (one per account in MP-0) ----
export async function fetchMyCharacter(userId) {
  const { data: ch } = await supabase
    .from('kingdom_characters')
    .select('id, name, account_type, path_id, level')
    .eq('profile_id', userId)
    .maybeSingle();
  if (!ch) return null;
  const { data: ap } = await supabase
    .from('kingdom_character_appearance')
    .select('appearance_json')
    .eq('character_id', ch.id)
    .maybeSingle();
  return { ...ch, spec: ap?.appearance_json?.spec || null };
}

export async function claimCharacter(userId, name, accountType) {
  const { data, error } = await supabase
    .from('kingdom_characters')
    .insert({ profile_id: userId, name: name.trim(), account_type: accountType })
    .select('id, name, account_type, path_id, level')
    .single();
  if (error) {
    if (String(error.message).includes('kingdom_characters_name_uq')) {
      return { error: 'That nickname is already taken.' };
    }
    if (String(error.message).includes('kingdom_characters_profile_uq')) {
      return { error: 'This account already has a character.' };
    }
    return { error: error.message };
  }
  return { character: data };
}

// Debounced cloud save of the composer loadout.
let saveTimer = null;
export function saveLoadout(characterId, spec) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await supabase.from('kingdom_character_appearance').upsert({
      character_id: characterId,
      body_part_id: spec.body?.id ?? null,
      face_part_id: spec.face?.id ?? null,
      hair_part_id: spec.hair?.id ?? null,
      coat_part_id: spec.coat?.id ?? null,
      weapon_part_id: spec.weapon?.id ?? null,
      shield_part_id: spec.shield?.id ?? null,
      mount_id: spec.mount?.id ?? null,
      hair_palette_id: spec.hair?.palette ?? null,
      coat_palette_id: spec.coat?.palette ?? null,
      skin_palette_id: spec.body?.palette ?? null,
      appearance_json: { spec },
      updated_at: new Date().toISOString(),
    });
  }, 900);
}
