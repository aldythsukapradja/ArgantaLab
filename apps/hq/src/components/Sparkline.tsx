export function Sparkline({ data, color = 'var(--ok)', w = 96, h = 26 }:
  { data: number[]; color?: string; w?: number; h?: number }) {
  if (data.length < 2) return null
  const max = Math.max(...data), min = Math.min(...data)
  const span = max - min || 1
  const step = w / (data.length - 1)
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / span) * h).toFixed(1)}`)
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ display: 'block' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
