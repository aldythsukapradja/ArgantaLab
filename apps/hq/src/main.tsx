import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initEmbedGuest } from './lib/embedGuest'
import './theme.css'

// Light is the default; honor a persisted choice if present.
const stored = localStorage.getItem('hq_theme')
document.documentElement.setAttribute('data-theme', stored === 'dark' ? 'dark' : 'light')

// Landing-embed bridge — no-op unless framed with ?embed=<nonce>
initEmbedGuest()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
