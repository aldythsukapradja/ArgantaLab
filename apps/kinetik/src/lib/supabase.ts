import { createClient } from '@supabase/supabase-js'

// Reuses ArgantaLab's Supabase project (same env-var names). Until real keys
// are present the client points at a placeholder and the app runs local-first.
const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabaseReady = !!url && !!key && !url.includes('your-supabase-url')

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder',
)
