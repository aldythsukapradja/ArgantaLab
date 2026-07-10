import { loadFarmState, saveFarmState } from './farm-save.js';
import { OPENWORLD_GAME_ID, OPENWORLD_SAVE_SLOT } from './world-map-registry.js';

const emptyState = () => ({
  currentRealmId: null,
  hqTile: null,
  hqFacing: 'South',
  realmPositionsById: {},
  updatedAt: Date.now(),
});

export async function loadOpenworldState(profile, circleId = null) {
  const loaded = await loadFarmState({
    profile,
    circleId,
    gameId: OPENWORLD_GAME_ID,
    slot: OPENWORLD_SAVE_SLOT,
  });
  return {
    data: { ...emptyState(), ...(loaded?.data || {}) },
    source: loaded?.source || 'empty',
  };
}

export async function saveOpenworldState(profile, circleId = null, data) {
  const payload = { ...emptyState(), ...(data || {}), updatedAt: Date.now() };
  const saved = await saveFarmState({
    profile,
    circleId,
    gameId: OPENWORLD_GAME_ID,
    slot: OPENWORLD_SAVE_SLOT,
    data: payload,
  });
  return { data: payload, source: saved?.source || 'saved' };
}
