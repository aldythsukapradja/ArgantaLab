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

export type SceneView = '2d' | '3d';

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

  setField: (fieldId: string) => void;
  setHorizon: (id: string | null) => void;
  toggleMulti: (id: string) => void;
  setMulti: (ids: string[]) => void;
  setView: (view: SceneView) => void;
  setZScale: (z: number) => void;
  toggleVis: (nodeId: string) => void;
  setSel: (nodeId: string | null) => void;
}

export const useScene = create<SceneState>((set) => ({
  fieldId: null,
  horizonId: null,
  multiIds: [],
  view: '2d',
  zScale: 6,
  vis: {},
  sel: null,

  setField: (fieldId) => set((s) => (s.fieldId === fieldId ? s : {
    fieldId, horizonId: null, multiIds: [], vis: {}, sel: null,
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
}));

/** Absent = visible. Keeps callers from repeating the `!== false` dance. */
export const isVisible = (vis: Visibility, nodeId: string) => vis[nodeId] !== false;
