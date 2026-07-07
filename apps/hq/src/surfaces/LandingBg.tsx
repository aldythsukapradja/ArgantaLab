import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

// GSAP-animated cockpit background: a faint data-grid + three slow-drifting
// energy blobs that relate to the design (data flowing around the core). Pauses
// with prefers-reduced-motion; auto-cleans on unmount via gsap.context.

export function LandingBg() {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      gsap.to('.ceo-blob.b1', { xPercent: 18, yPercent: 12, scale: 1.18, duration: 14, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      gsap.to('.ceo-blob.b2', { xPercent: -16, yPercent: -14, scale: 1.12, duration: 17, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      gsap.to('.ceo-blob.b3', { xPercent: 12, yPercent: -10, scale: 1.22, duration: 20, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      gsap.to('.ceo-grid', { backgroundPositionX: '38px', backgroundPositionY: '38px', duration: 24, repeat: -1, ease: 'none' })
    }, root)
    return () => ctx.revert()
  }, [])
  return (
    <div className="ceo-bg" ref={root} aria-hidden>
      <div className="ceo-grid" />
      <div className="ceo-blob b1" />
      <div className="ceo-blob b2" />
      <div className="ceo-blob b3" />
    </div>
  )
}
