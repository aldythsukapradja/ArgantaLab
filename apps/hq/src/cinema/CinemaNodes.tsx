// CinemaNodes — the WS3 adapter for the WS1 nodes slot, full-stage on the CEO Orb.
// Mirrors CinemaReactor: it renders WS3's raw R3F cortex (KnowledgeScene) directly
// and drives it through WS3's OWN seam — `setScene(SceneState)` — so the brain's
// contextual activation (knowledge/activation.ts) lights the regions relevant to
// each beat. It also frames the camera on the active region. During Acts V/VI the
// reactor dissolves and the real brain-of-the-vault blooms in, firing in context.
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useVault } from '../vault/store'
import { useHQ } from '../shell/store'
import { buildKnowledgeModel } from '../knowledge/model'
import { corticalTissue } from '../knowledge/brain'
import { KnowledgeScene } from '../knowledge/KnowledgeScene'
import { useKnowledge } from '../knowledge/store'
import { activationFor } from '../knowledge/activation'
import type { RegionId } from '../knowledge/brain'
import type { SceneState as KnowledgeScene_State, CoreState } from '../knowledge/contract'
import type { SceneState as CinemaSceneState } from './contract'
import './cinema-nodes.css'

function hasWebGL(): boolean {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false }
}

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() { return { error: true } }
  componentDidCatch(err: unknown) { console.error('[CinemaNodes] cortex failed:', err) }
  render() { return this.state.error ? this.props.fallback : this.props.children }
}

export function CinemaNodes({ scene, revealed = true }: { scene: CinemaSceneState; revealed?: boolean }) {
  const notes = useVault(s => s.notes)
  const dark = useHQ(s => s.theme === 'dark')
  const webgl = useMemo(hasWebGL, [])
  const model = useMemo(() => buildKnowledgeModel(notes), [notes])
  const tissue = useMemo(() => corticalTissue(7000), []) // lighter than the WS3 surface — this warms behind the reactor

  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __kstore?: unknown }).__kstore = useKnowledge }, [])

  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 1, h: 1 })
  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 1, h: el.clientHeight || 1 }))
    ro.observe(el); setSize({ w: el.clientWidth || 1, h: el.clientHeight || 1 })
    const kicks = [0, 120, 500].map(ms => window.setTimeout(() => window.dispatchEvent(new Event('resize')), ms))
    return () => { ro.disconnect(); kicks.forEach(clearTimeout) }
  }, [])

  // Drive the cortex through WS3's semantic seam. Translate the cinema scene into
  // the brain's SceneState; WS3's activationFor() lights the right regions.
  const core = scene.core as CoreState
  const speaking = core === 'jarvis-speaking' || core === 'specialist-speaking'
  useEffect(() => {
    const k = useKnowledge.getState()
    k.setSim(true)
    const kScene: KnowledgeScene_State = {
      state: core,
      intensity: speaking ? 0.9 : core === 'architecture-unfold' ? 0.95 : 0.7,
      speaker: core === 'specialist-speaking' ? 'specialist' : speaking ? 'jarvis' : null,
      focusProduct: scene.product ?? null,
      sceneTime: scene.progress,
      sceneDuration: 1,
      sceneId: scene.id,
      act: scene.act,
    }
    k.setScene(kScene, null)
    // frame the camera on the region this beat activates most; a broad bloom
    // (provenance / full architecture) keeps the whole-brain overview.
    const act = activationFor(kScene)
    if (act) {
      let best: RegionId | null = null, bestW = 0, strong = 0
      for (const r of Object.keys(act) as RegionId[]) { const w = act[r]; if (w > bestW) { bestW = w; best = r }; if (w > 0.45) strong++ }
      if (best && bestW >= 0.35 && strong <= 3) k.setFocus(model.nodes.find(n => n.hero && n.region === best)?.id ?? null)
      else k.setFocus(null)
    }
    return () => { const r = useKnowledge.getState(); r.setScene(null, null); r.setFocus(null); r.setRegionFilter(null); r.setSelected(null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id, core, scene.product])

  const label = scene.act === 4 ? 'THINK · KNOW · DO · THE COGNITIVE TRIAD'
    : scene.act === 6 ? 'DETERMINISTIC PROOF'
      : 'ARCHITECTURE · THE BRAIN OF THE VAULT'

  return (
    <div className="cine-dive" aria-hidden="true" data-theme={dark ? 'dark' : 'light'} data-revealed={revealed ? 'on' : 'off'}>
      <div className="cine-dive-flash" />
      <div className="cine-dive-label">{label}</div>
      {webgl ? (
        <div ref={wrapRef} className="cine-dive-canvas">
          <style>{`.cine-dive-canvas canvas{width:100%!important;height:100%!important;display:block}`}</style>
          <SceneBoundary fallback={<DiveFallback />}>
            <Suspense fallback={<DiveFallback />}>
              <KnowledgeScene key={dark ? 'd' : 'l'} model={model} tissue={tissue} width={size.w} height={size.h} dark={dark} onFrame={() => {}} />
            </Suspense>
          </SceneBoundary>
        </div>
      ) : <DiveFallback />}
    </div>
  )
}

function DiveFallback() {
  return <div className="cine-dive-fallback">Cognitive Cortex · the real knowledge graph</div>
}
