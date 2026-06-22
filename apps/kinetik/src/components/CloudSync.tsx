import { useEffect, useRef } from 'react'
import { supabase, supabaseReady } from '@lib/supabase'
import { useAppStore } from '@store/appStore'
import { pullState, pushState } from '@lib/kinetikCloud'

// Best-effort cloud sync. Detects the Supabase session, pulls the owner's
// mirrored state on sign-in, and pushes local changes back (debounced).
// Entirely silent + non-blocking when offline or signed out.
export default function CloudSync() {
  const setSession = useAppStore(s => s.setSession)
  const hydrate = useAppStore(s => s.hydrateCloud)
  const session = useAppStore(s => s.session)
  const events = useAppStore(s => s.events)
  const moments = useAppStore(s => s.moments)
  const ready = useRef(false)

  useEffect(() => {
    if (!supabaseReady) { setSession(null); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (s && window.location.hash.includes('access_token')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }
    })
    return () => subscription.unsubscribe()
  }, [setSession])

  // On sign-in: pull cloud state into the local store.
  useEffect(() => {
    if (!session || session === 'loading') { ready.current = false; return }
    ready.current = false
    pullState(session.user.id).then(d => { if (d) hydrate(d); ready.current = true })
  }, [session, hydrate])

  // After hydration: mirror local changes up, debounced.
  useEffect(() => {
    if (!ready.current) return
    const s = useAppStore.getState().session
    if (!s || s === 'loading') return
    const uid = s.user.id
    const t = setTimeout(() => pushState(uid, { events, moments }), 800)
    return () => clearTimeout(t)
  }, [events, moments])

  return null
}
