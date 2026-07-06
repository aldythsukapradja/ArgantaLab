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

