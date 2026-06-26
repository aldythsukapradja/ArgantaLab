import { useEffect, useState, type ReactNode } from 'react'
import {
  Activity, Users, UserPlus, Target, Lightbulb, TrendingUp, ChevronRight, Info,
  Presentation as PresentIcon, CalendarClock, Filter, Gem, Circle, MessageSquare,
  Heart, Megaphone, Eye, Image,
} from 'lucide-react'
import { live } from '../data/live'
import type { KinetikStats } from '../data/live'
import { supabase } from '../lib/supabase'
import type { GrowthOverview, RetentionData, AcquisitionData, EconomyData } from '../data/types'
import { heroCards, buildScorecard, growthInsight, type Tone, type HeroCard, type GrowthInsight, type ScoreRow } from '../data/growth'
import { LineChart } from '../components/LineChart'
import { CohortHeat } from '../components/CohortHeat'
import { Presentation } from '../components/Presentation'
import { Empty, Loading } from '../components/Empty'
import { pct, compact } from '../lib/format'

type SubTab = 'overview' | 'retention' | 'acquisition' | 'economy'
const SUBTABS: { id: SubTab; label: string; soon?: boolean }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'retention', label: 'Retention' },
  { id: 'acquisition', label: 'Acquisition' },
  { id: 'economy', label: 'Economy' },
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
  wau: <Activity size={13} />, stick: <Users size={13} />, new: <UserPlus size={13} />, acc: <Target size={13} />,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

      {k === undefined && o === undefined && <Loading label="Loading growth metrics…" />}
      {k === null && o === null && (
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
      {!o && tab !== 'overview' && (
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="row" style={{ gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--tx2)' }}>
        <Image size={14} /> KinetikCircle
      </div>
      <div className="kpi-grid">
        {metrics.map(m => (
          <div key={m.label} className="kpi">
            <div className="kpi-l">{m.icon} {m.label}</div>
            <div className="kpi-v">{compact(m.value)}</div>
            <div className="kpi-s" style={{ color: 'var(--tx3)' }}>{m.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Overview({ o, k, heroes, score, insight }: { o: GrowthOverview | null; k: KinetikStats | null; heroes: HeroCard[]; score: ScoreRow[]; insight: GrowthInsight | null }) {
  const [drill, setDrill] = useState<string | null>(null)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

      {o && (
        <>
          <div className="card" style={{ padding: 16 }}>
            <div className="spread" style={{ marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>North-star · weekly active learners</div>
                <div style={{ fontSize: 11.5, color: 'var(--tx2)' }}>Distinct learners with a mastery attempt, last 8 weeks</div>
              </div>
              <span className="row" style={{ gap: 5, fontSize: 12, color: 'var(--tx2)' }}><TrendingUp size={13} /> live</span>
            </div>
            <LineChart points={o.northStar} />
          </div>

          <div>
            <div className="spread" style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Unicorn scorecard</div>
              <div style={{ fontSize: 11, color: 'var(--tx3)' }}>benchmarked vs edtech / consumer · click a tile to learn what it means</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
              {score.map(s => {
                const on = drill === s.key
                return (
                  <button key={s.key} onClick={() => setDrill(on ? null : s.key)}
                    style={{
                      textAlign: 'left', cursor: 'pointer', background: 'var(--bg)', borderRadius: 'var(--r-lg)',
                      border: `1px solid ${on ? 'var(--acc)' : 'var(--bd2)'}`, padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                    <div className="spread">
                      <span style={{ fontSize: 12.5, color: 'var(--tx)', fontWeight: 500 }}>{s.label}</span>
                      <span style={{ fontSize: 18, fontWeight: 600, color: s.tone === 'pending' ? 'var(--tx3)' : 'var(--tx)' }}>{s.value}</span>
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

          <div className="insight tl" style={{ alignItems: 'center' }}>
            <Activity size={15} />
            <div>Revenue ratios (NRR, Rule of 40) stay <b>pending</b> until monetization events flow through <span className="src">hq_event</span> — these are the honest engagement-stage primitives, real not estimated.</div>
          </div>
        </>
      )}
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

const KIND_LABEL: Record<string, string> = {
  starter: 'Starter grant', reward: 'Lesson rewards', earn: 'Earned in play', gift: 'Family gifts', spend: 'Spent in shop',
}

function Economy({ e }: { e: EconomyData | null | undefined }) {
  if (e === undefined) return <Loading label="Loading economy…" />
  if (e === null) return <Empty title="Economy needs a live connection">Run <span className="src">hq_economy()</span> in Supabase and sign in as operator.</Empty>

  const coverTone = e.coverage == null ? 'var(--tx3)' : e.coverage >= 50 ? 'var(--ok)' : 'var(--warn)'
  const maxLeg = Math.max(1, ...e.sources.map(s => s.amount))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="insight tl" style={{ alignItems: 'center' }}>
        <Gem size={15} />
        <div>The diamond economy is the pre-revenue value loop: diamonds are <b>minted</b> (rewards) and <b>spent</b> (shop). Sink coverage — how much of what's minted gets spent — flags inflation when it's low.</div>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-l"><Gem size={13} /> Float · held</div><div className="kpi-v">{compact(e.float)}</div><div className="kpi-s" style={{ color: 'var(--tx3)' }}>diamonds across learners</div></div>
        <div className="kpi"><div className="kpi-l">Minted · sources</div><div className="kpi-v">{compact(e.minted)}</div><div className="kpi-s" style={{ color: 'var(--tx3)' }}>rewards + grants + earned</div></div>
        <div className="kpi"><div className="kpi-l">Spent · sinks</div><div className="kpi-v">{compact(e.spent)}</div><div className="kpi-s" style={{ color: 'var(--tx3)' }}>consumed in the shop</div></div>
        <div className="kpi"><div className="kpi-l"><Target size={13} /> Sink coverage</div><div className="kpi-v">{e.coverage == null ? '—' : pct(e.coverage)}</div><div className="kpi-s" style={{ color: coverTone }}>{e.coverage == null ? 'no flows yet' : e.coverage >= 50 ? 'healthy sink' : 'diamonds piling up'}</div></div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Diamond flow · by source &amp; sink</div>
        {e.sources.length === 0 ? (
          <Empty title="No diamond flows yet">Rewards and shop spends appear here as they happen via <span className="src">diamond_ledger</span>.</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {e.sources.map(s => (
              <div key={s.kind} className="row" style={{ gap: 12 }}>
                <div style={{ width: 130, fontSize: 12.5, color: 'var(--tx2)' }}>{KIND_LABEL[s.kind] ?? s.kind}</div>
                <div style={{ flex: 1, height: 22, background: 'var(--bg3)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(3, Math.round((100 * s.amount) / maxLeg))}%`, height: '100%', borderRadius: 6, background: s.kind === 'spend' ? 'var(--mag)' : 'var(--acc)' }} />
                </div>
                <div style={{ width: 64, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>{compact(s.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="insight tl" style={{ alignItems: 'center' }}>
        <Activity size={15} />
        <div>Real money (MRR, NRR, Rule of 40) layers on top of this same loop once monetization launches — the diamond economy is the dress rehearsal for the revenue economy.</div>
      </div>
    </div>
  )
}
