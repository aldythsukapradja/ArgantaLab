// ============================================================
//  ARGANTALAB · OPENWORLD · MountSprite  (data-driven, pixel-art PNG)
//  Renders a PixelLab-generated pixel-art sprite per mount catalog `render`
//  key, from /assets/mounts/<render>.png. Kept inside the SAME 0 0 100 100
//  <svg> shell as the old primitive version so AvatarSprite's rider overlay
//  (Buddy sits on the saddle ~x50,y40) still composes unchanged.
//
//  Sprites generated via apps/web/scripts/genMounts.py (PixelLab, 64px, transparent).
//  To re-skin a mount: regenerate its PNG — no code change.
// ============================================================

import { mount as mountDef } from '@/data/openworld'

export interface MountSpriteProps {
  /** a mount id ('mount:sandstrider') OR a bare render key ('sandstrider') */
  mount?: string
  render?: string
  /** kept for API compatibility; pixel art carries its own colours now */
  color?: string
  size?: number
  className?: string
}

export default function MountSprite({ mount, render, size = 130, className }: MountSpriteProps) {
  const def = mount ? mountDef(mount.startsWith('mount:') ? mount : `mount:${mount}`) : undefined
  const key = render ?? def?.render ?? 'sandstrider'
  const src = `/assets/mounts/${key}.png`
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role="img" aria-label={def?.name ?? key}>
      <ellipse cx="50" cy="92" rx="32" ry="5" fill="rgba(0,0,0,0.16)" />
      <image
        href={src}
        x="6" y="4" width="88" height="88"
        preserveAspectRatio="xMidYMid meet"
        style={{ imageRendering: 'pixelated' }}
      />
    </svg>
  )
}
