// Supabase client for LashiraBloom. Reuses the shared ArgantaLab project
// (identity, profiles, diamonds, xp). Returns null if config is missing so the
// game can still run fully in offline/guest mode.
import { createClient } from '@supabase/supabase-js';

function resolveUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let u = raw.trim().replace(/^['"]|['"]$/g, '');
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) {
    try { new URL(u); return u; } catch { return null; }
  }
  if (/\.supabase\.co$/i.test(u)) return 'https://' + u;
  if (/^[a-z0-9]{16,}$/i.test(u)) return `https://${u}.supabase.co`;
  return null;
}

const url = resolveUrl(import.meta.env.VITE_SUPABASE_URL);
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

let client = null;
if (url && anon) {
  try {
    client = createClient(url, anon, { auth: { storageKey: 'lashira-auth', persistSession: true } });
  } catch (err) {
    console.warn('LashiraBloom: Supabase disabled -', err?.message || err);
    client = null;
  }
} else {
  console.info('LashiraBloom: no Supabase config found - running in offline mode.');
}

export const supabase = client;
export const hasSupabase = !!client;
