import { useMemo, useState } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap, Handle, Position, BackgroundVariant,
  type Node, type Edge, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './architecture.css'
import { useHQ } from '../shell/store'

// Architecture Map — the Arganta OS backbone as a premium React Flow graph:
// layer bands (grouped) + glass card nodes + smoothstep edges. 3 views.

type View = 'simple' | 'current' | 'future'
const LC = { ui: '#6366f1', agent: '#ff3d72', aiml: '#0d9488', data: '#8b5cf6', infra: '#64748b', ctrl: '#4338ca' }

interface CardData { label: string; sub?: string; c: string; next?: boolean; [k: string]: unknown }
interface BandData { label: string; c: string; [k: string]: unknown }

function CardNode({ data }: NodeProps) {
  const d = data as CardData
  return (
    <div className={'af-card' + (d.next ? ' next' : '')} style={{ ['--af-c' as string]: d.c }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="t">{d.label}</div>
      {d.sub && <div className="s">{d.sub}</div>}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}
function BandNode({ data }: NodeProps) {
  const d = data as BandData
  return <div className="af-band" style={{ ['--af-c' as string]: d.c }}><span className="bl">{d.label}</span></div>
}
const nodeTypes = { card: CardNode, band: BandNode }

interface N { id: string; x: number; y: number; label: string; sub?: string; c: string; next?: boolean }
interface E { s: string; t: string; next?: boolean }
interface B { id: string; x: number; y: number; w: number; h: number; label: string; c: string }

const BANDS: B[] = [
  { id: 'b-ctrl', x: 20, y: 0, w: 940, h: 200, label: 'Control · kernel', c: LC.ctrl },
  { id: 'b-app', x: 20, y: 222, w: 940, h: 92, label: 'Applications', c: LC.ui },
  { id: 'b-int', x: 20, y: 334, w: 940, h: 92, label: 'Intelligence', c: LC.agent },
  { id: 'b-data', x: 20, y: 446, w: 940, h: 92, label: 'Knowledge & Data', c: LC.data },
  { id: 'b-infra', x: 20, y: 558, w: 940, h: 92, label: 'Platform & Delivery', c: LC.infra },
]
const NODES: N[] = [
  { id: 'orb', x: 402, y: 26, label: 'CEO-Orb', sub: 'Arganta OS · kernel', c: LC.ctrl },
  { id: 'clevel', x: 402, y: 118, label: 'C-level · 6 offices', sub: 'CEO·COO·CTO·CFO·GC·CAPO', c: LC.ctrl },
  { id: 'arganta', x: 92, y: 244, label: 'ArgantaLab', sub: 'learn · diamonds · games', c: LC.ui },
  { id: 'kinetik', x: 402, y: 244, label: 'KinetikCircle', sub: 'circles · moments · calendar', c: LC.ui },
  { id: 'lashira', x: 712, y: 244, label: 'LashiraBloom', sub: 'circle farm · MVP', c: LC.ui },
  { id: 'agentos', x: 232, y: 356, label: 'Agent OS · 27', sub: 'Sense→Compute→Match→Generate', c: LC.agent },
  { id: 'aiml', x: 542, y: 356, label: 'AI / ML + Builders', sub: 'MCP → Claude · OpenAI', c: LC.aiml },
  { id: 'vault', x: 232, y: 468, label: 'Vault', sub: 'knowledge base', c: LC.data },
  { id: 'postgres', x: 542, y: 468, label: 'PostgreSQL', sub: '100+ tables · the base', c: LC.data },
  { id: 'baas', x: 232, y: 580, label: 'Backend-as-a-Service', sub: 'tool ⇄ Supabase', c: LC.infra },
  { id: 'edge', x: 542, y: 580, label: 'Edge Hosting & CDN', sub: 'tool ⇄ Vercel', c: LC.infra },
  { id: 'rag', x: 752, y: 356, label: 'Vector-RAG', sub: 'retrieval', c: LC.aiml, next: true },
  { id: 'vector', x: 752, y: 468, label: 'pgvector', sub: 'embeddings', c: LC.data, next: true },
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
  { id: 'l1', x: 392, y: 24, label: '① Visualization / UI', sub: '3 apps · React · TypeScript · Vite', c: LC.ui },
  { id: 'l2', x: 392, y: 134, label: '② Agent OS', sub: '27 · deterministic → MCP', c: LC.agent },
  { id: 'l3', x: 392, y: 244, label: '③ AI / ML + Builders', sub: 'Claude · OpenAI · TensorFlow.js', c: LC.aiml },
  { id: 'l4', x: 392, y: 354, label: '④ Data · PostgreSQL', sub: 'the base · big data', c: LC.data },
  { id: 'l5', x: 392, y: 464, label: '⑤ Infra · Edge', sub: 'BaaS ⇄ Supabase · CDN ⇄ Vercel', c: LC.infra },
  { id: 'lnext', x: 392, y: 574, label: 'RAG · vector · embeddings', sub: 'NEXT — toggle Future', c: LC.aiml, next: true },
]
const SIMPLE_E: E[] = [{ s: 'l1', t: 'l2' }, { s: 'l2', t: 'l3' }, { s: 'l3', t: 'l4' }, { s: 'l4', t: 'l5' }, { s: 'l5', t: 'lnext', next: true }]

function toFlow(nodes: N[], edges: E[], showNext: boolean, bands: boolean): { nodes: Node[]; edges: Edge[] } {
  const bandNodes: Node[] = bands ? BANDS.map(b => ({
    id: b.id, type: 'band', position: { x: b.x, y: b.y }, data: { label: b.label, c: b.c } as BandData,
    style: { width: b.w, height: b.h }, draggable: false, selectable: false, zIndex: 0,
  } as Node)) : []
  const cards = nodes.filter(n => showNext || !n.next).map(n => ({
    id: n.id, type: 'card', position: { x: n.x, y: n.y }, zIndex: 1,
    data: { label: n.label, sub: n.sub, c: n.c, next: n.next } as CardData,
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
