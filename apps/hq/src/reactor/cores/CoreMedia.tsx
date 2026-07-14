import { useEffect, useRef } from 'react'
import type { MediaManifest, ProductId, SceneState } from '../contract'
import type { QualityTier } from '../useQualityTier'
import { CoreR3F } from './CoreR3F'

// ─────────────────────────────────────────────────────────────────────────
// CoreMedia — the Higgsfield slot.
//
// Plays a generated asset (MP4/WebM loop or, later, a GLB) keyed to the beat
// via the media manifest: sceneId → { src, in/out frames, fps }. Defining
// this seam BEFORE generating is what lets assets align to the audio clock.
//
// Until assets exist, any beat with no manifest entry transparently renders
// the 3D core instead — so the shell can already select renderer='media'
// with zero visual regression, and assets drop in scene-by-scene.
// ─────────────────────────────────────────────────────────────────────────

export function CoreMedia({ scene, tier, media, onSelectProduct, onHoverProduct }: {
  scene: SceneState
  tier: QualityTier
  media?: MediaManifest
  onSelectProduct?: (id: ProductId) => void
  onHoverProduct?: (id: ProductId | null) => void
}) {
  const asset = scene.sceneId ? media?.[scene.sceneId] : undefined
  const videoRef = useRef<HTMLVideoElement>(null)

  // Seek to the asset's in-frame at the start of the beat (frame-accurate align).
  useEffect(() => {
    const v = videoRef.current
    if (!v || !asset || asset.kind !== 'video') return
    v.currentTime = asset.inFrame / asset.fps
    v.play().catch(() => { /* autoplay may be blocked; the shell gates on a gesture */ })
  }, [asset])

  if (!asset || asset.kind !== 'video') {
    // No aligned asset for this beat → fall back to the live 3D core.
    return <CoreR3F scene={scene} tier={tier} onSelectProduct={onSelectProduct} onHoverProduct={onHoverProduct} />
  }

  return (
    <video ref={videoRef} src={asset.src} muted playsInline loop
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
  )
}
