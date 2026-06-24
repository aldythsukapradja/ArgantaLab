import { useEffect, useState, type ReactNode } from 'react'
import {
  Activity, Users, UserPlus, Target, Lightbulb, TrendingUp, ChevronRight, Info,
  Presentation as PresentIcon, CalendarClock,
} from 'lucide-react'
import { live } from '../data/live'
import { supabase } from '../lib/supabase'
import type { GrowthOverview, RetentionData } from '../data/types'
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
  { id: 'acquisition', label: 'Acquisition', soon: true },
  { id: 'economy', label: 'Economy', soon: true },
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
  const [present, setPresent] = useState(false)
  const [who, setWho] = useState('Operator')

  useEffect(() => {
    live.growthOverview().then(setO)
    supabase.auth.getUser().then(({ data }) => {
      const n = (data.user?.user_metadata?.name as string) || data.user?.email?.split('@')[0]
      if (n) setWho(n)
    })
  }, [])

  const heroes = o ? heroCards(o) : []
  const score = o ? buildScorecard(o) : []
  const insight: GrowthInsight | null = o ? growthInsight(o) : null

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
          <button className="chip" disabled={!o} onClick={() => setPresent(true)}
            style={{ gap: 6, background: o ? 'var(--acc)' : 'var(--bg3)', color: o ? '#fff' : 'var(--tx3)', borderColor: o ? 'var(--acc)' : 'var(--bd2)' }}>
            <PresentIcon size={13} /> Present
          </button>
        </div>
      </div>

      {o === undefined && <Loading label="Computing live growth metrics…" />}
      {o === null && (
        <Empty title="Growth metrics need a live connection">
          Every number is a real aggregate (<span className="src">hq_growth_overview()</span>) over
          <span className="src">item_attempts</span> + <span className="src">profiles</span>. Connect Supabase and sign in as operator.
        </Empty>
      )}
      {o && insight && tab === 'overview' && <Overview o={o} heroes={heroes} score={score} insight={insight} />}
      {o && tab === 'retention' && <Retention o={o} />}

      {present && o && insight && (
        <Presentation overview={o} heroes={heroes} score={score} insight={insight} who={who} onClose={() => setPresent(false)} />
      )}
    </div>
  )
}

function Overview({ o, heroes, score, insight }: { o: GrowthOverview; heroes: HeroCard[]; score: ScoreRow[]; insight: GrowthInsight }) {
  const [drill, setDrill] = useState<string | null>(null)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className={'insight ' + (insight.tone === 'success' ? 'ok' : insight.tone === 'warning' || insight.tone === 'danger' ? 'warn' : 'tl')}>
        <Lightbulb size={15} />
        <div><b>{insight.headline}.</b> {insight.body}</div>
      </div>

      <div className="kpi-grid">
        {heroes.map(h => <HeroMetric key={h.key} h={h} />)}
      </div>

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
