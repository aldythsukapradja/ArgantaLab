// SFX usage tracking — two layers, because static analysis genuinely can't
// see everything: 15 of 38 cues (every emote) are dispatched dynamically as
// `sfx.play(name)` where `name` is resolved at runtime (FarmRoom.jsx's
// doEmote), so grep can prove the call site exists but never which cue fires.
//
// Layer 1 — CUE_CALL_SITES: a maintained data table of real call sites, taken
// from a live grep of apps/lashira/web/src. This is NOT auto-generated — if a
// new sfx.play(...) call site is added to the game, this table needs a manual
// update, same maintenance burden as any hand-kept index. Flagged honestly
// rather than pretending it's derived automatically.
//
// Layer 2 — a live play-count tracker: the game batches sfx.play() calls in
// memory (logPlay) and flushes an aggregated delta periodically (flushUsage),
// so a cue triggered 50x in 15s sends ONE network call, not 50. HQ reads the
// aggregate via loadUsage. Never throws — offline/no-table degrades to empty.

export const CUE_CALL_SITES = {
  tap: [{ site: 'Hud.jsx:472', dynamic: false }, { site: 'HotspotPanels.jsx:166', dynamic: false }],
  harvest: [{ site: 'farm-logic.js:653', dynamic: false }],
  sickle: [{ site: 'farm-logic.js:669', dynamic: false }],
  plant: [{ site: 'farm-logic.js:693', dynamic: false }],
  buy: [{ site: 'farm-logic.js:783', dynamic: false }, { site: 'farm-logic.js:834', dynamic: false }],
  sell: [{ site: 'farm-logic.js:804', dynamic: false }],
  collect: [{ site: 'farm-logic.js:872', dynamic: false }, { site: 'HotspotPanels.jsx:184', dynamic: false }],
  sleep: [{ site: 'farm-logic.js:903', dynamic: false }],
  error: [{ site: 'HotspotPanels.jsx:154', dynamic: false }],
  reward: [{ site: 'HotspotPanels.jsx:184 (rarity-based)', dynamic: false }],
  quest: [{ site: 'farm-logic.js:583', dynamic: false }],
  hurt: [{ site: 'FarmRoom.jsx:540', dynamic: false }, { site: 'FarmRoom.jsx:1700', dynamic: false }],
  take: [{ site: 'FarmRoom.jsx:792', dynamic: false }, { site: 'FarmRoom.jsx:2273', dynamic: false }],
  mount: [{ site: 'FarmRoom.jsx:846', dynamic: false }],
  swing: [{ site: 'FarmRoom.jsx:884', dynamic: false }, { site: 'FarmRoom.jsx:898', dynamic: false }, { site: 'FarmRoom.jsx:1114 (miss branch)', dynamic: false }],
  die: [{ site: 'FarmRoom.jsx:934 (killed branch)', dynamic: false }],
  hit: [{ site: 'FarmRoom.jsx:934 (killed branch)', dynamic: false }, { site: 'FarmRoom.jsx:1114 (hit branch)', dynamic: false }],
  faint: [{ site: 'FarmRoom.jsx:991', dynamic: false }],
  monsterAttack: [{ site: 'FarmRoom.jsx:1676', dynamic: false }],
  towerSentry: [{ site: "bloomwall.js:312 ('tower'+name)", dynamic: true }],
  towerBramble: [{ site: "bloomwall.js:312 ('tower'+name)", dynamic: true }],
  towerFrostbud: [{ site: "bloomwall.js:312 ('tower'+name)", dynamic: true }],
  towerSunspire: [{ site: "bloomwall.js:312 ('tower'+name)", dynamic: true }],
};
const EMOTES = ['Victory', 'Smile', 'Cry', 'Blush', 'Wink', 'Yawn', 'Sleep', 'Surprise', 'Angry', 'Merong', 'Kongi', 'Pish', 'Dance', 'Cold', 'HandToMouth'];
for (const e of EMOTES) CUE_CALL_SITES[e] = [{ site: 'FarmRoom.jsx:812 (doEmote, dynamic)', dynamic: true }];

export function callSitesFor(name) { return CUE_CALL_SITES[name] || []; }
export function isDynamicOnly(name) {
  const sites = CUE_CALL_SITES[name];
  return !!sites && sites.length > 0 && sites.every((s) => s.dynamic);
}

// ---- live tracker (game side: accumulate + flush) ----
const pending = new Map(); // module-level singleton — shared by every importer in this bundle

/** Call every time a cue actually plays (post mute/context gating). */
export function logPlay(name) {
  if (!name) return;
  pending.set(name, (pending.get(name) || 0) + 1);
}

/** Flushes the in-memory buffer as ONE batched RPC call. Never throws; on
 *  failure the deltas are put back so the next flush retries them (best-effort,
 *  not durable — a lost tab loses unflushed counts, which is fine for a
 *  "which cue to polish" signal, not a billing ledger). */
export async function flushUsage(client) {
  if (!client || typeof client.rpc !== 'function' || pending.size === 0) return { ok: false, reason: 'nothing-to-flush' };
  const deltas = Object.fromEntries(pending);
  pending.clear();
  try {
    const { error } = await client.rpc('sfx_log_plays', { deltas });
    if (error) throw error;
    return { ok: true, count: Object.keys(deltas).length };
  } catch (e) {
    for (const [k, v] of Object.entries(deltas)) pending.set(k, (pending.get(k) || 0) + v);
    return { ok: false, reason: e && e.message ? e.message : String(e) };
  }
}

/** HQ side — reads the aggregate. Never throws; offline/no-table → {}. */
export async function loadUsage(client) {
  try {
    if (!client || typeof client.rpc !== 'function') return {};
    const { data, error } = await client.rpc('audio_usage_active');
    if (error || !data) return {};
    return data; // { cueName: { play_count, last_played } }
  } catch {
    return {};
  }
}

/** HQ side — daily trend (Phase 4, needs migration_audio_usage_daily.sql).
 *  Never throws; missing migration/offline → null (distinct from an empty
 *  array, which would mean "the RPC works but there's no data yet"). */
export async function loadUsageTrend(client, days = 30) {
  try {
    if (!client || typeof client.rpc !== 'function') return null;
    const { data, error } = await client.rpc('audio_usage_trend', { p_days: days });
    if (error || !data) return null;
    return data; // [{ day, plays }, ...]
  } catch {
    return null;
  }
}
