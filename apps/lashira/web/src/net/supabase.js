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
  // CRITICAL for multiplayer: an EMBEDDED game (KinetikCircle iframe) must NOT
  // persist its session to localStorage. Two farm windows in the SAME browser
  // profile are two same-origin iframes (localhost:5185) sharing localStorage —
  // with the default storageKey their Supabase sessions overwrite each other via
  // the cross-tab storage-sync listener, the realtime socket's auth token
  // thrashes, and presence silently dies ("0 live (solo)" on both). sessionStorage
  // is per-TAB, so each window keeps its own session and each realtime channel is
  // stable. Standalone keeps localStorage so a reload doesn't drop the login.
  let storage;
  if (typeof window !== 'undefined') {
    try {
      const embedded = !!new URLSearchParams(window.location.search).get('embed');
      storage = embedded ? window.sessionStorage : window.localStorage;
    } catch { /* SSR / no DOM — use SDK default */ }
  }
  try {
    return createClient(url, anon, {
      auth: { storageKey: 'lashira-auth', persistSession: true, ...(storage ? { storage } : {}) },
    });
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
