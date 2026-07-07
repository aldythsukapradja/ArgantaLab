import { supabase, hasSupabase } from '../net/supabase.js';

const imageCache = new Map();
// Last set of overrides that loaded successfully. If a later refresh fails (DB
// blip, auth expiry), we return this instead of nothing, so live custom art
// never flashes back to placeholders on a transient error.
let lastGoodOverrides = null;

function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (!imageCache.has(src)) {
    imageCache.set(src, new Promise((resolve) => {
      const img = new Image();
      // Only accept a genuinely decoded image — a corrupt / empty data-URL can
      // fire onload with 0 dimensions, which would draw nothing (or a broken
      // icon). Treating that as null makes the slot fall back to procedural art.
      img.onload = () => resolve((img.naturalWidth > 0 && img.naturalHeight > 0) ? img : null);
      img.onerror = () => resolve(null);
      img.decoding = 'async';
      img.src = src;
    }));
  }
  return imageCache.get(src);
}

export async function loadFarmArtOverrides() {
  if (!hasSupabase || !supabase) return {};
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return lastGoodOverrides || {};
    const { data, error } = await supabase
      .from('lashira_pixel_art')
      .select('slot_key,image_data,status')
      .not('image_data', 'is', null)
      .in('status', ['active', 'published', 'wired']);
    if (error) throw error;
    if (!data?.length) { lastGoodOverrides = {}; return {}; } // legitimately no custom art → procedural
    const pairs = await Promise.all(data.map(async (row) => {
      const img = await loadImage(row.image_data);
      return img ? [row.slot_key, img] : null; // per-slot fallback: a bad image just drops that one slot
    }));
    const overrides = Object.fromEntries(pairs.filter(Boolean));
    lastGoodOverrides = overrides;
    return overrides;
  } catch (err) {
    console.warn('[farm-art] overrides unavailable, keeping last-good/procedural:', err?.message || err);
    return lastGoodOverrides || {};
  }
}

export function drawOverride(ctx, art, key, x, y, w, h) {
  const img = art?.[key];
  if (!img) return false; // no override for this slot → caller draws its procedural fallback
  try {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, x, y, w, h);
    return true;
  } catch {
    return false; // any draw error (e.g. tainted/incomplete image) → procedural fallback
  }
}

