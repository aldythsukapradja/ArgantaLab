import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { useAppStore } from './store/appStore'
import { initNative } from './lib/native'
import { initEmbedGuest } from './lib/embedGuest'
import { startUsageTracker } from '@arganta/usage'
import { supabase, cloudEnabled } from './lib/supabase'

// Hydrate theme before first render
const { theme } = useAppStore.getState()
document.documentElement.dataset.theme = theme

// Native shell setup (Android/iOS via Capacitor) — a no-op on the web
void initNative()

// Landing-embed bridge — no-op unless framed with ?embed=<nonce>
initEmbedGuest()

// Time-on-page beats → app_usage_beats (Circle HQ Portfolio reads hq_engagement)
startUsageTracker({
  supabase: cloudEnabled ? supabase : null,
  app: 'arganta',
  getPage: () => {
    const s = useAppStore.getState()
    return s.activeTab || s.lastTab || 'home'
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
