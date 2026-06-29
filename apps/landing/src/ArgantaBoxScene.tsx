import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import BackgroundScene from '@components/three/BackgroundScene'

export function ArgantaBoxScene({ dark, step }: { dark: boolean; step: number }) {
  const shellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      gsap.to(shell, {
        x: dark ? (step % 2 ? -18 : 18) : (step % 2 ? -10 : 10),
        y: dark ? (step % 3 ? 10 : -12) : (step % 3 ? 6 : -6),
        rotate: dark ? (step - 4) * 1.8 : (step - 4) * .9,
        scale: dark ? 1.04 + (step % 3) * .015 : 1.02,
        opacity: dark ? .74 : .44,
        duration: reduce ? 0.01 : 1.2,
        ease: 'power2.inOut',
      })
    }, shell)
    return () => ctx.revert()
  }, [dark, step])

  return (
    <div ref={shellRef} className="three-canvas boxy-canvas">
      <BackgroundScene tab="studio" />
    </div>
  )
}
