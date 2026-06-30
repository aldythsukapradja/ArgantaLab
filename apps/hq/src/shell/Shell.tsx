import { Rail } from './Rail'
import { Topbar } from './Topbar'
import { MobileNav, MobileSubnav } from './MobileNav'
import { useHQ } from './store'
import { cloudEnabled } from '../lib/supabase'
import { Data } from '../surfaces/Data'
import { Growth } from '../surfaces/Growth'
import { Portfolio } from '../surfaces/Portfolio'
import { Content } from '../surfaces/Content'
import { Agents } from '../surfaces/Agents'
import { Broadcast } from '../surfaces/Broadcast'
import { GameBuilder, AppBuilder } from '../surfaces/builders/BuilderShell'
import { AgentOrb } from '../components/AgentOrb'
import { CommandPalette } from './CommandPalette'

function Surface() {
  const { surface } = useHQ()
  switch (surface) {
    case 'data': return <Data />
    case 'growth': return <Growth />
    case 'portfolio': return <Portfolio />
    case 'content': return <Content />
    case 'game': return <GameBuilder />
    case 'app': return <AppBuilder />
    case 'agents': return <Agents />
    case 'broadcast': return <Broadcast />
  }
}

export function Shell({ who = 'Operator', authed = false }: { who?: string; authed?: boolean }) {
  const { surface } = useHQ()
  const wide = surface === 'game' || surface === 'app'
  return (
    <div className="hq">
      <Rail who={who} />
      <div className="main">
        <Topbar canSignOut={authed} />
        {!cloudEnabled && (
          <div className="banner">
            Offline preview — add <span className="src" style={{ background: 'transparent', padding: 0 }}>VITE_SUPABASE_URL</span> + anon key to <span className="src" style={{ background: 'transparent', padding: 0 }}>apps/hq/.env.local</span> and sign in to load live data.
          </div>
        )}
        <MobileSubnav />
        <div className="content">
          <div className={'content-in' + (wide ? ' wide' : '')}><Surface /></div>
        </div>
      </div>
      <AgentOrb />
      <MobileNav />
      <CommandPalette />
    </div>
  )
}
