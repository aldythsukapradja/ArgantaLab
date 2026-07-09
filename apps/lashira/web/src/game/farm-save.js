import { supabase, hasSupabase } from '../net/supabase.js';

export const FARM_GAME_ID = 'builtin:kinfarm';
export const FARM_SAVE_SLOT = 'default';

function cleanCircleId(circleId) {
  const s = String(circleId || '').trim();
  return s || null;
}

function localKey(profile, circleId) {
  const circle = cleanCircleId(circleId);
  return circle
    ? `lashirabloom_cloud_fallback_circle_${circle}`
    : `lashirabloom_cloud_fallback_${profile?.id || 'guest'}`;
}

export function canUseCloud(profile) {
  return !!(hasSupabase && supabase && profile && !profile.guest);
}

export async function loadFarmState({ profile, circleId, gameId = FARM_GAME_ID, slot = FARM_SAVE_SLOT }) {
  const circle = cleanCircleId(circleId);
  if (canUseCloud(profile)) {
    const fn = circle ? 'load_circle_game_state' : 'load_lashira_farm_state';
    const args = circle
      ? { p_circle: circle, p_game: gameId, p_slot: slot }
      : { p_game: gameId, p_slot: slot };
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw error;
    if (data && typeof data === 'object') return { data, source: circle ? 'circle-cloud' : 'personal-cloud' };
    return { data: null, source: circle ? 'circle-cloud-empty' : 'personal-cloud-empty' };
  }

  const raw = localStorage.getItem(localKey(profile, circle));
  return { data: raw ? JSON.parse(raw) : null, source: 'local-fallback' };
}

export async function saveFarmState({ profile, circleId, data, gameId = FARM_GAME_ID, slot = FARM_SAVE_SLOT }) {
  const circle = cleanCircleId(circleId);
  if (canUseCloud(profile)) {
    const fn = circle ? 'save_circle_game_state' : 'save_lashira_farm_state';
    const args = circle
      ? { p_circle: circle, p_game: gameId, p_slot: slot, p_data: data }
      : { p_game: gameId, p_slot: slot, p_data: data };
    const { error } = await supabase.rpc(fn, args);
    if (error) throw error;
    return { source: circle ? 'circle-cloud' : 'personal-cloud' };
  }

  localStorage.setItem(localKey(profile, circle), JSON.stringify(data));
  return { source: 'local-fallback' };
}

// Read-only: a circle-mate's PERSONAL farm (visit mode). Gated server-side by
// migration_lashira_multi_farm.sql's shares_circle_with() — a visitor can never
// write here (save_lashira_farm_state only ever writes auth.uid()'s own row).
// Guests/no-cloud have no server session at all, so visiting simply isn't
// offered to them — callers should hide member tiles in that case.
export async function loadMemberFarmState({ ownerId, gameId = FARM_GAME_ID, slot = FARM_SAVE_SLOT }) {
  if (!hasSupabase || !supabase || !ownerId) return { data: null, source: 'unavailable' };
  const { data, error } = await supabase.rpc('load_member_farm_state', { p_owner: ownerId, p_game: gameId, p_slot: slot });
  if (error) throw error;
  return { data: data && typeof data === 'object' ? data : null, source: 'member-cloud' };
}

// Roster for the Travel picker: every member of a circle you belong to. A plain
// `circle_members` select is row-limited to your OWN membership row by RLS, so
// this goes through the list_circle_members() definer RPC instead.
export async function listCircleMembers(circleId) {
  const circle = cleanCircleId(circleId);
  if (!hasSupabase || !supabase || !circle) return [];
  const { data, error } = await supabase.rpc('list_circle_members', { p_circle: circle });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

