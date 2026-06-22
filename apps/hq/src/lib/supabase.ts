import { createClient } from '@supabase/supabase-js'

// Reuses the ArgantaLab Supabase project. Same env var names so the same
// values from ArgantaLab's .env.local can be pasted straight in.
const url = (import.meta.env.VITE_SUPABASE_URL as string) || ''
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || ''

const isPlaceholder = (s: string) =>
  !s || s.includes('your-project') || s.includes('your-anon') || s.includes('placeholder')

/** True only when a REAL Supabase project is wired up. Until then Circle HQ
 *  runs entirely on the mock data source so dev never breaks. */
export const cloudEnabled = !isPlaceholder(url) && !isPlaceholder(key)

export const supabase = createClient(
  isPlaceholder(url) ? 'https://placeholder.supabase.co' : url,
  isPlaceholder(key) ? 'placeholder' : key,
)
