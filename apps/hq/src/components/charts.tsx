import type { ReactNode } from 'react'
import { LineChart as LineIcon, BarChart3, PieChart, Grid3x3, LayoutGrid } from 'lucide-react'
import type { GrowthPoint, RetentionData } from '../data/types'
import { LineChart } from './LineChart'
import { CohortHeat } from './CohortHeat'
import { compact } from '../lib/format'

// ── Scalable chart system ─────────────────────────────────────────────────
// One discriminated union + one <ChartView> dispatcher. Adding a future chart =
// add a variant to ChartData, a branch in ChartView, and an entry in CHART_KINDS.
// Every chart is theme-token coloured and dependency-free.

export type ChartKind = 'line' | 'bars' | 'donut' | 'cohort' | 'kpis'

export type ChartData =
  | { kind: 'line'; points: GrowthPoint[] }
  | { kind: 'bars'; bars: Bar[]; unit?: string }
  | { kind: 'donut'; slices: Slice[]; centerLabel?: string; centerValue?: string }
  | { kind: 'cohort'; data: RetentionData }
  | { kind: 'kpis'; items: KpiItem[] }

export interface Bar { label: string; value: number; color?: string }
export interface Slice { label: string; value: number; color: string }
export interface KpiItem { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' | 'bad' }

// Registry — the catalogue of chart kinds the workspace can render. Future
// charts register here so pickers/galleries pick them up automatically.
export const CHART_KINDS: { kind: ChartKind; label: string; Icon: typeof LineIcon; blurb: string }[] = [
  { kind: 'line', label: 'Trend line', Icon: LineIcon, blurb: 'Time series — north-star, weekly active' },
  { kind: 'bars', label: 'Bars', Icon: BarChart3, blurb: 'Funnels, distributions, flows' },
  { kind: 'donut', label: 'Donut', Icon: PieChart, blurb: 'Composition — share of a whole' },
  { kind: 'cohort', label: 'Cohort heat', Icon: Grid3x3, blurb: 'Retention triangle' },
  { kind: 'kpis', label: 'KPI tiles', Icon: LayoutGrid, blurb: 'Headline metric cards' },
]

const PALETTE = ['var(--acc)', 'var(--mag)', 'var(--ok)', 'var(--warn)', 'var(--tl)', 'var(--bad)']
export const chartColor = (i: number) => PALETTE[i % PALETTE.length]

export function ChartView({ data }: { data: ChartData }): ReactNode {
  switch (data.kind) {
    case 'line': return <LineChart points={data.points} />
    case 'cohort': return <CohortHeat data={data.data} />
    case 'bars': return <Bars bars={data.bars} unit={data.unit} />
    case 'donut': return <Donut slices={data.slices} centerLabel={data.centerLabel} centerValue={data.centerValue} />
    case 'kpis': return <KpiTiles items={data.items} />
  }
}

function Bars({ bars, unit }: { bars: Bar[]; unit?: string }) {
  if (!bars.length) return null
  const max = Math.max(1, ...bars.map(b => b.value))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {bars.map((b, i) => (
        <div key={b.label} className="row" style={{ gap: 12 }}>
          <div style={{ width: 150, fontSize: 12.5, color: 'var(--tx2)', flex: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.label}</div>
          <div style={{ flex: 1, height: 24, background: 'var(--bg3)', borderRadius: 7, overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(3, Math.round((100 * b.value) / max))}%`, height: '100%', borderRadius: 7, background: b.color || chartColor(i), transition: 'width .5s var(--ease)' }} />
          </div>
          <div style={{ width: 70, textAlign: 'right', fontSize: 12.5, fontWeight: 600 }}>{compact(b.value)}{unit || ''}</div>
        </div>
      ))}
    </div>
  )
}

function Donut({ slices, centerLabel, centerValue }: { slices: Slice[]; centerLabel?: string; centerValue?: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1
  const R = 64, SW = 22, C = 2 * Math.PI * R
  let off = 0
  return (
    <div className="row" style={{ gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
      <svg viewBox="0 0 160 160" width="160" height="160" style={{ flex: 'none' }}>
        <circle cx="80" cy="80" r={R} fill="none" stroke="var(--bg3)" strokeWidth={SW} />
        {slices.map((s) => {
          const len = (s.value / total) * C
          const el = (
            <circle key={s.label} cx="80" cy="80" r={R} fill="none" stroke={s.color} strokeWidth={SW}
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 80 80)"
              style={{ transition: 'stroke-dasharray .5s var(--ease)' }} />
          )
          off += len
          return el
        })}
        {centerValue && <text x="80" y="78" fontSize={22} fontWeight={700} fill="var(--tx)" textAnchor="middle">{centerValue}</text>}
        {centerLabel && <text x="80" y="98" fontSize={10} fill="var(--tx3)" textAnchor="middle">{centerLabel}</text>}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {slices.map(s => (
          <div key={s.label} className="row" style={{ gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color, flex: 'none' }} />
            <span style={{ color: 'var(--tx2)' }}>{s.label}</span>
            <span style={{ fontWeight: 600, marginLeft: 'auto' }}>{compact(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function KpiTiles({ items }: { items: KpiItem[] }) {
  const tone = (t?: string) => t === 'ok' ? 'var(--ok)' : t === 'warn' ? 'var(--warn)' : t === 'bad' ? 'var(--bad)' : 'var(--tx3)'
  return (
    <div className="kpi-grid">
      {items.map(k => (
        <div key={k.label} className="kpi">
          <div className="kpi-l">{k.label}</div>
          <div className={'kpi-v' + (k.value === '—' ? ' empty' : '')}>{k.value}</div>
          {k.sub && <div className="kpi-s" style={{ color: tone(k.tone) }}>{k.sub}</div>}
        </div>
      ))}
    </div>
  )
}
