import { useCallback, useMemo, useRef, useState } from 'react'
import { AGENTS, TIER_META, MODEL_META, type Tier } from '../data/agents'

// A real, pannable / zoomable organizational chart — bespoke SVG (no chart dep).
// Laid out top-down: CEO → COO → C-suite → five department columns, wired from the
// live `reportsTo` graph. viewBox + preserveAspectRatio auto-fits any screen; drag
// to pan, wheel / pinch / buttons to zoom — so all 26 agents fit + explore on mobile.
const COLS: Tier[] = ['argantalab', 'kinetik', 'growth', 'platform', 'brand']
const COLW = 210
const CSUITE = ['cpo', 'cto', 'cfo', 'gc']
const NW = 176, NH = 38, NH_CEO = 46, PAD = 34

interface ONode { id: string; x: number; y: number; w: number; h: number; name: string; accent: string; dot: string; ceo?: boolean; exec?: boolean }
interface OEdge { from: string; to: string }

function build() {
  const byId = Object.fromEntries(AGENTS.map(a => [a.id, a]))
  const nodes: ONode[] = []
  const edges: OEdge[] = []
  const add = (id: string, x: number, y: number, extra: { ceo?: boolean; exec?: boolean } = {}) => {
    const a = byId[id]
    nodes.push({ id, x, y, w: NW, h: extra.ceo ? NH_CEO : NH, name: a.name, accent: TIER_META[a.tier].accent, dot: MODEL_META[a.model].fg, ...extra })
  }
  const centerX = ((COLS.length - 1) * COLW) / 2 - (NW - COLW) / 2
  add('ceo', centerX, 0, { ceo: true })
  add('coo', centerX, 128, { exec: true })
  edges.push({ from: 'ceo', to: 'coo' })
  CSUITE.forEach((id, i) => {
    const x = centerX + (i - (CSUITE.length - 1) / 2) * 220
    add(id, x, 270, { exec: true })
    edges.push({ from: 'coo', to: id })
  })
  COLS.forEach((tier, ci) => {
    const members = AGENTS.filter(a => a.tier === tier)
    const head = members[0]
    const x = ci * COLW
    members.forEach((m, mi) => add(m.id, x, 410 + mi * 84))
    if (head.reportsTo) edges.push({ from: head.reportsTo, to: head.id })
    members.slice(1).forEach(m => edges.push({ from: head.id, to: m.id }))
  })

  const minX = Math.min(...nodes.map(n => n.x)) - PAD
  const minY = Math.min(...nodes.map(n => n.y)) - PAD
  const maxX = Math.max(...nodes.map(n => n.x + n.w)) + PAD
  const maxY = Math.max(...nodes.map(n => n.y + n.h)) + PAD
  return { nodes, edges, byId: Object.fromEntries(nodes.map(n => [n.id, n])), fit: { x: minX, y: minY, w: maxX - minX, h: maxY - minY } }
}

function edgePath(s: ONode, t: ONode) {
  const sx = s.x + s.w / 2, sy = s.y + s.h, tx = t.x + t.w / 2, ty = t.y
  const my = (sy + ty) / 2
  return `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`
}

const MINW = 260, MAXW = 2400  // viewBox width clamps (zoom range)

export default function OrgFlow() {
  const { nodes, edges, byId, fit } = useMemo(build, [])
  const [vb, setVb] = useState(fit)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const pinch = useRef<{ d: number; w: number } | null>(null)

  const rectW = () => svgRef.current?.getBoundingClientRect().width || 1

  const zoomBy = useCallback((factor: number) => setVb(v => {
    const nw = Math.min(MAXW, Math.max(MINW, v.w * factor))
    const nh = nw * (v.h / v.w)
    return { x: v.x + (v.w - nw) / 2, y: v.y + (v.h - nh) / 2, w: nw, h: nh }
  }), [])

  const onWheel = (e: React.WheelEvent) => {
    e.stopPropagation()  // don't let the About pager hijack the wheel over the chart
    zoomBy(e.deltaY > 0 ? 1.12 : 0.89)
  }
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' && pinch.current) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const scale = vb.w / rectW()
    setVb(v => ({ ...v, x: drag.current!.vx - (e.clientX - drag.current!.x) * scale, y: drag.current!.vy - (e.clientY - drag.current!.y) * scale }))
  }
  const endDrag = () => { drag.current = null }

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY
      pinch.current = { d: Math.hypot(dx, dy), w: vb.w }
      drag.current = null
    }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinch.current) {
      e.stopPropagation()
      const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY
      const d = Math.hypot(dx, dy)
      const nw = Math.min(MAXW, Math.max(MINW, pinch.current.w * (pinch.current.d / d)))
      setVb(v => { const nh = nw * (v.h / v.w); return { x: v.x + (v.w - nw) / 2, y: v.y + (v.h - nh) / 2, w: nw, h: nh } })
    }
  }
  const onTouchEnd = (e: React.TouchEvent) => { if (e.touches.length < 2) pinch.current = null }

  return (
    <div className="orgflow">
      <svg ref={svgRef} className="orgflow-svg" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid meet"
        onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerLeave={endDrag}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <g className="orgflow-edges">
          {edges.map((e, i) => {
            const s = byId[e.from], t = byId[e.to]
            return s && t ? <path key={i} className="orgflow-edge" d={edgePath(s, t)} style={{ ['--ed' as string]: i * 0.03 + 's' }} /> : null
          })}
        </g>
        {nodes.map(n => (
          <foreignObject key={n.id} x={n.x} y={n.y} width={n.w} height={n.h} className="orgflow-node">
            <div className={`ofn${n.ceo ? ' ceo' : ''}${n.exec ? ' exec' : ''}`} style={{ ['--tc' as string]: n.accent }}>
              <b>{n.name}</b>
              <i className="ofn-dot" style={{ background: n.dot }} />
            </div>
          </foreignObject>
        ))}
      </svg>
      <div className="orgflow-ctrl">
        <button onClick={() => zoomBy(0.8)} aria-label="Zoom in">+</button>
        <button onClick={() => zoomBy(1.25)} aria-label="Zoom out">−</button>
        <button onClick={() => setVb(fit)} aria-label="Fit" title="Fit">⤢</button>
      </div>
      <span className="orgflow-hint">drag · scroll / pinch to zoom</span>
    </div>
  )
}
