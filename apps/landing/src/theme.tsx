import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

interface ThemeApi { dark: boolean; toggle: () => void; set: (d: boolean) => void }
const ThemeCtx = createContext<ThemeApi>({ dark: false, toggle: () => {}, set: () => {} })

// Light is the default. Only an explicit user toggle (persisted) switches to dark.
function initial(): boolean {
  try {
    const saved = localStorage.getItem('arganta-theme-2')
    if (saved) return saved === 'dark'
  } catch { /* ignore */ }
  return false
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(initial)
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    try { localStorage.setItem('arganta-theme-2', dark ? 'dark' : 'light') } catch { /* ignore */ }
  }, [dark])
  const api = useMemo<ThemeApi>(() => ({ dark, toggle: () => setDark(d => !d), set: setDark }), [dark])
  return <ThemeCtx.Provider value={api}>{children}</ThemeCtx.Provider>
}

export function useTheme() { return useContext(ThemeCtx) }

// Shared theme-toggle button used across the hub and both decks.
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { dark, toggle } = useTheme()
  const onClick = useCallback(() => toggle(), [toggle])
  return (
    <button className={`theme-toggle ${className}`} onClick={onClick} aria-label="Toggle light or dark">
      {dark
        ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" /></svg>
        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" /></svg>}
    </button>
  )
}
