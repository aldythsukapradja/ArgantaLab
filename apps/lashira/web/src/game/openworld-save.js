import { loadFarmState, saveFarmState } from './farm-save.js';
import { OPENWORLD_GAME_ID, OPENWORLD_SAVE_SLOT } from './world-map-registry.js';

// ── Openworld persistence — TWO blobs, both gameId 'builtin:openworld', so they
// never collide (personal RPC keys on auth.uid(); circle RPC keys on circle):
//
//   PERSONAL  (circleId = null)  -> your live avatar position per realm, your
//                                   last realm, your per-realm daily reward caps.
//   CIRCLE    (circleId set)     -> the shared kingdom progression the whole
//                                   circle advances together: realm meters,
//                                   unlocks, city state, and a compliance ledger.
//
// Access rule (see IMPL doc §1): the 5 realms are the CIRCLE's realms. Circle
// reads/writes are RLS-gated server-side by save_circle_game_state — a player
// who does not share the circle simply cannot write it. The client gate is UX;
// RLS is the wall.

// ---------- personal (position + caps) ----------
const emptyPersonal = () => ({
  currentRealmId: null,
  hqTile: null,
  hqFacing: 'South',
  realmPositionsById: {},
  caps: {},           // { 'YYYY-MM-DD': { [realmId]: loopsToday } }
  updatedAt: Date.now(),
});

export async function loadOpenworldState(profile, circleId = null) {
  // Position/caps are ALWAYS personal — pass circleId:null on purpose so this
  // survives regardless of which farm scope you're in.
  const loaded = await loadFarmState({
    profile,
    circleId: null,
    gameId: OPENWORLD_GAME_ID,
    slot: OPENWORLD_SAVE_SLOT,
  });
  return {
    data: { ...emptyPersonal(), ...(loaded?.data || {}) },
    source: loaded?.source || 'empty',
  };
}

export async function saveOpenworldState(profile, circleId = null, data) {
  const payload = { ...emptyPersonal(), ...(data || {}), updatedAt: Date.now() };
  const saved = await saveFarmState({
    profile,
    circleId: null,
    gameId: OPENWORLD_GAME_ID,
    slot: OPENWORLD_SAVE_SLOT,
    data: payload,
  });
  return { data: payload, source: saved?.source || 'saved' };
}

// ---------- circle-shared progression ----------
const CIRCLE_SLOT = 'progression';

const emptyCircle = () => ({
  // per-realm shared meter (0..meterMax) and unlock stage
  meters: {},          // { [realmId]: { value, stage } }
  // running circle resource totals earned FROM realms (kept separate from the
  // live farm resource pool for now — see IMPL §1.4; wiring back to farm
  // resources is a reviewed follow-up needing an increment RPC).
  totals: {},          // { bloom, wood, stone, food, ore, meals, tokens, score }
  // city/stronghold health (Lashira Keep)
  city: { happiness: 0, safety: 0, prosperity: 0, level: 1 },
  // arena leaderboard (Emberring) — { [memberId]: { name, best } }
  board: {},
  // last N compliance/earn events (kid_xp_blocked proof lives here)
  ledger: [],
  updatedAt: Date.now(),
});

export async function loadOpenworldCircle(profile, circleId) {
  if (!circleId) return { data: emptyCircle(), source: 'no-circle' };
  const loaded = await loadFarmState({
    profile,
    circleId,
    gameId: OPENWORLD_GAME_ID,
    slot: CIRCLE_SLOT,
  });
  const base = emptyCircle();
  const d = loaded?.data || {};
  return {
    data: {
      ...base,
      ...d,
      meters: { ...base.meters, ...(d.meters || {}) },
      totals: { ...base.totals, ...(d.totals || {}) },
      city: { ...base.city, ...(d.city || {}) },
      board: { ...base.board, ...(d.board || {}) },
      ledger: Array.isArray(d.ledger) ? d.ledger : [],
    },
    source: loaded?.source || 'empty',
  };
}

export async function saveOpenworldCircle(profile, circleId, data) {
  if (!circleId) return { data, source: 'no-circle' };
  const payload = { ...emptyCircle(), ...(data || {}), updatedAt: Date.now() };
  // Trim ledger so the shared blob can't grow without bound.
  if (Array.isArray(payload.ledger) && payload.ledger.length > 60) {
    payload.ledger = payload.ledger.slice(-60);
  }
  const saved = await saveFarmState({
    profile,
    circleId,
    gameId: OPENWORLD_GAME_ID,
    slot: CIRCLE_SLOT,
    data: payload,
  });
  return { data: payload, source: saved?.source || 'saved' };
}
