import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow, Background, Controls, BackgroundVariant, Handle, Position,
  BaseEdge, getSmoothStepPath,
  type Node, type Edge, type NodeProps, type EdgeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Network, Users, ListChecks, Coins, PencilRuler, Cpu, RefreshCw } from 'lucide-react'
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
import { GROUNDED_OFFICE_IDS as GROUNDED } from '../../data/officeSense'
import { supabase, cloudEnabled } from '../../lib/supabase'
import { compact } from '../../lib/format'
import { useHQ } from '../../shell/store'
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

// H2 — Author edits persist as a localStorage overlay merged over the static
// roster. No Supabase yet (registry tables land later); this keeps edits real
// across tab switches + reload without pretending a write path exists.
type AgentOverride = { mission?: string; inputs?: string[]; model?: Model }
const OVR_KEY = 'hq_agent_overrides_v1'
function loadOverrides(): Record<string, AgentOverride> {
  try { return JSON.parse(localStorage.getItem(OVR_KEY) || '{}') } catch { return {} }
}
function persistOverrides(all: Record<string, AgentOverride>) {
  try { localStorage.setItem(OVR_KEY, JSON.stringify(all)) } catch { /* ignore */ }
}
function mergeAgent(a: Agent, ovr: Record<string, AgentOverride>): Agent {
  const o = ovr[a.id]
  return o ? { ...a, mission: o.mission ?? a.mission, inputs: o.inputs ?? a.inputs, model: o.model ?? a.model } : a
}

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
  const [overrides, setOverrides] = useState<Record<string, AgentOverride>>(loadOverrides)
  const setOverride = (id: string, o: AgentOverride | null) => setOverrides(prev => {
    const next = { ...prev }
    if (o === null) delete next[id]; else next[id] = { ...next[id], ...o }
    persistOverrides(next); return next
  })

  const refreshProbes = useCallback(() => {
    setBridge('checking'); setComfy('checking')
    probeBridge().then(setBridge)
    probeComfy().then(({ status, info }) => { setComfy(status); setComfyInfo(info) })
  }, [])
  useEffect(() => {
    refreshProbes()
    const iv = setInterval(refreshProbes, 60_000)
    return () => clearInterval(iv)
  }, [refreshProbes])
  // Re-probe when opening Missions (bridge state is the whole point there).
  useEffect(() => { if (tab === 'missions') refreshProbes() }, [tab, refreshProbes])
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
          <button className="ags-refresh" onClick={refreshProbes} title="Re-check bridge + ComfyUI"><RefreshCw size={12} /></button>
        </div>
      </div>

      {tab === 'map' && <MapTab bridge={bridge} comfy={comfy} comfyInfo={comfyInfo} sel={sel} setSel={setSel} />}
      {tab === 'roster' && <RosterTab has={has} sel={selAgent} setSel={setSelAgent} overrides={overrides} />}
      {tab === 'missions' && <MissionsTab bridge={bridge} />}
      {tab === 'tokens' && <TokensTab />}
      {tab === 'author' && <AuthorTab overrides={overrides} setOverride={setOverride} />}
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
    <div className={'ags-body' + (selDef ? ' has-sel' : '')}>
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
function RosterTab({ has, sel, setSel, overrides }: { has: { growth: boolean; economy: boolean; content: boolean }; sel: string | null; setSel: (s: string | null) => void; overrides: Record<string, AgentOverride> }) {
  const rawSel = sel ? AGENTS.find(a => a.id === sel) ?? null : null
  const selAgent = rawSel ? mergeAgent(rawSel, overrides) : null
  return (
    <div className={'ags-body' + (selAgent ? ' has-sel' : '')}>
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
                        <div className="an">{a.name}{a.orchestrator && ' ★'}{overrides[a.id] && <span className="ags-edited">edited</span>}</div>
                        <div className="ar">{a.role}</div>
                        <div className="af">
                          <span className={'ags-adot ' + st} title={st} />
                          <ModelPill model={mergeAgent(a, overrides).model} />
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
// Reads the persisted `mission` table (the Bridge writes it via service role;
// anon-readable). This is the cross-socket source of truth — it shows missions
// no matter which surface's socket ran them, and never touches the live
// BridgeConsole session. Honest empty when the table is empty or cloud is off.
type Mission = { id: string; goal: string; status: string; cost_usd: number; engine?: string; activity?: any[]; created_at: string; updated_at?: string }
function relTime(iso?: string): string {
  if (!iso) return ''
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
const MISSION_CHIP: Record<string, string> = { running: 'checking', done: 'connected', failed: 'offline' }

function MissionsTab({ bridge }: { bridge: AgentStatus }) {
  const { go } = useHQ()
  const [missions, setMissions] = useState<Mission[] | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (!cloudEnabled) { setLoaded(true); return }
    let off = false
    supabase.from('mission').select('*').order('created_at', { ascending: false }).limit(50)
      .then(({ data, error }) => {
        if (off) return
        if (error) { setMissions(null); setLoaded(true); return }
        setMissions((data as Mission[]) || []); setLoaded(true)
      })
    return () => { off = true }
  }, [])

  const running = (missions || []).filter(m => m.status === 'running').length

  if (loaded && (!missions || missions.length === 0)) {
    return (
      <div className="ags-body full"><div className="ags-main"><div className="ags-empty"><div className="box">
        <h3>{bridge === 'connected' ? 'Bridge connected — no missions recorded' : 'No missions recorded'}</h3>
        <p>
          Missions are Claude Code and Codex runs through the Arganta Bridge. Start one from the
          Sovereign / Claude / Codex capsules in <button className="ags-link" onClick={() => go('core')}>Arganta Core</button>;
          persisted runs appear here across every browser and socket.
          {!cloudEnabled && <><br /><br />Cloud is offline — connect Supabase to read mission history.</>}
          {cloudEnabled && missions === null && <><br /><br />The <span style={{ fontFamily: 'var(--mono)' }}>mission</span> table isn't migrated yet (<span style={{ fontFamily: 'var(--mono)' }}>migration_missions.sql</span>). No run is ever invented here.</>}
        </p>
      </div></div></div></div>
    )
  }

  return (
    <div className="ags-body full">
      <div className="ags-main"><div className="ags-scroll">
        <div className="ags-mhead">
          <span>{missions!.length} mission{missions!.length === 1 ? '' : 's'} · {running} running</span>
          <span className={'ags-chip ' + bridge} style={{ marginLeft: 'auto' }}><i />Bridge {bridge === 'checking' ? '…' : bridge}</span>
        </div>
        {missions!.map(m => {
          const engine = m.engine === 'codex' ? 'openai' : 'claude'
          const open = openId === m.id
          const acts = Array.isArray(m.activity) ? m.activity : []
          return (
            <div key={m.id} className={'ags-mission' + (open ? ' open' : '')}>
              <button className="ags-mrow" onClick={() => setOpenId(open ? null : m.id)}>
                <BrainMark mark={engine} size={14} />
                <span className="ags-mgoal">{m.goal}</span>
                <span className={'ags-live ' + (MISSION_CHIP[m.status] || 'offline')}><i />{m.status}</span>
                <span className="ags-mtime">{relTime(m.updated_at || m.created_at)}</span>
                {m.cost_usd > 0 && <span className="ags-mcost">${m.cost_usd.toFixed(3)}</span>}
              </button>
              {open && (
                <div className="ags-mbody">
                  {acts.length > 0
                    ? acts.slice(-12).map((a: any, i: number) => (
                        <div key={i} className="ags-mact"><span className="k">{a.type}</span>{a.label || a.text || ''}</div>
                      ))
                    : <div className="ags-mact" style={{ color: 'var(--tx3)' }}>No activity trail recorded.</div>}
                  {m.status === 'running' && <button className="ags-link" onClick={() => go('core')}>Watch / approve in Arganta Core →</button>}
                </div>
              )}
            </div>
          )
        })}
      </div></div>
    </div>
  )
}

// ── TOKENOMICS ──────────────────────────────────────────────────────────────
type NRun = { costClass: number | null; provider: string | null; costUsd: number; status: string; at: string }
const TIERS = [
  { c: 0, name: 'Sovereign', color: '#6366f1' },
  { c: 1, name: 'Sponsored', color: '#0891b2' },
  { c: 2, name: 'Economy', color: '#d97706' },
  { c: 3, name: 'Frontier', color: '#e11d67' },
]
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
    at: r.createdAt || r.created_at || new Date().toISOString(),
  })), [session, live])

  const total = runs.length
  const eligible = runs.filter(r => r.status !== 'rejected')
  const scr = eligible.length ? Math.round(100 * eligible.filter(r => r.costClass === 0).length / eligible.length) : null
  const spend = capo?.cost_usd ?? runs.reduce((s, r) => s + (r.costUsd || 0), 0)
  const frontier = runs.filter(r => r.costClass === 3).length

  const byTier = useMemo(() => TIERS.map(t => ({ ...t, n: runs.filter(r => r.costClass === t.c).length })), [runs])
  const maxT = Math.max(1, ...byTier.map(t => t.n))
  // Cost by provider — only providers that actually cost money (costUsd > 0).
  const costByProvider = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of runs) if (r.costUsd > 0) { const k = r.provider || 'unknown'; m.set(k, (m.get(k) || 0) + r.costUsd) }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [runs])
  const maxC = Math.max(1e-9, ...costByProvider.map(p => p[1]))
  // 14-day daily run trend from real timestamps.
  const trend = useMemo(() => {
    const days: string[] = []
    const now = new Date()
    for (let i = 13; i >= 0; i--) { const d = new Date(now); d.setDate(now.getDate() - i); days.push(d.toISOString().slice(0, 10)) }
    const counts = new Map(days.map(d => [d, 0]))
    for (const r of runs) { const k = r.at.slice(0, 10); if (counts.has(k)) counts.set(k, counts.get(k)! + 1) }
    return days.map(d => counts.get(d)!)
  }, [runs])

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
          <h4>Runs by tier</h4>
          {byTier.map(t => (
            <div key={t.c} className="ags-bar">
              <span>T{t.c} · {t.name}</span>
              <span className="track"><span className="fill" style={{ width: (100 * t.n / maxT) + '%', background: t.color }} /></span>
              <span className="amt">{t.n}</span>
            </div>
          ))}
        </div>

        <div className="ags-bars">
          <h4>Cost by provider</h4>
          {costByProvider.length === 0
            ? <div style={{ color: 'var(--tx3)', fontSize: 12 }}>No paid runs — everything ran on free/local tiers.</div>
            : costByProvider.map(([p, c]) => (
              <div key={p} className="ags-bar">
                <span>{p}</span>
                <span className="track"><span className="fill" style={{ width: (100 * c / maxC) + '%' }} /></span>
                <span className="amt">${c.toFixed(3)}</span>
              </div>
            ))}
        </div>

        <div className="ags-bars">
          <h4>Runs · last 14 days</h4>
          <Spark data={trend} />
        </div>

        <div className="ags-legend" style={{ padding: '0 2px' }}>
          <p>The old "$2.20 / month" estimate is gone. Note: the Claude and Codex <b>brains</b> run plan-authed on your machine and do <b>not</b> pass through this ledger yet — a known metering gap tracked in the C-Level revamp (CL-2/CL-4).</p>
        </div>
      </div></div>
    </div>
  )
}

function Spark({ data }: { data: number[] }) {
  const w = 560, h = 48, max = Math.max(1, ...data)
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - (v / max) * (h - 6) - 3])
  const line = 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L ')
  const total = data.reduce((s, v) => s + v, 0)
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 48, display: 'block' }}>
        <path d={`${line} L ${w} ${h} L 0 ${h} Z`} fill="color-mix(in srgb, var(--acc) 12%, transparent)" />
        <path d={line} fill="none" stroke="var(--acc)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ fontSize: 10.5, color: 'var(--tx3)', marginTop: 4 }}>{total} run{total === 1 ? '' : 's'} over 14 days · {max} peak/day</div>
    </div>
  )
}

// ── AUTHOR ──────────────────────────────────────────────────────────────────
function AuthorTab({ overrides, setOverride }: { overrides: Record<string, AgentOverride>; setOverride: (id: string, o: AgentOverride | null) => void }) {
  const [id, setId] = useState<string>(AGENTS[0].id)
  const base = AGENTS.find(x => x.id === id)!
  const merged = mergeAgent(base, overrides)
  const office = officeOf(base)
  const grounded = GROUNDED.has(office)
  const edited = !!overrides[id]

  // Controlled form, reseeded whenever the selected agent (or its override) changes.
  const [mission, setMission] = useState(merged.mission)
  const [inputs, setInputs] = useState(merged.inputs.join(', '))
  const [model, setModel] = useState<Model>(merged.model)
  useEffect(() => {
    setMission(merged.mission); setInputs(merged.inputs.join(', ')); setModel(merged.model)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const dirty = mission !== merged.mission || inputs !== merged.inputs.join(', ') || model !== merged.model
  function save() {
    setOverride(id, { mission, inputs: inputs.split(',').map(s => s.trim()).filter(Boolean), model })
  }
  function reset() {
    setOverride(id, null)
    setMission(base.mission); setInputs(base.inputs.join(', ')); setModel(base.model)
  }

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
                <div className="an">{x.name}{overrides[x.id] && <span className="ags-edited">edited</span>}</div>
                <div className="ar">{OFFICE_META[officeOf(x)].label}</div>
              </button>
            ))}
          </div>
          <div className="ags-authmain">
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>{base.name}
              <span className={'ags-groundbadge ' + (grounded ? 'g' : 'p')}>{grounded ? 'grounded' : 'persona'}</span>
              {edited && <span className="ags-edited">edited</span>}
            </h3>
            <div style={{ color: 'var(--tx3)', fontSize: 12, marginBottom: 16 }}>{base.role} · {OFFICE_META[office].label}</div>

            <div className="ags-field"><label>Mission</label><textarea value={mission} onChange={e => setMission(e.target.value)} /></div>
            <div className="ags-field"><label>Reads (data sources)</label><input value={inputs} onChange={e => setInputs(e.target.value)} /></div>
            <div className="ags-field"><label>Model floor</label>
              <select value={model} onChange={e => setModel(e.target.value as Model)}>
                <option value="det">Deterministic (SQL + arithmetic)</option>
                <option value="haiku">Haiku — sense / classify</option>
                <option value="sonnet">Sonnet — reason / debate</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button className="ags-testbtn" onClick={save} disabled={!dirty}>{edited ? 'Update draft' : 'Save draft'}</button>
              {edited && <button className="ags-testbtn" style={{ background: 'var(--bg3)', color: 'var(--tx2)' }} onClick={reset}>Reset to default</button>}
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--tx3)', margin: '0 0 14px' }}>
              Drafts persist locally (registry tables land later). {grounded
                ? 'This office is grounded — the test runs the real Sense→Compute→Match→Generate pipeline over live data.'
                : 'This office is still persona — grounding it (CTO, GC, CAPO) is the CL-track; the test uses the shared deterministic pipeline as a stand-in.'}
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
