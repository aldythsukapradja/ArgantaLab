// WS3 — the Cinema Program adapter. Mirrors reactor/CinemaReactor.tsx's role for
// WS2: cinema/slots/NodesSlot.tsx imports THIS file and renders it when
// RENDERERS.nodes === 'ws3'. It receives NodesSlotProps (+ the two additive
// fields `core`/`sceneId`) from WS1's Cinema Director and reacts — it never
// reads audio, never advances the story, never touches the reactor. Reuses the
// full Run 1/2/3 Cognitive Cortex scene wholesale (same global store), just at
// a smaller scale appropriate for an embedded preview panel.

import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useVault } from '../vault/store'
import { useHQ } from '../shell/store'
import { buildKnowledgeModel } from './model'
import { corticalTissue } from './brain'
import { KnowledgeScene } from './KnowledgeScene'
import { useKnowledge } from './store'
import type { SceneState, CoreState } from './contract'

// Cinema's own CoreState (apps/hq/src/cinema/contract.ts) is byte-identical in
// shape to knowledge/contract.ts's mirror — imported as `unknown` and narrowed
// here so this file never has to import FROM cinema/ (keeps the dependency
// direction one-way: cinema/ imports knowledge/, never the reverse).
export interface KnowledgeCinemaProps {
  state: { visible: boolean; focusNode?: string; path?: string[]; tour?: 'A' | 'B' | 'C' | 'D' }
  progress: number
  core?: string
  sceneId?: string
  renderer?: 'placeholder' | 'ws3'
  reducedMotion?: boolean
  quality?: 'high' | 'medium' | 'mobile'
}

class BridgeBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null }
  static getDerivedStateFromError(err: unknown) { return { error: (err as Error)?.message || String(err) } }
  componentDidCatch(err: unknown) { console.error('[KnowledgeCinemaSlot] crashed:', err) }
  render() {
    if (!this.state.error) return this.props.children
    return <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#f59e0b', fontSize: 11, fontFamily: 'ui-monospace, monospace', textAlign: 'center', padding: 12 }}>Cortex preview failed: {this.state.error}</div>
  }
}

export function KnowledgeCinemaSlot(props: KnowledgeCinemaProps) {
  return <BridgeBoundary><KnowledgeCinemaSlotInner {...props} /></BridgeBoundary>
}

function KnowledgeCinemaSlotInner({ progress, core, sceneId }: KnowledgeCinemaProps) {
  const notes = useVault((s) => s.notes)
  const dark = useHQ((s) => s.theme) === 'dark'
  const model = useMemo(() => buildKnowledgeModel(notes), [notes])
  // a smaller tissue than the full-screen Knowledge surface — this is a compact
  // embedded preview panel, not the destination surface.
  const tissue = useMemo(() => corticalTissue(7000), [])
  const setScene = useKnowledge((s) => s.setScene)

  // Every render of a Cinema beat pushes a fresh SceneState — the brain always
  // reacts to whatever `core` the Director currently reports (defaults to
  // 'idle' so the cortex still breathes even before WS1 wires more scenes).
  useEffect(() => {
    const state = ((core as CoreState) || 'idle')
    const scene: SceneState = {
      state,
      intensity: 0.55 + Math.max(0, Math.min(1, progress)) * 0.35,
      speaker: null,
      focusProduct: null,
      sceneTime: progress,
      sceneDuration: 1,
      sceneId,
      act: 1,
    }
    setScene(scene, null)
    return () => setScene(null, null)
  }, [core, sceneId, progress, setScene])

  // measure the panel + kick R3F awake (same proven pattern as KnowledgeSurface)
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
    return () => { ro.disconnect(); kicks.forEach(clearTimeout) }
  }, [])

  return (
    <div ref={wrapRef} className="kg-cinema-slot" style={{ position: 'absolute', inset: 0 }}>
      <style>{`.kg-cinema-slot canvas{width:100%!important;height:100%!important;display:block}`}</style>
      <KnowledgeScene key={dark ? 'dark' : 'light'} model={model} tissue={tissue} width={size.w} height={size.h} dark={dark} autoCamera />
    </div>
  )
}
