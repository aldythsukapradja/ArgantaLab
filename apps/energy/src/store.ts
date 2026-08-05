import { create } from 'zustand';
import type { DomainId } from './nav';
import { defaultSubtab } from './nav';
import type { VaultNote } from './knowledge/types';
import { loadUserNotes, saveUserNotes } from './knowledge/vault';
import type {
  MapIntent, MapRequest, Scope, ScopeBrain, ScopeLevel, ScopePatch, ViewIntent, ViewRequest,
} from './agent/types';
import { applyPatch, clearLevel, clearScope, emptyScope } from './agent/scope';

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

  // ── The command bus (agent L0 · GLOBAL-SCOPE-FILTER-SPINE S0a) ──────────────
  // One Scope object. Every surface reads it. No surface owns it. The agent,
  // the scope bars and the command palette are all just clients of this bus.

  /** The global scope filter. Ancestors auto-fill; conflicts are surfaced. */
  scope: Scope;
  /** `reroot` releases older selections that contradict this one — an agent turn
   *  states a subject, it does not add a constraint to the previous one. */
  setScope: (patch: ScopePatch, opts?: { autofill?: boolean; reroot?: boolean }) => void;
  clearScopeLevel: (level: ScopeLevel) => void;
  resetScope: (keepFacets?: boolean) => void;
  /** Installed once the gazetteer has loaded (see agent/brain.ts). Until then
   *  scope still works, it simply does not auto-fill ancestors. */
  scopeBrain: ScopeBrain | null;
  installScopeBrain: (brain: ScopeBrain) => void;

  /** Cross-surface navigation request. CosmoShell owns `nav` as local state, so
   *  a deeply-nested surface (the Data QC extraction gate mirror, a chat turn)
   *  cannot route directly — it posts an intent here.
   *
   *  Intents are NOT consumed centrally: CosmoShell reads `nav` while the target
   *  vertical reads `sub`/`mode`, and a central consume would race them. `seq`
   *  increments on every request so repeating an identical intent still re-fires
   *  subscriber effects — the `driveLegacyNonce` pattern, generalised. */
  viewIntent: ViewIntent | null;
  requestView: (view: ViewRequest) => void;
  /** Back-compat shim for the two existing call sites. Prefer `requestView`. */
  requestNav: (nav: string, sub?: string) => void;

  /** Fly/highlight request for the Cockpit map. */
  mapIntent: MapIntent | null;
  requestMap: (map: MapRequest) => void;
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
  scope: emptyScope(),
  scopeBrain: null,
  setScope: (patch, opts) => set((s) => ({
    scope: applyPatch(s.scope, patch, {
      brain: s.scopeBrain,
      autofill: opts?.autofill ?? true,
      reroot: opts?.reroot ?? false,
    }),
  })),
  clearScopeLevel: (level) => set((s) => ({ scope: clearLevel(s.scope, level, s.scopeBrain) })),
  resetScope: (keepFacets) => set((s) => ({ scope: clearScope(s.scope, keepFacets) })),
  installScopeBrain: (brain) => set((s) => ({
    scopeBrain: brain,
    // Re-derive whatever is already in scope now that ancestry is known.
    scope: applyPatch(s.scope, {}, { brain, autofill: true }),
  })),

  viewIntent: null,
  requestView: (view) => set((s) => ({ viewIntent: { ...view, seq: (s.viewIntent?.seq ?? 0) + 1 } })),
  requestNav: (nav, sub) => get().requestView({ nav, sub }),

  mapIntent: null,
  requestMap: (map) => set((s) => ({ mapIntent: { ...map, seq: (s.mapIntent?.seq ?? 0) + 1 } })),
}));

// Apply the initial theme attribute at module load (before first paint).
applyTheme(useStore.getState().theme);
