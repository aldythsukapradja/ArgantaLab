import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { supabase } from '@lib/supabase'
import { syncProfileOnLogin, saveProfile } from '@lib/profile'
import { pullGames } from '@lib/gamesCloud'
import { replaceWithCloud, setGamesOwner } from '@lib/myGames'
import { pullLearnState } from '@lib/learnCloud'
import { TopBar } from '@components/layout/TopBar'
import { ConceptDrawer } from '@components/layout/ConceptDrawer'
import Sidebar from '@components/layout/Sidebar'
import Dock from '@components/layout/Dock'
import GameModal from '@components/games/GameModal'
import BackgroundScene from '@components/three/BackgroundScene'
import AuthWall from '@components/auth/AuthWall'
import { MOBILE_TABS, NAV, WORLD_TABS } from '@/data'
import PlayHome from '@/pages/PlayHome'
import Wizard from '@/pages/Wizard'
import BuilderLab from '@/pages/BuilderLab'
import PitchBuilder from '@/pages/PitchBuilder'
import Shop from '@/pages/Shop'
import Discover from '@/pages/Discover'
import MyGameStore from '@/pages/MyGameStore'
import Avatar from '@/pages/Avatar'
import Fame from '@/pages/Fame'
import Profile from '@/pages/Profile'
import Parent from '@/pages/Parent'
import Quests from '@/pages/Quests'
import LearnHub from '@/pages/LearnHub'
import World from '@/pages/World'
import AdminStudio from '@/pages/admin/AdminStudio'
import PlayPage from '@/pages/PlayPage'
import '@/styles/globals.css'
import '@/styles/v2.css'

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
  const unlocks = useAppStore(s => s.unlocks)
  const learnerName = useAppStore(s => s.learnerName)

  // On login: pull the cloud profile, merge guest progress, hydrate the store,
  // and pull the user's saved games into local storage.
  useEffect(() => {
    if (!session || session === 'loading') {
      userIdRef.current = null; setReady(false)
      setGamesOwner(null)   // back to the guest bucket on logout
      return
    }
    const uid = session.user.id
    if (userIdRef.current === uid) return
    userIdRef.current = uid
    setReady(false)
    setGamesOwner(uid)      // switch to this user's own games bucket
    const st = useAppStore.getState()
    syncProfileOnLogin(session, {
      learnerName: st.learnerName, xp: st.xp, level: st.level, diamonds: st.diamonds,
      completedLessons: st.completedLessons, badges: st.badges, gamesPlayed: st.gamesPlayed, unlocks: st.unlocks,
    }).then(p => { if (p) hydrate(p); setReady(true) })
    // Replace the local view with exactly this user's cloud games.
    pullGames(uid).then(g => replaceWithCloud(g ?? []))
    // Merge cloud learn progress (rings, mastery, node completion) into local.
    pullLearnState(uid)
  }, [session, hydrate])

  // After load: push progress changes back to the cloud, debounced.
  useEffect(() => {
    if (!ready) return
    const uid = userIdRef.current
    if (!uid) return
    const t = setTimeout(() => {
      saveProfile(uid, {
        display_name: learnerName, xp, level, diamonds,
        completed_lessons: completedLessons, badges, games_played: gamesPlayed, unlocks,
      })
    }, 800)
    return () => clearTimeout(t)
  }, [ready, xp, level, diamonds, completedLessons, badges, gamesPlayed, unlocks, learnerName])

  return null
}

/** Mobile-only centre pills for switching sub-tabs within a grouped tab
 *  (Learn = Web/Data/AI, Build = Wizard/Lab). Hidden on desktop & in lessons. */
function MobileSubTabs() {
  const { activeTab, go } = useAppStore()
  const group = MOBILE_TABS.find(g => g.members.includes(activeTab))
  if (!group || !group.pills || group.pills.length < 2) return null
  return (
    <div className="msub">
      {group.pills.map(m => {
        const item = NAV.find(n => n.tab === m)
        return (
          <button key={m} className={`msub-pill${activeTab === m ? ' on' : ''}`} onClick={() => go({ tab: m })}>
            {item?.short ?? item?.label}
          </button>
        )
      })}
    </div>
  )
}

function PageContent({ tab }: { tab: string }) {
  if (WORLD_TABS.includes(tab)) return <World tab={tab} />
  if (tab === 'learn') return <LearnHub />
  if (tab === 'studio') return <Wizard />
  if (tab === 'lab') return <BuilderLab />
  if (tab === 'pitch') return <PitchBuilder />
  if (tab === 'shop') return <Shop />
  if (tab === 'discover') return <Discover />
  if (tab === 'gamestore') return <MyGameStore />
  if (tab === 'avatar') return <Avatar />
  if (tab === 'fame') return <Fame />
  if (tab === 'profile') return <Profile />
  if (tab === 'parent') return <Parent />
  if (tab === 'quests') return <Quests />
  if (tab === 'admin') return <AdminStudio />
  return <PlayHome />
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
      <MobileSubTabs />

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

  // Public share route — a standalone player with no app chrome or login.
  const path = window.location.pathname
  if (path.startsWith('/play/')) {
    return <PlayPage id={decodeURIComponent(path.slice('/play/'.length))} />
  }

  // The app is always browseable as a guest. The login wall (AuthWall) only
  // appears when a guest triggers a gated action (play / learn / build).
  return <AppShell />
}

export default App
