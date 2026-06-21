// The ArgantaLab companion — one character that lives everywhere (Play home +
// inside every learn world) so kids form an emotional attachment, Duolingo-style.
// Default name = the learner's own name (set elsewhere). Reacts with moods.

export type Mood = 'idle' | 'happy' | 'celebrate' | 'think' | 'sad' | 'wave'
export type Accessory = { kind: 'visor' | 'cape' | 'goggles' | 'headset' | 'hat' | 'backpack'; color: string }

interface Props {
  mood?: Mood
  size?: number
  color?: string          // body base colour (defaults to the brand purple)
  look?: { x: number; y: number }  // pupil direction, each -1..1
  bob?: boolean           // gentle floating idle animation
  accessory?: Accessory   // equipped costume
  className?: string
}

export default function Buddy({ mood = 'idle', size = 120, color = '#8b5cf6', look = { x: 0, y: 0 }, bob = true, accessory, className = '' }: Props) {
  const dark = shade(color, -28)
  const light = shade(color, 22)
  const lx = Math.max(-1, Math.min(1, look.x)) * 3
  const ly = Math.max(-1, Math.min(1, mood === 'think' ? -1 : mood === 'sad' ? 0.6 : look.y)) * 3

  const eyeY = 52
  const cls = `buddy ${bob ? 'buddy-bob' : ''} ${mood === 'celebrate' ? 'buddy-pop' : ''} ${className}`

  return (
    <svg className={cls} width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <defs>
        <radialGradient id={`bd-${color.slice(1)}`} cx="42%" cy="34%">
          <stop offset="0%" stopColor={light} />
          <stop offset="72%" stopColor={color} />
          <stop offset="100%" stopColor={dark} />
        </radialGradient>
      </defs>

      {/* costume — behind layer (cape, backpack) */}
      {accessory && accBehind(accessory)}

      {/* ears */}
      <ellipse cx="30" cy="28" rx="9" ry="14" fill={dark} />
      <ellipse cx="70" cy="28" rx="9" ry="14" fill={dark} />
      <ellipse cx="30" cy="28" rx="4.5" ry="8" fill={light} opacity="0.5" />
      <ellipse cx="70" cy="28" rx="4.5" ry="8" fill={light} opacity="0.5" />

      {/* body */}
      <ellipse cx="50" cy="55" rx="33" ry="31" fill={`url(#bd-${color.slice(1)})`} />
      <ellipse cx="40" cy="40" rx="14" ry="10" fill="#fff" opacity="0.07" />

      {/* eyes */}
      <circle cx="40" cy={eyeY} r="8.5" fill="#fff" />
      <circle cx="60" cy={eyeY} r="8.5" fill="#fff" />
      <circle cx={40 + lx} cy={eyeY + ly} r="4.6" fill="#1e1b34" />
      <circle cx={60 + lx} cy={eyeY + ly} r="4.6" fill="#1e1b34" />
      <circle cx={41.6 + lx} cy={eyeY - 1.4 + ly} r="1.8" fill="#fff" />
      <circle cx={61.6 + lx} cy={eyeY - 1.4 + ly} r="1.8" fill="#fff" />

      {/* cheeks */}
      <ellipse cx="30" cy="63" rx="6" ry="4" fill="#ff9ec4" opacity={mood === 'sad' ? 0.18 : 0.32} />
      <ellipse cx="70" cy="63" rx="6" ry="4" fill="#ff9ec4" opacity={mood === 'sad' ? 0.18 : 0.32} />

      {/* mouth */}
      {mood === 'celebrate' ? (
        <ellipse cx="50" cy="67" rx="7.5" ry="6" fill="#3a1f4d" />
      ) : mood === 'sad' ? (
        <path d="M42 70 Q50 63 58 70" stroke="#3a1f4d" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      ) : mood === 'think' ? (
        <path d="M46 67 Q50 69 54 67" stroke="#3a1f4d" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      ) : (
        <path d={`M41 64 Q50 ${mood === 'happy' || mood === 'wave' ? 73 : 70} 59 64`} stroke="#3a1f4d" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      )}

      {/* celebrate sparkles */}
      {mood === 'celebrate' && (
        <g className="buddy-sparkle">
          <text x="14" y="24" fontSize="13">✨</text>
          <text x="76" y="30" fontSize="11">⭐</text>
          <text x="80" y="72" fontSize="10">✨</text>
        </g>
      )}
      {mood === 'wave' && <text className="buddy-wave" x="78" y="60" fontSize="16">👋</text>}

      {/* costume — front layer (visor, goggles, headset, hat) */}
      {accessory && accFront(accessory)}
    </svg>
  )
}

// Accessories drawn BEHIND the body (so the body overlaps them).
function accBehind({ kind, color }: Accessory) {
  const dark = shade(color, -22)
  if (kind === 'cape') return (
    <g><path d="M26 46 L74 46 L84 92 Q50 102 16 92 Z" fill={color} />
      <path d="M26 46 L74 46 L70 56 Q50 60 30 56 Z" fill={dark} /></g>
  )
  if (kind === 'backpack') return (
    <g><rect x="72" y="48" width="16" height="24" rx="5" fill={color} />
      <rect x="75" y="52" width="10" height="7" rx="2" fill={dark} /></g>
  )
  return null
}

// Accessories drawn IN FRONT of the face.
function accFront({ kind, color }: Accessory) {
  const dark = shade(color, -26)
  const light = shade(color, 28)
  switch (kind) {
    case 'visor': return (
      <g><rect x="24" y="32" width="52" height="11" rx="5.5" fill={color} />
        <rect x="20" y="41" width="60" height="4" rx="2" fill={dark} />
        <rect x="28" y="34" width="20" height="3" rx="1.5" fill={light} opacity="0.6" /></g>
    )
    case 'goggles': return (
      <g fill="none" stroke={color} strokeWidth="3.4">
        <circle cx="40" cy="52" r="11" /><circle cx="60" cy="52" r="11" />
        <path d="M51 52h-2" /><path d="M29 50 L22 48" /><path d="M71 50 L78 48" />
        <circle cx="40" cy="52" r="11" fill="#bfe9ff" opacity="0.18" stroke="none" />
        <circle cx="60" cy="52" r="11" fill="#bfe9ff" opacity="0.18" stroke="none" /></g>
    )
    case 'headset': return (
      <g><path d="M27 30 Q50 6 73 30" stroke={color} strokeWidth="4.5" fill="none" />
        <rect x="21" y="24" width="9" height="13" rx="4" fill={color} />
        <rect x="70" y="24" width="9" height="13" rx="4" fill={color} />
        <path d="M75 32 Q84 46 64 51" stroke={dark} strokeWidth="2.6" fill="none" />
        <circle cx="64" cy="51" r="3" fill={dark} /></g>
    )
    case 'hat': return (
      <g><ellipse cx="50" cy="20" rx="31" ry="6.5" fill={dark} />
        <path d="M33 21 Q33 5 50 5 Q67 5 67 21 Z" fill={color} />
        <rect x="35" y="16" width="30" height="4" rx="2" fill={dark} /></g>
    )
    default: return null  // cape & backpack are behind-layer
  }
}

// lighten/darken a #rrggbb hex by percent (-100..100)
function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (pct / 100) * 255)))
  return `#${((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1)}`
}
