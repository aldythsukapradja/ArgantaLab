import { create } from 'zustand';
import type { DomainId } from './nav';
import { defaultSubtab } from './nav';
import type { VaultNote } from './knowledge/types';
import { loadUserNotes, saveUserNotes } from './knowledge/vault';

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

function initialDrawer(): boolean {
  try { return localStorage.getItem('ae_drawer') === 'collapsed'; } catch { return false; }
}

interface AppState {
  domain: DomainId;
  subtab: string;
  paletteOpen: boolean;
  theme: Theme;
  drawerCollapsed: boolean;
  cosmoOpen: boolean;
  userNotes: VaultNote[];    // extraction/user layer (persisted), merged over baked kb.json
  selectedNoteId: string | null;
  setDomain: (d: DomainId) => void;
  setSubtab: (id: string) => void;
  goto: (d: DomainId, sub?: string) => void;
  togglePalette: (v?: boolean) => void;
  toggleTheme: () => void;
  toggleDrawer: (v?: boolean) => void;
  toggleCosmo: (v?: boolean) => void;
  openNote: (id: string) => void;       // cross-surface: graph → explorer
  addUserNote: (n: VaultNote) => void;  // extraction accept → vault
  /** One-shot cross-surface navigation request. CosmoShell owns `nav` as local
   *  state, so a deeply-nested surface (e.g. the Data QC extraction gate mirror)
   *  cannot route directly — it posts an intent here and the shell consumes it. */
  navIntent: { nav: string; sub?: string } | null;
  requestNav: (nav: string, sub?: string) => void;
  consumeNavIntent: () => void;
}

// Land on Data·Overview (real content) rather than Core (placeholder for now).
export const useStore = create<AppState>((set, get) => ({
  domain: 'data',
  subtab: defaultSubtab('data'),
  paletteOpen: false,
  theme: initialTheme(),
  drawerCollapsed: initialDrawer(),
  cosmoOpen: false,
  userNotes: loadUserNotes(),
  selectedNoteId: null,
  setDomain: (domain) => set({ domain, subtab: defaultSubtab(domain), paletteOpen: false }),
  setSubtab: (subtab) => set({ subtab }),
  goto: (domain, sub) => set({ domain, subtab: sub ?? defaultSubtab(domain), paletteOpen: false }),
  togglePalette: (v) => set((s) => ({ paletteOpen: v ?? !s.paletteOpen })),
  toggleTheme: () => set((s) => { const theme: Theme = s.theme === 'dark' ? 'light' : 'dark'; applyTheme(theme); return { theme }; }),
  toggleDrawer: (v) => set((s) => {
    const drawerCollapsed = v ?? !s.drawerCollapsed;
    try { localStorage.setItem('ae_drawer', drawerCollapsed ? 'collapsed' : 'expanded'); } catch { /* ignore */ }
    return { drawerCollapsed };
  }),
  toggleCosmo: (v) => set((s) => ({ cosmoOpen: v ?? !s.cosmoOpen })),
  openNote: (id) => set({ domain: 'knowledge', subtab: 'explorer', selectedNoteId: id, cosmoOpen: false }),
  addUserNote: (n) => {
    const next = [...get().userNotes.filter((x) => x.id !== n.id), n];
    saveUserNotes(next);
    set({ userNotes: next });
  },
  navIntent: null,
  requestNav: (nav, sub) => set({ navIntent: { nav, sub } }),
  consumeNavIntent: () => set({ navIntent: null }),
}));

// Apply the initial theme attribute at module load (before first paint).
applyTheme(useStore.getState().theme);
