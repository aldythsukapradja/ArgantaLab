// WS3 — the Knowledge surface: the 3D spatial digital twin over the real Vault.
// Additive + read-only. The 2D Vault stays the operational workspace; clicking a
// node here hands off to open the REAL note there. Falls back to the existing 2D
// graph when WebGL is unavailable.

import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Compass, Play, Square, ExternalLink, X, FileText, AlertTriangle, Filter } from 'lucide-react'
import { useVault } from '../vault/store'
import { useHQ } from '../shell/store'
import { GraphViewV3 } from '../vault/components/GraphViewV3'
import '../vault/vault.css'
import { buildKnowledgeModel, type KModel } from './model'
import { KnowledgeScene } from './KnowledgeScene'
import { useKnowledge } from './store'
import { PROVENANCE_META, type Provenance } from './provenance'
import { ONTOLOGY_COLOR } from './ontology'
import { TOUR_A } from './tours'

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { return false }
}

const PROV_ORDER: Provenance[] = ['live', 'partial', 'simulated', 'placeholder']

export function KnowledgeSurface() {
  const notes = useVault((s) => s.notes)
  const go = useHQ((s) => s.go)
  const webgl = useMemo(hasWebGL, [])

  const model: KModel = useMemo(() => buildKnowledgeModel(notes), [notes])

  const selected = useKnowledge((s) => s.selected)
  const setSelected = useKnowledge((s) => s.setSelected)
  const setFocus = useKnowledge((s) => s.setFocus)
  const setSpotlight = useKnowledge((s) => s.setSpotlight)
  const setTour = useKnowledge((s) => s.setTour)
  const tourActive = useKnowledge((s) => s.tourActive)
  const tourLabel = useKnowledge((s) => s.tourLabel)
  const provFilter = useKnowledge((s) => s.provFilter)
  const setProvFilter = useKnowledge((s) => s.setProvFilter)

  const selNode = selected ? model.byId.get(selected) : null

  // neighbours of a node (for spotlight during tours / selection)
  const neighborsOf = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const e of model.edges) {
      if (!m.has(e.a)) m.set(e.a, new Set([e.a]))
      if (!m.has(e.b)) m.set(e.b, new Set([e.b]))
      m.get(e.a)!.add(e.b); m.get(e.b)!.add(e.a)
    }
    return m
  }, [model])

  // R3F measures its parent on mount; when the surface arrives via a lazy
  // Suspense boundary the container can read 0×0 for the first frame and the
  // ResizeObserver never sees a change afterwards. Nudge a resize once mounted.
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => window.dispatchEvent(new Event('resize'))))
    return () => cancelAnimationFrame(raf)
  }, [])

  // ---- Tour A player (mock audio clock) ----
  const timers = useRef<number[]>([])
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  useEffect(() => () => clearTimers(), [])

  const stopTour = () => {
    clearTimers()
    setTour(false, null)
    setFocus(null)
    setSpotlight(null)
  }

  const playTourA = () => {
    clearTimers()
    setSelected(null)
    setTour(true, TOUR_A.name + ' · starting…')
    let t = 0
    TOUR_A.beats.forEach((beat) => {
      timers.current.push(window.setTimeout(() => {
        setFocus(beat.focus)
        setSpotlight(beat.focus ? (neighborsOf.get(beat.focus) || new Set([beat.focus])) : null)
        setTour(true, beat.caption)
      }, t))
      t += beat.hold
    })
    // deterministic return to the overview / resting frame
    timers.current.push(window.setTimeout(() => stopTour(), t))
  }

  const openRealNote = (noteId: string) => {
    useVault.getState().openNote(noteId)
    go('vault')
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#05060f', overflow: 'hidden' }}>
      {webgl ? (
        <Suspense fallback={<Loading />}>
          <KnowledgeScene model={model} />
        </Suspense>
      ) : (
        <div className="vault" style={{ position: 'absolute', inset: 0 }}>
          <div style={banner}>WebGL unavailable — showing the 2D knowledge graph.</div>
          <div style={{ position: 'absolute', inset: '34px 0 0' }}><GraphViewV3 /></div>
        </div>
      )}

      {/* ---- top-left: title + tour ---- */}
      <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#8b7cf6,#38bdf8)', boxShadow: '0 0 18px #8b7cf688' }}>
            <Compass size={17} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#eef2ff', letterSpacing: 0.3 }}>Knowledge Nodes</div>
            <div style={{ fontSize: 10.5, color: '#8891b5', letterSpacing: 0.4 }}>3D DIGITAL TWIN · OVER THE REAL VAULT</div>
          </div>
        </div>
        {webgl && (
          <div style={{ pointerEvents: 'auto' }}>
            {!tourActive ? (
              <button onClick={playTourA} style={pillBtn}>
                <Play size={13} /> Auto Tour A · Company anatomy
              </button>
            ) : (
              <button onClick={stopTour} style={{ ...pillBtn, borderColor: '#f5738555', color: '#fda4af' }}>
                <Square size={12} /> Stop tour
              </button>
            )}
          </div>
        )}
      </div>

      {/* ---- tour caption (bottom-center) ---- */}
      {tourActive && tourLabel && (
        <div style={{ position: 'absolute', bottom: 34, left: '50%', transform: 'translateX(-50%)', maxWidth: 620, textAlign: 'center', pointerEvents: 'none' }}>
          <div style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 12, background: 'rgba(8,10,22,.72)', border: '1px solid #2a3566', backdropFilter: 'blur(10px)', color: '#dfe6ff', fontSize: 14, lineHeight: 1.5, boxShadow: '0 12px 40px rgba(0,0,0,.5)' }}>
            {tourLabel}
          </div>
        </div>
      )}

      {/* ---- provenance legend + filter (top-right) ---- */}
      {webgl && (
        <div style={{ position: 'absolute', top: 16, right: 16, width: 210, background: 'rgba(9,11,24,.72)', border: '1px solid #232c52', borderRadius: 14, padding: 13, backdropFilter: 'blur(12px)', boxShadow: '0 12px 40px rgba(0,0,0,.45)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: '#8891b5', letterSpacing: 0.6, marginBottom: 10, textTransform: 'uppercase' }}>
            <Filter size={12} /> Provenance
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {PROV_ORDER.map((p) => {
              const meta = PROVENANCE_META[p]
              const on = provFilter === p
              return (
                <button key={p} title={meta.hint} onClick={() => setProvFilter(on ? null : p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', textAlign: 'left', border: '1px solid ' + (on ? meta.color + '88' : 'transparent'), background: on ? meta.color + '1e' : 'transparent', color: '#cdd5f0' }}>
                  <span style={{ width: 11, height: 11, borderRadius: 11, flex: 'none', background: p === 'simulated' || p === 'placeholder' ? 'transparent' : meta.color, border: '1.5px solid ' + meta.color, boxShadow: p === 'live' ? '0 0 8px ' + meta.color : 'none' }} />
                  <span style={{ fontSize: 12 }}>{meta.label}</span>
                </button>
              )
            })}
          </div>
          <div style={{ height: 1, background: '#232c52', margin: '10px 0' }} />
          <div style={{ fontSize: 10.5, color: '#8891b5', lineHeight: 1.5 }}>
            <span style={{ color: '#93a4d8' }}>━</span> confirmed link &nbsp;
            <span style={{ color: '#8b7cf6' }}>┄</span> suggested
          </div>
        </div>
      )}

      {/* ---- inspector (right) ---- */}
      {selNode && (
        <div style={{ position: 'absolute', right: 16, top: webgl ? 250 : 16, width: 272, background: 'rgba(9,11,24,.82)', border: '1px solid #2a3566', borderRadius: 14, padding: 16, backdropFilter: 'blur(14px)', boxShadow: '0 16px 50px rgba(0,0,0,.55)', pointerEvents: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f3ff', lineHeight: 1.25 }}>{selNode.label}</div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8891b5', flex: 'none' }}><X size={16} /></button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
            <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: ONTOLOGY_COLOR[selNode.ontology] + '22', color: ONTOLOGY_COLOR[selNode.ontology], border: '1px solid ' + ONTOLOGY_COLOR[selNode.ontology] + '55' }}>{selNode.ontology}</span>
            <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: PROVENANCE_META[selNode.provenance].color + '22', color: PROVENANCE_META[selNode.provenance].color, border: '1px solid ' + PROVENANCE_META[selNode.provenance].color + '55' }}>{PROVENANCE_META[selNode.provenance].label}</span>
            {selNode.spine && <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: '#8b7cf622', color: '#a78bfa', border: '1px solid #8b7cf655' }}>Spine</span>}
          </div>
          <p style={{ fontSize: 12.5, color: '#aab4da', lineHeight: 1.55, margin: '0 0 14px' }}>{selNode.summary || 'No summary available.'}</p>

          {selNode.noteId ? (
            <button onClick={() => openRealNote(selNode.noteId!)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 20px #6366f155' }}>
              <ExternalLink size={14} /> Open real note in Vault
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10, background: '#f59e0b18', border: '1px solid #f59e0b55', color: '#fbbf24', fontSize: 12 }}>
              <AlertTriangle size={15} /> Missing source — no vault note resolves to this node.
            </div>
          )}
          <div style={{ marginTop: 10, fontSize: 10.5, color: '#6b769e', display: 'flex', alignItems: 'center', gap: 5 }}>
            <FileText size={11} /> {selNode.noteId ? selNode.noteId : '—'} · {selNode.degree} links
          </div>
        </div>
      )}

      {/* ---- grounding banner (bottom-left) ---- */}
      {model.missing.length > 0 && (
        <div style={{ position: 'absolute', bottom: 16, left: 16, fontSize: 11, color: '#fbbf24', background: '#f59e0b18', border: '1px solid #f59e0b44', padding: '6px 11px', borderRadius: 8 }}>
          {model.missing.length} spine node(s) missing a source
        </div>
      )}
    </div>
  )
}

function Loading() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#8891b5', fontSize: 13 }}>
      Building the constellation…
    </div>
  )
}

const pillBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999,
  background: 'rgba(12,14,30,.7)', border: '1px solid #34407a', color: '#cdd5f0', fontSize: 12.5,
  fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(10px)',
}
const banner: React.CSSProperties = {
  position: 'absolute', top: 0, left: 0, right: 0, height: 34, display: 'grid', placeItems: 'center',
  background: '#1a1520', color: '#fbbf24', fontSize: 12, borderBottom: '1px solid #33251a', zIndex: 5,
}
