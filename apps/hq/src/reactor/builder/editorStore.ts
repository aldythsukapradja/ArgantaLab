import { create } from 'zustand'
import { cloneLayers, DEFAULT_LAYERS, type ReactorLayerSpec } from '../model/layers'

// ─────────────────────────────────────────────────────────────────────────
// Reactor Builder editor state.
//
// Holds an editable copy of the 7-layer model plus the founder's authoring
// controls (selected layer, manual explosion scrub, scenario play/pause).
// Exporting this state is the JSON the runtime + Higgsfield alignment consume.
// ─────────────────────────────────────────────────────────────────────────

interface EditorState {
  layers: ReactorLayerSpec[]
  selectedLayerId: string | null
  /** null → the scenario drives the explosion; a number pins/scrubs it. */
  manualExplosion: number | null
  scenarioPlaying: boolean
  scenarioSpeed: number

  select: (id: string | null) => void
  updateLayer: (id: string, patch: Partial<ReactorLayerSpec>) => void
  toggleVisible: (id: string) => void
  setManualExplosion: (v: number | null) => void
  setPlaying: (v: boolean) => void
  setSpeed: (v: number) => void
  reset: () => void
  exportJson: () => string
}

export const useReactorEditor = create<EditorState>((set, get) => ({
  layers: cloneLayers(DEFAULT_LAYERS),
  selectedLayerId: null,
  manualExplosion: null,
  scenarioPlaying: true,
  scenarioSpeed: 1,

  select: id => set({ selectedLayerId: id }),
  updateLayer: (id, patch) => set(s => ({
    layers: s.layers.map(l => (l.id === id ? { ...l, ...patch } : l)),
  })),
  toggleVisible: id => set(s => ({
    layers: s.layers.map(l => (l.id === id ? { ...l, visible: !l.visible } : l)),
  })),
  setManualExplosion: v => set({ manualExplosion: v }),
  setPlaying: v => set({ scenarioPlaying: v }),
  setSpeed: v => set({ scenarioSpeed: v }),
  reset: () => set({ layers: cloneLayers(DEFAULT_LAYERS), selectedLayerId: null, manualExplosion: null }),
  exportJson: () => JSON.stringify({ layers: get().layers }, null, 2),
}))
