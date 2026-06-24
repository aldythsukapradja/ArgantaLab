import { useEffect, useState, type ReactNode } from 'react'
import { Activity, Users, UserPlus, Target, Lightbulb, TrendingUp, ChevronRight } from 'lucide-react'
import { live } from '../data/live'
import type { GrowthOverview } from '../data/types'
import { heroCards, buildScorecard, growthInsight, type Tone } from '../data/growth'
import { LineChart } from '../components/LineChart'
import { Kpi } from '../components/Kpi'
import { Empty, Loading } from '../components/Empty'

type SubTab = 'overview' | 'retention' | 'acquisition' | 'economy'
const SUBTABS: { id: SubTab; label: string; soon?: boolean }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'retention', label: 'Retention', soon: true },
  { id: 'acquisition', label: 'Acquisition', soon: true },
  { id: 'economy', label: 'Economy', soon: true },
]

const TONE_BG: Record<Tone, string> = {
  success: 'var(--ok-bg)', info: 'var(--acc-soft)', warning: 'var(--warn-bg)', danger: 'var(--bad-bg)', pending: 'var(--bg3)',
}
const TONE_FG: Record<Tone, string> = {
  success: 'var(--ok)', info: 'var(--acc-text)', warning: 'var(--warn)', danger: 'var(--bad)', pending: 'var(--tx3)',
}
const heroAccent = (t: Tone): 'ok' | 'warn' | 'bad' | undefined =>
  t === 'success' ? 'ok' : t === 'warning' ? 'warn' : t === 'danger' ? 'bad' : undefined
const HERO_ICON: Record<string, ReactNode> = {
  wau: <Activity size={13} />, stick: <Users size={13} />, new: <UserPlus size={13} />, acc: <Target size={13} />,
}

export function Growth() {
  const [tab, setTab] = useState<SubTab>('overview')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="spread" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="h1">Growth</div>
          <div className="sub">North-star, engagement & the unicorn scorecard — benchmarked, investor-ready</div>
        </div>
        <div className="seg">
          {SUBTABS.map(({ id, label, soon }) => (
            <button key={id} className={tab === id ? 'on' : ''} disabled={soon}
              onClick={() => !soon && setTab(id)} style={soon ? { opacity: 0.5, cursor: 'default' } : undefined}>
              {label}{soon && <span style={{ fontSize: 9, marginLeft: 5, color: 'var(--tx3)' }}>soon</span>}
            </button>
          ))}
        </div>
      </div>
      {tab === 'overview' && <Overview />}
    </div>
  )
}

function Overview() {
  const [o, setO] = useState<GrowthOverview | null | undefined>(undefined)
  const [drill, setDrill] = useState<string | null>(null)
  useEffect(() => { live.growthOverview().then(setO) }, [])

  if (o === undefined) return <Loading label="Computing live growth metrics…" />
  if (o === null) return (
    <Empty title="Growth metrics need a live connection">
      Every number is a real aggregate (<span className="src">hq_growth_overview()</span>) over
      <span className="src">item_attempts</span> + <span className="src">profiles</span>. Connect Supabase and sign in as operator.
    </Empty>
  )

  const ins = growthInsight(o)
  const heroes = heroCards(o)
  const score = buildScorecard(o)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className={'insight ' + (ins.tone === 'success' ? 'ok' : ins.tone === 'warning' || ins.tone === 'danger' ? 'warn' : 'tl')}>
        <Lightbulb size={15} />
        <div><b>{ins.headline}.</b> {ins.body}</div>
      </div>

      <div className="kpi-grid">
        {heroes.map(h => (
          <Kpi key={h.key} label={h.label} value={h.value} icon={HERO_ICON[h.key]} accent={heroAccent(h.tone)} sub={h.sub} />
        ))}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div className="spread" style={{ marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>North-star · weekly active learners</div>
            <div style={{ fontSize: 11.5, color: 'var(--tx2)' }}>Distinct learners with a mastery attempt, last 8 weeks</div>
          </div>
          <span className="row" style={{ gap: 5, fontSize: 12, color: 'var(--tx2)' }}>
            <TrendingUp size={13} /> live
          </span>
        </div>
        <LineChart points={o.northStar} />
      </div>

      <div>
        <div className="spread" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Unicorn scorecard</div>
          <div style={{ fontSize: 11, color: 'var(--tx3)' }}>benchmarked vs edtech / consumer · click a tile to drill</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
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
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="pill" style={{ background: TONE_BG[s.tone], color: TONE_FG[s.tone] }}>{s.note}</span>
                  <ChevronRight size={13} color="var(--tx3)" style={{ transform: on ? 'rotate(90deg)' : 'none', transition: 'transform .16s' }} />
                </div>
                {on && <div style={{ fontSize: 11.5, color: 'var(--tx2)', lineHeight: 1.5, marginTop: 2 }}>{s.detail}</div>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="insight tl" style={{ alignItems: 'center' }}>
        <Activity size={15} />
        <div>Revenue ratios (NRR, Rule of 40, Burn Multiple, LTV/CAC) stay <b>pending</b> until monetization events flow through <span className="src">hq_event</span> — these are the honest engagement-stage primitives, real not estimated. Retention cohorts arrive next via <span className="src">hq_retention()</span>.</div>
      </div>
    </div>
  )
}
