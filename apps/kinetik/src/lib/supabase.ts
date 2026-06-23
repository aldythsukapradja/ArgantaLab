import { createClient } from '@supabase/supabase-js'

// Single Supabase client. `cloudReady` is true only when real keys
// are present — the app uses it to decide between live data and the
// offline cache. There is no placeholder "fake online" state.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const cloudReady =
  !!url && !!key && !url.includes('your-supabase') && !url.includes('placeholder')

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder',
)
