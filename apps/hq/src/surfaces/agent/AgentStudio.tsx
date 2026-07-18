import { useEffect, useMemo, useState } from 'react'
import {
  ReactFlow, Background, Controls, BackgroundVariant, Handle, Position,
  BaseEdge, getSmoothStepPath,
  type Node, type Edge, type NodeProps, type EdgeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Network, Users, ListChecks, Coins, PencilRuler, Cpu } from 'lucide-react'
import {
  AGENT_LAYERS, AGENT_COLORS, AGENT_NODES, AGENT_EDGES, BRAIN_META,
  probeBridge, probeComfy, statusForNode,
  type AgentNode, type AgentStatus,
} from '../../data/agentFabric'
import {
  AGENTS, OFFICE_META, OFFICE_KEYS, MODEL_META, officeOf, deriveStatus,
  agentSense, agentCompute, agentMatch, agentGenerate, routeIntent,
  type Agent, type Model, type Sensed,
} from '../../data/agents'
import { ArgantaMark } from '../core/ArgantaMark'
import { ClaudeMark } from '../core/ClaudeMark'
import { OpenAIMark } from '../core/OpenAIMark'
import { Markdown } from '../core/Markdown'
import { getSessionRuns } from '../../lib/ai'
import { supabase, cloudEnabled } from '../../lib/supabase'
import { compact } from '../../lib/format'
import './agent.css'

// Agent Studio — the operating room over the SAME agentFabric registry the
// Architecture "Agents" view reads (the atlas). One registry, two surfaces:
// nodes added once appear in both, by construction. Deleted the old Council /
// Orchestration / static-token theater — every panel here is real data or an
// honest empty state.

type Tab = 'map' | 'roster' | 'missions' | 'tokens' | 'author'
const TABS: { id: Tab; label: string; Icon: typeof Network }[] = [
  { id: 'map', label: 'Map', Icon: Network },
  { id: 'roster', label: 'Roster', Icon: Users },
  { id: 'missions', label: 'Missions', Icon: ListChecks },
  { id: 'tokens', label: 'Tokenomics', Icon: Coins },
  { id: 'author', label: 'Author', Icon: PencilRuler },
]

const BrainMark = ({ mark, size = 13 }: { mark: NonNullable<AgentNode['mark']>; size?: number }) =>
  mark === 'arganta' ? <ArgantaMark size={size} /> : mark === 'claude' ? <ClaudeMark size={size} /> : <OpenAIMark size={size} />

// ── Map layout — stack nodes into their six bands (shares the fabric data,
// renders its own cards; the atlas view can look different, the data cannot). ──
const CARD_W = 180, GAP_X = 18, ROW_H = 104, GAP_Y = 14, COLS = 6
const BAND_W = 1240, BAND_X = 20, BAND_TITLE = 40, BAND_PAD_B = 16, BAND_GAP = 20

function buildLayout() {
  const bands: { id: string; x: number; y: number; w: number; h: number; label: string; micro: string; c: string }[] = []
  const place: Record<string, { x: number; y: number }> = {}
  let y = 0
  for (const layer of AGENT_LAYERS) {
    const ns = AGENT_NODES.filter(n => n.layer === layer.id)
    if (!ns.length) continue
    const rows = Math.ceil(ns.length / COLS)
    const h = BAND_TITLE + rows * ROW_H + (rows - 1) * GAP_Y + BAND_PAD_B
    bands.push({ id: layer.id, x: BAND_X, y, w: BAND_W, h, label: layer.label, micro: layer.micro, c: AGENT_COLORS[layer.id] })
    ns.forEach((n, i) => {
      const r = Math.floor(i / COLS), col = i % COLS
      const inRow = Math.min(COLS, ns.length - r * COLS)
      const rowW = inRow * CARD_W + (inRow - 1) * GAP_X
      const startX = BAND_X + (BAND_W - rowW) / 2
      place[n.id] = { x: startX + col * (CARD_W + GAP_X), y: y + BAND_TITLE + r * (ROW_H + GAP_Y) }
    })
    y += h + BAND_GAP
  }
  return { bands, place }
}

interface CardData extends Record<string, unknown> { def: AgentNode; status?: AgentStatus; sel: boolean }
function AgCard({ data }: NodeProps) {
  const { def, status, sel } = data as CardData
  return (
    <div className={'ags-card' + (def.next ? ' next' : '') + (sel ? ' sel' : '')} style={{ ['--ags-c' as string]: AGENT_COLORS[def.layer] }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="h">
        <span className="t">{def.mark && <BrainMark mark={def.mark} />}<span>{def.label}</span></span>
        {status
          ? <span className={'ags-live ' + status}><i />{status === 'checking' ? '…' : status}</span>
          : <span className="ags-prov">{def.prov}</span>}
      </div>
      <div className="s">{def.sub}</div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}
function AgBand({ data }: NodeProps) {
  const d = data as { label: string; micro: string; c: string }
  return (
    <div className="ags-band" style={{ ['--ags-c' as string]: d.c, width: '100%', height: '100%' }}>
      <span className="bl">{d.label}<i>· {d.micro}</i></span>
    </div>
  )
}
function PulseEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps) {
  const [path] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 12 })
  const flow = (data as { flow?: boolean; next?: boolean } | undefined)?.flow
  const next = (data as { next?: boolean } | undefined)?.next
  return <BaseEdge id={id} path={path} style={{ stroke: next ? '#8b5cf6' : flow ? 'var(--acc)' : 'var(--bd3)', strokeWidth: flow ? 2 : 1.3, opacity: next ? 0.55 : flow ? 0.85 : 0.4, strokeDasharray: next ? '6 5' : undefined }} />
}
const nodeTypes = { agcard: AgCard, agband: AgBand }
const edgeTypes = { pulse: PulseEdge }

export function AgentStudio() {
  const [tab, setTab] = useState<Tab>('map')
  const [bridge, setBridge] = useState<AgentStatus>('checking')
  const [comfy, setComfy] = useState<AgentStatus>('checking')
  const [comfyInfo, setComfyInfo] = useState<string | null>(null)
  const [sel, setSel] = useState<string | null>(null)          // selected fabric node (Map)
  const [selAgent, setSelAgent] = useState<string | null>(null) // selected roster agent
  const [has, setHas] = useState({ growth: false, economy: false, content: false })

  useEffect(() => {
    setBridge('checking'); setComfy('checking'); setComfyInfo(null)
    probeBridge().then(setBridge)
    probeComfy().then(({ status, info }) => { setComfy(status); setComfyInfo(info) })
  }, [])
  useEffect(() => {
    Promise.all([import('../../data/live')]).then(([{ live }]) =>
      Promise.all([live.growthOverview(), live.economy(), live.contentMatrix()]).then(([g, e, c]) =>
        setHas({ growth: !!g, economy: !!e, content: !!c })))
  }, [])

  return (
    <div className="ags">
      <div className="ags-top">
        <div className="ags-mark">◆</div>
        <div className="ags-title"><b>Agent Studio</b><span>Circle HQ · the agentic operating room</span></div>
        <div className="ags-seg">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}><Icon size={13} />{label}</button>
          ))}
        </div>
        <div className="ags-probes">
          <span className={'ags-chip ' + bridge}><i />Bridge {bridge === 'checking' ? '…' : bridge}</span>
          <span className={'ags-chip ' + comfy}><i />ComfyUI {comfy === 'checking' ? '…' : comfy}</span>
        </div>
      </div>

      {tab === 'map' && <MapTab bridge={bridge} comfy={comfy} comfyInfo={comfyInfo} sel={sel} setSel={setSel} />}
      {tab === 'roster' && <RosterTab has={has} sel={selAgent} setSel={setSelAgent} />}
      {tab === 'missions' && <MissionsTab bridge={bridge} />}
      {tab === 'tokens' && <TokensTab />}
      {tab === 'author' && <AuthorTab />}
    </div>
  )
}

// ── MAP ─────────────────────────────────────────────────────────────────────
function MapTab({ bridge, comfy, comfyInfo, sel, setSel }: {
  bridge: AgentStatus; comfy: AgentStatus; comfyInfo: string | null; sel: string | null; setSel: (s: string | null) => void
}) {
  const { nodes, edges } = useMemo(() => {
    const { bands, place } = buildLayout()
    const bandNodes: Node[] = bands.map(b => ({
      id: 'b-' + b.id, type: 'agband', position: { x: b.x, y: b.y }, data: { label: b.label, micro: b.micro, c: b.c },
      style: { width: b.w, height: b.h }, draggable: false, selectable: false, connectable: false, zIndex: 0,
    }))
    const cards: Node[] = AGENT_NODES.map(n => ({
      id: n.id, type: 'agcard', position: place[n.id], connectable: false, zIndex: 1,
      data: { def: n, status: statusForNode(n, bridge, comfy), sel: n.id === sel } as CardData,
    }))
    const es: Edge[] = AGENT_EDGES.map((e, i) => ({
      id: 'e' + i, source: e.s, target: e.t, type: 'pulse', data: { flow: e.flow, next: e.next }, selectable: false, zIndex: 0,
    }))
    return { nodes: [...bandNodes, ...cards], edges: es }
  }, [bridge, comfy, sel])

  const selDef = sel ? AGENT_NODES.find(n => n.id === sel) ?? null : null

  return (
    <div className="ags-body">
      <div className="ags-main">
        <div className="ags-canvas">
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView
            fitViewOptions={{ padding: 0.14 }} proOptions={{ hideAttribution: true }} minZoom={0.25}
            nodesConnectable={false} elevateNodesOnSelect={false}
            onNodeClick={(_, n) => { if (n.type === 'agcard') setSel(n.id === sel ? null : n.id) }}
            onPaneClick={() => setSel(null)}>
            <Background variant={BackgroundVariant.Dots} gap={26} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </div>
      <div className="ags-rail">
        {selDef ? <NodeInspector def={selDef} status={statusForNode(selDef, bridge, comfy)} comfyInfo={comfyInfo} />
          : <div className="ags-legend">
              <p><b>The command hierarchy.</b> Founder → Tri-Brain → Economy Tiers → Execution Fabric → Advisory Roster → Controlled Surfaces. This is the same registry the Architecture <b>Agents</b> view reads — click any card for its detail and live status.</p>
              <p style={{ marginTop: 12 }}>Rule of thumb: bytes → <b>Sovereign</b>, words/publishing → <b>Claude</b>, diffs → <b>Codex</b>.</p>
            </div>}
      </div>
    </div>
  )
}

function NodeInspector({ def, status, comfyInfo }: { def: AgentNode; status?: AgentStatus; comfyInfo: string | null }) {
  const layer = AGENT_LAYERS.find(l => l.id === def.layer)
  return (
    <div style={{ ['--ags-c' as string]: AGENT_COLORS[def.layer] }}>
      <div className="ags-rh">
        <div>
          <div className="l" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>{def.mark && <BrainMark mark={def.mark} size={18} />}{def.label}</div>
          <div className="sub">{layer?.label} · {layer?.micro}</div>
        </div>
        {status && <span className={'ags-live ' + status} style={{ marginLeft: 'auto' }}><i />{status === 'checking' ? 'checking' : status}</span>}
      </div>
      {def.detail && <p className="ags-rp">{def.detail}</p>}
      {def.id === 'ag-comfy' && comfyInfo && <div className="ags-info">{comfyInfo} · measured</div>}
      {def.brains && (
        <div className="ags-brainmap">
          <div className="bmh">Tri-brain control map</div>
          {def.brains.map(b => {
            const m = BRAIN_META[b.brain]
            return (
              <div key={b.brain} className="ags-bmr" style={{ ['--bm-c' as string]: m.c }}>
                <span className="ags-bmn"><BrainMark mark={m.mark} size={12} />{m.label}</span>
                <span className="ags-bmw">{b.what}</span>
              </div>
            )
          })}
        </div>
      )}
      <dl className="ags-meta">
        {def.tech && <><dt>Tech</dt><dd>{def.tech}</dd></>}
        {def.repo && <><dt>Where</dt><dd className="mono">{def.repo}</dd></>}
        {def.swap && <><dt>Swap</dt><dd>{def.swap}</dd></>}
        {def.headroom && <><dt>At 10×</dt><dd>{def.headroom}</dd></>}
      </dl>
    </div>
  )
}

// ── ROSTER ──────────────────────────────────────────────────────────────────
function RosterTab({ has, sel, setSel }: { has: { growth: boolean; economy: boolean; content: boolean }; sel: string | null; setSel: (s: string | null) => void }) {
  const selAgent = sel ? AGENTS.find(a => a.id === sel) ?? null : null
  return (
    <div className="ags-body">
      <div className="ags-main">
        <div className="ags-scroll">
          {OFFICE_KEYS.map(office => {
            const members = AGENTS.filter(a => officeOf(a) === office)
            if (!members.length) return null
            const meta = OFFICE_META[office]
            return (
              <div key={office} className="ags-office">
                <h4><i style={{ background: meta.accent }} />{meta.label} <span style={{ color: 'var(--tx3)' }}>· {members.length}</span></h4>
                <div className="ags-grid">
                  {members.map(a => {
                    const st = deriveStatus(a, has)
                    return (
                      <button key={a.id} className={'ags-agent' + (a.id === sel ? ' sel' : '')} onClick={() => setSel(a.id === sel ? null : a.id)}>
                        <div className="an">{a.name}{a.orchestrator && ' ★'}</div>
                        <div className="ar">{a.role}</div>
                        <div className="af">
                          <span className={'ags-adot ' + st} title={st} />
                          <ModelPill model={a.model} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="ags-rail">
        {selAgent ? <AgentInspector a={selAgent} has={has} />
          : <div className="ags-legend"><p><b>The advisory roster.</b> {AGENTS.length} agents under six C-Level offices. A green dot means the agent's primary data source has live signal right now — status is derived, never decorative. Today they advise; the act-layer is the Agent OS v2 roadmap.</p></div>}
      </div>
    </div>
  )
}

function AgentInspector({ a, has }: { a: Agent; has: { growth: boolean; economy: boolean; content: boolean } }) {
  const st = deriveStatus(a, has)
  const reports = a.reportsTo ? AGENTS.find(x => x.id === a.reportsTo) : null
  return (
    <div>
      <div className="ags-rh">
        <div>
          <div className="l">{a.name}</div>
          <div className="sub">{a.role}</div>
        </div>
        <span className={'ags-live ' + (st === 'active' ? 'connected' : 'offline')} style={{ marginLeft: 'auto' }}><i />{st}</span>
      </div>
      <p className="ags-rp">{a.mission}</p>
      <dl className="ags-meta">
        <dt>Model</dt><dd><ModelPill model={a.model} /></dd>
        <dt>Office</dt><dd>{OFFICE_META[officeOf(a)].label}</dd>
        {reports && <><dt>Reports to</dt><dd>{reports.name}</dd></>}
        <dt>Reads</dt><dd className="mono">{a.inputs.join(' · ')}</dd>
        <dt>Produces</dt><dd>{a.output}</dd>
      </dl>
    </div>
  )
}

function ModelPill({ model }: { model: Model }) {
  const m = MODEL_META[model]
  return <span style={{ background: m.bg, color: m.fg, fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap' }}>{m.label}</span>
}

// ── MISSIONS ────────────────────────────────────────────────────────────────
function MissionsTab({ bridge }: { bridge: AgentStatus }) {
  return (
    <div className="ags-body full">
      <div className="ags-main">
        <div className="ags-empty">
          <div className="box">
            <h3>{bridge === 'connected' ? 'Bridge connected — no missions yet' : 'Bridge offline'}</h3>
            <p>
              Missions are Claude Code and Codex runs through the Arganta Bridge (WS 127.0.0.1:7717).
              {bridge === 'connected'
                ? ' Start one from the Sovereign/Claude/Codex capsules in Arganta Core; running missions, approvals and results will stream here.'
                : ' Connect the bridge from Arganta Core to run and watch missions here.'}
              <br /><br />
              Persisted mission history lands here once <span style={{ fontFamily: 'var(--mono)' }}>migration_missions_engine.sql</span> is applied — until then this reads the live bridge only, and never invents a run that didn't happen.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── TOKENOMICS ──────────────────────────────────────────────────────────────
type NRun = { costClass: number | null; provider: string | null; costUsd: number; status: string }
function TokensTab() {
  const [session] = useState(() => getSessionRuns())
  const [live, setLive] = useState<any[]>([])
  const [capo, setCapo] = useState<any | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!cloudEnabled) { setLoaded(true); return }
    let off = false
    ;(async () => {
      const [{ data: recent }, { data: c }] = await Promise.all([
        supabase.rpc('agent_runs_recent', { p_limit: 200, p_domain: null }),
        supabase.rpc('agent_runs_capo', { p_days: 30 }),
      ])
      if (off) return
      setLive((recent as any[]) || []); setCapo((c as any[])?.[0] || null); setLoaded(true)
    })().catch(() => setLoaded(true))
    return () => { off = true }
  }, [])

  const runs: NRun[] = useMemo(() => [...session, ...live].map((r: any) => ({
    costClass: r.actualCostClass ?? r.actual_cost_class ?? null,
    provider: r.actualProvider || r.actual_provider || null,
    costUsd: r.costUsd ?? r.cost_usd ?? 0,
    status: r.status,
  })), [session, live])

  const total = runs.length
  const eligible = runs.filter(r => r.status !== 'rejected')
  const scr = eligible.length ? Math.round(100 * eligible.filter(r => r.costClass === 0).length / eligible.length) : null
  const spend = capo?.cost_usd ?? runs.reduce((s, r) => s + (r.costUsd || 0), 0)
  const frontier = runs.filter(r => r.costClass === 3).length
  const byProvider = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of runs) { const k = r.provider || 'unknown'; m.set(k, (m.get(k) || 0) + 1) }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [runs])
  const maxP = Math.max(1, ...byProvider.map(p => p[1]))

  if (loaded && total === 0) {
    return (
      <div className="ags-body full"><div className="ags-main"><div className="ags-empty"><div className="box">
        <h3>No metered runs yet</h3>
        <p>Tokenomics reads the real <span style={{ fontFamily: 'var(--mono)' }}>agent_runs</span> ledger — provider, model, cost, tier and status per run. Nothing has been recorded {cloudEnabled ? 'in the last 30 days' : '(cloud is offline)'}, so there is no cost to show. This panel will never print an estimated dollar figure in place of a measured one.</p>
      </div></div></div></div>
    )
  }

  return (
    <div className="ags-body full">
      <div className="ags-main"><div className="ags-scroll">
        <div className="ags-kpis">
          <div className="ags-kpi"><div className="kl"><Cpu size={12} /> Runs</div><div className="kv">{compact(total)}</div><div className="ks">session + last 30d</div></div>
          <div className="ags-kpi"><div className="kl">Sovereign rate</div><div className="kv">{scr == null ? '—' : scr + '%'}</div><div className="ks">local / eligible</div></div>
          <div className="ags-kpi"><div className="kl"><Coins size={12} /> Spend</div><div className="kv">${spend.toFixed(2)}</div><div className="ks">measured, 30d</div></div>
          <div className="ags-kpi"><div className="kl">Frontier calls</div><div className="kv">{frontier}</div><div className="ks" style={{ color: frontier ? 'var(--warn,#d9a12f)' : 'var(--tx3)' }}>{frontier ? 'approval-gated' : 'none — all cheaper tiers'}</div></div>
        </div>
        <div className="ags-bars">
          <h4>Runs by provider</h4>
          {byProvider.length === 0 ? <div style={{ color: 'var(--tx3)', fontSize: 12 }}>No provider data.</div> : byProvider.map(([p, n]) => (
            <div key={p} className="ags-bar">
              <span>{p}</span>
              <span className="track"><span className="fill" style={{ width: (100 * n / maxP) + '%' }} /></span>
              <span className="amt">{n}</span>
            </div>
          ))}
        </div>
        <div className="ags-legend" style={{ padding: '0 2px' }}>
          <p>The old "$2.20 / month" estimate is gone. Note: the Claude and Codex <b>brains</b> run plan-authed on your machine and do <b>not</b> pass through this ledger yet — a known metering gap tracked in the C-Level revamp (CL-2/CL-4).</p>
        </div>
      </div></div>
    </div>
  )
}

// ── AUTHOR ──────────────────────────────────────────────────────────────────
const GROUNDED = new Set(['operations', 'treasury'])
function AuthorTab() {
  const [id, setId] = useState<string>(AGENTS[0].id)
  const a = AGENTS.find(x => x.id === id)!
  const office = officeOf(a)
  const grounded = GROUNDED.has(office)
  const [prompt, setPrompt] = useState('Give me the daily brief')
  const [out, setOut] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function runTest() {
    setBusy(true); setOut(null)
    try {
      const s: Sensed = await agentSense()
      const c = agentCompute(s)
      const sig = agentMatch(c)
      const text = agentGenerate(routeIntent(prompt), c, sig, s)
      setOut(text)
    } catch { setOut('_Test failed — the grounding pipeline could not reach live data._') }
    setBusy(false)
  }

  return (
    <div className="ags-body full">
      <div className="ags-main">
        <div className="ags-author">
          <div className="ags-authlist">
            {AGENTS.map(x => (
              <button key={x.id} className={'ags-agent' + (x.id === id ? ' sel' : '')} style={{ width: '100%', textAlign: 'left', marginBottom: 6 }} onClick={() => { setId(x.id); setOut(null) }}>
                <div className="an">{x.name}</div>
                <div className="ar">{OFFICE_META[officeOf(x)].label}</div>
              </button>
            ))}
          </div>
          <div className="ags-authmain">
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>{a.name}
              <span className={'ags-groundbadge ' + (grounded ? 'g' : 'p')}>{grounded ? 'grounded' : 'persona'}</span>
            </h3>
            <div style={{ color: 'var(--tx3)', fontSize: 12, marginBottom: 16 }}>{a.role} · {OFFICE_META[office].label}</div>

            <div className="ags-field"><label>Mission</label><textarea defaultValue={a.mission} /></div>
            <div className="ags-field"><label>Reads (data sources)</label><input defaultValue={a.inputs.join(', ')} /></div>
            <div className="ags-field"><label>Model floor</label>
              <select defaultValue={a.model}>
                <option value="det">Deterministic (SQL + arithmetic)</option>
                <option value="haiku">Haiku — sense / classify</option>
                <option value="sonnet">Sonnet — reason / debate</option>
              </select>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--tx3)', margin: '0 0 14px' }}>
              Edits are local drafts for now (registry persistence lands with the Supabase agent tables).
              {grounded
                ? ' This office is grounded — the test below runs the real Sense→Compute→Match→Generate pipeline over live data.'
                : ' This office is still persona — grounding it (CTO, GC, CAPO) is the CL-track; until then the test uses the shared deterministic pipeline as a stand-in.'}
            </p>

            <div className="ags-field"><label>Test prompt</label><input value={prompt} onChange={e => setPrompt(e.target.value)} /></div>
            <button className="ags-testbtn" onClick={runTest} disabled={busy}>{busy ? 'Running…' : 'Run grounded test'}</button>
            {out && <div className="ags-testout"><Markdown text={out} /></div>}
          </div>
        </div>
      </div>
    </div>
  )
}
