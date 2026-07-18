import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { useUiStore } from './store/uiStore'
import { gsap } from 'gsap'
import { initEmbedGuest } from './lib/embedGuest'
import { startUsageTracker } from '@arganta/usage'
import { supabase, cloudReady } from './lib/supabase'
import './styles/globals.css'
import './styles/pages.css'
import './styles/apps.css'

// Hydrate theme before first paint so there is no flash.
document.documentElement.dataset.theme = useUiStore.getState().theme

// Landing-embed bridge — no-op unless framed with ?embed=<nonce>. When Arganta
// Chat drives the circle from its own selector, apply it to our active circle so
// both stay in lock-step (only the circles this user actually belongs to are
// accepted downstream by RLS; an unknown id simply shows nothing).
initEmbedGuest({ onCircle: (circleId) => useUiStore.getState().setCircle(circleId) })

// Time-on-page beats → app_usage_beats (Circle HQ Portfolio reads hq_engagement)
startUsageTracker({ supabase: cloudReady ? supabase : null, app: 'kinetik', getPage: () => useUiStore.getState().tab })

// Dev-only handle so previews can pause the looping "live" animations.
if (import.meta.env.DEV) (window as unknown as { __gsap: typeof gsap }).__gsap = gsap

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
