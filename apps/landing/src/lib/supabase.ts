import { createClient } from '@supabase/supabase-js'

// The landing reuses the ArgantaLab Supabase project (same env var names as
// apps/web / apps/hq, so values paste straight in). When no real keys are wired
// the site runs in "public" mode: posters, modeled numbers, benchmark-forward
// "live soon" — never invented data.
const url = (import.meta.env.VITE_SUPABASE_URL as string) || ''
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || ''

const isPlaceholder = (s: string) =>
  !s || s.includes('your-project') || s.includes('your-anon') || s.includes('placeholder')

/** True only when a real Supabase project is wired. Gates operator login. */
export const cloudEnabled = !isPlaceholder(url) && !isPlaceholder(key)

export const supabase = createClient(
  isPlaceholder(url) ? 'https://placeholder.supabase.co' : url,
  isPlaceholder(key) ? 'placeholder-anon-key' : key,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
)
