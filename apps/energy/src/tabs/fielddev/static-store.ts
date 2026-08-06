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
import type { BuiltGrid } from './grid-build';
import type { ZoneModel } from './zone-model';
import type { UpscaleResultGrid, PermAverage } from './upscale-grid';
import type { SimResult } from './sim-grid';
import type { SimSummary } from './case-store';
import type { Reconciliation } from './volumes';

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

/**
 * `split` shows the 3D scene and the 2D section side by side.
 *
 * Not a luxury: a cross-section is drawn on a map and read against the structure, and
 * making the user flip between the two loses the spatial context that made them draw
 * the line where they did.
 */
export type ViewMode = '2d' | '3d' | 'section' | 'split' | 'upscale' | 'report' | 'maps';

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
  // ── the artifacts the processes actually produce ──
  /** the resampled zone framework — S1's output, S3's input */
  zoneModel: ZoneModel | null;
  /** the packed 3D grid — what the viewport renders once it exists */
  grid: BuiltGrid | null;
  building: { zone: number; zones: number; name: string } | null;
  /**
   * Which zones are the RESERVOIR. Null means "not chosen yet — fall back to the name
   * match". One selection, shared: it scopes the property model AND the volumes, and
   * the two disagreeing is how a model reports a volume for rock it never simulated.
   */
  reservoirZones: string[] | null;
  /** S4 — logs blocked into cells */
  upscaled: UpscaleResultGrid | null;
  /** S6 · S7 — the simulated facies / phi / k field */
  sim: SimResult | null;
  /**
   * The realisation's summary, WITHOUT its per-layer arrays.
   *
   * A case loaded from the store has its properties in the packed grid and no `sim`:
   * the ~7 MB of layer arrays exist only to write those properties, and re-storing them
   * to re-derive what is already stored would double the record for nothing. Everything
   * a reader quotes about a realisation — seed, resolution, sand fraction, cells capped
   * — lives here instead, and survives the round trip.
   */
  simInfo: SimSummary | null;
  /**
   * Bumped whenever the packed grid's PROPERTY ARRAYS are rewritten in place.
   *
   * `writePackedProps` mutates the typed arrays rather than replacing the grid — they
   * are the largest structure in the session and re-allocating them per property switch
   * would defeat the point of packing. React therefore cannot see the change by
   * identity, so this counter is what every property-derived memo depends on.
   */
  propsVersion: number;
  simming: { layer: number; nz: number } | null;
  /** S9 */
  volumes: Reconciliation | null;
  /** simulation controls */
  simNodes: number;
  simSeed: number;
  permAverage: PermAverage;

  // ── viewport state ──
  //
  // Lifted out of GeaStudio because the 2D pane needs it too. While it was local, the
  // section map was handed a hardcoded layer 0 and could not follow the K player, and
  // the two views could disagree about which property they were showing — the exact
  // failure `prop-view` exists to prevent, reintroduced one level up.
  propKey: string;
  sliceOn: boolean;
  sliceAxis: 'i' | 'j' | 'k';
  sliceIndex: number;
  /** the user-drawn cross-section, in world coordinates */
  sectionPoints: Array<{ x: number; y: number }>;
  /**
   * Per-property colour ramp and display range, keyed by property name.
   *
   * Per PROPERTY, not global: porosity and permeability are read for different reasons
   * and a shared scale serves neither. A missing entry means "auto" — the P2-P98 range,
   * which is what the viewer shows until someone deliberately pins it.
   */
  propRamp: Record<string, string>;
  propRange: Record<string, { lo: number; hi: number }>;

  showShell: boolean;
  /** cell edges over the shell — what makes a grid read as a grid rather than a lump */
  showEdges: boolean;

  view: ViewMode;
  zScale: number;
  /** which horizons the viewport is drawing */
  visibleHorizons: string[];
  showWells: boolean;
  /**
   * Which wells are drawn. `null` means ALL — distinct from `[]`, which means the user
   * deliberately switched every one off. Collapsing those two makes "hide all" read as
   * "reset", which is the kind of small lie that erodes trust in a tree.
   */
  visibleWells: string[] | null;
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

  setZoneModel: (m: ZoneModel | null) => void;
  setGrid: (g: BuiltGrid | null) => void;
  setBuilding: (b: { zone: number; zones: number; name: string } | null) => void;
  setReservoirZones: (z: string[] | null) => void;
  setUpscaled: (u: UpscaleResultGrid | null) => void;
  setSim: (s: SimResult | null) => void;
  setSimInfo: (s: SimSummary | null) => void;
  bumpProps: () => void;
  setSimming: (s: { layer: number; nz: number } | null) => void;
  setVolumes: (v: Reconciliation | null) => void;
  setSimNodes: (n: number) => void;
  setSimSeed: (n: number) => void;
  setPermAverage: (a: PermAverage) => void;
  setHorizonOrder: (ids: string[]) => void;
  setNz: (n: number) => void;
  setScheme: (s: StaticState['layerScheme']) => void;
  setProp: (k: string) => void;
  setSliceOn: (b: boolean) => void;
  setSliceAxis: (a: 'i' | 'j' | 'k') => void;
  setSliceIndex: (n: number) => void;
  setSectionPoints: (p: Array<{ x: number; y: number }>) => void;
  setPropRamp: (key: string, ramp: string) => void;
  setPropRange: (key: string, r: { lo: number; hi: number } | null) => void;
  setShowShell: (b: boolean) => void;
  setShowEdges: (b: boolean) => void;
  setView: (v: ViewMode) => void;
  setZScale: (z: number) => void;
  setVisibleHorizons: (ids: string[]) => void;
  toggleHorizon: (id: string) => void;
  setShowWells: (b: boolean) => void;
  setVisibleWells: (w: string[] | null) => void;
  toggleWell: (name: string, all: string[]) => void;
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

  zoneModel: null,
  grid: null,
  building: null,
  reservoirZones: null,
  upscaled: null,
  sim: null,
  simInfo: null,
  propsVersion: 0,
  simming: null,
  volumes: null,
  simNodes: 24,
  simSeed: 1000,
  permAverage: 'geometric',

  propKey: 'phi',
  sliceOn: false,
  sliceAxis: 'k',
  sliceIndex: 0,
  sectionPoints: [],
  propRamp: {},
  propRange: {},
  showShell: true,
  showEdges: false,

  view: '3d',
  zScale: 8,
  visibleHorizons: [],
  showWells: true,
  visibleWells: null,
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
  reset: () => set({ done: new Set<ProcessId>(), windows: [], active: null, zoneModel: null, grid: null, building: null,
    reservoirZones: null, upscaled: null, sim: null, simming: null, volumes: null }),

  setZoneModel: (zoneModel) => set({ zoneModel }),
  // a new grid invalidates every property built on the old one
  setGrid: (grid) => set({ grid, upscaled: null, sim: null, volumes: null }),
  setBuilding: (building) => set({ building }),
  // changing what counts as reservoir invalidates the property model built under the
  // old scope — a sim that skipped a zone cannot be reinterpreted as having covered it
  setReservoirZones: (reservoirZones) => set({ reservoirZones, sim: null, volumes: null }),
  setUpscaled: (upscaled) => set({ upscaled }),
  setSim: (sim) => set({ sim }),
  setSimInfo: (simInfo) => set({ simInfo }),
  bumpProps: () => set((st) => ({ propsVersion: st.propsVersion + 1 })),
  setSimming: (simming) => set({ simming }),
  setVolumes: (volumes) => set({ volumes }),
  // a new simulation grid or seed invalidates the field it produced
  setSimNodes: (simNodes) => set({ simNodes, sim: null, volumes: null }),
  setSimSeed: (simSeed) => set({ simSeed, sim: null, volumes: null }),
  setPermAverage: (permAverage) => set({ permAverage, upscaled: null, sim: null, volumes: null }),
  setHorizonOrder: (horizonOrder) => set({ horizonOrder }),
  // changing the layering invalidates a grid built under the old scheme; a stale
  // grid is worse than none because it still renders
  setNz: (nzPerZone) => set({ nzPerZone, grid: null }),
  setScheme: (layerScheme) => set({ layerScheme, grid: null }),
  setProp: (propKey) => set({ propKey }),
  setSliceOn: (sliceOn) => set({ sliceOn }),
  // a new axis restarts the scrub — index 40 on i means nothing on k
  setSliceAxis: (sliceAxis) => set({ sliceAxis, sliceIndex: 0 }),
  setSliceIndex: (sliceIndex) => set({ sliceIndex }),
  setSectionPoints: (sectionPoints) => set({ sectionPoints }),
  setPropRamp: (key, ramp) => set((st) => ({ propRamp: { ...st.propRamp, [key]: ramp } })),
  // null CLEARS the pin and returns the property to auto-scaling — distinct from
  // pinning it to whatever auto happens to be right now, which would then stop tracking
  setPropRange: (key, r) => set((st) => {
    const next = { ...st.propRange };
    if (r) next[key] = r; else delete next[key];
    return { propRange: next };
  }),
  setShowShell: (showShell) => set({ showShell }),
  setShowEdges: (showEdges) => set({ showEdges }),
  setView: (view) => set({ view }),
  setZScale: (zScale) => set({ zScale }),
  setVisibleHorizons: (visibleHorizons) => set({ visibleHorizons }),
  toggleHorizon: (id) => set((s) => ({
    visibleHorizons: s.visibleHorizons.includes(id)
      ? s.visibleHorizons.filter((h) => h !== id)
      : [...s.visibleHorizons, id],
  })),
  setShowWells: (showWells) => set({ showWells }),
  setVisibleWells: (visibleWells) => set({ visibleWells }),
  toggleWell: (name, all) => set((st) => {
    const cur = st.visibleWells ?? all;
    return { visibleWells: cur.includes(name) ? cur.filter((w) => w !== name) : [...cur, name] };
  }),
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
