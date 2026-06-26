import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type Tab = 'today' | 'calendar' | 'moments' | 'apps' | 'me'
export type CalView = 'board' | 'month'

/** Saved board layout per circle: which members (in column order) + how many columns. */
export interface BoardLayout { cols: number; members: string[] }

interface UiStore {
  theme: 'light' | 'dark'
  tab: Tab
  activeCircleId: string
  calWeekOffset: number
  calFilter: string[] | null
  calView: CalView
  calMonthOffset: number
  boardLayout: Record<string, BoardLayout>

  go: (tab: Tab) => void
  toggleTheme: () => void
  setCircle: (id: string) => void
  setWeekOffset: (n: number) => void
  setFilter: (ids: string[] | null) => void
  setCalView: (v: CalView) => void
  setMonthOffset: (n: number) => void
  setBoardLayout: (circleId: string, layout: BoardLayout) => void
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
      boardLayout: {},

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
      setBoardLayout: (circleId, layout) => set(s => ({ boardLayout: { ...s.boardLayout, [circleId]: layout } })),
    }),
    {
      name: 'kinetik_ui_v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        theme: s.theme, tab: s.tab, activeCircleId: s.activeCircleId,
        calWeekOffset: s.calWeekOffset, calFilter: s.calFilter,
        calView: s.calView, calMonthOffset: s.calMonthOffset,
        boardLayout: s.boardLayout,
      }),
    },
  ),
)
