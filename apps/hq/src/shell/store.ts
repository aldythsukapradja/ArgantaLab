import { create } from 'zustand'

export type SurfaceId = 'portfolio' | 'data' | 'growth' | 'content' | 'game' | 'app' | 'agents' | 'moments'
export type DataTab = 'schema' | 'tables' | 'ontology'
export type BuilderSub = 'catalogue' | 'studio' | 'analytics'
export type Theme = 'light' | 'dark'
export type AgentSize = 'small' | 'expanded' | 'full'

const SURFACE_LABEL: Record<SurfaceId, string> = {
  portfolio: 'Portfolio', data: 'Data', growth: 'Growth',
  content: 'Learn Builder', game: 'Game Builder', app: 'App Builder',
  agents: 'Agent Builder', moments: 'Content Creator',
}
export const surfaceLabel = (s: SurfaceId) => SURFACE_LABEL[s]

interface HQState {
  surface: SurfaceId
  dataTab: DataTab
  builderSub: BuilderSub
  studioId: string | null          // artifact being edited in Studio (null = new)
  analyticsFocus: string | null    // artifact selected in Analytics detail
  theme: Theme
  agentOpen: boolean               // floating COO/CEO orb open?
  agentSize: AgentSize             // small | expanded | full
  go: (s: SurfaceId) => void
  setDataTab: (t: DataTab) => void
  setBuilderSub: (t: BuilderSub) => void
  openStudio: (id?: string | null) => void
  openAnalytics: (focusId?: string | null) => void
  toggleTheme: () => void
  openAgent: (size?: AgentSize) => void
  closeAgent: () => void
  toggleAgent: () => void
  setAgentSize: (s: AgentSize) => void
}

const initialTheme = (): Theme =>
  (localStorage.getItem('hq_theme') as Theme) || 'light'

export const useHQ = create<HQState>((set) => ({
  surface: 'portfolio',
  dataTab: 'schema',
  builderSub: 'catalogue',
  studioId: null,
  analyticsFocus: null,
  theme: initialTheme(),
  agentOpen: false,
  agentSize: 'expanded',
  go: (surface) => set({ surface, builderSub: 'catalogue', studioId: null }),
  setDataTab: (dataTab) => set({ dataTab }),
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
}))
