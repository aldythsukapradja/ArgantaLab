import { useEffect, useRef, useState } from 'react'
import { useUiStore } from '@store/uiStore'
import { useDataStore } from '@store/dataStore'
import { IconChevron, IconPlus, IconSun, IconMoon } from '@components/Icons'
import { CircleEmblem as Emblem, accentOf } from '@components/CircleEmblem'

// KinFarm icons — a sprout default, a home icon once the farm is open (mirrors
// apps/web's Arena pill: same button toggles both ways, icon+label swap).
function IconSprout({ width = 15, height = 15 }: { width?: number; height?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22V13" /><path d="M12 13C12 13 5 13 5 6c7 0 7 7 7 7Z" /><path d="M12 13C12 13 19 13 19 6c-7 0-7 7-7 7Z" />
    </svg>
  )
}
function IconHome({ width = 15, height = 15 }: { width?: number; height?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" />
    </svg>
  )
}

export default function TopBar() {
  const { activeCircleId, setCircle, go, theme, toggleTheme, tab } = useUiStore()
  const circles = useDataStore(s => s.circles)
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

        {/* right — KinFarm teaser pill + theme switcher */}
        <div className="tb-right">
          <button
            className={`tb-farm${tab === 'farm' ? ' on' : ''}`}
            onClick={() => go(tab === 'farm' ? 'today' : 'farm')}
            title={tab === 'farm' ? 'Return home' : 'Open KinFarm'}
          >
            {tab === 'farm'
              ? <><IconHome /><span className="tb-farm-lbl">Home</span></>
              : <><IconSprout /><span className="tb-farm-lbl">KinFarm</span></>}
          </button>
          <button className="topbar-theme" onClick={toggleTheme} aria-label="Toggle light or dark mode">
            {theme === 'dark' ? <IconSun width={18} height={18} /> : <IconMoon width={18} height={18} />}
          </button>
        </div>
      </div>
    </header>
  )
}
