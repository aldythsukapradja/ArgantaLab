// WS1 Cinema Program — the ONE shared interface. Frozen once shipped.
// WS2 (reactor) fulfils CoreSlotProps; WS3 (nodes) fulfils NodesSlotProps.
// Slots receive props only: they never read audio, advance scenes, or touch each other.
// See docs/jarvis-os/20260714-Architecture-JarvisOS-CinemaProgram-WS1-BuildPlan.md

import type { ProductId } from '../surfaces/Portfolio'
export type { ProductId }

export type Act = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type Mode = 'normal' | 'guided' | 'auto' | 'paused' | 'director'
export type Voice = 'JM' | 'KF' // only these two voices were recorded

// ── CoreSlot (WS2 reactor) ────────────────────────────────────────────────
export type CoreState =
  | 'offline' | 'booting' | 'idle' | 'listening'
  | 'jarvis-speaking' | 'specialist-speaking'
  | 'think' | 'know' | 'do'
  | 'product-focus' | 'popup-open'
  | 'vault-entry' | 'architecture-unfold' | 'return'

export type Quality = 'high' | 'medium' | 'mobile'

export interface CoreSlotProps {
  state: CoreState
  product?: ProductId
  progress: number // 0..1 within the current clip (audio clock)
  renderer?: 'legacy' | 'ws2' | 'media'
  reducedMotion?: boolean
  quality?: Quality
}

// ── NodesSlot (WS3 knowledge nodes) ───────────────────────────────────────
export interface NodesState {
  visible: boolean
  focusNode?: string
  path?: string[]        // Founder → … → Products spine to trace
  tour?: 'A' | 'B' | 'C' | 'D'
}

export interface NodesSlotProps {
  state: NodesState
  progress: number
  renderer?: 'placeholder' | 'ws3'
  reducedMotion?: boolean
  quality?: Quality
}

// ── The single semantic value WS1 emits every scene ───────────────────────
export interface SceneState {
  id: string
  act: Act
  mode: Mode
  voice: Voice
  product?: ProductId
  core: CoreState
  nodes: NodesState
  focusInstrument?: string // Landing instrument id, or 'all' / 'none'
  progress: number
}
