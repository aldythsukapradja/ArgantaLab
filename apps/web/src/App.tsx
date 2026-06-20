import { useEffect, useMemo } from 'react'
import { useAppStore } from '@store/appStore'
import { TopBar } from '@components/layout/TopBar'
import { ConceptDrawer } from '@components/layout/ConceptDrawer'
import Sidebar from '@components/layout/Sidebar'
import Dock from '@components/layout/Dock'
import GameModal from '@components/games/GameModal'
import BackgroundScene from '@components/three/BackgroundScene'
import Home from '@/pages/Home'
import Learn from '@/pages/Learn'
import Studio from '@/pages/Studio'
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

function PageContent({ tab }: { tab: string }) {
  if (tab === 'arganta') return <Home />
  if (tab === 'studio') return <Studio />
  return <Learn tab={tab} />
}

function App() {
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
      <BadgeModal />
      <Toasts />
    </div>
  )
}

export default App
