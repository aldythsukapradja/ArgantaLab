// WS3 — knowledge-surface local state. The R3F cortex reads it across the Canvas
// reconciler boundary without prop-drilling.

import { create } from 'zustand'
import type { Provenance } from './provenance'
import type { Cognition, Hemisphere } from './brain'

export interface KState {
  hovered: string | null
  selected: string | null
  /** id of the node the camera should frame; null = whole-brain overview */
  focus: string | null
  /** isolate one cognition band (think/know/do); null = all */
  cogFilter: Cognition | null
  /** isolate one hemisphere; null = both */
  hemiFilter: Hemisphere | null
  provFilter: Provenance | null
  /** the THINK→KNOW→DO cognition wave is animating */
  simRunning: boolean

  setHovered: (id: string | null) => void
  setSelected: (id: string | null) => void
  setFocus: (id: string | null) => void
  setCogFilter: (c: Cognition | null) => void
  setHemiFilter: (h: Hemisphere | null) => void
  setProvFilter: (p: Provenance | null) => void
  setSim: (on: boolean) => void
}

export const useKnowledge = create<KState>((set) => ({
  hovered: null,
  selected: null,
  focus: null,
  cogFilter: null,
  hemiFilter: null,
  provFilter: null,
  simRunning: true,

  setHovered: (hovered) => set({ hovered }),
  setSelected: (selected) => set({ selected }),
  setFocus: (focus) => set({ focus }),
  setCogFilter: (cogFilter) => set({ cogFilter }),
  setHemiFilter: (hemiFilter) => set({ hemiFilter }),
  setProvFilter: (provFilter) => set({ provFilter }),
  setSim: (simRunning) => set({ simRunning }),
}))
