import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useHQ } from '../shell/store'
import type { ProductId } from '../surfaces/Portfolio'
import { useVoice } from './useVoice'
import { useGesture } from './useGesture'
import { useCommandRegistry } from './registry'
import { useCopilotStore } from './store'
import type { CopilotActions } from './intents'
import { CopilotHUD } from './CopilotHUD'
import { CommandFlash } from './CommandFlash'
const CopilotHelp = lazy(() => import('./CopilotHelp').then(m => ({ default: m.CopilotHelp })))

// ─────────────────────────────────────────────────────────────────────────
// GlobalCopilot — the one place the copilot actually lives. Mounted ONCE in
// Shell (outside the surface switch) so the mic, camera, HUD and replies
// survive every navigation. All surfaces drive it through useCopilotStore;
// the active surface may inject contextual actions. The persistent control
// itself (mic/gesture/help buttons) is rendered by <Rail>, embedded in the
// sidebar above the operator's name — not floated here — since Rail only
// mounts on non-home surfaces anyway, which already gives the right
// "hidden on the immersive orb home" behaviour for free.
// ─────────────────────────────────────────────────────────────────────────

export function GlobalCopilot({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const { go } = useHQ()
  const { openPalette, closePalette, paletteOpen, toggleAgent, agentOpen, closeAgent, toggleTheme } = useHQ()
  const { goOffice, setDataTab, openStudio, openAnalytics } = useHQ()
  const { entries, source, reload } = useCommandRegistry()

  const [helpOpen, setHelpOpen] = useState(false)

  // Contextual bridge from the active surface (Landing injects product/cinema/swipe).
  const context = useCopilotStore(s => s.context)
  const requestProduct = useCopilotStore(s => s.requestProduct)
  const requestCinema = useCopilotStore(s => s.requestCinema)

  // Compose the effective action set: global base, then surface overrides,
  // with a few actions composed explicitly (help/close/product/cinema) so the
  // off-surface path still works via the pending bridge.
  const closeAll = useCallback(() => {
    if (helpOpen) { setHelpOpen(false); return }
    if (context.actions.close) { context.actions.close(); return }
    if (agentOpen) { closeAgent(); return }
    if (paletteOpen) { closePalette(); return }
  }, [helpOpen, context.actions, agentOpen, closeAgent, paletteOpen, closePalette])

  const openProduct = useCallback((id: ProductId) => {
    if (context.actions.openProduct) { context.actions.openProduct(id); return } // Landing is mounted → open directly
    requestProduct(id); go('home')                                               // else: land, then Landing opens it
  }, [context.actions, requestProduct, go])

  const playCinema = useCallback(() => {
    if (context.actions.playCinema) { context.actions.playCinema(); return }
    requestCinema(); go('home')
  }, [context.actions, requestCinema, go])

  const openDataTab = useCallback((tab: Parameters<CopilotActions['openDataTab']>[0]) => {
    go('data'); setDataTab(tab)
  }, [go, setDataTab])

  const openBuilderSub = useCallback((surfaceId: 'game' | 'app', sub: Parameters<CopilotActions['openBuilderSub']>[1]) => {
    go(surfaceId)
    if (sub === 'studio') openStudio()
    else if (sub === 'analytics') openAnalytics()
    // 'catalogue' needs nothing further — go() already resets builderSub to catalogue.
  }, [go, openStudio, openAnalytics])

  // Contextual, only meaningful when a product popup is open (Landing injects
  // the real handler). Off-Landing there's no popup to switch, so it's a no-op.
  const setProductView = useCallback((view: Parameters<CopilotActions['setProductView']>[0]) => {
    context.actions.setProductView?.(view)
  }, [context.actions])

  const actions = useMemo<CopilotActions>(() => ({
    go, openPalette, toggleTheme, toggleAgent,
    close: closeAll,
    openProduct,
    playCinema,
    help: () => setHelpOpen(true),
    goOffice, openDataTab, openBuilderSub, setProductView,
    refresh: context.actions.refresh ?? (() => {}),
    disarm: () => {}, // useVoice injects the real disarm
  }), [go, openPalette, toggleTheme, toggleAgent, closeAll, openProduct, playCinema,
      goOffice, openDataTab, openBuilderSub, setProductView, context.actions])

  const voice = useVoice(actions, entries)

  const onSwipe = useCallback((dir: 'left' | 'right') => {
    context.onSwipe?.(dir) // swipe is only meaningful on a surface that defines it (Landing)
  }, [context])
  const gestureSettings = useCopilotStore(s => s.gestureSettings)
  const gesture = useGesture({ onSwipe, onPinch: closeAll }, { reducedMotion, settings: gestureSettings })

  // ── sync reactive state + register handles into the store ──────────────
  const sync = useCopilotStore(s => s.sync)
  const registerHandles = useCopilotStore(s => s.registerHandles)
  useEffect(() => {
    sync({
      armed: voice.armed, voiceStatus: voice.status, amplitude: voice.amplitude, muted: voice.muted,
      gestureActive: gesture.active, gestureLoading: gesture.loading, gestureStatus: gesture.status,
    })
  }, [voice.armed, voice.status, voice.amplitude, voice.muted, gesture.active, gesture.loading, gesture.status, sync])
  useEffect(() => {
    registerHandles({
      toggleVoice: voice.toggle, toggleGesture: gesture.toggle,
      toggleMute: voice.toggleMute, openHelp: () => setHelpOpen(true),
      reloadRegistry: reload,
    })
  }, [voice.toggle, gesture.toggle, voice.toggleMute, reload, registerHandles])

  // First-ever arm auto-opens the cheat-sheet so commands are discoverable.
  const prevArmed = useRef(false)
  useEffect(() => {
    if (voice.armed && !prevArmed.current && !localStorage.getItem('cp-help-seen')) {
      localStorage.setItem('cp-help-seen', '1')
      setHelpOpen(true)
    }
    prevArmed.current = voice.armed
  }, [voice.armed])

  const active = voice.armed || gesture.active || gesture.loading

  return (
    <>
      {active && (
        <CopilotHUD
          voiceArmed={voice.armed} voiceStatus={voice.status} amplitude={voice.amplitude}
          interim={voice.interim} lastIntent={voice.lastIntent} muted={voice.muted} onToggleMute={voice.toggleMute}
          gestureActive={gesture.active} gestureLoading={gesture.loading}
          handDetected={gesture.handDetected} lastSwipe={gesture.lastSwipe} corner="left" />
      )}

      <CommandFlash intent={voice.lastIntent} firedAt={voice.lastFiredAt} reducedMotion={reducedMotion} />

      {helpOpen && (
        <Suspense fallback={null}>
          <CopilotHelp entries={entries} source={source} onClose={() => setHelpOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
