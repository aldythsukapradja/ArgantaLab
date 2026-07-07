import { useMemo, useState } from 'react'
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

// Architecture Map — Arganta OS backbone as a React Flow graph: layer bands +
// glass card nodes badged with real brand logos (Simple Icons, CC0). 3 views.

type View = 'simple' | 'current' | 'future'
type Logo = { path: string; hex: string; title: string }
const LC = { ui: '#6366f1', agent: '#ff3d72', aiml: '#0d9488', data: '#8b5cf6', infra: '#64748b', ctrl: '#4338ca' }
const L = { pg: siPostgresql, sb: siSupabase, vc: siVercel, react: siReact, ts: siTypescript, vite: siVite, oai: siOpenai, claude: siClaude, tf: siTensorflow } as Record<string, Logo>

// dark marks (e.g. Vercel #000) get the theme text colour so they read on dark.
function fill(hex: string): string {
  const n = parseInt(hex, 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) < 60 ? 'var(--tx)' : `#${hex}`
}

function CardNode({ data }: NodeProps) {
  const d = data as CardData
  const logos = (d.logos || []) as Logo[]
  return (
    <div className={'af-card' + (d.next ? ' next' : '')} style={{ ['--af-c' as string]: d.c }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="t">{d.label}</div>
      {d.sub && <div className="s">{d.sub}</div>}
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

interface CardData { label: string; sub?: string; c: string; next?: boolean; logos?: Logo[]; [k: string]: unknown }
interface BandData { label: string; c: string; [k: string]: unknown }
interface N { id: string; x: number; y: number; label: string; sub?: string; c: string; next?: boolean; logos?: Logo[] }
interface E { s: string; t: string; next?: boolean }
interface B { id: string; x: number; y: number; w: number; h: number; label: string; c: string }

const BANDS: B[] = [
  { id: 'b-ctrl', x: 20, y: 0, w: 940, h: 200, label: 'Control · kernel', c: LC.ctrl },
  { id: 'b-app', x: 20, y: 222, w: 940, h: 104, label: 'Applications', c: LC.ui },
  { id: 'b-int', x: 20, y: 348, w: 940, h: 104, label: 'Intelligence', c: LC.agent },
  { id: 'b-data', x: 20, y: 474, w: 940, h: 104, label: 'Knowledge & Data', c: LC.data },
  { id: 'b-infra', x: 20, y: 600, w: 940, h: 104, label: 'Platform & Delivery', c: LC.infra },
]
const NODES: N[] = [
  { id: 'orb', x: 402, y: 26, label: 'CEO-Orb', sub: 'Arganta OS · kernel', c: LC.ctrl },
  { id: 'clevel', x: 402, y: 118, label: 'C-level · 6 offices', sub: 'CEO·COO·CTO·CFO·GC·CAPO', c: LC.ctrl },
  { id: 'arganta', x: 92, y: 244, label: 'ArgantaLab', sub: 'learn · diamonds · games', c: LC.ui, logos: [L.react, L.ts] },
  { id: 'kinetik', x: 402, y: 244, label: 'KinetikCircle', sub: 'circles · moments · calendar', c: LC.ui, logos: [L.react, L.ts] },
  { id: 'lashira', x: 712, y: 244, label: 'LashiraBloom', sub: 'circle farm · MVP', c: LC.ui, logos: [L.react, L.vite] },
  { id: 'agentos', x: 232, y: 370, label: 'Agent OS · 27', sub: 'Sense→Compute→Match→Generate', c: LC.agent, logos: [L.ts] },
  { id: 'aiml', x: 542, y: 370, label: 'AI / ML + Builders', sub: '4 builders · MCP → Claude · OpenAI', c: LC.aiml, logos: [L.claude, L.oai, L.tf] },
  { id: 'vault', x: 232, y: 496, label: 'Vault', sub: 'knowledge base', c: LC.data },
  { id: 'postgres', x: 542, y: 496, label: 'PostgreSQL', sub: '100+ tables · the base', c: LC.data, logos: [L.pg] },
  { id: 'baas', x: 232, y: 622, label: 'Backend-as-a-Service', sub: 'Auth · RLS · Storage · Realtime', c: LC.infra, logos: [L.sb] },
  { id: 'edge', x: 542, y: 622, label: 'Edge Hosting & CDN', sub: 'edge compute · CDN · CI/CD', c: LC.infra, logos: [L.vc] },
  { id: 'rag', x: 752, y: 370, label: 'Vector-RAG', sub: 'Graph-RAG · rerank', c: LC.aiml, next: true },
  { id: 'vector', x: 752, y: 496, label: 'pgvector', sub: 'embeddings', c: LC.data, next: true, logos: [L.pg] },
]
const EDGES: E[] = [
  { s: 'orb', t: 'clevel' },
  { s: 'clevel', t: 'arganta' }, { s: 'clevel', t: 'kinetik' }, { s: 'clevel', t: 'lashira' },
  { s: 'arganta', t: 'agentos' }, { s: 'kinetik', t: 'agentos' }, { s: 'lashira', t: 'aiml' }, { s: 'kinetik', t: 'aiml' },
  { s: 'agentos', t: 'vault' }, { s: 'aiml', t: 'postgres' }, { s: 'agentos', t: 'postgres' },
  { s: 'vault', t: 'baas' }, { s: 'postgres', t: 'baas' }, { s: 'postgres', t: 'edge' },
  { s: 'aiml', t: 'rag', next: true }, { s: 'rag', t: 'vector', next: true }, { s: 'postgres', t: 'vector', next: true },
]
const SIMPLE: N[] = [
  { id: 'l1', x: 380, y: 24, label: '① Visualization / UI', sub: '3 apps · the client surfaces', c: LC.ui, logos: [L.react, L.ts, L.vite] },
  { id: 'l2', x: 380, y: 140, label: '② Agent OS', sub: '27 · deterministic → MCP', c: LC.agent, logos: [L.ts] },
  { id: 'l3', x: 380, y: 256, label: '③ AI / ML + Builders', sub: '4 builders · MCP', c: LC.aiml, logos: [L.claude, L.oai, L.tf] },
  { id: 'l4', x: 380, y: 372, label: '④ Data · PostgreSQL', sub: 'the base · big data', c: LC.data, logos: [L.pg] },
  { id: 'l5', x: 380, y: 488, label: '⑤ Platform & Delivery', sub: 'capability · vendor-swappable', c: LC.infra, logos: [L.sb, L.vc] },
  { id: 'lnext', x: 380, y: 604, label: 'RAG · vector · embeddings', sub: 'NEXT — toggle Future', c: LC.aiml, next: true },
]
const SIMPLE_E: E[] = [{ s: 'l1', t: 'l2' }, { s: 'l2', t: 'l3' }, { s: 'l3', t: 'l4' }, { s: 'l4', t: 'l5' }, { s: 'l5', t: 'lnext', next: true }]

function toFlow(nodes: N[], edges: E[], showNext: boolean, bands: boolean): { nodes: Node[]; edges: Edge[] } {
  const bandNodes: Node[] = bands ? BANDS.map(b => ({
    id: b.id, type: 'band', position: { x: b.x, y: b.y }, data: { label: b.label, c: b.c } as BandData,
    style: { width: b.w, height: b.h }, draggable: false, selectable: false, zIndex: 0,
  } as Node)) : []
  const cards = nodes.filter(n => showNext || !n.next).map(n => ({
    id: n.id, type: 'card', position: { x: n.x, y: n.y }, zIndex: 1,
    data: { label: n.label, sub: n.sub, c: n.c, next: n.next, logos: n.logos } as CardData,
  } as Node))
  const es = edges.filter(e => showNext || !e.next).map((e, i) => ({
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
  const { nodes, edges } = useMemo(() => (
    view === 'simple' ? toFlow(SIMPLE, SIMPLE_E, true, false) : toFlow(NODES, EDGES, showNext, true)
  ), [view, showNext])

  return (
    <div className="af-wrap">
      <div className="spread" style={{ padding: '0 0 12px', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="h1">Architecture</div>
          <div className="sub">Arganta OS backbone · one graph, three views · <b>NOW</b> solid / <b>NEXT</b> dashed</div>
        </div>
        <div className="af-seg">
          {(['simple', 'current', 'future'] as View[]).map(v => (
            <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{v}</button>
          ))}
        </div>
      </div>
      <div className="af-canvas">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.14 }}
          proOptions={{ hideAttribution: true }} colorMode={theme === 'dark' ? 'dark' : 'light'} minZoom={0.35} nodesConnectable={false} elevateNodesOnSelect={false}>
          <Background variant={BackgroundVariant.Dots} gap={26} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable maskColor="rgba(0,0,0,.06)" nodeColor={(n) => ((n.data as CardData)?.c) || '#6366f1'} />
        </ReactFlow>
        <div className="af-legend">
          {LEGEND.map(([l, c]) => <span key={l} className="i"><i style={{ background: c }} />{l}</span>)}
        </div>
      </div>
    </div>
  )
}
