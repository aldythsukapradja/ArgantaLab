// Renders an Analysis (from analytics.ts) with the chart type the picker chose.
// recharts for line/area/bar/pie/scatter; d3-geo for the world map; a small SVG
// grid for the heatmap. Fills the stage; theme-aware via currentColor/opacity.

import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { geoNaturalEarth1, geoPath, geoGraticule10 } from 'd3-geo'
import type { Analysis } from './analytics'

const COLORS = ['#7c3aad', '#ef8060', '#1694a0', '#9b4fd0', '#f0b429', '#3b82f6', '#e0457b']
const fmtMoney = (n: number) => (n >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? '$' + (n / 1e3).toFixed(0) + 'k' : '$' + Math.round(n))
const fmtNum = (n: number) => (n >= 1e3 ? (n / 1e3).toFixed(0) + 'k' : String(Math.round(n)))
const yFmt = (u?: string) => (u === 'money' ? fmtMoney : u === '%' ? (n: number) => n + '%' : fmtNum)

export function AnalyticsChart({ a }: { a: Analysis }) {
  const fmt = yFmt(a.unit)
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="chart-head">
        <div><b>{a.title}</b><span className="chart-type">{a.chart}</span></div>
        <div className="chart-src">{a.source}</div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Body a={a} fmt={fmt} />
      </div>
      <div className="chart-reason">▸ picked <b>{a.chart}</b> — {a.reason}</div>
    </div>
  )
}

/** C5-B1b — the chart canvas alone (no title/source chrome), so Arganta Core's
 * chat card can wrap it in its own provenance header instead of reproducing a
 * second, drifting copy of every chart renderer. */
export function ChartCanvas({ a }: { a: Analysis }) {
  return <Body a={a} fmt={yFmt(a.unit)} />
}

function Body({ a, fmt }: { a: Analysis; fmt: (n: number) => string }) {
  const grid = <CartesianGrid strokeOpacity={0.12} vertical={false} />
  const tip = <Tooltip formatter={(v: any) => (typeof v === 'number' ? fmt(v) : v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />

  if (a.chart === 'area' || a.chart === 'line') {
    const C = a.chart === 'area' ? AreaChart : LineChart
    // A line/area chart may carry SEVERAL series (mint vs burn). Previously only
    // encoding.y was drawn, so any extra series was silently dropped — a chart
    // that quietly answers half the question. Fall back to [y] when no explicit
    // series list is given, which is the single-series case unchanged.
    const keys = a.encoding.series?.length ? a.encoding.series : [a.encoding.y!]
    return (
      <ResponsiveContainer width="100%" height="100%">
        <C data={a.data} margin={{ top: 10, right: 16, bottom: 4, left: 4 }}>
          {grid}
          <XAxis dataKey={a.encoding.x} tickFormatter={(v: any) => (typeof v === 'number' ? fmtNum(v) : v)} fontSize={11} />
          <YAxis tickFormatter={fmt} fontSize={11} width={48} />
          {tip}
          {keys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {keys.map((k, i) => (a.chart === 'area'
            ? <Area key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.22} strokeWidth={2} />
            : <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />))}
        </C>
      </ResponsiveContainer>
    )
  }
  if (a.chart === 'bar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={a.data} margin={{ top: 10, right: 16, bottom: 4, left: 4 }}>
          {grid}
          <XAxis dataKey={a.encoding.x || a.encoding.label} fontSize={11} />
          <YAxis tickFormatter={fmt} fontSize={11} width={48} />
          {tip}
          <Bar dataKey={a.encoding.y || a.encoding.value!} radius={[6, 6, 0, 0]}>
            {a.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }
  if (a.chart === 'pie') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          {tip}
          <Pie data={a.data} dataKey={a.encoding.value!} nameKey={a.encoding.label!} innerRadius="45%" outerRadius="72%" paddingAngle={2} label={(e: any) => e.label}>
            {a.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    )
  }
  if (a.chart === 'scatter') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 16, bottom: 10, left: 4 }}>
          {grid}
          <XAxis dataKey={a.encoding.x} fontSize={11} tickFormatter={fmtNum} />
          <YAxis dataKey={a.encoding.y} fontSize={11} width={48} tickFormatter={fmt} />
          {tip}
          <Scatter data={a.data} fill={COLORS[0]} />
        </ScatterChart>
      </ResponsiveContainer>
    )
  }
  if (a.chart === 'heatmap') return <Heatmap a={a} />
  if (a.chart === 'geo') return <GeoMap a={a} />
  return null
}

function Heatmap({ a }: { a: Analysis }) {
  const cols = a.encoding.series || []
  const color = (t: number) => `rgba(124,58,173,${0.12 + t * 0.8})`
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `140px repeat(${cols.length}, 1fr)`, gap: 4, alignContent: 'center', height: '100%', padding: '8px 4px' }}>
      <div />
      {cols.map(c => <div key={c} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', opacity: 0.7 }}>{c}</div>)}
      {a.data.map((row, i) => (
        <div key={i} style={{ display: 'contents' }}>
          <div style={{ fontSize: 12, display: 'flex', alignItems: 'center' }}>{row[a.encoding.label!]}</div>
          {cols.map((c, j) => (
            <div key={c} title={`${row.raw?.[j] ?? ''}`} style={{ background: color(row[c]), borderRadius: 8, minHeight: 34, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 600, color: row[c] > 0.6 ? '#fff' : 'inherit' }}>
              {row.raw ? row.raw[j] : Math.round(row[c] * 100)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function GeoMap({ a }: { a: Analysis }) {
  const W = 820, H = 420
  const proj = geoNaturalEarth1().scale(158).translate([W / 2, H / 2 + 10])
  const path = geoPath(proj as any)
  const maxV = Math.max(...a.data.map((d: any) => d[a.encoding.value!])) || 1
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <path d={path({ type: 'Sphere' } as any) || ''} fill="rgba(124,58,173,0.06)" stroke="currentColor" strokeOpacity={0.18} />
      <path d={path(geoGraticule10() as any) || ''} fill="none" stroke="currentColor" strokeOpacity={0.1} />
      {a.data.map((d: any, i: number) => {
        const p = proj([d.lon, d.lat])
        if (!p) return null
        const r = 6 + (d[a.encoding.value!] / maxV) * 26
        return (
          <g key={i}>
            <circle cx={p[0]} cy={p[1]} r={r} fill={COLORS[i % COLORS.length]} fillOpacity={0.55} stroke={COLORS[i % COLORS.length]} />
            <text x={p[0]} y={p[1] - r - 3} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.8}>{d[a.encoding.label!]} · {d[a.encoding.value!]}%</text>
          </g>
        )
      })}
    </svg>
  )
}
