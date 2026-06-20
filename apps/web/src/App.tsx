import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { supabase } from '@lib/supabase'
import { syncProfileOnLogin, saveProfile } from '@lib/profile'
import { TopBar } from '@components/layout/TopBar'
import { ConceptDrawer } from '@components/layout/ConceptDrawer'
import Sidebar from '@components/layout/Sidebar'
import Dock from '@components/layout/Dock'
import GameModal from '@components/games/GameModal'
import BackgroundScene from '@components/three/BackgroundScene'
import AuthWall from '@components/auth/AuthWall'
import Home from '@/pages/Home'
import Learn from '@/pages/Learn'
import Wizard from '@/pages/Wizard'
import '@/styles/globals.css'

const CONFETTI_COLORS = ['#4D9FFF','#8B5CF6','#FF5EA0','#3DE08A','#FFC24B','#34E5FF']

function Confetti() {
  const count = 60
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${Math.random() * 100}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${Math.random() * 1.2}s`,
            animationDuration: `${2 + Math.random() * 1.4}s`,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
    </div>
  )
}

function BadgeModal() {
  const { pendingBadge, badges, clearBadge, clearConfetti, showConfetti } = useAppStore()
  if (!pendingBadge) return null
  return (
    <>
      {showConfetti && <Confetti />}
      <div className="overlay" onClick={() => { clearBadge(); clearConfetti() }}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="badge-art">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>
          </div>
          <h3>Badge Unlocked!</h3>
          <p className="sub">You earned a new badge:</p>
          <div className="bname">{pendingBadge}</div>
          <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 18 }}>Total badges: {badges.length}</p>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { clearBadge(); clearConfetti() }}>
            Awesome! 🎉
          </button>
        </div>
      </div>
    </>
  )
}

function WizardGameModal() {
  const { playGameHtml, playGameTitle, closeWizardGame } = useAppStore()
  if (!playGameHtml) return null
  return (
    <div className="wgm">
      <div className="wgm-bar">
        <b>{playGameTitle}</b>
        <button className="wgm-x" onClick={closeWizardGame} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <iframe className="wgm-frame" title={playGameTitle} srcDoc={playGameHtml} sandbox="allow-scripts allow-pointer-lock" />
    </div>
  )
}

function Toasts() {
  const { toasts } = useAppStore()
  if (!toasts.length) return null
  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className="toast">
          {t.emoji && <span className="e">{t.emoji}</span>}
          {t.msg}
        </div>
      ))}
    </div>
  )
}

/** Loads the cloud profile on login and saves progress changes (debounced).
 *  No-ops gracefully when the Supabase backend isn't set up yet. */
function CloudSync() {
  const session = useAppStore(s => s.session)
  const hydrate = useAppStore(s => s.hydrateFromCloud)
  const [ready, setReady] = useState(false)
  const userIdRef = useRef<string | null>(null)

  const xp = useAppStore(s => s.xp)
  const level = useAppStore(s => s.level)
  const diamonds = useAppStore(s => s.diamonds)
  const completedLessons = useAppStore(s => s.completedLessons)
  const badges = useAppStore(s => s.badges)
  const gamesPlayed = useAppStore(s => s.gamesPlayed)
  const learnerName = useAppStore(s => s.learnerName)

  // On login: pull the cloud profile, merge guest progress, hydrate the store.
  useEffect(() => {
    if (!session || session === 'loading') { userIdRef.current = null; setReady(false); return }
    const uid = session.user.id
    if (userIdRef.current === uid) return
    userIdRef.current = uid
    setReady(false)
    const st = useAppStore.getState()
    syncProfileOnLogin(session, {
      learnerName: st.learnerName, xp: st.xp, level: st.level, diamonds: st.diamonds,
      completedLessons: st.completedLessons, badges: st.badges, gamesPlayed: st.gamesPlayed,
    }).then(p => { if (p) hydrate(p); setReady(true) })
  }, [session, hydrate])

  // After load: push progress changes back to the cloud, debounced.
  useEffect(() => {
    if (!ready) return
    const uid = userIdRef.current
    if (!uid) return
    const t = setTimeout(() => {
      saveProfile(uid, {
        display_name: learnerName, xp, level, diamonds,
        completed_lessons: completedLessons, badges, games_played: gamesPlayed,
      })
    }, 800)
    return () => clearTimeout(t)
  }, [ready, xp, level, diamonds, completedLessons, badges, gamesPlayed, learnerName])

  return null
}

function PageContent({ tab }: { tab: string }) {
  if (tab === 'arganta') return <Home />
  if (tab === 'studio') return <Wizard />
  return <Learn tab={tab} />
}

function AppShell() {
  const { theme, activeTab, lastTab } = useAppStore()
  const tab = activeTab || lastTab || 'arganta'

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <div id="app">
      <div className="bg-canvas">
        <BackgroundScene tab={tab} />
      </div>
      <div className="scrim" />

      <TopBar />

      <div className="shell">
        <Sidebar />
        <main className="main">
          <div className="main-inner">
            <PageContent tab={tab} />
          </div>
        </main>
      </div>

      <Dock />
      <ConceptDrawer />
      <GameModal />
      <WizardGameModal />
      <BadgeModal />
      <Toasts />
      <AuthWall />
      <CloudSync />
    </div>
  )
}

function App() {
  const setSession = useAppStore(s => s.setSession)
  const closeAuthWall = useAppStore(s => s.closeAuthWall)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s) {
        closeAuthWall() // signed in → dismiss any open login wall
        // strip the #access_token=… fragment Supabase appends after OAuth
        if (window.location.hash.includes('access_token')) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search)
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [setSession, closeAuthWall])

  // The app is always browseable as a guest. The login wall (AuthWall) only
  // appears when a guest triggers a gated action (play / learn / build).
  return <AppShell />
}

export default App
