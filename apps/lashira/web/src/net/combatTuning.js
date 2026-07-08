// LashiraBloom side of the combat-tuning pipeline. On boot the game pulls the
// active tuning Circle HQ published (Battle Builder → hq_combat_publish) and
// APPLIES it into the shared @arganta/combat objects, so every damage number the
// game reads is the operator's — or the package defaults if nothing's published.
//
// SAFE: never throws, never blocks the game. If Supabase is absent, the migration
// isn't run, or the config is a newer version, the game silently uses defaults.
import { bootCombatTuning } from '@arganta/combat';
import { supabase } from './supabase.js';

let done = false;

/** Load + apply the active combat tuning. Call once at app start. Returns the
 *  source ('cloud' | 'defaults') so the HUD/console can show provenance. */
export async function initCombatTuning() {
  if (done) return { source: 'already' };
  done = true;
  try {
    const r = await bootCombatTuning(supabase); // reads the live client binding
    if (r.source === 'cloud') {
      console.info('[combat] applied HQ tuning', r.fairness ? `(fairness ${r.fairness.score})` : '');
    } else {
      console.info('[combat] using package defaults', r.reason ? `(${r.reason})` : '');
    }
    return r;
  } catch (e) {
    console.warn('[combat] tuning boot failed, using defaults:', e?.message || e);
    return { source: 'defaults', reason: 'boot-threw' };
  }
}
