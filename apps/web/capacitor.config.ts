import type { CapacitorConfig } from '@capacitor/cli'

// ArgantaLab native shell (Capacitor) — wraps the built web app (dist) in a
// native WebView for Android + iOS. The web app talks to Supabase over the
// network exactly as on the web, so no API changes are needed. Build the web
// (`npm run build`) then `npx cap sync` before opening the native projects.
const config: CapacitorConfig = {
  appId: 'com.argantalab.app',
  appName: 'ArgantaLab',
  webDir: 'dist',
  backgroundColor: '#0b1020',
  plugins: {
    SplashScreen: {
      launchShowDuration: 1100,
      backgroundColor: '#6d28d9',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    Keyboard: {
      // resize the webview so inputs aren't hidden behind the on-screen keyboard
      resize: 'native',
    },
  },
}

export default config
