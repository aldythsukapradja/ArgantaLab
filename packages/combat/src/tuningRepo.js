// Combat tuning TRANSPORT — the wire between Circle HQ (publisher) and the game
// (consumer). Both apps import this; neither owns the numbers (tuning.js does).
//
// Client-agnostic: every function takes a Supabase client (`.rpc(...)`), so the
// same code runs in HQ, in LashiraBloom, and in the test harness with a mock.
// SAFE BY DESIGN: any failure on the read path falls back to package defaults so
// the game can never brick on a bad/absent/newer override.

import { TUNING_VERSION, COMBAT_DEFAULTS, mergeTuning, validateTuning, applyTuning, fairnessSummary } from './tuning.js';

// HQ side — the "single button to set them all". Validates, computes the fairness
// summary, and writes ONE active config row. Returns the fairness it published.
export async function publishTuning(client, override, meta = {}) {
  const v = validateTuning(override);
  if (!v.ok) throw new Error('Invalid tuning: ' + v.errors.join('; '));
  const effective = mergeTuning(override);
  const fairness = fairnessSummary(effective, { level: meta.level || 10, samples: meta.samples || 400 });
  const payload = {
    v: TUNING_VERSION,
    override,                         // the operator's deltas (small, human-diffable)
    fairness: { score: fairness.score, rms: fairness.rms, perPath: fairness.perPath, worst: fairness.worst },
    published_at: new Date().toISOString(),
    note: meta.note || '',
  };
  const { data, error } = await client.rpc('hq_combat_publish', { p_config: payload, p_score: fairness.score });
  if (error) throw error;
  return { ok: true, fairness, warnings: v.warnings, data };
}

// Game side — load the active config, merged over defaults. Never throws.
export async function loadActiveTuning(client) {
  try {
    if (!client || typeof client.rpc !== 'function') return fallback('no-client');
    const { data, error } = await client.rpc('combat_tuning_active');
    if (error || !data) return fallback(error ? 'rpc-error' : 'no-active');
    const version = Number(data.v ?? data.version ?? 0);
    if (version > TUNING_VERSION) return fallback('newer-version'); // forward-compat: ignore what we can't read
    return { source: 'cloud', version, config: mergeTuning(data.override || {}), fairness: data.fairness || null };
  } catch (e) {
    return fallback('exception:' + (e && e.message ? e.message : e));
  }
}
function fallback(reason) {
  return { source: 'defaults', version: TUNING_VERSION, config: mergeTuning({}), reason };
}

// Game side convenience — load AND apply in one call (the game runs this on boot).
// After this resolves, PATH_POWER / PVP_PROFILE / PVP_TUNING / BESTIARY hold the
// operator's numbers (or defaults). Idempotent + safe to call repeatedly.
export async function bootCombatTuning(client) {
  const r = await loadActiveTuning(client);
  applyTuning(r.config);
  return r;
}

export { COMBAT_DEFAULTS };
