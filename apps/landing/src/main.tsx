import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import './styles/app.css'
import App from './App'
import { startUsageTracker } from '@arganta/usage'
import { supabase, cloudEnabled } from './lib/supabase'

// Time-on-page beats → app_usage_beats (Circle HQ Portfolio reads hq_engagement)
startUsageTracker({
  supabase: cloudEnabled ? supabase : null,
  app: 'landing',
  getPage: () => (window.location.hash || '#hub').replace(/^#\/?/, '') || 'hub',
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
