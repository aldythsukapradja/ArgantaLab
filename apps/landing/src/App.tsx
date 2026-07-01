import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { ThemeProvider } from './theme'
import AppShell from './AppShell'
import type { Tab } from './appscreens'

const GeneralDeck = lazy(() => import('./decks/GeneralDeck'))
const EditorialDeck = lazy(() => import('./decks/EditorialDeck'))

type Route =
  | { view: 'app'; tab: Tab }
  | { view: 'editorial'; present: boolean }
  | { view: 'general'; flight?: string }

const TABS: Tab[] = ['home', 'products', 'about', 'pitch']

function parse(): Route {
  const h = window.location.hash.replace(/^#\/?/, '')
  const [a, b] = h.split('/')
  if (a === 'editorial') return { view: 'editorial', present: b === 'present' }
  if (a === 'general') return { view: 'general', flight: b || undefined }
  if ((TABS as string[]).includes(a)) return { view: 'app', tab: a as Tab }
  return { view: 'app', tab: 'home' }
}
function toHash(r: Route): string {
  if (r.view === 'editorial') return `#/editorial${r.present ? '/present' : ''}`
  if (r.view === 'general') return `#/general${r.flight ? '/' + r.flight : ''}`
  return r.tab === 'home' ? '#/' : `#/${r.tab}`
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parse())

  useEffect(() => {
    const onPop = () => setRoute(parse())
    window.addEventListener('hashchange', onPop)
    return () => window.removeEventListener('hashchange', onPop)
  }, [])

  const nav = useCallback((r: Route) => {
    const hash = toHash(r)
    if (window.location.hash !== hash) window.history.pushState(null, '', hash)
    setRoute(r)
  }, [])

  const onTab = useCallback((tab: Tab) => nav({ view: 'app', tab }), [nav])
  const onLaunch = useCallback((deck: string, opt?: { present?: boolean; flight?: string }) => {
    if (deck === 'general') nav({ view: 'general', flight: opt?.flight })
    else nav({ view: 'editorial', present: opt?.present ?? false })
  }, [nav])
  const exit = useCallback(() => nav({ view: 'app', tab: 'home' }), [nav])
  const exitToProducts = useCallback(() => nav({ view: 'app', tab: 'products' }), [nav])

  return (
    <ThemeProvider>
      <Suspense fallback={<div className="app-loading"><span className="app-loading-orb" /></div>}>
        {route.view === 'app' && <AppShell tab={route.tab} onTab={onTab} onLaunch={onLaunch} />}
        {route.view === 'general' && <GeneralDeck flight={route.flight} onExit={exitToProducts} />}
        {route.view === 'editorial' && <EditorialDeck present={route.present} onExit={exit} />}
      </Suspense>
    </ThemeProvider>
  )
}
