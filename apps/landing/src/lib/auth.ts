import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, cloudEnabled } from './supabase'

// The landing's auth mirrors Circle HQ exactly (same Supabase project, same
// operator gate) so the founder signs in once and unlocks: live pitch data on
// the real hq_* path, the operator-only Command tab, and live app embeds.
//
// public   = no keys, or signed out → posters + modeled numbers + hq_public_pitch
// loading  = checking session / operator role
// operator = profiles.role ∈ (operator, admin) → live everything
// denied   = signed in but not an operator (rare; the ◆ button just closes)
export type AuthState = 'public' | 'loading' | 'operator' | 'denied'

export function useAuth() {
  const [state, setState] = useState<AuthState>('public')
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    if (!cloudEnabled) { setState('public'); return }
    let active = true

    async function resolve(s: Session | null) {
      if (!active) return
      setSession(s)
      if (!s) { setState('public'); return }
      setState('loading')
      const { data, error } = await supabase.rpc('hq_is_operator')
      if (!active) return
      setState(!error && data === true ? 'operator' : 'denied')
    }

    supabase.auth.getSession().then(({ data }) => resolve(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => resolve(s))
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [])

  return { state, session, isOperator: state === 'operator' }
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
