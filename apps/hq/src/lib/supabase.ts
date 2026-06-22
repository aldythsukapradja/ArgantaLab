import { createClient } from '@supabase/supabase-js'

// Circle HQ reuses the ArgantaLab Supabase project. Same env var names so the
// values from apps/web/.env.local paste straight in.
const url = (import.meta.env.VITE_SUPABASE_URL as string) || ''
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || ''

const isPlaceholder = (s: string) =>
  !s || s.includes('your-project') || s.includes('your-anon') || s.includes('placeholder')

/** True only when a real Supabase project is wired up. When false the app runs
 *  in offline mode — it shows the polished shell and honest empty states, and
 *  never invents data. */
export const cloudEnabled = !isPlaceholder(url) && !isPlaceholder(key)

export const supabase = createClient(
  isPlaceholder(url) ? 'https://placeholder.supabase.co' : url,
  isPlaceholder(key) ? 'placeholder-anon-key' : key,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
)
