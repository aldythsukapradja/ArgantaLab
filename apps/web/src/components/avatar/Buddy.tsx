// The ArgantaLab companion — one character that lives everywhere (Play home +
// inside every learn world) so kids form an emotional attachment, Duolingo-style.
// Roblox-style: 6 independent cosmetic slots (skin · hat · face · back · hand · bg)
// layered onto the body, so kids mix-and-match a look that's truly theirs.

import type { ReactNode } from 'react'
import type { ResolvedOutfit } from '@/data/cosmetics'

export type Mood = 'idle' | 'happy' | 'celebrate' | 'think' | 'sad' | 'wave'
// Legacy single-accessory (per-world costumes) — still supported.
export type Accessory = { kind: 'visor' | 'cape' | 'goggles' | 'headset' | 'hat' | 'backpack'; color: string }

interface Props {
  mood?: Mood
  size?: number
  color?: string          // fallback body colour when no skin set
  look?: { x: number; y: number }  // pupil direction, each -1..1
  bob?: boolean           // gentle floating idle animation
  accessory?: Accessory   // legacy per-world costume
  outfit?: ResolvedOutfit // new 6-slot cosmetic loadout
  showBg?: boolean        // draw the background scene (dressing room / shop only)
  className?: string
}

export default function Buddy({
  mood = 'idle', size = 120, color = '#8b5cf6', look = { x: 0, y: 0 },
  bob = true, accessory, outfit, showBg = false, className = '',
}: Props) {
  // skin slot overrides the body colour
  const body = outfit?.skin ? skinColor(outfit.skin.render, outfit.skin.color) : color
  const dark = shade(body, -28)
  const light = shade(body, 22)
  const lx = Math.max(-1, Math.min(1, look.x)) * 3
  const ly = Math.max(-1, Math.min(1, mood === 'think' ? -1 : mood === 'sad' ? 0.6 : look.y)) * 3

  const eyeY = 52
  const cls = `buddy ${bob ? 'buddy-bob' : ''} ${mood === 'celebrate' ? 'buddy-pop' : ''} ${className}`
  const uid = body.slice(1)

  return (
    <svg className={cls} width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <defs>
        <radialGradient id={`bd-${uid}`} cx="42%" cy="34%">
          <stop offset="0%" stopColor={light} />
          <stop offset="72%" stopColor={body} />
          <stop offset="100%" stopColor={dark} />
        </radialGradient>
        {outfit?.bg && bgDefs(outfit.bg.render)}
        {outfit?.skin && skinDefs(outfit.skin.render)}
      </defs>

      {/* background scene */}
      {showBg && outfit?.bg && bgScene(outfit.bg.render, outfit.bg.color)}

      {/* back slot (wings, cape, jetpack) — behind everything */}
      {outfit?.back && backRender(outfit.back.render, outfit.back.color)}
      {accessory && accBehind(accessory)}

      {/* ears */}
      <ellipse cx="30" cy="28" rx="9" ry="14" fill={dark} />
      <ellipse cx="70" cy="28" rx="9" ry="14" fill={dark} />
      <ellipse cx="30" cy="28" rx="4.5" ry="8" fill={light} opacity="0.5" />
      <ellipse cx="70" cy="28" rx="4.5" ry="8" fill={light} opacity="0.5" />

      {/* body */}
      <ellipse cx="50" cy="55" rx="33" ry="31" fill={`url(#bd-${uid})`} />
      <ellipse cx="40" cy="40" rx="14" ry="10" fill="#fff" opacity="0.07" />
      {outfit?.skin && skinOverlay(outfit.skin.render)}

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

      {/* face slot (glasses, goggles, visor) */}
      {outfit?.face && faceRender(outfit.face.render, outfit.face.color)}
      {accessory && accFront(accessory)}

      {/* hat slot — drawn last so it sits on top */}
      {outfit?.hat && hatRender(outfit.hat.render, outfit.hat.color)}

      {/* hand slot — held item to the side */}
      {outfit?.hand && handRender(outfit.hand.render, outfit.hand.color)}
    </svg>
  )
}

// ════════════════════════════════════════════════════════════
//  SKIN  — body colour + optional pattern overlay
// ════════════════════════════════════════════════════════════
function skinColor(_render: string, fallback: string): string {
  return fallback // each cosmetic already carries its base colour
}
function skinDefs(render: string) {
  if (render === 'galaxy') return (
    <radialGradient id="sk-galaxy" cx="50%" cy="40%">
      <stop offset="0%" stopColor="#a78bfa" /><stop offset="60%" stopColor="#6d28d9" /><stop offset="100%" stopColor="#1e1b4b" />
    </radialGradient>
  )
  if (render === 'rainbow') return (
    <linearGradient id="sk-rainbow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#f43f5e" /><stop offset="33%" stopColor="#f59e0b" /><stop offset="66%" stopColor="#22c55e" /><stop offset="100%" stopColor="#6366f1" />
    </linearGradient>
  )
  if (render === 'golden') return (
    <linearGradient id="sk-golden" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#fef9c3" /><stop offset="45%" stopColor="#facc15" /><stop offset="100%" stopColor="#b45309" />
    </linearGradient>
  )
  return null
}
function skinOverlay(render: string) {
  switch (render) {
    case 'galaxy': return <ellipse cx="50" cy="55" rx="33" ry="31" fill="url(#sk-galaxy)" opacity="0.85" />
    case 'rainbow': return <ellipse cx="50" cy="55" rx="33" ry="31" fill="url(#sk-rainbow)" opacity="0.7" />
    case 'golden': return <ellipse cx="50" cy="55" rx="33" ry="31" fill="url(#sk-golden)" opacity="0.85" />
    case 'robot': return (
      <g stroke="#475569" strokeWidth="0.9" fill="none" opacity="0.55">
        <path d="M30 50 H70 M30 62 H70 M50 40 V78" />
        <circle cx="40" cy="76" r="1.6" fill="#475569" /><circle cx="60" cy="76" r="1.6" fill="#475569" />
      </g>
    )
    case 'dragon': return (
      <g fill="#991b1b" opacity="0.5">
        <path d="M40 70 l3 5 l3 -5 z" /><path d="M50 72 l3 5 l3 -5 z" /><path d="M30 64 l3 5 l3 -5 z" /><path d="M60 64 l3 5 l3 -5 z" />
      </g>
    )
    case 'lava': return (
      <g fill="#fbbf24" opacity="0.55"><path d="M36 48 q4 8 0 16" stroke="#fbbf24" strokeWidth="1.4" fill="none" /><path d="M58 44 q5 9 1 18" stroke="#fde047" strokeWidth="1.4" fill="none" /><circle cx="48" cy="60" r="2" /></g>
    )
    case 'ice': return (
      <g stroke="#fff" strokeWidth="1" opacity="0.6" fill="none"><path d="M42 48 l4 4 l-4 4 M58 56 l-4 4 l4 4 M50 44 v8" /></g>
    )
    case 'slime': return <ellipse cx="44" cy="46" rx="9" ry="6" fill="#fff" opacity="0.25" />
    case 'alien': return <g fill="#15803d" opacity="0.5"><circle cx="38" cy="44" r="2" /><circle cx="62" cy="46" r="1.6" /><circle cx="52" cy="40" r="1.4" /></g>
    default: return null
  }
}

// ════════════════════════════════════════════════════════════
//  HAT
// ════════════════════════════════════════════════════════════
function hatRender(render: string, col: string) {
  const dark = shade(col, -24), light = shade(col, 26)
  switch (render) {
    case 'cap': return <g><path d="M30 22 Q50 4 70 22 Z" fill={col} /><path d="M30 22 Q50 18 70 22 L80 24 Q66 28 30 22 Z" fill={dark} /><circle cx="50" cy="9" r="2.4" fill={light} /></g>
    case 'beanie': return <g><path d="M31 22 Q50 2 69 22 Z" fill={col} /><rect x="29" y="20" width="42" height="6" rx="3" fill={dark} /><circle cx="50" cy="5" r="3.4" fill={light} /></g>
    case 'beret': return <g><ellipse cx="50" cy="16" rx="22" ry="9" fill={col} /><ellipse cx="50" cy="14" rx="18" ry="6" fill={light} opacity="0.5" /><circle cx="50" cy="8" r="2" fill={dark} /></g>
    case 'flower': return <g><path d="M28 22 Q50 16 72 22" stroke="#16a34a" strokeWidth="4" fill="none" />{[30, 42, 54, 66].map((x, i) => <g key={i}><circle cx={x} cy={18 - (i === 1 || i === 2 ? 3 : 0)} r="4.5" fill={col} /><circle cx={x} cy={18 - (i === 1 || i === 2 ? 3 : 0)} r="1.8" fill="#fde047" /></g>)}</g>
    case 'party': return <g><path d="M50 0 L40 24 L60 24 Z" fill={col} /><path d="M50 0 L45 12 L55 12 Z" fill={light} /><circle cx="50" cy="0" r="3" fill="#fde047" /><circle cx="45" cy="14" r="1.5" fill="#fff" /><circle cx="55" cy="19" r="1.5" fill="#fff" /></g>
    case 'bucket': return <g><path d="M30 20 Q50 8 70 20 L70 24 L30 24 Z" fill={col} /><path d="M26 23 H74 L70 28 H30 Z" fill={dark} /></g>
    case 'cowboy': return <g><path d="M22 24 Q50 30 78 24 Q50 16 22 24 Z" fill={col} /><path d="M36 22 Q50 2 64 22 Z" fill={col} /><rect x="36" y="20" width="28" height="4" fill={dark} /></g>
    case 'chef': return <g><rect x="36" y="14" width="28" height="12" rx="3" fill="#fff" /><ellipse cx="42" cy="12" rx="7" ry="7" fill="#fff" /><ellipse cx="50" cy="9" rx="8" ry="8" fill="#fff" /><ellipse cx="58" cy="12" rx="7" ry="7" fill="#fff" /></g>
    case 'grad': return <g><rect x="40" y="16" width="20" height="7" rx="2" fill={col} /><path d="M28 14 L50 8 L72 14 L50 20 Z" fill={col} /><circle cx="72" cy="14" r="1.8" fill="#fde047" /><path d="M72 14 V24" stroke="#fde047" strokeWidth="1.4" /></g>
    case 'pirate': return <g><path d="M26 22 Q50 28 74 22 Q72 12 50 12 Q28 12 26 22 Z" fill={col} /><path d="M50 14 l-2 4 m4 0 l-2 -4" stroke="#fff" strokeWidth="1.4" /><circle cx="50" cy="18" r="2.4" fill="#fff" /><path d="M47 22 l6 0 M50 19 l0 6" stroke={col} strokeWidth="1" /></g>
    case 'wizard': return <g><path d="M50 -4 L36 24 L64 24 Z" fill={col} /><path d="M34 23 H66 L70 28 H30 Z" fill={dark} /><text x="46" y="18" fontSize="8">⭐</text><circle cx="50" cy="-3" r="2.6" fill="#fde047" /></g>
    case 'tophat': return <g><rect x="38" y="0" width="24" height="22" rx="2" fill={col} /><rect x="38" y="16" width="24" height="6" fill={dark} /><rect x="28" y="22" width="44" height="4" rx="2" fill={col} /><rect x="38" y="15" width="24" height="3" fill="#ef4444" /></g>
    case 'halo': return <g><ellipse cx="50" cy="8" rx="16" ry="5" fill="none" stroke="#fde047" strokeWidth="3" /><ellipse cx="50" cy="8" rx="16" ry="5" fill="none" stroke="#fff" strokeWidth="1" opacity="0.7" /></g>
    case 'crown': return <g><path d="M32 24 L32 12 L40 18 L50 8 L60 18 L68 12 L68 24 Z" fill={col} /><rect x="32" y="22" width="36" height="4" fill={shade(col, -18)} /><circle cx="50" cy="13" r="2.4" fill="#ef4444" /><circle cx="38" cy="18" r="1.8" fill="#3b82f6" /><circle cx="62" cy="18" r="1.8" fill="#22c55e" /></g>
    default: return null
  }
}

// ════════════════════════════════════════════════════════════
//  FACE
// ════════════════════════════════════════════════════════════
function faceRender(render: string, col: string) {
  const dark = shade(col, -26)
  switch (render) {
    case 'glasses': return <g fill="none" stroke={col} strokeWidth="2.6"><circle cx="40" cy="52" r="9" /><circle cx="60" cy="52" r="9" /><path d="M49 52 h2" /><path d="M31 50 l-6 -2 M69 50 l6 -2" /></g>
    case 'shades': return <g><rect x="29" y="46" width="20" height="12" rx="5" fill={col} /><rect x="51" y="46" width="20" height="12" rx="5" fill={col} /><path d="M49 50 h2 M29 48 l-5 -2 M71 48 l5 -2" stroke={col} strokeWidth="2.4" /><rect x="32" y="48" width="6" height="3" rx="1.5" fill="#fff" opacity="0.5" /></g>
    case 'star': return <g><path d="M28 46 h18 v12 h-18 z" fill={col} opacity="0.9" rx="4" /><path d="M54 46 h18 v12 h-18 z" fill={col} opacity="0.9" /><text x="34" y="57" fontSize="10">⭐</text><text x="60" y="57" fontSize="10">⭐</text><path d="M46 50 h8" stroke={col} strokeWidth="2.4" /></g>
    case 'monocle': return <g fill="none" stroke={col} strokeWidth="2.6"><circle cx="60" cy="52" r="9" /><circle cx="60" cy="52" r="9" fill="#fff" opacity="0.12" stroke="none" /><path d="M60 61 v8" /></g>
    case 'goggles': return <g fill="none" stroke={col} strokeWidth="3.4"><circle cx="40" cy="52" r="11" /><circle cx="60" cy="52" r="11" /><path d="M51 52h-2" /><path d="M29 50 L22 48" /><path d="M71 50 L78 48" /><circle cx="40" cy="52" r="11" fill="#bfe9ff" opacity="0.18" stroke="none" /><circle cx="60" cy="52" r="11" fill="#bfe9ff" opacity="0.18" stroke="none" /></g>
    case 'eyepatch': return <g><path d="M52 44 L72 48 L70 60 L54 58 Z" fill={col} /><path d="M30 46 Q50 42 72 47" stroke={col} strokeWidth="2" fill="none" /></g>
    case 'ski': return <g><rect x="28" y="44" width="44" height="14" rx="7" fill={col} /><rect x="31" y="47" width="38" height="8" rx="4" fill="#bfe9ff" opacity="0.5" /><rect x="33" y="48" width="10" height="3" rx="1.5" fill="#fff" opacity="0.7" /></g>
    case '3d': return <g><rect x="29" y="46" width="20" height="11" rx="2" fill="#ef4444" opacity="0.7" /><rect x="51" y="46" width="20" height="11" rx="2" fill="#06b6d4" opacity="0.7" /><path d="M49 50 h2" stroke="#1e293b" strokeWidth="2" /></g>
    case 'vr': return <g><rect x="26" y="42" width="48" height="18" rx="6" fill={col} /><rect x="30" y="46" width="40" height="10" rx="4" fill="#0f172a" /><circle cx="40" cy="51" r="2.4" fill="#22d3ee" /><circle cx="60" cy="51" r="2.4" fill="#22d3ee" /><path d="M26 50 H18 M74 50 H82" stroke={col} strokeWidth="3" /></g>
    case 'cyber': return <g><path d="M26 48 L74 44 L74 56 L26 56 Z" fill={col} opacity="0.85" /><path d="M30 50 H70" stroke="#fff" strokeWidth="1.4" opacity="0.8" /><circle cx="66" cy="50" r="1.8" fill="#fff" /></g>
    default: return null
  }
}

// ════════════════════════════════════════════════════════════
//  BACK  (behind the body)
// ════════════════════════════════════════════════════════════
function backRender(render: string, col: string) {
  const dark = shade(col, -22), light = shade(col, 28)
  switch (render) {
    case 'backpack': return <g><rect x="70" y="48" width="17" height="26" rx="5" fill={col} /><rect x="73" y="52" width="11" height="8" rx="2" fill={dark} /><path d="M74 48 q4 -6 0 -10" stroke={col} strokeWidth="3" fill="none" /></g>
    case 'scarf': return <g><path d="M30 70 Q50 78 70 70 L70 76 Q50 84 30 76 Z" fill={col} /><path d="M64 74 L70 92 L78 88 L72 72 Z" fill={dark} /></g>
    case 'cape': return <g><path d="M26 46 L74 46 L84 92 Q50 102 16 92 Z" fill={col} /><path d="M26 46 L74 46 L70 56 Q50 60 30 56 Z" fill={dark} /></g>
    case 'shell': return <g><ellipse cx="50" cy="60" rx="36" ry="32" fill={col} /><path d="M30 50 Q50 46 70 50 M28 62 Q50 58 72 62 M50 30 V90" stroke={dark} strokeWidth="2" fill="none" /></g>
    case 'balloon': return <g>{[[78, 30, '#ef4444'], [86, 40, '#3b82f6'], [82, 24, '#22c55e']].map(([x, y, cc], i) => <g key={i}><ellipse cx={x as number} cy={y as number} rx="7" ry="8.5" fill={cc as string} /><path d={`M${x} ${(y as number) + 8} L60 60`} stroke="#94a3b8" strokeWidth="0.8" /></g>)}</g>
    case 'fairywings': return <g opacity="0.85"><ellipse cx="22" cy="48" rx="14" ry="22" fill={col} transform="rotate(-20 22 48)" /><ellipse cx="78" cy="48" rx="14" ry="22" fill={col} transform="rotate(20 78 48)" /><ellipse cx="24" cy="68" rx="10" ry="15" fill={light} transform="rotate(-30 24 68)" /><ellipse cx="76" cy="68" rx="10" ry="15" fill={light} transform="rotate(30 76 68)" /></g>
    case 'batwings': return <g fill={col}><path d="M30 44 Q6 40 4 64 Q16 56 20 64 Q24 56 30 64 Z" /><path d="M70 44 Q94 40 96 64 Q84 56 80 64 Q76 56 70 64 Z" /></g>
    case 'jetpack': return <g><rect x="68" y="46" width="9" height="24" rx="4" fill={col} /><rect x="79" y="46" width="9" height="24" rx="4" fill={col} /><ellipse cx="72.5" cy="74" rx="3.5" ry="6" fill="#f97316" /><ellipse cx="83.5" cy="74" rx="3.5" ry="6" fill="#fbbf24" /></g>
    case 'angelwings': return <g fill={col}><path d="M32 42 Q4 36 8 70 Q18 58 24 66 Q26 54 34 60 Z" /><path d="M68 42 Q96 36 92 70 Q82 58 76 66 Q74 54 66 60 Z" /></g>
    case 'dragonwings': return <g fill={col}><path d="M30 42 Q2 34 6 70 L18 58 L20 70 L28 60 L30 70 Z" stroke={dark} strokeWidth="1.4" /><path d="M70 42 Q98 34 94 70 L82 58 L80 70 L72 60 L70 70 Z" stroke={dark} strokeWidth="1.4" /></g>
    case 'rocket': return <g><rect x="76" y="40" width="14" height="28" rx="7" fill={col} /><path d="M76 40 Q83 30 90 40 Z" fill={dark} /><circle cx="83" cy="50" r="3" fill="#bfe9ff" /><path d="M74 64 L76 72 L78 64 Z M88 64 L90 72 L92 64 Z" fill={dark} /><ellipse cx="83" cy="72" rx="4" ry="7" fill="#f97316" /></g>
    default: return null
  }
}

// ════════════════════════════════════════════════════════════
//  HAND  (held item to the right)
// ════════════════════════════════════════════════════════════
function handRender(render: string, col: string) {
  const dark = shade(col, -24), light = shade(col, 28)
  switch (render) {
    case 'pencil': return <g><rect x="82" y="46" width="5" height="30" rx="1.5" fill={col} transform="rotate(18 84 60)" /><path d="M88 44 l-4 4 l3 3 z" fill="#1e293b" transform="rotate(18 84 60)" /><rect x="82" y="72" width="5" height="4" fill="#f472b6" transform="rotate(18 84 60)" /></g>
    case 'book': return <g><rect x="78" y="56" width="18" height="14" rx="2" fill={col} transform="rotate(-12 87 63)" /><path d="M87 56 V70" stroke="#fff" strokeWidth="1.4" transform="rotate(-12 87 63)" /><path d="M80 60 H85 M89 60 H94" stroke="#fff" strokeWidth="0.8" transform="rotate(-12 87 63)" /></g>
    case 'balloon': return <g><ellipse cx="88" cy="40" rx="9" ry="11" fill={col} /><path d="M88 51 Q84 60 86 70" stroke="#94a3b8" strokeWidth="1" fill="none" /><path d="M88 51 l-2 3 l4 0 z" fill={col} /></g>
    case 'flag': return <g><rect x="84" y="44" width="2.5" height="32" fill="#94a3b8" /><path d="M86 44 L100 49 L86 54 Z" fill={col} /></g>
    case 'paintbrush': return <g><rect x="84" y="54" width="4" height="24" rx="2" fill="#b45309" transform="rotate(20 86 66)" /><path d="M84 50 h6 l-1 8 h-4 z" fill={col} transform="rotate(20 86 66)" /></g>
    case 'torch': return <g><rect x="84" y="58" width="5" height="20" rx="2" fill="#78350f" transform="rotate(14 86 68)" /><path d="M86 58 q-5 -8 0 -14 q5 6 0 14" fill="#f97316" transform="rotate(14 86 68)" /><path d="M86 54 q-2 -4 0 -7 q2 3 0 7" fill="#fde047" transform="rotate(14 86 68)" /></g>
    case 'mic': return <g><ellipse cx="87" cy="48" rx="6" ry="8" fill={col} /><path d="M82 48 a5 8 0 0 0 10 0" fill="none" stroke={dark} strokeWidth="1.4" /><rect x="86" y="56" width="2" height="18" fill="#475569" /></g>
    case 'shield': return <g><path d="M86 46 L98 50 Q98 68 86 74 Q74 68 74 50 Z" fill={col} stroke={dark} strokeWidth="1.6" /><path d="M86 52 V68 M79 58 H93" stroke="#fff" strokeWidth="1.8" /></g>
    case 'trophy': return <g><path d="M80 46 H94 L92 56 Q86 60 82 56 Z" fill={col} /><path d="M80 48 Q74 50 78 54 M94 48 Q100 50 96 54" stroke={col} strokeWidth="1.6" fill="none" /><rect x="85" y="58" width="4" height="6" fill={dark} /><rect x="80" y="64" width="14" height="4" rx="1" fill={dark} /></g>
    case 'wand': return <g><rect x="84" y="50" width="4" height="26" rx="2" fill="#1e293b" transform="rotate(22 86 63)" /><path d="M90 44 l2 5 l5 1 l-5 2 l-1 5 l-2 -5 l-5 -1 l5 -2 z" fill={col} /></g>
    case 'sword': return <g><rect x="85" y="40" width="4" height="30" fill={col} transform="rotate(20 87 55)" /><rect x="80" y="68" width="14" height="3" rx="1.5" fill="#b45309" transform="rotate(20 87 55)" /><rect x="86" y="70" width="2" height="6" fill="#78350f" transform="rotate(20 87 55)" /></g>
    case 'saber': return <g><rect x="85" y="38" width="4" height="30" rx="2" fill={col} transform="rotate(18 87 53)" /><rect x="85" y="38" width="4" height="30" rx="2" fill="#fff" opacity="0.5" transform="rotate(18 87 53)" /><rect x="84" y="66" width="6" height="9" rx="2" fill="#64748b" transform="rotate(18 87 53)" /></g>
    default: return null
  }
}

// ════════════════════════════════════════════════════════════
//  BACKGROUND scenes
// ════════════════════════════════════════════════════════════
function bgDefs(render: string) {
  const defs: Record<string, ReactNode> = {
    sky: <linearGradient id="bg-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7dd3fc" /><stop offset="100%" stopColor="#e0f2fe" /></linearGradient>,
    sunset: <linearGradient id="bg-sunset" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb7185" /><stop offset="60%" stopColor="#fdba74" /><stop offset="100%" stopColor="#fef3c7" /></linearGradient>,
    space: <radialGradient id="bg-space" cx="50%" cy="40%"><stop offset="0%" stopColor="#312e81" /><stop offset="100%" stopColor="#0b1020" /></radialGradient>,
    galaxy: <radialGradient id="bg-galaxy" cx="40%" cy="35%"><stop offset="0%" stopColor="#a855f7" /><stop offset="55%" stopColor="#6d28d9" /><stop offset="100%" stopColor="#1e1b4b" /></radialGradient>,
    underwater: <linearGradient id="bg-underwater" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0ea5e9" /><stop offset="100%" stopColor="#0c4a6e" /></linearGradient>,
    forest: <linearGradient id="bg-forest" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#86efac" /><stop offset="100%" stopColor="#15803d" /></linearGradient>,
    beach: <linearGradient id="bg-beach" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7dd3fc" /><stop offset="55%" stopColor="#bae6fd" /><stop offset="55%" stopColor="#fde68a" /><stop offset="100%" stopColor="#fbbf24" /></linearGradient>,
    candy: <linearGradient id="bg-candy" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f9a8d4" /><stop offset="100%" stopColor="#c084fc" /></linearGradient>,
    city: <linearGradient id="bg-city" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4338ca" /><stop offset="100%" stopColor="#0f172a" /></linearGradient>,
    grid: <linearGradient id="bg-grid" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#312e81" /><stop offset="100%" stopColor="#1e1b4b" /></linearGradient>,
    rainbow: <linearGradient id="bg-rainbow" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f43f5e" /><stop offset="25%" stopColor="#f59e0b" /><stop offset="50%" stopColor="#22c55e" /><stop offset="75%" stopColor="#06b6d4" /><stop offset="100%" stopColor="#8b5cf6" /></linearGradient>,
    studio: <radialGradient id="bg-studio" cx="50%" cy="40%"><stop offset="0%" stopColor="#334155" /><stop offset="100%" stopColor="#1e293b" /></radialGradient>,
  }
  return defs[render] ?? null
}
function bgScene(render: string, col: string) {
  const fill = `url(#bg-${render})`
  const known = ['sky', 'sunset', 'space', 'galaxy', 'underwater', 'forest', 'beach', 'candy', 'city', 'grid', 'rainbow', 'studio']
  const base = <rect x="0" y="0" width="100" height="100" rx="14" fill={known.includes(render) ? fill : col} />
  switch (render) {
    case 'space': case 'galaxy': return <g>{base}{[[18, 22], [80, 18], [70, 36], [26, 70], [86, 76], [50, 14], [12, 50]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 2 ? 1.2 : 0.8} fill="#fff" opacity="0.9" />)}<circle cx="78" cy="80" r="6" fill="#fbbf24" opacity="0.5" /></g>
    case 'sky': return <g>{base}<ellipse cx="26" cy="28" rx="11" ry="6" fill="#fff" opacity="0.9" /><ellipse cx="74" cy="20" rx="9" ry="5" fill="#fff" opacity="0.85" /><circle cx="82" cy="76" r="8" fill="#fde047" opacity="0.7" /></g>
    case 'sunset': return <g>{base}<circle cx="50" cy="60" r="14" fill="#fef08a" opacity="0.85" /><ellipse cx="30" cy="40" rx="8" ry="3" fill="#fff" opacity="0.6" /></g>
    case 'forest': return <g>{base}<path d="M14 88 L22 64 L30 88 Z" fill="#166534" /><path d="M70 90 L80 60 L90 90 Z" fill="#166534" /><circle cx="80" cy="22" r="7" fill="#fde047" opacity="0.7" /></g>
    case 'beach': return <g>{base}<circle cx="78" cy="24" r="8" fill="#fde047" opacity="0.8" /><path d="M14 62 q8 -4 16 0" stroke="#0ea5e9" strokeWidth="1.4" fill="none" opacity="0.5" /></g>
    case 'underwater': return <g>{base}{[[24, 30], [76, 40], [40, 70], [82, 74]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.5 + (i % 2)} fill="#fff" opacity="0.4" />)}<path d="M10 92 q10 -10 20 0 q10 -10 20 0 q10 -10 20 0 q10 -10 20 0 V100 H10Z" fill="#0c4a6e" opacity="0.6" /></g>
    case 'city': return <g>{base}{[[12, 60], [24, 48], [36, 64], [64, 52], [76, 42], [88, 60]].map(([x, y], i) => <rect key={i} x={x} y={y} width="9" height={92 - y} fill="#1e293b" opacity="0.8" />)}{[[14, 64], [27, 54], [67, 58], [79, 48]].map(([x, y], i) => <rect key={`w${i}`} x={x} y={y} width="2" height="2" fill="#fde047" />)}</g>
    case 'candy': return <g>{base}{[[20, 26, '#fff'], [80, 30, '#fde047'], [30, 70, '#fff'], [74, 72, '#a7f3d0']].map(([x, y, cc], i) => <circle key={i} cx={x as number} cy={y as number} r="3.5" fill={cc as string} opacity="0.8" />)}</g>
    case 'grid': return <g>{base}<g stroke="#a855f7" strokeWidth="0.6" opacity="0.5">{[20, 40, 60, 80].map(v => <line key={`h${v}`} x1="0" y1={v} x2="100" y2={v} />)}{[20, 40, 60, 80].map(v => <line key={`v${v}`} x1={v} y1="0" x2={v} y2="100" />)}</g></g>
    case 'rainbow': return <g>{base}<g fill="none" strokeWidth="3" opacity="0.4"><path d="M6 96 A44 44 0 0 1 94 96" stroke="#fff" /></g></g>
    default: return base
  }
}

// ── legacy per-world accessories (kept for World/Fame costumes) ──
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
    default: return null
  }
}

// lighten/darken a #rrggbb hex by percent (-100..100)
function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const f = (cc: number) => Math.max(0, Math.min(255, Math.round(cc + (pct / 100) * 255)))
  return `#${((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1)}`
}
