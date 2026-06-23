import { create } from 'zustand'

export type SurfaceId = 'portfolio' | 'pulse' | 'data' | 'audience' | 'content' | 'game' | 'app'
export type DataTab = 'schema' | 'tables' | 'ontology'
export type BuilderSub = 'catalogue' | 'studio' | 'analytics'
export type Theme = 'light' | 'dark'

const SURFACE_LABEL: Record<SurfaceId, string> = {
  portfolio: 'Portfolio', pulse: 'Pulse', data: 'Data', audience: 'Audience',
  content: 'Content', game: 'Game Builder', app: 'App Builder',
}
export const surfaceLabel = (s: SurfaceId) => SURFACE_LABEL[s]

interface HQState {
  surface: SurfaceId
  dataTab: DataTab
  builderSub: BuilderSub
  studioId: string | null          // artifact being edited in Studio (null = new)
  analyticsFocus: string | null    // artifact selected in Analytics detail
  theme: Theme
  go: (s: SurfaceId) => void
  setDataTab: (t: DataTab) => void
  setBuilderSub: (t: BuilderSub) => void
  openStudio: (id?: string | null) => void
  openAnalytics: (focusId?: string | null) => void
  toggleTheme: () => void
}

const initialTheme = (): Theme =>
  (localStorage.getItem('hq_theme') as Theme) || 'light'

export const useHQ = create<HQState>((set) => ({
  surface: 'data',
  dataTab: 'schema',
  builderSub: 'catalogue',
  studioId: null,
  analyticsFocus: null,
  theme: initialTheme(),
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
}))
