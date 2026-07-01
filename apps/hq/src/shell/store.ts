import { create } from 'zustand'

export type SurfaceId = 'portfolio' | 'data' | 'growth' | 'content' | 'game' | 'app' | 'agents' | 'broadcast' | 'command'
export type DataTab = 'schema' | 'tables' | 'ontology'
export type BuilderSub = 'catalogue' | 'studio' | 'analytics'
export type Theme = 'light' | 'dark'
export type AgentSize = 'small' | 'expanded' | 'full'
// Command sub-tabs: the org lobby + the six offices (office ids are stable).
export type CommandTab = 'lobby' | 'bridge' | 'operations' | 'technology' | 'treasury' | 'legal' | 'roster'

const SURFACE_LABEL: Record<SurfaceId, string> = {
  portfolio: 'Portfolio', data: 'Data', growth: 'Growth',
  content: 'Learn Builder', game: 'Game Builder', app: 'App Builder',
  agents: 'Agent Builder', broadcast: 'Content Builder', command: 'Command',
}
export const surfaceLabel = (s: SurfaceId) => SURFACE_LABEL[s]

interface HQState {
  surface: SurfaceId
  dataTab: DataTab
  builderSub: BuilderSub
  commandTab: CommandTab           // Command sub-tab: lobby | office id
  studioId: string | null          // artifact being edited in Studio (null = new)
  analyticsFocus: string | null    // artifact selected in Analytics detail
  theme: Theme
  agentOpen: boolean               // floating COO/CEO orb open?
  agentSize: AgentSize             // small | expanded | full
  paletteOpen: boolean             // ⌘K command palette open?
  go: (s: SurfaceId) => void
  goOffice: (t: CommandTab) => void // jump into Command at a given sub-tab
  setDataTab: (t: DataTab) => void
  setCommandTab: (t: CommandTab) => void
  setBuilderSub: (t: BuilderSub) => void
  openStudio: (id?: string | null) => void
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
  surface: 'portfolio',
  dataTab: 'schema',
  builderSub: 'catalogue',
  commandTab: 'lobby',
  studioId: null,
  analyticsFocus: null,
  theme: initialTheme(),
  agentOpen: false,
  agentSize: 'expanded',
  paletteOpen: false,
  go: (surface) => set({ surface, builderSub: 'catalogue', studioId: null, commandTab: 'lobby' }),
  goOffice: (commandTab) => set({ surface: 'command', commandTab }),
  setDataTab: (dataTab) => set({ dataTab }),
  setCommandTab: (commandTab) => set({ commandTab }),
  setBuilderSub: (builderSub) => set({ builderSub }),
  openStudio: (id = null) => set({ builderSub: 'studio', studioId: id }),
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
