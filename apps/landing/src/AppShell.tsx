import { lazy, Suspense, useEffect, useRef, type ReactElement } from 'react'
import { ThemeToggle, useTheme } from './theme'
import { Home, Products, Company, Pitch, type Tab } from './appscreens'

const HubBg = lazy(() => import('./three/HubBg'))

function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2.3" />
      <circle cx="16" cy="8" r="2.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}

// tab icons
const IC: Record<Tab, ReactElement> = {
  home: <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>,
  products: <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>,
  company: <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2.4" /><circle cx="5" cy="19" r="2.4" /><circle cx="19" cy="19" r="2.4" /><path d="M12 7.4V13M12 13H5.6a1 1 0 0 0-1 1v2.6M12 13h6.4a1 1 0 0 1 1 1v2.6" /></svg>,
  pitch: <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8" /><path d="M21 7v5M21 7h-5" /></svg>,
}
const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'products', label: 'Products' },
  { id: 'company', label: 'Company' },
  { id: 'pitch', label: 'Pitch' },
]

export default function AppShell({ tab, onTab, onLaunch }: { tab: Tab; onTab: (t: Tab) => void; onLaunch: (d: string, present: boolean) => void }) {
  const { dark } = useTheme()
  const contentRef = useRef<HTMLDivElement>(null)
  useEffect(() => { contentRef.current?.scrollTo({ top: 0, behavior: 'auto' }) }, [tab])

  return (
    <div className="appx">
      <Suspense fallback={null}><HubBg dark={dark} /></Suspense>

      <header className="appx-top">
        <button className="appx-brand" onClick={() => onTab('home')}><Mark /> Arganta</button>
        <nav className="appx-topnav">
          {TABS.map(t => (
            <button key={t.id} className={`appx-topnav-t${tab === t.id ? ' on' : ''}`} onClick={() => onTab(t.id)}>{t.label}</button>
          ))}
        </nav>
        <ThemeToggle />
      </header>

      <main className="appx-content" ref={contentRef}>
        <div className="appx-screen" key={tab}>
          {tab === 'home' && <Home onLaunch={onLaunch} onTab={onTab} />}
          {tab === 'products' && <Products onLaunch={onLaunch} />}
          {tab === 'company' && <Company />}
          {tab === 'pitch' && <Pitch onLaunch={onLaunch} />}
        </div>
      </main>

      <nav className="appx-tabbar">
        {TABS.map(t => (
          <button key={t.id} className={`appx-tab${tab === t.id ? ' on' : ''}`} onClick={() => onTab(t.id)} aria-label={t.label}>
            <span className="appx-tab-ic">{IC[t.id]}</span>
            <span className="appx-tab-l">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
