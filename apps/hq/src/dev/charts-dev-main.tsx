// DEV-ONLY chart harness (charts-dev.html) — renders every D3 chart with
// sample data so the marks/tooltips/themes can be eyeballed without an
// operator session. Not part of the app bundle; safe to delete.
import React from 'react'
import ReactDOM from 'react-dom/client'
import '../theme.css'
import { AreaTrend } from '../components/d3/AreaTrend'
import { DonutD3 } from '../components/d3/DonutD3'
import { HBars } from '../components/d3/HBars'
import { StackedCols } from '../components/d3/StackedCols'
import { PunchCard } from '../components/d3/PunchCard'
import { fmtDur, appColor, appLabel } from '../components/d3/chartkit'

const weeks = ['05-18', '05-25', '06-01', '06-08', '06-15', '06-22', '06-29', '07-06']
const ns = [0, 0, 0, 0, 0, 12, 8, 5]
const apps = ['arganta', 'kinetik', 'lashira', 'hq', 'landing']
const days = Array.from({ length: 14 }, (_, i) => `06-${(24 + i) % 30 + 1}`.padStart(5, '0'))
const daily = days.map((_, i) => ({
  arganta: 1800 + Math.round(1400 * Math.abs(Math.sin(i))),
  kinetik: 900 + Math.round(600 * Math.abs(Math.cos(i / 2))),
  lashira: i % 3 === 0 ? 2400 : 700,
  hq: 500,
  landing: i % 4 === 0 ? 300 : 60,
}))
const punch = Array.from({ length: 60 }, (_, i) => ({
  dow: i % 7, hour: (7 + (i * 3)) % 24, seconds: 120 + ((i * 997) % 3600),
}))

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 16, marginBottom: 14 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )
}

function Harness() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light')
  React.useEffect(() => { document.documentElement.setAttribute('data-theme', theme) }, [theme])
  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: 24 }}>
      <div className="spread" style={{ marginBottom: 16 }}>
        <div className="h1">D3 chart harness</div>
        <button className="chip" data-testid="theme-toggle" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>theme: {theme}</button>
      </div>
      <Card title="AreaTrend · single series (north star)">
        <AreaTrend labels={weeks} series={[{ key: 'v', label: 'Weekly engaged', color: 'var(--ch1)', area: true }]}
          data={ns.map(v => ({ v }))} />
      </Card>
      <Card title="AreaTrend · dual series (mint vs burn)">
        <AreaTrend labels={weeks}
          series={[
            { key: 'mint', label: 'Mint · earned', color: 'var(--ch1)', area: true },
            { key: 'burn', label: 'Burn · spent', color: 'var(--ch3)', dash: true },
          ]}
          data={weeks.map((_, i) => ({ mint: 4000 + i * 900, burn: 1200 + i * 500 }))} />
      </Card>
      <Card title="StackedCols · daily time by app">
        <StackedCols labels={days} data={daily} valueFmt={fmtDur}
          series={apps.map(a => ({ key: a, label: appLabel(a), color: appColor(a) }))} />
      </Card>
      <Card title="DonutD3 · share of time">
        <DonutD3 valueFmt={fmtDur} centerValue="14.2h" centerLabel="total"
          slices={apps.map((a, i) => ({ label: appLabel(a), value: 3600 * (5 - i) + 500, color: appColor(a) }))} />
      </Card>
      <Card title="HBars · top pages">
        <HBars valueFmt={fmtDur} labelWidth={185}
          bars={[
            { label: 'ArgantaLab · kinquest', value: 9600, color: appColor('arganta') },
            { label: 'ArgantaLab · learn', value: 7200, color: appColor('arganta') },
            { label: 'KinetikCircle · moments', value: 4400, color: appColor('kinetik') },
            { label: 'LashiraBloom · farm-circle', value: 4100, color: appColor('lashira') },
            { label: 'Circle HQ · portfolio', value: 1600, color: appColor('hq') },
            { label: 'Landing · hub', value: 400, color: appColor('landing') },
          ]} />
      </Card>
      <Card title="PunchCard · rhythm of the week">
        <PunchCard punch={punch} />
      </Card>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Harness />)
