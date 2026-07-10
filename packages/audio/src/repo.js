// Audio-library TRANSPORT — the wire between Circle HQ's Music Builder
// (publisher) and the game (consumer). Client-agnostic (takes a Supabase
// client), same never-throws-falls-back-to-defaults contract as
// @arganta/combat's tuningRepo.js. Needs supabase/migration_audio_library.sql
// run once — until then every read falls back to package defaults.

import { AUDIO_VERSION, validateAudioLibrary, applyAudioLibrary } from './recipes.js';
import { MUSIC_VERSION, validateMusicThemes, applyMusicThemes } from './music.js';

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

// ============================================================================
// MUSIC library — the generative-music twin of the SFX library above. Its own
// table (music_library) so an SFX publish and a MUSIC publish never clobber
// each other. Config is a { realm: themeOverride } map — publishing routes a
// theme straight to a map (scalable: any realm key works). Needs
// supabase/migration_music_library.sql run once; falls back to package themes.

// HQ side — validates then writes ONE active music row.
export async function publishMusicLibrary(client, over, meta = {}) {
  const v = validateMusicThemes(over);
  if (!v.ok) throw new Error('Invalid music themes: ' + v.errors.join('; '));
  const payload = { v: MUSIC_VERSION, music: over, published_at: new Date().toISOString(), note: meta.note || '' };
  const { data, error } = await client.rpc('hq_music_publish', { p_config: payload });
  if (error) throw error;
  return { ok: true, warnings: v.warnings, data };
}
// Game/HQ side — load the active music overrides. Never throws.
export async function loadActiveMusic(client) {
  try {
    if (!client || typeof client.rpc !== 'function') return musicFallback('no-client');
    const { data, error } = await client.rpc('music_library_active');
    if (error || !data) return musicFallback(error ? 'rpc-error' : 'no-active');
    const version = Number(data.v ?? 0);
    if (version > MUSIC_VERSION) return musicFallback('newer-version');
    return { source: 'cloud', version, music: data.music || {} };
  } catch (e) {
    return musicFallback('exception:' + (e && e.message ? e.message : e));
  }
}
function musicFallback(reason) { return { source: 'defaults', version: MUSIC_VERSION, music: {}, reason }; }

// Game side convenience — load + apply the published themes into ACTIVE_THEMES.
export async function bootMusic(client) {
  const r = await loadActiveMusic(client);
  applyMusicThemes(r.music);
  return r;
}
