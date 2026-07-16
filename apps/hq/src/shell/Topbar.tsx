import { Sun, Moon, Search, Home } from 'lucide-react'
import { useHQ, surfaceLabel } from './store'

export function Topbar() {
  const { surface, dataTab, forgeTab, theme, toggleTheme, openPalette, go } = useHQ()
  // GB-3 · the builders' crumb now tracks the Forge/Legacy tab — builderSub
  // (catalogue/studio/analytics) only exists inside the legacy wizard.
  const isBuilder = surface === 'game' || surface === 'app'
  return (
    <header className="topbar">
      <div className="crumb">
        <span>Circle HQ</span>
        <span>/</span>
        <b>{surfaceLabel(surface)}</b>
        {surface === 'data' && (<><span>/</span><b style={{ textTransform: 'capitalize' }}>{dataTab}</b></>)}
        {isBuilder && (<><span>/</span><b style={{ textTransform: 'capitalize' }}>{forgeTab}</b></>)}
      </div>

      <div style={{ flex: 1 }} />

      <div className="kbd hq-hide-sm" role="button" tabIndex={0} aria-label="Search" onClick={openPalette}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPalette() } }}>
        <Search size={13} /> <span>Search</span>
        <kbd style={{ fontFamily: 'var(--mono)' }}>⌘K</kbd>
      </div>
      <button className="tbtn hq-show-sm" onClick={openPalette} aria-label="Search" title="Search">
        <Search size={16} />
      </button>
      <button className="tbtn" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">
        {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
      </button>
      <button className="tbtn" onClick={() => go('home')} aria-label="Go to Home" title="Go to Home">
        <Home size={16} />
      </button>
    </header>
  )
}
