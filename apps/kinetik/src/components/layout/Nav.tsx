import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useUiStore, type Tab } from '@store/uiStore'
import { useDataStore } from '@store/dataStore'
import { accentOf } from '@components/CircleEmblem'
import { NavToday, NavCalendar, NavMoments, NavApps, NavMe } from '@components/NavIcons'

const ITEMS: { tab: Tab; label: string; Icon: (p: { active: boolean }) => JSX.Element }[] = [
  { tab: 'today', label: 'Today', Icon: NavToday },
  { tab: 'calendar', label: 'Calendar', Icon: NavCalendar },
  { tab: 'moments', label: 'Moments', Icon: NavMoments },
  { tab: 'apps', label: 'Apps', Icon: NavApps },
  { tab: 'me', label: 'You', Icon: NavMe },
]

// Live nav: the active icon springs in and then breathes — the satisfying
// micro-motion (Ultrahuman-style) the family feels on every tab change.
export default function Nav() {
  const tab = useUiStore(s => s.tab)
  const go = useUiStore(s => s.go)
  const activeCircleId = useUiStore(s => s.activeCircleId)
  const circles = useDataStore(s => s.circles)
  const [n0, n1] = accentOf(circles.find(c => c.id === activeCircleId) ?? circles[0])

  const iconRefs = useRef<(HTMLSpanElement | null)[]>([])
  const idle = useRef<gsap.core.Tween | null>(null)

  useEffect(() => {
    const i = ITEMS.findIndex(x => x.tab === tab)
    const el = iconRefs.current[i]
    if (!el) return
    idle.current?.kill()
    gsap.fromTo(el, { scale: 0.6, y: 0 }, { scale: 1, duration: 0.55, ease: 'back.out(3.2)' })
    idle.current = gsap.to(el, { y: -2, repeat: -1, yoyo: true, duration: 1.15, ease: 'sine.inOut', delay: 0.5 })
    return () => { idle.current?.kill(); gsap.set(el, { y: 0 }) }
  }, [tab])

  return (
    <nav className="nav" style={{ ['--nav0' as any]: n0, ['--nav1' as any]: n1 }}>
      {ITEMS.map((it, i) => {
        const on = tab === it.tab
        return (
          <button key={it.tab} className={`nav-btn${on ? ' on' : ''}`} onClick={() => go(it.tab)} aria-label={it.label} aria-current={on ? 'page' : undefined}>
            <span className="ic-wrap" ref={el => (iconRefs.current[i] = el)}><it.Icon active={on} /></span>
            <span className="nav-lbl">{it.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
