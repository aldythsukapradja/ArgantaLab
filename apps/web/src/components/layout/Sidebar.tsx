import { useAppStore } from '@store/appStore'
import { NAV } from '@/data'

const icons: Record<string, () => JSX.Element> = {
  arganta: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  web: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  ai: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/></svg>,
  data: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  studio: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/></svg>,
  lab: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6M10 3v6.5L5.5 17a2 2 0 0 0 1.7 3h9.6a2 2 0 0 0 1.7-3L14 9.5V3"/><path d="M7.5 14h9"/></svg>,
  shop: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  discover: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>,
  store: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/></svg>,
  avatar: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>,
  trophy: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 3M16 6h3a3 3 0 0 1-3 3M10 14v3M14 14v3M8 20h8M9 20l.5-3M15 20l-.5-3"/></svg>,
  launch: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>,
  profile: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M5 18a4 4 0 0 1 8 0M15 9h3M15 13h3"/></svg>,
  learn: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l10 3 10-3-10-3z"/><path d="M2 5v9l10 3 10-3V5"/></svg>,
  admin: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.6 14H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 5 8.6l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 10 3.6V3a2 2 0 1 1 4 0v.09c.66.13 1.26.51 1.69 1.08"/></svg>,
}

// The 6 learning worlds render a coloured glyph instead of an SVG.
const WORLD_GLYPH: Record<string, { g: string; c: string }> = {
  num: { g: '#', c: '#f59e0b' }, wrd: { g: 'A', c: '#3b82f6' }, won: { g: '⚗', c: '#10b981' },
  log: { g: '{}', c: '#8b5cf6' }, wld: { g: '🗺', c: '#ef4444' }, lif: { g: '♥', c: '#f472b6' },
}

export default function Sidebar() {
  const { activeTab, go, isAdmin } = useAppStore()

  const groups: Record<string, typeof NAV> = {}
  NAV.forEach(n => { if (!groups[n.group]) groups[n.group] = []; groups[n.group].push(n) })

  return (
    <nav className="drawer">
      {Object.entries(groups).map(([g, items]) => (
        <div key={g}>
          <div className="nav-label">{g}</div>
          {items.map(item => {
            const glyph = WORLD_GLYPH[item.tab]
            const Icon = icons[item.tab] ?? icons.arganta
            return (
              <button
                key={item.tab}
                className={`nav-item${activeTab === item.tab ? ' on' : ''}`}
                onClick={() => go({ tab: item.tab })}
              >
                {glyph
                  ? <span className="nav-glyph" style={{ color: glyph.c }}>{glyph.g}</span>
                  : <Icon />}
                {item.label}
              </button>
            )
          })}
        </div>
      ))}
      <div className="nav-spacer" />
      {isAdmin() && (
        <div>
          <div className="nav-label">Creator</div>
          <button className={`nav-item${activeTab === 'admin' ? ' on' : ''}`} onClick={() => go({ tab: 'admin' })}>
            {icons.admin()}
            Content Studio
          </button>
        </div>
      )}
    </nav>
  )
}
