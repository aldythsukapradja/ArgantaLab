// WS3 — knowledge-surface local state. The R3F brain reads it across the Canvas
// reconciler boundary without prop-drilling.

import { create } from 'zustand'
import type { Provenance } from './provenance'
import type { Triad, RegionId, Hemisphere } from './brain'

export interface KState {
  hovered: string | null
  selected: string | null
  focus: string | null              // node/region to frame; null = whole brain
  triadFilter: Triad | null         // isolate THINK / KNOW / DO
  regionFilter: RegionId | null     // isolate one of the 7 regions
  hemiFilter: Hemisphere | null
  provFilter: Provenance | null
  simRunning: boolean               // neuron-firing simulation on

  setHovered: (id: string | null) => void
  setSelected: (id: string | null) => void
  setFocus: (id: string | null) => void
  setTriadFilter: (t: Triad | null) => void
  setRegionFilter: (r: RegionId | null) => void
  setHemiFilter: (h: Hemisphere | null) => void
  setProvFilter: (p: Provenance | null) => void
  setSim: (on: boolean) => void
}

export const useKnowledge = create<KState>((set) => ({
  hovered: null,
  selected: null,
  focus: null,
  triadFilter: null,
  regionFilter: null,
  hemiFilter: null,
  provFilter: null,
  simRunning: true,

  setHovered: (hovered) => set({ hovered }),
  setSelected: (selected) => set({ selected }),
  setFocus: (focus) => set({ focus }),
  setTriadFilter: (triadFilter) => set({ triadFilter }),
  setRegionFilter: (regionFilter) => set({ regionFilter }),
  setHemiFilter: (hemiFilter) => set({ hemiFilter }),
  setProvFilter: (provFilter) => set({ provFilter }),
  setSim: (simRunning) => set({ simRunning }),
}))
