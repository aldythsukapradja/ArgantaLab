import { useEffect, useRef, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadialBarChart, RadialBar, Tooltip,
} from 'recharts'
import type { GrowthPoint, MintBurnPoint, ActivityKind } from '../data/types'

// Premium animated panel charts (recharts), themed via the cockpit --c-* CSS
// variables (flip light/dark with the surface). Explicit-sized via a measured
// container (never 0 — robust in any viewport); honest empty frame when no data.

const TT = { background: 'var(--c-panel)', border: '1px solid var(--c-panel-bd)', borderRadius: 8, fontSize: 11, color: 'var(--c-text)', padding: '4px 8px' }

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(es => setW(Math.round(es[0].contentRect.width)))
    ro.observe(el)
    setW(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

function EmptyFrame({ h, label }: { h: number; label?: string }) {
  return <div style={{ height: h, display: 'grid', placeItems: 'center', fontSize: 8, letterSpacing: '.1em', color: 'var(--c-muted)', textTransform: 'uppercase', border: '1px dashed var(--c-panel-bd)', borderRadius: 8 }}>{label || '—'}</div>
}

export function AreaTrend({ data, color = 'var(--c-accent)' }: { data?: GrowthPoint[]; color?: string }) {
  const [ref, w] = useWidth()
  const d = (data ?? []).map(p => ({ x: p.week, v: p.value }))
  return (
    <div ref={ref} style={{ width: '100%', height: 64 }}>
      {w > 0 && d.length >= 2 ? (
        <AreaChart width={w} height={64} data={d} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.8} fill={color} fillOpacity={0.14} isAnimationActive animationDuration={700} dot={false} name="engaged" />
          <Tooltip contentStyle={TT} labelStyle={{ display: 'none' }} cursor={{ stroke: 'var(--c-accent2)', strokeWidth: 1 }} />
        </AreaChart>
      ) : <EmptyFrame h={64} />}
    </div>
  )
}

export function MintBurnBars({ data }: { data?: MintBurnPoint[] }) {
  const [ref, w] = useWidth()
  const d = (data ?? []).slice(-14)
  return (
    <div ref={ref} style={{ width: '100%', height: 44 }}>
      {w > 0 && d.length >= 1 ? (
        <BarChart width={w} height={44} data={d} margin={{ top: 2, right: 0, left: 0, bottom: 0 }} barCategoryGap={2}>
          <Bar dataKey="mint" fill="var(--c-accent)" isAnimationActive animationDuration={700} radius={[1, 1, 0, 0]} />
          <Bar dataKey="burn" fill="var(--c-mag)" isAnimationActive animationDuration={700} radius={[1, 1, 0, 0]} />
        </BarChart>
      ) : <EmptyFrame h={44} label="mint vs burn" />}
    </div>
  )
}

export function MixDonut({ data }: { data?: ActivityKind[] }) {
  const [ref, w] = useWidth()
  const d = (data ?? []).slice(0, 6).map(k => ({ name: k.kind, value: k.events }))
  const cols = ['var(--c-slice0)', 'var(--c-slice1)', 'var(--c-slice2)', 'var(--c-slice3)', 'var(--c-slice4)', 'var(--c-muted)']
  return (
    <div ref={ref} style={{ width: '100%', height: 82 }}>
      {w > 0 && d.length ? (
        <PieChart width={w} height={82}>
          <Pie data={d} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={22} outerRadius={38} paddingAngle={2} isAnimationActive animationDuration={700} stroke="none">
            {d.map((_, i) => <Cell key={i} fill={cols[i % cols.length]} />)}
          </Pie>
          <Tooltip contentStyle={TT} />
        </PieChart>
      ) : <EmptyFrame h={82} label="no signal yet" />}
    </div>
  )
}

export function Gauges({ items }: { items: { name: string; value: number | null }[] }) {
  const [ref, w] = useWidth()
  const cols = ['var(--c-accent)', 'var(--c-accent2)', 'var(--c-ok)', 'var(--c-warn)']
  const d = items.map((it, i) => ({ name: it.name, value: it.value == null ? 0 : Math.max(0, Math.min(100, it.value)), fill: cols[i % cols.length] }))
  return (
    <div ref={ref} style={{ width: '100%', height: 104 }}>
      {w > 0 ? (
        <RadialBarChart width={w} height={104} data={d} innerRadius="30%" outerRadius="100%" startAngle={90} endAngle={-270} barSize={7}>
          <RadialBar dataKey="value" background={{ fill: 'var(--c-track)' }} cornerRadius={4} isAnimationActive animationDuration={800} />
          <Tooltip contentStyle={TT} />
        </RadialBarChart>
      ) : <EmptyFrame h={104} />}
    </div>
  )
}
