import type { GrowthPoint } from '../data/types'

// Theme-aware area+line chart — no chart dependency. Scales to container width;
// height is proportional to the viewBox. Colours come from the HQ accent token.
export function LineChart({ points }: { points: GrowthPoint[] }) {
  const W = 760, H = 180, padL = 10, padR = 10, padT = 18, padB = 22
  const n = points.length
  if (n === 0) return null
  const max = Math.max(1, ...points.map(p => p.value))
  const x = (i: number) => padL + (i * (W - padL - padR)) / Math.max(1, n - 1)
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const base = H - padB
  const area = `${line} L${x(n - 1).toFixed(1)},${base} L${x(0).toFixed(1)},${base} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: 'auto', display: 'block' }}
      role="img" aria-label="North-star: weekly active learners trend">
      {[0.25, 0.5, 0.75, 1].map(f => {
        const gy = padT + f * (H - padT - padB)
        return <line key={f} x1={padL} x2={W - padR} y1={gy} y2={gy} stroke="var(--bd)" strokeWidth={1} />
      })}
      <path d={area} fill="var(--acc-soft)" />
      <path d={line} fill="none" stroke="var(--acc)" strokeWidth={2.5} strokeLinejoin="round" />
      {points.map((p, i) => <circle key={'c' + i} cx={x(i)} cy={y(p.value)} r={3.2} fill="var(--acc)" />)}
      {points.map((p, i) => (
        <text key={'v' + i} x={x(i)} y={y(p.value) - 8} fontSize={11} fill="var(--tx2)" textAnchor="middle" fontWeight={600}>{p.value}</text>
      ))}
      {points.map((p, i) => (
        <text key={'l' + i} x={x(i)} y={H - 6} fontSize={10} fill="var(--tx3)" textAnchor="middle">{p.week}</text>
      ))}
    </svg>
  )
}
