// static-store.ts — the static modelling session.
//
// Petrel's Processes pane is an ORDERED list, and the order is a real constraint,
// not a suggestion: you must create a 3D grid before you can insert horizons into
// it, and you must create zones before you can insert layers into them. A process
// whose prerequisite has not run is not merely unhelpful — it cannot produce a
// meaningful answer, so it is disabled and says which step it is waiting for.
//
// That gating is the whole reason this store exists. Everything else here (which
// dialogs are open, where they sit, what the viewport is showing) is window state
// that follows from it.
import { create } from 'zustand';

export type ProcessId =
  | 'horizons' | 'zones' | 'contacts'
  | 'layering' | 'grid'
  | 'upscale'
  | 'facies'
  | 'porosity' | 'permeability'
  | 'volumes';

export interface ProcessDef {
  id: ProcessId;
  label: string;
  /** the Petrel-style group heading in the rail */
  group: string;
  /** processes that must have RUN before this one can */
  needs: ProcessId[];
  /** the build step from STATIC-MODEL-SUITE-CONCEPT.md */
  step: string;
  /** one line, shown in the rail and as the dialog subtitle */
  purpose: string;
}

/**
 * The ordered process list. Order is stratigraphic in the workflow sense: each
 * entry can only be reached once everything it names in `needs` has produced an
 * artifact.
 */
export const PROCESSES: ProcessDef[] = [
  { id: 'horizons', group: 'Structural modelling', label: 'Make horizons', needs: [], step: 'S1',
    purpose: 'Order the ingested depth grids stratigraphically.' },
  { id: 'zones', group: 'Structural modelling', label: 'Make zones', needs: ['horizons'], step: 'S1',
    purpose: 'Define the interval between each consecutive horizon pair.' },
  { id: 'contacts', group: 'Structural modelling', label: 'Fluid contacts', needs: ['zones'], step: 'S8',
    purpose: 'OWC / GOC / GWC per zone, and the closure each defines.' },
  { id: 'layering', group: 'Gridding', label: 'Layering', needs: ['zones'], step: 'S3',
    purpose: 'Proportional, top-conform or base-conform layers inside each zone.' },
  { id: 'grid', group: 'Gridding', label: 'Build 3D grid', needs: ['layering'], step: 'S3',
    purpose: 'Construct the pillar grid and pack it for the viewport.' },
  { id: 'upscale', group: 'Property modelling', label: 'Scale up well logs', needs: ['grid'], step: 'S4',
    purpose: 'Block facies, porosity and permeability logs into cells.' },
  { id: 'facies', group: 'Property modelling', label: 'Facies modelling (SIS)', needs: ['upscale'], step: 'S6',
    purpose: 'Sequential indicator simulation conditioned to the upscaled cells.' },
  { id: 'porosity', group: 'Property modelling', label: 'Petrophysical modelling (SGS)', needs: ['facies'], step: 'S7',
    purpose: 'Sequential Gaussian simulation of porosity, per zone and per facies.' },
  { id: 'permeability', group: 'Property modelling', label: 'Permeability from φ', needs: ['porosity'], step: 'S5',
    purpose: 'Apply the fitted φ–k transform; kv/kh per facies.' },
  { id: 'volumes', group: 'Analysis', label: 'Volume calculation', needs: ['porosity', 'contacts'], step: 'S9',
    purpose: 'GRV → STOIIP / GIIP, grid-based and map-based side by side.' },
];

export const PROCESS_BY_ID = new Map(PROCESSES.map((p) => [p.id, p]));

/** A floating process window. Petrel's windows are either docked or float, and
 *  double-clicking the title toggles which — reproduced here because a modelling
 *  dialog you cannot move off the thing it is modifying is a dialog that hides
 *  its own result. */
export interface DialogWindow {
  id: ProcessId;
  x: number; y: number;
  w: number; h: number;
  docked: boolean;
  minimised: boolean;
  z: number;
}

export type ViewMode = '2d' | '3d' | 'section';

interface StaticState {
  /** processes that have produced an artifact */
  done: Set<ProcessId>;
  /** the process whose tools are on the Function bar */
  active: ProcessId | null;
  windows: DialogWindow[];
  topZ: number;

  // ── the model spec the dialogs edit ──
  /** horizon ids in stratigraphic order, shallowest first */
  horizonOrder: string[];
  /** layers per zone, keyed by zone index; the default applies where absent */
  nzPerZone: number;
  layerScheme: 'proportional' | 'top-conform' | 'base-conform';

  // ── viewport ──
  view: ViewMode;
  zScale: number;
  /** which horizons the viewport is drawing */
  visibleHorizons: string[];
  showWells: boolean;
  showContact: boolean;

  open: (id: ProcessId) => void;
  close: (id: ProcessId) => void;
  focus: (id: ProcessId) => void;
  move: (id: ProcessId, x: number, y: number) => void;
  resize: (id: ProcessId, w: number, h: number) => void;
  toggleDock: (id: ProcessId) => void;
  toggleMin: (id: ProcessId) => void;
  markDone: (id: ProcessId) => void;
  reset: () => void;

  setHorizonOrder: (ids: string[]) => void;
  setNz: (n: number) => void;
  setScheme: (s: StaticState['layerScheme']) => void;
  setView: (v: ViewMode) => void;
  setZScale: (z: number) => void;
  setVisibleHorizons: (ids: string[]) => void;
  toggleHorizon: (id: string) => void;
  setShowWells: (b: boolean) => void;
  setShowContact: (b: boolean) => void;
}

/** Where a newly-opened dialog lands. Cascaded, so opening three in a row does not
 *  stack them exactly on top of one another. */
const spawnAt = (n: number) => ({ x: 96 + (n % 5) * 26, y: 72 + (n % 5) * 22 });

export const useStatic = create<StaticState>((set) => ({
  done: new Set<ProcessId>(),
  active: null,
  windows: [],
  topZ: 10,

  horizonOrder: [],
  nzPerZone: 20,
  layerScheme: 'proportional',

  view: '3d',
  zScale: 8,
  visibleHorizons: [],
  showWells: true,
  showContact: true,

  open: (id) => set((s) => {
    const existing = s.windows.find((w) => w.id === id);
    if (existing) {
      return {
        active: id,
        topZ: s.topZ + 1,
        windows: s.windows.map((w) => (w.id === id ? { ...w, minimised: false, z: s.topZ + 1 } : w)),
      };
    }
    const { x, y } = spawnAt(s.windows.length);
    return {
      active: id,
      topZ: s.topZ + 1,
      windows: [...s.windows, { id, x, y, w: 380, h: 340, docked: false, minimised: false, z: s.topZ + 1 }],
    };
  }),
  close: (id) => set((s) => ({
    windows: s.windows.filter((w) => w.id !== id),
    active: s.active === id ? null : s.active,
  })),
  focus: (id) => set((s) => ({
    active: id, topZ: s.topZ + 1,
    windows: s.windows.map((w) => (w.id === id ? { ...w, z: s.topZ + 1 } : w)),
  })),
  move: (id, x, y) => set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, x, y } : w)) })),
  resize: (id, w2, h2) => set((s) => ({
    windows: s.windows.map((w) => (w.id === id ? { ...w, w: Math.max(260, w2), h: Math.max(160, h2) } : w)),
  })),
  toggleDock: (id) => set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, docked: !w.docked } : w)) })),
  toggleMin: (id) => set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, minimised: !w.minimised } : w)) })),
  markDone: (id) => set((s) => {
    const next = new Set(s.done);
    next.add(id);
    return { done: next };
  }),
  reset: () => set({ done: new Set<ProcessId>(), windows: [], active: null }),

  setHorizonOrder: (horizonOrder) => set({ horizonOrder }),
  setNz: (nzPerZone) => set({ nzPerZone }),
  setScheme: (layerScheme) => set({ layerScheme }),
  setView: (view) => set({ view }),
  setZScale: (zScale) => set({ zScale }),
  setVisibleHorizons: (visibleHorizons) => set({ visibleHorizons }),
  toggleHorizon: (id) => set((s) => ({
    visibleHorizons: s.visibleHorizons.includes(id)
      ? s.visibleHorizons.filter((h) => h !== id)
      : [...s.visibleHorizons, id],
  })),
  setShowWells: (showWells) => set({ showWells }),
  setShowContact: (showContact) => set({ showContact }),
}));

/** Is this process reachable? Returns the blocking prerequisite when it is not, so
 *  the rail can say WHICH step it is waiting for rather than just greying out. */
export function processGate(def: ProcessDef, done: Set<ProcessId>): { ok: true } | { ok: false; blockedBy: ProcessDef } {
  for (const need of def.needs) {
    if (!done.has(need)) {
      const blocker = PROCESS_BY_ID.get(need);
      if (blocker) return { ok: false, blockedBy: blocker };
    }
  }
  return { ok: true };
}
