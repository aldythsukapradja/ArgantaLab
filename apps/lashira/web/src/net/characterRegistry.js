// LashiraBloom side of the character-appearance pipeline. On boot the game pulls
// the active registry Circle HQ published (Character Builder → hq_character_publish)
// and caches it, so the SHARED/default looks (the placeholder farmer, NPCs) are the
// operator's — or the @arganta/character package defaults if nothing's published.
//
// SAFE: never throws, never blocks the game. The resolver always returns a spec
// (package default until — and if ever — cloud loads), so a guest with no Kingdom
// hero still composites a real avatar instead of the procedural placeholder.
import { bootCharacterRegistry, mergeRegistry, specForPreset } from '@arganta/character';
import { supabase } from './supabase.js';

let active = mergeRegistry({}); // package defaults until the cloud registry loads
let done = false;

/** Load + cache the active character registry. Call once at app start. */
export async function initCharacterRegistry() {
  if (done) return { source: 'already' };
  done = true;
  try {
    const r = await bootCharacterRegistry(supabase); // reads the live client binding
    active = r.registry;
    console.info('[character] registry', r.source, r.reason ? `(${r.reason})` : '');
    return r;
  } catch (e) {
    console.warn('[character] registry boot failed, using defaults:', e?.message || e);
    return { source: 'defaults', reason: 'boot-threw' };
  }
}

/** The compositor spec for any preset id (never null — falls back to default-farmer). */
export function presetSpec(id) {
  return specForPreset(active, id);
}

/** The look used when the player has no Kingdom hero of their own. */
export function defaultFarmerSpec() {
  return specForPreset(active, 'default-farmer');
}
