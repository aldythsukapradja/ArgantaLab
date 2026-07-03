// ============================================================
//  ARGANTALAB · OPENWORLD · AvatarSprite  (reuse, don't rebuild)
//  The player's in-game character IS the existing avatar — we wrap Buddy and
//  feed it the live resolvedOutfit() from the store, so anything bought in the
//  Shop shows up automatically in the Openworld (avatar linkage is free).
//  Optionally rides a MountSprite: the rider sits on the mount's saddle.
// ============================================================

import { useAppStore } from '@store/appStore'
import type { ResolvedOutfit } from '@/data/cosmetics'
import Buddy, { type Mood } from '@components/avatar/Buddy'
import MountSprite from './MountSprite'

export interface AvatarSpriteProps {
  mood?: Mood
  size?: number
  look?: { x: number; y: number }
  bob?: boolean
  /** mount id or render key — when set, the avatar rides it */
  mount?: string
  /** override the look (e.g. a co-op teammate's outfit); defaults to my own */
  outfit?: ResolvedOutfit
  className?: string
}

export default function AvatarSprite({ mood = 'idle', size = 120, look, bob, mount, outfit: outfitProp, className }: AvatarSpriteProps) {
  const myOutfit = useAppStore(s => s.resolvedOutfit())
  const outfit = outfitProp ?? myOutfit

  if (!mount) {
    return <Buddy mood={mood} size={size} look={look} bob={bob} outfit={outfit} className={className} />
  }

  // Ride: mount fills the frame; the rider-head sits ON the saddle (mid-back).
  // Numbers tuned against the pixel-art mounts (128px, side-view, saddle on the
  // back) via docs/kingdom-of-kin/art-tests/ride_preview.png — scale 0.43, seated
  // at top 34% and nudged right (53%) onto the saddle so the mount reads majestic.
  const riderSize = size * 0.43
  return (
    <div className={className} style={{ position: 'relative', width: size, height: size }}>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'end center' }}>
        <MountSprite mount={mount} size={size} />
      </div>
      <div style={{ position: 'absolute', left: '53%', top: '34%', transform: 'translateX(-50%)' }}>
        <Buddy mood={mood} size={riderSize} look={look} bob={bob} outfit={outfit} />
      </div>
    </div>
  )
}
