import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, cloudEnabled } from './supabase'

// offline  = no Supabase keys (dev preview) → shell renders, data is empty
// loading  = checking the session / operator role
// anon     = no session → show Login
// denied   = signed in but profiles.role is not operator/admin
// operator = full access
export type AuthState = 'offline' | 'loading' | 'anon' | 'denied' | 'operator'

export function useAuth() {
  const [state, setState] = useState<AuthState>(cloudEnabled ? 'loading' : 'offline')
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    if (!cloudEnabled) { setState('offline'); return }
    let active = true

    async function resolve(s: Session | null) {
      if (!active) return
      setSession(s)
      if (!s) { setState('anon'); return }
      const { data, error } = await supabase.rpc('hq_is_operator')
      if (!active) return
      setState(error ? 'denied' : data === true ? 'operator' : 'denied')
    }

    supabase.auth.getSession().then(({ data }) => resolve(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => resolve(s))
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [])

  return { state, session }
}

export async function signInWithGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
}

export async function signOut() {
  await supabase.auth.signOut()
}
