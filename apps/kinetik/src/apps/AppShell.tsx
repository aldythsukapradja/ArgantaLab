import type { ReactNode } from 'react'
import { useDataStore } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { IconChevronL, IconSun, IconMoon } from '@components/Icons'

export interface AppTab { key: string; label: string }

/** Full-screen chrome for a native KinetikCircle app — header (accent icon,
 *  title, circle name, 💎 Soon, user avatar), scroll body, optional tab bar,
 *  toast. Themed by the app's accent via --c0/--c1. */
export default function AppShell({ accent, emoji, title, onBack, tabs, tab, onTab, toast, children }: {
  accent: [string, string]
  emoji: string
  title: string
  onBack: () => void
  tabs?: AppTab[]
  tab?: string
  onTab?: (k: string) => void
  toast?: string | null
  children: ReactNode
}) {
  const circles = useDataStore(s => s.circles)
  const activeCircleId = useUiStore(s => s.activeCircleId)
  const theme = useUiStore(s => s.theme)
  const toggleTheme = useUiStore(s => s.toggleTheme)
  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]

  return (
    <div className="kap" style={{ ['--c0' as any]: accent[0], ['--c1' as any]: accent[1] }}>
      <header className="kap-head">
        <button className="kap-back" onClick={onBack} aria-label="Close app"><IconChevronL width={20} height={20} /></button>
        <span className="kap-icon">{emoji}</span>
        <div className="kap-title">
          <b>{title}</b>
          <small><span className="kap-title-dot" />{circle?.name ?? 'Your circle'}</small>
        </div>
        <button className="kap-theme" onClick={toggleTheme} aria-label="Toggle light or dark mode">
          {theme === 'dark' ? <IconSun width={18} height={18} /> : <IconMoon width={18} height={18} />}
        </button>
      </header>

      <div className="kap-body">{children}</div>

      {tabs && tabs.length > 0 && (
        <nav className="kap-tabs">
          {tabs.map(t => (
            <button key={t.key} className={`kap-tab${tab === t.key ? ' on' : ''}`} onClick={() => onTab?.(t.key)}>{t.label}</button>
          ))}
        </nav>
      )}

      {toast && <div className="kap-toast">{toast}</div>}
    </div>
  )
}
