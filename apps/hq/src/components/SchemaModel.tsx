import { useLayoutEffect, useMemo, useRef, useState, useCallback, type ReactNode, type PointerEvent as RPointerEvent } from 'react'
import { Hand, RotateCcw } from 'lucide-react'
import type { SchemaModel as Model, TableNode } from '../data/types'

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
function heightOf(t: TableNode, isCenter: boolean, fk?: string) {
  const cols = isCenter ? pickCenterCols(t) : pickRingCols(t, fk!)
  const more = t.columns.length > cols.length ? 17 : 0
  return HEAD + cols.length * ROW + more
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
  const byName = useMemo(() => {
    const m = new Map<string, TableNode>()
    model.tables.forEach((t) => m.set(t.name, t))
    return m
  }, [model])

  // incoming FK count per table (self-refs excluded) → hub ranking
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

  const layout = useCallback(() => {
    const el = containerRef.current
    if (!el || !center) return
    const W = el.clientWidth, H = el.clientHeight
    const c = byName.get(center)
    const ch = c ? heightOf(c, true) : 120
    const next: Pos = { [center]: { x: W / 2 - CW / 2, y: H / 2 - ch / 2 } }
    const n = ring.length || 1
    const rx = Math.min(W * 0.34, 250), ry = H * 0.36
    ring.forEach((it, i) => {
      const ang = (-90 + i * (360 / n)) * Math.PI / 180
      const cx = W / 2 + rx * Math.cos(ang), cy = H / 2 + ry * Math.sin(ang)
      const rh = heightOf(it.table, false, it.fk)
      next[it.table.name] = {
        x: Math.max(4, Math.min(cx - RW / 2, W - RW - 4)),
        y: Math.max(4, Math.min(cy - rh / 2, H - rh - 4)),
      }
    })
    setPos(next)
  }, [center, ring, byName])

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
      const x = Math.max(0, Math.min(e.clientX - r.left - d.dx, el.clientWidth - RW))
      const y = Math.max(0, Math.min(e.clientY - r.top - d.dy, el.clientHeight - 40))
      setPos((p) => ({ ...p, [d.name]: { x, y } }))
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
    dragRef.current = { name, dx: e.clientX - (r.left + e.currentTarget.offsetLeft), dy: e.clientY - (r.top + e.currentTarget.offsetTop) }
    setDragName(name)
    e.preventDefault()
  }

  function renderNode(t: TableNode, isCenter: boolean, fk?: string) {
    const p = pos[t.name]
    if (!p) return null
    const cols = isCenter ? pickCenterCols(t) : pickRingCols(t, fk!)
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
        {hidden > 0 && <div className="tn-more">+{hidden} more</div>}
      </div>
    )
  }

  // wires
  const c = byName.get(center)
  const wires: ReactNode[] = []
  if (c && pos[center]) {
    const cp = pos[center], ch = heightOf(c, true)
    const ccx = cp.x + CW / 2, ccy = cp.y + ch / 2
    ring.forEach((it) => {
      const rp = pos[it.table.name]
      if (!rp) return
      const rh = heightOf(it.table, false, it.fk)
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
        <span className="chip" style={{ marginLeft: 'auto', color: 'var(--tx3)' }}><Hand size={13} /> drag any table</span>
        <button className="chip" onClick={() => layout()} title="Reset layout"><RotateCcw size={13} /></button>
        {onRefresh && <button className="chip" onClick={onRefresh} title="Refresh from source">Refresh</button>}
      </div>

      <div className="canvas" ref={containerRef}>
        <svg className="wires">{wires}</svg>
        {c && renderNode(c, true)}
        {ring.map((it) => renderNode(it.table, false, it.fk))}
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
