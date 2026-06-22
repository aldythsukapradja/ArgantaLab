import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './theme.css'

// Apply the persisted theme before first paint.
const stored = localStorage.getItem('hq_theme')
if (stored) document.documentElement.setAttribute('data-theme', stored)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
