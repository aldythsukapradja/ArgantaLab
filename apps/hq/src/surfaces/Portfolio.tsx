import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './portfolio.css'
import { live } from '../data/live'
import type {
  SchemaInsights, GrowthOverview, EconomyData, PortfolioVc, EngagementData,
  PowerCurve, AudienceData, GeoData, RetentionData,
} from '../data/types'
import type { KinetikStats } from '../data/live'
import { AreaTrend } from '../components/d3/AreaTrend'
import { DonutD3 } from '../components/d3/DonutD3'
import { HBars } from '../components/d3/HBars'
import { StackedCols } from '../components/d3/StackedCols'
import { PunchCard } from '../components/d3/PunchCard'
import { Meter, VCols, Spark } from '../components/d3/micro'
import { fmtDur, appColor, appLabel, slotColor } from '../components/d3/chartkit'
import { PRESETS, DEFAULT_GLOBALS, computeScenario } from '../data/monetization'
import { kindLabel } from '../data/growth'
import { Empty, Loading } from '../components/Empty'
import { compact, pct } from '../lib/format'

// Portfolio · Mission Control — one page, edge-to-edge, no scroll at desktop.
// Reading order: are we growing? (north-star strip) → where does the funnel
// leak? (left rail) → where does attention go? (center + right) → how is each
// app doing? (fleet matrix, same 8-question contract per app). Every number
// is a live RPC; panels that need the beats pipeline degrade honestly until
// migration_hq_engagement_v3.sql has been run.

const SUB_ARPU = PRESETS.mid.conv * PRESETS.mid.price
const BLEND_ARPU = computeScenario(PRESETS.mid, 1000, DEFAULT_GLOBALS).arpu
const usd2 = (n: number) => '$' + n.toFixed(2)
const RANGES = [7, 14, 30] as const
const REFRESH_MS = 45_000

/** One visual language for "nothing here yet" — replaces the three ad-hoc
 * empty styles v1 had (a centered card, a bare .mc-note line, a custom hint). */
function McEmpty({ headline, body, inline = false }: { headline: string; body: string; inline?: boolean }) {
  return (
    <div className={'mc-empty' + (inline ? ' mc-empty-inline' : '')}>
      <div className="h">{headline}</div>
      <div className="b">{body}</div>
    </div>
  )
}

interface Pulse {
  i: SchemaInsights | null
  k: KinetikStats | null
  o: GrowthOverview | null
  e: EconomyData | null
  v: PortfolioVc | null
  r: RetentionData | null
  eng: EngagementData | null
  pw: PowerCurve | null
  au: AudienceData | null
  geo: GeoData | null
}

function useLivePulse(days: number) {
  const [pulse, setPulse] = useState<Pulse | undefined>(undefined)
  const [flight, setFlight] = useState(false)
  const [stamp, setStamp] = useState<number | null>(null)
  const [, forceTick] = useState(0)
  const alive = useRef(true)

  const fetchAll = useCallback(async () => {
    setFlight(true)
    const [i, k, o, e, v, r, eng, pw, au, geo] = await Promise.all([
      live.schemaInsights(), live.kinetikStats(), live.growthOverview(),
      live.economy(), live.portfolioVc(), live.retention(),
      live.engagement(days), live.powerCurve(days), live.audience(), live.geo(30),
    ])
    if (!alive.current) return
    setPulse({ i, k, o, e, v, r, eng, pw, au, geo })
    setStamp(Date.now())
    setFlight(false)
  }, [days])

  useEffect(() => {
    alive.current = true
    void fetchAll()
    const iv = setInterval(() => {
      if (document.visibilityState === 'visible') void fetchAll()
    }, REFRESH_MS)
    const tick = setInterval(() => forceTick(t => t + 1), 5000)
    return () => { alive.current = false; clearInterval(iv); clearInterval(tick) }
  }, [fetchAll])

  return { pulse, flight, stamp }
}

export function Portfolio() {
  const [days, setDays] = useState<number>(14)
  const { pulse, flight, stamp } = useLivePulse(days)

  if (pulse === undefined) return <div className="mc-wrap"><Loading label="Loading mission control…" /></div>
  const { i, k, o, e, v, r, eng, pw, au, geo } = pulse
  const offline = !i && !k && !o && !v

  if (offline) {
    return (
      <div className="mc-wrap">
        <Empty title="Mission Control needs a live connection">
          Connect Supabase and sign in as operator — every panel populates automatically.
        </Empty>
      </div>
    )
  }

  const hasBeats = !!eng && eng.totalSeconds > 0
  const ago = stamp ? Math.max(0, Math.round((Date.now() - stamp) / 1000)) : null

  return (
    <div className="mc-wrap">
      <div className="mc" style={{ opacity: flight ? 0.65 : 1, transition: 'opacity .25s' }}>

        <NorthStarStrip o={o} v={v} days={days} setDays={setDays} ago={ago} />

        {/* ── funnel rail ── */}
        <FunnelRail o={o} v={v} e={e} r={r} />

        {/* ── attention center ── */}
        <AttentionPanel o={o} e={e} eng={eng} pw={pw} days={days} hasBeats={hasBeats} />

        {/* ── who & when rail ── */}
        <WhoWhen eng={eng} au={au} geo={geo} hasBeats={hasBeats} />

        {/* ── fleet matrix ── */}
        <FleetMatrix i={i} k={k} o={o} v={v} eng={eng} days={days} />
      </div>
    </div>
  )
}

/* ─────────────────────────── north-star strip ─────────────────────────── */
// Three columns, one visual row: IDENTITY | chips-over-trend | CONTROLS.
// Exported so the visual harness renders the exact real markup (no drift).
export function NorthStarStrip({ o, v, days, setDays, ago }: {
  o: GrowthOverview | null; v: PortfolioVc | null; days: number; setDays: (d: number) => void; ago: number | null
}) {
  return (
    <div className="card mc-ns">
      <div className="mc-ns-id">
        <div className="mc-lbl">Ecosystem north star</div>
        <div className="mc-hero">{o ? compact(o.wau) : '—'}</div>
        <div className="mc-delta" style={{ color: o?.wowPct != null && o.wowPct < 0 ? 'var(--bad)' : 'var(--ok)' }}>
          {o?.wowPct == null ? 'weekly engaged accounts' : `${o.wowPct > 0 ? '▲ +' : '▼ '}${Math.abs(o.wowPct)}% WoW`}
          <span className="ctx"> · {v ? compact(v.flywheelCount) : '—'} circles</span>
        </div>
      </div>

      <div className="mc-ns-mid">
        <div className="mc-chips" role="list" aria-label="North-star input metrics">
          <span className="mc-chip">Activation <b>{v?.activationRate == null ? '—' : pct(v.activationRate)}</b></span>
          <span className="mc-chip">Lessons/d <b>{v?.lessonsPerKidDay ?? '—'}</b></span>
          <span className="mc-chip">Time/kid <b>{v?.screenMinPerKidDay == null ? '—' : Math.round(v.screenMinPerKidDay) + 'm'}</b></span>
          <span className="mc-chip">D1 return <b>{v?.d1Retention == null ? '—' : pct(v.d1Retention)}</b></span>
          <span className="mc-chip">Invites <b>{v ? `${compact(v.invitesAccepted)}/${compact(v.invitesSent)}` : '—'}</b></span>
        </div>
        <div className="mc-trend">
          {o && o.northStar.some(p => p.value > 0) ? (
            <AreaTrend labels={o.northStar.map(p => p.week)}
              series={[{ key: 'v', label: 'Weekly engaged', color: 'var(--ch1)', area: true }]}
              data={o.northStar.map(p => ({ v: p.value }))} height={54} />
          ) : (
            <McEmpty inline headline="No engaged weeks yet" body="The trend fills in as accounts return." />
          )}
        </div>
      </div>

      <div className="mc-ns-ctrl">
        <div className="seg" role="group" aria-label="Date range">
          {RANGES.map(rg => <button key={rg} className={days === rg ? 'on' : ''} onClick={() => setDays(rg)}>{rg}d</button>)}
        </div>
        <div className="mc-live"><span className="mc-dot" />live · updated {ago == null ? '—' : ago < 5 ? 'now' : ago + 's ago'}</div>
      </div>
    </div>
  )
}

/* ─────────────────────────── funnel rail ─────────────────────────── */
// Each bar is normalized so the benchmark tick sits at 60% — a bar crossing
// its tick is above benchmark. Value shown raw; benchmarks from the unicorn
// scorecard (a16z / edtech quartiles).
export function FunnelRail({ o, v, e, r }: { o: GrowthOverview | null; v: PortfolioVc | null; e: EconomyData | null; r: RetentionData | null }) {
  const TICK = 60
  const norm = (val: number | null | undefined, bench: number) =>
    val == null ? 0 : Math.min(100, Math.max(2, (val / bench) * TICK))
  const rows: { nm: string; val: string; w: number; c: string }[] = [
    { nm: 'Acquisition', val: o?.newWowPct == null ? (o ? compact(o.newLearners7d) + ' new' : '—') : `${o.newWowPct > 0 ? '+' : ''}${o.newWowPct}%`,
      w: norm(o?.newWowPct != null ? Math.max(0, o.newWowPct) : null, 5), c: slotColor(0) },
    { nm: 'Activation', val: v?.activationRate == null ? '—' : pct(v.activationRate), w: norm(v?.activationRate, 50), c: slotColor(0) },
    { nm: 'Engagement', val: o?.stickiness == null ? '—' : pct(o.stickiness), w: norm(o?.stickiness, 20), c: slotColor(1) },
    { nm: 'Retention D1', val: v?.d1Retention == null ? '—' : pct(v.d1Retention), w: norm(v?.d1Retention, 40), c: 'var(--ok)' },
    { nm: 'Referral k', val: v?.kFactor == null ? '—' : v.kFactor.toFixed(1), w: norm(v?.kFactor, 1), c: slotColor(4) },
    { nm: 'Monetization', val: e?.coverage == null ? '—' : pct(e.coverage), w: norm(e?.coverage, 50), c: slotColor(2) },
  ]

  // Average retention across the live weekly cohorts → the W0→W4 curve.
  const curve = useMemo(() => {
    if (!r || r.cohorts.length === 0) return null
    const pts = r.horizons.map((h, idx) => {
      const vals = r.cohorts.map(c => c.ret[idx]).filter((x): x is number => x != null)
      return { label: h, value: vals.length ? Math.round(vals.reduce((s, x) => s + x, 0) / vals.length) : null }
    }).filter(p => p.value != null) as { label: string; value: number }[]
    return pts.length >= 2 ? pts : null
  }, [r])

  return (
    <div className="card mc-panel mc-fu">
      <div>
        <div className="mc-t">The growth funnel</div>
        <div className="mc-s">AARRR · tick = benchmark · bar past tick = healthy</div>
      </div>
      {rows.map(row => (
        <div key={row.nm} className="mc-frow">
          <span className="nm">{row.nm}</span>
          <Meter pct={row.w} tick={TICK} color={row.c} />
          <span className="v">{row.val}</span>
        </div>
      ))}
      <div className="mc-fill" />
      <hr className="mc-div" />
      <div>
        <div className="mc-sec">Retention curve · cohort average</div>
        <div style={{ marginTop: 7 }}>
          {curve ? (
            <>
              <AreaTrend labels={curve.map(p => p.label)}
                series={[{ key: 'v', label: '% still active', color: 'var(--ch2)', area: true }]}
                data={curve.map(p => ({ v: p.value }))} height={64} valueFmt={x => Math.round(x) + '%'} />
              <div className="mc-note" style={{ marginTop: 4 }}>The a16z read: a curve that flattens = product-market pull.</div>
            </>
          ) : <McEmpty inline headline="No cohorts yet" body="Appears once learners sign up across multiple weeks." />}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────── attention center ─────────────────────────── */
type AtTab = 'attention' | 'mix' | 'economy'

export function AttentionPanel({ o, e, eng, pw, days, hasBeats }: {
  o: GrowthOverview | null; e: EconomyData | null; eng: EngagementData | null
  pw: PowerCurve | null; days: number; hasBeats: boolean
}) {
  const [tab, setTab] = useState<AtTab>(hasBeats ? 'attention' : 'mix')
  useEffect(() => { if (hasBeats) setTab('attention') }, [hasBeats])

  const daily = useMemo(() => {
    if (!eng) return null
    const apps = eng.apps.map(a => a.app)
    const dayKeys = Array.from(new Set(eng.daily.map(d => d.day)))
    if (dayKeys.length === 0) return null
    const byDay = new Map<string, Record<string, number>>(dayKeys.map(dk => [dk, {}]))
    for (const row of eng.daily) byDay.get(row.day)![row.app] = row.seconds
    return {
      labels: dayKeys,
      series: apps.map(a => ({ key: a, label: appLabel(a), color: appColor(a) })),
      data: dayKeys.map(dk => byDay.get(dk)!),
    }
  }, [eng])

  // Fewer than 3 days of history: a stacked-column chart reads as "broken" —
  // one bar floating in empty air. Show the honest shape instead: today's
  // split by app as ranked bars, framed as day-one rather than a trend.
  const sparse = !!daily && daily.labels.length < 3

  const mix = (o?.activityMix ?? []).filter(m => m.events > 0)
  const power = pw?.histogram?.map(b => ({ label: b.daysActive + 'd', value: b.users })) ?? null
  // A histogram with 1-2 lit bars out of 14 reads as a broken chart, not a
  // curve — the shape only becomes informative once repeat visits exist.
  const powerUsers = power?.reduce((s, b) => s + b.value, 0) ?? 0
  const powerReady = !!power && powerUsers >= 4

  return (
    <div className="card mc-panel mc-at">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="mc-t">Where attention goes</div>
          <div className="mc-s">measured time-on-page · visibility + activity gated · last {days}d</div>
        </div>
        <div className="mc-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'attention'} className={tab === 'attention' ? 'on' : ''} onClick={() => setTab('attention')}>Attention</button>
          <button role="tab" aria-selected={tab === 'mix'} className={tab === 'mix' ? 'on' : ''} onClick={() => setTab('mix')}>Learning mix</button>
          <button role="tab" aria-selected={tab === 'economy'} className={tab === 'economy' ? 'on' : ''} onClick={() => setTab('economy')}>Mint vs burn</button>
        </div>
      </div>

      <div className="mc-fill">
        {tab === 'attention' && (
          !daily ? <McEmpty headline="One paste turns this on"
            body={`Run migration_hq_engagement_v3.sql — every app already ships the tracker, and this fills within minutes of anyone using anything.`} />
          : sparse ? (
            <div>
              <div className="mc-note" style={{ marginBottom: 6 }}>Day one — {daily.labels.length === 1 ? 'today' : `the last ${daily.labels.length} days`}. The daily trend appears once there's more history to compare.</div>
              <HBars barH={16} labelWidth={110} valueFmt={fmtDur}
                bars={eng!.apps.map(a => ({ label: appLabel(a.app), value: a.seconds, color: appColor(a.app) }))} />
            </div>
          ) : <StackedCols labels={daily.labels} series={daily.series} data={daily.data} height={140} valueFmt={fmtDur} />
        )}
        {tab === 'mix' && (mix.length > 0
          ? <DonutD3 slices={mix.map((m, idx) => ({ label: kindLabel(m.kind), value: m.events, color: slotColor(idx) }))}
              centerValue={compact(mix.reduce((s, m) => s + m.events, 0))} centerLabel="actions · 30d" size={150} />
          : <McEmpty inline headline="No learning actions yet" body="Journey nodes, quests and drills appear here as kids play." />)}
        {tab === 'economy' && (e?.mintBurn && e.mintBurn.length > 0
          ? <AreaTrend labels={e.mintBurn.map(p => p.week)}
              series={[
                { key: 'mint', label: 'Mint · earned', color: 'var(--ch1)', area: true },
                { key: 'burn', label: 'Burn · spent', color: 'var(--ch3)', dash: true },
              ]}
              data={e.mintBurn.map(p => ({ mint: p.mint, burn: p.burn }))} height={140} />
          : <McEmpty inline headline="No diamond flows yet" body="Mint (earned) and burn (spent) appear here via the ledger." />)}
      </div>

      <div className="mc-duo">
        <div>
          <div className="mc-sec">Power-user curve · days active of {days}</div>
          <div style={{ marginTop: 7 }}>
            {powerReady
              ? <VCols values={power!} height={84} labelEvery={Math.max(2, Math.floor(power!.length / 5))} ariaLabel="Power-user curve" />
              : <McEmpty inline headline={power ? 'Building the curve' : 'Needs v3 migration'}
                  body={power ? `${powerUsers} ${powerUsers === 1 ? 'person has' : 'people have'} shown up so far — the a16z habit shape (right side growing) appears with more repeat visits.` : 'Then this shows who keeps coming back, and how often.'} />}
          </div>
        </div>
        <div>
          <div className="mc-sec">Top pages · the gap map</div>
          <div style={{ marginTop: 7 }}>
            {eng && eng.pages.length > 0
              ? <HBars bars={eng.pages.slice(0, 4).map(p => ({
                  // color carries the app (same slots everywhere); label stays the page
                  label: p.page, value: p.seconds, color: appColor(p.app),
                }))} valueFmt={fmtDur} labelWidth={110} barH={12} />
              : <McEmpty inline headline="No pages tracked yet" body="Time per page/scene lands here the moment beats flow — low bars on shipped surfaces are the gaps to fix." />}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────── who & when rail ─────────────────────────── */
export function WhoWhen({ eng, au, geo, hasBeats }: {
  eng: EngagementData | null; au: AudienceData | null; geo: GeoData | null; hasBeats: boolean
}) {
  const roleTotal = au?.roles.reduce((s, x) => s + x.count, 0) ?? 0
  // beats older than the v3 sensor columns have device=null → 'unknown';
  // exclude them so the split reflects real device signal, not history
  const devices = (au?.devices ?? []).filter(d => d.device !== 'unknown')
  const devTotal = devices.reduce((s, x) => s + x.seconds, 0)
  const region = (tz: string) => tz.includes('/') ? tz.split('/').pop()!.replace(/_/g, ' ') : tz
  // A punch card with only a handful of lit cells in a 168-cell grid reads as
  // "mostly broken", not "day one" — name it plainly instead until there's a
  // real week of rhythm to show.
  const litCells = new Set((eng?.punch ?? []).filter(p => p.seconds > 0).map(p => `${p.dow}:${p.hour}`)).size
  const punchReady = hasBeats && !!eng && litCells >= 6

  return (
    <div className="card mc-panel mc-wh">
      <div className="mc-t">Who &amp; when</div>

      {hasBeats && eng ? (
        <DonutD3 size={88} dense
          slices={eng.apps.map(a => ({ label: appLabel(a.app), value: a.seconds, color: appColor(a.app) }))}
          centerValue={fmtDur(eng.totalSeconds)} centerLabel="total" valueFmt={fmtDur} />
      ) : (
        <McEmpty inline headline="Needs v3 migration" body="Share of time across every app appears here once beats flow." />
      )}

      <div>
        <div className="mc-sec">Rhythm of the week</div>
        <div style={{ marginTop: 6 }}>
          {punchReady
            ? <PunchCard punch={eng!.punch} />
            : <McEmpty inline headline={hasBeats ? 'Building the rhythm' : 'Needs v3 migration'}
                body={hasBeats ? `${litCells} time ${litCells === 1 ? 'slot' : 'slots'} logged so far — the weekly heat map fills in as more sessions land.` : 'Hour-of-week heat: when the family actually plays & learns.'} />}
        </div>
      </div>

      {au && (
        <div>
          <div className="mc-sec">Audience</div>
          {roleTotal > 0 && (
            <>
              <div className="mc-strip" style={{ marginTop: 6 }} role="img" aria-label="Accounts by role">
                {au.roles.map((x, idx) => (
                  <i key={x.role} title={`${x.role} · ${x.count}`} style={{ width: `${Math.max(3, (100 * x.count) / roleTotal)}%`, background: slotColor(idx) }} />
                ))}
              </div>
              <div className="mc-spl">{au.roles.slice(0, 3).map(x => <span key={x.role}>{x.role} {x.count}</span>)}</div>
            </>
          )}
          {devTotal > 0 && (
            <>
              <div className="mc-strip" style={{ marginTop: 8 }} role="img" aria-label="Time by device">
                {devices.map((x, idx) => (
                  <i key={x.device} title={`${x.device} · ${fmtDur(x.seconds)}`} style={{ width: `${Math.max(3, (100 * x.seconds) / devTotal)}%`, background: slotColor(idx + 4) }} />
                ))}
              </div>
              <div className="mc-spl">{devices.slice(0, 3).map(x => <span key={x.device}>{x.device} {Math.round((100 * x.seconds) / devTotal)}%</span>)}</div>
            </>
          )}
          {au.ageBands.some(b => b.band !== 'unknown' && b.count > 0) && (
            <div className="mc-spl" style={{ marginTop: 6 }}>
              <span>ages · {au.ageBands.filter(b => b.band !== 'unknown').map(b => `${b.band} ${b.count}`).join(' · ')}</span>
            </div>
          )}
        </div>
      )}
      {!au && <McEmpty inline headline="Needs v3 migration" body="Roles, age bands and devices appear here — aggregate-only, never per-kid." />}

      <div className="mc-fill" />
      <div>
        <div className="mc-sec">Regions · timezone, kid-safe</div>
        <div style={{ marginTop: 6 }}>
          {geo && geo.regions.length > 0
            ? <HBars bars={geo.regions.slice(0, 3).map(g => ({ label: region(g.tz), value: g.seconds, color: slotColor(5) }))}
                valueFmt={fmtDur} labelWidth={86} barH={10} />
            : <McEmpty inline headline="No regions yet" body="Coarse regions from client timezone — never GPS/IP for kids." />}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────── fleet matrix ─────────────────────────── */
// The 8-question contract, written ONCE in full words down the left; each app
// answers in its own terms via a small unit label. Nothing truncates.
interface Cell { v: string; u?: string; dim?: boolean }
const DASH: Cell = { v: '—', dim: true }

export function FleetMatrix({ i, k, o, v, eng, days }: {
  i: SchemaInsights | null; k: KinetikStats | null; o: GrowthOverview | null
  v: PortfolioVc | null; eng: EngagementData | null; days: number
}) {
  const t = (app: string) => eng?.apps.find(a => a.app === app) ?? null
  const pages = (app: string) => eng?.pages.filter(p => p.app === app) ?? []
  const dailyFor = (app: string): number[] => {
    if (!eng) return []
    const dayKeys = Array.from(new Set(eng.daily.map(d => d.day)))
    return dayKeys.map(dk => eng.daily.find(d => d.day === dk && d.app === app)?.seconds ?? 0)
  }
  const cellTime = (app: string): Cell => {
    const a = t(app)
    return a ? { v: fmtDur(a.seconds), u: `${days}d` } : DASH
  }
  const avgSess = (app: string): Cell => {
    const a = t(app)
    if (!a || !a.sessions) return DASH
    return { v: fmtDur(a.avgSession ?? Math.round(a.seconds / a.sessions)), u: 'avg session' }
  }
  const topPage = (app: string): Cell => {
    const p = pages(app)[0]
    return p ? { v: p.page.length > 11 ? p.page.slice(0, 10) + '…' : p.page, u: 'top page' } : DASH
  }

  const APPS: { app: string; name: string; cells: Cell[] }[] = [
    { app: 'kinetik', name: 'KinetikCircle', cells: [
      k ? { v: compact(k.members), u: 'members' } : DASH,
      k ? { v: compact(k.circles), u: 'circles' } : DASH,
      k ? { v: compact(k.posts7d), u: 'posts · 7d' } : DASH,
      k ? { v: compact(k.reactions), u: 'reactions' } : DASH,
      cellTime('kinetik'),
      k?.calPerDay != null ? { v: String(k.calPerDay), u: 'cal / day' } : DASH,
      v && v.familiesTotal > 0 ? { v: Math.round((100 * v.flywheelCount) / v.familiesTotal) + '%', u: 'flywheel' } : DASH,
      { v: usd2(SUB_ARPU), u: 'sub / fam' },
    ] },
    { app: 'arganta', name: 'ArgantaLab', cells: [
      i ? { v: compact(i.learners), u: 'learners' } : DASH,
      o ? { v: compact(o.newLearners7d), u: 'new · 7d' } : DASH,
      v?.lessonsPerKidDay != null ? { v: String(v.lessonsPerKidDay), u: 'lessons / d' } : DASH,
      o?.accuracyPct != null ? { v: pct(o.accuracyPct), u: 'accuracy' } : DASH,
      cellTime('arganta'),
      o?.stickiness != null ? { v: pct(o.stickiness), u: 'stickiness' } : DASH,
      v?.d1Retention != null ? { v: pct(v.d1Retention), u: 'D1 back' } : DASH,
      { v: usd2(BLEND_ARPU), u: 'sub+IAP / fam' },
    ] },
    { app: 'lashira', name: 'LashiraBloom', cells: [
      t('lashira') ? { v: compact(t('lashira')!.users), u: 'players' } : DASH,
      pages('lashira').length ? { v: String(pages('lashira').length), u: 'scenes seen' } : DASH,
      (() => { const s = pages('lashira').filter(p => p.page.startsWith('realm')).reduce((x, p) => x + p.seconds, 0); return s > 0 ? { v: fmtDur(s), u: 'in realms' } : DASH })(),
      topPage('lashira'),
      cellTime('lashira'),
      t('lashira') && t('lashira')!.users > 0 ? { v: (t('lashira')!.sessions / t('lashira')!.users).toFixed(1), u: 'sess / player' } : DASH,
      avgSess('lashira'),
      { v: 'XP→learn', u: 'reward model' },
    ] },
    { app: 'hq', name: 'Circle HQ', cells: [
      t('hq') ? { v: compact(t('hq')!.users), u: 'operators' } : DASH,
      pages('hq').length ? { v: String(pages('hq').length), u: 'surfaces used' } : DASH,
      topPage('hq'),
      t('hq')?.clicks ? { v: compact(t('hq')!.clicks!), u: 'interactions' } : DASH,
      cellTime('hq'),
      dailyFor('hq').filter(s => s > 0).length ? { v: `${dailyFor('hq').filter(s => s > 0).length}/${days}`, u: 'days active' } : DASH,
      avgSess('hq'),
      { v: '$0', u: 'infra / mo' },
    ] },
    { app: 'landing', name: 'Landing', cells: [
      t('landing') ? { v: compact(t('landing')!.users), u: 'visitors' } : DASH,
      pages('landing').length ? { v: String(pages('landing').length), u: 'sections seen' } : DASH,
      topPage('landing'),
      t('landing')?.clicks ? { v: compact(t('landing')!.clicks!), u: 'interactions' } : DASH,
      cellTime('landing'),
      t('landing') && t('landing')!.users > 0 ? { v: (t('landing')!.sessions / t('landing')!.users).toFixed(1), u: 'visits / person' } : DASH,
      avgSess('landing'),
      DASH,
    ] },
  ]

  const ROWS = ['People', 'Reach', 'Core action', 'Depth', 'Time', 'Habit', 'Comeback', 'Value']

  return (
    <div className="card mc-fl">
      <div className="spread" style={{ marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
        <div className="mc-t">App fleet — the same 8 questions, answered by every product</div>
        <div className="mc-s">grey cells fill as the beats pipeline reports</div>
      </div>
      <div className="mc-mx-scroll">
        <div className="mc-mx">
          {/* header row */}
          <div className="hd" aria-hidden="true" />
          {APPS.map(a => {
            const spark = dailyFor(a.app)
            const connected = a.app === 'kinetik' ? !!k : a.app === 'arganta' ? !!i : !!t(a.app)
            return (
              <div key={a.app} className="hd">
                <span className="nm"><i style={{ background: appColor(a.app) }} />{a.name}</span>
                <span className={'st ' + (connected ? 'ok' : 'mut')}>{connected ? 'Connected' : 'awaiting beats'}</span>
                <div className="spark-row">
                  {spark.filter(s => s > 0).length > 1 && <Spark values={spark} color={appColor(a.app)} height={18} />}
                </div>
              </div>
            )
          })}
          {/* metric rows — alternating tint so a 5-column, 8-row grid stays
              scannable left-to-right without re-counting columns each time */}
          {ROWS.map((row, ri) => (
            <FleetRow key={row} label={row} cells={APPS.map(a => a.cells[ri])} zebra={ri % 2 === 1} />
          ))}
        </div>
      </div>
    </div>
  )
}

function FleetRow({ label, cells, zebra }: { label: string; cells: Cell[]; zebra: boolean }) {
  const bg = zebra ? { background: 'var(--bg2)' } : undefined
  return (
    <>
      <div className="rl" style={bg}>{label}</div>
      {cells.map((c, idx) => (
        <div key={idx} className="cell" style={bg}>
          <span className={'v' + (c.dim ? ' dim' : '')}>{c.v}</span>
          {c.u && <span className="u">{c.u}</span>}
        </div>
      ))}
    </>
  )
}
