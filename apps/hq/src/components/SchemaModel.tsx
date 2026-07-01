import { useLayoutEffect, useMemo, useRef, useState, useCallback, type ReactNode, type PointerEvent as RPointerEvent } from 'react'
import { Hand, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import type { SchemaModel as Model, TableNode } from '../data/types'

const ZOOM_MIN = 0.35, ZOOM_MAX = 1.4, ZOOM_STEP = 0.1

const HEAD = 33, ROW = 24, CW = 158, RW = 124

type Pos = Record<string, { x: number; y: number }>
type RingItem = { table: TableNode; fk: string }

function pickCenterCols(t: TableNode) {
  const pk = t.columns.filter((c) => c.pk)
  const rest = t.columns.filter((c) => !c.pk)
  return [...pk, ...rest].slice(0, 4)
}
function pickRingCols(t: TableNode, fk: string) {
  const f = t.columns.filter((c) => c.name === fk)
  const rest = t.columns.filter((c) => c.name !== fk && !c.pk)
  return [...f, ...rest].slice(0, 4)
}
function heightOf(t: TableNode, isCenter: boolean, fk: string | undefined, isExpanded: boolean) {
  const cols = isExpanded
    ? t.columns
    : isCenter ? pickCenterCols(t) : pickRingCols(t, fk!)
  const more = (!isExpanded && t.columns.length > cols.length) ? 17 : 0
  const collapse = isExpanded ? 17 : 0
  return HEAD + cols.length * ROW + more + collapse
}
function edge(rx: number, ry: number, rw: number, rh: number, tx: number, ty: number) {
  const cx = rx + rw / 2, cy = ry + rh / 2
  const dx = tx - cx, dy = ty - cy
  if (!dx && !dy) return [cx, cy]
  const sx = Math.abs(dx) > 0 ? (rw / 2) / Math.abs(dx) : 1e9
  const sy = Math.abs(dy) > 0 ? (rh / 2) / Math.abs(dy) : 1e9
  const s = Math.min(sx, sy)
  return [cx + dx * s, cy + dy * s]
}

export function SchemaModel({ model, onRefresh }: { model: Model; onRefresh?: () => void }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleExpand(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const byName = useMemo(() => {
    const m = new Map<string, TableNode>()
    model.tables.forEach((t) => m.set(t.name, t))
    return m
  }, [model])

  const hubs = useMemo(() => {
    const count = new Map<string, number>()
    for (const r of model.relationships) {
      if (r.from === r.to) continue
      count.set(r.to, (count.get(r.to) || 0) + 1)
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n)
  }, [model])

  const [center, setCenter] = useState<string>(() => hubs[0] || model.tables[0]?.name || '')

  const ring = useMemo<RingItem[]>(() => {
    const seen = new Set<string>()
    const items: RingItem[] = []
    for (const r of model.relationships) {
      if (r.to !== center || r.from === center) continue
      if (seen.has(r.from)) continue
      const table = byName.get(r.from)
      if (!table) continue
      seen.add(r.from)
      items.push({ table, fk: r.fromCol })
    }
    return items
  }, [model, center, byName])

  const containerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<Pos>({})
  const dragRef = useRef<{ name: string; dx: number; dy: number } | null>(null)
  const [dragName, setDragName] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(1)
  const lastFitRef = useRef<string>('')   // last center we auto-fit, so resize doesn't override manual zoom
  useLayoutEffect(() => { zoomRef.current = zoom }, [zoom])
  const zoomBy = (d: number) => setZoom(z => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(z + d).toFixed(2))))

  const layout = useCallback(() => {
    const el = containerRef.current
    if (!el || !center) return
    const W = el.clientWidth, H = el.clientHeight
    const c = byName.get(center)
    const ch = c ? heightOf(c, true, undefined, expanded.has(center)) : 120
    const next: Pos = { [center]: { x: W / 2 - CW / 2, y: H / 2 - ch / 2 } }
    const n = ring.length || 1
    // Radius big enough that ring cards never overlap (circumference fits them
    // all); the view then auto-fits/zooms to show the whole spread. No clamping —
    // nodes can sit beyond the canvas and you pan/zoom to read them.
    const minR = (n * (RW + 26)) / (2 * Math.PI)
    const rx = Math.max(W * 0.30, minR)
    const ry = Math.max(H * 0.30, minR * 0.9)
    ring.forEach((it, i) => {
      const ang = (-90 + i * (360 / n)) * Math.PI / 180
      const cx = W / 2 + rx * Math.cos(ang), cy = H / 2 + ry * Math.sin(ang)
      const rh = heightOf(it.table, false, it.fk, expanded.has(it.table.name))
      next[it.table.name] = { x: cx - RW / 2, y: cy - rh / 2 }
    })
    setPos(next)
    // Auto-fit the whole star into view when the center (star) changes.
    const contentW = 2 * rx + RW + 24, contentH = 2 * ry + 200
    const fit = Math.max(ZOOM_MIN, Math.min(1, (W - 16) / contentW, (H - 16) / contentH))
    if (lastFitRef.current !== center) { lastFitRef.current = center; setZoom(+fit.toFixed(2)) }
  }, [center, ring, byName, expanded])

  useLayoutEffect(() => { layout() }, [layout])
  useLayoutEffect(() => {
    const onResize = () => layout()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [layout])

  useLayoutEffect(() => {
    function move(e: PointerEvent) {
      const d = dragRef.current, el = containerRef.current
      if (!d || !el) return
      const r = el.getBoundingClientRect()
      const z = zoomRef.current, W = el.clientWidth, H = el.clientHeight
      // event coords → stage (layout) coords. Stage scales about its centre, so
      // invert about the centre too. No clamp: spread-out nodes stay draggable.
      const lx = W / 2 + ((e.clientX - r.left) - W / 2) / z
      const ly = H / 2 + ((e.clientY - r.top) - H / 2) / z
      setPos((p) => ({ ...p, [d.name]: { x: lx - d.dx, y: ly - d.dy } }))
    }
    function up() { if (dragRef.current) { dragRef.current = null; setDragName(null) } }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [])

  const onDown = (e: RPointerEvent<HTMLDivElement>, name: string) => {
    const el = containerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const z = zoomRef.current, W = el.clientWidth, H = el.clientHeight
    const p = pos[name] || { x: 0, y: 0 }
    // grab offset in stage (layout) coords (centre-origin) so dragging tracks the cursor at any zoom
    const lx = W / 2 + ((e.clientX - r.left) - W / 2) / z
    const ly = H / 2 + ((e.clientY - r.top) - H / 2) / z
    dragRef.current = { name, dx: lx - p.x, dy: ly - p.y }
    setDragName(name)
    e.preventDefault()
  }

  function renderNode(t: TableNode, isCenter: boolean, fk?: string) {
    const p = pos[t.name]
    if (!p) return null
    const isExp = expanded.has(t.name)
    const cols = isExp ? t.columns : (isCenter ? pickCenterCols(t) : pickRingCols(t, fk!))
    const hidden = t.columns.length - cols.length
    return (
      <div key={t.name} className={'tnode' + (isCenter ? ' center' : '') + (dragName === t.name ? ' drag' : '')}
        style={{ left: p.x, top: p.y, width: isCenter ? CW : RW }}
        onPointerDown={(e) => onDown(e, t.name)}>
        <div className="tn-h">
          <span>{t.name}</span>
          <span className="tn-rows">≈{t.rows.toLocaleString()}</span>
        </div>
        {cols.map((c) => {
          const isKey = c.pk || c.name === fk
          const badge = c.pk ? <span className="kbadge kb-pk">PK</span>
            : c.name === fk ? <span className="kbadge kb-fk">FK</span>
            : <span className="kbadge kb-_" />
          return (
            <div key={c.name} className={'tr' + (isKey ? ' k' : '')}>
              {badge}<span className="tc">{c.name}</span><span className="tt">{c.type.replace(' ', '')}</span>
            </div>
          )
        })}
        {hidden > 0 && (
          <div className="tn-more tn-more-btn" onClick={(e) => { e.stopPropagation(); toggleExpand(t.name) }}>
            +{hidden} more columns
          </div>
        )}
        {isExp && hidden === 0 && t.columns.length > 4 && (
          <div className="tn-more tn-more-btn" onClick={(e) => { e.stopPropagation(); toggleExpand(t.name) }}>
            show less
          </div>
        )}
      </div>
    )
  }

  // wires — SVG must have width/height="100%" so user-unit coords match CSS px
  const c = byName.get(center)
  const wires: ReactNode[] = []
  if (c && pos[center]) {
    const cp = pos[center], ch = heightOf(c, true, undefined, expanded.has(center))
    const ccx = cp.x + CW / 2, ccy = cp.y + ch / 2
    ring.forEach((it) => {
      const rp = pos[it.table.name]
      if (!rp) return
      const rh = heightOf(it.table, false, it.fk, expanded.has(it.table.name))
      const rcx = rp.x + RW / 2, rcy = rp.y + rh / 2
      const [ax, ay] = edge(cp.x, cp.y, CW, ch, rcx, rcy)
      const [bx, by] = edge(rp.x, rp.y, RW, rh, ccx, ccy)
      const ox = ax + (bx - ax) * 0.14, oy = ay + (by - ay) * 0.14
      const mx = ax + (bx - ax) * 0.84, my = ay + (by - ay) * 0.84
      wires.push(
        <g key={it.table.name}>
          <line x1={ax} y1={ay} x2={bx} y2={by} stroke="var(--bd3)" strokeWidth={1.6} />
          <circle cx={ax} cy={ay} r={3.2} fill="var(--acc)" />
          <text x={ox} y={oy} dy="3.5" fontSize="10" fontWeight="700" fill="var(--acc)" textAnchor="middle">1</text>
          <text x={mx} y={my} dy="4" fontSize="13" fontWeight="700" fill="var(--tx3)" textAnchor="middle">∗</text>
        </g>,
      )
    })
  }

  return (
    <div>
      <div className="tlbar">
        <span style={{ fontSize: 12, color: 'var(--tx2)', fontWeight: 500 }}>Center</span>
        {hubs.slice(0, 4).map((h) => (
          <button key={h} className={'chip' + (center === h ? ' on' : '')} onClick={() => setCenter(h)}>{h}</button>
        ))}
        <span className="chip tl-hint" style={{ marginLeft: 'auto', color: 'var(--tx3)' }}><Hand size={13} /> drag tables</span>
        <div className="zoomctl">
          <button onClick={() => zoomBy(-ZOOM_STEP)} disabled={zoom <= ZOOM_MIN} title="Zoom out"><ZoomOut size={13} /></button>
          <span className="zoomval" onClick={() => setZoom(1)} title="Reset zoom">{Math.round(zoom * 100)}%</span>
          <button onClick={() => zoomBy(ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} title="Zoom in"><ZoomIn size={13} /></button>
        </div>
        <button className="chip" onClick={() => { lastFitRef.current = ''; layout() }} title="Reset &amp; fit"><RotateCcw size={13} /></button>
        {onRefresh && <button className="chip" onClick={onRefresh} title="Refresh from source">Refresh</button>}
      </div>

      <div className="canvas" ref={containerRef}>
        {/* Inner stage is CSS-scaled for zoom about its centre, so the diagram
            stays centred at any zoom; drag math inverts about the centre too. */}
        <div className="canvas-stage" style={{ transform: `scale(${zoom})`, transformOrigin: '50% 50%' }}>
          {/* overflow visible so wires to off-canvas nodes aren't clipped */}
          <svg className="wires" width="100%" height="100%" style={{ overflow: 'visible' }}>{wires}</svg>
          {c && renderNode(c, true)}
          {ring.map((it) => renderNode(it.table, false, it.fk))}
        </div>
      </div>

      <div className="legend">
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="kbadge kb-pk">PK</span> parent key (center)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="kbadge kb-fk">FK</span> foreign key</span>
        <span>1 ──&lt; ∗ one-to-many</span>
        <span style={{ marginLeft: 'auto', color: 'var(--tx3)' }}>
          {model.tables.length} tables · {model.relationships.length} relationships · {ring.length} linked to {center}
        </span>
      </div>
    </div>
  )
}
