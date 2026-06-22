import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import Buddy from '@components/avatar/Buddy'
import type { ResolvedOutfit } from '@/data/cosmetics'

interface Props {
  name: string
  icon: string
  color: string
  outfit?: ResolvedOutfit
  onDone: () => void
}

// The 7-beat reward cinematic: pause → diamonds fly → capsule shakes →
// Buddy appears → badge flips open → ring pulses → confetti.
export default function BadgeCinematic({ name, icon, color, outfit, onDone }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const capsule = useRef<HTMLDivElement>(null)
  const badge = useRef<HTMLDivElement>(null)
  const buddy = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLDivElement>(null)
  const diamonds = useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ onComplete: () => setRevealed(true) })
      // 1 · flash in
      tl.from(root.current, { opacity: 0, duration: 0.3 })
      // 2 · diamonds fly into the capsule
      const ds = diamonds.current?.children ?? []
      tl.to(ds, { x: 0, y: 0, scale: 0, opacity: 0.2, duration: 0.5, stagger: 0.05, ease: 'power2.in' }, '-=0.1')
      // 3 · capsule shakes
      tl.to(capsule.current, { keyframes: { x: [0, -7, 7, -5, 5, 0] }, duration: 0.5, ease: 'power1.inOut' })
      // 4 · Buddy pops in
      tl.from(buddy.current, { scale: 0, opacity: 0, duration: 0.45, ease: 'back.out(2)' }, '-=0.1')
      // 5 · badge flips open with glow
      tl.to(capsule.current, { scale: 0.2, opacity: 0, duration: 0.3 })
      tl.fromTo(badge.current, { scale: 0, rotationY: 90, opacity: 0 }, { scale: 1, rotationY: 0, opacity: 1, duration: 0.55, ease: 'back.out(1.6)' }, '-=0.1')
      // 6 · ring pulse
      tl.fromTo(ring.current, { scale: 0.4, opacity: 0.8 }, { scale: 1.8, opacity: 0, duration: 0.7, ease: 'power2.out' }, '-=0.3')
      // 7 · title rises
      tl.from(title.current, { y: 18, opacity: 0, duration: 0.4 }, '-=0.3')
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <div className="bc-overlay" ref={root} onClick={() => revealed && onDone()}>
      <div className="bc-stage" onClick={e => e.stopPropagation()}>
        {/* flying diamonds */}
        <div className="bc-diamonds" ref={diamonds} aria-hidden>
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2
            return <span key={i} style={{ transform: `translate(${Math.cos(a) * 150}px, ${Math.sin(a) * 130}px)` }}>💎</span>
          })}
        </div>

        <div className="bc-buddy" ref={buddy}><Buddy mood="celebrate" size={92} color={color} bob={false} outfit={outfit} /></div>

        {/* capsule (shakes, then opens) */}
        <div className="bc-capsule" ref={capsule} style={{ borderColor: color }}>🎁</div>

        {/* the badge */}
        <div className="bc-ring" ref={ring} style={{ borderColor: color }} aria-hidden />
        <div className="bc-badge" ref={badge} style={{ background: `radial-gradient(circle at 40% 30%, ${color}, ${shade(color, -30)})`, boxShadow: `0 0 50px ${color}aa` }}>
          <span>{icon}</span>
        </div>

        <div className="bc-title" ref={title}>
          <p className="bc-kicker">Badge unlocked!</p>
          <h2>{name}</h2>
          {revealed && <button className="bc-btn" style={{ background: color }} onClick={onDone}>Awesome! 🎉</button>}
        </div>
      </div>
    </div>
  )
}

function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (pct / 100) * 255)))
  return `#${((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1)}`
}
