import { supabase, hasSupabase } from '../net/supabase.js';

const imageCache = new Map();

function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (!imageCache.has(src)) {
    imageCache.set(src, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    }));
  }
  return imageCache.get(src);
}

export async function loadFarmArtOverrides() {
  if (!hasSupabase || !supabase) return {};
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return {};
    const { data, error } = await supabase
      .from('lashira_pixel_art')
      .select('slot_key,image_data,status')
      .not('image_data', 'is', null)
      .in('status', ['active', 'published', 'wired']);
    if (error || !data?.length) return {};
    const pairs = await Promise.all(data.map(async (row) => {
      const img = await loadImage(row.image_data);
      return img ? [row.slot_key, img] : null;
    }));
    return Object.fromEntries(pairs.filter(Boolean));
  } catch (err) {
    console.warn('[farm-art] overrides unavailable:', err?.message || err);
    return {};
  }
}

export function drawOverride(ctx, art, key, x, y, w, h) {
  const img = art?.[key];
  if (!img) return false;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x, y, w, h);
  return true;
}

