import { useMemo, useState } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap, Handle, Position, BackgroundVariant,
  type Node, type Edge, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useHQ } from '../shell/store'

// Architecture Map — the Arganta OS backbone as a React Flow graph with premium
// custom nodes (clean cards, no emoji). 3 views: Simple · Current · Future.

type View = 'simple' | 'current' | 'future'
const LC = { ui: '#6366f1', agent: '#ff3d72', aiml: '#0d9488', data: '#8b5cf6', infra: '#64748b', ctrl: '#4338ca' }

interface CardData { label: string; sub?: string; c: string; next?: boolean; [k: string]: unknown }

function CardNode({ data }: NodeProps) {
  const d = data as CardData
  return (
    <div style={{
      width: 176, borderRadius: 11, background: 'var(--bg)', color: 'var(--tx)',
      border: `1px solid ${d.next ? 'transparent' : 'var(--bd2)'}`, borderLeft: `3px solid ${d.c}`,
      outline: d.next ? `1px dashed ${d.c}` : 'none', outlineOffset: -1,
      padding: '9px 12px', boxShadow: 'var(--shadow-sm)', opacity: d.next ? 0.9 : 1,
    }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div style={{ fontWeight: 700, fontSize: 12.5, lineHeight: 1.2 }}>{d.label}</div>
      {d.sub && <div style={{ fontSize: 9.5, color: 'var(--tx3)', marginTop: 3 }}>{d.sub}</div>}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}
const nodeTypes = { card: CardNode }

interface N { id: string; x: number; y: number; label: string; sub?: string; c: string; next?: boolean }
interface E { s: string; t: string; next?: boolean }

const NODES: N[] = [
  { id: 'orb', x: 440, y: 0, label: 'CEO-Orb', sub: 'Arganta OS · kernel', c: LC.ctrl },
  { id: 'clevel', x: 440, y: 100, label: 'C-level · 6 offices', sub: 'CEO·COO·CTO·CFO·GC·CAPO', c: LC.ctrl },
  { id: 'arganta', x: 140, y: 210, label: 'ArgantaLab', sub: 'learn · diamonds · games', c: LC.ui },
  { id: 'kinetik', x: 440, y: 210, label: 'KinetikCircle', sub: 'circles · moments · calendar', c: LC.ui },
  { id: 'lashira', x: 740, y: 210, label: 'LashiraBloom', sub: 'circle farm · MVP', c: LC.ui },
  { id: 'agentos', x: 290, y: 330, label: 'Agent OS · 27', sub: 'Sense→Compute→Match→Generate', c: LC.agent },
  { id: 'aiml', x: 590, y: 330, label: 'AI / ML + Builders', sub: 'MCP → Claude · OpenAI', c: LC.aiml },
  { id: 'vault', x: 290, y: 450, label: 'Vault', sub: 'knowledge base', c: LC.data },
  { id: 'postgres', x: 590, y: 450, label: 'PostgreSQL', sub: '100+ tables · the base', c: LC.data },
  { id: 'baas', x: 290, y: 560, label: 'Backend-as-a-Service', sub: 'tool ⇄ Supabase', c: LC.infra },
  { id: 'edge', x: 590, y: 560, label: 'Edge Hosting & CDN', sub: 'tool ⇄ Vercel', c: LC.infra },
  { id: 'rag', x: 850, y: 330, label: 'Vector-RAG', sub: 'retrieval', c: LC.aiml, next: true },
  { id: 'vector', x: 850, y: 450, label: 'pgvector', sub: 'embeddings', c: LC.data, next: true },
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
  { id: 'l1', x: 400, y: 20, label: '① Visualization / UI', sub: '3 apps · React · TypeScript · Vite', c: LC.ui },
  { id: 'l2', x: 400, y: 130, label: '② Agent OS', sub: '27 · deterministic → MCP', c: LC.agent },
  { id: 'l3', x: 400, y: 240, label: '③ AI / ML + Builders', sub: 'Claude · OpenAI · TensorFlow.js', c: LC.aiml },
  { id: 'l4', x: 400, y: 350, label: '④ Data · PostgreSQL', sub: 'the base · big data', c: LC.data },
  { id: 'l5', x: 400, y: 460, label: '⑤ Infra · Edge', sub: 'BaaS ⇄ Supabase · CDN ⇄ Vercel', c: LC.infra },
  { id: 'lnext', x: 400, y: 570, label: 'RAG · vector · embeddings', sub: 'NEXT — toggle Future', c: LC.aiml, next: true },
]
const SIMPLE_E: E[] = [{ s: 'l1', t: 'l2' }, { s: 'l2', t: 'l3' }, { s: 'l3', t: 'l4' }, { s: 'l4', t: 'l5' }, { s: 'l5', t: 'lnext', next: true }]

function toFlow(nodes: N[], edges: E[], showNext: boolean): { nodes: Node[]; edges: Edge[] } {
  const ns = nodes.filter(n => showNext || !n.next).map(n => ({
    id: n.id, type: 'card', position: { x: n.x, y: n.y },
    data: { label: n.label, sub: n.sub, c: n.c, next: n.next } as CardData,
  } as Node))
  const es = edges.filter(e => showNext || !e.next).map((e, i) => ({
    id: 'e' + i, source: e.s, target: e.t, animated: !e.next,
    style: { stroke: e.next ? LC.aiml : 'var(--bd3)', strokeWidth: 1.5, strokeDasharray: e.next ? '6 4' : undefined },
  } as Edge))
  return { nodes: ns, edges: es }
}

const LEGEND: [string, string][] = [['UI', LC.ui], ['Agent', LC.agent], ['AI/ML', LC.aiml], ['Data', LC.data], ['Infra', LC.infra]]

export function Architecture() {
  const { theme } = useHQ()
  const [view, setView] = useState<View>('current')
  const showNext = view === 'future'
  const { nodes, edges } = useMemo(() => (
    view === 'simple' ? toFlow(SIMPLE, SIMPLE_E, true) : toFlow(NODES, EDGES, showNext)
  ), [view, showNext])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '16px 20px 18px', boxSizing: 'border-box' }}>
      <div className="spread" style={{ padding: '0 0 12px', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="h1">Architecture</div>
          <div className="sub">Arganta OS backbone · one graph, three views · <b>NOW</b> solid / <b>NEXT</b> dashed</div>
        </div>
        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, background: 'var(--bg3)', border: '1px solid var(--bd2)' }}>
          {(['simple', 'current', 'future'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              textTransform: 'capitalize', fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 999,
              cursor: 'pointer', border: 'none', fontFamily: 'inherit',
              background: view === v ? 'var(--acc)' : 'transparent', color: view === v ? '#fff' : 'var(--tx2)',
            }}>{v}</button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--bd2)', background: 'var(--bg2)', position: 'relative' }}>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.15 }}
          proOptions={{ hideAttribution: true }} colorMode={theme === 'dark' ? 'dark' : 'light'} minZoom={0.35} nodesConnectable={false}>
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable maskColor="rgba(0,0,0,.05)" nodeColor={(n) => ((n.data as CardData)?.c) || '#6366f1'} />
        </ReactFlow>
        <div style={{ position: 'absolute', left: 12, top: 12, display: 'flex', gap: 12, padding: '7px 12px', borderRadius: 9, background: 'var(--glass)', border: '1px solid var(--glass-bd)', backdropFilter: 'blur(8px)', fontSize: 10, zIndex: 5 }}>
          {LEGEND.map(([l, c]) => <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--tx2)' }}><span style={{ width: 9, height: 9, borderRadius: 3, background: c }} />{l}</span>)}
        </div>
      </div>
    </div>
  )
}
