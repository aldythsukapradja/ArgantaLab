// WS3 — knowledge-surface local state. Kept out of the global HQ store: this is
// the module's own manual-mode controls + the (mock) auto-tour clock. The R3F
// scene reads it across the Canvas reconciler boundary without prop-drilling.

import { create } from 'zustand'
import type { Provenance } from './provenance'
import type { OntologyType } from './ontology'

export interface KState {
  hovered: string | null
  selected: string | null
  /** id of the node the camera should frame; null = whole-graph overview */
  focus: string | null
  /** neighbour set to spotlight (others dim); null = no spotlight */
  spotlight: Set<string> | null
  tourActive: boolean
  tourLabel: string | null
  provFilter: Provenance | null
  typeFilter: OntologyType | null

  setHovered: (id: string | null) => void
  setSelected: (id: string | null) => void
  setFocus: (id: string | null) => void
  setSpotlight: (s: Set<string> | null) => void
  setTour: (active: boolean, label?: string | null) => void
  setProvFilter: (p: Provenance | null) => void
  setTypeFilter: (t: OntologyType | null) => void
}

export const useKnowledge = create<KState>((set) => ({
  hovered: null,
  selected: null,
  focus: null,
  spotlight: null,
  tourActive: false,
  tourLabel: null,
  provFilter: null,
  typeFilter: null,

  setHovered: (hovered) => set({ hovered }),
  setSelected: (selected) => set({ selected }),
  setFocus: (focus) => set({ focus }),
  setSpotlight: (spotlight) => set({ spotlight }),
  setTour: (tourActive, tourLabel = null) => set({ tourActive, tourLabel }),
  setProvFilter: (provFilter) => set({ provFilter }),
  setTypeFilter: (typeFilter) => set({ typeFilter }),
}))
