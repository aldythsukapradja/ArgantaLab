import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'

// Animated number tween (GSAP) for the stat cards — counts up from 0 to `value`
// whenever the value changes. Respects prefers-reduced-motion by snapping.
export function useCountUp(value: number, duration = 1.1): number {
  const [display, setDisplay] = useState(value)
  const obj = useRef({ n: 0 })

  useEffect(() => {
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setDisplay(value); return }
    const tween = gsap.to(obj.current, {
      n: value, duration, ease: 'power2.out',
      onUpdate: () => setDisplay(obj.current.n),
    })
    return () => { tween.kill() }
  }, [value, duration])

  return display
}

// Formats a tweened number for display (rounds, adds thousands separators).
export function fmt(n: number): string {
  return Math.round(n).toLocaleString()
}
