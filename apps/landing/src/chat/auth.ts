// Parent gate. Arganta Chat is a parents-only app — kids are hard-blocked three
// ways (F1 §6, audit A4): no kids UI, this runtime signout, and RLS on the
// server. The synthetic kid-email domain is the same one apps/kinetik and
// apps/web mint kid accounts under.
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, cloudEnabled } from '../lib/supabase'

export const KID_DOMAIN = 'kids.argantalab.app'
export const isKidEmail = (email?: string | null) => !!email && email.toLowerCase().endsWith('@' + KID_DOMAIN)

// public  = signed out (About is still reachable; Chat is not)
// loading = resolving the session
// parent  = a real adult account — Chat unlocked
// kid     = a kid account slipped in → we sign them out and show the friendly wall
export type GateState = 'public' | 'loading' | 'parent' | 'kid'

export interface Gate {
  state: GateState
  session: Session | null
  name: string
  kidName: string
}

function firstName(session: Session | null): string {
  const meta = session?.user?.user_metadata as Record<string, unknown> | undefined
  const full = (meta?.full_name || meta?.name || '') as string
  const first = full.trim().split(/\s+/)[0]
  if (first) return first
  const email = session?.user?.email || ''
  return email ? email.split('@')[0] : 'there'
}

export function useGate(): Gate {
  const [state, setState] = useState<GateState>(cloudEnabled ? 'loading' : 'public')
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    // Dev-only: with no cloud keys wired, open the app as a demo parent so the
    // whole experience is explorable locally. Production bundles (import.meta.env.DEV
    // === false) always fall through to the real gate — never a bypass in prod.
    if (!cloudEnabled) { setState(import.meta.env.DEV ? 'parent' : 'public'); return }
    let active = true

    async function resolve(s: Session | null) {
      if (!active) return
      setSession(s)
      if (!s) { setState('public'); return }
      if (isKidEmail(s.user?.email)) {
        // A child must never reach the chat. Show the wall first, then release
        // the session so they land back on a signed-out state, not a loop.
        setState('kid')
        setTimeout(() => { supabase.auth.signOut() }, 2500)
        return
      }
      setState('parent')
    }

    supabase.auth.getSession().then(({ data }) => resolve(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => resolve(s))
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [])

  return { state, session, name: firstName(session), kidName: firstName(session) }
}

export async function signInWithGoogle() {
  await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
}
export async function signOut() { await supabase.auth.signOut() }
