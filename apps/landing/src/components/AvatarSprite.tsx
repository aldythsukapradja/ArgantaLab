// Landing port of the real AvatarSprite: Buddy, optionally riding a MountSprite.
// Store-free — outfit is passed as a prop (or omitted for the default look).
import type { ResolvedOutfit } from '../data/cosmetics'
import Buddy, { type Mood } from './Buddy'
import MountSprite from './MountSprite'

export interface AvatarSpriteProps {
  mood?: Mood
  size?: number
  look?: { x: number; y: number }
  bob?: boolean
  mount?: string
  outfit?: ResolvedOutfit
  className?: string
}

export default function AvatarSprite({ mood = 'idle', size = 120, look, bob, mount, outfit, className }: AvatarSpriteProps) {
  if (!mount) {
    return <Buddy mood={mood} size={size} look={look} bob={bob} outfit={outfit} className={className} />
  }
  const riderSize = size * 0.6
  return (
    <div className={className} style={{ position: 'relative', width: size, height: size }}>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'end center' }}>
        <MountSprite mount={mount} size={size} />
      </div>
      <div style={{ position: 'absolute', left: '50%', top: '34%', transform: 'translate(-46%, -50%)' }}>
        <Buddy mood={mood} size={riderSize} look={look} bob={bob} outfit={outfit} />
      </div>
    </div>
  )
}
