import { useEffect, useState, type ReactNode } from 'react'
import {
  Activity, Users, UserPlus, Target, Lightbulb, TrendingUp, ChevronRight, Info,
  Presentation as PresentIcon, CalendarClock, Filter, Gem, Circle, MessageSquare,
  Heart, Megaphone, Eye, Image, Sparkles, ArrowLeftRight, Coins,
} from 'lucide-react'
import { live } from '../data/live'
import type { KinetikStats } from '../data/live'
import { supabase } from '../lib/supabase'
import type { GrowthOverview, RetentionData, AcquisitionData, EconomyData } from '../data/types'
import { heroCards, buildScorecard, growthInsight, kindLabel, type Tone, type HeroCard, type GrowthInsight, type ScoreRow } from '../data/growth'
import { LineChart } from '../components/LineChart'
import { CohortHeat } from '../components/CohortHeat'
import { ChartView, chartColor } from '../components/charts'
import { Presentation } from '../components/Presentation'
import { Monetization } from './Monetization'
import { Empty, Loading } from '../components/Empty'
import { pct, compact } from '../lib/format'

type SubTab = 'overview' | 'retention' | 'acquisition' | 'economy' | 'monetization'
const SUBTABS: { id: SubTab; label: string; soon?: boolean }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'retention', label: 'Retention' },
  { id: 'acquisition', label: 'Acquisition' },
  { id: 'economy', label: 'Economy' },
  { id: 'monetization', label: 'Monetization' },
]

const TONE_BG: Record<Tone, string> = {
  success: 'var(--ok-bg)', info: 'var(--acc-soft)', warning: 'var(--warn-bg)', danger: 'var(--bad-bg)', pending: 'var(--bg3)',
}
const TONE_FG: Record<Tone, string> = {
  success: 'var(--ok)', info: 'var(--acc-text)', warning: 'var(--warn)', danger: 'var(--bad)', pending: 'var(--tx3)',
}
const heroAccent = (t: Tone): string =>
  t === 'success' ? 'var(--ok)' : t === 'warning' ? 'var(--warn)' : t === 'danger' ? 'var(--bad)' : 'var(--tx3)'
const HERO_ICON: Record<string, ReactNode> = {
  wau: <Activity size={13} />, stick: <Users size={13} />, mau: <CalendarClock size={13} />, new: <UserPlus size={13} />,
}

export function Growth() {
  const [tab, setTab] = useState<SubTab>('overview')
  const [o, setO] = useState<GrowthOverview | null | undefined>(undefined)
  const [k, setK] = useState<KinetikStats | null | undefined>(undefined)
  const [a, setA] = useState<AcquisitionData | null | undefined>(undefined)
  const [e, setE] = useState<EconomyData | null | undefined>(undefined)
  const [present, setPresent] = useState(false)
  const [who, setWho] = useState('Operator')

  useEffect(() => {
    live.kinetikStats().then(setK)
    live.growthOverview().then(setO)
    live.acquisition().then(setA)
    live.economy().then(setE)
    supabase.auth.getUser().then(({ data }) => {
      const n = (data.user?.user_metadata?.name as string) || data.user?.email?.split('@')[0]
      if (n) setWho(n)
    })
  }, [])

  const oData = o ?? null
  const heroes = oData ? heroCards(oData) : []
  const score = oData ? buildScorecard(oData) : []
  const insight: GrowthInsight | null = oData ? growthInsight(oData) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="spread" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="h1">Growth</div>
          <div className="sub">North-star, engagement & the unicorn scorecard — benchmarked, investor-ready</div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <div className="seg">
            {SUBTABS.map(({ id, label, soon }) => (
              <button key={id} className={tab === id ? 'on' : ''} disabled={soon}
                onClick={() => !soon && setTab(id)} style={soon ? { opacity: 0.5, cursor: 'default' } : undefined}>
                {label}{soon && <span style={{ fontSize: 9, marginLeft: 5, color: 'var(--tx3)' }}>soon</span>}
              </button>
            ))}
          </div>
          <button className="chip" disabled={!oData} onClick={() => setPresent(true)}
            style={{ gap: 6, background: oData ? 'var(--acc)' : 'var(--bg3)', color: oData ? '#fff' : 'var(--tx3)', borderColor: oData ? 'var(--acc)' : 'var(--bd2)' }}>
            <PresentIcon size={13} /> Present
          </button>
        </div>
      </div>

      {tab !== 'monetization' && k === undefined && o === undefined && <Loading label="Loading growth metrics…" />}
      {tab !== 'monetization' && k === null && o === null && (
        <Empty title="Growth needs a live connection">
          Connect Supabase and sign in as operator — KinetikCircle &amp; ArgantaLab stats load automatically.
        </Empty>
      )}
      {tab === 'overview' && (k !== undefined || o !== undefined) && (
        <Overview o={o ?? null} k={k ?? null} heroes={heroes} score={score} insight={insight} />
      )}
      {o && tab === 'retention' && <Retention o={o} />}
      {o && tab === 'acquisition' && <Acquisition o={o} a={a} />}
      {o && tab === 'economy' && <Economy e={e} />}
      {tab === 'monetization' && <Monetization liveFamilies={k?.circles ?? null} />}
      {!o && tab !== 'overview' && tab !== 'monetization' && (
        <Empty title={`${tab.charAt(0).toUpperCase() + tab.slice(1)} needs ArgantaLab data`}>
          The {tab} tab reads ArgantaLab learning metrics (<span className="src">hq_{tab === 'retention' ? 'retention' : tab === 'acquisition' ? 'acquisition' : 'economy'}()</span>). Connect and sign in as operator.
        </Empty>
      )}

      {present && o && insight && (
        <Presentation overview={o} acquisition={a ?? null} economy={e ?? null}
          heroes={heroes} score={score} insight={insight} who={who} onClose={() => setPresent(false)} />
      )}
    </div>
  )
}

function KinetikSnapshot({ k }: { k: KinetikStats }) {
  const metrics: { label: string; value: number; icon: ReactNode; sub: string }[] = [
    { label: 'Circles', value: k.circles, icon: <Circle size={13} />, sub: 'family groups' },
    { label: 'Members', value: k.members, icon: <Users size={13} />, sub: 'circle members' },
    { label: 'Posts · 7d', value: k.posts7d, icon: <MessageSquare size={13} />, sub: `${compact(k.posts)} total` },
    { label: 'Reactions', value: k.reactions, icon: <Heart size={13} />, sub: 'on family posts' },
    { label: 'Broadcasts live', value: k.broadcastsPublished, icon: <Megaphone size={13} />, sub: 'Discover posts' },
    { label: 'Discover views', value: k.broadcastViews, icon: <Eye size={13} />, sub: `${compact(k.broadcastReactions)} reactions` },
  ]
  return (
    <div className="card" style={{ padding: '11px 15px', display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div className="row" style={{ gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--tx2)' }}>
        <Image size={13} /> KinetikCircle
      </div>
      <div className="kstrip">
        {metrics.map(m => (
          <div key={m.label}>
            <div className="kc-l">{m.icon} {m.label}</div>
            <div className="kc-v">{compact(m.value)}</div>
            <div className="kc-s">{m.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Overview({ o, k, heroes, score, insight }: { o: GrowthOverview | null; k: KinetikStats | null; heroes: HeroCard[]; score: ScoreRow[]; insight: GrowthInsight | null }) {
  const [drill, setDrill] = useState<string | null>(null)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {k && <KinetikSnapshot k={k} />}

      {!o && !k && (
        <Empty title="Connect Supabase to see growth metrics">
          Both KinetikCircle and ArgantaLab metrics load automatically once connected.
        </Empty>
      )}

      {o && insight && (
        <div className={'insight ' + (insight.tone === 'success' ? 'ok' : insight.tone === 'warning' || insight.tone === 'danger' ? 'warn' : 'tl')}>
          <Lightbulb size={15} />
          <div><b>{insight.headline}.</b> {insight.body}</div>
        </div>
      )}

      {o && (
      <div className="row" style={{ gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--tx2)', marginTop: k ? 4 : 0 }}>
        <Activity size={14} /> ArgantaLab — Learning metrics
      </div>
      )}
      {o && <div className="kpi-grid">
        {heroes.map(h => <HeroMetric key={h.key} h={h} />)}
      </div>}

      {o && (() => {
        const hasMix = (o.activityMix ?? []).some(m => m.events > 0)
        return (
        <div className="gdash">
          <div className={'card ' + (hasMix ? 'gd-7' : 'gd-12')} style={{ padding: 16 }}>
            <div className="spread" style={{ marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>North-star · weekly active learners</div>
                <div style={{ fontSize: 11.5, color: 'var(--tx2)' }}>Distinct active learners, last 8 weeks</div>
              </div>
              <span className="row" style={{ gap: 5, fontSize: 12, color: 'var(--tx2)' }}><TrendingUp size={13} /> live</span>
            </div>
            <LineChart points={o.northStar} />
          </div>

          {hasMix && <ActivityMix o={o} className="gd-5" />}

          <div className="gd-12">
            <div className="spread" style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Unicorn scorecard</div>
              <div style={{ fontSize: 11, color: 'var(--tx3)' }}>benchmarked vs edtech / consumer · click a tile to learn what it means</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(168px,1fr))', gap: 10 }}>
              {score.map(s => {
                const on = drill === s.key
                return (
                  <button key={s.key} onClick={() => setDrill(on ? null : s.key)}
                    style={{
                      textAlign: 'left', cursor: 'pointer', background: 'var(--bg)', borderRadius: 'var(--r-lg)',
                      border: `1px solid ${on ? 'var(--acc)' : 'var(--bd2)'}`, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                    <div className="spread">
                      <span style={{ fontSize: 12, color: 'var(--tx)', fontWeight: 500 }}>{s.label}</span>
                      <span style={{ fontSize: 17, fontWeight: 600, color: s.tone === 'pending' ? 'var(--tx3)' : 'var(--tx)' }}>{s.value}</span>
                    </div>
                    <div className="spread">
                      <span className="pill" style={{ background: TONE_BG[s.tone], color: TONE_FG[s.tone] }}>{s.note}</span>
                      <ChevronRight size={13} color="var(--tx3)" style={{ transform: on ? 'rotate(90deg)' : 'none', transition: 'transform .16s' }} />
                    </div>
                    {on && (
                      <div style={{ fontSize: 11.5, color: 'var(--tx2)', lineHeight: 1.5, marginTop: 2 }}>
                        <span style={{ color: 'var(--tx)', fontWeight: 600 }}>What it is:</span> {s.what}
                        <div style={{ marginTop: 5, paddingTop: 5, borderTop: '1px solid var(--bd)', color: 'var(--tx3)' }}>{s.detail}</div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        )
      })()}
    </div>
  )
}

function HeroMetric({ h }: { h: HeroCard }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="kpi" style={{ position: 'relative' }}>
      <div className="kpi-l" style={{ justifyContent: 'space-between', width: '100%' }}>
        <span className="row" style={{ gap: 6 }}>{HERO_ICON[h.key]}{h.label}</span>
        <button onClick={() => setOpen(v => !v)} title="What is this?" aria-label="What is this?"
          style={{ color: open ? 'var(--acc)' : 'var(--tx3)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <Info size={13} />
        </button>
      </div>
      <div className="kpi-v">{h.value}</div>
      <div className="kpi-s" style={{ color: heroAccent(h.tone) }}>{h.sub}</div>
      {open && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--bd)', fontSize: 11.5, color: 'var(--tx2)', lineHeight: 1.5 }}>
          {h.what}
        </div>
      )}
    </div>
  )
}

// What kids actually do — live breakdown of earn-activity by type (last 30d).
// This is the honest answer to "are lessons being completed?" and doubles as a
// content-investment map: where engagement actually concentrates.
function ActivityMix({ o, className = '' }: { o: GrowthOverview; className?: string }) {
  const mix = (o.activityMix ?? []).filter(m => m.events > 0)
  if (mix.length === 0) return null
  const totalEvents = mix.reduce((s, m) => s + m.events, 0)
  const top = mix[0]
  const slices = mix.map((m, i) => ({ label: kindLabel(m.kind), value: m.events, color: chartColor(i) }))
  return (
    <div className={'card ' + className} style={{ padding: 16 }}>
      <div className="spread" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="row" style={{ gap: 6, fontSize: 13.5, fontWeight: 600 }}><Sparkles size={14} /> What kids actually do · last 30d</div>
          <div style={{ fontSize: 11.5, color: 'var(--tx2)' }}>{compact(totalEvents)} learning actions across {mix.length} activity types — drives where to invest content next</div>
        </div>
        <span className="pill pill-ok">{kindLabel(top.kind)} leads · {Math.round((100 * top.events) / totalEvents)}%</span>
      </div>
      <ChartView data={{ kind: 'donut', slices, centerValue: compact(totalEvents), centerLabel: 'actions' }} />
    </div>
  )
}

function Retention({ o }: { o: GrowthOverview }) {
  const [r, setR] = useState<RetentionData | null | undefined>(undefined)
  useEffect(() => { live.retention().then(setR) }, [])

  const wauMau = o.mau > 0 ? Math.round((o.wau / o.mau) * 1000) / 10 : null
  const stats: { label: string; value: string; what: string }[] = [
    { label: 'Daily active · DAU', value: compact(o.dau), what: 'Unique learners active today.' },
    { label: 'Weekly active · WAU', value: compact(o.wau), what: 'Unique learners active in the last 7 days.' },
    { label: 'Monthly active · MAU', value: compact(o.mau), what: 'Unique learners active in the last 30 days — your monthly reach.' },
    { label: 'Stickiness · DAU/MAU', value: o.stickiness == null ? '—' : pct(o.stickiness), what: 'Share of monthly learners who show up on an average day. Above 20% is strong.' },
    { label: 'Weekly stickiness · WAU/MAU', value: wauMau == null ? '—' : pct(wauMau), what: 'Share of monthly learners active in a given week.' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="insight tl" style={{ alignItems: 'center' }}>
        <CalendarClock size={15} />
        <div>Retention is the share of joiners who keep coming back — the metric investors scrutinise most. The triangle reads weekly sign-up cohorts down, weeks-since-signup across.</div>
      </div>

      <div className="kpi-grid">
        {stats.map(s => (
          <div key={s.label} className="kpi">
            <div className="kpi-l">{s.label}</div>
            <div className="kpi-v">{s.value}</div>
            <div className="kpi-s" style={{ color: 'var(--tx3)' }}>{s.what}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div className="spread" style={{ marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Retention cohort triangle</div>
            <div style={{ fontSize: 11.5, color: 'var(--tx2)' }}>% of each weekly cohort still active, by weeks since they joined</div>
          </div>
          <div className="row" style={{ gap: 10, fontSize: 10.5, color: 'var(--tx2)', flexWrap: 'wrap' }}>
            <span className="row" style={{ gap: 4 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: 'var(--ok-bg)' }} />strong</span>
            <span className="row" style={{ gap: 4 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: 'var(--acc-soft)' }} />holding</span>
            <span className="row" style={{ gap: 4 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: 'var(--warn-bg)' }} />decaying</span>
          </div>
        </div>
        {r === undefined && <Loading label="Building cohorts…" />}
        {r === null && <Empty title="Cohorts need a live connection">Run <span className="src">hq_retention()</span> in Supabase and sign in as operator.</Empty>}
        {r && r.cohorts.length === 0 && <Empty title="No cohorts yet">Cohorts appear once learners sign up across multiple weeks.</Empty>}
        {r && r.cohorts.length > 0 && <CohortHeat data={r} />}
      </div>
    </div>
  )
}

function Acquisition({ o, a }: { o: GrowthOverview; a: AcquisitionData | null | undefined }) {
  if (a === undefined) return <Loading label="Loading acquisition…" />
  if (a === null) return <Empty title="Acquisition needs a live connection">Run <span className="src">hq_acquisition()</span> in Supabase and sign in as operator.</Empty>

  const top = a.funnel[0]?.count || 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="insight tl" style={{ alignItems: 'center' }}>
        <Filter size={15} />
        <div>The activation funnel shows how many joiners turn into habit-formed learners — the leak between stages is where onboarding work pays off most.</div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Activation funnel</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {a.funnel.map((s, i) => {
            const prev = i === 0 ? s.count : a.funnel[i - 1].count
            const conv = i === 0 ? 100 : prev > 0 ? Math.round((100 * s.count) / prev) : 0
            const w = Math.max(4, Math.round((100 * s.count) / top))
            return (
              <div key={s.stage} className="row" style={{ gap: 12 }}>
                <div style={{ width: 150, fontSize: 12.5, color: 'var(--tx2)' }}>{s.stage}</div>
                <div style={{ flex: 1, height: 26, background: 'var(--bg3)', borderRadius: 7, overflow: 'hidden' }}>
                  <div style={{ width: `${w}%`, height: '100%', background: 'var(--acc)', borderRadius: 7, display: 'flex', alignItems: 'center', paddingLeft: 9 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{compact(s.count)}</span>
                  </div>
                </div>
                <div style={{ width: 96, textAlign: 'right', fontSize: 11.5, color: i === 0 ? 'var(--tx3)' : conv >= 50 ? 'var(--ok)' : 'var(--warn)' }}>
                  {i === 0 ? 'top of funnel' : `${conv}% of prev`}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-l"><UserPlus size={13} /> New learners · 7d</div>
          <div className="kpi-v">{compact(o.newLearners7d)}</div>
          <div className="kpi-s" style={{ color: o.newWowPct != null && o.newWowPct >= 0 ? 'var(--ok)' : 'var(--warn)' }}>
            {o.newWowPct == null ? 'WoW —' : `${o.newWowPct > 0 ? '+' : ''}${o.newWowPct}% WoW`}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-l"><TrendingUp size={13} /> WoW growth</div>
          <div className="kpi-v">{o.wowPct == null ? '—' : `${o.wowPct > 0 ? '+' : ''}${o.wowPct}%`}</div>
          <div className="kpi-s" style={{ color: 'var(--tx3)' }}>weekly active vs prior week</div>
        </div>
        <div className="kpi">
          <div className="kpi-l"><Users size={13} /> k-factor</div>
          <div className="kpi-v empty">—</div>
          <div className="kpi-s" style={{ color: 'var(--tx3)' }}>pending invite→join events</div>
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>New sign-ups · weekly</div>
        <LineChart points={a.newWeekly} />
      </div>
    </div>
  )
}

function Economy({ e }: { e: EconomyData | null | undefined }) {
  if (e === undefined) return <Loading label="Loading economy…" />
  if (e === null) return <Empty title="Economy needs a live connection">Run <span className="src">hq_economy()</span> in Supabase and sign in as operator.</Empty>

  // Separate the one-time onboarding floor from the recurring earn loop so the
  // 250k starter grant stops flattening every other bar. Fall back to old shape
  // when the v2 RPC hasn't been run yet.
  const starter = e.starterGrant ?? (e.sources.find(s => s.kind === 'starter')?.amount ?? 0)
  const recurringMint = e.recurringMinted ?? Math.max(0, e.minted - starter)
  const coverTone = e.coverage == null ? 'var(--tx3)' : e.coverage >= 50 ? 'var(--ok)' : 'var(--warn)'

  // Mint sources for the earn loop (exclude the starter floor and all sinks) and
  // the sinks, both as comparable bars.
  const mintBars = e.sources
    .filter(s => (s.flow ? s.flow === 'mint' : !['spend', 'deduct'].includes(s.kind)) && s.kind !== 'starter')
    .map((s, i) => ({ label: kindLabel(s.kind), value: s.amount, color: chartColor(i) }))
  const sinkBars = e.sources
    .filter(s => (s.flow ? s.flow === 'sink' : ['spend', 'deduct'].includes(s.kind)))
    .map(s => ({ label: kindLabel(s.kind), value: s.amount, color: 'var(--mag)' }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div className="insight tl" style={{ alignItems: 'center' }}>
        <Gem size={15} />
        <div>The diamond economy is the pre-revenue value loop. The one-time <b>starter grant</b> is held aside so the metric that matters — the <b>recurring earn loop</b> versus what kids <b>spend</b> — is honest. Sink coverage flags inflation when it's low.</div>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-l"><Gem size={13} /> Float · held</div><div className="kpi-v">{compact(e.float)}</div><div className="kpi-s" style={{ color: 'var(--tx3)' }}>diamonds across learners</div></div>
        <div className="kpi"><div className="kpi-l"><Coins size={13} /> Recurring earn</div><div className="kpi-v">{compact(recurringMint)}</div><div className="kpi-s" style={{ color: 'var(--tx3)' }}>minted from real play (excl. starter)</div></div>
        <div className="kpi"><div className="kpi-l"><ArrowLeftRight size={13} /> Spent · sinks</div><div className="kpi-v">{compact(e.spent)}</div><div className="kpi-s" style={{ color: 'var(--tx3)' }}>shop spends + penalties</div></div>
        <div className="kpi"><div className="kpi-l"><Target size={13} /> Sink coverage</div><div className="kpi-v">{e.coverage == null ? '—' : pct(e.coverage)}</div><div className="kpi-s" style={{ color: coverTone }}>{e.coverage == null ? 'no flows yet' : e.coverage >= 50 ? 'healthy — diamonds recirculate' : 'diamonds piling up'}</div></div>
      </div>

      {starter > 0 && (
        <div className="insight" style={{ background: 'var(--bg2)', color: 'var(--tx2)', alignItems: 'center' }}>
          <Sparkles size={15} />
          <div><b>{compact(starter)}</b> in one-time starter grants seeds new wallets — an onboarding floor, not ongoing inflation. It's excluded from the loop and coverage below so the numbers reflect real economic motion.</div>
        </div>
      )}

      {e.mintBurn && e.mintBurn.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <div className="spread" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Mint vs burn · weekly</div>
              <div style={{ fontSize: 11.5, color: 'var(--tx2)' }}>diamonds earned from play (mint) against diamonds spent (burn) — the real economic pulse</div>
            </div>
            <div className="row" style={{ gap: 14, fontSize: 11, color: 'var(--tx2)' }}>
              <span className="row" style={{ gap: 5 }}><span style={{ width: 11, height: 3, borderRadius: 2, background: 'var(--acc)' }} /> mint</span>
              <span className="row" style={{ gap: 5 }}><span style={{ width: 11, height: 3, borderRadius: 2, background: 'var(--mag)' }} /> burn</span>
            </div>
          </div>
          <MintBurnChart points={e.mintBurn} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 12 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Earn loop · by source</div>
          <div style={{ fontSize: 11.5, color: 'var(--tx2)', marginBottom: 12 }}>where recurring diamonds are minted — your engagement mix in money form</div>
          {mintBars.length === 0
            ? <Empty title="No earn flows yet">Journey, quest and reward earns appear here via <span className="src">diamond_ledger</span>.</Empty>
            : <ChartView data={{ kind: 'bars', bars: mintBars }} />}
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Sinks · where it goes</div>
          <div style={{ fontSize: 11.5, color: 'var(--tx2)', marginBottom: 12 }}>shop spends and penalties — the drain that keeps the float healthy</div>
          {sinkBars.length === 0
            ? <Empty title="No sinks yet">Add a shop sink so diamonds recirculate instead of piling up.</Empty>
            : <ChartView data={{ kind: 'bars', bars: sinkBars }} />}
        </div>
      </div>
    </div>
  )
}

// Compact dual-series chart: weekly mint (earn) vs burn (spend). Dependency-free,
// theme-tokened — the economy counterpart to the north-star line.
function MintBurnChart({ points }: { points: { week: string; mint: number; burn: number }[] }) {
  const W = 760, H = 170, padL = 10, padR = 10, padT = 18, padB = 22
  const n = points.length
  if (n === 0) return null
  const max = Math.max(1, ...points.map(p => Math.max(p.mint, p.burn)))
  const x = (i: number) => padL + (i * (W - padL - padR)) / Math.max(1, n - 1)
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB)
  const path = (key: 'mint' | 'burn') => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ')
  const mintLine = path('mint'), burnLine = path('burn')
  const base = H - padB
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: 'auto', display: 'block' }} role="img" aria-label="Weekly mint vs burn">
      {[0.25, 0.5, 0.75, 1].map(f => {
        const gy = padT + f * (H - padT - padB)
        return <line key={f} x1={padL} x2={W - padR} y1={gy} y2={gy} stroke="var(--bd)" strokeWidth={1} />
      })}
      <path d={`${mintLine} L${x(n - 1).toFixed(1)},${base} L${x(0).toFixed(1)},${base} Z`} fill="var(--acc-soft)" opacity={0.6} />
      <path d={mintLine} fill="none" stroke="var(--acc)" strokeWidth={2.5} strokeLinejoin="round" />
      <path d={burnLine} fill="none" stroke="var(--mag)" strokeWidth={2.5} strokeLinejoin="round" strokeDasharray="5 4" />
      {points.map((p, i) => <circle key={'m' + i} cx={x(i)} cy={y(p.mint)} r={3} fill="var(--acc)" />)}
      {points.map((p, i) => <circle key={'b' + i} cx={x(i)} cy={y(p.burn)} r={3} fill="var(--mag)" />)}
      {points.map((p, i) => <text key={'l' + i} x={x(i)} y={H - 6} fontSize={10} fill="var(--tx3)" textAnchor="middle">{p.week}</text>)}
    </svg>
  )
}
