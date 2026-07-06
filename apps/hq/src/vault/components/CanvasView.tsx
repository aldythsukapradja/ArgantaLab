// HQ Vault — canvas view. A JSON-Canvas-inspired strategy board: note cards +
// text cards, draggable, connectable, pan/zoom, persisted with the vault.

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  FilePlus2, Type, Link2, Trash2, Maximize2, Minus, Plus, X, StickyNote,
} from 'lucide-react'
import { useVault, openByTarget } from '../store'
import { InlineMarkdown } from './Preview'
import type { CanvasCard } from '../types'
import { PRODUCT_COLOR } from '../types'

const CARD_COLORS: Record<string, string> = {
  iris: '#8b7cf6', sky: '#38bdf8', ember: '#f0a24b', jade: '#4ade80',
  rose: '#f472b6', graphite: '#6b7280',
}

interface XF { x: number; y: number; k: number }

export function CanvasView() {
  const canvas = useVault(s => s.canvas)
  const notes = useVault(s => s.notes)
  const setCanvas = useVault(s => s.setCanvas)
  const addCanvasCard = useVault(s => s.addCanvasCard)
  const removeCanvasCard = useVault(s => s.removeCanvasCard)
  const connectCards = useVault(s => s.connectCards)
  const removeCanvasEdge = useVault(s => s.removeCanvasEdge)

  const [xf, setXf] = useState<XF>({ x: 40, y: 30, k: 0.92 })
  const [selected, setSelected] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [notePicker, setNotePicker] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ card?: string; panning?: boolean; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null)

  const cardById = useMemo(() => new Map(canvas.cards.map(c => [c.id, c])), [canvas.cards])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = (e.target as Element).closest('[data-card]')
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    if (el) {
      const id = el.getAttribute('data-card')!
      const c = cardById.get(id)
      if (!c) return
      dragRef.current = { card: id, sx: e.clientX, sy: e.clientY, ox: c.x, oy: c.y, moved: false }
    } else {
      dragRef.current = { panning: true, sx: e.clientX, sy: e.clientY, ox: xf.x, oy: xf.y, moved: false }
    }
  }, [cardById, xf])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy
    if (Math.hypot(dx, dy) > 3) d.moved = true
    if (d.card) {
      const nx = d.ox + dx / xf.k, ny = d.oy + dy / xf.k
      setCanvas(c => ({ ...c, cards: c.cards.map(cc => cc.id === d.card ? { ...cc, x: nx, y: ny } : cc) }))
    } else if (d.panning) {
      setXf(x => ({ ...x, x: d.ox + dx, y: d.oy + dy }))
    }
  }, [setCanvas, xf.k])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    if (d.card && !d.moved) {
      if (connecting && connecting !== d.card) {
        connectCards(connecting, d.card)
        setConnecting(null)
      } else {
        setSelected(s => s === d.card ? null : d.card!)
      }
    } else if (d.panning && !d.moved) {
      setSelected(null); setConnecting(null)
    }
    void e
  }, [connecting, connectCards])

  const onWheel = useCallback((e: React.WheelEvent) => {
    const r = wrapRef.current!.getBoundingClientRect()
    const mx = e.clientX - r.left, my = e.clientY - r.top
    setXf(xf => {
      const nk = Math.min(2.2, Math.max(0.3, xf.k * (e.deltaY < 0 ? 1.1 : 0.9)))
      return { x: mx - ((mx - xf.x) / xf.k) * nk, y: my - ((my - xf.y) / xf.k) * nk, k: nk }
    })
  }, [])

  const center = () => {
    const el = wrapRef.current
    if (!el || canvas.cards.length === 0) { setXf({ x: 40, y: 30, k: 0.92 }); return }
    const minX = Math.min(...canvas.cards.map(c => c.x))
    const maxX = Math.max(...canvas.cards.map(c => c.x + c.w))
    const minY = Math.min(...canvas.cards.map(c => c.y))
    const maxY = Math.max(...canvas.cards.map(c => c.y + c.h))
    const r = el.getBoundingClientRect()
    const k = Math.min(1.15, Math.max(0.3, Math.min(r.width / (maxX - minX + 160), r.height / (maxY - minY + 160))))
    setXf({ x: (r.width - (maxX - minX) * k) / 2 - minX * k, y: (r.height - (maxY - minY) * k) / 2 - minY * k, k })
  }

  const dropPoint = () => {
    const el = wrapRef.current
    const r = el?.getBoundingClientRect()
    const w = r ? r.width : 900, h = r ? r.height : 600
    return { x: (w / 2 - xf.x) / xf.k - 120 + (Math.random() * 60 - 30), y: (h / 2 - xf.y) / xf.k - 60 + (Math.random() * 40 - 20) }
  }

  const addText = () => {
    const p = dropPoint()
    addCanvasCard({ type: 'text', text: 'New idea…', x: p.x, y: p.y, w: 230, h: 96, color: 'graphite' })
  }
  const addNoteCard = (noteId: string) => {
    const p = dropPoint()
    const prod = notes[noteId]?.fm.product
    const colorKey = prod === 'KinetikCircle' ? 'sky' : prod === 'ArgantaLabs' ? 'ember'
      : prod === 'LashiraBloom' ? 'jade' : prod === 'Investor' ? 'rose' : 'iris'
    addCanvasCard({ type: 'note', noteId, x: p.x, y: p.y, w: 240, h: 130, color: colorKey })
    setNotePicker(false)
  }

  const edgeAnchors = (a: CanvasCard, b: CanvasCard) => {
    const ax = a.x + a.w / 2, ay = a.y + a.h / 2
    const bx = b.x + b.w / 2, by = b.y + b.h / 2
    return { ax, ay, bx, by }
  }

  const selCard = selected ? cardById.get(selected) : null

  return (
    <div className="vc" ref={wrapRef}>
      {/* toolbar */}
      <div className="vc-bar">
        <div className="vc-actions">
          <button className="vc-btn" onClick={() => setNotePicker(p => !p)} title="Add note card"><FilePlus2 size={13} /> Note card</button>
          <button className="vc-btn" onClick={addText} title="Add text card"><Type size={13} /> Text card</button>
          {selCard && (
            <>
              <button className={'vc-btn' + (connecting === selCard.id ? ' on' : '')}
                onClick={() => setConnecting(c => c === selCard.id ? null : selCard.id)}
                title="Connect: click another card to link">
                <Link2 size={13} /> {connecting === selCard.id ? 'Click a target…' : 'Connect'}
              </button>
              <button className="vc-btn danger" onClick={() => { removeCanvasCard(selCard.id); setSelected(null) }}>
                <Trash2 size={13} /> Remove
              </button>
            </>
          )}
        </div>
        <div className="vg-zoomers">
          <button className="vg-tool" onClick={() => setXf(x => ({ ...x, k: Math.max(0.3, x.k * 0.87) }))}><Minus size={13} /></button>
          <span className="vg-zoomval">{Math.round(xf.k * 100)}%</span>
          <button className="vg-tool" onClick={() => setXf(x => ({ ...x, k: Math.min(2.2, x.k * 1.15) }))}><Plus size={13} /></button>
          <button className="vg-tool" onClick={center} title="Fit board"><Maximize2 size={13} /></button>
        </div>
      </div>

      {/* note picker */}
      {notePicker && (
        <div className="vc-picker">
          <div className="vc-picker-h">Add a note to the board <button onClick={() => setNotePicker(false)}><X size={13} /></button></div>
          <div className="vc-picker-list">
            {Object.values(notes)
              .sort((a, b) => a.fm.title.localeCompare(b.fm.title))
              .map(n => (
                <button key={n.id} className="vc-pick" onClick={() => addNoteCard(n.id)}>
                  <span className="vp-dot" style={{ background: PRODUCT_COLOR[n.fm.product] }} />
                  {n.fm.title}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* board */}
      <div className="vc-stage"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onWheel={onWheel}>
        <svg className="vc-wires">
          <g transform={`translate(${xf.x},${xf.y}) scale(${xf.k})`}>
            {canvas.edges.map(e => {
              const a = cardById.get(e.fromCard), b = cardById.get(e.toCard)
              if (!a || !b) return null
              const { ax, ay, bx, by } = edgeAnchors(a, b)
              const mx = (ax + bx) / 2, my = (ay + by) / 2
              return (
                <g key={e.id} className="vc-edge-g">
                  <path d={`M ${ax} ${ay} Q ${mx} ${my} ${bx} ${by}`} className="vc-edge" />
                  {e.label && (
                    <text x={mx} y={my - 6} className="vc-edge-label">{e.label}</text>
                  )}
                  <circle cx={mx} cy={my} r={9} className="vc-edge-x"
                    onPointerDown={ev => ev.stopPropagation()}
                    onClick={() => removeCanvasEdge(e.id)} />
                  <text x={mx} y={my + 3.5} className="vc-edge-xt" pointerEvents="none">×</text>
                </g>
              )
            })}
          </g>
        </svg>

        <div className="vc-cards" style={{ transform: `translate(${xf.x}px,${xf.y}px) scale(${xf.k})` }}>
          {canvas.cards.map(c => {
            const color = CARD_COLORS[c.color || 'graphite'] || CARD_COLORS.graphite
            const note = c.noteId ? notes[c.noteId] : null
            const isSel = selected === c.id
            const isConnSrc = connecting === c.id
            return (
              <div key={c.id} data-card={c.id}
                className={'vc-card' + (isSel ? ' sel' : '') + (isConnSrc ? ' connecting' : '') + (connecting && !isConnSrc ? ' target' : '')}
                style={{ left: c.x, top: c.y, width: c.w, minHeight: c.h, borderColor: isSel || isConnSrc ? color : undefined, boxShadow: isSel ? `0 0 0 1px ${color}, 0 14px 34px rgba(0,0,0,.35)` : undefined }}>
                <div className="vc-card-accent" style={{ background: color }} />
                {c.type === 'note' && note && (
                  <>
                    <div className="vc-card-h">
                      <StickyNote size={12} style={{ color }} />
                      <span>{note.fm.title}</span>
                      <button className="vc-card-open" title="Open note"
                        onPointerDown={e => e.stopPropagation()}
                        onClick={() => openByTarget(note.fm.title)}>open</button>
                    </div>
                    <div className="vc-card-body">
                      {note.body.replace(/^#.*$/m, '').replace(/[#>*\[\]`|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 130)}…
                    </div>
                    <div className="vc-card-meta">{note.fm.type} · {note.fm.status}</div>
                  </>
                )}
                {c.type === 'note' && !note && (
                  <div className="vc-card-body v-dim">Note deleted.</div>
                )}
                {c.type === 'text' && (
                  isSel ? (
                    <textarea className="vc-card-edit" value={c.text || ''}
                      onPointerDown={e => e.stopPropagation()}
                      onChange={e => setCanvas(cv => ({ ...cv, cards: cv.cards.map(cc => cc.id === c.id ? { ...cc, text: e.target.value } : cc) }))} />
                  ) : (
                    <div className="vc-card-body vc-card-text"><InlineMarkdown text={c.text || ''} /></div>
                  )
                )}
              </div>
            )
          })}
        </div>

        {canvas.cards.length === 0 && (
          <div className="vc-empty">
            <StickyNote size={22} />
            <p>An empty board. Add a note card or a text card to start mapping the strategy.</p>
          </div>
        )}
      </div>

      <div className="vc-hint">
        drag cards · drag background to pan · scroll to zoom · select a card to connect or remove · board autosaves
      </div>
    </div>
  )
}
