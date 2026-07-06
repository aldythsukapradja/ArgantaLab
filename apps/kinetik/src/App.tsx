import { useEffect, useState } from 'react'
import { useUiStore } from '@store/uiStore'
import { useDataStore } from '@store/dataStore'
import { supabase } from '@lib/supabase'
import TopBar from '@components/layout/TopBar'
import Sidebar from '@components/layout/Sidebar'
import Nav from '@components/layout/Nav'
import DataBanner from '@components/DataBanner'
import Today from '@pages/Today'
import Calendar from '@pages/Calendar'
import Moments from '@pages/Moments'
import Apps from '@pages/Apps'
import Me from '@pages/Me'
import Login from '@pages/Login'
import Farm from '@pages/Farm'

export default function App() {
  const tab = useUiStore(s => s.tab)
  const activeCircleId = useUiStore(s => s.activeCircleId)
  const load = useDataStore(s => s.load)
  const status = useDataStore(s => s.status)
  const circles = useDataStore(s => s.circles)
  const [session, setSession] = useState<boolean | null>(null)

  // App-wide per-circle theming: the active circle's accent tints the whole
  // canvas (subtly) + every dot/active state, so you feel which circle you're in.
  const activeCircle = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const [c0, c1] = activeCircle?.accent ?? ['#F43F5E', '#FB7185']

  // Check auth on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(!!session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(!!sess)
    })
    return () => subscription?.unsubscribe()
  }, [])

  // Pull real data once on mount (cloud-first, cache fallback).
  useEffect(() => { if (session) load() }, [load, session])

  if (session === null) {
    return <div id="app" className="boot"><span className="boot-orb" /><p>Checking…</p></div>
  }

  if (!session) {
    return <Login />
  }

  const booting = status === 'loading' && circles.length === 0

  // Bloom: full-screen like ArgantaLab's Arena. Bottom Nav hides on mobile
  // (TopBar's pill stays visible as the way back). Sidebar stays MOUNTED on
  // desktop too (TopBar is CSS-hidden at desktop widths) — it switches to its
  // own minimal "way back" mode internally so desktop always has a return path.
  const farmOpen = tab === 'farm'

  return (
    <div id="app" style={{ ['--c0' as any]: c0, ['--c1' as any]: c1 }}>
      <Sidebar />
      <div className="app-body">
        <TopBar />
        {!farmOpen && <DataBanner />}
        <main className={farmOpen ? 'main main-farm' : 'main'} key={tab}>
          {farmOpen ? (
            <Farm />
          ) : booting ? (
            <div className="boot"><span className="boot-orb" /><p>Loading your circle…</p></div>
          ) : (
            <>
              {tab === 'today' && <Today />}
              {tab === 'calendar' && <Calendar />}
              {tab === 'moments' && <Moments />}
              {tab === 'apps' && <Apps />}
              {tab === 'me' && <Me />}
            </>
          )}
        </main>
        {!farmOpen && <Nav />}
      </div>
    </div>
  )
}
