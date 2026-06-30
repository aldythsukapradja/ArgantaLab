import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useUiStore, type Tab } from '@store/uiStore'
import { useDataStore } from '@store/dataStore'
import { initials, ROLE_LABEL } from '@data/energy'
import { CircleEmblem as Emblem, accentOf } from '@components/CircleEmblem'
import { IconChevron, IconPlus } from '@components/Icons'
import { NavToday, NavCalendar, NavMoments, NavApps, NavMe } from '@components/NavIcons'

const ITEMS: { tab: Tab; label: string; Icon: (p: { active: boolean }) => JSX.Element }[] = [
  { tab: 'today', label: 'Today', Icon: NavToday },
  { tab: 'calendar', label: 'Calendar', Icon: NavCalendar },
  { tab: 'moments', label: 'Moments', Icon: NavMoments },
  { tab: 'apps', label: 'Apps', Icon: NavApps },
  { tab: 'me', label: 'You', Icon: NavMe },
]

/** Desktop / tablet navigation. Hidden on mobile (the bottom Nav takes over). */
export default function Sidebar() {
  const { tab, go, activeCircleId, setCircle } = useUiStore()
  const circles = useDataStore(s => s.circles)
  const people = useDataStore(s => s.people)
  const me = useDataStore(s => s.me)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const iconRefs = useRef<(HTMLSpanElement | null)[]>([])
  const idle = useRef<gsap.core.Tween | null>(null)

  const active = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const [a0, a1] = accentOf(active)

  // Same "live" micro-motion as the bottom nav: the active icon springs in
  // and then gently breathes — keeps the two nav surfaces visually identical.
  useEffect(() => {
    const i = ITEMS.findIndex(x => x.tab === tab)
    const el = iconRefs.current[i]
    if (!el) return
    idle.current?.kill()
    gsap.fromTo(el, { scale: 0.6 }, { scale: 1, duration: 0.55, ease: 'back.out(3.2)' })
    idle.current = gsap.to(el, { y: -2, repeat: -1, yoyo: true, duration: 1.15, ease: 'sine.inOut', delay: 0.5 })
    return () => { idle.current?.kill(); gsap.set(el, { y: 0 }) }
  }, [tab])

  const members = people.filter(p => active && active.memberIds.includes(p.id))
  const name = me?.name ?? members.find(m => m.role === 'owner')?.name ?? 'You'
  const myRole = members.find(m => m.name === name)?.role ?? 'owner'

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
    <aside className="sidebar" style={{ ['--c0' as any]: a0, ['--c1' as any]: a1 }}>
      {/* brand */}
      <div className="sb-brand">
        <span className="sb-logo">K</span>
        <span className="sb-word"><span className="wm-k">Kinetik</span><span className="wm-c">Circle</span></span>
      </div>

      {/* circle switcher */}
      <div className="sb-circle" ref={wrapRef}>
        <button className={`sb-circle-btn${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}>
          <Emblem accent={[a0, a1]} size={28} active />
          <span className="sb-circle-name">{active?.name ?? 'Your circle'}</span>
          <IconChevron className={`sb-caret${open ? ' up' : ''}`} width={15} height={15} />
        </button>
        {open && (
          <div className="sb-menu" role="listbox">
            {circles.map(c => {
              const isOn = c.id === activeCircleId
              return (
                <button key={c.id} role="option" aria-selected={isOn} className={`cc-item${isOn ? ' on' : ''}`} onClick={() => { setCircle(c.id); setOpen(false) }}>
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

      {/* nav — mirrors the bottom nav: accent active, glass pill, duotone icons */}
      <nav className="sb-nav">
        {ITEMS.map((it, i) => {
          const on = tab === it.tab
          return (
            <button key={it.tab} className={`sb-item${on ? ' on' : ''}`} onClick={() => go(it.tab)} aria-current={on ? 'page' : undefined}>
              <span className="sb-item-ic" ref={el => (iconRefs.current[i] = el)}><it.Icon active={on} /></span>
              <span className="sb-item-label">{it.label}</span>
            </button>
          )
        })}
      </nav>

      {/* profile */}
      <button className="sb-profile" onClick={() => go('me')}>
        {me?.photoUrl
          ? <img className="sb-avatar" src={me.photoUrl} alt={name} referrerPolicy="no-referrer" />
          : <span className="sb-avatar sb-avatar-fb" style={{ background: 'var(--grad)' }}>{initials(name)}</span>}
        <span className="sb-profile-info">
          <b>{name}</b>
          <small>{ROLE_LABEL[myRole]}</small>
        </span>
      </button>
    </aside>
  )
}
