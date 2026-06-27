import { useAppStore } from '@store/appStore'
import { MOBILE_TABS } from '@/data'

const icons: Record<string, () => JSX.Element> = {
  arganta: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>,
  web: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  learn: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l10 3 10-3-10-3z"/><path d="M2 5v9l10 3 10-3V5"/></svg>,
  studio: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/></svg>,
  launch: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11"/></svg>,
  shop: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  discover: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>,
  avatar: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>,
}

// Remembers the last sub-tab visited within each group, so returning to a
// group lands where you left off.
const lastInGroup: Record<string, string> = {}

export default function Dock() {
  const { activeTab, go } = useAppStore()

  return (
    <nav className="dock">
      <div className="dock-row">
        {MOBILE_TABS.map(t => {
          const active = t.members.includes(activeTab)
          if (active) lastInGroup[t.key] = activeTab
          const Icon = icons[t.icon] ?? icons.arganta
          const target = lastInGroup[t.key] || t.members[0]
          return (
            <button key={t.key} className={`dock-item${active ? ' on' : ''}`} onClick={() => go({ tab: target })} aria-current={active ? 'page' : undefined}>
              <span className="dock-ic"><Icon /></span>
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
