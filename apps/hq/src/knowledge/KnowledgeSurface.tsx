// WS3 — the Cognitive Cortex surface. A read-only brain over the REAL vault: a
// wrinkled two-hemisphere cortex whose neurons are grouped into the 7 reactor
// spine regions (Command Core … Sense) and the THINK · KNOW · DO triad, firing
// like real neurons. Clicking a neuron opens its real note. Crash-safe: any 3D
// failure degrades to the 2D graph instead of a blank.

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Brain, ExternalLink, X, AlertTriangle, Activity, Play, Pause, Film,
  SkipBack, SkipForward, RotateCcw, Gauge, Orbit, Sparkles,
} from 'lucide-react'
import { DesignPanel } from './DesignPanel'
import { useDesign, FORMS } from './design'
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
  const tissue = useMemo(() => corticalTissue(22000), [])

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

  // ── Run 2/3: the mock Cinema Director, now a real transport ─────────────
  // A clock-driven player (not pre-scheduled timeouts) so it can be scrubbed,
  // paused, sped up, and jumped beat-by-beat or act-by-act — mirroring the
  // real cinema's transport (prev/next/scrub/act-tabs). It emits a SceneState
  // per beat; the scene never reads audio itself, only what this player (or,
  // later, the real WS1 Director) hands it via setScene. Camera framing is
  // derived the same way real narration would drive it: cameraRegionFor(state)
  // → a region's hero neuron, the whole-brain overview, or "leave it" for
  // dormant/popup beats.
  const TICK_MS = 120
  const totalMs = useMemo(() => MOCK_SCRIPT.reduce((s, b) => s + b.hold, 0), [])
  const [cineActive, setCineActive] = useState(false)   // engaged at all (playing or paused)
  const [cinePlaying, setCinePlaying] = useState(false) // actively advancing
  const [cineIndex, setCineIndex] = useState(0)         // current beat
  const [cineElapsed, setCineElapsed] = useState(0)      // ms into current beat
  const [cineSpeed, setCineSpeed] = useState(1)          // 1 | 2 | 4

  // "latest" refs so the persistent interval always reads current values
  // without needing to be torn down and recreated every tick.
  const cineIndexRef = useRef(0); cineIndexRef.current = cineIndex
  const cineElapsedRef = useRef(0); cineElapsedRef.current = cineElapsed
  const cineSpeedRef = useRef(1); cineSpeedRef.current = cineSpeed

  const focusRegion = (region: RegionId, m: KModel) => {
    const hero = m.nodes.find((n) => n.hero && n.region === region)
    setFocus(hero ? hero.id : null)
  }

  // Push a beat's SceneState + camera framing. `elapsedMs` also refreshes the
  // caption (a scrub/seek always shows the beat it lands on).
  const pushBeat = (idx: number, elapsedMs: number, moveCamera: boolean) => {
    const beat = MOCK_SCRIPT[idx]; if (!beat) return
    setScene(sceneStateForBeat(beat, elapsedMs / 1000), beat.caption)
    if (moveCamera) {
      const camTarget = cameraRegionFor(beat.state)
      if (camTarget === 'overview') setFocus(null)
      else if (camTarget) focusRegion(camTarget, model)
      // camTarget === null → leave the camera exactly where it is
    }
  }

  /** Jump to an exact beat + elapsed offset — used by scrub, prev/next, act
   *  tabs and restart. Always reapplies immediately (no waiting for a tick). */
  const seekTo = (idx: number, elapsedMs = 0) => {
    const clamped = Math.max(0, Math.min(MOCK_SCRIPT.length - 1, idx))
    setCineIndex(clamped); setCineElapsed(elapsedMs)
    pushBeat(clamped, elapsedMs, true)
  }

  const seekToFraction = (frac: number) => {
    const target = Math.max(0, Math.min(totalMs, frac * totalMs))
    let acc = 0
    for (let i = 0; i < MOCK_SCRIPT.length; i++) {
      const hold = MOCK_SCRIPT[i].hold
      if (acc + hold > target || i === MOCK_SCRIPT.length - 1) { seekTo(i, Math.max(0, Math.min(hold, target - acc))); return }
      acc += hold
    }
  }

  const enterCinematic = () => {
    setSelected(null)
    setCineActive(true)
    setCinePlaying(true)
    seekTo(0, 0)
  }
  const exitCinematic = () => {
    setCinePlaying(false); setCineActive(false)
    setCineIndex(0); setCineElapsed(0)
    setScene(null, null); setFocus(null)
  }
  const togglePlayPause = () => setCinePlaying((p) => !p)
  const restart = () => seekTo(0, 0)
  const prevBeat = () => seekTo(cineIndex - 1, 0)
  const nextBeat = () => seekTo(cineIndex + 1, 0)
  const jumpToAct = (act: number) => {
    const idx = MOCK_SCRIPT.findIndex((b) => b.act === act)
    if (idx >= 0) seekTo(idx, 0)
  }
  const cycleSpeed = () => setCineSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))

  // The single persistent ticking driver — only restarts when play/pause toggles.
  useEffect(() => {
    if (!cinePlaying) return
    const iv = window.setInterval(() => {
      const idx = cineIndexRef.current
      const beat = MOCK_SCRIPT[idx]
      if (!beat) return
      const next = cineElapsedRef.current + TICK_MS * cineSpeedRef.current
      if (next >= beat.hold) {
        const ni = idx + 1
        if (ni >= MOCK_SCRIPT.length) { exitCinematic(); return }
        setCineIndex(ni); setCineElapsed(0)
        pushBeat(ni, 0, true)
      } else {
        setCineElapsed(next)
        pushBeat(idx, next, false)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, TICK_MS)
    return () => clearInterval(iv)
  }, [cinePlaying])
  useEffect(() => () => { setScene(null, null) }, []) // unmount safety: never leave the scene "on"

  const cineBeat = MOCK_SCRIPT[cineIndex]
  const cineElapsedBefore = useMemo(() => MOCK_SCRIPT.slice(0, cineIndex).reduce((s, b) => s + b.hold, 0), [cineIndex])
  const cineProgress = totalMs > 0 ? (cineElapsedBefore + cineElapsed) / totalMs : 0
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

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

  // The canvas lives inside the Vault workspace now, so opening a note just
  // switches the center view to the editor (openNote sets centerView='note') —
  // no surface jump. go('vault') stays as a fallback if ever mounted standalone.
  const openRealNote = (noteId: string) => { const v = useVault.getState(); v.openNote(noteId); if (useHQ.getState().surface !== 'knowledge' && useHQ.getState().surface !== 'vault') go('vault') }
  const fallback = (msg: string) => (
    <div className="vault" style={{ position: 'absolute', inset: 0 }}>
      <div style={banner}>{msg} — showing the 2D knowledge graph.</div>
      <div style={{ position: 'absolute', inset: '34px 0 0' }}><GraphViewV3 /></div>
    </div>
  )

  // Navigation: full manual orbit (drag) + zoom (wheel/pinch) + pan always
  // available in the 3D view; "Auto camera" is the gentle idle sway/lean, on
  // by default, pausing itself while the founder is actively driving. "2D
  // Vault" is an explicit escape hatch to the flat graph, independent of the
  // crash/WebGL fallback below.
  const [autoCam, setAutoCam] = useState(true)
  const [designOpen, setDesignOpen] = useState(false)
  const form = useDesign((s) => s.form)
  const formLabel = FORMS.find((f) => f.id === form)?.label ?? 'Brain'
  // The clean 2D graph now lives as the Vault's own "Graph" ribbon tab, so this
  // surface no longer needs its own (amber-bannered) 2D escape hatch. The 3D
  // canvas shows whenever WebGL is alive; genuine failures still fall back below.
  const show3D = webgl && !dead
  const panelUi = { ...ui, panel: dark ? 'rgba(10,12,26,.86)' : 'rgba(255,255,255,.9)' }
  // Narrow container (phone, or the Vault center on mobile) → collapse the
  // desktop overlay chrome so the floating pills/panel don't collide.
  const compact = size.w > 1 && size.w < 640

  return (
    <div style={{ position: 'absolute', inset: 0, background: ui.rootBg, overflow: 'hidden' }}>
      <style>{`.kg-canvas canvas{width:100%!important;height:100%!important;display:block}`}</style>
      {show3D ? (
        <div ref={wrapRef} className="kg-canvas" style={{ position: 'absolute', inset: 0 }}>
          <SceneBoundary fallback={(msg) => fallback('3D cortex unavailable (' + msg + ')')}>
            <Suspense fallback={<Loading />}>
              <KnowledgeScene key={dark ? 'dark' : 'light'} model={model} tissue={tissue} width={size.w} height={size.h} dark={dark}
                autoCamera={autoCam} onFrame={() => { drewRef.current = true }} />
            </Suspense>
          </SceneBoundary>
        </div>
      ) : webgl && dead ? fallback("3D cortex didn't start on this device")
        : !webgl ? fallback('WebGL unavailable') : null}

      {/* hemisphere labels — hidden on narrow screens (they sit over the brain) */}
      {webgl && !compact && (
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

      {/* navigation pills — instruction + Auto camera + Design Studio */}
      <div style={{ position: 'absolute', top: 62, left: 16, display: 'flex', flexDirection: 'column', gap: 6, pointerEvents: 'none' }}>
        {show3D && (
          <div style={{ fontSize: 10.5, color: ui.tx2, letterSpacing: 0.3, padding: '3px 10px', borderRadius: 999, background: ui.glass, border: '1px solid ' + ui.border, backdropFilter: 'blur(8px)', width: 'fit-content' }}>
            Drag to orbit · scroll to zoom · right-drag to pan
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, pointerEvents: 'auto' }}>
          <button onClick={() => setAutoCam((a) => !a)} title="Gentle idle sway/lean when you're not driving the camera"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', border: '1px solid ' + (autoCam ? '#8b7cf688' : ui.border), background: autoCam ? '#8b7cf626' : ui.glass, color: autoCam ? (dark ? '#c4b5fd' : '#6d28d9') : ui.tx3, backdropFilter: 'blur(8px)', fontWeight: 600, fontSize: 11.5 }}>
            <Orbit size={12} /> Auto camera
          </button>
          {show3D && (
            <button onClick={() => setDesignOpen((o) => !o)} title="Open the Design Studio — shape, spread, colours, sparkle"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', border: '1px solid ' + (designOpen ? '#8b7cf688' : ui.border), background: designOpen ? '#8b7cf626' : ui.glass, color: designOpen ? (dark ? '#c4b5fd' : '#6d28d9') : ui.tx3, backdropFilter: 'blur(8px)', fontWeight: 600, fontSize: 11.5 }}>
              <Sparkles size={12} /> Design <span style={{ opacity: 0.6, fontWeight: 500 }}>· {formLabel}</span>
            </button>
          )}
        </div>
      </div>

      {show3D && <DesignPanel open={designOpen} onClose={() => setDesignOpen(false)} ui={panelUi} dark={dark} compact={compact} />}

      {/* THINK · KNOW · DO + simulate (top-center; drops below the title + wraps on mobile) */}
      {webgl && (
        <div style={compact
          ? { position: 'absolute', top: 108, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, alignItems: 'center', pointerEvents: 'auto', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '94vw' }
          : { position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, alignItems: 'center', pointerEvents: 'auto' }}>
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
          {!cineActive && (
            <button onClick={enterCinematic}
              title="Mirror the cinematic narration — the mapped brain region lights up per beat"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 999, cursor: 'pointer', border: '1px solid #34407a', background: ui.glass, color: ui.tx3, backdropFilter: 'blur(10px)', fontWeight: 600, fontSize: 12 }}>
              <Film size={13} /> Cinematic
            </button>
          )}
        </div>
      )}

      {/* Run 2/3: cinematic caption — mirrors the narration beat currently lighting the brain */}
      {webgl && cineActive && cinematicCaption && cineBeat && (
        <div style={{ position: 'absolute', bottom: 138, left: '50%', transform: 'translateX(-50%)', maxWidth: 640, textAlign: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 10.5, color: ui.tx2, letterSpacing: 0.8, marginBottom: 5, fontWeight: 700 }}>
            ACT {ROMAN[cineBeat.act]} · SCENE {cineBeat.sceneId} · {cineIndex + 1}/{MOCK_SCRIPT.length}
          </div>
          <div style={{ display: 'inline-block', padding: '9px 18px', borderRadius: 12, background: ui.glass, border: '1px solid #f472b655', backdropFilter: 'blur(10px)', color: ui.tx, fontSize: 13.5, lineHeight: 1.5, boxShadow: '0 10px 32px rgba(0,0,0,.35)' }}>
            {cinematicCaption}
          </div>
        </div>
      )}

      {webgl && !cineActive && (
        <>
          {/* 7-region spine legend (bottom-center) */}
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

          {/* provenance (bottom-left) — hidden on mobile to keep the legend clear */}
          {!compact && <div style={{ position: 'absolute', bottom: 62, left: 16, display: 'flex', gap: 12, alignItems: 'center', background: ui.glass, border: '1px solid #232c52', borderRadius: 12, padding: '7px 12px', backdropFilter: 'blur(10px)' }}>
            <span style={{ fontSize: 10, color: ui.tx2, letterSpacing: 0.6 }}>PROVENANCE</span>
            {(['live', 'partial', 'simulated', 'placeholder'] as const).map((p) => (
              <span key={p} title={PROVENANCE_META[p].hint} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: ui.tx3 }}>
                <span style={{ width: 9, height: 9, borderRadius: 9, background: '#8b7cf6', opacity: p === 'live' ? 1 : p === 'partial' ? 0.65 : p === 'simulated' ? 0.42 : 0.25 }} />
                {PROVENANCE_META[p].label}
              </span>
            ))}
          </div>}
        </>
      )}

      {/* Run 3: cinematic transport — replaces the manual legends while active */}
      {webgl && cineActive && (
        <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', width: 'min(760px, 92vw)', display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'auto' }}>
          {/* act tabs */}
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
            {[1, 2, 3, 4, 5, 6, 7].map((act) => (
              <button key={act} onClick={() => jumpToAct(act)} title={`Jump to Act ${ROMAN[act]}`}
                style={{ padding: '4px 10px', borderRadius: 999, cursor: 'pointer', fontSize: 11, fontWeight: 700, border: '1px solid ' + (cineBeat?.act === act ? '#f472b6' : ui.border), background: cineBeat?.act === act ? '#f472b626' : ui.glass, color: cineBeat?.act === act ? (dark ? '#f9a8d4' : '#be185d') : ui.tx3 }}>
                {ROMAN[act]}
              </button>
            ))}
          </div>
          {/* transport row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: ui.glass, border: '1px solid ' + ui.border, borderRadius: 14, padding: '8px 12px', backdropFilter: 'blur(10px)', boxShadow: '0 10px 32px rgba(0,0,0,.3)' }}>
            <button onClick={restart} title="Restart" style={transportBtn(ui)}><RotateCcw size={14} /></button>
            <button onClick={prevBeat} title="Previous scene" style={transportBtn(ui)}><SkipBack size={14} /></button>
            <button onClick={togglePlayPause} title={cinePlaying ? 'Pause' : 'Play'} style={{ ...transportBtn(ui), background: '#f472b622', border: '1px solid #f472b666' }}>
              {cinePlaying ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button onClick={nextBeat} title="Next scene" style={transportBtn(ui)}><SkipForward size={14} /></button>
            <input type="range" min={0} max={1} step={0.001} value={cineProgress}
              onChange={(e) => seekToFraction(parseFloat(e.target.value))}
              title="Scrub the cinematic timeline" style={{ flex: 1, accentColor: '#f472b6', cursor: 'pointer' }} />
            <button onClick={cycleSpeed} title="Playback speed" style={{ ...transportBtn(ui), width: 'auto', padding: '0 9px', gap: 4, display: 'flex', alignItems: 'center' }}>
              <Gauge size={13} /> <span style={{ fontSize: 11.5, fontWeight: 700 }}>{cineSpeed}×</span>
            </button>
            <button onClick={exitCinematic} title="Exit cinematic" style={transportBtn(ui)}><X size={14} /></button>
          </div>
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
function transportBtn(ui: { glass: string; border: string; tx3: string }): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30,
    borderRadius: 999, border: '1px solid ' + ui.border, background: ui.glass, color: ui.tx3, cursor: 'pointer',
  }
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
