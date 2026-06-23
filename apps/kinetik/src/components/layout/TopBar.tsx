import { useUiStore, type Tab } from '@store/uiStore'
import { useDataStore } from '@store/dataStore'
import { IconSun, IconMoon, IconSwitch } from '@components/Icons'

const TITLES: Record<Tab, string> = { today: 'Today', calendar: 'Calendar', moments: 'Moments', apps: 'Apps', me: 'Me' }

export default function TopBar() {
  const { tab, theme, toggleTheme, activeCircleId, setCircle } = useUiStore()
  const circles = useDataStore(s => s.circles)
  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]

  const cycleCircle = () => {
    if (circles.length < 2) return
    const i = circles.findIndex(c => c.id === activeCircleId)
    setCircle(circles[(i + 1) % circles.length].id)
  }

  return (
    <header className="topbar">
      <div>
        <div className="tb-title">{TITLES[tab]}</div>
        {circle && (
          <button className="circle-pill" style={{ marginTop: 6 }} onClick={cycleCircle}>
            <span className="circle-dot" style={{ background: `linear-gradient(135deg,${circle.accent[0]},${circle.accent[1]})` }} />
            {circle.name}
            <IconSwitch width={14} height={14} style={{ color: 'var(--accent)' }} />
          </button>
        )}
      </div>
      <button className="avatar" onClick={toggleTheme} aria-label="Toggle theme" style={{ background: 'var(--card)', border: '0.5px solid var(--border-2)', color: 'var(--muted)' }}>
        {theme === 'dark' ? <IconSun width={18} height={18} /> : <IconMoon width={18} height={18} />}
      </button>
    </header>
  )
}
