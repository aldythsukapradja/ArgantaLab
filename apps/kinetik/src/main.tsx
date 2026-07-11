import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { useUiStore } from './store/uiStore'
import { gsap } from 'gsap'
import { initEmbedGuest } from './lib/embedGuest'
import './styles/globals.css'
import './styles/pages.css'
import './styles/apps.css'

// Hydrate theme before first paint so there is no flash.
document.documentElement.dataset.theme = useUiStore.getState().theme

// Landing-embed bridge — no-op unless framed with ?embed=<nonce>
initEmbedGuest()

// Dev-only handle so previews can pause the looping "live" animations.
if (import.meta.env.DEV) (window as unknown as { __gsap: typeof gsap }).__gsap = gsap

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
