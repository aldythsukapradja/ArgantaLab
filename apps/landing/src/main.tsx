import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { startUsageTracker } from '@arganta/usage'
import { supabase, cloudEnabled } from './lib/supabase'
import { ThemeProvider } from './theme'

// Time-on-page beats → app_usage_beats (Circle HQ Portfolio reads hq_engagement)
startUsageTracker({
  supabase: cloudEnabled ? supabase : null,
  app: 'landing',
  getPage: () => `${window.location.pathname}${window.location.hash}`,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
)
