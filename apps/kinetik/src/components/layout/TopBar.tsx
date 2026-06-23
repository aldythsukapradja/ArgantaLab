import { useUiStore } from '@store/uiStore'
import { useDataStore } from '@store/dataStore'
import { initials } from '@data/energy'
import { IconPlus } from '@components/Icons'

export default function TopBar() {
  const { activeCircleId, setCircle, go } = useUiStore()
  const circles = useDataStore(s => s.circles)
  const me = useDataStore(s => s.me)

  const accentOf = (c: { accent: [string, string] }) => c.accent ?? ['var(--accent)', 'var(--care)']

  return (
    <header className="topbar">
      {/* Row 1: wordmark + avatar */}
      <div className="tb-row">
        <div className="tb-wordmark">
          <span className="wm-k">Kinetik</span><span className="wm-c">Circle</span>
        </div>
        <button
          className="topbar-avatar"
          onClick={() => go('me')}
          aria-label="Profile"
          style={me?.photoUrl ? undefined : { background: 'var(--grad)' }}
        >
          {me?.photoUrl
            ? <img src={me.photoUrl} alt={me.name} className="topbar-avatar-img" referrerPolicy="no-referrer" />
            : <span>{initials(me?.name || 'Me')}</span>}
        </button>
      </div>

      {/* Row 2: Life360-style scrollable circle pills */}
      <div className="circle-rail" role="tablist" aria-label="Your circles">
        {circles.map(c => {
          const active = c.id === activeCircleId
          const [a0, a1] = accentOf(c)
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={active}
              className={`circle-pill2${active ? ' active' : ''}`}
              onClick={() => setCircle(c.id)}
              style={active ? { background: `linear-gradient(135deg, ${a0}, ${a1})` } : undefined}
            >
              <span
                className="cp-dot"
                style={{ background: active ? 'rgba(255,255,255,0.9)' : `linear-gradient(135deg, ${a0}, ${a1})` }}
              />
              <span className="cp-name">{c.name}</span>
            </button>
          )
        })}
        <button
          className="circle-pill2 cp-add"
          onClick={() => go('me')}
          aria-label="Add circle"
          title="Add circle"
        >
          <IconPlus width={15} height={15} />
        </button>
      </div>
    </header>
  )
}
