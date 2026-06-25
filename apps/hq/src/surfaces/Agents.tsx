import { useEffect, useState } from 'react'
import {
  Network, GitBranch, Coins, Workflow, Lightbulb, ChevronRight, Circle,
  Crown, Database, Play, Check, Sparkles, BarChart3,
} from 'lucide-react'
import {
  AGENTS, TIER_META, MODEL_META, PIPELINE, deriveStatus,
  type Agent, type Tier, type Model,
} from '../data/agents'
import { SCENARIOS, scenarioById, type ScenarioResult } from '../data/scenarios'
import { ChartView, CHART_KINDS } from '../components/charts'
import { live } from '../data/live'
import type { SchemaModel } from '../data/types'
import { Empty, Loading } from '../components/Empty'

type SubTab = 'roster' | 'orchestrate' | 'datamap' | 'pipeline' | 'council' | 'tokens'
const SUBTABS: { id: SubTab; label: string; Icon: typeof Network }[] = [
  { id: 'roster', label: 'Roster', Icon: Network },
  { id: 'orchestrate', label: 'Orchestration', Icon: Crown },
  { id: 'datamap', label: 'Data Map', Icon: Database },
  { id: 'pipeline', label: 'Pipeline', Icon: Workflow },
  { id: 'council', label: 'Council', Icon: GitBranch },
  { id: 'tokens', label: 'Token Economics', Icon: Coins },
]

const agentById = (id: string) => AGENTS.find(a => a.id === id)

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
          <div className="sub">The {AGENTS.length}-agent operating system — one human CEO, many specialist agents, deterministic-first</div>
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
      {tab === 'orchestrate' && <Orchestration />}
      {tab === 'datamap' && <DataMap />}
      {tab === 'pipeline' && <PipelineView />}
      {tab === 'council' && <Council />}
      {tab === 'tokens' && <Tokens />}
    </div>
  )
}

// ── Orchestration: CEO Agent convenes selected agents, runs a scenario,
//    renders the chart from live SQL. ───────────────────────────────────────
function Orchestration() {
  const ceo = AGENTS.find(a => a.orchestrator)!
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id)
  const scenario = scenarioById(scenarioId)!
  const [picked, setPicked] = useState<Set<string>>(new Set([scenario.ownerId, ...scenario.participantIds]))
  const [directive, setDirective] = useState('')
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle')
  const [result, setResult] = useState<ScenarioResult | null>(null)
  const [convened, setConvened] = useState<string[]>([])

  // Re-seed the convened set whenever the scenario changes.
  function selectScenario(id: string) {
    const s = scenarioById(id)!
    setScenarioId(id)
    setPicked(new Set([s.ownerId, ...s.participantIds]))
    setPhase('idle'); setResult(null); setConvened([])
  }
  function toggle(id: string) {
    setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function orchestrate() {
    setPhase('running'); setResult(null)
    // CEO convenes the selected agents one by one (visual), then renders.
    const order = [ceo.id, ...[...picked].filter(id => id !== ceo.id)]
    setConvened([])
    for (const id of order) { setConvened(c => [...c, id]); await new Promise(r => setTimeout(r, 260)) }
    const res = await scenario.run()
    setResult(res)
    setPhase('done')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* CEO orchestrator banner */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg,var(--acc),var(--mag))' }} />
        <div style={{ padding: 16, display: 'flex', gap: 13, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, flex: 'none', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,var(--acc),var(--mag))' }}>
            <Crown size={19} color="#fff" />
          </div>
          <div style={{ minWidth: 200, flex: 1 }}>
            <div className="row" style={{ gap: 8 }}>
              <div style={{ fontSize: 14.5, fontWeight: 650 }}>{ceo.name}</div>
              <ModelPill model={ceo.model} small />
              <span className="pill pill-mut">orchestrator</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--tx2)', marginTop: 4, lineHeight: 1.5 }}>{ceo.mission}</div>
          </div>
        </div>
      </div>

      {/* Scenario picker */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 8 }}>1 · Choose a scenario</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
          {SCENARIOS.map(s => {
            const on = s.id === scenarioId
            const ChartIcon = CHART_KINDS.find(k => k.kind === s.chartKind)?.Icon || BarChart3
            return (
              <button key={s.id} onClick={() => selectScenario(s.id)} className="card"
                style={{ textAlign: 'left', cursor: 'pointer', padding: 13, borderColor: on ? 'var(--acc)' : 'var(--bd2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="row" style={{ gap: 7 }}>
                  <ChartIcon size={14} color={on ? 'var(--acc)' : 'var(--tx3)'} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{s.title}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--tx2)', lineHeight: 1.45 }}>{s.question}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Agent selection */}
      <div>
        <div className="spread" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx2)' }}>2 · Convene agents <span style={{ color: 'var(--tx3)', fontWeight: 400 }}>· {picked.size} selected</span></div>
          <div style={{ fontSize: 11, color: 'var(--tx3)' }}>owner: {agentById(scenario.ownerId)?.name}</div>
        </div>
        <div className="card" style={{ padding: 12, display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {AGENTS.filter(a => !a.orchestrator).map(a => {
            const on = picked.has(a.id)
            return (
              <button key={a.id} onClick={() => toggle(a.id)}
                className="chip" style={{ gap: 6, cursor: 'pointer', borderColor: on ? 'var(--acc)' : 'var(--bd2)', background: on ? 'var(--acc-soft)' : 'var(--bg)', color: on ? 'var(--acc-text)' : 'var(--tx2)' }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, display: 'grid', placeItems: 'center', background: on ? 'var(--acc)' : 'transparent', border: on ? 'none' : '1px solid var(--bd2)' }}>
                  {on && <Check size={10} color="#fff" />}
                </span>
                {a.name}
                <ModelPill model={a.model} small />
              </button>
            )
          })}
        </div>
      </div>

      {/* Directive + run */}
      <div className="card" style={{ padding: 13, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={directive} onChange={e => setDirective(e.target.value)}
          placeholder="Optional CEO directive — e.g. 'focus on the 8–10 age band'"
          style={{ flex: 1, minWidth: 200, padding: '9px 12px', borderRadius: 'var(--r-lg)', border: '1px solid var(--bd2)', background: 'var(--bg2)', color: 'var(--tx)', font: 'inherit', fontSize: 12.5, outline: 'none' }} />
        <button onClick={orchestrate} disabled={phase === 'running' || picked.size === 0}
          className="chip" style={{ gap: 7, background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)', opacity: phase === 'running' ? 0.6 : 1 }}>
          <Play size={13} /> {phase === 'running' ? 'Orchestrating…' : 'Run scenario'}
        </button>
      </div>

      {/* Orchestration log + result */}
      {phase !== 'idle' && (
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {directive && <div className="insight tl" style={{ alignItems: 'center' }}><Crown size={14} /><div>CEO directive: <b>{directive}</b></div></div>}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 8 }}>Orchestration · {convened.length} convened</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {convened.map(id => {
                const a = agentById(id)!
                return (
                  <span key={id} className="pill" style={{ gap: 6, background: a.orchestrator ? 'linear-gradient(135deg,var(--acc),var(--mag))' : 'var(--bg3)', color: a.orchestrator ? '#fff' : 'var(--tx)', animation: 'agentin .2s var(--ease)' }}>
                    {a.orchestrator ? <Crown size={11} /> : <Sparkles size={11} />}{a.name}
                  </span>
                )
              })}
            </div>
          </div>

          {phase === 'running' && <Loading label="Convening agents & sensing live SQL…" />}

          {phase === 'done' && result === null && (
            <Empty icon={<BarChart3 />} title="No live signal for this scenario yet">
              Reads {scenario.sources.map(s => <span key={s} className="src" style={{ marginRight: 4 }}>{s}</span>)}. Sign in as operator with data flowing to render the chart.
            </Empty>
          )}

          {phase === 'done' && result && (
            <>
              <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 15, fontWeight: 650 }}>{result.headline}</div>
                <div className="row" style={{ gap: 5, marginLeft: 'auto' }}>
                  {scenario.sources.map(s => <span key={s} className="src">{s}</span>)}
                </div>
              </div>
              <div className="card" style={{ padding: 16, background: 'var(--bg2)' }}><ChartView data={result.chart} /></div>
              <div className="insight tl"><Lightbulb size={15} /><div>{result.insight}</div></div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Data Map: live SQL tables grouped by the executive that owns/reads them. ──
function DataMap() {
  const [model, setModel] = useState<SchemaModel | null | undefined>(undefined)
  useEffect(() => { live.schemaModel().then(setModel) }, [])

  // A table is "read by" any agent whose inputs name it (substring match).
  const readersOf = (table: string) =>
    AGENTS.filter(a => a.inputs.some(i => i.replace(/^hq_/, '').includes(table.replace(/^hq_/, '')) || table.includes(i.replace(/^hq_/, ''))))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="insight tl" style={{ alignItems: 'center' }}>
        <Database size={15} />
        <div>The live schema, mapped to the agents that consume it. Each agent's <span className="src">inputs</span> declare which SQL tables &amp; RPCs it reads — this is the data-ownership backbone of the OS.</div>
      </div>

      {model === undefined && <Loading label="Reading live schema…" />}
      {model === null && (
        <Empty title="Schema needs a live connection">
          Run <span className="src">hq_schema_model()</span> in Supabase and sign in as operator to map tables to agents.
        </Empty>
      )}
      {model && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl" style={{ width: '100%' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--tx2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                <th style={{ padding: '10px 12px' }}>Table</th>
                <th style={{ padding: '10px 12px' }}>Rows</th>
                <th style={{ padding: '10px 12px' }}>Cols</th>
                <th style={{ padding: '10px 12px' }}>Read by</th>
              </tr>
            </thead>
            <tbody>
              {model.tables.map(t => {
                const readers = readersOf(t.name)
                return (
                  <tr key={t.name} style={{ borderTop: '1px solid var(--bd)' }}>
                    <td style={{ padding: '10px 12px' }}><span className="src">{t.name}</span></td>
                    <td style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--tx2)' }}>{t.rows.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--tx3)' }}>{t.columns.length}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
                        {readers.length ? readers.map(a => <span key={a.id} className="pill pill-mut" style={{ fontSize: 10 }}>{a.name}</span>)
                          : <span style={{ fontSize: 11.5, color: 'var(--tx3)' }}>—</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx2)', marginBottom: 8 }}>Chart library · {CHART_KINDS.length} kinds <span style={{ color: 'var(--tx3)', fontWeight: 400 }}>· scenarios render with these; add a kind to extend</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
          {CHART_KINDS.map(c => (
            <div key={c.kind} className="card" style={{ padding: 13, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--acc-soft)', color: 'var(--acc-text)' }}><c.Icon size={16} /></div>
              <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.label}</div><div style={{ fontSize: 11, color: 'var(--tx2)', marginTop: 2 }}>{c.blurb}</div></div>
            </div>
          ))}
        </div>
      </div>
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
              <td style={{ padding: '11px 6px', fontSize: 13, fontWeight: 700 }} colSpan={3}>Total — full {AGENTS.length}-agent OS</td>
              <td style={{ padding: '11px 6px', fontSize: 14, fontWeight: 700, textAlign: 'right', color: 'var(--acc-text)' }}>~$2.20</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
