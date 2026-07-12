// DEV-ONLY chart harness (charts-dev.html) — renders the Mission Control
// panels + every D3 chart with sample data so marks/tooltips/themes/layout
// can be eyeballed without an operator session. Not part of the app bundle.
import React from 'react'
import ReactDOM from 'react-dom/client'
import '../theme.css'
import '../surfaces/portfolio.css'
import { AreaTrend } from '../components/d3/AreaTrend'
import { DonutD3 } from '../components/d3/DonutD3'
import { HBars } from '../components/d3/HBars'
import { StackedCols } from '../components/d3/StackedCols'
import { PunchCard } from '../components/d3/PunchCard'
import { Meter, VCols, Spark } from '../components/d3/micro'
import { fmtDur, appColor, appLabel } from '../components/d3/chartkit'
import { NorthStarStrip, FunnelRail, AttentionPanel, WhoWhen, FleetMatrix } from '../surfaces/Portfolio'
import type {
  SchemaInsights, GrowthOverview, EconomyData, PortfolioVc, RetentionData,
  EngagementData, PowerCurve, AudienceData, GeoData,
} from '../data/types'
import type { KinetikStats } from '../data/live'

// ── deterministic sample pulse ──────────────────────────────────────────────
// ?sparse=1 mimics day-one real data (single beat day, one dominant app, no
// lashira, legacy 'unknown' devices) — the shape that exposed the v1 layout bugs.
const SPARSE = new URLSearchParams(window.location.search).has('sparse')
let seed = 11
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647

const weeks = ['05-18', '05-25', '06-01', '06-08', '06-15', '06-22', '06-29', '07-06']
const days14 = Array.from({ length: 14 }, (_, i) => '06-' + String(24 + i > 30 ? 24 + i - 30 : 24 + i).padStart(2, '0'))
const apps = ['arganta', 'kinetik', 'lashira', 'hq', 'landing']

const o: GrowthOverview = {
  northStar: weeks.map((w, i) => ({ week: w, value: [0, 0, 0, 0, 0, 12, 8, 5][i] })),
  dau: 2, wau: 5, mau: 15, stickiness: 13.3, wauPrev: 9, wowPct: -44.4, depth: 97.2,
  accuracyPct: 82.1, newLearners7d: 0, newWowPct: -100, learners: 15, attempts7d: 486, attemptsTotal: 1284,
  activityMix: [
    { kind: 'journey', events: 989, actives: 5 }, { kind: 'quest', events: 126, actives: 4 },
    { kind: 'openworld', events: 66, actives: 3 }, { kind: 'drill', events: 39, actives: 2 },
    { kind: 'harvest', events: 34, actives: 3 }, { kind: 'reward', events: 21, actives: 4 },
  ],
  generatedAt: '',
}
const v: PortfolioVc = {
  activationRate: 57.9, lessonsCompleted7d: 109, lessonsCompletedTotal: 1180, lessonsPerKidDay: 15.5,
  screenMinPerKidDay: 14, returnRate: 64, d1Retention: 62.8, d1Sample: 43, spentPerActiveKid: 28000,
  familiesTotal: 4, flywheelCount: 4, invitesSent: 11, invitesAccepted: 10, kFactor: 10, generatedAt: '',
}
const e: EconomyData = {
  float: 1_400_000, minted: 1_530_000, spent: 280_000, starterGrant: 1_250_000, recurringMinted: 280_000,
  gifted: 12_000, coverage: 100, sources: [], ledgerRows: 1930,
  mintBurn: weeks.map((w) => ({ week: w, mint: 2000 + Math.round(rnd() * 30000), burn: 500 + Math.round(rnd() * 9000) })),
  generatedAt: '',
}
const i: SchemaInsights = {
  learners: 15, kids: 8, attemptsTotal: 1284, attempts7d: 486, activeLearners7d: 5, accuracyPct: 82.1,
  gamesTotal: 34, gamesPublic: 21, diamondsFloat: 1_400_000, worldsLive: 6, itemsLive: 210, circles: 4, generatedAt: '',
}
const k: KinetikStats = {
  circles: 4, members: 18, posts: 5, posts7d: 2, reactions: 3,
  broadcastsPublished: 5, broadcastViews: 20, broadcastReactions: 0, calPerDay: 10.7,
}
const r: RetentionData = {
  horizons: ['W0', 'W1', 'W2', 'W3', 'W4'],
  cohorts: [
    { label: '06-15', size: 6, ret: [100, 67, 50, 33, null] },
    { label: '06-22', size: 5, ret: [100, 60, 40, null, null] },
    { label: '06-29', size: 4, ret: [100, 50, null, null, null] },
  ],
  generatedAt: '',
}
const engDaily = SPARSE
  ? [
      { day: '07-12', app: 'hq', seconds: 1740 },
      { day: '07-12', app: 'landing', seconds: 900 },
      { day: '07-12', app: 'arganta', seconds: 780 },
      { day: '07-12', app: 'kinetik', seconds: 25 },
    ]
  : days14.flatMap(day => apps.map(app => ({
      day, app,
      seconds: Math.round({ arganta: 2200, kinetik: 1100, lashira: 1500, hq: 700, landing: 150 }[app]! * (0.4 + rnd())),
    })))
const eng: EngagementData = {
  days: 14,
  totalSeconds: engDaily.reduce((s, d) => s + d.seconds, 0),
  totalUsers: 9, totalClicks: 4180,
  apps: apps.map(app => {
    const s = engDaily.filter(d => d.app === app).reduce((x, d) => x + d.seconds, 0)
    const users = SPARSE ? { arganta: 1, kinetik: 1, lashira: 0, hq: 1, landing: 3 }[app]! : { arganta: 6, kinetik: 5, lashira: 4, hq: 1, landing: 7 }[app]!
    const sessions = Math.max(1, users * (SPARSE ? 1 : 3 + Math.round(rnd() * 4)))
    return { app, seconds: s, users, sessions, clicks: Math.round(s / 9), avgSession: Math.round(s / sessions) }
  }).filter(a => a.seconds > 0).sort((a, b) => b.seconds - a.seconds),
  pages: SPARSE
    ? [
        { app: 'hq', page: 'portfolio', seconds: 480, users: 1, clicks: 120 },
        { app: 'arganta', page: 'arena', seconds: 360, users: 1, clicks: 80 },
        { app: 'hq', page: 'architecture', seconds: 300, users: 1, clicks: 40 },
        { app: 'landing', page: 'products', seconds: 240, users: 2, clicks: 22 },
      ]
    : [
        { app: 'arganta', page: 'kinquest', seconds: 9600, users: 5, clicks: 900 },
        { app: 'lashira', page: 'farm-circle', seconds: 7100, users: 4, clicks: 720 },
        { app: 'arganta', page: 'learn', seconds: 5200, users: 6, clicks: 610 },
        { app: 'kinetik', page: 'moments', seconds: 4400, users: 5, clicks: 380 },
        { app: 'lashira', page: 'realm:emberpeak', seconds: 2900, users: 3, clicks: 340 },
        { app: 'kinetik', page: 'calendar', seconds: 2100, users: 4, clicks: 190 },
        { app: 'hq', page: 'portfolio', seconds: 1900, users: 1, clicks: 210 },
        { app: 'landing', page: 'hub', seconds: 900, users: 7, clicks: 60 },
      ],
  daily: engDaily,
  punch: SPARSE
    ? [{ dow: 6, hour: 9, seconds: 1200 }, { dow: 6, hour: 10, seconds: 1400 }, { dow: 6, hour: 14, seconds: 800 }]
    : Array.from({ length: 70 }, (_, idx) => ({
        dow: idx % 7, hour: (6 + idx * 3) % 24, seconds: Math.round(200 + rnd() * 3200),
      })),
  users: [
    { id: 'u1', name: 'Kinara', role: 'kid', seconds: 15200, sessions: 21, lastSeen: '', topApp: 'arganta', topPage: 'arganta · kinquest', perApp: [{ app: 'arganta', seconds: 9800 }, { app: 'lashira', seconds: 4100 }, { app: 'kinetik', seconds: 1300 }] },
    { id: 'u2', name: 'Aldyth', role: 'operator', seconds: 12400, sessions: 18, lastSeen: '', topApp: 'hq', topPage: 'hq · portfolio', perApp: [{ app: 'hq', seconds: 8800 }, { app: 'kinetik', seconds: 2400 }, { app: 'lashira', seconds: 1200 }] },
  ],
  generatedAt: '',
}
const pw: PowerCurve = SPARSE
  ? { days: 14, histogram: Array.from({ length: 14 }, (_, idx) => ({ daysActive: idx + 1, users: idx === 0 ? 2 : 0 })), totalUsers: 2, generatedAt: '' }
  : {
      days: 14,
      histogram: Array.from({ length: 14 }, (_, idx) => ({
        daysActive: idx + 1,
        users: [4, 2, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 2, 3][idx],
      })),
      totalUsers: 17, generatedAt: '',
    }
const au: AudienceData = {
  roles: SPARSE
    ? [{ role: 'operator', count: 1 }, { role: 'user', count: 1 }, { role: 'kid', count: 1 }]
    : [{ role: 'kid', count: 8 }, { role: 'user', count: 5 }, { role: 'operator', count: 2 }],
  ageBands: SPARSE
    ? [{ band: 'unknown', count: 3 }]
    : [{ band: '6–8', count: 3 }, { band: '9–12', count: 4 }, { band: '18+', count: 7 }, { band: 'unknown', count: 1 }],
  genders: [{ gender: 'female', count: 6 }, { gender: 'male', count: 7 }, { gender: 'unspecified', count: 2 }],
  devices: SPARSE
    ? [{ device: 'unknown', seconds: 2100 }, { device: 'desktop', seconds: 1200 }, { device: 'mobile', seconds: 140 }]
    : [{ device: 'mobile', seconds: 61000 }, { device: 'desktop', seconds: 38000 }, { device: 'tablet', seconds: 9000 }],
  generatedAt: '',
}
const geo: GeoData = SPARSE
  ? { regions: [{ tz: 'Asia/Jakarta', users: 1, seconds: 3600 }], referrers: [], generatedAt: '' }
  : {
      regions: [
        { tz: 'Asia/Jakarta', users: 6, seconds: 88000 }, { tz: 'Europe/Paris', users: 2, seconds: 14000 },
        { tz: 'Asia/Singapore', users: 1, seconds: 4000 },
      ],
      referrers: [{ ref: 'google.com', sessions: 4 }, { ref: 'linkedin.com', sessions: 2 }],
      generatedAt: '',
    }

// ── harness ────────────────────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 16, marginBottom: 14 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )
}

// Reproduces the real Shell's height budget: Portfolio is a "full" surface
// (Shell.tsx → .content-flush, zero padding), so .mc-wrap gets exactly
// 100vh minus the 54px topbar — matched here so overflow that would be
// invisible in the app is caught in the harness too.
function MissionControlPreview() {
  const [days, setDays] = React.useState(14)
  return (
    <div className="mc-wrap" style={{ height: 'calc(100vh - 54px)', border: '1px dashed var(--bd3)' }}>
      <div className="mc">
        <NorthStarStrip o={o} v={v} days={days} setDays={setDays} ago={3} />
        <FunnelRail o={o} v={v} e={e} r={r} />
        <AttentionPanel o={o} e={e} eng={eng} pw={pw} days={days} hasBeats={true} />
        <WhoWhen eng={eng} au={au} geo={geo} hasBeats={true} />
        <FleetMatrix i={i} k={k} o={o} v={v} eng={eng} days={days} />
      </div>
    </div>
  )
}

function Harness() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light')
  React.useEffect(() => { document.documentElement.setAttribute('data-theme', theme) }, [theme])
  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>
      <div className="spread" style={{ marginBottom: 16 }}>
        <div className="h1">Mission Control + D3 chart harness (sample data)</div>
        <button className="chip" data-testid="theme-toggle" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>theme: {theme}</button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <MissionControlPreview />
      </div>

      <Card title="Micro · Meter / VCols / Spark">
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div>
            <Meter pct={72} tick={60} color="var(--ch1)" />
            <div style={{ height: 8 }} />
            <Meter pct={34} tick={60} color="var(--ch2)" />
          </div>
          <VCols values={Array.from({ length: 14 }, (_, idx) => ({ label: (idx + 1) + 'd', value: [5, 3, 2, 1, 1, 0, 1, 1, 0, 1, 1, 2, 2, 3][idx] }))} />
          <Spark values={[3, 5, 2, 8, 6, 9, 7, 11]} color="var(--ch3)" />
        </div>
      </Card>

      <Card title="AreaTrend · dual series">
        <AreaTrend labels={weeks}
          series={[
            { key: 'mint', label: 'Mint · earned', color: 'var(--ch1)', area: true },
            { key: 'burn', label: 'Burn · spent', color: 'var(--ch3)', dash: true },
          ]}
          data={weeks.map((_, idx) => ({ mint: 4000 + idx * 900, burn: 1200 + idx * 500 }))} />
      </Card>
      <Card title="StackedCols · daily time by app">
        <StackedCols labels={days14}
          data={days14.map(day => Object.fromEntries(apps.map(a => [a, engDaily.find(d => d.day === day && d.app === a)?.seconds ?? 0])))}
          valueFmt={fmtDur}
          series={apps.map(a => ({ key: a, label: appLabel(a), color: appColor(a) }))} />
      </Card>
      <Card title="DonutD3 + HBars + PunchCard">
        <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '1fr 1fr' }}>
          <DonutD3 valueFmt={fmtDur} centerValue="14.2h" centerLabel="total"
            slices={apps.map((a, idx) => ({ label: appLabel(a), value: 3600 * (5 - idx) + 500, color: appColor(a) }))} />
          <HBars valueFmt={fmtDur} labelWidth={160}
            bars={eng.pages.slice(0, 6).map(p => ({ label: `${appLabel(p.app)} · ${p.page}`, value: p.seconds, color: appColor(p.app) }))} />
        </div>
        <div style={{ marginTop: 14 }}><PunchCard punch={eng.punch} /></div>
      </Card>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Harness />)
