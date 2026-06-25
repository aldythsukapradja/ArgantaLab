import { useEffect, useState } from 'react'
import {
  Network, GitBranch, Coins, Workflow, Lightbulb, ChevronRight, Circle,
} from 'lucide-react'
import {
  AGENTS, TIER_META, MODEL_META, PIPELINE, deriveStatus,
  type Agent, type Tier, type Model,
} from '../data/agents'
import { live } from '../data/live'

type SubTab = 'roster' | 'pipeline' | 'council' | 'tokens'
const SUBTABS: { id: SubTab; label: string; Icon: typeof Network }[] = [
  { id: 'roster', label: 'Roster', Icon: Network },
  { id: 'pipeline', label: 'Pipeline', Icon: Workflow },
  { id: 'council', label: 'Council', Icon: GitBranch },
  { id: 'tokens', label: 'Token Economics', Icon: Coins },
]

export function ModelPill({ model, small }: { model: Model; small?: boolean }) {
  const m = MODEL_META[model]
  return (
    <span className="pill" style={{
      background: m.bg, color: m.fg, fontSize: small ? 9.5 : 11, fontWeight: 600,
      letterSpacing: 0.2, whiteSpace: 'nowrap',
    }}>{m.label}</span>
  )
}

export function Agents() {
  const [tab, setTab] = useState<SubTab>('roster')
  const [has, setHas] = useState({ growth: false, economy: false, content: false })

  useEffect(() => {
    Promise.all([live.growthOverview(), live.economy(), live.contentMatrix()]).then(([g, e, c]) =>
      setHas({ growth: !!g, economy: !!e, content: !!c }))
  }, [])

  const activeCount = AGENTS.filter(a => deriveStatus(a, has) === 'active').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="spread" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="h1">Agent Builder</div>
          <div className="sub">The 25-agent operating system — one human CEO, many specialist agents, deterministic-first</div>
        </div>
        <div className="seg">
          {SUBTABS.map(({ id, label, Icon }) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              <Icon size={13} style={{ verticalAlign: -2, marginRight: 5 }} />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-l"><Network size={13} /> Agents</div><div className="kpi-v">{AGENTS.length}</div><div className="kpi-s" style={{ color: 'var(--tx3)' }}>across 6 tiers</div></div>
        <div className="kpi"><div className="kpi-l"><Circle size={13} /> Active now</div><div className="kpi-v">{activeCount}</div><div className="kpi-s" style={{ color: activeCount ? 'var(--ok)' : 'var(--tx3)' }}>{activeCount ? 'lit by live data' : 'awaiting live data'}</div></div>
        <div className="kpi"><div className="kpi-l">Main (Sonnet)</div><div className="kpi-v">{AGENTS.filter(a => a.model === 'sonnet').length}</div><div className="kpi-s" style={{ color: 'var(--tx3)' }}>reason & debate</div></div>
        <div className="kpi"><div className="kpi-l">Est. LLM cost</div><div className="kpi-v">$2.20</div><div className="kpi-s" style={{ color: 'var(--tx3)' }}>/ month, full OS</div></div>
      </div>

      {tab === 'roster' && <Roster has={has} />}
      {tab === 'pipeline' && <PipelineView />}
      {tab === 'council' && <Council />}
      {tab === 'tokens' && <Tokens />}
    </div>
  )
}

function Roster({ has }: { has: { growth: boolean; economy: boolean; content: boolean } }) {
  const [open, setOpen] = useState<string | null>(null)
  const tiers = Object.keys(TIER_META) as Tier[]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="insight tl" style={{ alignItems: 'center' }}>
        <Lightbulb size={15} />
        <div>An agent earns its place only if it ships a <b>decision, artifact, monitoring signal, or action</b>. A dot is <b>lit</b> when its live data source has signal — not for decoration.</div>
      </div>
      {tiers.map(tier => {
        const list = AGENTS.filter(a => a.tier === tier)
        const meta = TIER_META[tier]
        return (
          <div key={tier}>
            <div className="row" style={{ gap: 8, marginBottom: 10 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: meta.accent }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>{meta.label}</div>
              <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{list.length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(268px,1fr))', gap: 12 }}>
              {list.map(a => <AgentCard key={a.id} a={a} has={has} open={open === a.id} onToggle={() => setOpen(open === a.id ? null : a.id)} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AgentCard({ a, has, open, onToggle }: {
  a: Agent; has: { growth: boolean; economy: boolean; content: boolean }; open: boolean; onToggle: () => void
}) {
  const status = deriveStatus(a, has)
  const accent = TIER_META[a.tier].accent
  return (
    <button onClick={onToggle} className="card" style={{
      textAlign: 'left', cursor: 'pointer', padding: 0, overflow: 'hidden',
      borderColor: open ? 'var(--acc)' : 'var(--bd2)', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ height: 3, background: accent }} />
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, flex: 'none', display: 'grid', placeItems: 'center',
            background: 'var(--bg3)', color: accent,
          }}><Network size={16} /></div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.2 }}>{a.name}</div>
            <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>{a.role}</div>
          </div>
          <ModelPill model={a.model} small />
        </div>
        <div style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5,
          ...(open ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) }}>
          {a.mission}
        </div>
        {open && (
          <div style={{ fontSize: 11.5, color: 'var(--tx2)', lineHeight: 1.6, borderTop: '1px solid var(--bd)', paddingTop: 9 }}>
            <div><span style={{ color: 'var(--tx)', fontWeight: 600 }}>Reads:</span> {a.inputs.map((i, k) => <span key={i} className="src" style={{ marginRight: 4 }}>{i}{k < a.inputs.length - 1 ? '' : ''}</span>)}</div>
            <div style={{ marginTop: 5 }}><span style={{ color: 'var(--tx)', fontWeight: 600 }}>Produces:</span> {a.output}</div>
            {a.reportsTo && <div style={{ marginTop: 5 }}><span style={{ color: 'var(--tx)', fontWeight: 600 }}>Reports to:</span> {AGENTS.find(x => x.id === a.reportsTo)?.name}</div>}
          </div>
        )}
        <div className="spread" style={{ marginTop: 2 }}>
          <span className="row" style={{ gap: 5, fontSize: 11, color: 'var(--tx2)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: status === 'active' ? 'var(--ok)' : 'var(--tx3)',
              boxShadow: status === 'active' ? '0 0 7px var(--ok)' : 'none' }} />
            {status === 'active' ? 'Active' : 'Idle'}
          </span>
          <ChevronRight size={13} color="var(--tx3)" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .16s' }} />
        </div>
      </div>
    </button>
  )
}

function PipelineView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="insight tl" style={{ alignItems: 'center' }}>
        <Workflow size={15} />
        <div>Every agent output flows through the same 5 layers. <b>Sense → Compute → Match</b> are pure SQL + arithmetic; only <b>Generate</b> spends an LLM token. This is why the whole OS costs cents.</div>
      </div>
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, flexWrap: 'wrap' }}>
          {PIPELINE.map((s, i) => (
            <div key={s.key} className="row" style={{ gap: 8, flex: '1 1 150px' }}>
              <div style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--bd2)', borderRadius: 'var(--r-lg)', padding: '13px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{i + 1}. {s.name}</div>
                <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{s.sub}</div>
                <ModelPill model={s.model} small />
              </div>
              {i < PIPELINE.length - 1 && <ChevronRight size={16} color="var(--tx3)" style={{ flex: 'none', alignSelf: 'center' }} />}
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>What each layer does</div>
        {[
          ['Sense', 'Reads the live RPCs — hq_growth_overview, hq_economy, hq_schema_insights — the same aggregates the dashboards use.', 'haiku'],
          ['Compute', 'Pure arithmetic on the sensed facts: stickiness, WoW %, sink coverage, content-live %.', 'det'],
          ['Match', 'Threshold rules turn numbers into signals — e.g. stickiness < 20% → daily-quest risk.', 'det'],
          ['Generate', 'The only LLM step. Sonnet 4.6 phrases the brief from the computed facts — it never invents numbers.', 'sonnet'],
          ['Deliver', 'Renders the brief / insight card / action and routes it to the founder.', 'det'],
        ].map(([name, desc, model]) => (
          <div key={name as string} className="row" style={{ gap: 12, padding: '9px 0', borderTop: '1px solid var(--bd)', alignItems: 'flex-start' }}>
            <div style={{ width: 84, flex: 'none', fontSize: 12.5, fontWeight: 600 }}>{name}</div>
            <div style={{ flex: 1, fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5 }}>{desc}</div>
            <ModelPill model={model as Model} small />
          </div>
        ))}
      </div>
    </div>
  )
}

function Council() {
  const debate: { who: string; model: Model; line: string }[] = [
    { who: 'CPO', model: 'sonnet', line: 'Build more worlds — kids want variety and exploration.' },
    { who: 'CFO', model: 'sonnet', line: 'No. More worlds inflate content cost before retention is proven.' },
    { who: 'CTO', model: 'sonnet', line: 'No. Fix telemetry and game sandboxing first — we have blind spots.' },
    { who: 'VP Growth', model: 'sonnet', line: 'The share card matters more — it drives acquisition at zero cost.' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="insight tl" style={{ alignItems: 'center' }}>
        <GitBranch size={15} />
        <div>This is not automation — it's <b>structured disagreement</b>. Each main agent writes a position with evidence; the COO synthesises the contradiction; <b>the human CEO decides</b>.</div>
      </div>
      <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {debate.map((d, i) => (
          <div key={i} className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
            <div className="row" style={{ gap: 7, width: 132, flex: 'none' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--acc-text)' }}>{d.who}</span>
            </div>
            <ModelPill model={d.model} small />
            <div style={{ flex: 1, fontSize: 13, color: 'var(--tx)', lineHeight: 1.5 }}>“{d.line}”</div>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 12, fontSize: 13.5, fontWeight: 600 }}>
          🎯 CEO decides: Game share loop + parent progress card. No new worlds this week.
        </div>
      </div>
    </div>
  )
}

function Tokens() {
  const rows: { task: string; model: Model; freq: string; cost: string }[] = [
    { task: 'COO Daily Brief', model: 'sonnet', freq: '1 / day', cost: '$0.45' },
    { task: 'CPO + Weekly Council (5 agents)', model: 'sonnet', freq: '7 / week', cost: '$0.80' },
    { task: 'Content Writer — item generation', model: 'sonnet', freq: '5 / day', cost: '$0.30' },
    { task: 'Content Creator — Circle posts', model: 'sonnet', freq: '3 / day', cost: '$0.22' },
    { task: 'Parent Intelligence Lead', model: 'haiku', freq: '2 / day', cost: '$0.06' },
    { task: 'Sense layer — all agents', model: 'haiku', freq: '20 / day', cost: '$0.12' },
    { task: 'Security & UGC classification', model: 'haiku', freq: '10 / day', cost: '$0.08' },
    { task: 'Kid Tester persona sims', model: 'haiku', freq: '2 / week', cost: '$0.02' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="insight tl" style={{ alignItems: 'center' }}>
        <Coins size={15} />
        <div>Deterministic-first keeps the bill tiny: the pipeline exhausts SQL-computed signals before any LLM call. Sonnet 4.6 only for synthesis & debate; Haiku 4.5 for sense & classification at ~10× lower cost.</div>
      </div>
      <div className="card" style={{ padding: 16 }}>
        <table className="tbl" style={{ width: '100%' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--tx2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              <th style={{ padding: '8px 6px' }}>Agent / Task</th>
              <th style={{ padding: '8px 6px' }}>Model</th>
              <th style={{ padding: '8px 6px' }}>Frequency</th>
              <th style={{ padding: '8px 6px', textAlign: 'right' }}>Est. / mo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--bd)' }}>
                <td style={{ padding: '10px 6px', fontSize: 13 }}>{r.task}</td>
                <td style={{ padding: '10px 6px' }}><ModelPill model={r.model} small /></td>
                <td style={{ padding: '10px 6px', fontSize: 12.5, color: 'var(--tx2)' }}>{r.freq}</td>
                <td style={{ padding: '10px 6px', fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{r.cost}</td>
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid var(--bd2)' }}>
              <td style={{ padding: '11px 6px', fontSize: 13, fontWeight: 700 }} colSpan={3}>Total — full 25-agent OS</td>
              <td style={{ padding: '11px 6px', fontSize: 14, fontWeight: 700, textAlign: 'right', color: 'var(--acc-text)' }}>~$2.20</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
