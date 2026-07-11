import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { useAppStore } from './store/appStore'
import { initNative } from './lib/native'
import { initEmbedGuest } from './lib/embedGuest'

// Hydrate theme before first render
const { theme } = useAppStore.getState()
document.documentElement.dataset.theme = theme

// Native shell setup (Android/iOS via Capacitor) — a no-op on the web
void initNative()

// Landing-embed bridge — no-op unless framed with ?embed=<nonce>
initEmbedGuest()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
