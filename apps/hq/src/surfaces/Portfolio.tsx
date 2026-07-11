import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  GraduationCap, Users, MessageSquare, Heart, Circle, Sprout,
  UserPlus, Zap, Flame, Repeat, Share2, Coins, Shuffle, TrendingUp, Info, Gem, Clock, CalendarClock,
  Timer, MonitorSmartphone, Activity, Moon,
} from 'lucide-react'
import { live } from '../data/live'
import type { SchemaInsights, GrowthOverview, EconomyData, PortfolioVc, EngagementData } from '../data/types'
import type { KinetikStats } from '../data/live'
import { chartColor } from '../components/charts'
import { AreaTrend } from '../components/d3/AreaTrend'
import { DonutD3 } from '../components/d3/DonutD3'
import { HBars } from '../components/d3/HBars'
import { StackedCols } from '../components/d3/StackedCols'
import { PunchCard } from '../components/d3/PunchCard'
import { fmtDur, appColor, appLabel } from '../components/d3/chartkit'
import { PRESETS, DEFAULT_GLOBALS, computeScenario } from '../data/monetization'
import { Empty, Loading } from '../components/Empty'
import { compact, pct } from '../lib/format'

const signed = (v: number | null | undefined) => (v == null ? 'WoW —' : `${v > 0 ? '+' : ''}${v}% WoW`)
const pctOr = (v: number | null | undefined) => (v == null ? '—' : pct(v))
const screenTime = (m: number | null | undefined) => (m == null ? '—' : m >= 60 ? (Math.round(m / 6) / 10) + 'h' : Math.round(m) + 'm')
const perDay = (v: number | null | undefined) => (v == null ? '—' : String(v))
// Mid-case revenue per family per month — the diamond economy / engagement
// converted into money. Subscription-only for the family app, blended (sub +
// diamond IAP) for the learning app. Scale-independent, so computed once.
const SUB_ARPU = PRESETS.mid.conv * PRESETS.mid.price
const BLEND_ARPU = computeScenario(PRESETS.mid, 1000, DEFAULT_GLOBALS).arpu
const usd2 = (n: number) => '$' + n.toFixed(2)

function KMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" role="img" aria-label="KinetikCircle">
      <defs>
        <linearGradient id="km-port" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22D3EE" /><stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#km-port)" />
      <circle cx="256" cy="256" r="106" fill="none" stroke="#fff" strokeWidth="40" />
      <circle cx="332" cy="180" r="34" fill="#fff" />
      <circle cx="256" cy="256" r="22" fill="#fff" />
    </svg>
  )
}

function LashiraMark({ size = 34 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 9, display: 'grid', placeItems: 'center',
      background: 'linear-gradient(135deg,#34d399,#0d9488)',
    }}>
      <Sprout size={18} color="#fff" />
    </div>
  )
}

// AARRR pillar accents — each stat is colour-tagged by the funnel stage it
// belongs to, so the card reads as acquisition → engagement → retention → money.
const PILLAR = {
  acq: 'var(--acc)', eng: 'var(--tl)', ret: 'var(--ok)', mon: 'var(--mag)',
} as const
type PillarKey = keyof typeof PILLAR

function StatCell({ label, value, icon, src, pillar, tone }: {
  label: string; value: string | number; icon?: React.ReactNode; src?: string; pillar?: PillarKey; tone?: string
}) {
  const accent = pillar ? PILLAR[pillar] : undefined
  return (
    <div className="pstat" style={pillar ? { boxShadow: `inset 3px 0 0 ${accent}` } : undefined}>
      <div className="pstat-l" style={accent ? { color: accent } : undefined}>{icon}<span>{label}</span></div>
      <div className="pstat-v" style={tone ? { color: tone } : undefined}>{typeof value === 'number' ? compact(value) : value}</div>
      {src && <div className="pstat-s">{src}</div>}
    </div>
  )
}

const RANGES = [7, 14, 30] as const

export function Portfolio() {
  const [i, setI] = useState<SchemaInsights | null | undefined>(undefined)
  const [k, setK] = useState<KinetikStats | null | undefined>(undefined)
  const [o, setO] = useState<GrowthOverview | null | undefined>(undefined)
  const [e, setE] = useState<EconomyData | null | undefined>(undefined)
  const [v, setV] = useState<PortfolioVc | null | undefined>(undefined)
  const [days, setDays] = useState<number>(14)
  const [eng, setEng] = useState<EngagementData | null | undefined>(undefined)
  const [engLoading, setEngLoading] = useState(false)

  useEffect(() => {
    live.schemaInsights().then(setI)
    live.kinetikStats().then(setK)
    live.growthOverview().then(setO)
    live.economy().then(setE)
    live.portfolioVc().then(setV)
  }, [])

  // The date range scopes the whole "where time goes" read. Refetch keeps the
  // previous frame at reduced opacity — no skeleton, no layout jump.
  useEffect(() => {
    let alive = true
    setEngLoading(true)
    live.engagement(days).then((d) => { if (alive) { setEng(d); setEngLoading(false) } })
    return () => { alive = false }
  }, [days])

  const loading = i === undefined && k === undefined
  const offline = i === null && k === null
  const hasVc = !!(o || v)

  const lashiraEng = eng?.apps.find(a => a.app === 'lashira') ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="spread" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="h1">Portfolio</div>
          <div className="sub">The investor read on the Arganta ecosystem — acquisition, engagement, retention &amp; monetization, every number live</div>
        </div>
        <div className="seg" role="group" aria-label="Date range">
          {RANGES.map(r => (
            <button key={r} className={days === r ? 'on' : ''} onClick={() => setDays(r)}>{r}d</button>
          ))}
        </div>
      </div>

      {loading && <Loading label="Loading app health…" />}
      {offline && <Empty title="No live connection">Connect Supabase and sign in as operator — the scorecard and every app card populate automatically.</Empty>}

      {hasVc && <NorthStar o={o ?? null} v={v ?? null} />}
      {hasVc && <Scorecard o={o ?? null} e={e ?? null} v={v ?? null} />}
      {v && v.familiesTotal > 0 && <Flywheel v={v} />}

      {/* ── Where time goes — live time-on-page across every app ── */}
      {!offline && !loading && (
        <TimeSpent eng={eng} loading={engLoading} days={days} />
      )}

      {/* ── KinetikCircle ──────────────────────────────────── */}
      {k !== undefined && (
        <AppCard
          mark={<KMark size={34} />}
          name="KinetikCircle"
          tagline="Private family social & moment-sharing app"
          status={k ? 'Connected' : 'Offline'}
          pill={k ? 'pill-ok' : 'pill-mut'}
          description="Families create a private Circle and share moments, stories, albums, routines and events — all within a closed group. Platform-authored Discover posts keep the feed alive between real family moments, and the embedded KinFarm pill opens the shared LashiraBloom circle farm."
          features={[
            'Private Circles — one per family, invite-only',
            'Moments feed — photos, videos, stories, kudos',
            'Stories (24h ephemeral) + photo albums',
            'Routines & events (family calendar)',
            'Discover feed — platform-authored broadcast cards',
            'KinFarm — the embedded LashiraBloom circle farm',
          ]}
        >
          {k && (() => {
            const fw = v && v.familiesTotal > 0 ? Math.round((100 * v.flywheelCount) / v.familiesTotal) : null
            const kt = eng?.apps.find(a => a.app === 'kinetik')
            return (
            <div className="pstat-grid">
              {/* acquisition */}
              <StatCell pillar="acq" label="Members" value={k.members} icon={<Users size={11} />} src="people" />
              <StatCell pillar="acq" label="Circles" value={k.circles} icon={<Circle size={11} />} src="families" />
              {/* engagement — family posting + real measured time */}
              <StatCell pillar="eng" label="Posts · 7d" value={k.posts7d} icon={<MessageSquare size={11} />} src="this week" />
              <StatCell pillar="eng" label="Reactions" value={k.reactions} icon={<Heart size={11} />} src="on posts" />
              <StatCell pillar="eng" label="Calendar / day" value={perDay(k.calPerDay)} icon={<CalendarClock size={11} />} src="events + routines" />
              <StatCell pillar="eng" label={`Time · ${days}d`} value={kt ? fmtDur(kt.seconds) : '—'} icon={<Timer size={11} />} src={kt ? `${kt.users} people · measured` : 'no beats yet'} />
              {/* retention / moat */}
              <StatCell pillar="ret" label="Flywheel" value={fw == null ? '—' : fw + '%'} icon={<Shuffle size={11} />} src="have a learner" />
              {/* monetization */}
              <StatCell pillar="mon" label="Rev / family" value={usd2(SUB_ARPU)} icon={<Coins size={11} />} src="subscription /mo" />
            </div>
            )
          })()}
          {!k && <div style={{ fontSize: 12.5, color: 'var(--tx3)', padding: '8px 0' }}>Sign in as operator to see live stats.</div>}
        </AppCard>
      )}

      {/* ── ArgantaLab ─────────────────────────────────────── */}
      {i !== undefined && (
        <AppCard
          mark={<div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--mag)', display: 'grid', placeItems: 'center' }}><GraduationCap size={18} color="#fff" /></div>}
          name="ArgantaLab"
          tagline="Kids learning super-app — gamified lessons, games & rewards"
          status={i ? 'Connected' : 'Offline'}
          pill={i ? 'pill-ok' : 'pill-mut'}
          description="An educational super-app for kids: mastery-based journeys, skill drills, LifeQuests, KinQuest (the Pokémon-style RPG), KinWorld open-world play, mini-games from the builders, and a diamond economy — all connected to the family through circles shared with KinetikCircle."
          features={[
            'Learn engine — journeys, mastery attempts, XP, North Star rings',
            'KinQuest — flagship RPG across 8 regions & Keepers',
            'KinWorld — PixiJS open-world town + world harvest',
            'ArgantaCup — guardian-run circle competitions with real prizes',
            'Diamond economy — earn in play, spend in the shop',
            'Games & apps published from the HQ builders',
          ]}
        >
          {i && (() => {
            const at = eng?.apps.find(a => a.app === 'arganta')
            return (
            <div className="pstat-grid">
              {/* acquisition — are new learners arriving, and do they reach first value? */}
              <StatCell pillar="acq" label="New · 7d" value={o?.newLearners7d ?? i.learners} icon={<UserPlus size={11} />}
                src={o ? signed(o.newWowPct) : 'signups'} tone={o?.newWowPct != null ? (o.newWowPct >= 0 ? 'var(--ok)' : 'var(--warn)') : undefined} />
              <StatCell pillar="acq" label="Activation" value={pctOr(v?.activationRate)} icon={<Zap size={11} />} src="acted in 48h" />
              {/* engagement — how much each kid does, daily + real measured time */}
              <StatCell pillar="eng" label="Lessons / day" value={perDay(v?.lessonsPerKidDay)} icon={<GraduationCap size={11} />} src="per kid" />
              <StatCell pillar="eng" label={`Time · ${days}d`} value={at ? fmtDur(at.seconds) : screenTime(v?.screenMinPerKidDay)} icon={<Clock size={11} />}
                src={at ? `${at.users} people · measured` : 'estimated / kid / day'} />
              {/* retention — do they come back? */}
              <StatCell pillar="ret" label="Comes back daily" value={pctOr(o?.stickiness)} icon={<Repeat size={11} />} src="of monthly kids" />
              <StatCell pillar="ret" label="Next-day return" value={pctOr(v?.d1Retention)} icon={<TrendingUp size={11} />} src="came back" />
              {/* monetization — the diamond economy, and its money conversion */}
              <StatCell pillar="mon" label="Diamonds" value={i.diamondsFloat} icon={<Gem size={11} />} src={v?.spentPerActiveKid != null ? `${compact(v.spentPerActiveKid)} spent/kid` : 'float'} />
              <StatCell pillar="mon" label="Rev / family" value={usd2(BLEND_ARPU)} icon={<Coins size={11} />} src="sub + 💎 IAP /mo" />
            </div>
            )
          })()}
          {!i && <div style={{ fontSize: 12.5, color: 'var(--tx3)', padding: '8px 0' }}>Sign in as operator to see live stats.</div>}
        </AppCard>
      )}

      {/* ── LashiraBloom ───────────────────────────────────── */}
      {!offline && !loading && (
        <AppCard
          mark={<LashiraMark size={34} />}
          name="LashiraBloom"
          tagline="Stardew-inspired circle farm — adults play, kids learn"
          status={lashiraEng ? 'Connected' : 'MVP · live'}
          pill={lashiraEng ? 'pill-ok' : 'pill-tl'}
          description="A cozy farming RPG on the ArgantaLab spine: every family circle shares one farm (planted in KinetikCircle as the KinFarm pill), plus personal farms, visits, and five portal realms. Adults play for fun; kids' XP routes through the learn engine — the same hero, skills and cosmetics as Kingdom Heroes via the shared packages."
          features={[
            'Shared circle farm — one save per family circle',
            'Forced first-run hero onboarding (name → path → look → ride)',
            'Five portal realms + multiplayer presence',
            'Combat, skills & cosmetics from @arganta/combat + heroes-engine',
            'HQ-published tuning: combat, characters, SFX, music themes',
          ]}
        >
          <div className="pstat-grid">
            <StatCell pillar="eng" label={`Time · ${days}d`} value={lashiraEng ? fmtDur(lashiraEng.seconds) : '—'} icon={<Timer size={11} />}
              src={lashiraEng ? 'measured in-game' : 'awaiting first beats'} />
            <StatCell pillar="acq" label="Players" value={lashiraEng ? lashiraEng.users : '—'} icon={<Users size={11} />} src={`distinct · ${days}d`} />
            <StatCell pillar="ret" label="Sessions" value={lashiraEng ? lashiraEng.sessions : '—'} icon={<Repeat size={11} />} src={`${days}d`} />
            <StatCell pillar="mon" label="Model" value="XP → learn" icon={<Sprout size={11} />} src="adults play · kids learn" />
          </div>
        </AppCard>
      )}
    </div>
  )
}

// ── North-star hero: weekly engaged accounts, now a full D3 trend ───────────
function NorthStar({ o, v }: { o: GrowthOverview | null; v: PortfolioVc | null }) {
  const engaged = o?.wau ?? null
  const circles = v?.flywheelCount ?? null
  const wow = o?.wowPct ?? null
  const points = o?.northStar ?? []
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(210px,auto) 1fr', gap: 18, alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', letterSpacing: '.05em', textTransform: 'uppercase' }}>Ecosystem north star</div>
          <div style={{ fontSize: 12.5, color: 'var(--tx2)', marginTop: 2 }}>Weekly engaged accounts <span style={{ color: 'var(--tx3)' }}>· active learners + circles</span></div>
          <div className="row" style={{ gap: 12, alignItems: 'baseline', marginTop: 8 }}>
            <span style={{ fontSize: 48, fontWeight: 600, letterSpacing: '-.02em', lineHeight: 1 }}>{engaged == null ? '—' : compact(engaged)}</span>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            {wow != null && (
              <span className="row" style={{ gap: 4, fontSize: 12.5, color: wow >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
                <TrendingUp size={13} /> {signed(wow)}
              </span>
            )}
            {circles != null && <span style={{ fontSize: 12, color: 'var(--tx3)' }}>· {compact(circles)} active circles</span>}
          </div>
        </div>
        {points.length > 1 && (
          <AreaTrend
            labels={points.map(p => p.week)}
            series={[{ key: 'v', label: 'Weekly engaged', color: 'var(--ch1)', area: true }]}
            data={points.map(p => ({ v: p.value }))}
            height={130}
          />
        )}
      </div>
    </div>
  )
}

// ── The AARRR scorecard: one headline metric per pillar ─────────────────────
interface Pillar { key: string; pillar: string; icon: ReactNode; value: string; sub: string; tone?: string; what: string }

function Scorecard({ o, e, v }: { o: GrowthOverview | null; e: EconomyData | null; v: PortfolioVc | null }) {
  const num = (x: number | null | undefined, suffix = '') => (x == null ? '—' : compact(x) + suffix)
  const pctOr = (x: number | null | undefined) => (x == null ? '—' : pct(x))

  const pillars: Pillar[] = [
    { key: 'acq', pillar: 'Acquisition', icon: <UserPlus size={13} />,
      value: num(o?.newLearners7d), sub: signed(o?.newWowPct),
      tone: o?.newWowPct != null && o.newWowPct >= 0 ? 'var(--ok)' : 'var(--warn)',
      what: 'New accounts that joined in the last 7 days, and how that compares to the week before. Top of the funnel.' },
    { key: 'act', pillar: 'Activation', icon: <Zap size={13} />,
      value: pctOr(v?.activationRate), sub: 'acted within 48h',
      what: 'Of everyone who signed up, the share who took a first real action within 48 hours — the single biggest lever on everything downstream.' },
    { key: 'eng', pillar: 'Engagement', icon: <Flame size={13} />,
      value: pctOr(o?.stickiness), sub: o?.depth ? `${o.depth} actions / active` : 'DAU/MAU',
      what: 'Stickiness (DAU/MAU): of everyone active this month, the share active on an average day. The truest daily-habit signal pre-revenue.' },
    { key: 'ret', pillar: 'Retention', icon: <Repeat size={13} />,
      value: pctOr(v?.d1Retention),
      sub: v?.d1Retention == null ? 'next-day comeback' : `came back next day · n=${compact(v.d1Sample)}`,
      tone: v?.d1Retention != null && v.d1Retention >= 40 ? 'var(--ok)' : undefined,
      what: 'D1 retention — of the days a learner is active, how often they come back the next day (last 14d). The live, daily-habit version of retention: it populates from day two instead of waiting 30 days. Above ~40% is strong for a daily app.' },
    { key: 'ref', pillar: 'Referral', icon: <Share2 size={13} />,
      value: v?.kFactor == null ? '—' : v.kFactor.toFixed(2),
      sub: v ? `${compact(v.invitesAccepted)}/${compact(v.invitesSent)} invites` : 'invite loop',
      what: 'Accepted invites per inviter — how much the product grows itself. Above 1 means each user brings in more than one, the viral threshold.' },
    { key: 'rev', pillar: 'Monetization', icon: <Coins size={13} />,
      value: pctOr(e?.coverage), sub: v?.spentPerActiveKid != null ? `${compact(v.spentPerActiveKid)} diamonds/kid` : 'pre-revenue',
      tone: e?.coverage != null && e.coverage >= 50 ? 'var(--ok)' : undefined,
      what: 'Sink coverage — how much of the recurring diamond mint gets spent. A healthy value loop is the dress rehearsal for the revenue loop; spend-per-kid is the pay-intent proxy.' },
  ]

  return (
    <div>
      <div className="row" style={{ gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--tx2)', marginBottom: 8 }}>
        <TrendingUp size={14} /> Unicorn scorecard — the growth funnel
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(168px,1fr))', gap: 10 }}>
        {pillars.map((p, idx) => <PillarTile key={p.key} p={p} accent={chartColor(idx)} />)}
      </div>
    </div>
  )
}

function PillarTile({ p, accent }: { p: Pillar; accent: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="kpi" style={{ position: 'relative' }}>
      <div className="kpi-l" style={{ justifyContent: 'space-between', width: '100%' }}>
        <span className="row" style={{ gap: 6, color: accent, fontWeight: 600 }}>{p.icon}{p.pillar}</span>
        <button onClick={() => setOpen(s => !s)} title="What is this?" aria-label="What is this?"
          style={{ color: open ? 'var(--acc)' : 'var(--tx3)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <Info size={12} />
        </button>
      </div>
      <div className={'kpi-v' + (p.value === '—' ? ' empty' : '')}>{p.value}</div>
      <div className="kpi-s" style={{ color: p.tone ?? 'var(--tx3)' }}>{p.sub}</div>
      {open && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--bd)', fontSize: 11.5, color: 'var(--tx2)', lineHeight: 1.5 }}>{p.what}</div>
      )}
    </div>
  )
}

// ── Where time goes — the live time-on-page read (hq_engagement) ────────────
function TimeSpent({ eng, loading, days }: { eng: EngagementData | null | undefined; loading: boolean; days: number }) {
  const daily = useMemo(() => {
    if (!eng) return { labels: [] as string[], series: [] as { key: string; label: string; color: string }[], data: [] as Record<string, number>[] }
    const apps = eng.apps.map(a => a.app)
    const dayKeys = Array.from(new Set(eng.daily.map(d => d.day)))
    const byDay = new Map<string, Record<string, number>>()
    for (const dk of dayKeys) byDay.set(dk, {})
    for (const row of eng.daily) byDay.get(row.day)![row.app] = row.seconds
    return {
      labels: dayKeys,
      series: apps.map(a => ({ key: a, label: appLabel(a), color: appColor(a) })),
      data: dayKeys.map(dk => byDay.get(dk)!),
    }
  }, [eng])

  const busiest = useMemo(() => {
    if (!eng || eng.punch.length === 0) return null
    const best = eng.punch.reduce((a, b) => (b.seconds > a.seconds ? b : a))
    const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return `${DOW[best.dow]} ${best.hour}:00`
  }, [eng])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11, opacity: loading && eng ? 0.55 : 1, transition: 'opacity .2s' }}>
      <div className="spread" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="row" style={{ gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--tx2)' }}>
          <Timer size={14} /> Where time goes — measured time-on-page, every app
        </div>
        <span style={{ fontSize: 11, color: 'var(--tx3)' }}>visibility + activity gated · beats every ~20s · last {days} days</span>
      </div>

      {eng === undefined && <Loading label="Loading engagement…" />}
      {eng === null && (
        <Empty title="Time tracking needs one migration">
          Run <span className="src">supabase/migration_hq_engagement.sql</span> in the Supabase SQL editor, then just use the apps —
          every Arganta surface (ArgantaLab, KinetikCircle, LashiraBloom, HQ, Landing) already ships the tracker and starts
          reporting the moment the table exists.
        </Empty>
      )}

      {eng && eng.totalSeconds === 0 && (
        <Empty title="No usage beats yet">
          The pipeline is live — beats appear here within a minute of anyone using any app. Open ArgantaLab or KinetikCircle and watch this fill in.
        </Empty>
      )}

      {eng && eng.totalSeconds > 0 && (
        <>
          <div className="kpi-grid">
            <div className="kpi">
              <div className="kpi-l"><Clock size={13} /> Total time</div>
              <div className="kpi-v">{fmtDur(eng.totalSeconds)}</div>
              <div className="kpi-s" style={{ color: 'var(--tx3)' }}>across {eng.apps.length} apps · {days}d</div>
            </div>
            <div className="kpi">
              <div className="kpi-l"><Users size={13} /> People tracked</div>
              <div className="kpi-v">{compact(eng.totalUsers)}</div>
              <div className="kpi-s" style={{ color: 'var(--tx3)' }}>signed-in + guest devices</div>
            </div>
            <div className="kpi">
              <div className="kpi-l"><MonitorSmartphone size={13} /> Most-used app</div>
              <div className="kpi-v">{eng.apps[0] ? appLabel(eng.apps[0].app) : '—'}</div>
              <div className="kpi-s" style={{ color: 'var(--tx3)' }}>{eng.apps[0] ? `${fmtDur(eng.apps[0].seconds)} · ${Math.round((100 * eng.apps[0].seconds) / eng.totalSeconds)}% of all time` : ''}</div>
            </div>
            <div className="kpi">
              <div className="kpi-l"><Moon size={13} /> Busiest hour</div>
              <div className="kpi-v">{busiest ?? '—'}</div>
              <div className="kpi-s" style={{ color: 'var(--tx3)' }}>client-local · punch card below</div>
            </div>
          </div>

          <div className="gdash">
            <div className="card gd-7" style={{ padding: 16 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Daily time by app</div>
              <div style={{ fontSize: 11.5, color: 'var(--tx2)', marginBottom: 8 }}>stacked minutes per day — where the ecosystem's attention actually goes</div>
              <StackedCols labels={daily.labels} series={daily.series} data={daily.data} valueFmt={fmtDur} />
            </div>
            <div className="card gd-5" style={{ padding: 16 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Share of time</div>
              <div style={{ fontSize: 11.5, color: 'var(--tx2)', marginBottom: 8 }}>the attention split across the portfolio</div>
              <DonutD3
                slices={eng.apps.map(a => ({ label: appLabel(a.app), value: a.seconds, color: appColor(a.app) }))}
                centerValue={fmtDur(eng.totalSeconds)} centerLabel="total" valueFmt={fmtDur}
              />
            </div>
            <div className="card gd-7" style={{ padding: 16 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Top pages</div>
              <div style={{ fontSize: 11.5, color: 'var(--tx2)', marginBottom: 10 }}>time per page/scene — the gap map: what earns attention and what nobody opens</div>
              <HBars
                bars={eng.pages.slice(0, 12).map(p => ({
                  label: `${appLabel(p.app)} · ${p.page}`, value: p.seconds, color: appColor(p.app),
                }))}
                valueFmt={fmtDur} labelWidth={185}
              />
            </div>
            <div className="card gd-5" style={{ padding: 16 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Rhythm of the week</div>
              <div style={{ fontSize: 11.5, color: 'var(--tx2)', marginBottom: 10 }}>hour-of-week heat — when the family actually plays &amp; learns</div>
              <PunchCard punch={eng.punch} />
              <UserList eng={eng} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Who spends the time — auth users named, guest devices kept honest.
function UserList({ eng }: { eng: EngagementData }) {
  if (!eng.users.length) return null
  const maxS = Math.max(1, ...eng.users.map(u => u.seconds))
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--bd)' }}>
      <div className="row" style={{ gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--tx2)', marginBottom: 8 }}>
        <Activity size={13} /> Who spends the time
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {eng.users.slice(0, 8).map((u) => (
          <div key={u.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div className="row" style={{ gap: 8, fontSize: 12 }}>
              <span style={{ fontWeight: 600, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{u.name}</span>
              <span className="pill pill-mut" style={{ fontSize: 9.5 }}>{u.role}</span>
              <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--tx)' }}>{fmtDur(u.seconds)}</span>
            </div>
            {/* per-user app split as one thin stacked strip (2px gaps) */}
            <div className="row" style={{ gap: 2, height: 6 }}>
              {(u.perApp ?? []).map((pa) => (
                <span key={pa.app} title={`${appLabel(pa.app)} · ${fmtDur(pa.seconds)}`} style={{
                  height: 6, borderRadius: 3, background: appColor(pa.app),
                  width: `${Math.max(2, (100 * pa.seconds) / maxS)}%`,
                }} />
              ))}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>
              {u.topPage ?? '—'} · {u.sessions} sessions
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── The flywheel: cross-app moat ────────────────────────────────────────────
function Flywheel({ v }: { v: PortfolioVc }) {
  const pctVal = v.familiesTotal > 0 ? Math.round((100 * v.flywheelCount) / v.familiesTotal) : 0
  return (
    <div className="insight" style={{ background: 'var(--acc-soft)', color: 'var(--tx)', alignItems: 'center', border: '1px solid var(--bd2)' }}>
      <Shuffle size={16} style={{ color: 'var(--mag)', flex: 'none' }} />
      <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
        <b>The flywheel · {pctVal}% of circles have an active learner</b> ({compact(v.flywheelCount)} of {compact(v.familiesTotal)}). Families who use KinetikCircle, ArgantaLab <i>and</i> the shared circle farm reinforce each other — the cross-app loop is the moat, not the count of any single product.
      </div>
    </div>
  )
}

function AppCard({ mark, name, tagline, status, pill, description, features, children }: {
  mark: React.ReactNode; name: string; tagline: string; status: string; pill: string
  description: string; features: string[]; children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div className="row" style={{ gap: 12, alignItems: 'center' }}>
          {mark}
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--tx2)' }}>{tagline}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className={`pill ${pill}`}>{status}</span>
          <button className="chip" style={{ fontSize: 11 }} onClick={() => setOpen(v => !v)}>
            {open ? 'Less' : 'About'}
          </button>
        </div>
      </div>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 2 }}>
          <div style={{ fontSize: 12.5, color: 'var(--tx2)', lineHeight: 1.55 }}>{description}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {features.map(f => (
              <div key={f} className="row" style={{ gap: 8, fontSize: 12, color: 'var(--tx2)' }}>
                <span style={{ color: 'var(--acc)', flex: 'none' }}>·</span>{f}
              </div>
            ))}
          </div>
        </div>
      )}

      {children}
    </div>
  )
}
