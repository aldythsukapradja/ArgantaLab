import { create } from 'zustand'
import type { CopilotActions } from './intents'
import type { ProductId } from '../surfaces/Portfolio'
import { DEFAULT_GESTURE_SETTINGS, type GestureSettings, type GestureStatus } from './useGesture'
import type { VoiceStatus } from './useVoice'

// ─────────────────────────────────────────────────────────────────────────
// Copilot store — the app-global bridge so the copilot lives ONCE (in
// <GlobalCopilot>, mounted in Shell) yet can be driven from anywhere (the
// Landing dock mic, the future control tab) and survives navigation between
// surfaces.
//
//   GlobalCopilot  → owns useVoice/useGesture, SYNCS reactive state here and
//                    REGISTERS its toggle handles here.
//   any surface    → reads state (armed, amplitude, gestureActive) via
//                    selectors, calls toggleVoice()/toggleGesture().
//   active surface → may inject CONTEXTUAL actions (Landing's product popup /
//                    cinema / swipe behaviour) via setContext(); GlobalCopilot
//                    composes them over the global base. Off that surface, the
//                    base actions route through the pending-* bridge (navigate
//                    home, then apply) so "open lashira" works from anywhere.
//
// This is the P1 seam contract P2–P4 build against — do not change its shape
// without updating docs/voice-gesture-copilot.md.
// ─────────────────────────────────────────────────────────────────────────

export type SwipeFn = (dir: 'left' | 'right') => void

export interface CopilotContext {
  /** Surface-local overrides for the contextual actions. */
  actions: Partial<CopilotActions>
  /** Surface-local swipe behaviour (Landing: cycle products / inspector view). */
  onSwipe?: SwipeFn
}

const EMPTY_CONTEXT: CopilotContext = { actions: {} }
const GESTURE_SETTINGS_KEY = 'cp-gesture-settings'

function loadGestureSettings(): GestureSettings {
  if (typeof localStorage === 'undefined') return DEFAULT_GESTURE_SETTINGS
  try {
    const raw = localStorage.getItem(GESTURE_SETTINGS_KEY)
    return raw ? { ...DEFAULT_GESTURE_SETTINGS, ...JSON.parse(raw) } : DEFAULT_GESTURE_SETTINGS
  } catch {
    return DEFAULT_GESTURE_SETTINGS
  }
}

export interface CopilotStore {
  // reactive state, mirrored from the hooks by GlobalCopilot
  armed: boolean
  voiceStatus: VoiceStatus
  amplitude: number
  gestureActive: boolean
  gestureLoading: boolean
  gestureStatus: GestureStatus
  muted: boolean
  suppressed: boolean            // hide the dock during immersive takeovers (cinema/boot)
  gestureSettings: GestureSettings   // persisted to localStorage; the control tab (P4) edits this

  // imperative handles, registered by GlobalCopilot
  toggleVoice: () => void
  toggleGesture: () => void
  toggleMute: () => void
  openHelp: () => void
  /** Re-fetch the command registry — call after the control tab edits a row. */
  reloadRegistry: () => void

  // contextual bridge + pending hand-offs
  context: CopilotContext
  pendingProduct: ProductId | null
  pendingCinema: boolean

  setGestureSettings: (patch: Partial<GestureSettings>) => void

  // setters
  sync: (partial: Partial<CopilotStore>) => void
  registerHandles: (h: Pick<CopilotStore, 'toggleVoice' | 'toggleGesture' | 'toggleMute' | 'openHelp' | 'reloadRegistry'>) => void
  setContext: (ctx: CopilotContext) => void
  clearContext: () => void
  setSuppressed: (v: boolean) => void
  requestProduct: (id: ProductId) => void
  requestCinema: () => void
  consumePending: () => { product: ProductId | null; cinema: boolean }
}

const noop = () => {}

export const useCopilotStore = create<CopilotStore>((set, get) => ({
  armed: false,
  voiceStatus: 'idle',
  amplitude: 0,
  gestureActive: false,
  gestureLoading: false,
  gestureStatus: 'idle',
  muted: false,
  suppressed: false,
  gestureSettings: loadGestureSettings(),

  toggleVoice: noop,
  toggleGesture: noop,
  toggleMute: noop,
  openHelp: noop,
  reloadRegistry: noop,

  context: EMPTY_CONTEXT,
  pendingProduct: null,
  pendingCinema: false,

  setGestureSettings: (patch) => set(state => {
    const gestureSettings = { ...state.gestureSettings, ...patch }
    try { localStorage.setItem(GESTURE_SETTINGS_KEY, JSON.stringify(gestureSettings)) } catch { /* storage unavailable — in-memory only */ }
    return { gestureSettings }
  }),

  sync: (partial) => set(partial),
  registerHandles: (h) => set(h),
  setContext: (context) => set({ context }),
  clearContext: () => set({ context: EMPTY_CONTEXT }),
  setSuppressed: (suppressed) => set({ suppressed }),
  requestProduct: (id) => set({ pendingProduct: id }),
  requestCinema: () => set({ pendingCinema: true }),
  consumePending: () => {
    const { pendingProduct, pendingCinema } = get()
    if (pendingProduct || pendingCinema) set({ pendingProduct: null, pendingCinema: false })
    return { product: pendingProduct, cinema: pendingCinema }
  },
}))
