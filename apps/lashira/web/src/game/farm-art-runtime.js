import { supabase, hasSupabase } from '../net/supabase.js';

const imageCache = new Map();
// Last set of overrides that loaded successfully. If a later refresh fails (DB
// blip, auth expiry), we return this instead of nothing, so live custom art
// never flashes back to placeholders on a transient error.
let lastGoodOverrides = null;

// EGRESS FIX: this used to pull every active override's full image_data
// (base64, can be large) on EVERY game boot — the dominant driver behind
// exceeding the Supabase free-tier egress quota, since it fires on every
// reload/session. Now a cheap metadata-only query (no bytes) builds a
// fingerprint of slot_key+updated_at; if it matches what THIS browser cached
// last time, we reuse the cached bytes instead of re-downloading them. Art
// changes rarely, so repeat loads pay almost nothing until something actually
// changes. localStorage write is best-effort (quota-safe, falls back to
// always-fetch if it can't persist).
const ART_CACHE_KEY = 'lashira_art_overrides_cache_v1';
function readArtCache() {
  try { return JSON.parse(localStorage.getItem(ART_CACHE_KEY) || 'null'); } catch { return null; }
}
function writeArtCache(fingerprint, rows) {
  try { localStorage.setItem(ART_CACHE_KEY, JSON.stringify({ fingerprint, rows })); } catch { /* quota — just re-fetches next time */ }
}

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

    // Cheap check first: which slots are active + when did they last change?
    // No image bytes travel here.
    const { data: meta, error: metaErr } = await supabase
      .from('lashira_pixel_art')
      .select('slot_key,status,updated_at')
      .not('image_data', 'is', null)
      .in('status', ['active', 'published', 'wired']);
    if (metaErr) throw metaErr;
    const metaRows = meta || [];
    if (!metaRows.length) { lastGoodOverrides = {}; writeArtCache('', []); return {}; } // legitimately no custom art → procedural
    const fingerprint = metaRows.map((r) => `${r.slot_key}:${r.updated_at}`).sort().join('|');

    const cached = readArtCache();
    let dataRows;
    if (cached && cached.fingerprint === fingerprint && Array.isArray(cached.rows)) {
      dataRows = cached.rows; // nothing changed since last time THIS browser fetched — reuse the bytes
    } else {
      const { data: full, error: fullErr } = await supabase
        .from('lashira_pixel_art')
        .select('slot_key,image_data,status')
        .not('image_data', 'is', null)
        .in('status', ['active', 'published', 'wired']);
      if (fullErr) throw fullErr;
      dataRows = full || [];
      writeArtCache(fingerprint, dataRows);
    }

    const pairs = await Promise.all(dataRows.map(async (row) => {
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

