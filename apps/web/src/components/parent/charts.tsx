import { ResponsiveRadar } from '@nivo/radar'
import { ResponsiveCalendar } from '@nivo/calendar'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsiveLine } from '@nivo/line'
import type { NivoTheme } from '@lib/nivoTheme'
import { BLOOM_META, COMPETENCY_META, type Bloom, type Competency } from '@lib/taxonomy'
import type { DailyRow } from '@lib/parentDash'
import { WORLDS } from '@/data/learn'

// All charts are theme-driven (NivoTheme from CSS vars) and animate on mount.
// Each sizes itself to its parent .pc-box (fixed height in CSS).

const accent = '#4D9FFF', green = '#3DE08A'

// ── Competency radar (Cambridge Life Competencies) ──────────────
export function CompetencyRadar({ data, theme }: { data: { competency: Competency; pct: number }[]; theme: NivoTheme }) {
  const rows = data.map(d => ({ axis: COMPETENCY_META[d.competency].short, score: d.pct }))
  return (
    <ResponsiveRadar
      data={rows}
      keys={['score']}
      indexBy="axis"
      maxValue={100}
      margin={{ top: 30, right: 40, bottom: 24, left: 40 }}
      gridShape="circular"
      gridLabelOffset={14}
      dotSize={8}
      dotColor={accent}
      dotBorderWidth={2}
      dotBorderColor={{ from: 'color' }}
      colors={[accent]}
      fillOpacity={0.22}
      blendMode="normal"
      borderColor={accent}
      borderWidth={2}
      gridLevels={4}
      theme={theme}
      animate
      motionConfig="gentle"
      isInteractive
    />
  )
}

// ── Bloom depth bars (how deep the thinking goes) ───────────────
export function BloomBar({ data, theme }: { data: { bloom: Bloom; n: number; pct: number }[]; theme: NivoTheme }) {
  const rows = data.map(d => ({ level: BLOOM_META[d.bloom].label, pct: d.pct, n: d.n, color: BLOOM_META[d.bloom].color }))
  return (
    <ResponsiveBar
      data={rows}
      keys={['pct']}
      indexBy="level"
      margin={{ top: 12, right: 16, bottom: 44, left: 38 }}
      padding={0.32}
      colors={({ data: d }) => d.color as string}
      borderRadius={6}
      enableGridY
      axisBottom={{ tickSize: 0, tickPadding: 8, tickRotation: 0 }}
      axisLeft={{ tickSize: 0, tickPadding: 6, format: (v) => `${v}%`, tickValues: 4 }}
      label={(d) => `${d.value}%`}
      labelSkipHeight={14}
      valueFormat={(v) => `${v}%`}
      tooltip={({ data: d }) => (
        <div style={{ padding: '6px 10px', fontSize: 12 }}>
          <b>{d.level}</b> · {d.pct}% of answers ({d.n})
        </div>
      )}
      theme={theme}
      animate
      motionConfig="gentle"
    />
  )
}

// ── Interest map (where the time goes, last 30 days) ────────────
export function InterestBar({ interest, theme }: { interest: Record<string, number>; theme: NivoTheme }) {
  const rows = WORLDS
    .map(w => ({ world: w.name, count: interest[w.key] ?? 0, color: w.color }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count)
  return (
    <ResponsiveBar
      data={rows}
      keys={['count']}
      indexBy="world"
      layout="horizontal"
      margin={{ top: 6, right: 18, bottom: 24, left: 96 }}
      padding={0.3}
      colors={({ data: d }) => d.color as string}
      borderRadius={6}
      axisBottom={{ tickSize: 0, tickPadding: 8, tickValues: 4 }}
      axisLeft={{ tickSize: 0, tickPadding: 8 }}
      enableGridX
      enableGridY={false}
      label={(d) => `${d.value}`}
      labelSkipWidth={20}
      tooltip={({ data: d }) => (
        <div style={{ padding: '6px 10px', fontSize: 12 }}><b>{d.world}</b> · {d.count} answers</div>
      )}
      theme={theme}
      animate
      motionConfig="gentle"
    />
  )
}

// ── Activity calendar (daily volume heatmap) ────────────────────
export function ActivityCalendar({ daily, theme }: { daily: DailyRow[]; theme: NivoTheme }) {
  const data = daily.filter(d => d.items > 0).map(d => ({ day: d.day, value: d.items }))
  const to = new Date().toISOString().slice(0, 10)
  const from = new Date(Date.now() - 119 * 864e5).toISOString().slice(0, 10)
  return (
    <ResponsiveCalendar
      data={data}
      from={from}
      to={to}
      emptyColor="var(--border)"
      colors={['#bcd9ff', accent, '#2563eb', '#1e40af']}
      margin={{ top: 16, right: 12, bottom: 8, left: 12 }}
      monthBorderColor="transparent"
      dayBorderWidth={2}
      dayBorderColor="transparent"
      daySpacing={2}
      theme={theme}
    />
  )
}

// ── Trajectory line (items + correct per active day) ────────────
export function TrajectoryLine({ daily, theme }: { daily: DailyRow[]; theme: NivoTheme }) {
  const active = daily.filter(d => d.items > 0).slice(-28)
  const series = [
    { id: 'Attempted', color: accent, data: active.map(d => ({ x: d.day.slice(5), y: d.items })) },
    { id: 'Correct', color: green, data: active.map(d => ({ x: d.day.slice(5), y: d.correct })) },
  ]
  return (
    <ResponsiveLine
      data={series}
      margin={{ top: 16, right: 18, bottom: 40, left: 38 }}
      xScale={{ type: 'point' }}
      yScale={{ type: 'linear', min: 0, max: 'auto' }}
      curve="monotoneX"
      colors={(s) => (s as { color: string }).color}
      lineWidth={3}
      enableArea
      areaOpacity={0.1}
      enablePoints
      pointSize={6}
      pointColor={{ from: 'serieColor' }}
      pointBorderWidth={2}
      pointBorderColor={{ from: 'serieColor' }}
      enableGridX={false}
      axisBottom={{ tickSize: 0, tickPadding: 8, tickRotation: -40, tickValues: Math.min(7, active.length) }}
      axisLeft={{ tickSize: 0, tickPadding: 6, tickValues: 4 }}
      useMesh
      theme={theme}
      animate
      motionConfig="gentle"
      legends={[{
        anchor: 'top-right', direction: 'row', translateY: -10, itemWidth: 84, itemHeight: 16,
        symbolSize: 10, symbolShape: 'circle', itemTextColor: 'var(--t2)',
      }]}
    />
  )
}
