import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Session } from '@supabase/supabase-js'
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

  // — cloud (not persisted) —
  session: Session | null | 'loading'

  go: (tab: Tab) => void
  toggleTheme: () => void
  setCircle: (id: string) => void
  setWeekOffset: (n: number) => void
  setFilter: (ids: string[] | null) => void
  addEvent: (e: Omit<KEvent, 'id'>) => void
  heart: (momentId: string) => void
  setSession: (s: Session | null | 'loading') => void
  hydrateCloud: (d: { events?: KEvent[]; moments?: Moment[] }) => void
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
      session: 'loading',

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
      setSession: (s) => set({ session: s }),
      hydrateCloud: (d) =>
        set({ events: d.events ?? get().events, moments: d.moments ?? get().moments }),
    }),
    {
      name: 'kinetik_state_v2',   // bumped: now seeded from the real Aldyth-circle snapshot
      storage: createJSONStorage(() => localStorage),
      // session is runtime-only; never persist it.
      partialize: (s) => ({
        theme: s.theme, tab: s.tab, activeCircleId: s.activeCircleId,
        calWeekOffset: s.calWeekOffset, calFilter: s.calFilter,
        events: s.events, moments: s.moments,
      }),
    },
  ),
)
