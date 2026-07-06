// HQ Vault — graph view. A custom SVG force-directed constellation of the
// vault: product-colored nodes, wikilink edges, zoom/pan, drag, hover preview,
// filters and a selection inspector. Dependency-free by design.

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Maximize2, Minus, Plus, EyeOff, Eye, X, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { useVault } from '../store'
import { buildGraph, createSim, tickSim, reheat, type Sim, type SimNode } from '../graph'
import { wordCount } from '../markdown'
import type { Product } from '../types'
import { PRODUCTS, PRODUCT_COLOR } from '../types'

interface XF { x: number; y: number; k: number }

export function GraphView() {
  const notes = useVault(s => s.notes)
  const index = useVault(s => s.index)
  const active = useVault(s => s.active)
  const openNote = useVault(s => s.openNote)
  const density = useVault(s => s.settings.graphDensity)

  const [productFilter, setProductFilter] = useState<Product | 'all'>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [showOrphans, setShowOrphans] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null)
  const [, setFrame] = useState(0)

  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const simRef = useRef<Sim | null>(null)
  const xfRef = useRef<XF>({ x: 0, y: 0, k: 1 })
  const sizeRef = useRef({ w: 900, h: 600 })
  const dragRef = useRef<{ node?: SimNode; panning?: boolean; sx: number; sy: number; ox: number; oy: number } | null>(null)

  const allTags = useMemo(() => {
    const t = new Set<string>()
    for (const n of Object.values(notes)) for (const tag of n.fm.tags) t.add(tag)
    return [...t].sort()
  }, [notes])

  const graph = useMemo(() => {
    const g = buildGraph(notes, index)
    let nodes = g.nodes
    if (productFilter !== 'all') nodes = nodes.filter(n => n.product === productFilter)
    if (tagFilter !== 'all') nodes = nodes.filter(n => n.tags.includes(tagFilter))
    if (!showOrphans) nodes = nodes.filter(n => !n.orphan)
    const keep = new Set(nodes.map(n => n.id))
    return { nodes, edges: g.edges.filter(e => keep.has(e.source) && keep.has(e.target)) }
  }, [notes, index, productFilter, tagFilter, showOrphans])

  const nodeMeta = useMemo(() => new Map(graph.nodes.map(n => [n.id, n])), [graph])
  const neighborSet = useMemo(() => {
    const focus = selected || hover?.id
    if (!focus) return null
    const s = new Set<string>([focus])
    for (const e of graph.edges) {
      if (e.source === focus) s.add(e.target)
      if (e.target === focus) s.add(e.source)
    }
    return s
  }, [graph, selected, hover])

  // (re)build the simulation when the visible graph changes; keep old positions.
  useEffect(() => {
    const { w, h } = sizeRef.current
    const prev = simRef.current
    const sim = createSim(graph, w, h)
    if (prev) for (const n of sim.nodes) {
      const old = prev.byId.get(n.id)
      if (old) { n.x = old.x; n.y = old.y }
    }
    sim.alpha = 1
    simRef.current = sim
  }, [graph])

  // measure + animation loop
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      sizeRef.current = { w: r.width, h: r.height }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    let raf = 0
    const loop = () => {
      const sim = simRef.current
      if (sim && sim.alpha > 0.003) {
        tickSim(sim, sizeRef.current.w, sizeRef.current.h, density)
        setFrame(f => f + 1)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [density])

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect()
    const { x, y, k } = xfRef.current
    return { x: (clientX - r.left - x) / k, y: (clientY - r.top - y) / k }
  }, [])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const r = svgRef.current!.getBoundingClientRect()
    const mx = e.clientX - r.left, my = e.clientY - r.top
    const xf = xfRef.current
    const nk = Math.min(3, Math.max(0.25, xf.k * (e.deltaY < 0 ? 1.12 : 0.89)))
    xf.x = mx - ((mx - xf.x) / xf.k) * nk
    xf.y = my - ((my - xf.y) / xf.k) * nk
    xf.k = nk
    setFrame(f => f + 1)
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const target = (e.target as Element).closest('[data-node]')
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    if (target) {
      const id = target.getAttribute('data-node')!
      const node = simRef.current?.byId.get(id)
      if (node) {
        node.fixed = true
        dragRef.current = { node, sx: e.clientX, sy: e.clientY, ox: node.x, oy: node.y }
        reheat(simRef.current!)
      }
    } else {
      dragRef.current = { panning: true, sx: e.clientX, sy: e.clientY, ox: xfRef.current.x, oy: xfRef.current.y }
    }
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current
    if (d?.node) {
      const w = toWorld(e.clientX, e.clientY)
      d.node.x = w.x; d.node.y = w.y
      reheat(simRef.current!, 0.35)
      setFrame(f => f + 1)
    } else if (d?.panning) {
      xfRef.current.x = d.ox + (e.clientX - d.sx)
      xfRef.current.y = d.oy + (e.clientY - d.sy)
      setFrame(f => f + 1)
    } else {
      const target = (e.target as Element).closest('[data-node]')
      if (target) {
        const id = target.getAttribute('data-node')!
        const r = wrapRef.current!.getBoundingClientRect()
        setHover({ id, x: e.clientX - r.left, y: e.clientY - r.top })
      } else setHover(null)
    }
  }, [toWorld])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current
    if (d?.node) {
      const moved = Math.hypot(e.clientX - d.sx, e.clientY - d.sy)
      d.node.fixed = false
      if (moved < 5) setSelected(sel => sel === d.node!.id ? null : d.node!.id)
    } else if (d?.panning) {
      const moved = Math.hypot(e.clientX - d.sx, e.clientY - d.sy)
      if (moved < 4) setSelected(null)
    }
    dragRef.current = null
  }, [])

  const zoomBy = (f: number) => {
    const { w, h } = sizeRef.current
    const xf = xfRef.current
    const nk = Math.min(3, Math.max(0.25, xf.k * f))
    xf.x = w / 2 - ((w / 2 - xf.x) / xf.k) * nk
    xf.y = h / 2 - ((h / 2 - xf.y) / xf.k) * nk
    xf.k = nk
    setFrame(fr => fr + 1)
  }
  const resetView = () => { xfRef.current = { x: 0, y: 0, k: 1 }; if (simRef.current) reheat(simRef.current, 0.8); setFrame(f => f + 1) }

  const sim = simRef.current
  const xf = xfRef.current
  const selNote = selected ? notes[selected] : null

  return (
    <div className="vg" ref={wrapRef}>
      {/* Filter bar */}
      <div className="vg-bar">
        <div className="vg-chips">
          <button className={'vg-chip' + (productFilter === 'all' ? ' on' : '')} onClick={() => setProductFilter('all')}>All</button>
          {PRODUCTS.map(p => (
            <button key={p} className={'vg-chip' + (productFilter === p ? ' on' : '')}
              style={productFilter === p ? { borderColor: PRODUCT_COLOR[p], color: PRODUCT_COLOR[p] } : undefined}
              onClick={() => setProductFilter(f => f === p ? 'all' : p)}>
              <span className="vp-dot" style={{ background: PRODUCT_COLOR[p] }} />{p}
            </button>
          ))}
        </div>
        <div className="vg-tools">
          <select className="vg-select" value={tagFilter} onChange={e => setTagFilter(e.target.value)} aria-label="Filter by tag">
            <option value="all">all tags</option>
            {allTags.map(t => <option key={t} value={t}>#{t}</option>)}
          </select>
          <button className={'vg-tool' + (showOrphans ? '' : ' on')} title={showOrphans ? 'Hide orphans' : 'Show orphans'}
            onClick={() => setShowOrphans(o => !o)}>
            {showOrphans ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <div className="vg-zoomers">
            <button className="vg-tool" onClick={() => zoomBy(0.82)} title="Zoom out"><Minus size={13} /></button>
            <span className="vg-zoomval">{Math.round(xf.k * 100)}%</span>
            <button className="vg-tool" onClick={() => zoomBy(1.22)} title="Zoom in"><Plus size={13} /></button>
            <button className="vg-tool" onClick={resetView} title="Reset view"><Maximize2 size={13} /></button>
          </div>
        </div>
      </div>

      <svg ref={svgRef} className="vg-svg"
        onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerLeave={() => setHover(null)}>
        <g transform={`translate(${xf.x},${xf.y}) scale(${xf.k})`}>
          {sim && sim.edges.map((e, i) => {
            const dim = neighborSet && !(neighborSet.has(e.a.id) && neighborSet.has(e.b.id))
            return (
              <line key={i} x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y}
                className={'vg-edge' + (dim ? ' dim' : '')} />
            )
          })}
          {sim && sim.nodes.map(n => {
            const meta = nodeMeta.get(n.id)
            if (!meta) return null
            const color = PRODUCT_COLOR[meta.product]
            const isActive = n.id === active
            const isSel = n.id === selected
            const dim = neighborSet && !neighborSet.has(n.id)
            return (
              <g key={n.id} data-node={n.id} transform={`translate(${n.x},${n.y})`}
                className={'vg-node' + (dim ? ' dim' : '') + (isSel ? ' sel' : '')}>
                {isActive && <circle r={n.r + 7} className="vg-halo" style={{ stroke: color }} />}
                <circle r={n.r} fill={color} className="vg-dot"
                  style={isSel ? { stroke: color } : undefined} />
                <text y={n.r + 13} className="vg-label">{meta.title}</text>
              </g>
            )
          })}
        </g>
      </svg>

      {/* Hover preview */}
      {hover && !dragRef.current && notes[hover.id] && hover.id !== selected && (
        <div className="vg-preview" style={{
          left: Math.min(hover.x + 16, sizeRef.current.w - 280),
          top: Math.min(hover.y + 14, sizeRef.current.h - 150),
        }}>
          <div className="vg-pv-t">
            <span className="vp-dot" style={{ background: PRODUCT_COLOR[notes[hover.id].fm.product] }} />
            {notes[hover.id].fm.title}
          </div>
          <div className="vg-pv-body">
            {notes[hover.id].body.replace(/^#.*$/m, '').replace(/[#>*\[\]`|-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150)}…
          </div>
          <div className="vg-pv-meta">
            {notes[hover.id].fm.type} · {(index.backlinks[hover.id] || []).length} in · {(index.outgoing[hover.id] || []).length} out
          </div>
        </div>
      )}

      {/* Selection inspector */}
      {selNote && (
        <div className="vg-inspect">
          <div className="vg-in-head">
            <span className="vp-dot" style={{ background: PRODUCT_COLOR[selNote.fm.product] }} />
            <span className="vg-in-t">{selNote.fm.title}</span>
            <button className="vg-tool" onClick={() => setSelected(null)}><X size={13} /></button>
          </div>
          <div className="vg-in-meta">
            <span className="v-badge">{selNote.fm.type}</span>
            <span className="v-badge">{selNote.fm.status}</span>
            <span className="v-badge">{wordCount(selNote.body)} words</span>
          </div>
          <div className="vg-in-links">
            <span><ArrowDownLeft size={11} /> {(index.backlinks[selNote.id] || []).length} backlinks</span>
            <span><ArrowUpRight size={11} /> {(index.outgoing[selNote.id] || []).length} outgoing</span>
          </div>
          {selNote.fm.tags.length > 0 && (
            <div className="vg-in-tags">{selNote.fm.tags.map(t => <span key={t} className="v-tag">#{t}</span>)}</div>
          )}
          <button className="vg-open" onClick={() => openNote(selNote.id)}>Open note</button>
        </div>
      )}

      {graph.nodes.length === 0 && (
        <div className="vg-empty">No notes match these filters.</div>
      )}
    </div>
  )
}
