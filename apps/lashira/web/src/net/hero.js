// Kingdom Heroes integration for LashiraBloom.
// The farmer avatar IS the player's Kingdom Heroes character: we read its
// loadout spec via kingdom_get_player_state(), load the DSC part sheets from the
// Kingdom host art (VITE_KINGDOM_DATA_BASE), and hand them to the shared
// compositor. Rank ladder mirrors ArgantaLab's so the crest matches.
import { supabase, hasSupabase } from './supabase.js';
import * as data from '../engine/data.js';
import { loadImage } from '../engine/data.js';

export const RANK_TIERS = [
  { name: 'Spark', color: '#f0a83a', glyph: '✦', at: 0 },
  { name: 'Explorer', color: '#5ec257', glyph: '❖', at: 5000 },
  { name: 'Adventurer', color: '#37a8c4', glyph: '✧', at: 15000 },
  { name: 'Maker', color: '#7a4fd0', glyph: '✶', at: 40000 },
  { name: 'Sage', color: '#d9a520', glyph: '★', at: 85000 },
  { name: 'Luminary', color: '#d4476b', glyph: '✷', at: 160000 },
];
export function computeRank(xp) {
  const p = Math.max(0, Number(xp) || 0);
  let idx = 0;
  for (let i = 0; i < RANK_TIERS.length; i++) if (p >= RANK_TIERS[i].at) idx = i;
  const t = RANK_TIERS[idx];
  return { index: idx, glyph: t.glyph, name: t.name, color: t.color };
}

// Calls the shared kingdom RPC to get the player's character + loadout. Returns
// null on any failure (offline/guest/no-migration) so the caller can gate/fallback.
export async function fetchHeroState() {
  if (!hasSupabase) return null;
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return null;
    const { data: state, error } = await supabase.rpc('kingdom_get_player_state');
    if (error) throw error;
    if (!state) return null;
    const loadout = state.loadout || {};
    const spec = loadout.syncedSpec || loadout.draftSpec || state.character?.spec || null;
    return {
      profile: state.profile || null,
      character: state.character || null,     // null => hasn't built a hero yet
      spec,                                    // compositor loadout
      stats: state.stats || null,
      guardian: state.guardian || null,
    };
  } catch (err) {
    console.warn('[hero] player-state unavailable:', err?.message || err);
    return null;
  }
}

// Turn a character spec into drawable sheets for the compositor. Mirrors
// Kingdom's TestRoom.loadPlayerResources. Any part that fails to load is simply
// skipped (never throws) so a partial avatar still renders.
export async function loadPlayerResources(spec) {
  const out = {};
  if (!spec) return out;
  const keys = ['body', 'coat', 'face', 'hair', 'helmet', 'weapon', 'shield', 'mantle', 'shoes', 'neck', 'facedec', 'hairdec', 'emotion'];
  await Promise.all(keys.map(async (key) => {
    try {
      // 'emotion' (Layer.tbl slot 3, paired with face's slot 2) carries the
      // actual visual for 13 of the 15 emotes — face itself only differs for
      // Victory/HandToMouth. It's the SAME part-id count as face (39/39) and
      // is never independently chosen, so no saved spec ever sets it — derive
      // it from whichever face is equipped instead of reading it verbatim.
      const sel = key === 'emotion'
        ? (spec.emotion || (spec.face ? { cat: 'emotion', id: spec.face.id, palette: null } : null))
        : spec[key];
      if (!sel || sel.id == null) return;
      const cat = sel.cat || key;
      const parts = await data.charParts(cat);
      const part = parts.find((p) => p.id === sel.id);
      if (!part?.sheet) return;
      let sheet;
      if (sel.palette != null && sel.palette !== part.palette_id && part.idx_sheet) {
        const { tintedSheet } = await import('../engine/palettes.js');
        const palettes = await data.charPalettes(cat);
        sheet = await tintedSheet(loadImage(data.idxSheetUrl(cat, part)), palettes[sel.palette] || palettes[0], `${cat}:${part.id}:${sel.palette}`);
      } else {
        sheet = await loadImage(data.sheetUrl(cat, part));
      }
      out[key] = { part, sheet };
    } catch (err) {
      /* skip this part */
    }
  }));
  try {
    if (spec.mount?.id != null) {
      const all = await data.mounts();
      const creature = all[spec.mount.id];
      if (creature?.sheet) out.mount = { creature, sheet: await loadImage(data.mountSheetUrl(creature)) };
    }
  } catch (err) { /* no mount */ }
  return out;
}

// Load the motion/layer tables the compositor needs. Returns null if the art
// host is unreachable (triggers the placeholder-farmer fallback).
export async function loadMotionTables() {
  try { return await data.motionTables(); }
  catch (err) { console.warn('[hero] motion tables unavailable:', err?.message || err); return null; }
}
