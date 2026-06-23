import { useEffect } from 'react'
import { useUiStore } from '@store/uiStore'
import { useDataStore } from '@store/dataStore'
import TopBar from '@components/layout/TopBar'
import Nav from '@components/layout/Nav'
import DataBanner from '@components/DataBanner'
import Today from '@pages/Today'
import Calendar from '@pages/Calendar'
import Moments from '@pages/Moments'
import Apps from '@pages/Apps'
import Me from '@pages/Me'

export default function App() {
  const tab = useUiStore(s => s.tab)
  const load = useDataStore(s => s.load)
  const status = useDataStore(s => s.status)
  const circles = useDataStore(s => s.circles)

  // Pull real data once on mount (cloud-first, cache fallback).
  useEffect(() => { load() }, [load])

  const booting = status === 'loading' && circles.length === 0

  return (
    <div id="app">
      <TopBar />
      <DataBanner />
      <main className="main" key={tab}>
        {booting ? (
          <div className="boot"><span className="boot-orb" /><p>Loading your circle…</p></div>
        ) : (
          <>
            {tab === 'today' && <Today />}
            {tab === 'calendar' && <Calendar />}
            {tab === 'moments' && <Moments />}
            {tab === 'apps' && <Apps />}
            {tab === 'me' && <Me />}
          </>
        )}
      </main>
      <Nav />
    </div>
  )
}
