// ============================================================
//  ARGANTALAB · OPENWORLD · KinSprite  (data-driven, primitive SVG)
//  Mirrors components/avatar/Buddy.tsx: switch on a `render` art key, build
//  the creature from SVG primitives (no glyphs, no emoji). The catalog rows in
//  data/openworld/kin.ts pick the render key + color; this file owns the art.
//  Adding a kin that reuses a look = a data row only. A brand-new look = one
//  more case here. Color is tinted per row so palette stays data-driven.
// ============================================================

import { kin as kinDef } from '@/data/openworld'

// Lighten/darken a #rrggbb by pct (same approach as Buddy's shade()).
function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, Math.max(0, (n >> 16) + Math.round(255 * pct)))
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) + Math.round(255 * pct)))
  const b = Math.min(255, Math.max(0, (n & 255) + Math.round(255 * pct)))
  return `rgb(${r},${g},${b})`
}

// Two cute eyes + a soft smile, reused by every kin so they feel related.
function Face({ x = 50, y = 52, gap = 9, r = 4, smile = true }: { x?: number; y?: number; gap?: number; r?: number; smile?: boolean }) {
  return (
    <>
      <circle cx={x - gap} cy={y} r={r} fill="#1f2937" />
      <circle cx={x + gap} cy={y} r={r} fill="#1f2937" />
      <circle cx={x - gap + r * 0.4} cy={y - r * 0.4} r={r * 0.34} fill="#fff" />
      <circle cx={x + gap + r * 0.4} cy={y - r * 0.4} r={r * 0.34} fill="#fff" />
      {smile && <path d={`M${x - 5} ${y + 8} Q${x} ${y + 12} ${x + 5} ${y + 8}`} fill="none" stroke="#1f2937" strokeWidth="1.6" strokeLinecap="round" />}
    </>
  )
}

// Soft pink cheeks — the universal "this is friendly" signal.
function Cheeks({ x = 50, y = 56, gap = 16 }: { x?: number; y?: number; gap?: number }) {
  return (
    <>
      <ellipse cx={x - gap} cy={y} rx="3.4" ry="2.2" fill="#ff7eb3" opacity="0.5" />
      <ellipse cx={x + gap} cy={y} rx="3.4" ry="2.2" fill="#ff7eb3" opacity="0.5" />
    </>
  )
}

type Art = (c: string, d: string, l: string) => JSX.Element

// c = base color, d = darker shade, l = lighter shade
const ART: Record<string, Art> = {
  // ── NUMERIA ──
  countfox: (c, d, l) => (
    <g>
      <path d="M28 40 L20 18 L38 32 Z" fill={c} /><path d="M72 40 L80 18 L62 32 Z" fill={c} />
      <path d="M30 38 L25 24 L37 33 Z" fill={l} /><path d="M70 38 L75 24 L63 33 Z" fill={l} />
      <path d="M78 74 Q92 66 88 50 Q80 60 74 60 Z" fill={c} /><path d="M86 56 Q90 60 86 64" fill={l} />
      <ellipse cx="50" cy="58" rx="24" ry="22" fill={c} />
      <path d="M50 50 a16 12 0 0 0 -16 12 a16 12 0 0 0 32 0 a16 12 0 0 0 -16 -12 Z" fill={l} />
      <ellipse cx="50" cy="64" rx="4" ry="3" fill={d} />
      <Face y={56} gap={9} r={3.6} />
      <Cheeks y={62} gap={17} />
    </g>
  ),
  addbug: (c, d, l) => (
    <g>
      <path d="M44 26 Q38 14 32 16" fill="none" stroke={d} strokeWidth="2" strokeLinecap="round" />
      <path d="M56 26 Q62 14 68 16" fill="none" stroke={d} strokeWidth="2" strokeLinecap="round" />
      <circle cx="31" cy="15" r="2.4" fill={d} /><circle cx="69" cy="15" r="2.4" fill={d} />
      <ellipse cx="50" cy="56" rx="26" ry="24" fill={c} />
      <path d="M50 32 V80" stroke={d} strokeWidth="2.2" />
      <circle cx="40" cy="50" r="3" fill={l} /><circle cx="60" cy="50" r="3" fill={l} />
      <circle cx="38" cy="64" r="3" fill={l} /><circle cx="62" cy="64" r="3" fill={l} />
      <ellipse cx="50" cy="40" rx="14" ry="11" fill={d} />
      <Face y={40} gap={6} r={3} />
    </g>
  ),
  tenturtle: (c, d, l) => (
    <g>
      <ellipse cx="50" cy="78" rx="6" ry="4" fill={d} /><ellipse cx="50" cy="78" rx="6" ry="4" fill={d} />
      <ellipse cx="26" cy="66" rx="7" ry="5" fill={l} /><ellipse cx="74" cy="66" rx="7" ry="5" fill={l} />
      <ellipse cx="50" cy="52" rx="28" ry="24" fill={d} />
      <ellipse cx="50" cy="50" rx="22" ry="18" fill={c} />
      <path d="M50 33 L66 44 L60 62 L40 62 L34 44 Z" fill={l} opacity="0.55" />
      <path d="M50 33 L50 50 M34 44 L50 50 M66 44 L50 50 M40 62 L50 50 M60 62 L50 50" stroke={d} strokeWidth="1.4" fill="none" />
      <ellipse cx="32" cy="56" rx="10" ry="9" fill={l} />
      <Face x={29} y={56} gap={5} r={3} />
    </g>
  ),
  multimoth: (c, d, l) => (
    <g>
      <path d="M48 50 Q14 30 16 56 Q18 76 48 62 Z" fill={c} /><path d="M52 50 Q86 30 84 56 Q82 76 52 62 Z" fill={c} />
      <circle cx="30" cy="48" r="5" fill={l} /><circle cx="70" cy="48" r="5" fill={l} />
      <circle cx="30" cy="48" r="2" fill={d} /><circle cx="70" cy="48" r="2" fill={d} />
      <path d="M46 28 Q40 18 34 20" fill="none" stroke={d} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M54 28 Q60 18 66 20" fill="none" stroke={d} strokeWidth="1.8" strokeLinecap="round" />
      <ellipse cx="50" cy="50" rx="8" ry="18" fill={d} />
      <Face x={50} y={40} gap={4.5} r={2.6} />
    </g>
  ),
  zerolion: (c, d, l) => (
    <g>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return <circle key={i} cx={50 + Math.cos(a) * 26} cy={54 + Math.sin(a) * 26} r="9" fill={d} />
      })}
      <circle cx="50" cy="54" r="24" fill={c} />
      <path d="M50 48 a13 10 0 0 0 -13 10 a13 10 0 0 0 26 0 a13 10 0 0 0 -13 -10 Z" fill={l} />
      <ellipse cx="50" cy="60" rx="3.6" ry="2.6" fill={d} />
      <Face y={53} gap={9} r={3.6} />
      <Cheeks y={60} gap={15} />
    </g>
  ),
  primeroc: (c, d, l) => (
    <g>
      <path d="M42 52 Q10 40 14 64 Q22 80 44 66 Z" fill={c} /><path d="M58 52 Q90 40 86 64 Q78 80 56 66 Z" fill={c} />
      <path d="M42 56 Q22 52 22 66" fill="none" stroke={l} strokeWidth="2" /><path d="M58 56 Q78 52 78 66" fill="none" stroke={l} strokeWidth="2" />
      <ellipse cx="50" cy="58" rx="16" ry="20" fill={c} />
      <ellipse cx="50" cy="56" rx="11" ry="14" fill={l} />
      <path d="M44 30 L50 20 L56 30 Z" fill={d} />
      <path d="M50 44 L45 50 L55 50 Z" fill="#f59e0b" />
      <Face y={42} gap={6.5} r={3.2} />
    </g>
  ),
  // ── OTHER WORLDS (one starter each) ──
  letterowl: (c, d, l) => (
    <g>
      <path d="M30 34 L26 22 L40 30 Z" fill={d} /><path d="M70 34 L74 22 L60 30 Z" fill={d} />
      <ellipse cx="50" cy="56" rx="24" ry="26" fill={c} />
      <ellipse cx="50" cy="64" rx="18" ry="16" fill={l} />
      <circle cx="40" cy="50" r="10" fill="#fff" /><circle cx="60" cy="50" r="10" fill="#fff" />
      <circle cx="40" cy="50" r="5" fill="#1f2937" /><circle cx="60" cy="50" r="5" fill="#1f2937" />
      <circle cx="41.5" cy="48.5" r="1.6" fill="#fff" /><circle cx="61.5" cy="48.5" r="1.6" fill="#fff" />
      <path d="M50 56 L46 62 L54 62 Z" fill="#f59e0b" />
    </g>
  ),
  moodlamb: (c, d, l) => (
    <g>
      {[[34, 44], [50, 38], [66, 44], [30, 58], [70, 58], [40, 66], [60, 66]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="11" fill={l} />
      ))}
      <circle cx="50" cy="56" r="16" fill="#fff" />
      <ellipse cx="50" cy="52" rx="13" ry="14" fill={c} />
      <path d="M37 46 Q32 44 31 50" fill="none" stroke={d} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M63 46 Q68 44 69 50" fill="none" stroke={d} strokeWidth="2.4" strokeLinecap="round" />
      <Face y={54} gap={6} r={3} />
      <Cheeks y={59} gap={11} />
    </g>
  ),
  mapturtle: (c, d, l) => (
    <g>
      <ellipse cx="26" cy="64" rx="7" ry="5" fill={l} /><ellipse cx="74" cy="64" rx="7" ry="5" fill={l} />
      <ellipse cx="50" cy="52" rx="27" ry="23" fill={d} />
      <ellipse cx="50" cy="50" rx="21" ry="17" fill={c} />
      <path d="M40 44 Q48 40 56 46 Q62 50 54 56 Q46 60 42 54 Z" fill={l} opacity="0.7" />
      <circle cx="58" cy="44" r="2.4" fill={l} opacity="0.7" />
      <ellipse cx="30" cy="54" rx="10" ry="9" fill={l} />
      <Face x={27} y={54} gap={5} r={2.8} />
    </g>
  ),
  cloudcat: (c, d, l) => (
    <g>
      <g fill="#fff" opacity="0.92">
        <ellipse cx="38" cy="72" rx="14" ry="8" /><ellipse cx="60" cy="72" rx="16" ry="9" /><ellipse cx="50" cy="68" rx="20" ry="10" />
      </g>
      <path d="M34 40 L30 28 L44 36 Z" fill={c} /><path d="M66 40 L70 28 L56 36 Z" fill={c} />
      <path d="M36 38 L33 31 L43 36 Z" fill={l} /><path d="M64 38 L67 31 L57 36 Z" fill={l} />
      <ellipse cx="50" cy="54" rx="20" ry="17" fill={c} />
      <Face y={54} gap={8} r={3.4} />
      <path d="M44 60 L56 60" stroke={d} strokeWidth="1.4" strokeLinecap="round" />
      <Cheeks y={59} gap={13} />
    </g>
  ),
  pixelslime: (c, d, l) => (
    <g>
      <path d="M24 72 V52 a26 26 0 0 1 52 0 V72 a4 4 0 0 1 -4 4 H28 a4 4 0 0 1 -4 -4 Z" fill={c} />
      <rect x="30" y="40" width="8" height="8" fill={l} opacity="0.6" />
      <rect x="62" y="46" width="7" height="7" fill={d} opacity="0.5" />
      <rect x="44" y="64" width="9" height="9" fill={l} opacity="0.5" />
      <rect x="40" y="50" width="7" height="9" rx="1" fill="#1f2937" />
      <rect x="55" y="50" width="7" height="9" rx="1" fill="#1f2937" />
      <rect x="41.5" y="51.5" width="2.4" height="2.4" fill="#fff" />
      <rect x="56.5" y="51.5" width="2.4" height="2.4" fill="#fff" />
      <path d="M44 64 Q50 68 56 64" fill="none" stroke="#1f2937" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  ),

  // ── WORDVEIL (wrd) ──
  rhymefrog: (c, d, l) => (
    <g>
      <ellipse cx="28" cy="72" rx="9" ry="6" fill={d} /><ellipse cx="72" cy="72" rx="9" ry="6" fill={d} />
      <ellipse cx="50" cy="60" rx="26" ry="20" fill={c} />
      <ellipse cx="50" cy="66" rx="18" ry="12" fill={l} />
      <circle cx="38" cy="40" r="9" fill={c} /><circle cx="62" cy="40" r="9" fill={c} />
      <circle cx="38" cy="39" r="5" fill="#fff" /><circle cx="62" cy="39" r="5" fill="#fff" />
      <circle cx="38" cy="40" r="2.6" fill="#1f2937" /><circle cx="62" cy="40" r="2.6" fill="#1f2937" />
      <path d="M36 54 Q50 64 64 54" fill="none" stroke={d} strokeWidth="2.2" strokeLinecap="round" />
      <Cheeks y={56} gap={18} />
    </g>
  ),
  storyfox: (c, d, l) => (
    <g>
      <path d="M30 38 L24 18 L40 32 Z" fill={c} /><path d="M70 38 L76 18 L60 32 Z" fill={c} />
      <path d="M32 36 L28 24 L39 33 Z" fill={l} /><path d="M68 36 L72 24 L61 33 Z" fill={l} />
      <g transform="translate(80 60)">
        <path d="M-4 -8 L8 -10 L8 8 L-4 10 Z" fill={l} />
        <path d="M-4 -8 L-16 -6 L-16 12 L-4 10 Z" fill="#fff" />
        <path d="M-12 -2 H-6 M-12 2 H-6 M-12 6 H-6" stroke={d} strokeWidth="1" />
      </g>
      <ellipse cx="50" cy="58" rx="23" ry="22" fill={c} />
      <path d="M50 50 a15 12 0 0 0 -15 12 a15 12 0 0 0 30 0 a15 12 0 0 0 -15 -12 Z" fill={l} />
      <ellipse cx="50" cy="64" rx="3.6" ry="2.8" fill={d} />
      <Face y={55} gap={8.5} r={3.4} />
      <Cheeks y={62} gap={16} />
    </g>
  ),
  grammargon: (c, d, l) => (
    <g>
      <path d="M30 50 Q12 40 16 60 Q24 58 32 60 Z" fill={d} /><path d="M70 50 Q88 40 84 60 Q76 58 68 60 Z" fill={d} />
      <path d="M68 72 Q84 74 82 60" fill="none" stroke={c} strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="50" cy="60" rx="20" ry="20" fill={c} />
      <ellipse cx="50" cy="66" rx="13" ry="12" fill={l} />
      <path d="M40 38 L37 26 L45 36 Z" fill={d} /><path d="M60 38 L63 26 L55 36 Z" fill={d} />
      <ellipse cx="50" cy="60" rx="9" ry="6" fill={l} />
      <circle cx="47" cy="60" r="1.4" fill={d} /><circle cx="53" cy="60" r="1.4" fill={d} />
      <Face y={50} gap={7} r={3.2} smile={false} />
    </g>
  ),

  // ── LIFE (lif) ──
  pulsepup: (c, d, l) => (
    <g>
      <ellipse cx="28" cy="54" rx="9" ry="16" fill={d} /><ellipse cx="72" cy="54" rx="9" ry="16" fill={d} />
      <ellipse cx="50" cy="54" rx="23" ry="21" fill={c} />
      <ellipse cx="50" cy="62" rx="13" ry="10" fill={l} />
      <ellipse cx="50" cy="58" rx="3.4" ry="2.6" fill="#1f2937" />
      <path d="M50 60 V64 M50 64 Q45 67 43 64 M50 64 Q55 67 57 64" fill="none" stroke={d} strokeWidth="1.4" strokeLinecap="round" />
      <Face y={50} gap={8.5} r={3.4} smile={false} />
      <Cheeks y={60} gap={17} />
    </g>
  ),
  breezedeer: (c, d, l) => (
    <g>
      <path d="M40 32 Q36 18 30 16 M40 28 Q32 26 28 22" fill="none" stroke={d} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M60 32 Q64 18 70 16 M60 28 Q68 26 72 22" fill="none" stroke={d} strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="30" cy="44" rx="7" ry="11" fill={c} transform="rotate(-20 30 44)" />
      <ellipse cx="70" cy="44" rx="7" ry="11" fill={c} transform="rotate(20 70 44)" />
      <ellipse cx="50" cy="56" rx="19" ry="22" fill={c} />
      <ellipse cx="50" cy="66" rx="11" ry="10" fill={l} />
      <ellipse cx="50" cy="64" rx="3.4" ry="2.6" fill={d} />
      <Face y={52} gap={7.5} r={3.2} />
      <Cheeks y={62} gap={14} />
    </g>
  ),
  auroracrane: (c, d, l) => (
    <g>
      <ellipse cx="46" cy="66" rx="20" ry="15" fill={c} />
      <path d="M58 66 Q80 64 84 76 Q70 74 60 74 Z" fill={l} />
      <path d="M44 56 Q40 36 50 30" fill="none" stroke={c} strokeWidth="8" strokeLinecap="round" />
      <circle cx="52" cy="28" r="9" fill={c} />
      <circle cx="52" cy="23" r="3" fill="#ef4444" />
      <path d="M60 28 L74 30 L60 32 Z" fill="#f59e0b" />
      <Face x={52} y={28} gap={3.4} r={2} smile={false} />
      <path d="M42 80 V90 M52 80 V90" stroke={d} strokeWidth="2" strokeLinecap="round" />
    </g>
  ),

  // ── WORLD (wld) ──
  dunecamel: (c, d, l) => (
    <g>
      <rect x="34" y="68" width="5" height="16" rx="2" fill={d} /><rect x="60" y="68" width="5" height="16" rx="2" fill={d} />
      <path d="M28 70 Q26 50 40 50 Q46 38 56 50 Q72 48 72 70 Z" fill={c} />
      <ellipse cx="50" cy="62" rx="16" ry="8" fill={l} opacity="0.5" />
      <path d="M66 60 Q78 56 76 40" fill="none" stroke={c} strokeWidth="9" strokeLinecap="round" />
      <ellipse cx="78" cy="36" rx="8" ry="6" fill={c} />
      <ellipse cx="84" cy="38" rx="4" ry="3" fill={l} />
      <Face x={78} y={34} gap={3.4} r={2} smile={false} />
    </g>
  ),
  riverotter: (c, d, l) => (
    <g>
      <path d="M70 74 Q86 72 82 58" fill="none" stroke={c} strokeWidth="6" strokeLinecap="round" />
      <ellipse cx="50" cy="62" rx="18" ry="22" fill={c} />
      <ellipse cx="50" cy="66" rx="12" ry="15" fill={l} />
      <circle cx="38" cy="40" r="5" fill={c} /><circle cx="62" cy="40" r="5" fill={c} />
      <ellipse cx="50" cy="46" rx="15" ry="13" fill={c} />
      <ellipse cx="50" cy="52" rx="8" ry="6" fill={l} />
      <ellipse cx="50" cy="50" rx="3" ry="2.4" fill={d} />
      <Face y={44} gap={6.5} r={3} />
      <Cheeks y={51} gap={12} />
    </g>
  ),
  globewhale: (c, d, l) => (
    <g>
      <path d="M44 26 Q42 18 46 16 M50 26 Q50 16 50 14 M56 26 Q58 18 54 16" fill="none" stroke={l} strokeWidth="2" strokeLinecap="round" />
      <path d="M74 56 Q88 48 86 42 Q80 50 76 52 Z" fill={c} />
      <path d="M74 60 Q88 66 86 72 Q80 64 76 62 Z" fill={c} />
      <ellipse cx="48" cy="60" rx="30" ry="22" fill={c} />
      <path d="M22 64 Q48 80 74 64" fill="none" stroke={d} strokeWidth="2" />
      <ellipse cx="42" cy="68" rx="20" ry="9" fill={l} opacity="0.6" />
      <Face x={40} y={56} gap={9} r={3.4} />
      <Cheeks x={40} y={64} gap={16} />
    </g>
  ),

  // ── WONDER (won) ──
  cometcolt: (c, d, l) => (
    <g>
      <path d="M40 30 Q30 34 34 50 Q38 44 42 46 Z" fill={d} />
      <path d="M44 30 Q40 30 40 40 L36 64 Q40 72 50 70 Q58 68 58 58 L60 38 Q58 30 50 30 Z" fill={c} />
      <path d="M46 30 L44 22 L52 28 Z" fill={c} /><path d="M56 32 L58 23 L62 30 Z" fill={c} />
      <ellipse cx="44" cy="62" rx="8" ry="7" fill={l} />
      <ellipse cx="44" cy="62" rx="2.4" ry="1.8" fill={d} />
      <path d="M52 44 l1.5 4 l4 .5 l-3 3 l1 4 l-3.5 -2 l-3.5 2 l1 -4 l-3 -3 l4 -.5 Z" fill="#fde047" />
      <Face x={48} y={48} gap={6} r={3} smile={false} />
    </g>
  ),
  galaxyfawn: (c, d, l) => (
    <g>
      <ellipse cx="34" cy="42" rx="6" ry="10" fill={c} transform="rotate(-22 34 42)" />
      <ellipse cx="66" cy="42" rx="6" ry="10" fill={c} transform="rotate(22 66 42)" />
      <circle cx="42" cy="30" r="2.6" fill={l} /><circle cx="58" cy="30" r="2.6" fill={l} />
      <ellipse cx="50" cy="56" rx="18" ry="20" fill={c} />
      <ellipse cx="50" cy="64" rx="10" ry="9" fill={l} />
      <circle cx="40" cy="58" r="1.4" fill="#fff" /><circle cx="60" cy="58" r="1.4" fill="#fff" /><circle cx="44" cy="66" r="1.2" fill="#fff" />
      <ellipse cx="50" cy="62" rx="3" ry="2.4" fill={d} />
      <Face y={52} gap={7} r={3.2} />
      <Cheeks y={61} gap={13} />
    </g>
  ),
  novabear: (c, d, l) => (
    <g>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2
        return <circle key={i} cx={50 + Math.cos(a) * 30} cy={56 + Math.sin(a) * 30} r="1.8" fill={l} />
      })}
      <circle cx="33" cy="40" r="9" fill={c} /><circle cx="67" cy="40" r="9" fill={c} />
      <circle cx="33" cy="40" r="4.5" fill={l} /><circle cx="67" cy="40" r="4.5" fill={l} />
      <circle cx="50" cy="56" r="22" fill={c} />
      <ellipse cx="50" cy="62" rx="12" ry="10" fill={l} />
      <ellipse cx="50" cy="58" rx="3.4" ry="2.6" fill="#1f2937" />
      <Face y={52} gap={8.5} r={3.4} smile={false} />
      <Cheeks y={62} gap={16} />
    </g>
  ),

  // ── LOGIC (log) ──
  mechmouse: (c, d, l) => (
    <g>
      <circle cx="32" cy="38" r="11" fill={c} /><circle cx="68" cy="38" r="11" fill={c} />
      <circle cx="32" cy="38" r="6" fill={l} /><circle cx="68" cy="38" r="6" fill={l} />
      <path d="M50 32 V22" stroke={d} strokeWidth="2" /><circle cx="50" cy="20" r="3" fill="#fde047" />
      <rect x="30" y="44" width="40" height="34" rx="8" fill={c} />
      <rect x="36" y="52" width="28" height="14" rx="4" fill={l} />
      <circle cx="44" cy="59" r="3" fill="#1f2937" /><circle cx="56" cy="59" r="3" fill="#1f2937" />
      <circle cx="45" cy="58" r="1" fill="#22d3ee" /><circle cx="57" cy="58" r="1" fill="#22d3ee" />
      <path d="M44 70 H56" stroke={d} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="34" cy="74" r="1.6" fill={d} /><circle cx="66" cy="74" r="1.6" fill={d} />
    </g>
  ),
  ciphercat: (c, d, l) => (
    <g>
      <path d="M32 44 L28 26 L46 38 Z" fill={c} /><path d="M68 44 L72 26 L54 38 Z" fill={c} />
      <path d="M34 42 L31 31 L43 38 Z" fill={l} /><path d="M66 42 L69 31 L57 38 Z" fill={l} />
      <ellipse cx="50" cy="56" rx="22" ry="20" fill={c} />
      <rect x="44" y="64" width="12" height="9" rx="2" fill={l} />
      <path d="M46 64 V61 a4 4 0 0 1 8 0 V64" fill="none" stroke={l} strokeWidth="2" />
      <ellipse cx="42" cy="54" rx="3.4" ry="4.4" fill="#1f2937" /><ellipse cx="58" cy="54" rx="3.4" ry="4.4" fill="#1f2937" />
      <ellipse cx="42" cy="53" rx="1" ry="2.4" fill="#a7f3d0" /><ellipse cx="58" cy="53" rx="1" ry="2.4" fill="#a7f3d0" />
      <path d="M50 58 L48 60 H52 Z" fill={d} />
      <path d="M36 56 H28 M36 59 H29 M64 56 H72 M64 59 H71" stroke={d} strokeWidth="1" strokeLinecap="round" />
      <Cheeks y={59} gap={16} />
    </g>
  ),
  datadragon: (c, d, l) => (
    <g>
      <path d="M30 50 Q12 38 16 60 Q24 56 32 60 Z" fill={d} /><path d="M70 50 Q88 38 84 60 Q76 56 68 60 Z" fill={d} />
      <path d="M66 72 Q84 74 82 58" fill="none" stroke={c} strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="50" cy="60" rx="20" ry="20" fill={c} />
      <rect x="42" y="66" width="5" height="5" fill={l} opacity="0.7" /><rect x="50" y="70" width="5" height="5" fill={l} opacity="0.6" /><rect x="54" y="64" width="5" height="5" fill={l} opacity="0.7" />
      <path d="M40 38 L37 26 L45 36 Z" fill={d} /><path d="M60 38 L63 26 L55 36 Z" fill={d} />
      <ellipse cx="50" cy="58" rx="9" ry="6" fill={l} />
      <circle cx="47" cy="58" r="1.4" fill={d} /><circle cx="53" cy="58" r="1.4" fill={d} />
      <Face y={49} gap={7} r={3.2} smile={false} />
    </g>
  ),
}

export interface KinSpriteProps {
  /** a kin id ('kin:countfox') OR a bare render key ('countfox') */
  kin?: string
  render?: string
  color?: string
  size?: number
  className?: string
  bob?: boolean
}

export default function KinSprite({ kin, render, color, size = 88, className, bob }: KinSpriteProps) {
  const def = kin ? kinDef(kin.startsWith('kin:') ? kin : `kin:${kin}`) : undefined
  const key = render ?? def?.render ?? 'countfox'
  const c = color ?? def?.color ?? '#f59e0b'
  const art = ART[key] ?? ART.countfox
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={bob ? { animation: 'kinbob 2.6s ease-in-out infinite' } : undefined}
      role="img"
      aria-label={def?.name ?? key}
    >
      {bob && <style>{'@keyframes kinbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}'}</style>}
      <ellipse cx="50" cy="88" rx="22" ry="5" fill="rgba(0,0,0,0.16)" />
      {art(c, shade(c, -0.22), shade(c, 0.28))}
    </svg>
  )
}
