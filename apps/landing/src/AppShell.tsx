import { type ReactElement } from 'react'
import { ThemeToggle, useTheme } from './theme'
import { Home, Products, About, type Tab, type Launch } from './appscreens'
import PitchDeck from './PitchDeck'
import HubBgLazy from './HubBgLazy'
import { LoginButton } from './auth/LoginButton'
import { Command } from './CommandTab'
import { useAuth } from './lib/auth'

function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2.3" />
      <circle cx="16" cy="8" r="2.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}

const IC: Record<Tab, ReactElement> = {
  home: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>,
  products: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>,
  about: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><circle cx="17.5" cy="9" r="2.6" /><path d="M15.5 20a4.5 4.5 0 0 1 6-4.2" /></svg>,
  pitch: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8" /><path d="M21 7v5M21 7h-5" /></svg>,
  command: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></svg>,
}
const BASE_TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'products', label: 'Products' },
  { id: 'about', label: 'About' },
  { id: 'pitch', label: 'Pitch' },
]

export default function AppShell({ tab, onTab, onLaunch }: { tab: Tab; onTab: (t: Tab) => void; onLaunch: Launch }) {
  const { dark } = useTheme()
  const { isOperator } = useAuth()
  // the Command tab only exists for the signed-in operator
  const TABS = isOperator ? [...BASE_TABS, { id: 'command' as Tab, label: 'Command' }] : BASE_TABS
  // if a public visitor somehow lands on #command, fall back to home
  const activeTab: Tab = tab === 'command' && !isOperator ? 'home' : tab
  return (
    <div className="appx">
      <HubBgLazy dark={dark} />

      <header className="appx-top">
        <button className="appx-brand" onClick={() => onTab('home')}><Mark /> Arganta</button>
        <nav className="appx-topnav">
          {TABS.map(t => (
            <button key={t.id} className={`appx-topnav-t${activeTab === t.id ? ' on' : ''}`} onClick={() => onTab(t.id)}>{t.label}</button>
          ))}
        </nav>
        <span className="appx-top-r"><LoginButton /><ThemeToggle /></span>
      </header>

      <main className="appx-content">
        {activeTab === 'pitch' ? (
          <PitchDeck key="pitch" />
        ) : (
          <div className={`appx-screen${activeTab === 'command' ? ' scroll' : ''}`} key={activeTab}>
            {activeTab === 'home' && <Home onLaunch={onLaunch} onTab={onTab} />}
            {activeTab === 'products' && <Products onLaunch={onLaunch} />}
            {activeTab === 'about' && <About />}
            {activeTab === 'command' && <Command />}
          </div>
        )}
      </main>

      <nav className="appx-tabbar">
        {TABS.map(t => (
          <button key={t.id} className={`appx-tab${activeTab === t.id ? ' on' : ''}`} onClick={() => onTab(t.id)} aria-label={t.label}>
            <span className="appx-tab-ic">{IC[t.id]}</span>
            <span className="appx-tab-l">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
