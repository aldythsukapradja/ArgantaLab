import { create } from 'zustand';
import type { DomainId } from './nav';

interface AppState {
  domain: DomainId;
  paletteOpen: boolean;
  well: string;              // selected well/field context
  setDomain: (d: DomainId) => void;
  setWell: (w: string) => void;
  togglePalette: (v?: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  domain: 'foundation',
  paletteOpen: false,
  well: 'ALL WELLS',
  setDomain: (domain) => set({ domain, paletteOpen: false }),
  setWell: (well) => set({ well }),
  togglePalette: (v) => set((s) => ({ paletteOpen: v ?? !s.paletteOpen })),
}));
