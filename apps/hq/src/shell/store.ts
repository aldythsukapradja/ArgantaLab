import { create } from 'zustand'

export type SurfaceId = 'home' | 'portfolio' | 'data' | 'growth' | 'content' | 'game' | 'app' | 'agents' | 'broadcast' | 'command' | 'pixel' | 'vault' | 'architecture' | 'battle' | 'character' | 'world' | 'music' | 'video' | 'media' | 'knowledge' | 'cinema' | 'reactor' | 'rack' | 'copilot' | 'core' | 'brand' | 'influencer' | 'biography'
export type DataTab = 'schema' | 'tables' | 'ontology'
export type BuilderSub = 'catalogue' | 'studio' | 'analytics'
/** GB-3 · The Forge (v2 chat-driven builder) is the default; 'legacy' renders
 * the untouched v1 wizard (BuilderShell) behind a tab, same pattern as the
 * Music/Content builders' Legacy button. */
export type ForgeTab = 'forge' | 'legacy'
export type Theme = 'light' | 'dark'
export type AgentSize = 'small' | 'expanded' | 'full'
// Command sub-tabs: the org lobby + the six offices (office ids are stable).
export type CommandTab = 'lobby' | 'bridge' | 'operations' | 'technology' | 'treasury' | 'legal' | 'roster'

const SURFACE_LABEL: Record<SurfaceId, string> = {
  home: 'Home', portfolio: 'Portfolio', data: 'Data', growth: 'Growth',
  content: 'Learn Builder', game: 'Game Builder', app: 'App Builder',
  agents: 'Agent Builder', broadcast: 'Post Studio', command: 'Command',
  pixel: 'Pixel Studio', vault: 'HQ Vault', architecture: 'Architecture', battle: 'Battle Builder',
  character: 'Character Forge', world: 'Openworld Builder', music: 'Audio Studio',
  video: 'Video Studio', media: 'Media Studio', knowledge: 'Knowledge', cinema: 'Cinema',
  reactor: 'Reactor Builder', rack: 'Model Rack', copilot: 'Copilot', core: 'Arganta Core',
  brand: 'Brand Studio', influencer: 'Influencer Studio', biography: 'Biography Studio',
}
export const surfaceLabel = (s: SurfaceId) => SURFACE_LABEL[s]

interface HQState {
  surface: SurfaceId
  coreReturn: SurfaceId            // where the Agent (core) full-screen X returns to
  dataTab: DataTab
  builderSub: BuilderSub
  commandTab: CommandTab           // Command sub-tab: lobby | office id
  studioId: string | null          // artifact being edited in Studio (null = new)
  forgeTab: ForgeTab               // Forge (v2) vs Legacy (v1 wizard)
  forgeArtifactId: string | null   // hq_artifact open in the Forge (null = empty state)
  analyticsFocus: string | null    // artifact selected in Analytics detail
  theme: Theme
  agentOpen: boolean               // floating COO/CEO orb open?
  agentSize: AgentSize             // small | expanded | full
  paletteOpen: boolean             // ⌘K command palette open?
  verdictState: Record<string, 'active' | 'resolved' | 'rejected'>  // Command verdict lifecycle
  setVerdictState: (id: string, s: 'active' | 'resolved' | 'rejected') => void
  go: (s: SurfaceId) => void
  goOffice: (t: CommandTab) => void // jump into Command at a given sub-tab
  setDataTab: (t: DataTab) => void
  setCommandTab: (t: CommandTab) => void
  setBuilderSub: (t: BuilderSub) => void
  openStudio: (id?: string | null) => void
  setForgeTab: (t: ForgeTab) => void
  setForgeArtifact: (id: string | null) => void
  /** GB-7 · the Core→Builder seam: jump to a builder surface with an artifact
   * already open for manual iteration. Always lands on the Forge tab — the
   * legacy wizard has no concept of an hq_artifact id. */
  openInForge: (surface: 'app' | 'game', artifactId: string) => void
  openAnalytics: (focusId?: string | null) => void
  toggleTheme: () => void
  openAgent: (size?: AgentSize) => void
  closeAgent: () => void
  toggleAgent: () => void
  setAgentSize: (s: AgentSize) => void
  openPalette: () => void
  closePalette: () => void
  togglePalette: () => void
}

const initialTheme = (): Theme =>
  (localStorage.getItem('hq_theme') as Theme) || 'light'

export const useHQ = create<HQState>((set) => ({
  surface: 'home',
  coreReturn: 'portfolio',
  dataTab: 'schema',
  builderSub: 'catalogue',
  commandTab: 'lobby',
  studioId: null,
  forgeTab: 'forge',
  forgeArtifactId: null,
  analyticsFocus: null,
  theme: initialTheme(),
  agentOpen: false,
  agentSize: 'expanded',
  paletteOpen: false,
  verdictState: {},
  setVerdictState: (id, s) => set((st) => ({ verdictState: { ...st.verdictState, [id]: s } })),
  // Entering the Agent (core) full-screen remembers where we came from, so its
  // X returns there instead of a hardcoded default.
  // Navigating to a builder from the rail/palette starts FRESH (forgeArtifactId
  // cleared) — openInForge sets `surface` directly for the Core seam, so it
  // deliberately bypasses this reset and keeps the artifact it was handed.
  go: (surface) => set((st) => ({
    surface, builderSub: 'catalogue', studioId: null, commandTab: 'lobby', forgeArtifactId: null,
    coreReturn: surface === 'core' && st.surface !== 'core' ? st.surface : st.coreReturn,
  })),
  goOffice: (commandTab) => set({ surface: 'command', commandTab }),
  setDataTab: (dataTab) => set({ dataTab }),
  setCommandTab: (commandTab) => set({ commandTab }),
  setBuilderSub: (builderSub) => set({ builderSub }),
  openStudio: (id = null) => set({ builderSub: 'studio', studioId: id }),
  setForgeTab: (forgeTab) => set({ forgeTab }),
  setForgeArtifact: (forgeArtifactId) => set({ forgeArtifactId }),
  openInForge: (surface, forgeArtifactId) => set({ surface, forgeTab: 'forge', forgeArtifactId }),
  openAnalytics: (focusId = null) => set({ builderSub: 'analytics', analyticsFocus: focusId }),
  toggleTheme: () => set((s) => {
    const theme: Theme = s.theme === 'light' ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('hq_theme', theme)
    return { theme }
  }),
  openAgent: (size) => set(size ? { agentOpen: true, agentSize: size } : { agentOpen: true }),
  closeAgent: () => set({ agentOpen: false }),
  toggleAgent: () => set((s) => ({ agentOpen: !s.agentOpen })),
  setAgentSize: (agentSize) => set({ agentSize }),
  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
}))
