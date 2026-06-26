import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Session } from '@supabase/supabase-js'
import { DEFAULT_OUTFIT, COSMETIC_BY_ID, resolveOutfit, type Slot, type ResolvedOutfit } from '@/data/cosmetics'
import { stageForDob } from '@/data/learn'

// Cosmetics that every kid owns from day one (the free starter loadout + free skins/bgs).
const FREE_COSMETICS = ['skin:default', 'skin:blue', 'skin:mint', 'bg:studio', 'bg:sky']

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
  unlocks: string[]
  badges: string[]
  completedLessons: string[]
  gamesPlayed: string[]
  role: string
  costume: string | null   // equipped costume = a world key (e.g. 'NUM'), or null
  outfit: Record<Slot, string>   // equipped cosmetic id per slot ('' = empty)
  ownedCosmetics: string[]       // purchased + free cosmetic ids
  theme: 'light' | 'dark'
  pitchScript: string
  pitchCompleted: boolean
  missions: Record<string, number[]>
  lastTab: string
  activeCircleId: string | null   // the circle currently in focus (switcher pill)
  stageKey: string             // active player's learning stage (drives content difficulty)

  // — player switcher (not persisted) —
  showSwitcher: boolean
  locked: boolean   // true = switcher can't be dismissed; you must sign in

  // — auth (not persisted) —
  session: Session | null | 'loading'
  authWallReason: string | null   // non-null = login overlay is open

  // — session UI state (not persisted) —
  activeTab: string
  enterLand: string | null   // "Join" a friend exploring → open this world's ArgantaLand on arrival
  lessonId: string | null
  lessonStep: number
  showConcept: boolean
  openGameId: string | null
  playGameHtml: string | null
  playGameTitle: string
  playGameId: string | null
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
  hydrateFromCloud: (p: { display_name: string; xp: number; level: number; diamonds: number; completed_lessons: string[]; badges: string[]; games_played: string[]; unlocks: string[]; role?: string; dob?: string | null; stage_override?: string | null }) => void
  resetIdentity: () => void
  setStage: (key: string) => void
  isAdmin: () => boolean
  setCostume: (worldKey: string | null) => void
  // — player session (kid vs grown-up) —
  isKidMode: () => boolean
  setActiveCircle: (id: string | null) => void
  openSwitcher: () => void
  closeSwitcher: () => void
  lockSession: () => void
  // — avatar cosmetics (Roblox-style) —
  equipCosmetic: (slot: Slot, id: string) => void
  unequipSlot: (slot: Slot) => void
  ownsCosmetic: (id: string) => boolean
  buyCosmetic: (id: string) => boolean
  resolvedOutfit: () => ResolvedOutfit
  setLearnerName: (name: string) => void
  ownsItem: (key: string) => boolean
  buyItem: (key: string, price: number, name: string) => boolean
  addDiamonds: (n: number) => void
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
  playWizardGame: (html: string, title: string, id?: string) => void
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

// The identity/wallet/progress fields that belong to ONE player. On every
// session change we reset these to a clean slate before hydrating the incoming
// player from the cloud — so no previous player's name, gems, or progress can
// ever leak across a switch. Device-level prefs (theme, tab) are NOT reset.
const BLANK_IDENTITY = {
  learnerName: 'Player', avatar: 'P', xp: 0, level: 1, diamonds: 0,
  unlocks: [] as string[], badges: [] as string[], completedLessons: [] as string[], gamesPlayed: [] as string[],
  role: 'user', costume: null as string | null,
  outfit: { ...DEFAULT_OUTFIT }, ownedCosmetics: [...FREE_COSMETICS],
  stageKey: 'explorer',
}

const INITIAL_STUDIO_MESSAGES: StudioMessage[] = [
  { role: 'ai', html: 'Tell me what to build. This Studio can generate two working games: <b>Tetris</b> or <b>Space Invaders</b>.' },
  { role: 'ai', html: 'Pick a template or type a prompt, then press Build.' },
]

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // defaults (replaced by cloud data on sign-in)
      learnerName: 'Player',
      avatar: 'P',
      xp: 0,
      level: 1,
      diamonds: 0,
      unlocks: [],
      badges: [],
      completedLessons: [],
      gamesPlayed: [],
      role: 'user',
      costume: null,
      outfit: { ...DEFAULT_OUTFIT },
      ownedCosmetics: [...FREE_COSMETICS],
      theme: 'light',
      pitchScript: '',
      pitchCompleted: false,
      missions: {},
      lastTab: 'arganta',
      activeCircleId: null,
      stageKey: 'explorer',
      showSwitcher: false,
      locked: false,

      // auth defaults
      session: 'loading',
      authWallReason: null,

      // session defaults
      activeTab: 'arganta',
      enterLand: null,
      lessonId: null,
      lessonStep: 0,
      showConcept: false,
      openGameId: null,
      playGameHtml: null,
      playGameTitle: '',
      playGameId: null,
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
          avatar: (p.display_name?.[0] ?? get().avatar).toUpperCase(),
          xp: p.xp,
          level: p.level,
          diamonds: p.diamonds,
          completedLessons: p.completed_lessons ?? [],
          badges: p.badges ?? [],
          gamesPlayed: p.games_played ?? [],
          unlocks: p.unlocks ?? [],
          role: p.role ?? get().role,
          // Kids are LOCKED to their level: a guardian's stage_override if set,
          // else auto-by-age (DOB). Grown-ups have no kid DOB, so they start at
          // the oldest band and can switch freely via setStage().
          stageKey: (p.role ?? get().role) === 'kid' ? (p.stage_override || stageForDob(p.dob ?? undefined).key) : 'legend',
        })
      },

      // Grown-ups pick any age band to preview; kids can't change theirs.
      setStage(key) { if (get().role !== 'kid') set({ stageKey: key }) },

      // Wipe the active player's identity/wallet/progress back to a blank slate.
      // Called on logout and at the start of every session switch so the next
      // player hydrates clean — the core guard against cross-player leakage.
      resetIdentity() { set({ ...BLANK_IDENTITY, outfit: { ...DEFAULT_OUTFIT }, ownedCosmetics: [...FREE_COSMETICS] }) },

      isAdmin() {
        if (typeof localStorage !== 'undefined' && localStorage.getItem('alab_admin') === '1') return true
        if (import.meta.env.DEV) return true
        return get().role === 'admin'
      },

      setCostume(worldKey) { set({ costume: worldKey }) },

      // Identity is the Supabase session: a kid account has role 'kid'.
      isKidMode() { return get().role === 'kid' },
      setActiveCircle(id) { set({ activeCircleId: id }) },
      openSwitcher() { set({ showSwitcher: true }) },
      closeSwitcher() { if (!get().locked) set({ showSwitcher: false }) },
      // Lock the session — show the switcher and forbid dismissing it until
      // someone signs in (kid PIN or parent passcode). Used by "Log out".
      lockSession() { set({ showSwitcher: true, locked: true }) },

      equipCosmetic(slot, id) {
        // toggle off if re-equipping the same item (except skin/bg which always have one)
        const cur = get().outfit[slot]
        const next = (cur === id && slot !== 'skin' && slot !== 'bg') ? '' : id
        set({ outfit: { ...get().outfit, [slot]: next } })
      },

      unequipSlot(slot) {
        if (slot === 'skin') { set({ outfit: { ...get().outfit, skin: 'skin:default' } }); return }
        if (slot === 'bg') { set({ outfit: { ...get().outfit, bg: 'bg:studio' } }); return }
        set({ outfit: { ...get().outfit, [slot]: '' } })
      },

      ownsCosmetic(id) {
        const item = COSMETIC_BY_ID[id]
        if (item && item.price === 0) return true
        return get().ownedCosmetics.includes(id)
      },

      buyCosmetic(id) {
        const item = COSMETIC_BY_ID[id]
        if (!item) return false
        if (get().ownsCosmetic(id)) return true
        if (get().diamonds < item.price) {
          get().addToast(`Need ${item.price - get().diamonds} more 💎 for ${item.name}`, '💎')
          return false
        }
        // optimistic, then reconcile the spend against the server wallet (truth)
        set({ diamonds: get().diamonds - item.price, ownedCosmetics: [...get().ownedCosmetics, id] })
        if (item.price > 0) import('@lib/wallet').then(w => w.walletSpend(item.price, `cosmetic:${id}`).then(r => { if (!r) w.refreshBalance() }))
        get().addToast(`Unlocked ${item.name}!`, '✨')
        return true
      },

      resolvedOutfit() { return resolveOutfit(get().outfit) },

      setLearnerName(name) { set({ learnerName: name }) },

      ownsItem(key) { return get().unlocks.includes(key) },

      buyItem(key, price, name) {
        if (get().unlocks.includes(key)) return true
        if (get().diamonds < price) {
          get().addToast(`Need ${price - get().diamonds} more 💎 for ${name}`, '💎')
          return false
        }
        set({ diamonds: get().diamonds - price, unlocks: [...get().unlocks, key] })
        if (price > 0) import('@lib/wallet').then(w => w.walletSpend(price, `item:${key}`).then(r => { if (!r) w.refreshBalance() }))
        get().addToast(`Unlocked ${name}!`, '✨')
        return true
      },

      addDiamonds(n) {
        if (!n) return
        set({ diamonds: Math.max(0, get().diamonds + n) })
      },

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
        // optimistic +5, then mint it on the server wallet (ledger truth, capped)
        set({ completedLessons: newDone, diamonds: get().diamonds + 5 })
        import('@lib/wallet').then(w => w.walletEarn(5, 'lesson', `lesson:${id}`))
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

      playWizardGame(html, title, id) { set({ playGameHtml: html, playGameTitle: title, playGameId: id ?? null }) },
      closeWizardGame() { set({ playGameHtml: null, playGameTitle: '', playGameId: null }) },

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
      name: 'argantalab_state_v4',
      storage: createJSONStorage(() => localStorage),
      // CLOUD IS THE SINGLE SOURCE OF TRUTH. We persist ONLY device-level UI
      // prefs — never account, gems, or progress (those hydrate from the cloud
      // on login). This is why phones & web can never diverge.
      partialize: (s) => ({
        theme: s.theme,
        lastTab: s.lastTab,
      }),
    }
  )
)
