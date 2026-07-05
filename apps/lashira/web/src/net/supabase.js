// Supabase client for LashiraBloom. Dual-mode, mirroring Kingdom Heroes:
//   • standalone  -> its OWN client + own login (Google / kid PIN / guest).
//   • embedded    -> the host app (ArgantaLab, Bloom Command, any ArgantaLab app)
//     injects its already-authed client via useHostSupabase(); the game reuses
//     the host session and never shows a login. This is the plug-and-play spine.
// `supabase` and `hasSupabase` are live ESM bindings, so every consumer picks up
// the injected client at call time.
import { createClient } from '@supabase/supabase-js';

function resolveUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let u = raw.trim().replace(/^['"]|['"]$/g, '');
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) { try { new URL(u); return u; } catch { return null; } }
  if (/\.supabase\.co$/i.test(u)) return 'https://' + u;
  if (/^[a-z0-9]{16,}$/i.test(u)) return `https://${u}.supabase.co`;
  return null;
}

const url = resolveUrl(import.meta.env.VITE_SUPABASE_URL);
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

function makeClient() {
  if (!url || !anon) return null;
  try {
    return createClient(url, anon, { auth: { storageKey: 'lashira-auth', persistSession: true } });
  } catch (err) {
    console.warn('LashiraBloom: Supabase disabled -', err?.message || err);
    return null;
  }
}

export let supabase = makeClient();
export let hasSupabase = !!supabase;

// Point the whole game at the host app's Supabase client (embed mode). Called
// before any auth/DB call so consumers read the injected client.
export function useHostSupabase(client) {
  if (client) { supabase = client; hasSupabase = true; }
  return supabase;
}
