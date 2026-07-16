// Knowledge Canvas — the creative-space design controls. Everything the Design
// Studio panel exposes lives here, persisted to localStorage so a founder's
// look survives reloads. Defaults reproduce EXACTLY today's Cognitive Cortex
// (form 'brain', neutral params, reactor palette) so nothing regresses when the
// store is introduced. The 3D scene reads this across the R3F reconciler
// boundary the same way it reads useKnowledge.

import { create } from 'zustand'
import { REGIONS, type RegionId } from './brain'

export type FormId = 'brain' | 'sphere' | 'atom' | 'galaxy' | 'constellation'
export type ColorBy = 'region' | 'triad' | 'provenance' | 'uniform'
export type PaletteId = 'reactor' | 'mono' | 'heatmap' | 'synthwave' | 'paper'
export type Background = 'void' | 'nebula' | 'grid'

export const FORMS: { id: FormId; label: string; hint: string }[] = [
  { id: 'brain', label: 'Brain', hint: '7-region cortex — the default Cognitive Cortex' },
  { id: 'constellation', label: 'Constellation', hint: 'clustered knowledge graph floating in space' },
  { id: 'atom', label: 'Atom', hint: 'Command Core nucleus, regions as orbital shells' },
  { id: 'galaxy', label: 'Galaxy', hint: 'spiral arms, one per region, around a bright core' },
  { id: 'sphere', label: 'Sphere', hint: 'clean architectural fibonacci sphere' },
]

// reactor default colours — the source of truth for per-region colour, seeded
// from brain.ts so a fresh store matches the cortex exactly.
export const DEFAULT_REGION_COLORS: Record<RegionId, string> =
  REGIONS.reduce((m, r) => { m[r.id] = r.color; return m }, {} as Record<RegionId, string>)

// palette presets re-map all 7 region colours at once. 'reactor' = the default.
export const PALETTES: Record<PaletteId, { label: string; colors: Record<RegionId, string> }> = {
  reactor: { label: 'Reactor', colors: DEFAULT_REGION_COLORS },
  mono: {
    label: 'Mono cyan',
    colors: { command: '#e0fbff', think: '#7fe3ff', know: '#4bc9f0', orchestrate: '#38b6e0', act: '#7fe3ff', experience: '#4bc9f0', sense: '#38b6e0' },
  },
  heatmap: {
    label: 'Heatmap',
    colors: { command: '#fff1c2', think: '#ffd166', know: '#ff9f45', orchestrate: '#ff7a45', act: '#ff5470', experience: '#f43f5e', sense: '#ffb703' },
  },
  synthwave: {
    label: 'Synthwave',
    colors: { command: '#f5f0ff', think: '#b388ff', know: '#ff6ac1', orchestrate: '#ff8e6e', act: '#ff477e', experience: '#22d3ee', sense: '#7c5cff' },
  },
  paper: {
    label: 'Paper',
    colors: { command: '#111827', think: '#2563eb', know: '#7c3aed', orchestrate: '#0d9488', act: '#ea580c', experience: '#16a34a', sense: '#0891b2' },
  },
}

export interface DesignState {
  form: FormId
  // space
  spread: number        // 0.5 – 2.2   overall scale of the layout
  squash: number        // 0.3 – 1.4   vertical (Y) multiplier
  separation: number    // 0.4 – 2.0   how far apart regions sit (form-dependent)
  // neurons
  neuronSize: number    // 0.5 – 2.5   multiplier on node radius
  glow: number          // 0.4 – 2.0   bloom / brightness multiplier
  sparkleDensity: number// 0 – 1.4     tissue point count multiplier (brain only)
  sparkleSize: number   // 0.4 – 2.0   tissue point size multiplier
  // colour
  colorBy: ColorBy
  palette: PaletteId
  regionColors: Record<RegionId, string>  // per-region overrides (start from palette)
  // atmosphere
  background: Background
  bloom: number         // 0 – 2       post bloom intensity multiplier
  edgeOpacity: number   // 0 – 2       axon opacity multiplier
  showLabels: boolean

  set: <K extends keyof DesignState>(k: K, v: DesignState[K]) => void
  setRegionColor: (r: RegionId, c: string) => void
  applyPalette: (p: PaletteId) => void
  reset: () => void
  randomize: () => void
}

const KEY = 'hq_knowledge_design_v1'

const DEFAULTS = {
  form: 'brain' as FormId,
  spread: 1, squash: 1, separation: 1,
  neuronSize: 1, glow: 1, sparkleDensity: 1, sparkleSize: 1,
  colorBy: 'region' as ColorBy,
  palette: 'reactor' as PaletteId,
  regionColors: { ...DEFAULT_REGION_COLORS },
  background: 'void' as Background,
  bloom: 1, edgeOpacity: 1, showLabels: true,
}

function load(): typeof DEFAULTS {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}')
    return { ...DEFAULTS, ...raw, regionColors: { ...DEFAULT_REGION_COLORS, ...(raw.regionColors || {}) } }
  } catch { return { ...DEFAULTS } }
}
function persist(s: DesignState) {
  try {
    const { form, spread, squash, separation, neuronSize, glow, sparkleDensity, sparkleSize, colorBy, palette, regionColors, background, bloom, edgeOpacity, showLabels } = s
    localStorage.setItem(KEY, JSON.stringify({ form, spread, squash, separation, neuronSize, glow, sparkleDensity, sparkleSize, colorBy, palette, regionColors, background, bloom, edgeOpacity, showLabels }))
  } catch { /* quota */ }
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a)

export const useDesign = create<DesignState>((set, get) => ({
  ...load(),
  set: (k, v) => { set({ [k]: v } as Pick<DesignState, typeof k>); persist(get()) },
  setRegionColor: (r, c) => { set({ regionColors: { ...get().regionColors, [r]: c } }); persist(get()) },
  applyPalette: (p) => { set({ palette: p, regionColors: { ...PALETTES[p].colors } }); persist(get()) },
  reset: () => { set({ ...DEFAULTS, regionColors: { ...DEFAULT_REGION_COLORS } }); persist(get()) },
  randomize: () => {
    const forms: FormId[] = ['brain', 'constellation', 'atom', 'galaxy', 'sphere']
    const pals = Object.keys(PALETTES) as PaletteId[]
    const p = pals[Math.floor(Math.random() * pals.length)]
    set({
      form: forms[Math.floor(Math.random() * forms.length)],
      spread: rnd(0.8, 1.8), squash: rnd(0.6, 1.2), separation: rnd(0.7, 1.6),
      neuronSize: rnd(0.8, 1.8), glow: rnd(0.8, 1.6),
      palette: p, regionColors: { ...PALETTES[p].colors },
    })
    persist(get())
  },
}))
