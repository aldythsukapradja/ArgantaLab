import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { useAppStore } from './store/appStore'

// Hydrate theme before first render
const { theme } = useAppStore.getState()
document.documentElement.dataset.theme = theme

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
