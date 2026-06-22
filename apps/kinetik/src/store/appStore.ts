import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { SEED_EVENTS, SEED_MOMENTS, CIRCLES, type KEvent, type Moment } from '@data/seed'

export type Tab = 'today' | 'calendar' | 'moments' | 'apps' | 'me'

interface AppStore {
  theme: 'light' | 'dark'
  tab: Tab
  activeCircleId: string
  calWeekOffset: number
  calFilter: string[] | null   // null = everyone
  events: KEvent[]
  moments: Moment[]

  go: (tab: Tab) => void
  toggleTheme: () => void
  setCircle: (id: string) => void
  setWeekOffset: (n: number) => void
  setFilter: (ids: string[] | null) => void
  addEvent: (e: Omit<KEvent, 'id'>) => void
  heart: (momentId: string) => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      theme: 'light',
      tab: 'today',
      activeCircleId: CIRCLES[0].id,
      calWeekOffset: 0,
      calFilter: null,
      events: SEED_EVENTS,
      moments: SEED_MOMENTS,

      go: (tab) => set({ tab }),
      toggleTheme: () => {
        const theme = get().theme === 'dark' ? 'light' : 'dark'
        document.documentElement.dataset.theme = theme
        set({ theme })
      },
      setCircle: (id) => set({ activeCircleId: id, calFilter: null }),
      setWeekOffset: (n) => set({ calWeekOffset: n }),
      setFilter: (ids) => set({ calFilter: ids }),
      addEvent: (e) =>
        set({ events: [...get().events, { ...e, id: 'e_' + Math.random().toString(36).slice(2, 9) }] }),
      heart: (momentId) =>
        set({ moments: get().moments.map(m => m.id === momentId ? { ...m, hearts: m.hearts + 1 } : m) }),
    }),
    {
      name: 'kinetik_state_v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
