import { useEffect, useMemo, useState } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap, Handle, Position, BackgroundVariant,
  type Node, type Edge, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './architecture.css'
import {
  siPostgresql, siSupabase, siVercel, siReact, siTypescript, siVite, siOpenai, siClaude, siTensorflow,
} from 'simple-icons'
import { useHQ } from '../shell/store'
import { live } from '../data/live'
import type { SchemaInsights, SchemaModel, GrowthOverview, EngagementData } from '../data/types'
import type { KinetikStats } from '../data/live'
import { fmtDur } from '../components/d3/chartkit'
import { compact } from '../lib/format'

// Architecture Map — Arganta OS backbone as a React Flow graph: layer bands +
// glass card nodes badged with real brand logos (Simple Icons, CC0) and LIVE
// key metrics straight from Supabase (learners, members, tables, time-on-app).

type View = 'simple' | 'current' | 'future'
type Logo = { path: string; hex: string; title: string }
const LC = { ui: '#6366f1', agent: '#ff3d72', aiml: '#0d9488', data: '#8b5cf6', infra: '#64748b', ctrl: '#4338ca' }
const L = { pg: siPostgresql, sb: siSupabase, vc: siVercel, react: siReact, ts: siTypescript, vite: siVite, oai: siOpenai, claude: siClaude, tf: siTensorflow } as Record<string, Logo>

// dark marks (e.g. Vercel #000) get the theme text colour so they read on dark.
function fill(hex: string): string {
  const n = parseInt(hex, 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) < 60 ? 'var(--tx)' : `#${hex}`
}

interface Stat { l: string; v: string }

function CardNode({ data }: NodeProps) {
  const d = data as CardData
  const logos = (d.logos || []) as Logo[]
  const stats = (d.stats || []) as Stat[]
  return (
    <div className={'af-card' + (d.next ? ' next' : '')} style={{ ['--af-c' as string]: d.c }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="t">{d.label}{stats.length > 0 && <span className="af-live" title="live from Supabase" />}</div>
      {d.sub && <div className="s">{d.sub}</div>}
      {stats.length > 0 && (
        <div className="af-stats">
          {stats.map((s) => (
            <span key={s.l} className="af-stat"><b>{s.v}</b> {s.l}</span>
          ))}
        </div>
      )}
      {logos.length > 0 && (
        <div className="af-logos">
          {logos.map((ic, i) => (
            <span key={i} className="af-logo" title={ic.title}>
              <svg viewBox="0 0 24 24" role="img" aria-label={ic.title}><path d={ic.path} fill={fill(ic.hex)} /></svg>
            </span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}
function BandNode({ data }: NodeProps) {
  const d = data as BandData
  return <div className="af-band" style={{ ['--af-c' as string]: d.c }}><span className="bl">{d.label}</span></div>
}
const nodeTypes = { card: CardNode, band: BandNode }

interface CardData { label: string; sub?: string; c: string; next?: boolean; logos?: Logo[]; stats?: Stat[]; [k: string]: unknown }
interface BandData { label: string; c: string; [k: string]: unknown }
interface N { id: string; x: number; y: number; label: string; sub?: string; c: string; next?: boolean; logos?: Logo[] }
interface E { s: string; t: string; next?: boolean }
interface B { id: string; x: number; y: number; w: number; h: number; label: string; c: string }

const BANDS: B[] = [
  { id: 'b-ctrl', x: 20, y: 0, w: 1180, h: 200, label: 'Control · kernel', c: LC.ctrl },
  { id: 'b-app', x: 20, y: 222, w: 1180, h: 118, label: 'Applications', c: LC.ui },
  { id: 'b-int', x: 20, y: 362, w: 1180, h: 118, label: 'Intelligence', c: LC.agent },
  { id: 'b-data', x: 20, y: 502, w: 1180, h: 118, label: 'Knowledge & Data', c: LC.data },
  { id: 'b-infra', x: 20, y: 642, w: 1180, h: 112, label: 'Platform & Delivery', c: LC.infra },
]
const NODES: N[] = [
  // control
  { id: 'orb', x: 522, y: 24, label: 'CEO-Orb', sub: 'Arganta OS · kernel', c: LC.ctrl },
  { id: 'clevel', x: 330, y: 116, label: 'C-level · 6 offices', sub: 'CEO·COO·CTO·CFO·GC·CAPO', c: LC.ctrl },
  { id: 'hqb', x: 714, y: 116, label: 'Circle HQ · builders', sub: 'Learn·Game·App·Battle·Character·Openworld·Music·Video·Pixel', c: LC.ctrl, logos: [L.react, L.ts] },
  // applications — the five client surfaces
  { id: 'arganta', x: 44, y: 248, label: 'ArgantaLab', sub: 'learn · KinQuest · diamonds', c: LC.ui, logos: [L.react, L.ts] },
  { id: 'kinetik', x: 276, y: 248, label: 'KinetikCircle', sub: 'circles · moments · KinFarm', c: LC.ui, logos: [L.react, L.ts] },
  { id: 'lashira', x: 508, y: 248, label: 'LashiraBloom', sub: 'circle farm · 5 realms', c: LC.ui, logos: [L.react, L.vite] },
  { id: 'kingdom', x: 740, y: 248, label: 'Kingdom Heroes', sub: 'character lab · MMORPG spine', c: LC.ui, logos: [L.react, L.vite] },
  { id: 'landing', x: 972, y: 248, label: 'Landing', sub: 'living company page', c: LC.ui, logos: [L.react, L.ts] },
  // intelligence
  { id: 'agentos', x: 120, y: 388, label: 'Agent OS · 27', sub: 'Sense→Compute→Match→Generate', c: LC.agent, logos: [L.ts] },
  { id: 'aiml', x: 400, y: 388, label: 'AI / ML + Builders', sub: 'MCP → Claude · OpenAI', c: LC.aiml, logos: [L.claude, L.oai, L.tf] },
  { id: 'pkgs', x: 680, y: 388, label: 'Shared packages', sub: '@arganta/ combat·character·heroes-engine·audio·video·usage', c: LC.aiml, logos: [L.ts] },
  { id: 'airt', x: 960, y: 388, label: 'Circle AI runtime', sub: '@arganta/ai · one LLM seam', c: LC.aiml, next: true },
  // knowledge & data
  { id: 'vault', x: 250, y: 528, label: 'Vault', sub: 'knowledge base · graph v3 (PixiJS + d3-force)', c: LC.data },
  { id: 'postgres', x: 520, y: 528, label: 'PostgreSQL', sub: 'the base · one schema, every app', c: LC.data, logos: [L.pg] },
  { id: 'beats', x: 800, y: 528, label: 'Usage telemetry', sub: 'app_usage_beats · time-on-page from every app', c: LC.data },
  { id: 'vector', x: 1006, y: 528, label: 'pgvector', sub: 'embeddings', c: LC.data, next: true, logos: [L.pg] },
  // platform
  { id: 'baas', x: 360, y: 666, label: 'Backend-as-a-Service', sub: 'Auth · RLS · Storage · Realtime', c: LC.infra, logos: [L.sb] },
  { id: 'edge', x: 700, y: 666, label: 'Edge Hosting & CDN', sub: 'edge compute · CDN · CI/CD', c: LC.infra, logos: [L.vc] },
  // future
  { id: 'rag', x: 44, y: 528, label: 'Vector-RAG', sub: 'Graph-RAG · rerank', c: LC.aiml, next: true },
]
const EDGES: E[] = [
  { s: 'orb', t: 'clevel' }, { s: 'orb', t: 'hqb' },
  { s: 'clevel', t: 'arganta' }, { s: 'clevel', t: 'kinetik' },
  { s: 'hqb', t: 'lashira' }, { s: 'hqb', t: 'kingdom' }, { s: 'hqb', t: 'landing' },
  { s: 'arganta', t: 'agentos' }, { s: 'kinetik', t: 'agentos' }, { s: 'kinetik', t: 'aiml' },
  { s: 'lashira', t: 'pkgs' }, { s: 'kingdom', t: 'pkgs' }, { s: 'landing', t: 'pkgs' },
  { s: 'agentos', t: 'vault' }, { s: 'agentos', t: 'postgres' }, { s: 'aiml', t: 'postgres' },
  { s: 'pkgs', t: 'beats' }, { s: 'beats', t: 'postgres' },
  { s: 'vault', t: 'baas' }, { s: 'postgres', t: 'baas' }, { s: 'postgres', t: 'edge' }, { s: 'beats', t: 'edge' },
  { s: 'aiml', t: 'airt', next: true }, { s: 'airt', t: 'vector', next: true },
  { s: 'aiml', t: 'rag', next: true }, { s: 'rag', t: 'vector', next: true }, { s: 'postgres', t: 'vector', next: true },
]
const SIMPLE: N[] = [
  { id: 'l1', x: 380, y: 24, label: '① Visualization / UI', sub: '5 apps + Circle HQ · the client surfaces', c: LC.ui, logos: [L.react, L.ts, L.vite] },
  { id: 'l2', x: 380, y: 140, label: '② Agent OS', sub: '27 agents · deterministic → MCP', c: LC.agent, logos: [L.ts] },
  { id: 'l3', x: 380, y: 256, label: '③ AI / ML + Builders', sub: '9 builders · shared packages · MCP', c: LC.aiml, logos: [L.claude, L.oai, L.tf] },
  { id: 'l4', x: 380, y: 372, label: '④ Data · PostgreSQL', sub: 'one schema · usage telemetry · the base', c: LC.data, logos: [L.pg] },
  { id: 'l5', x: 380, y: 488, label: '⑤ Platform & Delivery', sub: 'capability · vendor-swappable', c: LC.infra, logos: [L.sb, L.vc] },
  { id: 'lnext', x: 380, y: 604, label: 'AI runtime · RAG · vectors', sub: 'NEXT — toggle Future', c: LC.aiml, next: true },
]
const SIMPLE_E: E[] = [{ s: 'l1', t: 'l2' }, { s: 'l2', t: 'l3' }, { s: 'l3', t: 'l4' }, { s: 'l4', t: 'l5' }, { s: 'l5', t: 'lnext', next: true }]

function toFlow(nodes: N[], edges: E[], showNext: boolean, bands: boolean, stats: Record<string, Stat[]>): { nodes: Node[]; edges: Edge[] } {
  const bandNodes: Node[] = bands ? BANDS.map(b => ({
    id: b.id, type: 'band', position: { x: b.x, y: b.y }, data: { label: b.label, c: b.c } as BandData,
    style: { width: b.w, height: b.h }, draggable: false, selectable: false, zIndex: 0,
  } as Node)) : []
  const cards = nodes.filter(n => showNext || !n.next).map(n => ({
    id: n.id, type: 'card', position: { x: n.x, y: n.y }, zIndex: 1,
    data: { label: n.label, sub: n.sub, c: n.c, next: n.next, logos: n.logos, stats: stats[n.id] } as CardData,
  } as Node))
  const es = edges.filter(e => (showNext || !e.next) && cards.some(c => c.id === e.s) && cards.some(c => c.id === e.t)).map((e, i) => ({
    id: 'e' + i, source: e.s, target: e.t, type: 'smoothstep', animated: !e.next,
    style: { stroke: e.next ? LC.aiml : 'var(--bd3)', strokeWidth: 1.6, strokeDasharray: e.next ? '6 4' : undefined },
  } as Edge))
  return { nodes: [...bandNodes, ...cards], edges: es }
}

const LEGEND: [string, string][] = [['UI', LC.ui], ['Agent', LC.agent], ['AI/ML', LC.aiml], ['Data', LC.data], ['Infra', LC.infra]]

export function Architecture() {
  const { theme } = useHQ()
  const [view, setView] = useState<View>('current')
  const showNext = view === 'future'

  // Live key metrics — the same operator RPCs the Portfolio reads. Nodes light
  // up as data arrives; offline the map stays a clean static blueprint.
  const [ins, setIns] = useState<SchemaInsights | null>(null)
  const [kin, setKin] = useState<KinetikStats | null>(null)
  const [gro, setGro] = useState<GrowthOverview | null>(null)
  const [eng, setEng] = useState<EngagementData | null>(null)
  const [model, setModel] = useState<SchemaModel | null>(null)
  useEffect(() => {
    live.schemaInsights().then(setIns)
    live.kinetikStats().then(setKin)
    live.growthOverview().then(setGro)
    live.engagement(14).then(setEng)
    live.schemaModel().then(setModel)
  }, [])

  const stats = useMemo(() => {
    const s: Record<string, Stat[]> = {}
    const t = (app: string) => eng?.apps.find(a => a.app === app)
    if (gro) s.orb = [{ l: 'WAU', v: compact(gro.wau) }, { l: 'MAU', v: compact(gro.mau) }]
    if (ins) {
      s.arganta = [{ l: 'learners', v: compact(ins.learners) }, { l: 'active·7d', v: compact(ins.activeLearners7d) }]
      if (t('arganta')) s.arganta.push({ l: 'time·14d', v: fmtDur(t('arganta')!.seconds) })
      s.postgres = [{ l: 'games', v: compact(ins.gamesTotal) }, { l: '💎 float', v: compact(ins.diamondsFloat) }]
    }
    if (model) s.postgres = [{ l: 'tables', v: compact(model.tables.length) }, ...(s.postgres ?? [])].slice(0, 3)
    if (kin) {
      s.kinetik = [{ l: 'members', v: compact(kin.members) }, { l: 'circles', v: compact(kin.circles) }]
      if (t('kinetik')) s.kinetik.push({ l: 'time·14d', v: fmtDur(t('kinetik')!.seconds) })
    }
    if (t('lashira')) s.lashira = [{ l: 'played·14d', v: fmtDur(t('lashira')!.seconds) }, { l: 'players', v: compact(t('lashira')!.users) }]
    if (t('landing')) s.landing = [{ l: 'visit·14d', v: fmtDur(t('landing')!.seconds) }, { l: 'visitors', v: compact(t('landing')!.users) }]
    if (t('hq')) s.hqb = [{ l: 'ops time·14d', v: fmtDur(t('hq')!.seconds) }]
    if (eng) s.beats = [{ l: 'tracked·14d', v: fmtDur(eng.totalSeconds) }, { l: 'people', v: compact(eng.totalUsers) }]
    return s
  }, [ins, kin, gro, eng, model])

  const { nodes, edges } = useMemo(() => (
    view === 'simple' ? toFlow(SIMPLE, SIMPLE_E, true, false, {}) : toFlow(NODES, EDGES, showNext, true, stats)
  ), [view, showNext, stats])

  const liveCount = Object.keys(stats).length

  return (
    <div className="af-wrap">
      <div className="spread" style={{ padding: '0 0 12px', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="h1">Architecture</div>
          <div className="sub">
            Arganta OS backbone · one graph, three views · <b>NOW</b> solid / <b>NEXT</b> dashed
            {liveCount > 0 && <span style={{ color: 'var(--ok)' }}> · {liveCount} nodes reporting live</span>}
          </div>
        </div>
        <div className="af-seg">
          {(['simple', 'current', 'future'] as View[]).map(v => (
            <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{v}</button>
          ))}
        </div>
      </div>
      <div className="af-canvas">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.14 }}
          proOptions={{ hideAttribution: true }} colorMode={theme === 'dark' ? 'dark' : 'light'} minZoom={0.3} nodesConnectable={false} elevateNodesOnSelect={false}>
          <Background variant={BackgroundVariant.Dots} gap={26} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable maskColor="rgba(0,0,0,.06)" nodeColor={(n) => ((n.data as CardData)?.c) || '#6366f1'} />
        </ReactFlow>
        <div className="af-legend">
          {LEGEND.map(([l, c]) => <span key={l} className="i"><i style={{ background: c }} />{l}</span>)}
          <span className="i"><i className="af-live" style={{ position: 'static' }} />live metric</span>
        </div>
      </div>
    </div>
  )
}
