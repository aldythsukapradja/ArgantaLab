// LashiraBloom side of the generative-music pipeline. On boot the game pulls
// the map themes Circle HQ's Music Forge published (→ hq_music_publish) and
// applies them into @arganta/audio's live ACTIVE_THEMES, so the ambient bed
// plays the operator's authored music per map — or the package default themes
// if nothing's been published yet. SAFE: never throws, never blocks the game.
import { bootMusic } from '@arganta/audio';
import { supabase } from './supabase.js';

let done = false;

/** Load + apply the active music themes. Call once at app start. */
export async function initMusic() {
  if (done) return { source: 'already' };
  done = true;
  try {
    const r = await bootMusic(supabase);
    console.info('[music]', r.source === 'cloud' ? 'applied HQ music themes' : 'using package themes', r.reason ? `(${r.reason})` : '');
    return r;
  } catch (e) {
    console.warn('[music] boot failed, using package themes:', e?.message || e);
    return { source: 'defaults', reason: 'boot-threw' };
  }
}
