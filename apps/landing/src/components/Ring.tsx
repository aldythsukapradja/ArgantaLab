// The real ArgantaLab daily-ring (ported from web PlayHome/WorldHub) — an SVG
// arc whose strokeDasharray encodes percent. Used everywhere a ring appears.
export default function Ring({
  pct, color, size = 58, showText = false, track = 'var(--ring-track)',
}: { pct: number; color: string; size?: number; showText?: boolean; track?: string }) {
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  const cc = size / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cc} cy={cc} r={r} fill="none" stroke={track} strokeWidth="6" />
      <circle
        cx={cc} cy={cc} r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${(c * pct / 100).toFixed(1)} ${c.toFixed(1)}`}
        transform={`rotate(-90 ${cc} ${cc})`}
        style={{ transition: 'stroke-dasharray 1s cubic-bezier(.22,1,.36,1)' }}
      />
      {showText && (
        <text x="50%" y="54%" textAnchor="middle" fontSize={size * 0.24} fontWeight="800" fill={color}>{pct}</text>
      )}
    </svg>
  )
}
