import { useEffect, useState, type ReactNode } from 'react'
import {
  GraduationCap, Users, MessageSquare, Heart, Megaphone, Eye, Image, Circle,
  UserPlus, Zap, Flame, Repeat, Share2, Coins, Shuffle, TrendingUp, Info,
} from 'lucide-react'
import { live } from '../data/live'
import type { SchemaInsights, GrowthOverview, EconomyData, PortfolioVc, GrowthPoint } from '../data/types'
import type { KinetikStats } from '../data/live'
import { chartColor } from '../components/charts'
import { Empty, Loading } from '../components/Empty'
import { compact, pct } from '../lib/format'

const signed = (v: number | null | undefined) => (v == null ? 'WoW —' : `${v > 0 ? '+' : ''}${v}% WoW`)

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

function StatCell({ label, value, icon, src }: { label: string; value: string | number; icon?: React.ReactNode; src?: string }) {
  return (
    <div style={{ background: 'var(--bg2)', borderRadius: 9, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: 'var(--tx2)', display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon}<span>{label}</span>
      </div>
      <div style={{ fontSize: 19, fontWeight: 600, margin: '2px 0' }}>{typeof value === 'number' ? compact(value) : value}</div>
      {src && <div className="src" style={{ background: 'transparent', padding: 0, fontSize: 10 }}>{src}</div>}
    </div>
  )
}

export function Portfolio() {
  const [i, setI] = useState<SchemaInsights | null | undefined>(undefined)
  const [k, setK] = useState<KinetikStats | null | undefined>(undefined)
  const [o, setO] = useState<GrowthOverview | null | undefined>(undefined)
  const [e, setE] = useState<EconomyData | null | undefined>(undefined)
  const [v, setV] = useState<PortfolioVc | null | undefined>(undefined)

  useEffect(() => {
    live.schemaInsights().then(setI)
    live.kinetikStats().then(setK)
    live.growthOverview().then(setO)
    live.economy().then(setE)
    live.portfolioVc().then(setV)
  }, [])

  const loading = i === undefined && k === undefined
  const offline = i === null && k === null
  const hasVc = !!(o || v)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div className="h1">Portfolio</div>
        <div className="sub">The investor read on the Arganta ecosystem — acquisition, retention &amp; monetization, every number live</div>
      </div>

      {loading && <Loading label="Loading app health…" />}
      {offline && <Empty title="No live connection">Connect Supabase and sign in as operator — the scorecard and both app cards populate automatically.</Empty>}

      {hasVc && <NorthStar o={o ?? null} v={v ?? null} />}
      {hasVc && <Scorecard o={o ?? null} e={e ?? null} v={v ?? null} />}
      {v && v.familiesTotal > 0 && <Flywheel v={v} />}

      {/* ── KinetikCircle ──────────────────────────────────── */}
      {k !== undefined && (
        <AppCard
          mark={<KMark size={34} />}
          name="KinetikCircle"
          tagline="Private family social & moment-sharing app"
          status={k ? 'Connected' : 'Offline'}
          pill={k ? 'pill-ok' : 'pill-mut'}
          description="Families create a private Circle and share moments, stories, albums, routines and events — all within a closed group. Platform-authored Discover posts keep the feed alive between real family moments."
          features={[
            'Private Circles — one per family, invite-only',
            'Moments feed — photos, videos, stories, kudos',
            'Stories (24h ephemeral) + photo albums',
            'Routines & events (family calendar)',
            'Discover feed — platform-authored broadcast cards',
            'Reactions + comments; Cheer Squad celebrations',
          ]}
        >
          {k && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10 }}>
              <StatCell label="Circles" value={k.circles} icon={<Circle size={11} />} src="circles" />
              <StatCell label="Members" value={k.members} icon={<Users size={11} />} src="circle_members" />
              <StatCell label="Posts" value={k.posts} icon={<Image size={11} />} src="kinetik_post" />
              <StatCell label="Posts · 7d" value={k.posts7d} icon={<MessageSquare size={11} />} src="last 7 days" />
              <StatCell label="Reactions" value={k.reactions} icon={<Heart size={11} />} src="kinetik_post" />
              <StatCell label="Broadcasts live" value={k.broadcastsPublished} icon={<Megaphone size={11} />} src="kinetik_broadcast" />
              <StatCell label="Discover views" value={k.broadcastViews} icon={<Eye size={11} />} src="broadcast" />
            </div>
          )}
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
          description="An educational super-app for kids with mastery-based lessons, mini-games, diamond rewards, and family circles that connect learners to parents. Circles are shared with KinetikCircle."
          features={[
            'Learn engine — lessons, mastery attempts, XP',
            'Mini-games authored via Game Builder',
            'Diamond economy — earn & spend rewards',
            'Learn Builder for operators to create content',
            'Circles shared with KinetikCircle',
          ]}
        >
          {i && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10 }}>
              <StatCell label="Learners" value={i.learners} icon={<Users size={11} />} src="profiles" />
              <StatCell label="Active · 7d" value={i.activeLearners7d} icon={<MessageSquare size={11} />} src="item_attempts" />
              <StatCell label="Games" value={i.gamesTotal} icon={<Image size={11} />} src="games" />
              <StatCell label="Live content" value={i.itemsLive} icon={<Eye size={11} />} src="items" />
              <StatCell label="Circles" value={i.circles} icon={<Circle size={11} />} src="circles" />
            </div>
          )}
          {!i && <div style={{ fontSize: 12.5, color: 'var(--tx3)', padding: '8px 0' }}>Sign in as operator to see live stats.</div>}
        </AppCard>
      )}
    </div>
  )
}

// ── North-star hero: weekly engaged accounts ───────────────────────────────
function NorthStar({ o, v }: { o: GrowthOverview | null; v: PortfolioVc | null }) {
  const engaged = o?.wau ?? null
  const circles = v?.flywheelCount ?? null
  const wow = o?.wowPct ?? null
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div className="spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', letterSpacing: '.05em', textTransform: 'uppercase' }}>Ecosystem north star</div>
          <div style={{ fontSize: 12.5, color: 'var(--tx2)', marginTop: 2 }}>Weekly engaged accounts <span style={{ color: 'var(--tx3)' }}>· active learners + circles</span></div>
          <div className="row" style={{ gap: 12, alignItems: 'baseline', marginTop: 6 }}>
            <span style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-.02em', lineHeight: 1 }}>{engaged == null ? '—' : compact(engaged)}</span>
            {wow != null && (
              <span className="row" style={{ gap: 4, fontSize: 12.5, color: wow >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
                <TrendingUp size={13} /> {signed(wow)}
              </span>
            )}
            {circles != null && <span style={{ fontSize: 12, color: 'var(--tx3)' }}>· {compact(circles)} active circles</span>}
          </div>
        </div>
        {o && o.northStar.length > 0 && <SparkLine points={o.northStar} />}
      </div>
    </div>
  )
}

function SparkLine({ points }: { points: GrowthPoint[] }) {
  const W = 200, H = 54
  const n = points.length
  if (n < 2) return null
  const max = Math.max(1, ...points.map(p => p.value))
  const x = (idx: number) => (idx * W) / (n - 1)
  const y = (val: number) => 6 + (1 - val / max) * (H - 12)
  const line = points.map((p, idx) => `${idx ? 'L' : 'M'}${x(idx).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Weekly engaged accounts trend" style={{ flex: 'none' }}>
      <path d={`${line} L${W},${H} L0,${H} Z`} fill="var(--acc-soft)" opacity={0.5} />
      <path d={line} fill="none" stroke="var(--acc)" strokeWidth={2} strokeLinejoin="round" />
      <circle cx={x(n - 1)} cy={y(points[n - 1].value)} r={3} fill="var(--acc)" />
    </svg>
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

// ── The flywheel: cross-app moat ────────────────────────────────────────────
function Flywheel({ v }: { v: PortfolioVc }) {
  const pctVal = v.familiesTotal > 0 ? Math.round((100 * v.flywheelCount) / v.familiesTotal) : 0
  return (
    <div className="insight" style={{ background: 'var(--acc-soft)', color: 'var(--tx)', alignItems: 'center', border: '1px solid var(--bd2)' }}>
      <Shuffle size={16} style={{ color: 'var(--mag)', flex: 'none' }} />
      <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
        <b>The flywheel · {pctVal}% of circles have an active learner</b> ({compact(v.flywheelCount)} of {compact(v.familiesTotal)}). Families who use KinetikCircle <i>and</i> ArgantaLab reinforce each other — the cross-app loop is the moat, not the count of either product alone.
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
