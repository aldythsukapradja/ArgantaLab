import { useEffect, useState } from 'react'
import type { QualityTier } from './contract'

export type { QualityTier }

// ─────────────────────────────────────────────────────────────────────────
// Quality tiers & capability probing.
//
// The reactor targets 30–60fps across three tiers. Tier gates particle
// counts, postprocessing passes, DPR and shadow resolution inside the 3D
// core. A failed WebGL probe (or reduced-motion on a weak device) routes
// CoreSlot to the 2D fallback instead of the 3D core.
// ─────────────────────────────────────────────────────────────────────────

/** DPR ceiling per tier — the single biggest fill-rate lever on retina/mobile. */
export const DPR_CAP: Record<QualityTier, [number, number]> = {
  high: [1, 1.5],
  medium: [1, 1.35],
  mobile: [1, 1],
}

/** Vault knowledge-field particle budget per tier. */
export function pointBudget(tier: QualityTier): number {
  if (tier === 'high') return 2800
  if (tier === 'medium') return 1650
  return 560
}

/** Whether the heavy postprocessing chain (N8AO, DoF) is affordable. */
export function allowHeavyPost(tier: QualityTier): boolean {
  return tier !== 'mobile'
}

function computeTier(): QualityTier {
  if (typeof window === 'undefined') return 'medium'
  const width = window.innerWidth
  const cores = navigator.hardwareConcurrency ?? 4
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  // Coarse-pointer small screens are treated as mobile regardless of width.
  if (coarse && width <= 900) return 'mobile'
  if (width <= 680 || cores <= 4) return 'mobile'
  if (width >= 2200 && cores >= 8) return 'high'
  return 'medium'
}

export function useQualityTier(): QualityTier {
  const [tier, setTier] = useState<QualityTier>(computeTier)
  useEffect(() => {
    const update = () => setTier(computeTier())
    window.addEventListener('resize', update, { passive: true })
    return () => window.removeEventListener('resize', update)
  }, [])
  return tier
}

/**
 * One-shot WebGL support probe. Cached — creating throwaway contexts is not
 * free, and the answer never changes within a session.
 */
let webglSupport: boolean | null = null
export function hasWebGL(): boolean {
  if (webglSupport !== null) return webglSupport
  if (typeof document === 'undefined') return (webglSupport = false)
  try {
    const canvas = document.createElement('canvas')
    webglSupport = !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    )
  } catch {
    webglSupport = false
  }
  return webglSupport
}

/** Reads the OS/user reduced-motion preference, reactively. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
      : false,
  )
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const update = () => setReduced(mq.matches)
    mq.addEventListener?.('change', update)
    return () => mq.removeEventListener?.('change', update)
  }, [])
  return reduced
}
