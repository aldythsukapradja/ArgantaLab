import { ResponsiveRadar } from '@nivo/radar'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsiveLine } from '@nivo/line'
import type { NivoTheme } from '@lib/nivoTheme'
import { BLOOM_META, BLOOM_ORDER, COMPETENCY_META, type Bloom, type Competency } from '@lib/taxonomy'
import type { DailyRow } from '@lib/parentDash'
import { WORLDS } from '@/data/learn'

// All charts are theme-driven (NivoTheme from CSS vars) and animate on mount.
// Each sizes itself to its parent .pc-box (fixed height in CSS).

const accent = '#4D9FFF', green = '#3DE08A'

// ── Competency radar (Cambridge Life Competencies) ──────────────
export function CompetencyRadar({ data, theme }: { data: { competency: Competency; pct: number }[]; theme: NivoTheme }) {
  // Empty-safe: always render the full set of axes (zeros when no data).
  const src = data.length ? data : (Object.keys(COMPETENCY_META) as Competency[]).map(c => ({ competency: c, pct: 0 }))
  const rows = src.map(d => ({ axis: COMPETENCY_META[d.competency].short, score: d.pct }))
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
  const src = data.length ? data : BLOOM_ORDER.map(b => ({ bloom: b, n: 0, pct: 0 }))
  const rows = src.map(d => ({ level: BLOOM_META[d.bloom].label, pct: d.pct, n: d.n, color: BLOOM_META[d.bloom].color }))
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
  // Always show every world (zeros when no data) so the frame is never blank.
  const rows = WORLDS
    .map(w => ({ world: w.name, count: interest[w.key] ?? 0, color: w.color }))
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

// ── Activity calendar — custom full-year heatmap that fills the card ───
const DOW = ['', 'Mon', '', 'Wed', '', 'Fri', '']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function ActivityCalendar({ daily }: { daily: DailyRow[]; theme?: NivoTheme }) {
  const byDay = new Map(daily.map(d => [d.day, d.items]))
  const max = Math.max(1, ...daily.map(d => d.items))
  const WEEKS = 53                                   // a full year, GitHub-style
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const cur = new Date(today); cur.setDate(cur.getDate() - (WEEKS * 7 - 1) - cur.getDay())
  const cols: { label: string; days: { key: string; n: number }[] }[] = []
  let prevMonth = -1
  for (let w = 0; w < WEEKS; w++) {
    const days: { key: string; n: number }[] = []
    let label = ''
    for (let d = 0; d < 7; d++) {
      const m = cur.getMonth()
      if (d === 0 && m !== prevMonth && cur.getDate() <= 7) { label = MON[m]; prevMonth = m }
      days.push({ key: cur.toISOString().slice(0, 10), n: byDay.get(cur.toISOString().slice(0, 10)) ?? 0 })
      cur.setDate(cur.getDate() + 1)
    }
    cols.push({ label, days })
  }
  const fill = (n: number) => n === 0 ? 'var(--border)' : `rgba(77,159,255,${(0.3 + 0.7 * Math.min(1, n / max)).toFixed(2)})`
  // one grid: a labels column + 53 week columns (1fr each) so it stretches to fill.
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `auto repeat(${WEEKS}, minmax(0, 1fr))`, gridTemplateRows: '13px repeat(7, 1fr)', columnGap: 2, rowGap: 2, width: '100%' }}>
      {/* corner */}
      <span />
      {/* month labels row */}
      {cols.map((c, ci) => <span key={'m' + ci} style={{ gridRow: 1, fontSize: 9, color: 'var(--t2)', whiteSpace: 'nowrap', overflow: 'visible' }}>{c.label}</span>)}
      {/* day-of-week labels + cells, row by row */}
      {[0, 1, 2, 3, 4, 5, 6].map(r => (
        <ActivityRow key={r} row={r} label={DOW[r]} cols={cols} fill={fill} />
      ))}
    </div>
  )
}

function ActivityRow({ row, label, cols, fill }: {
  row: number; label: string
  cols: { label: string; days: { key: string; n: number }[] }[]
  fill: (n: number) => string
}) {
  return (
    <>
      <span style={{ gridRow: row + 2, gridColumn: 1, fontSize: 9, color: 'var(--t2)', paddingRight: 6, alignSelf: 'center' }}>{label}</span>
      {cols.map((c, ci) => {
        const d = c.days[row]
        return <span key={ci} title={`${d.key}: ${d.n} answered`} style={{ gridRow: row + 2, gridColumn: ci + 2, aspectRatio: '1', borderRadius: 2, background: fill(d.n) }} />
      })}
    </>
  )
}

// ── Trajectory line (items + correct per active day) ────────────
export function TrajectoryLine({ daily, theme }: { daily: DailyRow[]; theme: NivoTheme }) {
  const real = daily.filter(d => d.items > 0).slice(-28)
  // Empty-safe: a flat last-7-days baseline so the axes/line frame always shows.
  const active = real.length ? real : Array.from({ length: 7 }, (_, i) => ({
    day: new Date(Date.now() - (6 - i) * 864e5).toISOString().slice(0, 10), items: 0, correct: 0, minutes: 0, xp: 0,
  }))
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
