import { Sun, Moon, Search, LogOut } from 'lucide-react'
import { useHQ, surfaceLabel } from './store'
import { signOut } from '../lib/auth'

export function Topbar({ canSignOut }: { canSignOut: boolean }) {
  const { surface, dataTab, builderSub, theme, toggleTheme } = useHQ()
  const isBuilder = surface === 'game' || surface === 'app'
  return (
    <header className="topbar">
      <div className="crumb">
        <span>Circle HQ</span>
        <span>/</span>
        <b>{surfaceLabel(surface)}</b>
        {surface === 'data' && (<><span>/</span><b style={{ textTransform: 'capitalize' }}>{dataTab}</b></>)}
        {isBuilder && (<><span>/</span><b style={{ textTransform: 'capitalize' }}>{builderSub}</b></>)}
      </div>

      <div style={{ flex: 1 }} />

      <div className="kbd hq-hide-sm" role="button" tabIndex={0} aria-label="Search">
        <Search size={13} /> <span>Search</span>
        <kbd style={{ fontFamily: 'var(--mono)' }}>⌘K</kbd>
      </div>
      <button className="tbtn" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">
        {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
      </button>
      {canSignOut && (
        <button className="tbtn" onClick={signOut} aria-label="Sign out" title="Sign out">
          <LogOut size={16} />
        </button>
      )}
    </header>
  )
}
