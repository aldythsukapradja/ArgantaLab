// ============================================================
//  ARGANTALAB · OPENWORLD · MountSprite  (data-driven, primitive SVG)
//  Same pattern as KinSprite: switch on the mount catalog `render` key and
//  build from SVG primitives. The Avatar (Buddy) rides ON TOP of this in the
//  Openworld — AvatarSprite composes them. Color is tinted per catalog row.
// ============================================================


function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, Math.max(0, (n >> 16) + Math.round(255 * pct)))
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) + Math.round(255 * pct)))
  const b = Math.min(255, Math.max(0, (n & 255) + Math.round(255 * pct)))
  return `rgb(${r},${g},${b})`
}

function Eye({ x, y }: { x: number; y: number }) {
  return (
    <>
      <circle cx={x} cy={y} r="3" fill="#1f2937" />
      <circle cx={x + 1} cy={y - 1} r="1" fill="#fff" />
    </>
  )
}

import type { ReactElement } from 'react'
type Art = (c: string, d: string, l: string) => ReactElement

// Mounts face right (the rider sits on the saddle around x≈50,y≈40).
const ART: Record<string, Art> = {
  // Desert runner — four legs, long neck, alert ears.
  sandstrider: (c, d, l) => (
    <g>
      <path d="M30 64 L28 84 M44 66 L42 84 M62 66 L64 84 M76 60 L80 82" stroke={d} strokeWidth="6" strokeLinecap="round" />
      <ellipse cx="52" cy="56" rx="30" ry="16" fill={c} />
      <path d="M70 48 Q82 38 80 24 Q74 28 70 36 Q66 44 64 50 Z" fill={c} />
      <ellipse cx="78" cy="26" rx="7" ry="9" fill={c} />
      <path d="M76 18 L74 8 L82 16 Z" fill={l} /><path d="M82 18 L86 9 L86 18 Z" fill={l} />
      <path d="M80 30 Q86 32 84 38" fill="none" stroke={d} strokeWidth="2" strokeLinecap="round" />
      <path d="M24 56 Q14 58 18 70" fill="none" stroke={l} strokeWidth="4" strokeLinecap="round" />
      <Eye x={80} y={25} />
    </g>
  ),
  // Tidal serpent — a swimming, finned sea-mount.
  stormfin: (c, d, l) => (
    <g>
      <path d="M16 60 Q40 40 64 56 Q84 68 88 54 Q86 74 64 70 Q40 78 16 60 Z" fill={c} />
      <path d="M30 50 L34 38 L42 52 Z" fill={l} /><path d="M48 48 L54 36 L60 52 Z" fill={l} />
      <path d="M70 52 Q88 44 90 30 Q78 34 70 46 Z" fill={d} />
      <ellipse cx="74" cy="56" rx="13" ry="11" fill={c} />
      <path d="M84 54 L92 50 L88 60 Z" fill={l} />
      <path d="M18 60 Q8 54 6 64 Q10 66 18 64 Z" fill={l} />
      <Eye x={78} y={53} />
    </g>
  ),
  // Sky-glider — broad wings, a graceful flier.
  updrift: (c, d, l) => (
    <g>
      <path d="M48 50 Q14 24 10 50 Q12 64 48 58 Z" fill={c} /><path d="M52 50 Q86 24 90 50 Q88 64 52 58 Z" fill={c} />
      <path d="M48 52 Q24 40 18 52" fill="none" stroke={l} strokeWidth="2.4" /><path d="M52 52 Q76 40 82 52" fill="none" stroke={l} strokeWidth="2.4" />
      <ellipse cx="50" cy="56" rx="13" ry="15" fill={d} />
      <ellipse cx="50" cy="44" rx="9" ry="8" fill={c} />
      <path d="M50 50 L46 55 L54 55 Z" fill={l} />
      <Eye x={45} y={44} /><Eye x={55} y={44} />
    </g>
  ),
  // Legendary guardian — armored, horned, regal.
  arganterion: (c, d, l) => (
    <g>
      <path d="M30 64 L28 84 M46 66 L44 84 M60 66 L62 84 M76 60 L80 82" stroke={d} strokeWidth="6" strokeLinecap="round" />
      <ellipse cx="52" cy="54" rx="32" ry="18" fill={c} />
      <path d="M30 40 L36 54 L46 42 L54 56 L62 42 L70 54 L74 44" fill="none" stroke={l} strokeWidth="3" strokeLinejoin="round" />
      <path d="M72 48 Q84 38 82 22 Q76 26 72 34 Q68 42 66 50 Z" fill={c} />
      <ellipse cx="80" cy="24" rx="8" ry="10" fill={c} />
      <path d="M74 16 L70 4 L80 14 Z" fill={l} /><path d="M86 16 L90 4 L80 14 Z" fill={l} />
      <path d="M78 14 Q80 8 84 10" fill="none" stroke="#facc15" strokeWidth="2.4" strokeLinecap="round" />
      <Eye x={82} y={23} />
    </g>
  ),
  // Cheerful meadow pony — soft mane + tail.
  meadowpony: (c, d, l) => (
    <g>
      <path d="M32 64 L30 84 M46 66 L44 84 M60 66 L62 84 M74 62 L78 82" stroke={d} strokeWidth="6" strokeLinecap="round" />
      <ellipse cx="52" cy="56" rx="28" ry="16" fill={c} />
      <path d="M70 50 Q80 40 80 28 Q72 30 68 40 Q64 48 62 52 Z" fill={c} />
      <ellipse cx="80" cy="28" rx="8" ry="7" fill={c} />
      <ellipse cx="86" cy="30" rx="4" ry="3" fill={l} />
      <path d="M76 22 L74 14 L82 20 Z" fill={c} />
      <path d="M70 30 Q66 44 70 52" fill="none" stroke={l} strokeWidth="4" strokeLinecap="round" />
      <path d="M24 54 Q14 58 16 72" fill="none" stroke={l} strokeWidth="5" strokeLinecap="round" />
      <Eye x={82} y={27} />
    </g>
  ),
  // Blazing fox spirit — pointed ears, flame tail.
  emberfox: (c, d, l) => (
    <g>
      <path d="M34 64 L32 82 M48 66 L46 82 M60 66 L62 82 M72 62 L76 80" stroke={d} strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="52" cy="56" rx="27" ry="15" fill={c} />
      <path d="M70 52 Q82 46 82 34 Q74 36 70 44 Z" fill={c} />
      <ellipse cx="78" cy="42" rx="9" ry="8" fill={c} />
      <path d="M72 34 L70 24 L78 32 Z" fill={d} /><path d="M84 34 L88 24 L80 32 Z" fill={d} />
      <path d="M82 46 L90 46 L84 50 Z" fill={l} />
      <path d="M26 54 Q10 50 14 66 Q18 60 24 62 Q16 70 28 66 Z" fill={l} />
      <Eye x={80} y={41} />
    </g>
  ),
  // Frost elk — branching antlers, calm.
  frostelk: (c, d, l) => (
    <g>
      <path d="M34 64 L32 84 M48 66 L46 84 M60 66 L62 84 M74 62 L78 82" stroke={d} strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="52" cy="56" rx="28" ry="15" fill={c} />
      <path d="M70 50 Q80 42 80 30 Q73 32 68 42 Z" fill={c} />
      <ellipse cx="80" cy="30" rx="8" ry="9" fill={c} />
      <path d="M76 22 Q70 10 64 12 M76 20 Q72 14 66 16" stroke={l} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M84 22 Q90 10 96 12 M84 20 Q88 14 94 16" stroke={l} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <ellipse cx="84" cy="34" rx="4" ry="3" fill={l} />
      <Eye x={82} y={29} />
    </g>
  ),
  // Storm ram — curled horns, fluffy coat, a little bolt.
  thunderram: (c, d, l) => (
    <g>
      <path d="M34 64 L32 82 M48 66 L46 82 M60 66 L62 82 M72 62 L76 80" stroke={d} strokeWidth="6" strokeLinecap="round" />
      <ellipse cx="50" cy="56" rx="29" ry="17" fill={c} />
      <circle cx="36" cy="50" r="8" fill={l} opacity="0.5" /><circle cx="52" cy="48" r="8" fill={l} opacity="0.5" />
      <ellipse cx="76" cy="50" rx="11" ry="10" fill={c} />
      <path d="M70 44 Q62 40 64 50 Q66 56 72 52" fill="none" stroke={d} strokeWidth="4" strokeLinecap="round" />
      <path d="M82 44 Q90 40 88 50 Q86 56 80 52" fill="none" stroke={d} strokeWidth="4" strokeLinecap="round" />
      <path d="M20 40 L26 40 L22 48 L28 48 L18 60 L22 50 L16 50 Z" fill="#fde047" />
      <Eye x={79} y={49} />
    </g>
  ),
  // Sleek night panther — pointed ears, curling tail.
  shadowpanther: (c, d, l) => (
    <g>
      <path d="M32 64 L30 82 M46 66 L44 82 M60 66 L62 82 M74 62 L78 80" stroke={d} strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="50" cy="58" rx="30" ry="13" fill={c} />
      <ellipse cx="78" cy="50" rx="11" ry="9" fill={c} />
      <path d="M72 42 L70 34 L77 40 Z" fill={c} /><path d="M84 42 L86 34 L79 40 Z" fill={c} />
      <path d="M22 56 Q8 52 12 40 Q16 48 24 50" fill="none" stroke={c} strokeWidth="5" strokeLinecap="round" />
      <path d="M84 50 L92 48 L86 54 Z" fill={l} />
      <Eye x={75} y={49} /><Eye x={82} y={49} />
    </g>
  ),
  // Crystalline sky-dragon — faceted wings, horns.
  crystaldrake: (c, d, l) => (
    <g>
      <path d="M46 50 Q18 28 14 52 Q18 62 46 56 Z" fill={d} /><path d="M54 50 Q82 28 86 52 Q82 62 54 56 Z" fill={d} />
      <path d="M40 48 L30 46 L36 54 Z" fill={l} opacity="0.7" /><path d="M60 48 L70 46 L64 54 Z" fill={l} opacity="0.7" />
      <ellipse cx="50" cy="56" rx="15" ry="14" fill={c} />
      <ellipse cx="62" cy="46" rx="9" ry="7" fill={c} />
      <path d="M58 38 L56 28 L62 36 Z" fill={l} /><path d="M66 38 L70 28 L64 36 Z" fill={l} />
      <path d="M70 46 L78 44 L72 50 Z" fill={l} />
      <path d="M36 60 Q24 66 28 76" fill="none" stroke={c} strokeWidth="4" strokeLinecap="round" />
      <Eye x={62} y={45} />
    </g>
  ),
}

export interface MountSpriteProps {
  /** a mount id ('mount:sandstrider') OR a bare render key ('sandstrider') */
  mount?: string
  render?: string
  color?: string
  size?: number
  className?: string
}

export default function MountSprite({ mount, render, color, size = 130, className }: MountSpriteProps) {
  const key0 = render ?? (mount ? mount.replace(/^mount:/, '') : 'sandstrider')
  const key = key0
  const c = color ?? '#f59e0b'
  const art = ART[key] ?? ART.sandstrider
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role="img" aria-label={key}>
      <ellipse cx="52" cy="90" rx="34" ry="5" fill="rgba(0,0,0,0.16)" />
      {art(c, shade(c, -0.24), shade(c, 0.3))}
    </svg>
  )
}
