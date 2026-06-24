import { useEffect, useRef, useState } from 'react'
import { useUiStore } from '@store/uiStore'
import { useDataStore } from '@store/dataStore'
import { initials } from '@data/energy'
import { IconChevron, IconPlus } from '@components/Icons'
import { CircleEmblem as Emblem, accentOf } from '@components/CircleEmblem'

export default function TopBar() {
  const { activeCircleId, setCircle, go } = useUiStore()
  const circles = useDataStore(s => s.circles)
  const me = useDataStore(s => s.me)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const active = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const [a0, a1] = accentOf(active)

  // Close the dropdown on any outside tap / escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <header className="topbar topbar-v2" style={{ ['--c0' as any]: a0, ['--c1' as any]: a1 }}>
      <div className="tb-grid">
        {/* left — wordmark */}
        <div className="tb-wordmark"><span className="wm-k">Kinetik</span><span className="wm-c">Circle</span></div>

        {/* center — fancy circle chip + dropdown */}
        <div className="tb-center" ref={wrapRef}>
          <button
            className={`circle-chip${open ? ' open' : ''}`}
            onClick={() => setOpen(o => !o)}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <Emblem accent={[a0, a1]} active />
            <span className="cc-name">{active?.name ?? 'Your circle'}</span>
            <IconChevron className={`cc-caret${open ? ' up' : ''}`} width={15} height={15} />
          </button>

          {open && (
            <div className="cc-menu" role="listbox">
              {circles.map(c => {
                const isOn = c.id === activeCircleId
                return (
                  <button
                    key={c.id}
                    role="option"
                    aria-selected={isOn}
                    className={`cc-item${isOn ? ' on' : ''}`}
                    onClick={() => { setCircle(c.id); setOpen(false) }}
                  >
                    <Emblem accent={accentOf(c)} size={26} />
                    <span className="cc-item-name">{c.name}</span>
                    {isOn && <span className="cc-check" aria-hidden>✓</span>}
                  </button>
                )
              })}
              <button className="cc-item cc-new" onClick={() => { setOpen(false); go('me') }}>
                <span className="cc-new-ic"><IconPlus width={16} height={16} /></span>
                <span className="cc-item-name">New circle</span>
              </button>
            </div>
          )}
        </div>

        {/* right — avatar */}
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
    </header>
  )
}
