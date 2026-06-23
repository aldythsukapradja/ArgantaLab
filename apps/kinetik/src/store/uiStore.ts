// =========================================================
//  UI STATE ONLY — theme, current tab, which circle is in view,
//  calendar navigation + filters. No domain data lives here, so
//  there's no chance of "is this the real list or a stale copy?".
//  Persisted: just the user's preferences.
// =========================================================
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type Tab = 'today' | 'calendar' | 'moments' | 'apps' | 'me'

interface UiStore {
  theme: 'light' | 'dark'
  tab: Tab
  activeCircleId: string
  calWeekOffset: number
  calFilter: string[] | null // null = everyone

  go: (tab: Tab) => void
  toggleTheme: () => void
  setCircle: (id: string) => void
  setWeekOffset: (n: number) => void
  setFilter: (ids: string[] | null) => void
}

export const useUiStore = create<UiStore>()(
  persist(
    (set, get) => ({
      theme: 'light',
      tab: 'today',
      activeCircleId: '',
      calWeekOffset: 0,
      calFilter: null,

      go: (tab) => set({ tab }),
      toggleTheme: () => {
        const theme = get().theme === 'dark' ? 'light' : 'dark'
        document.documentElement.dataset.theme = theme
        set({ theme })
      },
      setCircle: (id) => set({ activeCircleId: id, calFilter: null }),
      setWeekOffset: (n) => set({ calWeekOffset: n }),
      setFilter: (ids) => set({ calFilter: ids }),
    }),
    {
      name: 'kinetik_ui_v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        theme: s.theme, tab: s.tab, activeCircleId: s.activeCircleId,
        calWeekOffset: s.calWeekOffset, calFilter: s.calFilter,
      }),
    },
  ),
)
