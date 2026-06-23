import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useUiStore, type Tab } from '@store/uiStore'
import { IconToday, IconCalendar, IconHeart, IconApps, IconMe } from '@components/Icons'

const ITEMS: { tab: Tab; label: string; Icon: (p: any) => JSX.Element; dome?: boolean }[] = [
  { tab: 'today', label: 'Today', Icon: IconToday },
  { tab: 'calendar', label: 'Calendar', Icon: IconCalendar },
  { tab: 'moments', label: 'Moments', Icon: IconHeart, dome: true },
  { tab: 'apps', label: 'Apps', Icon: IconApps },
  { tab: 'me', label: 'Me', Icon: IconMe },
]

// Live nav: the active icon springs in and then breathes — the satisfying
// micro-motion (Ultrahuman-style) the family feels on every tab change.
export default function Nav() {
  const tab = useUiStore(s => s.tab)
  const go = useUiStore(s => s.go)
  const iconRefs = useRef<(HTMLSpanElement | null)[]>([])
  const idle = useRef<gsap.core.Tween | null>(null)

  useEffect(() => {
    const i = ITEMS.findIndex(x => x.tab === tab)
    const el = iconRefs.current[i]
    if (!el) return
    idle.current?.kill()
    gsap.fromTo(el, { scale: 0.55, y: 0 }, { scale: 1, duration: 0.55, ease: 'back.out(3.2)' })
    idle.current = gsap.to(el, { y: -2.5, repeat: -1, yoyo: true, duration: 1.15, ease: 'sine.inOut', delay: 0.5 })
    return () => { idle.current?.kill(); gsap.set(el, { y: 0 }) }
  }, [tab])

  return (
    <nav className="nav">
      {ITEMS.map((it, i) => {
        const on = tab === it.tab
        return (
          <button key={it.tab} className={`nav-btn${it.dome ? ' dome' : ''}${on ? ' on' : ''}`} onClick={() => go(it.tab)} aria-label={it.label}>
            <span className="ic-wrap" ref={el => (iconRefs.current[i] = el)}><it.Icon /></span>
            <span>{it.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
