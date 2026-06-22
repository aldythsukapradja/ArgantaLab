import { TrendingUp, TrendingDown } from 'lucide-react'

const nf = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`

export function MetricCard({ label, value, unit, deltaPct }:
  { label: string; value: number; unit?: string; deltaPct?: number }) {
  const up = (deltaPct ?? 0) >= 0
  return (
    <div style={{ background: 'var(--glass2)', border: '1px solid var(--brd)', borderRadius: 'var(--r-md)', padding: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--dim)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.2 }}>{nf(value)}{unit}</div>
      {deltaPct !== undefined && (
        <div style={{ fontSize: 11, color: up ? 'var(--ok)' : 'var(--bad)', display: 'flex', alignItems: 'center', gap: 3 }}>
          {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {up ? '+' : ''}{deltaPct}%
        </div>
      )}
    </div>
  )
}
