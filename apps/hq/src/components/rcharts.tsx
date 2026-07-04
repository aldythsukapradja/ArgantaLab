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

// Custom SVG top-semicircle gauge. The arc is built by SAMPLING points along the
// same path for both track and value, so they are always perfectly concentric
// (no SVG arc-flag ambiguity at the semicircle). — coverage→target, LTV:CAC, SLA.
export function Gauge({ value, target, unit, caption, ok }: { value: number; target?: number; unit: '%' | 'x' | 'ratio'; caption?: string; ok?: boolean }) {
  const max = unit === '%' ? 100 : Math.max(target ?? 1, value) * 1.25
  const frac = Math.max(0, Math.min(1, value / max))
  const R = 60, cx = 80, cy = 74, sw = 13
  // t=0 → left, t=0.5 → top, t=1 → right (y flipped so the arc bows UP)
  const ptAt = (t: number): [number, number] => {
    const ang = Math.PI - Math.PI * t
    return [cx + R * Math.cos(ang), cy - R * Math.sin(ang)]
  }
  const pathFor = (t0: number, t1: number) => {
    const steps = Math.max(2, Math.round((t1 - t0) * 64))
    let d = ''
    for (let k = 0; k <= steps; k++) {
      const [x, y] = ptAt(t0 + (t1 - t0) * (k / steps))
      d += (k ? 'L' : 'M') + `${x.toFixed(2)},${y.toFixed(2)} `
    }
    return d
  }
  const color = ok == null ? 'var(--acc)' : ok ? 'var(--ok)' : 'var(--warn)'
  const disp = unit === '%' ? `${Math.round(value)}%` : unit === 'x' ? `${value.toFixed(1)}×` : value.toFixed(2)
  const tFrac = target != null ? Math.max(0, Math.min(1, target / max)) : null
  const tMark = tFrac != null ? ptAt(tFrac) : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg viewBox="0 0 160 90" width="180" style={{ maxWidth: '100%' }}>
        <path d={pathFor(0, 1)} fill="none" stroke="var(--bg3)" strokeWidth={sw} strokeLinecap="round" />
        <path d={pathFor(0, frac)} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        {tMark && <circle cx={tMark[0]} cy={tMark[1]} r={3.5} fill="var(--tx)" stroke="var(--bg)" strokeWidth={1.5} />}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize={22} fontWeight={800} fill="var(--tx)">{disp}</text>
      </svg>
      {caption && <div style={{ fontSize: 10.5, color: 'var(--tx3)', marginTop: -4 }}>{caption}</div>}
    </div>
  )
}

export interface StackSeries { key: string; label: string; color: string }

// Themed stacked area — cost-vs-scale (log x). Series stack in order given.
export function StackedAreaChart({ data, xKey, series, xFmt, yFmt, height, marker }: {
  data: Record<string, number>[]
  xKey: string
  series: StackSeries[]
  xFmt: (v: number) => string
  yFmt: (v: number) => string
  height?: number
  marker?: number
}) {
  const TT = ({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; name: string; value: number; color: string }[]; label?: number }) => {
    if (!active || !payload?.length || label == null) return null
    const total = payload.reduce((s, p) => s + p.value, 0)
    return (
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd2)', borderRadius: 8, padding: '8px 10px', fontSize: 11, boxShadow: '0 8px 24px -12px rgba(0,0,0,.5)' }}>
        <div style={{ color: 'var(--tx3)', marginBottom: 4 }}>{xFmt(label)} families</div>
        {[...payload].reverse().map(p => (
          <div key={p.dataKey} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {yFmt(p.value)}</div>
        ))}
        <div style={{ color: 'var(--tx)', fontWeight: 700, borderTop: '1px solid var(--bd)', marginTop: 4, paddingTop: 4 }}>Total: {yFmt(total)}</div>
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={height ?? 240}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 2 }}>
        <defs>
          {series.map(s => (
            <linearGradient key={s.key} id={`sg-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.55} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.15} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="var(--bd)" vertical={false} />
        <XAxis dataKey={xKey} scale="log" type="number" domain={['dataMin', 'dataMax']} tickFormatter={xFmt} tick={{ fill: 'var(--tx3)', fontSize: 10 }} stroke="var(--bd2)" tickLine={false} />
        <YAxis tickFormatter={yFmt} tick={{ fill: 'var(--tx3)', fontSize: 10 }} stroke="var(--bd2)" tickLine={false} width={54} />
        {marker != null && <ReferenceLine x={marker} stroke="var(--tx3)" strokeDasharray="4 4" />}
        <Tooltip content={<TT />} />
        {series.map(s => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stackId="1" stroke={s.color} strokeWidth={1.4} fill={`url(#sg-${s.key})`} fillOpacity={1} isAnimationActive={false} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Valuation football field — log-scale range bars, one per method ─────────
export interface FFRow { label: string; sub?: string; low: number; high: number; highlight?: boolean }
const FF_PROV: Record<string, string> = { partial: 'var(--warn)', simulated: 'var(--acc-text)', live: 'var(--ok)', placeholder: 'var(--tx3)' }
export function ValuationFootballField({ rows, min = 0.1, max = 8, unit = 'M' }: { rows: FFRow[]; min?: number; max?: number; unit?: string }) {
  const pos = (v: number) => ((Math.log10(Math.max(v, min)) - Math.log10(min)) / (Math.log10(max) - Math.log10(min))) * 100
  const ticks = [0.1, 0.3, 1, 3, 8].filter(t => t >= min && t <= max)
  const fmt = (v: number) => (v < 1 ? '$' + Math.round(v * 1000) + 'K' : '$' + v + unit)
  return (
    <div style={{ margin: '6px 0' }}>
      {rows.map((d, i) => {
        const l0 = pos(d.low), l1 = pos(d.high)
        const c = d.highlight ? 'var(--acc)' : (d.sub && FF_PROV[d.sub]) || 'var(--acc-text)'
        const labelLeft = l1 > 66
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '132px 1fr', gap: 12, alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, textAlign: 'right' }}>{d.label}{d.sub && <div style={{ fontSize: 9.5, fontWeight: 400, color: 'var(--tx3)', marginTop: 1 }}>{d.sub}</div>}</div>
            <div style={{ position: 'relative', height: 22, background: 'var(--bg3)', borderRadius: 5 }}>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: l0 + '%', width: Math.max(l1 - l0, 1.2) + '%', borderRadius: 5, background: d.highlight ? 'linear-gradient(90deg,var(--acc),var(--mag))' : c, boxShadow: d.highlight ? '0 0 0 2px color-mix(in srgb,var(--acc) 45%,transparent)' : 'none' }} />
              <div style={{ position: 'absolute', top: 0, height: 22, display: 'flex', alignItems: 'center', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tx2)', whiteSpace: 'nowrap',
                ...(labelLeft ? { right: `calc(${100 - l0}% + 8px)` } : { left: `calc(${l1}% + 8px)` }) }}>{fmt(d.low)}–{fmt(d.high)}</div>
            </div>
          </div>
        )
      })}
      <div style={{ position: 'relative', height: 14, marginLeft: 144, marginTop: 16 }}>
        {ticks.map(t => (
          <span key={t} style={{ position: 'absolute', left: pos(t) + '%', transform: 'translateX(-50%)', fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--tx3)' }}>{fmt(t)}</span>
        ))}
      </div>
    </div>
  )
}
