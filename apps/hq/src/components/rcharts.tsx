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

import { BarChart, Bar, Cell } from 'recharts'

export interface BarItem { label: string; value: number; color?: string }

// Horizontal themed bars — funnels, distributions, counts. Blind data should be
// a table, not a bar of zeros; use this only for real counts.
export function BarsChart({ items, unit = 'count', height }: { items: BarItem[]; unit?: 'count' | 'money' | '%'; height?: number }) {
  const fmt = unit === 'money' ? money : unit === '%' ? (v: number) => `${Math.round(v)}%` : num
  const TT = ({ active, payload }: { active?: boolean; payload?: { payload: BarItem }[] }) => {
    if (!active || !payload?.length) return null
    const it = payload[0].payload
    return <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 8, padding: '6px 9px', fontSize: 11 }}><b>{it.label}</b> · {fmt(it.value)}</div>
  }
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(110, items.length * 34 + 24)}>
      <BarChart data={items} layout="vertical" margin={{ top: 4, right: 18, left: 4, bottom: 2 }}>
        <XAxis type="number" tickFormatter={fmt} tick={{ fill: 'var(--tx3)', fontSize: 10 }} stroke="var(--bd2)" tickLine={false} />
        <YAxis type="category" dataKey="label" width={116} tick={{ fill: 'var(--tx2)', fontSize: 11 }} stroke="var(--bd2)" tickLine={false} />
        <Tooltip content={<TT />} cursor={{ fill: 'var(--bg3)', opacity: 0.4 }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {items.map((it, i) => <Cell key={i} fill={it.color ?? 'var(--acc)'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// Custom SVG arc gauge (dependency-free, reliable centering) — coverage→target,
// LTV:CAC, SLA attainment.
export function Gauge({ value, target, unit, caption, ok }: { value: number; target?: number; unit: '%' | 'x' | 'ratio'; caption?: string; ok?: boolean }) {
  const max = unit === '%' ? 100 : Math.max(target ?? 1, value) * 1.25
  const frac = Math.max(0, Math.min(1, value / max))
  const R = 62, cx = 80, cy = 76, sw = 14
  const a0 = Math.PI, a1 = 0 // semicircle left→right
  const pt = (t: number) => [cx + R * Math.cos(a0 + (a1 - a0) * t), cy + R * Math.sin(a0 + (a1 - a0) * t)]
  const arc = (t0: number, t1: number) => {
    const [x0, y0] = pt(t0), [x1, y1] = pt(t1)
    return `M${x0.toFixed(1)},${y0.toFixed(1)} A${R},${R} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)}`
  }
  const color = ok == null ? 'var(--acc)' : ok ? 'var(--ok)' : 'var(--warn)'
  const disp = unit === '%' ? `${Math.round(value)}%` : unit === 'x' ? `${value.toFixed(1)}×` : value.toFixed(2)
  const tFrac = target != null ? Math.max(0, Math.min(1, target / max)) : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg viewBox="0 0 160 96" width="180" style={{ maxWidth: '100%' }}>
        <path d={arc(0, 1)} fill="none" stroke="var(--bg3)" strokeWidth={sw} strokeLinecap="round" />
        <path d={arc(0, frac)} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        {tFrac != null && (() => { const [tx, ty] = pt(tFrac); return <circle cx={tx} cy={ty} r={3.5} fill="var(--tx)" /> })()}
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize={22} fontWeight={800} fill="var(--tx)">{disp}</text>
      </svg>
      {caption && <div style={{ fontSize: 10.5, color: 'var(--tx3)', marginTop: -6 }}>{caption}</div>}
    </div>
  )
}
