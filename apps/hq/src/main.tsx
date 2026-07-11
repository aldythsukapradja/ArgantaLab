import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initEmbedGuest } from './lib/embedGuest'
import { startUsageTracker } from '@arganta/usage'
import { supabase, cloudEnabled } from './lib/supabase'
import { useHQ } from './shell/store'
import './theme.css'

// Light is the default; honor a persisted choice if present.
const stored = localStorage.getItem('hq_theme')
document.documentElement.setAttribute('data-theme', stored === 'dark' ? 'dark' : 'light')

// Landing-embed bridge — no-op unless framed with ?embed=<nonce>
initEmbedGuest()

// Time-on-page beats → app_usage_beats (HQ tracks itself like every app)
startUsageTracker({ supabase: cloudEnabled ? supabase : null, app: 'hq', getPage: () => useHQ.getState().surface })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
