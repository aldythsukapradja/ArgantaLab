// ── motion — the shared cinematic layer. Registers the (now-free) GSAP plugins
// once, exposes house eases/durations, and a reduced-motion guard so every
// animation degrades to an instant, accessible state. Import from here, never
// register plugins ad-hoc.
import { gsap } from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { Flip } from 'gsap/Flip'
import { Observer } from 'gsap/Observer'

let registered = false
export function ensureGsap() {
  if (registered) return
  gsap.registerPlugin(SplitText, Flip, Observer)
  registered = true
}

export const EASE = {
  out: 'power3.out',
  inOut: 'power2.inOut',
  soft: 'expo.out',
} as const
export const DUR = { fast: 0.4, base: 0.7, slow: 1.1 } as const

export const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export { gsap, SplitText, Flip, Observer }
