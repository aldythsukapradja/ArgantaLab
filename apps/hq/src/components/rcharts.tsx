// Themed Recharts wrappers for Command. All colors come from theme CSS vars so
// light/dark just work. One chart component, reused across offices and reports.
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

export const money = (n: number) => {
  const a = Math.abs(n), s = n < 0 ? '-' : ''
  if (a < 10) return s + '$' + a.toFixed(2)
  if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(2) + 'M'
  if (a >= 1e3) return s + '$' + Math.round(a / 1e3) + 'k'
  return s + '$' + Math.round(a)
}
export const num = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString())

export interface RSeries { key: string; label: string; color: string; dashed?: boolean; fill?: boolean }

interface TTProps { active?: boolean; payload?: { dataKey: string; name: string; value: number; color: string }[]; label?: number }

export function CashflowChart({ data, series, kind, months, height = 220 }: {
  data: Record<string, number>[]
  series: RSeries[]
  kind: 'money' | 'count'
  months: number
  height?: number
}) {
  const fmt = kind === 'money' ? money : num
  const longRange = months > 30
  const xFmt = (i: number) => (longRange ? `${2026 + Math.floor(i / 12)}` : `m${i + 1}`)
  const interval = Math.max(0, Math.floor((data.length - 1) / 6))

  const TT = ({ active, payload, label }: TTProps) => {
    if (!active || !payload?.length || label == null) return null
    return (
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 8, padding: '8px 10px', fontSize: 11, boxShadow: '0 8px 24px -12px rgba(0,0,0,.5)' }}>
        <div style={{ color: 'var(--tx3)', marginBottom: 4 }}>{longRange ? `${2026 + Math.floor(label / 12)}` : `month ${label + 1}`}</div>
        {payload.map(p => (
          <div key={p.dataKey} style={{ color: p.color, fontWeight: 600 }}>
            {series.length > 1 ? `${p.name}: ` : ''}{fmt(p.value)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 14, left: 6, bottom: 2 }}>
        <defs>
          {series.map(s => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="var(--bd)" vertical={false} />
        <XAxis dataKey="i" tickFormatter={xFmt} interval={interval} tick={{ fill: 'var(--tx3)', fontSize: 10 }} stroke="var(--bd2)" tickLine={false} />
        <YAxis tickFormatter={fmt} tick={{ fill: 'var(--tx3)', fontSize: 10 }} stroke="var(--bd2)" tickLine={false} width={50} />
        {kind === 'money' && <ReferenceLine y={0} stroke="var(--bd2)" strokeDasharray="4 4" />}
        <Tooltip content={<TT />} />
        {series.map(s => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.label}
            stroke={s.color} strokeWidth={2.4} strokeDasharray={s.dashed ? '5 4' : undefined}
            fill={s.fill ? `url(#g-${s.key})` : 'transparent'} fillOpacity={1}
            dot={false} activeDot={{ r: 4, stroke: s.color, fill: 'var(--bg)', strokeWidth: 2 }}
            animationDuration={480} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}
