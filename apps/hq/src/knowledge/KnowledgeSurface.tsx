// WS3 — the Cognitive Cortex surface. A read-only brain over the REAL vault: a
// wrinkled two-hemisphere cortex whose neurons are grouped into the 7 reactor
// spine regions (Command Core … Sense) and the THINK · KNOW · DO triad, firing
// like real neurons. Clicking a neuron opens its real note. Crash-safe: any 3D
// failure degrades to the 2D graph instead of a blank.

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Brain, ExternalLink, X, AlertTriangle, Activity, Play, Film, Square } from 'lucide-react'
import { useVault } from '../vault/store'
import { useHQ } from '../shell/store'
import { GraphViewV3 } from '../vault/components/GraphViewV3'
import '../vault/vault.css'
import { buildKnowledgeModel } from './model'
import { KnowledgeScene } from './KnowledgeScene'
import { useKnowledge } from './store'
import {
  corticalTissue, REGIONS, REGION_BY_ID, TRIAD_COLOR, TRIAD_LABEL, TRIAD_HINT,
  type Triad, type RegionId,
} from './brain'
import { ONTOLOGY_COLOR } from './ontology'
import { PROVENANCE_META } from './provenance'
import { MOCK_SCRIPT, sceneStateForBeat } from './mockDirector'
import { cameraRegionFor } from './activation'
import type { KModel } from './model'

function hasWebGL(): boolean {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false }
}
const TRIADS: Triad[] = ['think', 'know', 'do']

// ── top-level boundary: never blank, print the error on screen ──────────────
export function KnowledgeSurface() {
  return <SurfaceBoundary><KnowledgeSurfaceInner /></SurfaceBoundary>
}
class SurfaceBoundary extends Component<{ children: ReactNode }, { error: string | null; stack: string }> {
  state = { error: null as string | null, stack: '' }
  static getDerivedStateFromError(err: unknown) { return { error: (err as Error)?.message || String(err), stack: (err as Error)?.stack || '' } }
  componentDidCatch(err: unknown) { console.error('[KnowledgeSurface] crashed:', err) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ position: 'absolute', inset: 0, background: '#0a0c16', color: '#e6e9f5', padding: 28, overflow: 'auto', fontFamily: 'ui-monospace, monospace' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#fca5a5', marginBottom: 10 }}>Cognitive Cortex failed to render</div>
        <div style={{ fontSize: 13, color: '#fbbf24', marginBottom: 14 }}>{this.state.error}</div>
        <pre style={{ fontSize: 11, color: '#8891b5', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{this.state.stack.split('\n').slice(0, 12).join('\n')}</pre>
      </div>
    )
  }
}
class SceneBoundary extends Component<{ fallback: (msg: string) => ReactNode; children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null }
  static getDerivedStateFromError(err: unknown) { return { error: (err as Error)?.message || String(err) } }
  componentDidCatch(err: unknown) { console.error('[KnowledgeSurface] 3D scene failed:', err) }
  render() { return this.state.error ? this.props.fallback(this.state.error) : this.props.children }
}

function KnowledgeSurfaceInner() {
  const notes = useVault((s) => s.notes)
  const go = useHQ((s) => s.go)
  const dark = useHQ((s) => s.theme) === 'dark'
  const webgl = useMemo(hasWebGL, [])
  // chrome palette that follows the app theme (canvas theme lives in the scene)
  const ui = dark
    ? { rootBg: '#04050d', glass: 'rgba(8,10,22,.62)', border: '#232c52', tx: '#eef2ff', tx2: '#8891b5', tx3: '#cdd5f0' }
    : { rootBg: '#eaeef7', glass: 'rgba(255,255,255,.82)', border: '#ccd6ec', tx: '#0b1020', tx2: '#5b6690', tx3: '#28324f' }

  const model = useMemo(() => buildKnowledgeModel(notes), [notes])
  const tissue = useMemo(() => corticalTissue(16000), [])

  const selected = useKnowledge((s) => s.selected)
  const setSelected = useKnowledge((s) => s.setSelected)
  const setFocus = useKnowledge((s) => s.setFocus)
  const triadFilter = useKnowledge((s) => s.triadFilter)
  const setTriadFilter = useKnowledge((s) => s.setTriadFilter)
  const regionFilter = useKnowledge((s) => s.regionFilter)
  const setRegionFilter = useKnowledge((s) => s.setRegionFilter)
  const hemiFilter = useKnowledge((s) => s.hemiFilter)
  const setHemiFilter = useKnowledge((s) => s.setHemiFilter)
  const simRunning = useKnowledge((s) => s.simRunning)
  const setSim = useKnowledge((s) => s.setSim)
  const setScene = useKnowledge((s) => s.setScene)
  const cinematicCaption = useKnowledge((s) => s.cinematicCaption)

  const selNode = selected ? model.byId.get(selected) : null

  // ── Run 2: the mock Cinema Director ─────────────────────────────────────
  // Steps through MOCK_SCRIPT on a timer (a stand-in for the audio clock),
  // emitting a SceneState per beat. The scene never reads audio itself — it
  // only reacts to what this player (or, later, the real WS1 Director) hands
  // it via setScene. Camera framing is derived the same way real narration
  // would drive it: cameraRegionFor(state) → a region's hero neuron, or the
  // whole-brain overview, or "leave it" for dormant/popup beats.
  const [cinematicOn, setCinematicOn] = useState(false)
  const cineTimers = useRef<number[]>([])
  const clearCineTimers = () => { cineTimers.current.forEach(clearTimeout); cineTimers.current = [] }
  useEffect(() => () => clearCineTimers(), [])

  const focusRegion = (region: RegionId, m: KModel) => {
    const hero = m.nodes.find((n) => n.hero && n.region === region)
    setFocus(hero ? hero.id : null)
  }

  const stopCinematic = () => {
    clearCineTimers()
    setCinematicOn(false)
    setScene(null, null)
    setFocus(null)
  }

  const playCinematic = () => {
    clearCineTimers()
    setSelected(null)
    setCinematicOn(true)
    let t = 0
    MOCK_SCRIPT.forEach((beat) => {
      cineTimers.current.push(window.setTimeout(() => {
        setScene(sceneStateForBeat(beat), beat.caption)
        const camTarget = cameraRegionFor(beat.state)
        if (camTarget === 'overview') setFocus(null)
        else if (camTarget) focusRegion(camTarget, model)
        // camTarget === null → leave the camera exactly where it is
      }, t))
      t += beat.hold
    })
    // deterministic return to the resting whole-brain frame
    cineTimers.current.push(window.setTimeout(() => stopCinematic(), t))
  }

  // heartbeat: if the scene never draws a frame, fall back to the 2D graph
  const drewRef = useRef(false)
  const [dead, setDead] = useState(false)
  useEffect(() => {
    let t = 0
    const arm = () => { clearTimeout(t); t = window.setTimeout(() => { if (!drewRef.current) setDead(true) }, 5000) }
    if (!document.hidden) arm()
    const onVis = () => { if (!document.hidden && !drewRef.current) arm() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  // measure container + kick R3F awake (see the vite/rAF notes in history)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 1, h: 1 })
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 1, h: el.clientHeight || 1 }))
    ro.observe(el)
    setSize({ w: el.clientWidth || 1, h: el.clientHeight || 1 })
    const kick = () => window.dispatchEvent(new Event('resize'))
    const kicks = [0, 120, 500].map((ms) => window.setTimeout(kick, ms))
    const onVis = () => { if (!document.hidden) kick() }
    document.addEventListener('visibilitychange', onVis)
    return () => { ro.disconnect(); kicks.forEach(clearTimeout); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  const openRealNote = (noteId: string) => { useVault.getState().openNote(noteId); go('vault') }
  const fallback = (msg: string) => (
    <div className="vault" style={{ position: 'absolute', inset: 0 }}>
      <div style={banner}>{msg} — showing the 2D knowledge graph.</div>
      <div style={{ position: 'absolute', inset: '34px 0 0' }}><GraphViewV3 /></div>
    </div>
  )

  return (
    <div style={{ position: 'absolute', inset: 0, background: ui.rootBg, overflow: 'hidden' }}>
      <style>{`.kg-canvas canvas{width:100%!important;height:100%!important;display:block}`}</style>
      {webgl && !dead ? (
        <div ref={wrapRef} className="kg-canvas" style={{ position: 'absolute', inset: 0 }}>
          <SceneBoundary fallback={(msg) => fallback('3D cortex unavailable (' + msg + ')')}>
            <Suspense fallback={<Loading />}>
              <KnowledgeScene key={dark ? 'dark' : 'light'} model={model} tissue={tissue} width={size.w} height={size.h} dark={dark}
                onFrame={() => { drewRef.current = true }} />
            </Suspense>
          </SceneBoundary>
        </div>
      ) : webgl && dead ? fallback("3D cortex didn't start on this device")
        : fallback('WebGL unavailable')}

      {/* hemisphere labels */}
      {webgl && (
        <>
          <SideLabel side="left" title="ANALYTIC" sub="left hemisphere · data · logic · structure"
            active={hemiFilter === 'left'} onClick={() => setHemiFilter(hemiFilter === 'left' ? null : 'left')} count={model.hemiCounts.left} />
          <SideLabel side="right" title="CREATIVE" sub="right hemisphere · product · narrative · design"
            active={hemiFilter === 'right'} onClick={() => setHemiFilter(hemiFilter === 'right' ? null : 'right')} count={model.hemiCounts.right} />
        </>
      )}

      {/* title */}
      <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', alignItems: 'center', gap: 11, pointerEvents: 'none' }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#8b7cf6,#38bdf8)', boxShadow: '0 0 20px #8b7cf699' }}>
          <Brain size={18} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: ui.tx, letterSpacing: 0.3 }}>Cognitive Cortex</div>
          <div style={{ fontSize: 10.5, color: ui.tx2, letterSpacing: 0.5 }}>{model.nodes.length} REAL NEURONS · 7-REGION BRAIN OF THE VAULT</div>
        </div>
      </div>

      {/* THINK · KNOW · DO + simulate (top-center) */}
      {webgl && (
        <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, alignItems: 'center', pointerEvents: 'auto' }}>
          {TRIADS.map((c) => {
            const on = triadFilter === c, col = TRIAD_COLOR[c]
            return (
              <button key={c} title={TRIAD_HINT[c]} onClick={() => setTriadFilter(on ? null : c)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 999, cursor: 'pointer', border: '1px solid ' + (on ? col : col + '44'), background: on ? col + '26' : ui.glass, color: on ? '#fff' : ui.tx3, backdropFilter: 'blur(10px)', fontWeight: 700, fontSize: 12, letterSpacing: 0.5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 9, background: col, boxShadow: `0 0 8px ${col}` }} />
                {TRIAD_LABEL[c]}<span style={{ fontSize: 10.5, opacity: 0.6, fontWeight: 500 }}>{model.triadCounts[c]}</span>
              </button>
            )
          })}
          <button onClick={() => setSim(!simRunning)} title="Neuron-firing simulation: action potentials fire along the axons"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 999, cursor: 'pointer', border: '1px solid ' + (simRunning ? '#4ade8088' : '#34407a'), background: simRunning ? '#4ade8018' : ui.glass, color: simRunning ? '#86efac' : ui.tx3, backdropFilter: 'blur(10px)', fontWeight: 600, fontSize: 12 }}>
            {simRunning ? <Activity size={13} /> : <Play size={12} />} {simRunning ? 'Firing' : 'Fire'}
          </button>
          <button onClick={() => (cinematicOn ? stopCinematic() : playCinematic())}
            title="Mirror the 46-scene cinematic narration — the mapped brain region lights up per beat"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 999, cursor: 'pointer', border: '1px solid ' + (cinematicOn ? '#f472b688' : '#34407a'), background: cinematicOn ? '#f472b618' : ui.glass, color: cinematicOn ? '#f9a8d4' : ui.tx3, backdropFilter: 'blur(10px)', fontWeight: 600, fontSize: 12 }}>
            {cinematicOn ? <Square size={12} /> : <Film size={13} />} {cinematicOn ? 'Stop' : 'Cinematic'}
          </button>
        </div>
      )}

      {/* Run 2: cinematic caption — mirrors the narration beat currently lighting the brain */}
      {webgl && cinematicOn && cinematicCaption && (
        <div style={{ position: 'absolute', bottom: 66, left: '50%', transform: 'translateX(-50%)', maxWidth: 640, textAlign: 'center', pointerEvents: 'none' }}>
          <div style={{ display: 'inline-block', padding: '9px 18px', borderRadius: 12, background: ui.glass, border: '1px solid #f472b655', backdropFilter: 'blur(10px)', color: ui.tx, fontSize: 13.5, lineHeight: 1.5, boxShadow: '0 10px 32px rgba(0,0,0,.35)' }}>
            {cinematicCaption}
          </div>
        </div>
      )}

      {/* 7-region spine legend (bottom-center) */}
      {webgl && (
        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5, alignItems: 'center', background: ui.glass, border: '1px solid #232c52', borderRadius: 999, padding: '6px 8px', backdropFilter: 'blur(10px)', pointerEvents: 'auto', maxWidth: '78vw', flexWrap: 'wrap', justifyContent: 'center' }}>
          {REGIONS.map((r) => {
            const on = regionFilter === r.id
            return (
              <button key={r.id} title={`${r.label} · ${r.verb} · ${TRIAD_LABEL[r.triad]}`} onClick={() => setRegionFilter(on ? null : r.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', border: '1px solid ' + (on ? r.color : 'transparent'), background: on ? r.color + '22' : 'transparent', color: on ? '#fff' : ui.tx3, fontSize: 11.5, fontWeight: 600 }}>
                <span style={{ width: 9, height: 9, borderRadius: 9, background: r.color, boxShadow: `0 0 7px ${r.color}` }} />
                {r.label}<span style={{ fontSize: 10, opacity: 0.55 }}>{model.regionCounts[r.id]}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* provenance (bottom-left) */}
      {webgl && (
        <div style={{ position: 'absolute', bottom: 62, left: 16, display: 'flex', gap: 12, alignItems: 'center', background: ui.glass, border: '1px solid #232c52', borderRadius: 12, padding: '7px 12px', backdropFilter: 'blur(10px)' }}>
          <span style={{ fontSize: 10, color: ui.tx2, letterSpacing: 0.6 }}>PROVENANCE</span>
          {(['live', 'partial', 'simulated', 'placeholder'] as const).map((p) => (
            <span key={p} title={PROVENANCE_META[p].hint} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: ui.tx3 }}>
              <span style={{ width: 9, height: 9, borderRadius: 9, background: '#8b7cf6', opacity: p === 'live' ? 1 : p === 'partial' ? 0.65 : p === 'simulated' ? 0.42 : 0.25 }} />
              {PROVENANCE_META[p].label}
            </span>
          ))}
        </div>
      )}

      {/* inspector */}
      {selNode && (
        <div style={{ position: 'absolute', right: 16, top: 16, width: 280, background: ui.glass, border: '1px solid #2a3566', borderRadius: 14, padding: 16, backdropFilter: 'blur(14px)', boxShadow: '0 16px 50px rgba(0,0,0,.55)', pointerEvents: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: '#f0f3ff', lineHeight: 1.25 }}>{selNode.label}</div>
            <button onClick={() => { setSelected(null); setFocus(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: ui.tx2, flex: 'none' }}><X size={16} /></button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
            <Chip color={REGION_BY_ID.get(selNode.region)!.color}>{REGION_BY_ID.get(selNode.region)!.label}</Chip>
            <Chip color={TRIAD_COLOR[selNode.triad]}>{TRIAD_LABEL[selNode.triad]}</Chip>
            <Chip color={ONTOLOGY_COLOR[selNode.ontology]}>{selNode.ontology}</Chip>
            <Chip color={PROVENANCE_META[selNode.provenance].color}>{PROVENANCE_META[selNode.provenance].label}</Chip>
          </div>
          <p style={{ fontSize: 12.5, color: '#aab4da', lineHeight: 1.55, margin: '0 0 14px' }}>{selNode.summary || 'No summary available.'}</p>
          {selNode.noteId ? (
            <button onClick={() => openRealNote(selNode.noteId!)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 20px #6366f155' }}>
              <ExternalLink size={14} /> Open real note in Vault
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10, background: '#f59e0b18', border: '1px solid #f59e0b55', color: '#fbbf24', fontSize: 12 }}>
              <AlertTriangle size={15} /> Missing source
            </div>
          )}
          <div style={{ marginTop: 10, fontSize: 10.5, color: '#6b769e' }}>{selNode.hemisphere === 'left' ? 'Analytic' : selNode.hemisphere === 'right' ? 'Creative' : 'Executive'} · {selNode.degree} links</div>
        </div>
      )}
    </div>
  )
}

function SideLabel({ side, title, sub, active, onClick, count }: { side: 'left' | 'right'; title: string; sub: string; active: boolean; onClick: () => void; count: number }) {
  const col = side === 'left' ? '#7dd3fc' : '#c4b5fd'
  return (
    <button onClick={onClick} title={`Isolate the ${title.toLowerCase()} hemisphere`}
      style={{ position: 'absolute', top: '44%', ...(side === 'left' ? { left: 16 } : { right: 16 }), transform: 'translateY(-50%)', textAlign: side, pointerEvents: 'auto', maxWidth: 160, cursor: 'pointer', background: active ? col + '1a' : 'transparent', border: '1px solid ' + (active ? col + '66' : 'transparent'), borderRadius: 12, padding: '8px 12px' }}>
      <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, color: col, opacity: active ? 1 : 0.8 }}>{title}</div>
      <div style={{ fontSize: 10, color: '#5a6690', letterSpacing: 0.3, marginTop: 3, lineHeight: 1.4 }}>{sub}</div>
      <div style={{ fontSize: 10, color: col, opacity: 0.7, marginTop: 3 }}>{count} neurons</div>
    </button>
  )
}
function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: color + '22', color, border: '1px solid ' + color + '55' }}>{children}</span>
}
function Loading() {
  return <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#8891b5', fontSize: 13 }}>Waking the cortex…</div>
}
const banner: React.CSSProperties = {
  position: 'absolute', top: 0, left: 0, right: 0, height: 34, display: 'grid', placeItems: 'center',
  background: '#1a1520', color: '#fbbf24', fontSize: 12, borderBottom: '1px solid #33251a', zIndex: 5,
}
