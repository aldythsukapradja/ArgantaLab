import { create } from 'zustand';
import type { DomainId } from './nav';

export type Theme = 'dark' | 'light';

// Initial theme: saved choice → system preference → dark (control-room default).
function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem('ae_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
  } catch { /* SSR / no storage */ }
  return 'dark';
}
export function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('ae_theme', t); } catch { /* ignore */ }
}

interface AppState {
  domain: DomainId;
  paletteOpen: boolean;
  well: string;              // selected well/field context
  theme: Theme;
  setDomain: (d: DomainId) => void;
  setWell: (w: string) => void;
  togglePalette: (v?: boolean) => void;
  toggleTheme: () => void;
}

export const useStore = create<AppState>((set) => ({
  domain: 'foundation',
  paletteOpen: false,
  well: 'ALL WELLS',
  theme: initialTheme(),
  setDomain: (domain) => set({ domain, paletteOpen: false }),
  setWell: (well) => set({ well }),
  togglePalette: (v) => set((s) => ({ paletteOpen: v ?? !s.paletteOpen })),
  toggleTheme: () => set((s) => { const theme: Theme = s.theme === 'dark' ? 'light' : 'dark'; applyTheme(theme); return { theme }; }),
}));

// Apply the initial theme attribute at module load (before first paint).
applyTheme(useStore.getState().theme);
