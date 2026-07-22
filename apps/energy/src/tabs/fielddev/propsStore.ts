// propsStore.ts — shared field-development property store. Petrophysics writes
// per-well zone averages + upscaled cell values here; Property and Volumetrics
// read them. Zustand (already a dep). Persisted to localStorage so a computed
// Petrophysics result survives a tab switch.
import { create } from 'zustand';

export interface WellProp {
  well: string;
  x: number; y: number;
  ntg: number;       // interpreted zone NTG
  phie: number;      // interpreted zone PHIE (net-weighted)
  sw: number;        // interpreted zone SW (net-weighted)
  netM: number; grossM: number;
  // recompute (Archie) discrepancy, if computed:
  phieDerived?: number;
  swDerived?: number;
  // upscaled cell values (Structural upscaling panel):
  phieUp?: number;
  netSand?: number;
  facies?: 'SAND' | 'SHALE';
}

interface PropsState {
  wells: Record<string, WellProp>;
  setWell: (w: WellProp) => void;
  setMany: (ws: WellProp[]) => void;
  clear: () => void;
}

const KEY = 'ae_fd_props_v1';
const load = (): Record<string, WellProp> => {
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch { /* ignore */ }
  return {};
};
const save = (w: Record<string, WellProp>) => { try { localStorage.setItem(KEY, JSON.stringify(w)); } catch { /* ignore */ } };

export const usePropsStore = create<PropsState>((set) => ({
  wells: load(),
  setWell: (w) => set((s) => { const wells = { ...s.wells, [w.well]: w }; save(wells); return { wells }; }),
  setMany: (ws) => set((s) => { const wells = { ...s.wells }; for (const w of ws) wells[w.well] = w; save(wells); return { wells }; }),
  clear: () => set(() => { save({}); return { wells: {} }; }),
}));
