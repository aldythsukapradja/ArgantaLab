import { useEffect, useState } from 'react'
import {
  Sparkles, Send, Image, Trophy, CalendarDays, Gem, Lightbulb, Megaphone, Check, Pencil,
} from 'lucide-react'
import { live } from '../data/live'
import type { GrowthOverview, EconomyData } from '../data/types'
import { Loading, Empty } from '../components/Empty'
import { ModelPill } from './Agents'
import { compact } from '../lib/format'

type Tab = 'queue' | 'templates' | 'contract'
const TABS: { id: Tab; label: string; Icon: typeof Sparkles }[] = [
  { id: 'queue', label: 'Content Board', Icon: Megaphone },
  { id: 'templates', label: 'Templates', Icon: Image },
  { id: 'contract', label: 'Operating Contract', Icon: Lightbulb },
]

interface Draft {
  type: string
  Icon: typeof Trophy
  title: string
  body: string
  audience: string
  model: 'sonnet' | 'haiku'
}

// Drafts are generated from REAL aggregates — never fabricated. When the cloud
// is offline we say so rather than inventing a moment.
function buildDrafts(g: GrowthOverview | null, e: EconomyData | null): Draft[] {
  if (!g && !e) return []
  const drafts: Draft[] = []
  if (g) {
    drafts.push({
      type: 'Weekly Recap', Icon: CalendarDays, model: 'sonnet', audience: 'Parent Feed',
      title: 'This week across the Circle',
      body: `${compact(g.wau)} learners were active this week${g.wowPct != null ? ` (${g.wowPct > 0 ? '+' : ''}${g.wowPct}% vs last week)` : ''}. ${compact(g.attempts7d)} mastery attempts logged${g.accuracyPct != null ? ` at ${Math.round(g.accuracyPct)}% accuracy` : ''}. Real progress, every day.`,
    })
    if (g.newLearners7d > 0) drafts.push({
      type: 'Progress Moment', Icon: Trophy, model: 'sonnet', audience: 'Family Circle',
      title: `${compact(g.newLearners7d)} new learners joined`,
      body: `${compact(g.newLearners7d)} children started learning on ArgantaLab this week. Welcome them to the Circle — every streak begins with a first day.`,
    })
  }
  if (e && e.float > 0) drafts.push({
    type: 'Diamond Update', Icon: Gem, model: 'haiku', audience: 'Circle Community',
    title: 'Diamonds earned this week',
    body: `${compact(e.minted)} diamonds were earned through play and ${compact(e.spent)} spent in the shop. Keep building — diamonds are earned, never bought.`,
  })
  return drafts
}

export function Moments() {
  const [tab, setTab] = useState<Tab>('queue')
  const [g, setG] = useState<GrowthOverview | null | undefined>(undefined)
  const [e, setE] = useState<EconomyData | null | undefined>(undefined)

  useEffect(() => {
    live.growthOverview().then(setG)
    live.economy().then(setE)
  }, [])

  const loading = g === undefined || e === undefined
  const drafts = loading ? [] : buildDrafts(g ?? null, e ?? null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="spread" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="h1">Content Creator</div>
          <div className="sub">The agent that turns real learning events into KinetikCircle moments, feed posts & recaps</div>
        </div>
        <div className="seg">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              <Icon size={13} style={{ verticalAlign: -2, marginRight: 5 }} />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-l"><Sparkles size={13} /> Drafts ready</div><div className="kpi-v">{loading ? '—' : drafts.length}</div><div className="kpi-s" style={{ color: 'var(--tx3)' }}>from live signals</div></div>
        <div className="kpi"><div className="kpi-l"><Send size={13} /> Published</div><div className="kpi-v">0</div><div className="kpi-s" style={{ color: 'var(--tx3)' }}>this session</div></div>
        <div className="kpi"><div className="kpi-l">Engine</div><div className="kpi-v" style={{ fontSize: 15 }}><ModelPill model="sonnet" /></div><div className="kpi-s" style={{ color: 'var(--tx3)' }}>narrative generation</div></div>
        <div className="kpi"><div className="kpi-l">Safety</div><div className="kpi-v" style={{ fontSize: 15 }}><ModelPill model="haiku" /></div><div className="kpi-s" style={{ color: 'var(--tx3)' }}>UGC classification</div></div>
      </div>

      {tab === 'queue' && <Queue loading={loading} drafts={drafts} />}
      {tab === 'templates' && <Templates />}
      {tab === 'contract' && <Contract />}
    </div>
  )
}

function Queue({ loading, drafts }: { loading: boolean; drafts: Draft[] }) {
  if (loading) return <Loading label="Sensing live Circle activity…" />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="insight tl" style={{ alignItems: 'center' }}>
        <Lightbulb size={15} />
        <div>Every draft is built from a <b>real aggregate</b> (<span className="src">hq_growth_overview</span>, <span className="src">hq_economy</span>) — the agent never posts a moment that didn't happen. You review &amp; approve before it reaches a Circle.</div>
      </div>
      {drafts.length === 0 ? (
        <Empty icon={<Megaphone />} title="No drafts yet">
          The Content Creator drafts moments from live learning events. Connect Supabase and sign in as operator,
          or wait for this week's activity to accumulate via <span className="src">item_attempts</span> + <span className="src">diamond_ledger</span>.
        </Empty>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 12 }}>
          {drafts.map((d, i) => <DraftCard key={i} d={d} />)}
        </div>
      )}
    </div>
  )
}

function DraftCard({ d }: { d: Draft }) {
  const [state, setState] = useState<'draft' | 'approved'>('draft')
  return (
    <div className="card" style={{ padding: 15, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="spread">
        <span className="row" style={{ gap: 6, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--acc-text)' }}>
          <d.Icon size={13} /> {d.type}
        </span>
        <ModelPill model={d.model} small />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{d.title}</div>
      <div style={{ fontSize: 12.5, color: 'var(--tx2)', lineHeight: 1.5 }}>{d.body}</div>
      <div className="spread" style={{ marginTop: 2 }}>
        <span style={{ fontSize: 11, color: 'var(--tx3)' }}>→ {d.audience}</span>
        {state === 'approved' ? (
          <span className="pill pill-ok row" style={{ gap: 4 }}><Check size={12} /> Approved</span>
        ) : (
          <div className="row" style={{ gap: 6 }}>
            <button className="chip" style={{ gap: 5 }} title="Edit"><Pencil size={12} /> Edit</button>
            <button className="chip" style={{ gap: 5, background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' }}
              onClick={() => setState('approved')}><Check size={12} /> Approve</button>
          </div>
        )}
      </div>
    </div>
  )
}

function Templates() {
  const tpls: { Icon: typeof Trophy; name: string; desc: string }[] = [
    { Icon: Trophy, name: 'Progress Moment', desc: 'Celebrate a lesson, badge or streak' },
    { Icon: CalendarDays, name: 'Weekly Recap', desc: 'Family learning summary' },
    { Icon: Megaphone, name: 'Circle Challenge', desc: 'Invite the family to compete' },
    { Icon: Sparkles, name: 'Game Launch', desc: 'Announce a new published game' },
    { Icon: Lightbulb, name: 'Learning Insight', desc: 'What the kid learned today' },
    { Icon: Gem, name: 'Diamond Update', desc: 'Earning & balance recap' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
      {tpls.map(t => (
        <button key={t.name} className="card" style={{ textAlign: 'left', cursor: 'pointer', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--acc-soft)', color: 'var(--acc-text)' }}><t.Icon size={18} /></div>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t.name}</div>
          <div style={{ fontSize: 12, color: 'var(--tx2)' }}>{t.desc}</div>
        </button>
      ))}
    </div>
  )
}

function Contract() {
  const rows: [string, React.ReactNode][] = [
    ['Mission', 'Produce, review & schedule KinetikCircle content. Every post ties back to a real learning event or achievement in Supabase.'],
    ['Reads', <>{['item_attempts', 'diamond_ledger', 'circles', 'hq_growth_overview', 'hq_economy'].map(s => <span key={s} className="src" style={{ marginRight: 4 }}>{s}</span>)}</>],
    ['Produces', 'Moment posts · Weekly recaps · Challenge posts · Game-launch announcements · Parent progress summaries'],
    ['Decision rule', 'Never post without a real trigger event. Fabricated posts erode Circle trust. Human review required before distribution.'],
    ['Models', <span className="row" style={{ gap: 8 }}><ModelPill model="sonnet" /> narrative · <ModelPill model="haiku" /> UGC safety</span>],
  ]
  return (
    <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map(([k, v]) => (
        <div key={k} className="row" style={{ gap: 14, alignItems: 'flex-start', borderTop: k === 'Mission' ? 'none' : '1px solid var(--bd)', paddingTop: k === 'Mission' ? 0 : 12 }}>
          <div style={{ width: 110, flex: 'none', fontSize: 12.5, fontWeight: 600, color: 'var(--tx)' }}>{k}</div>
          <div style={{ flex: 1, fontSize: 12.5, color: 'var(--tx2)', lineHeight: 1.55 }}>{v}</div>
        </div>
      ))}
    </div>
  )
}
