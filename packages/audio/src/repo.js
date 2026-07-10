// Audio-library TRANSPORT — the wire between Circle HQ's Music Builder
// (publisher) and the game (consumer). Client-agnostic (takes a Supabase
// client), same never-throws-falls-back-to-defaults contract as
// @arganta/combat's tuningRepo.js. Needs supabase/migration_audio_library.sql
// run once — until then every read falls back to package defaults.

import { AUDIO_VERSION, validateAudioLibrary, applyAudioLibrary } from './recipes.js';

// HQ side — validates, then writes ONE active override row.
export async function publishAudioLibrary(client, override, meta = {}) {
  const v = validateAudioLibrary(override);
  if (!v.ok) throw new Error('Invalid audio library: ' + v.errors.join('; '));
  const payload = {
    v: AUDIO_VERSION,
    override,                      // only the cues the operator actually edited
    published_at: new Date().toISOString(),
    note: meta.note || '',
  };
  const { data, error } = await client.rpc('hq_audio_publish', { p_config: payload });
  if (error) throw error;
  return { ok: true, warnings: v.warnings, data };
}

// Game side — load the active override, merged over defaults. Never throws.
export async function loadActiveAudioLibrary(client) {
  try {
    if (!client || typeof client.rpc !== 'function') return fallback('no-client');
    const { data, error } = await client.rpc('audio_library_active');
    if (error || !data) return fallback(error ? 'rpc-error' : 'no-active');
    const version = Number(data.v ?? 0);
    if (version > AUDIO_VERSION) return fallback('newer-version');
    return { source: 'cloud', version, override: data.override || {} };
  } catch (e) {
    return fallback('exception:' + (e && e.message ? e.message : e));
  }
}
function fallback(reason) { return { source: 'defaults', version: AUDIO_VERSION, override: {}, reason }; }

// Game side convenience — load AND apply in one call, run once on boot.
export async function bootAudioLibrary(client) {
  const r = await loadActiveAudioLibrary(client);
  applyAudioLibrary(r.override);
  return r;
}
