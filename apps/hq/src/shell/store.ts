import { create } from 'zustand'

export type SurfaceId =
  | 'pulse' | 'portfolio' | 'features' | 'audience' | 'economy'
  | 'agents' | 'forge' | 'studio' | 'registry'

export type ProductLens = 'portfolio' | 'arganta' | 'kinetik'

interface HQState {
  surface: SurfaceId
  product: ProductLens
  theme: 'dark' | 'light'
  cmdOpen: boolean
  go: (s: SurfaceId) => void
  setProduct: (p: ProductLens) => void
  toggleTheme: () => void
  setCmd: (o: boolean) => void
}

const initialTheme = (): 'dark' | 'light' =>
  (localStorage.getItem('hq_theme') as 'dark' | 'light') || 'dark'

export const useHQ = create<HQState>((set) => ({
  surface: 'pulse',
  product: 'portfolio',
  theme: initialTheme(),
  cmdOpen: false,
  go: (surface) => set({ surface }),
  setProduct: (product) => set({ product }),
  toggleTheme: () => set((s) => {
    const theme = s.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('hq_theme', theme)
    return { theme }
  }),
  setCmd: (cmdOpen) => set({ cmdOpen }),
}))
