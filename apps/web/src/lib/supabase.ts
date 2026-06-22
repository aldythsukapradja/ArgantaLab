import { createClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string) || ''
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || ''

// Placeholder values (copied from .env.example) don't count as configured.
const isPlaceholder = (s: string) =>
  !s || s.includes('your-project') || s.includes('your-anon') || s.includes('placeholder')

export const supabaseMisconfigured = isPlaceholder(url) || isPlaceholder(key)

/** True only when a REAL Supabase project is wired up. Cloud features key off this;
 *  until it's true the app degrades to the local cache so dev never breaks. */
export const cloudEnabled = !supabaseMisconfigured

export const supabase = createClient(
  isPlaceholder(url) ? 'https://placeholder.supabase.co' : url,
  isPlaceholder(key) ? 'placeholder' : key,
)
