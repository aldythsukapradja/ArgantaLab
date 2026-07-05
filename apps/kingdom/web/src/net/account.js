// Account + DB-backed Kingdom state.
// Adults use Google OAuth. Kids use the existing ArgantaLab synthetic-email
// scheme. Gameplay state is read/written through Supabase RPCs when available;
// direct table fallbacks only keep the old MP-0 project usable before the new
// migration is applied.
import { createClient } from '@supabase/supabase-js';

function resolveSupabaseUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let u = raw.trim().replace(/^['"]|['"]$/g, '');
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) {
    try { new URL(u); return u; } catch { return null; }
  }
  if (/\.supabase\.co$/i.test(u)) return 'https://' + u;
  if (/^[a-z0-9]{16,}$/i.test(u)) return `https://${u}.supabase.co`;
  return null;
}

const url = resolveSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

function makeClient() {
  if (!url || !anon) return null;
  try {
    // Own storageKey so the standalone client never collides with a host
    // app's Supabase session when the Lab is embedded (see useHostSupabase).
    return createClient(url, anon, { auth: { storageKey: 'kingdom-auth' } });
  } catch (err) {
    console.error('Supabase disabled - invalid config:', err?.message || err);
    return null;
  }
}

// DUAL-MODE AUTH. The Lab is auth-agnostic:
//  • standalone (kingdom deploy)   -> uses this own client + Google/kid login
//  • embedded (ArgantaLab, Kingdom Command, ...) -> the host injects its OWN
//    already-authenticated client via useHostSupabase(), so the Lab reuses the
//    site's session and shows no login. `supabase` is a live ESM binding, so
//    every consumer (arenaNet, etc.) picks up the injected client at call time.
export let supabase = makeClient();
export const authAvailable = !!supabase;

/** Embed hook: point the whole Lab at the host app's Supabase client. */
export function useHostSupabase(client) {
  if (client) supabase = client;
  return supabase;
}

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

// Mirrors ArgantaLab's rank ladder (apps/web/src/lib/rank.ts) so the arena HUD
// shows the learner's real rank glyph instead of always falling back to Spark's
// '*'. Kept as a small local copy rather than a cross-app import — same tier
// thresholds, so a rank here always matches what ArgantaLab itself shows.
// Mirrors ArgantaLab's rank ladder (apps/web/src/lib/rank.ts) — same tier
// thresholds, so the arena crest always matches what ArgantaLab itself shows.
export const RANK_TIERS = [
  { name: 'Spark', color: '#f0a83a', glyph: '✦', at: 0 },
  { name: 'Explorer', color: '#5ec257', glyph: '❖', at: 5000 },
  { name: 'Adventurer', color: '#37a8c4', glyph: '✧', at: 15000 },
  { name: 'Maker', color: '#7a4fd0', glyph: '✶', at: 40000 },
  { name: 'Sage', color: '#d9a520', glyph: '★', at: 85000 },
  { name: 'Luminary', color: '#d4476b', glyph: '✷', at: 160000 },
];
export function computeRank(xp) {
  const p = Math.max(0, Number(xp) || 0);
  let idx = 0;
  for (let i = 0; i < RANK_TIERS.length; i++) if (p >= RANK_TIERS[i].at) idx = i;
  const t = RANK_TIERS[idx];
  return { index: idx, glyph: t.glyph, name: t.name, color: t.color };
}
// Resolve a rank object (which may be an old backend letter-grade, or already a
// tier) back to a tier index so the crest cache can look it up.
export function rankTierIndex(rank) {
  if (!rank) return 0;
  if (Number.isInteger(rank.index)) return rank.index;
  const byName = RANK_TIERS.findIndex((t) => t.name === rank.name);
  if (byName >= 0) return byName;
  const byGlyph = RANK_TIERS.findIndex((t) => t.glyph === rank.glyph);
  return byGlyph >= 0 ? byGlyph : 0;
}

function snakeProfile(profile = {}) {
  const xp = Number(profile.xp ?? 0);
  return {
    ...profile,
    display_name: profile.display_name ?? profile.displayName ?? 'Player',
    photo_url: profile.photo_url ?? profile.photoUrl ?? null,
    diamonds: Number(profile.diamonds ?? 0),
    xp,
    level: Number(profile.level ?? 1),
    role: profile.role ?? 'user',
    // Always the ArgantaLab learning tier from XP — overrides any backend
    // letter-grade ("E", "D", …) so the arena shows the on-brand rank crest.
    rank: computeRank(xp),
  };
}

function snakeCharacter(ch = null) {
  if (!ch) return null;
  return {
    ...ch,
    account_type: ch.account_type ?? ch.accountType ?? 'adult',
    path_id: ch.path_id ?? ch.pathId ?? 'warrior',
  };
}

export function normalizePlayerState(raw, user = null, accountType = 'adult') {
  if (!raw) return null;
  const profile = snakeProfile(raw.profile || {});
  const character = snakeCharacter(raw.character);
  const loadout = raw.loadout || {};
  const draftSpec = loadout.draftSpec || character?.spec || null;
  const syncedSpec = loadout.syncedSpec || draftSpec || null;
  return {
    user,
    profile,
    character,
    accountType: character?.account_type || accountType,
    cloudSpec: draftSpec,
    draftSpec,
    syncedSpec,
    stats: raw.stats || null,
    guardian: raw.guardian || null,
    loadout,
    presence: raw.presence || null,
  };
}

// ---- existing profile / character fallbacks ----
export async function fetchKinetikProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('display_name, photo_url, diamonds, xp, level, role')
    .eq('id', userId)
    .maybeSingle();
  return data || null;
}

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

async function fallbackPlayerState(user) {
  const accountType = isKidUser(user) ? 'kid' : 'adult';
  const [profile, character] = await Promise.all([
    fetchKinetikProfile(user.id),
    fetchMyCharacter(user.id),
  ]);
  return {
    user,
    profile: snakeProfile(profile || { display_name: user.email, role: accountType }),
    character: snakeCharacter(character),
    accountType,
    cloudSpec: character?.spec || null,
    draftSpec: character?.spec || null,
    syncedSpec: character?.spec || null,
    stats: { maxHp: 100, maxMp: 40, attack: 10, magic: 10, defense: 5 },
    guardian: null,
    loadout: { draftSpec: character?.spec || null, syncedSpec: character?.spec || null },
    migrationMissing: true,
  };
}

export async function fetchPlayerState(user) {
  if (!supabase || !user) return null;
  const accountType = isKidUser(user) ? 'kid' : 'adult';
  try {
    const { data, error } = await supabase.rpc('kingdom_get_player_state');
    if (error) throw error;
    return normalizePlayerState(data, user, accountType);
  } catch (err) {
    console.warn('[kingdom] player-state RPC unavailable, using MP-0 fallback:', err?.message || err);
    return fallbackPlayerState(user);
  }
}

export async function claimCharacter(userId, name, accountType) {
  const { data, error } = await supabase
    .from('kingdom_characters')
    .insert({ profile_id: userId, name: name.trim(), account_type: accountType })
    .select('id, name, account_type, path_id, level')
    .single();
  if (error) {
    if (String(error.message).includes('kingdom_characters_name_uq')) return { error: 'That nickname is already taken.' };
    if (String(error.message).includes('kingdom_characters_profile_uq')) return { error: 'This account already has a character.' };
    return { error: error.message };
  }
  return { character: data };
}

export async function saveDraftLoadout(spec) {
  try {
    const { data, error } = await supabase.rpc('kingdom_save_character_draft', { p_spec: spec });
    if (error) throw error;
    return { state: data };
  } catch (err) {
    return { error: err?.message || String(err) };
  }
}

// True when a Postgres RPC doesn't exist yet (migration 002 not applied).
const isMissingRpc = (e) =>
  e?.code === 'PGRST202' || /Could not find the function/i.test(e?.message || '');

// syncCharacterBuild commits the working draft as the "saved build". When the
// progression migration isn't applied yet, fall back to the legacy appearance
// upsert so the button still works (draft == synced in that world).
export async function syncCharacterBuild(draftSpec = null, characterId = null) {
  const { data, error } = await supabase.rpc('kingdom_sync_character_build');
  if (error) {
    if (isMissingRpc(error) && characterId && draftSpec) {
      const legacy = await saveLoadoutNow(characterId, draftSpec);
      if (legacy.error) return { error: legacy.error };
      return { legacy: true, syncedSpec: draftSpec, migrationMissing: true };
    }
    return { error: error.message };
  }
  return { state: data };
}

// resetCharacterDraft reverts the draft to the last saved build. Legacy mode
// has no separate draft, so the caller just reloads the saved spec locally.
export async function resetCharacterDraft() {
  const { data, error } = await supabase.rpc('kingdom_reset_character_draft');
  if (error) {
    if (isMissingRpc(error)) return { legacy: true, migrationMissing: true };
    return { error: error.message };
  }
  return { state: data };
}

export async function renameGuardian(guardianId, name) {
  const { data, error } = await supabase.rpc('kingdom_rename_guardian', { p_guardian: guardianId, p_name: name });
  if (error) return { error: error.message };
  return { state: data };
}

export async function startCharacterSession(characterId, deviceLabel = 'web') {
  const { data, error } = await supabase.rpc('kingdom_start_character_session', {
    p_character_id: characterId,
    p_device_label: deviceLabel,
  });
  if (error) return { error: error.message };
  return { session: data };
}

export async function heartbeatSession(sessionToken, mapId = 'character_lab') {
  const { data, error } = await supabase.rpc('kingdom_heartbeat_session', {
    p_session_token: sessionToken,
    p_map_id: mapId,
  });
  if (error) return { forceLogout: true, message: error.message };
  return data || { ok: true, forceLogout: false };
}

export async function endCharacterSession(sessionToken, reason = 'manual_exit') {
  if (!sessionToken) return false;
  const { data } = await supabase.rpc('kingdom_end_character_session', {
    p_session_token: sessionToken,
    p_reason: reason,
  });
  return data === true;
}

export async function getSessionEvents(sessionToken) {
  if (!sessionToken) return [];
  const { data, error } = await supabase.rpc('kingdom_get_session_events', { p_session_token: sessionToken });
  if (error || !data) return [];
  return data;
}

export async function ackSessionEvent(eventId) {
  if (!eventId) return false;
  const { data } = await supabase.rpc('kingdom_ack_session_event', { p_event_id: eventId });
  return data === true;
}

export async function getOnlineFriends() {
  try {
    const { data, error } = await supabase.rpc('kingdom_get_online_friends');
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

export async function awardMonsterXp(monsterTemplateId, context = {}) {
  const { data, error } = await supabase.rpc('kingdom_award_monster_xp', {
    p_monster_template_id: monsterTemplateId,
    p_context: context,
  });
  if (error) return { error: error.message };
  return data;
}

// Legacy direct save, kept only as a fallback for pre-migration projects.
function appearanceRow(characterId, spec) {
  return {
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
  };
}

let saveTimer = null;
export function saveLoadout(characterId, spec) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    supabase.from('kingdom_character_appearance').upsert(appearanceRow(characterId, spec));
  }, 900);
}

// Immediate (awaitable) legacy save — used by the syncCharacterBuild fallback.
export async function saveLoadoutNow(characterId, spec) {
  const { error } = await supabase
    .from('kingdom_character_appearance')
    .upsert(appearanceRow(characterId, spec));
  return error ? { error: error.message } : { ok: true };
}
