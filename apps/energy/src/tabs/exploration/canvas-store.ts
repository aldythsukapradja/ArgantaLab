// The state every Exploration tab shares. It lives in one store rather than in the
// shell because the whole point of the workspace is that a basin you pin in Atlas
// is still pinned — and still the same colour — when you reach Ranking.
//
// Scope is a CARDINALITY, not a filter:
//   0 pinned → WORLD    "where should we look?"   distributions and maps
//   1 pinned → DOSSIER  "is this basin any good?" scalars against a peer backdrop
//   2–4      → COMPARE  "which of these is better?" series, small multiples
import { create } from 'zustand';
import type { Provenance } from '../../viz/palette';

export type ScopeState = 'WORLD' | 'DOSSIER' | 'COMPARE';

export interface Pin {
  id: string;
  name: string;
  /** Palette slot. Colour follows the basin, never its rank — unpinning one
   *  basin must not repaint the survivors, so slots are held, not re-packed. */
  slot: number;
  fieldCount?: number;
}

/** Facets DIM rather than remove: you keep the denominator on screen, which is
 *  where the insight lives. The choropleth is the one exception (a half-opaque
 *  polygon reads as missing data), and it filters destructively. */
export interface FacetGroup { id: string; label: string; options: string[] }

export const FACETS: FacetGroup[] = [
  { id: 'region', label: 'Region', options: ['FSU', 'MENA', 'Asia Pacific', 'Europe', 'N America', 'C&S America', 'Sub-Saharan', 'South Asia'] },
  { id: 'assessed', label: 'Assessed', options: ['Assessed', 'Not assessed'] },
  { id: 'shore', label: 'Setting', options: ['Onshore', 'Offshore'] },
  { id: 'ptype', label: 'Type', options: ['Conventional', 'Unconventional'] },
  { id: 'fuel', label: 'Fuel', options: ['Oil', 'Gas', 'Oil and gas'] },
  { id: 'era', label: 'Discovery era', options: ['pre-1970', '1970–1990', '1990–2010', 'post-2010'] },
];

export const MAX_PINS = 4;

export type ArtifactStatus = 'untouched' | 'running' | 'settled' | 'stale';

export interface Artifact {
  stageId: string;
  name: string;
  status: ArtifactStatus;
  provenance: Provenance;
  n: number;
  /** The stage ids this artifact consumed — the lineage claim, made checkable. */
  inputs: string[];
  finding?: string;
}

export interface RunLogEntry {
  stageId: string;
  step: string;
  detail: string;
  /** Sequence number, not a wall clock — the run must replay identically. */
  seq: number;
}

interface CanvasState {
  pins: Pin[];
  facets: Record<string, string[]>;
  infoOpen: string | null;

  // ── the simulated agentic study run ──
  runStatus: 'idle' | 'running' | 'paused' | 'done';
  runStage: string | null;
  runStep: number;
  artifacts: Record<string, Artifact>;
  log: RunLogEntry[];

  togglePin: (pin: Omit<Pin, 'slot'>) => void;
  clearPins: () => void;
  toggleFacet: (group: string, option: string) => void;
  clearFacets: () => void;
  setInfoOpen: (id: string | null) => void;

  startRun: () => void;
  pauseRun: () => void;
  resumeRun: () => void;
  resetRun: () => void;
  setRunStatus: (status: CanvasState['runStatus']) => void;
  advanceRun: (stageId: string, step: number, entry: RunLogEntry) => void;
  settleArtifact: (artifact: Artifact) => void;
}

export const scopeStateOf = (pins: Pin[]): ScopeState =>
  pins.length === 0 ? 'WORLD' : pins.length === 1 ? 'DOSSIER' : 'COMPARE';

export const useCanvas = create<CanvasState>((set) => ({
  pins: [],
  facets: {},
  infoOpen: null,
  runStatus: 'idle',
  runStage: null,
  runStep: 0,
  artifacts: {},
  log: [],

  togglePin: (pin) => set((state) => {
    const existing = state.pins.find((p) => p.id === pin.id);
    if (existing) return { pins: state.pins.filter((p) => p.id !== pin.id) };
    if (state.pins.length >= MAX_PINS) return state;
    // Take the lowest free slot so the surviving pins keep their colours.
    const taken = new Set(state.pins.map((p) => p.slot));
    let slot = 0;
    while (taken.has(slot)) slot += 1;
    return { pins: [...state.pins, { ...pin, slot }] };
  }),
  clearPins: () => set({ pins: [] }),

  toggleFacet: (group, option) => set((state) => {
    const current = state.facets[group] ?? [];
    const next = current.includes(option) ? current.filter((o) => o !== option) : [...current, option];
    const facets = { ...state.facets };
    if (next.length) facets[group] = next; else delete facets[group];
    return { facets };
  }),
  clearFacets: () => set({ facets: {} }),
  setInfoOpen: (id) => set((state) => ({ infoOpen: state.infoOpen === id ? null : id })),

  startRun: () => set({ runStatus: 'running', runStage: null, runStep: 0, artifacts: {}, log: [] }),
  pauseRun: () => set({ runStatus: 'paused' }),
  resumeRun: () => set({ runStatus: 'running' }),
  resetRun: () => set({ runStatus: 'idle', runStage: null, runStep: 0, artifacts: {}, log: [] }),
  setRunStatus: (runStatus) => set({ runStatus }),

  advanceRun: (runStage, runStep, entry) => set((state) => ({
    runStage, runStep, log: [...state.log, entry],
  })),
  settleArtifact: (artifact) => set((state) => ({
    artifacts: { ...state.artifacts, [artifact.stageId]: artifact },
  })),
}));
