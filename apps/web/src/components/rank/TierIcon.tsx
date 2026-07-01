// A fancy tier crest — a faceted gem badge tinted by the tier colour, with a
// soft glow, shine, and the tier glyph. Used wherever the player's rank shows.

function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, Math.max(0, (n >> 16) + Math.round(255 * pct)))
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) + Math.round(255 * pct)))
  const b = Math.min(255, Math.max(0, (n & 255) + Math.round(255 * pct)))
  return `rgb(${r},${g},${b})`
}

export default function TierIcon({ color, glyph, size = 52 }: { color: string; glyph: string; size?: number }) {
  const uid = 'tg' + color.replace('#', '')
  const light = shade(color, 0.32), dark = shade(color, -0.28)
  return (
    <svg viewBox="0 0 56 56" width={size} height={size} role="img" aria-label="rank crest">
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} /><stop offset="1" stopColor={dark} />
        </linearGradient>
        <radialGradient id={uid + 'g'} cx="50%" cy="42%" r="60%">
          <stop offset="0" stopColor={color} stopOpacity="0.45" /><stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="28" cy="28" r="26" fill={`url(#${uid}g)`} />
      {/* faceted gem/shield */}
      <path d="M28 5 L47 15 V33 L28 51 L9 33 V15 Z" fill={`url(#${uid})`} stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />
      <path d="M28 5 L47 15 L28 27 L9 15 Z" fill="#ffffff" opacity="0.22" />
      <path d="M28 5 L28 51 M9 15 L28 27 L47 15" stroke={dark} strokeWidth="1" opacity="0.4" fill="none" />
      {/* glyph */}
      <text x="28" y="34" textAnchor="middle" fontSize="19" fontWeight="800" fill="#ffffff" style={{ fontFamily: 'system-ui, sans-serif' }}>{glyph}</text>
      {/* shine */}
      <ellipse cx="20" cy="16" rx="5" ry="2.6" fill="#ffffff" opacity="0.55" transform="rotate(-24 20 16)" />
    </svg>
  )
}
