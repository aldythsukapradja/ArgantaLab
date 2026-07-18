import { createClient } from '@supabase/supabase-js'

// Single Supabase client. `cloudReady` is true only when real keys
// are present — the app uses it to decide between live data and the
// offline cache. There is no placeholder "fake online" state.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const cloudReady =
  !!url && !!key && !url.includes('your-supabase') && !url.includes('placeholder')

// Embedded in Arganta Chat? (iframe + ?embed=<nonce>). If so, the PARENT owns the
// Supabase session: it pushes tokens in and re-pushes on every refresh. So this
// client must NOT auto-refresh (two clients refreshing one single-use refresh
// token race each other into a revoked session — K1 battle-test B1), must NOT
// persist (the parent re-sends on every mount, so a stale localStorage session
// only causes drift), and must NOT parse the URL for an OAuth redirect (it never
// does OAuth here). Standalone Kinetik keeps the library defaults, untouched.
const isEmbedded =
  typeof window !== 'undefined' &&
  window.top !== window.self &&
  new URLSearchParams(window.location.search).has('embed')

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder',
  isEmbedded
    ? { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
    : undefined,
)
