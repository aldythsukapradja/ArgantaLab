// interp-store.ts — the drawn interpretation, shared by the canvas and the tree.
//
// The drawing tools live on the Workspace canvas; what they produce has to appear
// in the Input tree beside the delivered data, and hiding a node in the tree has
// to hide it on the canvas. Those are two components that never see each other,
// so the features cannot live in either — they live here, exactly like `scene`
// holds what the user is looking at.
//
// Scoped by field, and rehydrated from localStorage on scope, so switching field
// does not carry one asset's polygons onto another's map.
import { create } from 'zustand';
import {
  type InterpFeature, type FeatureKind, type LonLat,
  loadFeatures, saveFeatures, newFeature,
} from './interpret';

/** Input-tree node id for a drawn feature, in the same `${folder}:${id}` shape the
 *  rest of the tree uses — so scene.vis governs it with no special case. */
export const interpNodeId = (f: InterpFeature) => `${FOLDER_OF[f.kind]}:${f.id}`;

/** Which Input folder each drawn kind belongs in. `point`, `obs` and `well` all
 *  land in Points: they are one geometry with different intent, and the tree
 *  already distinguishes them by their own label. */
export const FOLDER_OF: Record<FeatureKind, string> = {
  point: 'points', obs: 'points', well: 'points',
  polyline: 'polylines', polygon: 'polygons', section: 'sections',
};

interface InterpState {
  fieldId: string | null;
  features: InterpFeature[];
  setField: (fieldId: string) => void;
  add: (kind: FeatureKind, pts: LonLat[]) => void;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
}

/** Persist on every mutation. These sets are tens of features, not thousands —
 *  a write per edit is cheaper than reasoning about when to flush. */
function persist(fieldId: string | null, features: InterpFeature[]) {
  if (fieldId) saveFeatures(fieldId, features);
  return features;
}

export const useInterp = create<InterpState>((set) => ({
  fieldId: null,
  features: [],

  setField: (fieldId) => set((s) => (s.fieldId === fieldId
    ? s
    : { fieldId, features: loadFeatures(fieldId) })),

  add: (kind, pts) => set((s) => ({
    features: persist(s.fieldId, [...s.features, newFeature(kind, pts, s.features)]),
  })),

  remove: (id) => set((s) => ({
    features: persist(s.fieldId, s.features.filter((f) => f.id !== id)),
  })),

  rename: (id, name) => set((s) => ({
    features: persist(s.fieldId, s.features.map((f) => (f.id === id ? { ...f, name } : f))),
  })),
}));

/** The section the X-Section view renders: the most recently drawn one. */
export const latestSection = (features: InterpFeature[]): InterpFeature | null => {
  const secs = features.filter((f) => f.kind === 'section');
  return secs.length ? secs[secs.length - 1] : null;
};

/** Read-only helper for components that only need the current list. */
export const interpFeatures = () => useInterp.getState().features;
