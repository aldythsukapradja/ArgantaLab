import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { ThemeProvider } from './theme'
import Hub from './Hub'

const GeneralDeck = lazy(() => import('./decks/GeneralDeck'))
const EditorialDeck = lazy(() => import('./decks/EditorialDeck'))

type Route = { deck: 'hub' | 'general' | 'editorial'; present: boolean }

function parse(): Route {
  const h = window.location.hash.replace(/^#\/?/, '')
  const [deck, mode] = h.split('/')
  if (deck === 'general' || deck === 'editorial') return { deck, present: mode === 'present' }
  return { deck: 'hub', present: false }
}
function toHash(r: Route) {
  if (r.deck === 'hub') return '#/'
  return `#/${r.deck}${r.present ? '/present' : ''}`
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parse())

  useEffect(() => {
    const onPop = () => setRoute(parse())
    window.addEventListener('hashchange', onPop)
    return () => window.removeEventListener('hashchange', onPop)
  }, [])

  // The hub + editorial deck scroll; the camera (general) deck is fixed full-screen.
  useEffect(() => {
    const el = document.documentElement
    if (route.deck === 'general') el.classList.remove('page-scroll')
    else el.classList.add('page-scroll')
  }, [route.deck])

  const nav = useCallback((r: Route) => {
    const hash = toHash(r)
    if (window.location.hash !== hash) window.history.pushState(null, '', hash)
    setRoute(r)
    window.scrollTo(0, 0)
  }, [])

  const open = useCallback((deck: string, present: boolean) => nav({ deck: deck as Route['deck'], present }), [nav])
  const exit = useCallback(() => nav({ deck: 'hub', present: false }), [nav])

  return (
    <ThemeProvider>
      <Suspense fallback={<div className="app-loading"><span className="app-loading-orb" /></div>}>
        {route.deck === 'hub' && <Hub onOpen={open} />}
        {route.deck === 'general' && <GeneralDeck onExit={exit} />}
        {route.deck === 'editorial' && <EditorialDeck present={route.present} onExit={exit} />}
      </Suspense>
    </ThemeProvider>
  )
}
