import { create } from 'zustand'

export type SurfaceId = 'portfolio' | 'pulse' | 'data' | 'audience' | 'builder'
export type DataTab = 'schema' | 'tables' | 'ontology'
export type BuilderTab = 'game' | 'app'
export type Theme = 'light' | 'dark'

const SURFACE_LABEL: Record<SurfaceId, string> = {
  portfolio: 'Portfolio', pulse: 'Pulse', data: 'Data', audience: 'Audience', builder: 'Builder',
}
export const surfaceLabel = (s: SurfaceId) => SURFACE_LABEL[s]

interface HQState {
  surface: SurfaceId
  dataTab: DataTab
  builderTab: BuilderTab
  theme: Theme
  go: (s: SurfaceId) => void
  setDataTab: (t: DataTab) => void
  setBuilderTab: (t: BuilderTab) => void
  toggleTheme: () => void
}

const initialTheme = (): Theme =>
  (localStorage.getItem('hq_theme') as Theme) || 'light'

export const useHQ = create<HQState>((set) => ({
  surface: 'data',
  dataTab: 'schema',
  builderTab: 'game',
  theme: initialTheme(),
  go: (surface) => set({ surface }),
  setDataTab: (dataTab) => set({ dataTab }),
  setBuilderTab: (builderTab) => set({ builderTab }),
  toggleTheme: () => set((s) => {
    const theme: Theme = s.theme === 'light' ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('hq_theme', theme)
    return { theme }
  }),
}))
