import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Session } from '@supabase/supabase-js'

// Local-dev bypass so gated actions are testable without real OAuth.
// Never true in production (import.meta.env.DEV === false there).
const DEV_AUTH_BYPASS = import.meta.env.DEV &&
  typeof localStorage !== 'undefined' && localStorage.getItem('alab_dev_guest') === '1'

export interface Toast {
  id: string
  msg: string
  emoji?: string
}

export interface StudioMessage {
  role: 'ai' | 'you' | 'warn'
  html?: string
  text?: string
}

interface AppStore {
  // — persisted user data —
  learnerName: string
  avatar: string
  xp: number
  level: number
  diamonds: number
  badges: string[]
  completedLessons: string[]
  gamesPlayed: string[]
  theme: 'light' | 'dark'
  pitchScript: string
  pitchCompleted: boolean
  missions: Record<string, number[]>
  lastTab: string

  // — auth (not persisted) —
  session: Session | null | 'loading'
  authWallReason: string | null   // non-null = login overlay is open

  // — session UI state (not persisted) —
  activeTab: string
  lessonId: string | null
  lessonStep: number
  showConcept: boolean
  openGameId: string | null
  playGameHtml: string | null
  playGameTitle: string
  toasts: Toast[]
  pendingBadge: string | null
  showConfetti: boolean

  // — studio session state (not persisted) —
  studioDevice: 'desktop' | 'tablet' | 'iphone'
  studioDemo: 'tetris' | 'invaders'
  studioInput: string
  studioBuilding: boolean
  studioBuildStep: string
  studioMessages: StudioMessage[]

  // — actions —
  hydrateFromCloud: (p: { display_name: string; xp: number; level: number; diamonds: number; completed_lessons: string[]; badges: string[]; games_played: string[] }) => void
  setLearnerName: (name: string) => void
  setSession: (s: Session | null | 'loading') => void
  isAuthed: () => boolean
  requireAuth: (reason?: string) => boolean
  openAuthWall: (reason?: string) => void
  closeAuthWall: () => void
  go: (p: { tab?: string; lessonId?: string | null; step?: number }) => void
  addXp: (n: number) => void
  completeLesson: (id: string) => void
  toggleTheme: () => void
  openGame: (id: string) => void
  closeGame: () => void
  playWizardGame: (html: string, title: string) => void
  closeWizardGame: () => void
  setShowConcept: (v: boolean) => void
  addToast: (msg: string, emoji?: string) => void
  clearBadge: () => void
  clearConfetti: () => void
  savePitchScript: (s: string) => void
  toggleMission: (lessonId: string, i: number) => void
  setStudioDevice: (d: 'desktop' | 'tablet' | 'iphone') => void
  setStudioDemo: (d: 'tetris' | 'invaders') => void
  runStudioBuild: (text: string) => void
  studioControl?: (control: string) => void
}

const XP_PER_LEVEL = (l: number) => l * 500

const INITIAL_STUDIO_MESSAGES: StudioMessage[] = [
  { role: 'ai', html: 'Tell me what to build. This Studio can generate two working games: <b>Tetris</b> or <b>Space Invaders</b>.' },
  { role: 'ai', html: 'Pick a template or type a prompt, then press Build.' },
]

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // persisted defaults
      learnerName: 'Baginda',
      avatar: 'B',
      xp: 120,
      level: 1,
      diamonds: 0,
      badges: [],
      completedLessons: [],
      gamesPlayed: [],
      theme: 'light',
      pitchScript: '',
      pitchCompleted: false,
      missions: {},
      lastTab: 'arganta',

      // auth defaults
      session: 'loading',
      authWallReason: null,

      // session defaults
      activeTab: 'arganta',
      lessonId: null,
      lessonStep: 0,
      showConcept: false,
      openGameId: null,
      playGameHtml: null,
      playGameTitle: '',
      toasts: [],
      pendingBadge: null,
      showConfetti: false,

      // studio session
      studioDevice: 'desktop',
      studioDemo: 'tetris',
      studioInput: '',
      studioBuilding: false,
      studioBuildStep: 'Ready',
      studioMessages: INITIAL_STUDIO_MESSAGES,

      hydrateFromCloud(p) {
        set({
          learnerName: p.display_name || get().learnerName,
          xp: p.xp,
          level: p.level,
          diamonds: p.diamonds,
          completedLessons: p.completed_lessons ?? [],
          badges: p.badges ?? [],
          gamesPlayed: p.games_played ?? [],
        })
      },

      setLearnerName(name) { set({ learnerName: name }) },

      setSession(s) { set({ session: s }) },

      isAuthed() {
        const s = get().session
        return DEV_AUTH_BYPASS || (s !== null && s !== 'loading')
      },

      requireAuth(reason) {
        if (get().isAuthed()) return true
        get().openAuthWall(reason)
        return false
      },

      openAuthWall(reason) { set({ authWallReason: reason ?? 'to keep going' }) },
      closeAuthWall() { set({ authWallReason: null }) },

      go(p) {
        const next: Partial<AppStore> = {}
        if (p.tab !== undefined) {
          next.activeTab = p.tab
          next.lastTab = p.tab
          next.lessonId = null
          next.lessonStep = 0
        }
        if (p.lessonId !== undefined) {
          next.lessonId = p.lessonId
          next.lessonStep = 0
        }
        if (p.step !== undefined) {
          next.lessonStep = Math.max(0, p.step)
        }
        set(next)
      },

      addXp(n) {
        let xp = get().xp + n
        let level = get().level
        while (xp >= XP_PER_LEVEL(level)) level++
        set({ xp, level })
        get().addToast(`+${n} XP`, '✨')
      },

      completeLesson(id) {
        const done = get().completedLessons
        if (done.includes(id)) return
        const newDone = [...done, id]
        set({ completedLessons: newDone, diamonds: get().diamonds + 5 })
        get().addToast('+5 💎', '💎')

        // check badges
        const BADGES: Record<string, { name: string; need: string[] }> = {
          web: { name: 'Web Explorer', need: ['web/internet-map','web/app-machine','web/build-map','web/system-chain'] },
          ai: { name: 'Prompt Master', need: ['ai/prompt-power','ai/chatgpt-brain','ai/codex-builder','ai/agent-command'] },
          data: { name: 'Data Detective', need: ['data/game-stats','data/chart-magic','data/boss-dashboard','data/prediction-bot'] },
        }
        const have = get().badges
        for (const b of Object.values(BADGES)) {
          if (!have.includes(b.name) && b.need.every(n => newDone.includes(n))) {
            set({ badges: [...get().badges, b.name], pendingBadge: b.name, showConfetti: true })
          }
        }
      },

      toggleTheme() {
        const next = get().theme === 'dark' ? 'light' : 'dark'
        set({ theme: next })
        document.documentElement.dataset.theme = next
      },

      openGame(id) {
        if (!get().requireAuth('to play games')) return
        const played = get().gamesPlayed
        if (!played.includes(id)) set({ gamesPlayed: [...played, id] })
        set({ openGameId: id })
      },

      closeGame() { set({ openGameId: null }) },

      playWizardGame(html, title) { set({ playGameHtml: html, playGameTitle: title }) },
      closeWizardGame() { set({ playGameHtml: null, playGameTitle: '' }) },

      setShowConcept(v) { set({ showConcept: v }) },

      addToast(msg, emoji) {
        const id = Math.random().toString(36).slice(2)
        set(s => ({ toasts: [...s.toasts, { id, msg, emoji }] }))
        setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 2400)
      },

      clearBadge() { set({ pendingBadge: null }) },
      clearConfetti() { set({ showConfetti: false }) },

      savePitchScript(s) { set({ pitchScript: s }) },

      toggleMission(lessonId, i) {
        const m = { ...get().missions }
        const arr = m[lessonId] ? [...m[lessonId]] : []
        const idx = arr.indexOf(i)
        if (idx >= 0) arr.splice(idx, 1)
        else arr.push(i)
        m[lessonId] = arr
        set({ missions: m })
      },

      setStudioDevice(d) { set({ studioDevice: d }) },

      setStudioDemo(d) {
        const names = { tetris: 'Neon Blocks (Tetris)', invaders: 'Star Defender (Space Invaders)' }
        set({
          studioDemo: d,
          studioInput: d === 'tetris'
            ? 'Create a falling block puzzle with keyboard controls, score, and levels.'
            : 'Create an arcade shooter with aliens, lasers, lives, and a boss wave.',
          studioMessages: [
            ...get().studioMessages,
            { role: 'ai' as const, html: `Loaded the <b>${names[d]}</b> starter. Press Build to generate it.` },
          ].slice(-10),
        })
      },

      runStudioBuild(text) {
        if (!get().requireAuth('to build games')) return
        if (get().studioBuilding) return
        const lower = text.toLowerCase()
        const isInvaders = /space|alien|invader|shooter|laser|ship|arcade/.test(lower)
        const isTetris = /tetris|block|falling|puzzle|tetromino|brick/.test(lower)
        const type: 'tetris' | 'invaders' | null = isInvaders ? 'invaders' : isTetris ? 'tetris' : null

        const messages: StudioMessage[] = [
          ...get().studioMessages,
          { role: 'you' as const, text },
        ]

        if (!type) {
          set({
            studioMessages: [
              ...messages,
              { role: 'warn' as const, html: 'I can only build <b>Tetris</b> or <b>Space Invaders</b> in this demo. Try: "make Tetris" or "make Space Invaders".' },
            ].slice(-10),
          })
          return
        }

        set({ studioBuilding: true, studioBuildStep: 'Reading game request', studioMessages: messages.slice(-10) })

        const steps = ['Sketching the layout', 'Writing the canvas loop', 'Adding controls and score', 'Finalizing preview']
        steps.forEach((step, i) => {
          setTimeout(() => set({ studioBuildStep: step }), (i + 1) * 650)
        })

        const names = { tetris: 'Neon Blocks', invaders: 'Star Defender' }
        setTimeout(() => {
          set({
            studioDemo: type,
            studioBuilding: false,
            studioBuildStep: 'Ready',
            studioMessages: [
              ...get().studioMessages,
              { role: 'ai' as const, html: `Built <b>${names[type]}</b>. It is running in the preview with keyboard controls, mobile buttons, score, and restart.` },
            ].slice(-10),
          })
          get().addToast(`${type === 'tetris' ? 'Tetris' : 'Space Invaders'} is playable`, '🎮')
        }, steps.length * 650 + 760)
      },
    }),
    {
      name: 'argantalab_state_v3',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        learnerName: s.learnerName,
        avatar: s.avatar,
        xp: s.xp,
        level: s.level,
        diamonds: s.diamonds,
        badges: s.badges,
        completedLessons: s.completedLessons,
        gamesPlayed: s.gamesPlayed,
        theme: s.theme,
        pitchScript: s.pitchScript,
        pitchCompleted: s.pitchCompleted,
        missions: s.missions,
        lastTab: s.lastTab,
      }),
    }
  )
)
