import type { ReactNode } from 'react'
import { LineChart as LineIcon, BarChart3, PieChart, Grid3x3, LayoutGrid } from 'lucide-react'
import type { GrowthPoint, RetentionData } from '../data/types'
import { LineChart } from './LineChart'
import { CohortHeat } from './CohortHeat'
import { DonutD3 } from './d3/DonutD3'
import { HBars } from './d3/HBars'
import { slotColor } from './d3/chartkit'

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

// Fixed-order categorical slots — CVD-validated per theme (see theme.css).
export const chartColor = (i: number) => slotColor(i)

export function ChartView({ data }: { data: ChartData }): ReactNode {
  switch (data.kind) {
    case 'line': return <LineChart points={data.points} />
    case 'cohort': return <CohortHeat data={data.data} />
    case 'bars': return <Bars bars={data.bars} unit={data.unit} />
    case 'donut': return <Donut slices={data.slices} centerLabel={data.centerLabel} centerValue={data.centerValue} />
    case 'kpis': return <KpiTiles items={data.items} />
  }
}

// D3-backed marks: horizontal bars with rounded data-ends + hover tooltips.
function Bars({ bars }: { bars: Bar[]; unit?: string }) {
  if (!bars.length) return null
  return <HBars bars={bars.map((b, i) => ({ label: b.label, value: b.value, color: b.color || chartColor(i) }))} />
}

// D3 arc donut — 2px surface gaps, hover lift, tooltip, legend with shares.
function Donut({ slices, centerLabel, centerValue }: { slices: Slice[]; centerLabel?: string; centerValue?: string }) {
  return <DonutD3 slices={slices} centerLabel={centerLabel} centerValue={centerValue} />
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
