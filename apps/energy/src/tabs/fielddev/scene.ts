// scene.ts — the Field Development SCENE: what the user is currently looking at.
//
// The Knowledge Bank's field map and the Workspace's Data Explorer are not two maps
// that sync. They are one scene rendered twice. Everything a user PICKS lives here —
// which horizon is draped, which horizons are stacked in 3D, 2D vs 3D, the vertical
// exaggeration, and the Input tree's per-node visibility. Pick a horizon in Knowledge,
// switch to Workspace, and it is already draped, because there was only ever one
// selection.
//
// What deliberately does NOT live here: decoded grids, the horizon catalogue, well
// geometry. Those are DERIVED from the field's ingested assets — each mount rebuilds
// them from the same digests, and caching them globally would mean holding decoded
// int16 grids for a field the user has navigated away from.
//
// Scoped by fieldId: re-scoping the suite to another field resets the scene rather
// than draping horizon ids that belong to somebody else's field.
import { create } from 'zustand';

/** 'xsec' renders the section the user traced with the map's section tool. The
 *  trace itself is NOT scene state — it is a drawn interpretation and lives with
 *  the rest of them in interpret.ts, so it survives a view change and a reload. */
export type SceneView = '2d' | '3d' | 'xsec';

/** Input-tree node ids are `${folder}:${id}` — see InputTree's `nodeId`. */
export type Visibility = Record<string, boolean>;

interface SceneState {
  fieldId: string | null;
  /** 2D drapes exactly one horizon; 3D stacks any number. Both persist across views. */
  horizonId: string | null;
  multiIds: string[];
  view: SceneView;
  zScale: number;
  /** Absent id = visible. Only explicit `false` hides, so a new node defaults to shown. */
  vis: Visibility;
  /** Selected Input-tree node, for the inspector and canvas highlight. */
  sel: string | null;
  /**
   * The pick surface the correlation panel FLATTENS on, chosen from the Input
   * tree's Well tops folder.
   *
   * It lives here rather than in the panel because the tree is the control: a
   * datum is a thing in the delivery you point at, not a dropdown the panel
   * happens to own. Null means hang on measured depth.
   */
  datum: string | null;
  /** Bumped whenever the ingested asset set changes (a reference package finishes
   *  digesting, a client file lands). Anything reading IndexedDB depends on it —
   *  otherwise a surface list built before the package arrived stays empty forever. */
  dataVersion: number;

  setField: (fieldId: string) => void;
  setHorizon: (id: string | null) => void;
  toggleMulti: (id: string) => void;
  setMulti: (ids: string[]) => void;
  setView: (view: SceneView) => void;
  setZScale: (z: number) => void;
  toggleVis: (nodeId: string) => void;
  setSel: (nodeId: string | null) => void;
  setDatum: (surface: string | null) => void;
  bumpData: () => void;
}

export const useScene = create<SceneState>((set) => ({
  fieldId: null,
  horizonId: null,
  multiIds: [],
  view: '2d',
  zScale: 6,
  vis: {},
  sel: null,
  datum: null,
  dataVersion: 0,

  setField: (fieldId) => set((s) => (s.fieldId === fieldId ? s : {
    fieldId, horizonId: null, multiIds: [], vis: {}, sel: null, datum: null,
  })),
  setHorizon: (id) => set({ horizonId: id }),
  toggleMulti: (id) => set((s) => ({
    multiIds: s.multiIds.includes(id) ? s.multiIds.filter((m) => m !== id) : [...s.multiIds, id],
  })),
  setMulti: (ids) => set({ multiIds: ids }),
  setView: (view) => set({ view }),
  setZScale: (zScale) => set({ zScale }),
  toggleVis: (nodeId) => set((s) => ({ vis: { ...s.vis, [nodeId]: s.vis[nodeId] === false } })),
  setSel: (nodeId) => set((s) => ({ sel: s.sel === nodeId ? null : nodeId })),
  // clicking the datum again clears it — one gesture, both directions
  setDatum: (surface) => set((s) => ({ datum: s.datum === surface ? null : surface })),
  bumpData: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
}));

/** Absent = visible. Keeps callers from repeating the `!== false` dance. */
export const isVisible = (vis: Visibility, nodeId: string) => vis[nodeId] !== false;
