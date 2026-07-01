import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow, Background, Controls, Handle, Position, useNodesState, useEdgesState, useUpdateNodeInternals,
  type Node, type Edge, type NodeProps, type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { AGENTS, TIER_META, MODEL_META, type Tier } from '../data/agents'

// A real, pannable/zoomable organizational chart (React Flow). Nodes are laid out
// top-down: CEO → COO → C-suite → five department columns, wired from the live
// `reportsTo` graph. fitView keeps the whole org visible + explorable on mobile.
const COLS: Tier[] = ['argantalab', 'kinetik', 'growth', 'platform', 'brand']
const COLW = 208
const CSUITE = ['cpo', 'cto', 'cfo', 'gc']
// explicit node sizes so React Flow skips ResizeObserver auto-measurement
// (which stalls under React 19 here, leaving nodes hidden + edges unrendered)
const NW = 176, NH = 36, NH_CEO = 42

interface AData { name: string; accent: string; dot: string; role: string; ceo?: boolean; exec?: boolean; [k: string]: unknown }

function AgentNode({ data }: NodeProps) {
  const d = data as AData
  return (
    <div className={`ofn${d.ceo ? ' ceo' : ''}${d.exec ? ' exec' : ''}`} style={{ ['--tc' as string]: d.accent }} title={d.role}>
      <Handle type="target" position={Position.Top} className="ofn-h" />
      <b>{d.name}</b>
      <i className="ofn-dot" style={{ background: d.dot }} />
      <Handle type="source" position={Position.Bottom} className="ofn-h" />
    </div>
  )
}
const nodeTypes = { agent: AgentNode }

function build(): { nodes: Node[]; edges: Edge[] } {
  const byId = Object.fromEntries(AGENTS.map(a => [a.id, a]))
  const nodes: Node[] = []
  const edges: Edge[] = []
  const add = (id: string, x: number, y: number, extra: Partial<AData> = {}) => {
    const a = byId[id]
    nodes.push({ id, type: 'agent', position: { x, y }, draggable: false, width: NW, height: extra.ceo ? NH_CEO : NH, data: { name: a.name, role: a.role, accent: TIER_META[a.tier].accent, dot: MODEL_META[a.model].fg, ...extra } })
  }
  const edge = (s: string, t: string) => edges.push({ id: `${s}-${t}`, source: s, target: t, type: 'smoothstep', style: { stroke: 'var(--of-edge)', strokeWidth: 1.5 } })

  const centerX = ((COLS.length - 1) * COLW) / 2
  add('ceo', centerX, 0, { ceo: true })
  add('coo', centerX, 122, { exec: true })
  edge('ceo', 'coo')
  CSUITE.forEach((id, i) => {
    const x = centerX + (i - (CSUITE.length - 1) / 2) * 224
    add(id, x, 256, { exec: true })
    edge('coo', id)
  })
  COLS.forEach((tier, ci) => {
    const members = AGENTS.filter(a => a.tier === tier)
    const head = members[0]
    const x = ci * COLW
    members.forEach((m, mi) => add(m.id, x, 392 + mi * 82))
    if (head.reportsTo) edge(head.reportsTo, head.id)
    members.slice(1).forEach(m => edge(head.id, m.id))
  })
  return { nodes, edges }
}

export default function OrgFlow() {
  const built = useMemo(build, [])
  const [nodes, , onNodesChange] = useNodesState(built.nodes)
  const [edges, , onEdgesChange] = useEdgesState(built.edges)
  const inst = useRef<ReactFlowInstance | null>(null)
  const updateNodeInternals = useUpdateNodeInternals()
  const onInit = useCallback((i: ReactFlowInstance) => {
    inst.current = i
    // re-fit shortly after mount (container height settles after the panel transition)
    setTimeout(() => i.fitView({ padding: 0.14, duration: 300 }), 60)
  }, [])
  // StrictMode (dev) double-mount disconnects RF's ResizeObserver → handle bounds
  // never register → edges don't paint. Force a handle re-measure after mount.
  useEffect(() => {
    const t = setTimeout(() => built.nodes.forEach(n => updateNodeInternals(n.id)), 150)
    return () => clearTimeout(t)
  }, [built, updateNodeInternals])

  return (
    <div className="orgflow">
      <ReactFlow
        nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onInit={onInit} fitView fitViewOptions={{ padding: 0.14 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        zoomOnScroll={false} panOnScroll={false} preventScrolling={false}
        zoomOnPinch panOnDrag minZoom={0.14} maxZoom={1.6}
      >
        <Background gap={22} size={1} color="var(--of-dot)" />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
      <span className="orgflow-hint">drag · pinch to explore</span>
    </div>
  )
}
