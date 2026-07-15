import { lazy, Suspense } from 'react'
import type { MediaManifest, ProductId, RendererId, SceneState } from './contract'
import { hasWebGL, useQualityTier } from './useQualityTier'
import { Core2D } from './cores/Core2D'

// ─────────────────────────────────────────────────────────────────────────
// CoreSlot — the one interface the shell mounts.
//
//   <CoreSlot renderer={'2d'|'r3f'|'media'} state={sceneState} />
//
// It owns renderer selection and the safety gates: no WebGL → 2D; the 'media'
// renderer with no asset for the beat → 3D. WS1 never learns which core is
// live, so a Higgsfield asset swaps in by changing `renderer` alone.
// ─────────────────────────────────────────────────────────────────────────

const CoreR3F = lazy(() => import('./cores/CoreR3F').then(m => ({ default: m.CoreR3F })))
const CoreMedia = lazy(() => import('./cores/CoreMedia').then(m => ({ default: m.CoreMedia })))

export function CoreSlot({ renderer = 'r3f', state, media, onSelectProduct, onHoverProduct, interactive = false, centered = false, manualExplosion = null }: {
  renderer?: RendererId
  state: SceneState
  media?: MediaManifest
  onSelectProduct?: (id: ProductId) => void
  onHoverProduct?: (id: ProductId | null) => void
  /** Hand the camera to the founder (OrbitControls: scroll-zoom, drag-rotate). */
  interactive?: boolean
  /** Glue to centre (no pan) + RIGHT-mouse drag explodes the reactor. */
  centered?: boolean
  /** Scrub the axial explosion directly (0..1) — overrides the scenario. */
  manualExplosion?: number | null
}) {
  const tier = useQualityTier()

  // Hard fallback: without WebGL the 3D and media cores can't run at all.
  const effective: RendererId = !hasWebGL() ? '2d' : renderer

  if (effective === '2d') {
    return <Core2D scene={state} tier={tier} onSelectProduct={onSelectProduct} />
  }

  if (effective === 'media') {
    return (
      <Suspense fallback={<Core2D scene={state} tier={tier} onSelectProduct={onSelectProduct} />}>
        <CoreMedia scene={state} tier={tier} media={media} onSelectProduct={onSelectProduct} onHoverProduct={onHoverProduct} />
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<Core2D scene={state} tier={tier} onSelectProduct={onSelectProduct} />}>
      <CoreR3F scene={state} tier={tier} interactive={interactive} centered={centered} manualExplosion={manualExplosion} onSelectProduct={onSelectProduct} onHoverProduct={onHoverProduct} />
    </Suspense>
  )
}
