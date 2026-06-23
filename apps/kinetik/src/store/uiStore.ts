import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type Tab = 'today' | 'calendar' | 'moments' | 'apps' | 'me'
export type CalView = 'board' | 'month'

interface UiStore {
  theme: 'light' | 'dark'
  tab: Tab
  activeCircleId: string
  calWeekOffset: number
  calFilter: string[] | null
  calView: CalView
  calMonthOffset: number

  go: (tab: Tab) => void
  toggleTheme: () => void
  setCircle: (id: string) => void
  setWeekOffset: (n: number) => void
  setFilter: (ids: string[] | null) => void
  setCalView: (v: CalView) => void
  setMonthOffset: (n: number) => void
}

export const useUiStore = create<UiStore>()(
  persist(
    (set, get) => ({
      theme: 'light',
      tab: 'today',
      activeCircleId: '',
      calWeekOffset: 0,
      calFilter: null,
      calView: 'board',
      calMonthOffset: 0,

      go: (tab) => set({ tab }),
      toggleTheme: () => {
        const theme = get().theme === 'dark' ? 'light' : 'dark'
        document.documentElement.dataset.theme = theme
        set({ theme })
      },
      setCircle: (id) => set({ activeCircleId: id, calFilter: null }),
      setWeekOffset: (n) => set({ calWeekOffset: n }),
      setFilter: (ids) => set({ calFilter: ids }),
      setCalView: (v) => set({ calView: v }),
      setMonthOffset: (n) => set({ calMonthOffset: n }),
    }),
    {
      name: 'kinetik_ui_v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        theme: s.theme, tab: s.tab, activeCircleId: s.activeCircleId,
        calWeekOffset: s.calWeekOffset, calFilter: s.calFilter,
        calView: s.calView, calMonthOffset: s.calMonthOffset,
      }),
    },
  ),
)
