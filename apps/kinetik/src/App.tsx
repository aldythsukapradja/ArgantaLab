import { useAppStore } from '@store/appStore'
import TopBar from '@components/layout/TopBar'
import Nav from '@components/layout/Nav'
import CloudSync from '@components/CloudSync'
import Today from '@pages/Today'
import Calendar from '@pages/Calendar'
import Moments from '@pages/Moments'
import Apps from '@pages/Apps'
import Me from '@pages/Me'

export default function App() {
  const tab = useAppStore(s => s.tab)
  return (
    <div id="app">
      <TopBar />
      <main className="main" key={tab}>
        {tab === 'today' && <Today />}
        {tab === 'calendar' && <Calendar />}
        {tab === 'moments' && <Moments />}
        {tab === 'apps' && <Apps />}
        {tab === 'me' && <Me />}
      </main>
      <Nav />
      <CloudSync />
    </div>
  )
}
