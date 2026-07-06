// HQ Vault — Knowledge Graph. Canvas-2D force graph of the founder brain map.
//
// Design decisions (see KNOWLEDGE_GRAPH_REVIEW.md for the full self-review):
// - Canvas 2D instead of SVG/React-per-frame: one draw call per frame keeps
//   1k nodes / 2.5k edges smooth; SVG DOM diffing dies around ~300 nodes.
// - Custom sim instead of sigma.js/G6: zero deps at the current vault scale;
//   the data model (GraphNode/GraphEdge/SuggestedEdge) is renderer-agnostic so
//   sigma can be dropped in behind the same props when the vault outgrows this.
// - Suggested connections (dotted) are heuristic today (shared tags, unlinked
//   mentions) and use the future agent contract: source/target/weight/reason.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Maximize2, Minus, Plus, EyeOff, Eye, X, ArrowUpRight, ArrowDownLeft, Search,
  Type as TypeIcon, Spline, Sparkles, Crosshair, FileText, Frame, LocateFixed,
} from 'lucide-react'
import { useVault } from '../store'
import {
  buildGraph, buildSuggestedEdges, createSim, tickSim, reheat,
  type Sim, type SimNode, type SuggestedEdge,
} from '../graph'
import { wordCount, tokenizeBlocks } from '../markdown'
import type { Product, NoteType, GraphNode, GraphEdge } from '../types'
import { PRODUCTS, PRODUCT_COLOR } from '../types'

interface XF { x: number; y: number; k: number }
interface GraphData { nodes: GraphNode[]; edges: GraphEdge[]; suggested: SuggestedEdge[] }

const NODE_TYPES: (NoteType | 'all')[] = ['all', 'note', 'strategy', 'decision', 'prompt', 'research', 'plan', 'spec']

// ---- stress harness: /?vaultStress=1000 renders a synthetic graph so the
// engine can be battle-tested beyond the real vault's size. Render-only, never
// persisted. ----
function synthGraph(n: number): GraphData {
  const nodes: GraphNode[] = Array.from({ length: n }, (_, i) => ({
    id: 's' + i,
    title: i % 23 === 0
      ? `Synthetic ${i} — deliberately overlong title to battle-test label truncation in the canvas`
      : 'Synthetic note ' + i,
    product: PRODUCTS[i % PRODUCTS.length], type: 'note', tags: ['stress'],
    linkCount: 0, orphan: false,
  }))
  const edges: GraphEdge[] = []
  for (let i = 1; i < n; i++) {
    edges.push({ source: 's' + i, target: 's' + Math.floor(Math.random() * i) })
    if (i > 2) edges.push({ source: 's' + i, target: 's' + Math.floor(Math.random() * i) })
    if (Math.random() < 0.5) edges.push({ source: 's' + i, target: 's' + Math.floor(Math.random() * i) })
  }
  const deg: Record<string, number> = {}
  for (const e of edges) { deg[e.source] = (deg[e.source] || 0) + 1; deg[e.target] = (deg[e.target] || 0) + 1 }
  for (const nd of nodes) { nd.linkCount = deg[nd.id] || 0; nd.orphan = !deg[nd.id] }
  return { nodes, edges, suggested: [] }
}

/** First non-heading paragraph of a note, for the inspector summary. */
function noteSummary(body: string): string {
  for (const b of tokenizeBlocks(body)) {
    if (b.kind === 'p') {
      const plain = b.text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, t, a) => a || t)
        .replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim()
      if (plain) return plain.length > 170 ? plain.slice(0, 170) + '…' : plain
    }
  }
  return ''
}

export function GraphView() {
  const notes = useVault(s => s.notes)
  const index = useVault(s => s.index)
  const active = useVault(s => s.active)
  const openNote = useVault(s => s.openNote)
  const addCanvasCard = useVault(s => s.addCanvasCard)
  const setCenterView = useVault(s => s.setCenterView)
  const density = useVault(s => s.settings.graphDensity)

  // filters + view state
  const [pillar, setPillar] = useState<Product | 'all'>('all')
  const [typeF, setTypeF] = useState<NoteType | 'all'>('all')
  const [tagF, setTagF] = useState<string>('all')
  const [showOrphans, setShowOrphans] = useState(true)
  const [showLabels, setShowLabels] = useState(true)
  const [showLinks, setShowLinks] = useState(true)
  const [showSuggested, setShowSuggested] = useState(true)
  const [local, setLocal] = useState<{ focus: string; depth: 1 | 2 | 3 } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null)
  const [q, setQ] = useState('')
  const [searchFocus, setSearchFocus] = useState(false)
  const [zoomPct, setZoomPct] = useState(100)

  const stress = useMemo(() => {
    const v = parseInt(new URLSearchParams(window.location.search).get('vaultStress') || '0', 10)
    return Number.isFinite(v) && v > 0 ? Math.min(v, 5000) : 0
  }, [])

  const base = useMemo<GraphData>(() => {
    if (stress) return synthGraph(stress)
    const g = buildGraph(notes, index)
    return { ...g, suggested: buildSuggestedEdges(notes, index) }
  }, [notes, index, stress])

  const allTags = useMemo(() => {
    const t = new Set<string>()
    for (const n of base.nodes) for (const tag of n.tags) t.add(tag)
    return [...t].sort()
  }, [base])

  // visible graph = base → filters → optional local BFS neighborhood
  const graph = useMemo<GraphData>(() => {
    let nodes = base.nodes
    if (pillar !== 'all') nodes = nodes.filter(n => n.product === pillar)
    if (typeF !== 'all') nodes = nodes.filter(n => n.type === typeF)
    if (tagF !== 'all') nodes = nodes.filter(n => n.tags.includes(tagF))
    if (!showOrphans) nodes = nodes.filter(n => !n.orphan)
    let keep = new Set(nodes.map(n => n.id))

    if (local && keep.has(local.focus)) {
      const adj = new Map<string, string[]>()
      for (const e of base.edges) {
        if (!keep.has(e.source) || !keep.has(e.target)) continue
        if (!adj.has(e.source)) adj.set(e.source, [])
        if (!adj.has(e.target)) adj.set(e.target, [])
        adj.get(e.source)!.push(e.target)
        adj.get(e.target)!.push(e.source)
      }
      const hood = new Set<string>([local.focus])
      let frontier = [local.focus]
      for (let d = 0; d < local.depth; d++) {
        const next: string[] = []
        for (const id of frontier) for (const nb of adj.get(id) || []) {
          if (!hood.has(nb)) { hood.add(nb); next.push(nb) }
        }
        frontier = next
      }
      nodes = nodes.filter(n => hood.has(n.id))
      keep = hood
    }

    return {
      nodes,
      edges: base.edges.filter(e => keep.has(e.source) && keep.has(e.target)),
      suggested: base.suggested.filter(e => keep.has(e.source) && keep.has(e.target)),
    }
  }, [base, pillar, typeF, tagF, showOrphans, local])

  const nodeMeta = useMemo(() => new Map(graph.nodes.map(n => [n.id, n])), [graph])

  const searchHits = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return []
    return graph.nodes.filter(n => n.title.toLowerCase().includes(needle)).slice(0, 8)
  }, [q, graph])

  // focus set for neighborhood highlighting (hover wins over selection)
  const focusId = hover?.id || selected
  const focusSet = useMemo(() => {
    if (!focusId) return null
    const s = new Set<string>([focusId])
    for (const e of graph.edges) {
      if (e.source === focusId) s.add(e.target)
      if (e.target === focusId) s.add(e.source)
    }
    if (showSuggested) for (const e of graph.suggested) {
      if (e.source === focusId) s.add(e.target)
      if (e.target === focusId) s.add(e.source)
    }
    return s
  }, [focusId, graph, showSuggested])

  // ---- refs driving the imperative canvas loop ----
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<Sim | null>(null)
  const xfRef = useRef<XF>({ x: 0, y: 0, k: 1 })
  const sizeRef = useRef({ w: 900, h: 600 })
  const dragRef = useRef<{ node?: SimNode; panning?: boolean; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null)
  const tweenRef = useRef<{ fx: number; fy: number; fk: number; tx: number; ty: number; tk: number; t0: number } | null>(null)
  const starsRef = useRef<{ x: number; y: number; r: number; p: number; a: number }[]>([])
  const colorsRef = useRef({ edge: '#31313d', label: '#9d9aad', labelHalo: '#191920', acc: '#6366f1', dim: 0.14 })
  const frameMsRef = useRef(0)
  const stateRef = useRef({ graph, focusSet, focusId, selected, active, showLabels, showLinks, showSuggested, stress, nodeMeta })
  stateRef.current = { graph, focusSet, focusId, selected, active, showLabels, showLinks, showSuggested, stress, nodeMeta }

  if (starsRef.current.length === 0) {
    starsRef.current = Array.from({ length: 150 }, () => ({
      x: Math.random(), y: Math.random(), r: Math.random() * 1.3 + 0.3,
      p: Math.random() * 0.08 + 0.02, a: Math.random() * 0.14 + 0.04,
    }))
  }

  // (re)build sim when the visible graph changes, preserving prior positions
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

  const refreshColors = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const cs = getComputedStyle(el)
    colorsRef.current = {
      edge: cs.getPropertyValue('--v-bd2').trim() || '#31313d',
      label: cs.getPropertyValue('--v-tx2').trim() || '#9d9aad',
      labelHalo: cs.getPropertyValue('--v-bg2').trim() || '#191920',
      acc: cs.getPropertyValue('--v-acc').trim() || '#6366f1',
      dim: 0.14,
    }
  }, [])

  // ---- the render loop ----
  useEffect(() => {
    const el = wrapRef.current
    const canvas = canvasRef.current
    if (!el || !canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(2, window.devicePixelRatio || 1)

    const measure = () => {
      const r = el.getBoundingClientRect()
      sizeRef.current = { w: r.width, h: r.height }
      canvas.width = Math.max(1, Math.round(r.width * dpr))
      canvas.height = Math.max(1, Math.round(r.height * dpr))
      canvas.style.width = r.width + 'px'
      canvas.style.height = r.height + 'px'
    }
    measure()
    refreshColors()
    const ro = new ResizeObserver(measure)
    ro.observe(el)

    let raf = 0
    let frame = 0
    const loop = () => {
      const t0 = performance.now()
      frame++
      if (frame % 40 === 0) refreshColors()

      // camera tween
      const tw = tweenRef.current
      if (tw) {
        const t = Math.min(1, (performance.now() - tw.t0) / 380)
        const e = 1 - Math.pow(1 - t, 3)
        xfRef.current = { x: tw.fx + (tw.tx - tw.fx) * e, y: tw.fy + (tw.ty - tw.fy) * e, k: tw.fk + (tw.tk - tw.fk) * e }
        if (t >= 1) { tweenRef.current = null; setZoomPct(Math.round(xfRef.current.k * 100)) }
      }

      const sim = simRef.current
      const { w, h } = sizeRef.current
      if (sim && sim.alpha > 0.003) tickSim(sim, w, h, density)

      // ---- draw ----
      const st = stateRef.current
      const C = colorsRef.current
      const xf = xfRef.current
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      // starfield with soft parallax
      for (const s of starsRef.current) {
        const sx = (s.x * w + xf.x * s.p + w) % w
        const sy = (s.y * h + xf.y * s.p + h) % h
        ctx.globalAlpha = s.a
        ctx.fillStyle = C.label
        ctx.fillRect(sx, sy, s.r, s.r)
      }
      ctx.globalAlpha = 1

      if (sim) {
        ctx.save()
        ctx.translate(xf.x, xf.y)
        ctx.scale(xf.k, xf.k)

        // real edges
        if (st.showLinks) {
          ctx.lineWidth = 1.1
          for (const e of sim.edges) {
            const inFocus = !st.focusSet || (st.focusSet.has(e.a.id) && st.focusSet.has(e.b.id) &&
              (e.a.id === st.focusId || e.b.id === st.focusId))
            ctx.globalAlpha = st.focusSet ? (inFocus ? 0.85 : 0.05) : 0.5
            ctx.strokeStyle = inFocus && st.focusSet ? C.acc : C.edge
            ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y); ctx.stroke()
          }
        }
        // suggested edges — dotted, accent-tinted (the agent layer)
        if (st.showSuggested && st.graph.suggested.length) {
          ctx.setLineDash([3, 4])
          ctx.lineWidth = 1
          for (const e of st.graph.suggested) {
            const a = sim.byId.get(e.source), b = sim.byId.get(e.target)
            if (!a || !b) continue
            const touched = st.focusId && (e.source === st.focusId || e.target === st.focusId)
            ctx.globalAlpha = st.focusSet ? (touched ? 0.9 : 0.04) : 0.3
            ctx.strokeStyle = C.acc
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
          }
          ctx.setLineDash([])
        }

        // nodes
        const glowOk = sim.nodes.length <= 400
        for (const n of sim.nodes) {
          const meta = st.nodeMeta.get(n.id)
          if (!meta) continue
          const color = PRODUCT_COLOR[meta.product]
          const dimmed = st.focusSet && !st.focusSet.has(n.id)
          ctx.globalAlpha = dimmed ? C.dim : 1

          if (glowOk && !dimmed && (meta.linkCount >= 6 || n.id === st.focusId)) {
            ctx.shadowColor = color; ctx.shadowBlur = 16
          }
          ctx.fillStyle = color
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill()
          ctx.shadowBlur = 0

          if (n.id === st.active && !st.stress) {
            ctx.globalAlpha = dimmed ? C.dim : 0.65
            ctx.strokeStyle = color
            ctx.lineWidth = 1.4
            ctx.setLineDash([3, 3])
            ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 6, 0, Math.PI * 2); ctx.stroke()
            ctx.setLineDash([])
          }
          if (n.id === st.selected) {
            ctx.globalAlpha = 1
            ctx.strokeStyle = C.acc
            ctx.lineWidth = 2 / xf.k
            ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 3.5, 0, Math.PI * 2); ctx.stroke()
          }
        }

        // labels — constant screen size, halo for legibility
        if (st.showLabels) {
          ctx.font = `${11 / xf.k}px ui-sans-serif, system-ui, sans-serif`
          ctx.textAlign = 'center'
          ctx.lineJoin = 'round'
          for (const n of sim.nodes) {
            const meta = st.nodeMeta.get(n.id)
            if (!meta) continue
            const focused = st.focusSet?.has(n.id)
            const dimmed = st.focusSet && !focused
            // draw a label when zoomed in enough, node is important, or focused
            const visible = focused || n.id === st.selected ||
              (!dimmed && (xf.k * n.r > 5.2 || meta.linkCount >= 6))
            if (!visible) continue
            const label = meta.title.length > 26 ? meta.title.slice(0, 25) + '…' : meta.title
            ctx.globalAlpha = dimmed ? 0.15 : focused && st.focusSet ? 1 : 0.8
            ctx.strokeStyle = C.labelHalo
            ctx.lineWidth = 3.5 / xf.k
            ctx.strokeText(label, n.x, n.y + n.r + 13 / xf.k)
            ctx.fillStyle = C.label
            ctx.fillText(label, n.x, n.y + n.r + 13 / xf.k)
          }
        }
        ctx.restore()
        ctx.globalAlpha = 1
      }
      frameMsRef.current = frameMsRef.current * 0.9 + (performance.now() - t0) * 0.1

      // stress HUD — battle-test readout, only in ?vaultStress mode
      if (stateRef.current.stress) {
        ctx.font = '11px ui-monospace, monospace'
        ctx.textAlign = 'left'
        ctx.fillStyle = C.label
        ctx.globalAlpha = 0.9
        const s = stateRef.current.graph
        ctx.fillText(`stress ${s.nodes.length}n/${s.edges.length}e · frame ${frameMsRef.current.toFixed(1)}ms`, 12, h - 12)
        ctx.globalAlpha = 1
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [density, refreshColors])

  // ---- interactions ----
  const toWorld = useCallback((clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect()
    const { x, y, k } = xfRef.current
    return { x: (clientX - r.left - x) / k, y: (clientY - r.top - y) / k }
  }, [])

  const hitTest = useCallback((clientX: number, clientY: number): SimNode | null => {
    const sim = simRef.current
    if (!sim) return null
    const p = toWorld(clientX, clientY)
    let best: SimNode | null = null
    let bestD = Infinity
    const slack = 4 / xfRef.current.k
    for (const n of sim.nodes) {
      const d = Math.hypot(n.x - p.x, n.y - p.y)
      if (d < n.r + slack && d < bestD) { best = n; bestD = d }
    }
    return best
  }, [toWorld])

  const centerOn = useCallback((id: string, k?: number) => {
    const sim = simRef.current
    const n = sim?.byId.get(id)
    if (!n) return
    const { w, h } = sizeRef.current
    const xf = xfRef.current
    const tk = k ?? Math.max(xf.k, 1.05)
    tweenRef.current = {
      fx: xf.x, fy: xf.y, fk: xf.k,
      tx: w / 2 - n.x * tk, ty: h / 2 - n.y * tk, tk,
      t0: performance.now(),
    }
  }, [])

  const fitView = useCallback(() => {
    const sim = simRef.current
    const { w, h } = sizeRef.current
    if (!sim || sim.nodes.length === 0) return
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const n of sim.nodes) {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x)
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y)
    }
    const pad = 90
    const k = Math.min(1.6, Math.max(0.15, Math.min(w / (maxX - minX + pad * 2), h / (maxY - minY + pad * 2))))
    const xf = xfRef.current
    tweenRef.current = {
      fx: xf.x, fy: xf.y, fk: xf.k,
      tx: (w - (maxX + minX) * k) / 2, ty: (h - (maxY + minY) * k) / 2, tk: k,
      t0: performance.now(),
    }
    setZoomPct(Math.round(k * 100))
  }, [])

  const zoomBy = useCallback((f: number) => {
    const { w, h } = sizeRef.current
    const xf = xfRef.current
    const nk = Math.min(3, Math.max(0.15, xf.k * f))
    xf.x = w / 2 - ((w / 2 - xf.x) / xf.k) * nk
    xf.y = h / 2 - ((h / 2 - xf.y) / xf.k) * nk
    xf.k = nk
    setZoomPct(Math.round(nk * 100))
  }, [])

  const onWheel = useCallback((e: React.WheelEvent) => {
    tweenRef.current = null
    const r = canvasRef.current!.getBoundingClientRect()
    const mx = e.clientX - r.left, my = e.clientY - r.top
    const xf = xfRef.current
    const nk = Math.min(3, Math.max(0.15, xf.k * (e.deltaY < 0 ? 1.12 : 0.89)))
    xf.x = mx - ((mx - xf.x) / xf.k) * nk
    xf.y = my - ((my - xf.y) / xf.k) * nk
    xf.k = nk
    setZoomPct(Math.round(nk * 100))
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    tweenRef.current = null
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch { /* synthetic */ }
    const node = hitTest(e.clientX, e.clientY)
    if (node) {
      node.fixed = true
      dragRef.current = { node, sx: e.clientX, sy: e.clientY, ox: node.x, oy: node.y, moved: false }
      if (simRef.current) reheat(simRef.current, 0.3)
    } else {
      const xf = xfRef.current
      dragRef.current = { panning: true, sx: e.clientX, sy: e.clientY, ox: xf.x, oy: xf.y, moved: false }
    }
  }, [hitTest])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current
    if (d?.node) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 3) d.moved = true
      const w = toWorld(e.clientX, e.clientY)
      d.node.x = w.x; d.node.y = w.y
      if (simRef.current) reheat(simRef.current, 0.3)
    } else if (d?.panning) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 3) d.moved = true
      xfRef.current.x = d.ox + (e.clientX - d.sx)
      xfRef.current.y = d.oy + (e.clientY - d.sy)
    } else {
      const node = hitTest(e.clientX, e.clientY)
      if (node) {
        const r = wrapRef.current!.getBoundingClientRect()
        setHover(h => (h?.id === node.id ? { ...h, x: e.clientX - r.left, y: e.clientY - r.top } : { id: node.id, x: e.clientX - r.left, y: e.clientY - r.top }))
      } else setHover(h => (h ? null : h))
    }
  }, [hitTest, toWorld])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    if (d.node) {
      d.node.fixed = false
      if (!d.moved) setSelected(sel => (sel === d.node!.id ? null : d.node!.id))
    } else if (d.panning && !d.moved) {
      setSelected(null)
    }
    void e
  }, [])

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    const node = hitTest(e.clientX, e.clientY)
    if (node) {
      setLocal(l => ({ focus: node.id, depth: l?.depth ?? 1 }))
      setSelected(node.id)
      setTimeout(() => fitView(), 60)
    }
  }, [hitTest, fitView])

  const jumpTo = useCallback((id: string) => {
    setSelected(id)
    setQ('')
    setSearchFocus(false)
    centerOn(id, 1.15)
  }, [centerOn])

  const enterLocal = useCallback((id: string) => {
    setLocal(l => ({ focus: id, depth: l?.depth ?? 1 }))
    setSelected(id)
    setTimeout(() => fitView(), 60)
  }, [fitView])

  const exitLocal = useCallback(() => {
    setLocal(null)
    setTimeout(() => fitView(), 60)
  }, [fitView])

  // ---- inspector data ----
  const selNote = selected && !stress ? notes[selected] : null
  const selMeta = selected ? nodeMeta.get(selected) : null
  const selNeighbors = useMemo(() => {
    if (!selected) return []
    const ids = new Set<string>()
    for (const e of graph.edges) {
      if (e.source === selected) ids.add(e.target)
      if (e.target === selected) ids.add(e.source)
    }
    return [...ids].slice(0, 8)
  }, [selected, graph])
  const selSuggestions = useMemo(
    () => selected ? graph.suggested.filter(e => e.source === selected || e.target === selected).slice(0, 4) : [],
    [selected, graph],
  )

  const addToCanvas = useCallback((id: string) => {
    const note = notes[id]
    if (!note) return
    const prod = note.fm.product
    const colorKey = prod === 'KinetikCircle' ? 'sky' : prod === 'ArgantaLabs' ? 'ember'
      : prod === 'LashiraBloom' ? 'jade' : prod === 'Investor' ? 'rose' : 'iris'
    addCanvasCard({
      type: 'note', noteId: id, color: colorKey, w: 240, h: 130,
      x: 380 + Math.random() * 120, y: 240 + Math.random() * 100,
    })
    setCenterView('canvas')
  }, [notes, addCanvasCard, setCenterView])

  const localFocusTitle = local ? (nodeMeta.get(local.focus)?.title || base.nodes.find(n => n.id === local.focus)?.title) : null

  return (
    <div className="vg" ref={wrapRef}>
      {/* ── toolbar ── */}
      <div className="vg-bar">
        <div className="vgx-search">
          <Search size={13} />
          <input value={q} placeholder="Find a node…" aria-label="Search graph"
            onChange={e => setQ(e.target.value)}
            onFocus={() => setSearchFocus(true)}
            onBlur={() => setTimeout(() => setSearchFocus(false), 150)}
            onKeyDown={e => { if (e.key === 'Enter' && searchHits[0]) jumpTo(searchHits[0].id) }} />
          {q && searchFocus && (
            <div className="vgx-search-drop">
              {searchHits.length === 0 && <div className="vgx-search-none">No nodes match “{q}”</div>}
              {searchHits.map(n => (
                <button key={n.id} onMouseDown={() => jumpTo(n.id)}>
                  <span className="vp-dot" style={{ background: PRODUCT_COLOR[n.product] }} />
                  <span className="vgx-search-t">{n.title}</span>
                  <span className="vgx-search-k">{n.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="vg-chips">
          {PRODUCTS.map(p => (
            <button key={p} className={'vg-chip' + (pillar === p ? ' on' : '')}
              style={pillar === p ? { borderColor: PRODUCT_COLOR[p], color: PRODUCT_COLOR[p] } : undefined}
              onClick={() => setPillar(f => f === p ? 'all' : p)}>
              <span className="vp-dot" style={{ background: PRODUCT_COLOR[p] }} />{p}
            </button>
          ))}
        </div>

        <div className="vg-tools">
          <select className="vg-select" value={typeF} onChange={e => setTypeF(e.target.value as NoteType | 'all')} aria-label="Filter by type">
            {NODE_TYPES.map(t => <option key={t} value={t}>{t === 'all' ? 'all types' : t}</option>)}
          </select>
          <select className="vg-select" value={tagF} onChange={e => setTagF(e.target.value)} aria-label="Filter by tag">
            <option value="all">all tags</option>
            {allTags.map(t => <option key={t} value={t}>#{t}</option>)}
          </select>
          <button className={'vg-tool' + (showLabels ? ' on' : '')} title="Toggle labels" onClick={() => setShowLabels(v => !v)}><TypeIcon size={13} /></button>
          <button className={'vg-tool' + (showLinks ? ' on' : '')} title="Toggle links" onClick={() => setShowLinks(v => !v)}><Spline size={13} /></button>
          <button className={'vg-tool' + (showSuggested ? ' on' : '')} title="Toggle suggested connections (dotted)" onClick={() => setShowSuggested(v => !v)}><Sparkles size={13} /></button>
          <button className={'vg-tool' + (showOrphans ? '' : ' on')} title={showOrphans ? 'Hide orphan notes' : 'Show orphan notes'}
            onClick={() => setShowOrphans(o => !o)}>
            {showOrphans ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <div className="vg-zoomers">
            <button className="vg-tool" onClick={() => zoomBy(0.82)} title="Zoom out"><Minus size={13} /></button>
            <span className="vg-zoomval">{zoomPct}%</span>
            <button className="vg-tool" onClick={() => zoomBy(1.22)} title="Zoom in"><Plus size={13} /></button>
            <button className="vg-tool" onClick={fitView} title="Fit graph to screen"><Maximize2 size={13} /></button>
          </div>
        </div>
      </div>

      {/* ── local-graph banner ── */}
      {local && (
        <div className="vgx-local">
          <Crosshair size={12} />
          <span className="vgx-local-t">Local graph · <b>{localFocusTitle}</b></span>
          <span className="vgx-local-d">depth</span>
          {([1, 2, 3] as const).map(d => (
            <button key={d} className={'vgx-depth' + (local.depth === d ? ' on' : '')}
              onClick={() => { setLocal({ ...local, depth: d }); setTimeout(fitView, 60) }}>{d}</button>
          ))}
          <button className="vgx-local-x" onClick={exitLocal}><X size={12} /> exit</button>
        </div>
      )}

      <canvas ref={canvasRef} className="vg-canvas"
        onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerLeave={() => setHover(null)} onDoubleClick={onDoubleClick} />

      {/* ── hover preview ── */}
      {hover && !dragRef.current && notes[hover.id] && hover.id !== selected && (
        <div className="vg-preview" style={{
          left: Math.min(hover.x + 16, sizeRef.current.w - 280),
          top: Math.min(hover.y + 14, sizeRef.current.h - 150),
        }}>
          <div className="vg-pv-t">
            <span className="vp-dot" style={{ background: PRODUCT_COLOR[notes[hover.id].fm.product] }} />
            {notes[hover.id].fm.title}
          </div>
          <div className="vg-pv-body">{noteSummary(notes[hover.id].body)}</div>
          <div className="vg-pv-meta">
            {notes[hover.id].fm.type} · {(index.backlinks[hover.id] || []).length} in · {(index.outgoing[hover.id] || []).length} out · double-click for local graph
          </div>
        </div>
      )}

      {/* ── inspector ── */}
      {selMeta && (
        <div className="vg-inspect">
          <div className="vg-in-head">
            <span className="vp-dot" style={{ background: PRODUCT_COLOR[selMeta.product] }} />
            <span className="vg-in-t">{selMeta.title}</span>
            <button className="vg-tool" onClick={() => setSelected(null)}><X size={13} /></button>
          </div>
          <div className="vg-in-meta">
            <span className="v-badge">{selMeta.type}</span>
            {selNote && <span className="v-badge">{selNote.fm.status}</span>}
            <span className="v-badge" style={{ color: PRODUCT_COLOR[selMeta.product] }}>{selMeta.product}</span>
            {selNote && <span className="v-badge">{wordCount(selNote.body)} words</span>}
          </div>
          {selNote && <p className="vgx-in-summary">{noteSummary(selNote.body)}</p>}
          <div className="vg-in-links">
            <span><ArrowDownLeft size={11} /> {stress ? '—' : (index.backlinks[selMeta.id] || []).length} backlinks</span>
            <span><ArrowUpRight size={11} /> {stress ? selMeta.linkCount : (index.outgoing[selMeta.id] || []).length} outgoing</span>
          </div>
          {selMeta.tags.length > 0 && (
            <div className="vg-in-tags">{selMeta.tags.slice(0, 5).map(t => <span key={t} className="v-tag">#{t}</span>)}</div>
          )}
          {selNeighbors.length > 0 && (
            <div className="vgx-in-sec">
              <div className="vgx-in-h">Connected</div>
              <div className="vgx-in-chips">
                {selNeighbors.map(id => {
                  const m = nodeMeta.get(id)
                  return m ? (
                    <button key={id} className="vgx-chip" onClick={() => jumpTo(id)}>
                      <span className="vp-dot" style={{ background: PRODUCT_COLOR[m.product] }} />
                      {m.title.length > 20 ? m.title.slice(0, 19) + '…' : m.title}
                    </button>
                  ) : null
                })}
              </div>
            </div>
          )}
          {selSuggestions.length > 0 && (
            <div className="vgx-in-sec">
              <div className="vgx-in-h"><Sparkles size={11} /> Suggested</div>
              {selSuggestions.map((s, i) => {
                const otherId = s.source === selMeta.id ? s.target : s.source
                const other = nodeMeta.get(otherId) || base.nodes.find(n => n.id === otherId)
                return other ? (
                  <button key={i} className="vgx-suggest" onClick={() => jumpTo(otherId)}
                    title={s.reason}>
                    <span className="vgx-suggest-t">{other.title}</span>
                    <span className="vgx-suggest-r">{s.reason}</span>
                  </button>
                ) : null
              })}
            </div>
          )}
          <div className="vgx-in-actions">
            {selNote && <button className="vg-open" onClick={() => openNote(selMeta.id)}><FileText size={12} /> Open note</button>}
            <button className="vgx-act" onClick={() => enterLocal(selMeta.id)} title="Focus 1–3 hop neighborhood">
              <LocateFixed size={12} /> Local graph
            </button>
            {selNote && (
              <button className="vgx-act" onClick={() => addToCanvas(selMeta.id)} title="Pin this note onto the canvas board">
                <Frame size={12} /> To canvas
              </button>
            )}
          </div>
        </div>
      )}

      {graph.nodes.length === 0 && (
        <div className="vg-empty">No notes match these filters{local ? ' in this local neighborhood' : ''}.</div>
      )}
    </div>
  )
}
