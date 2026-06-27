// ============================================================
//  CAPACITOR NATIVE BRIDGE (Android + iOS)
//  No-op on the web (Capacitor plugins are web-shimmed), so this is safe to call
//  unconditionally from main.tsx. On a device it: hides the splash once React is
//  up, makes the status bar overlay/themed, and wires the Android hardware back
//  button to in-app navigation (go Home, else minimise) instead of killing the app.
// ============================================================

import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { useAppStore } from '@store/appStore'

export async function initNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  // Status bar follows the app theme (dark text on light UI, light text on dark).
  const applyStatusBar = async () => {
    try {
      const dark = document.documentElement.dataset.theme === 'dark'
      await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
    } catch { /* status bar not available on this platform */ }
  }
  await applyStatusBar()

  // Re-theme the status bar whenever the app theme flips.
  try {
    const obs = new MutationObserver(() => { void applyStatusBar() })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  } catch { /* ignore */ }

  try { await SplashScreen.hide() } catch { /* ignore */ }

  // Android hardware back: go to the Play home; if already there, minimise the app
  // (never hard-exit on a single back press).
  CapApp.addListener('backButton', () => {
    const st = useAppStore.getState()
    if (st.activeTab && st.activeTab !== 'arganta') st.go({ tab: 'arganta' })
    else CapApp.minimizeApp()
  }).catch(() => { /* ignore */ })
}
