// HQ Vault — Knowledge Graph v3. PIXI (WebGL) + d3-force worker engine.
//
// This component is the React chrome (filters, toolbar, inspector) around the
// framework-agnostic GraphEngine. It reuses the existing data pipeline
// (buildGraph / buildSuggestedEdges / focus neighbourhoods) and just feeds the
// engine node/edge data + colours. Rendering, layout, camera and hit-testing all
// live in the engine, off the React render path.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Maximize2, Minus, Plus, Type as TypeIcon, Search, LocateFixed, X, Layers, Palette,
} from 'lucide-react'
import { useVault } from '../store'
import { buildGraph, buildSuggestedEdges } from '../graph'
import { tokenizeBlocks } from '../markdown'
import type { GraphNode, NoteType } from '../types'
import { GraphEngine, type EngineNode, type EngineEdge, type LabelMode } from '../graph/engine'
import {
  colorOf, groupOf, groupsPresent, groupLabel, buildTargets, hexToNum, LAYER_LABEL, type ColorBy, type Layer,
} from '../graph/palette'

const NODE_TYPES: (NoteType | 'all')[] = ['all', 'note', 'strategy', 'decision', 'prompt', 'research', 'plan', 'spec']
const nodeRadius = (deg: number) => 5 + Math.min(11, Math.sqrt(deg) * 3.2)
const ringRadiusFor = (count: number, groups: number) =>
  groups <= 1 ? 0 : Math.max(180, Math.min(560, Math.sqrt(count) * 26))

function cssVar(name: string, fallback: string) {
  if (typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

// One consistent capsule for every control — colour-by, label mode, and the
// interactive group filters all render as the same fancy pill. A `dot` colour
// makes it a group chip (tints border/bg when active); no dot = a plain toggle.
function Chip({ active, dot, title, onClick, children }: {
  active?: boolean; dot?: string; title?: string; onClick?: () => void; children: React.ReactNode
}) {
  return (
    <button title={title} onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px',
      borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
      border: '1px solid ' + (active ? (dot || 'var(--v-acc)') : 'var(--v-bd)'),
      background: active ? (dot ? dot + '26' : 'var(--v-acc)') : 'var(--v-bg2)',
      color: active ? (dot || '#fff') : 'var(--v-tx2)',
      transition: 'background .15s, border-color .15s, color .15s', pointerEvents: 'auto',
    }}>
      {dot && <span style={{ width: 8, height: 8, borderRadius: 8, background: dot, flex: 'none', boxShadow: active ? `0 0 7px ${dot}` : 'none' }} />}
      {children}
    </button>
  )
}

const segment: React.CSSProperties = {
  display: 'inline-flex', gap: 4, alignItems: 'center', background: 'var(--v-bg1)',
  border: '1px solid var(--v-bd)', borderRadius: 999, padding: '3px 5px', pointerEvents: 'auto',
}
const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28,
  borderRadius: 999, border: '1px solid var(--v-bd)', background: 'var(--v-bg2)',
  color: 'var(--v-tx2)', cursor: 'pointer', pointerEvents: 'auto',
}

function noteSummary(body: string): string {
  for (const b of tokenizeBlocks(body)) {
    if (b.kind === 'p') {
      const plain = b.text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, t, a) => a || t)
        .replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim()
      if (plain) return plain.length > 160 ? plain.slice(0, 160) + '…' : plain
    }
  }
  return ''
}

export function GraphViewV3() {
  const notes = useVault(s => s.notes)
  const index = useVault(s => s.index)
  const openNote = useVault(s => s.openNote)

  // group-pill spotlight: highlights one group of the active dimension by DIMMING
  // the rest (never removes nodes — a hard filter forced a full sim rebuild on
  // every click, which is what made the animation feel staggered when clicking
  // through pills; see setGroupHighlight in the engine).
  const [groupFilter, setGroupFilter] = useState<string | null>(null)
  const [typeF, setTypeF] = useState<NoteType | 'all'>('all')
  const [showOrphans, setShowOrphans] = useState(true)
  const [colorBy, setColorBy] = useState<ColorBy>('product')
  // switching the colour dimension clears any spotlight (its groups differ)
  const changeColorBy = (c: ColorBy) => { setColorBy(c); setGroupFilter(null) }
  const [labelMode, setLabelMode] = useState<LabelMode>('auto')
  const [cluster, setCluster] = useState(0.09)
  const [q, setQ] = useState('')
  const [zoomPct, setZoomPct] = useState(100)
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  // ---- data pipeline (reused) ----
  const base = useMemo(() => {
    const g = buildGraph(notes, index)
    return { ...g, suggested: buildSuggestedEdges(notes, index) }
  }, [notes, index])

  // typeF / showOrphans are the only TRUE (structural) filters — they change
  // the node set, so they legitimately trigger a sim rebuild. groupFilter is
  // NOT applied here; it only drives a dim overlay (see groupHighlightIds below).
  const graph = useMemo(() => {
    let nodes = base.nodes
    if (typeF !== 'all') nodes = nodes.filter(n => n.type === typeF)
    if (!showOrphans) nodes = nodes.filter(n => !n.orphan)
    const keep = new Set(nodes.map(n => n.id))
    return {
      nodes,
      edges: base.edges.filter(e => keep.has(e.source) && keep.has(e.target)),
      suggested: base.suggested.filter(e => keep.has(e.source) && keep.has(e.target)),
    }
  }, [base, typeF, showOrphans])

  // ids to keep at full opacity when a group pill is active; null = no spotlight
  const groupHighlightIds = useMemo(() => {
    if (!groupFilter) return null
    const s = new Set<string>()
    for (const n of graph.nodes) if (groupOf(n, colorBy) === groupFilter) s.add(n.id)
    return s
  }, [graph, colorBy, groupFilter])

  const nodeById = useMemo(() => new Map(graph.nodes.map(n => [n.id, n] as const)), [graph])
  const groups = useMemo(() => groupsPresent(graph.nodes, colorBy), [graph, colorBy])

  const searchHits = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return []
    return graph.nodes.filter(n => n.title.toLowerCase().includes(needle)).slice(0, 8)
  }, [q, graph])

  // focus neighbourhood for the hovered / selected node
  const focusId = hover?.id || selected
  const focusSet = useMemo(() => {
    if (!focusId) return null
    const s = new Set<string>([focusId])
    for (const e of graph.edges) {
      if (e.source === focusId) s.add(e.target)
      if (e.target === focusId) s.add(e.source)
    }
    for (const e of graph.suggested) {
      if (e.source === focusId) s.add(e.target)
      if (e.target === focusId) s.add(e.source)
    }
    return s
  }, [focusId, graph])

  // ---- engine lifecycle ----
  const wrapRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<GraphEngine | null>(null)
  const [ready, setReady] = useState(false)

  const engineColors = useCallback(() => ({
    edge: hexToNum(cssVar('--v-bd', '#31313d')),
    suggested: hexToNum(cssVar('--v-acc', '#6366f1')),
    accent: hexToNum(cssVar('--v-acc', '#6366f1')),
    label: cssVar('--v-tx2', '#9d9aad'),
    labelHalo: cssVar('--v-bg2', '#191920'),
  }), [])

  useEffect(() => {
    if (!wrapRef.current) return
    const eng = new GraphEngine(wrapRef.current, engineColors(), {
      onHover: (id, x, y) => setHover(id ? { id, x, y } : null),
      onSelect: id => setSelected(id),
      onOpen: id => openNote(id),
      onZoom: pct => setZoomPct(pct),
    })
    engineRef.current = eng
    if (import.meta.env.DEV) (window as unknown as { __eng?: GraphEngine }).__eng = eng
    let alive = true
    eng.init().then(() => { if (alive) setReady(true) })
    return () => { alive = false; eng.destroy(); engineRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // push data when the node/edge SET changes (rebuilds sprites + sim)
  useEffect(() => {
    const eng = engineRef.current
    if (!eng || !ready) return
    const idx = new Map(graph.nodes.map((n, i) => [n.id, i] as const))
    const eNodes: EngineNode[] = graph.nodes.map(n => ({
      id: n.id, title: n.title, r: nodeRadius(n.linkCount),
      color: hexToNum(colorOf(n, colorBy)), deg: n.linkCount,
    }))
    const edges: EngineEdge[] = []
    for (const e of graph.edges) {
      const a = idx.get(e.source), b = idx.get(e.target)
      if (a != null && b != null) edges.push({ a, b })
    }
    for (const e of graph.suggested) {
      const a = idx.get(e.source), b = idx.get(e.target)
      if (a != null && b != null) edges.push({ a, b, suggested: true })
    }
    const targets = buildTargets(graph.nodes, colorBy, ringRadiusFor(graph.nodes.length, groups.length))
    eng.setData(eNodes, edges, targets, { cluster })
    // the engine frames the seed immediately and keeps the whole graph framed as
    // it blooms (autoFrame), so no extra fit is needed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, ready])

  // recolor + regroup when the colour dimension changes (same node set)
  useEffect(() => {
    const eng = engineRef.current
    if (!eng || !ready) return
    eng.recolor(id => { const n = nodeById.get(id); return n ? hexToNum(colorOf(n, colorBy)) : 0x888888 })
    const targets = buildTargets(graph.nodes, colorBy, ringRadiusFor(graph.nodes.length, groups.length))
    eng.regroup(targets, cluster)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorBy])

  useEffect(() => { engineRef.current?.setFocus(focusSet) }, [focusSet])
  useEffect(() => { engineRef.current?.setSelected(selected) }, [selected])
  useEffect(() => { engineRef.current?.setLabelMode(labelMode) }, [labelMode])
  // group-pill spotlight — a pure dim overlay, no data/sim change (see groupHighlightIds above)
  useEffect(() => { engineRef.current?.setGroupHighlight(groupHighlightIds) }, [groupHighlightIds])
  useEffect(() => {
    const eng = engineRef.current; if (!eng || !ready) return
    eng.setParams({ cluster })
    const targets = buildTargets(graph.nodes, colorBy, ringRadiusFor(graph.nodes.length, groups.length))
    eng.regroup(targets, cluster)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cluster])

  const hoverNote = hover ? nodeById.get(hover.id) : null
  const selNote = selected ? nodeById.get(selected) : null

  // colour of a group key under the active dimension (reuses colorOf via a stub node)
  const groupColor = (gk: string) => colorOf(
    { product: colorBy === 'product' ? gk : 'HQ', type: colorBy === 'type' ? gk : 'note', layer: colorBy === 'layer' ? gk : undefined } as GraphNode,
    colorBy,
  )
  // chip text: layers show their real name (Toolchain, Data, …), not the L0 code —
  // the code + name both still show in the hover title via groupLabel().
  const chipLabel = (gk: string) => colorBy === 'layer' ? (LAYER_LABEL[gk as Layer] || 'Unassigned') : gk

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div ref={wrapRef} style={{ position: 'absolute', inset: 0 }} />

      {/* grouping card — top-left: colour dimension + interactive group filter.
          Each group of the active dimension (products / L0–L7 / types) is a
          clickable colour-dot capsule that isolates that group. */}
      <div style={{
        position: 'absolute', top: 12, left: 12, width: 214, pointerEvents: 'auto',
        background: 'var(--v-bg1)', border: '1px solid var(--v-bd)', borderRadius: 16, padding: 13,
        boxShadow: '0 12px 40px rgba(0,0,0,.42)', backdropFilter: 'blur(12px)',
        maxHeight: 'calc(100% - 24px)', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 11 }}>
          <Palette size={13} color="var(--v-tx2)" />
          <div style={{ display: 'flex', gap: 4 }}>
            {(['product', 'layer', 'type'] as ColorBy[]).map(c => (
              <Chip key={c} active={colorBy === c} onClick={() => changeColorBy(c)}>{c}</Chip>
            ))}
          </div>
        </div>
        <div style={{ height: 1, background: 'var(--v-bd)', margin: '0 -13px 11px' }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Chip active={groupFilter === null} onClick={() => setGroupFilter(null)}>all</Chip>
          {groups.map(gk => (
            <Chip key={gk} dot={groupColor(gk)} active={groupFilter === gk}
              title={groupLabel(gk, colorBy)}
              onClick={() => setGroupFilter(f => f === gk ? null : gk)}>
              {chipLabel(gk)}
            </Chip>
          ))}
        </div>
        <div style={{ height: 1, background: 'var(--v-bd)', margin: '11px -13px' }} />
        <Chip active={!showOrphans} onClick={() => setShowOrphans(o => !o)}>orphans {showOrphans ? 'on' : 'off'}</Chip>
      </div>

      {/* display controls — top-right (clear of the grouping card) */}
      <div style={{ position: 'absolute', top: 12, left: 238, right: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--v-bg2)', border: '1px solid var(--v-bd)', borderRadius: 999, padding: '4px 12px', pointerEvents: 'auto' }}>
          <Search size={13} color="var(--v-tx2)" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a node…"
            onKeyDown={e => { if (e.key === 'Enter' && searchHits[0]) { setSelected(searchHits[0].id); setQ('') } }}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--v-tx)', fontSize: 13, width: 140 }} />
        </div>
        <div style={segment}>
          <TypeIcon size={13} color="var(--v-tx2)" style={{ margin: '0 2px' }} />
          {(['off', 'auto', 'always'] as LabelMode[]).map(m => (
            <Chip key={m} active={labelMode === m} onClick={() => setLabelMode(m)}>{m}</Chip>
          ))}
        </div>
        <div style={{ ...segment, gap: 8, padding: '4px 12px' }}>
          <Layers size={13} color="var(--v-tx2)" />
          <input type="range" min={0} max={0.4} step={0.01} value={cluster} onChange={e => setCluster(+e.target.value)} style={{ width: 84 }} />
        </div>
        <select value={typeF} onChange={e => setTypeF(e.target.value as NoteType | 'all')}
          style={{ pointerEvents: 'auto', background: 'var(--v-bg2)', color: 'var(--v-tx2)', border: '1px solid var(--v-bd)', borderRadius: 999, padding: '5px 12px', fontSize: 12 }}>
          {NODE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* zoom controls */}
      <div style={{ position: 'absolute', right: 10, bottom: 10, display: 'flex', gap: 6, alignItems: 'center', pointerEvents: 'auto' }}>
        <span style={{ fontSize: 11, color: 'var(--v-tx2)', marginRight: 2 }}>{zoomPct}%</span>
        <button style={iconBtn} title="Zoom out" onClick={() => engineRef.current?.zoomBy(0.8)}><Minus size={13} /></button>
        <button style={iconBtn} title="Zoom in" onClick={() => engineRef.current?.zoomBy(1.25)}><Plus size={13} /></button>
        <button style={iconBtn} title="Fit graph" onClick={() => engineRef.current?.fit(120, true)}><Maximize2 size={13} /></button>
      </div>

      {/* hover tooltip */}
      {hover && hoverNote && (
        <div style={{ position: 'absolute', left: Math.min(hover.x + 12, (wrapRef.current?.clientWidth || 800) - 220), top: hover.y + 12, pointerEvents: 'none', background: 'var(--v-bg1)', border: '1px solid var(--v-bd)', borderRadius: 10, padding: '8px 11px', maxWidth: 220, boxShadow: '0 8px 30px rgba(0,0,0,.4)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v-tx)' }}>{hoverNote.title}</div>
          <div style={{ fontSize: 11, color: 'var(--v-tx2)', marginTop: 2 }}>{hoverNote.type} · {hoverNote.linkCount} links{hoverNote.layer ? ` · ${hoverNote.layer}` : ''}</div>
        </div>
      )}

      {/* selected inspector */}
      {selNote && (
        <div style={{ position: 'absolute', right: 10, top: 52, width: 260, background: 'var(--v-bg1)', border: '1px solid var(--v-bd)', borderRadius: 12, padding: 14, pointerEvents: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,.45)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--v-tx)' }}>{selNote.title}</div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v-tx2)' }}><X size={15} /></button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--v-tx2)', margin: '4px 0 8px' }}>
            {selNote.product} · {selNote.type} · {selNote.linkCount} links{selNote.layer ? ` · ${selNote.layer}` : ''}
          </div>
          <p style={{ fontSize: 12, color: 'var(--v-tx2)', lineHeight: 1.5, margin: 0 }}>{noteSummary(notes[selNote.id]?.body || '')}</p>
          <button onClick={() => openNote(selNote.id)} style={{ marginTop: 12, width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 999, border: '1px solid var(--v-acc)', background: 'var(--v-acc)', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            <LocateFixed size={13} /> Open note
          </button>
        </div>
      )}
    </div>
  )
}
