// LashiraBloom side of the audio-library pipeline. On boot the game pulls the
// active SFX overrides Circle HQ published (Music Builder → hq_audio_publish)
// and APPLIES them into @arganta/audio's live SFX_RECIPES table, so sfx.js
// plays the operator's tuned cues — or the package defaults if nothing's
// published yet.
//
// SAFE: never throws, never blocks the game. If Supabase is absent, the
// migration isn't run, or the config is a newer version, the game silently
// uses defaults.
import { bootAudioLibrary } from '@arganta/audio';
import { supabase } from './supabase.js';

let done = false;

/** Load + apply the active audio library. Call once at app start. */
export async function initAudioLibrary() {
  if (done) return { source: 'already' };
  done = true;
  try {
    const r = await bootAudioLibrary(supabase);
    console.info('[audio]', r.source === 'cloud' ? 'applied HQ audio library' : 'using package defaults', r.reason ? `(${r.reason})` : '');
    return r;
  } catch (e) {
    console.warn('[audio] library boot failed, using defaults:', e?.message || e);
    return { source: 'defaults', reason: 'boot-threw' };
  }
}
