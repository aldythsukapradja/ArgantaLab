import { useState } from 'react'
import { useUiStore } from '@store/uiStore'
import { useDataStore } from '@store/dataStore'
import { initials } from '@data/energy'
import { IconPlus } from '@components/Icons'

export default function TopBar() {
  const { activeCircleId, setCircle, go } = useUiStore()
  const circles = useDataStore(s => s.circles)
  const me = useDataStore(s => s.me)
  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const [showCircleMenu, setShowCircleMenu] = useState(false)

  const handleSelectCircle = (id: string) => {
    setCircle(id)
    setShowCircleMenu(false)
  }

  const accent0 = circle?.accent[0] ?? 'var(--accent)'
  const accent1 = circle?.accent[1] ?? 'var(--care)'

  return (
    <header className="topbar">
      {/* Left: Wordmark */}
      <div className="tb-wordmark">
        <span className="wm-k">Kinetik</span><span className="wm-c">Circle</span>
      </div>

      {/* Center: Circle selector */}
      <div className="circle-selector">
        <button
          className="cs-button"
          style={{
            background: `linear-gradient(135deg, ${accent0}, ${accent1})`,
          }}
          onClick={() => setShowCircleMenu(!showCircleMenu)}
        >
          <span className="csb-dot" style={{ background: accent0 }} />
          {circle?.name}
          <span className="csb-caret">▼</span>
        </button>

        {/* Circle menu dropdown */}
        {showCircleMenu && (
          <div className="cs-menu">
            {circles.map(c => {
              const isCurrent = c.id === activeCircleId
              return (
                <button
                  key={c.id}
                  className={`csm-item${isCurrent ? ' current' : ''}`}
                  onClick={() => handleSelectCircle(c.id)}
                  style={isCurrent ? {
                    background: `linear-gradient(135deg, ${c.accent[0]}20, ${c.accent[1]}20)`,
                    borderColor: c.accent[0],
                  } : {}}
                >
                  <span className="csm-dot" style={{ background: `linear-gradient(135deg, ${c.accent[0]}, ${c.accent[1]})` }} />
                  <span className="csm-name">{c.name}</span>
                  {isCurrent && <span className="csm-check">✓</span>}
                </button>
              )
            })}
            <button className="csm-item csm-add" onClick={() => { setShowCircleMenu(false); alert('Add circle coming soon') }}>
              <IconPlus width={16} height={16} />
              Add Circle
            </button>
          </div>
        )}
      </div>

      {/* Right: real Google photo → Me tab */}
      <div className="tb-right">
        <button
          className="topbar-avatar"
          onClick={() => { go('me'); setShowCircleMenu(false) }}
          aria-label="Profile"
          style={me?.photoUrl ? undefined : { background: `linear-gradient(135deg, ${accent0}, ${accent1})` }}
        >
          {me?.photoUrl
            ? <img src={me.photoUrl} alt={me.name} className="topbar-avatar-img" referrerPolicy="no-referrer" />
            : <span>{initials(me?.name || 'Me')}</span>}
        </button>
      </div>
    </header>
  )
}

