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
import { Command } from '../surfaces/command/Command'
import { Pixel } from '../surfaces/pixel/Pixel'
import { Vault } from '../surfaces/Vault'
import { Landing } from '../surfaces/Landing'

function Surface() {
  const { surface } = useHQ()
  switch (surface) {
    case 'home': return <Landing />
    case 'data': return <Data />
    case 'growth': return <Growth />
    case 'portfolio': return <Portfolio />
    case 'content': return <Content />
    case 'game': return <GameBuilder />
    case 'app': return <AppBuilder />
    case 'agents': return <Agents />
    case 'broadcast': return <Broadcast />
    case 'command': return <Command />
    case 'pixel': return <Pixel />
    case 'vault': return <Vault />
  }
}

export function Shell({ who = 'Operator', authed = false }: { who?: string; authed?: boolean }) {
  const { surface } = useHQ()
  const wide = surface === 'game' || surface === 'app'
  const full = surface === 'vault' // Vault runs edge-to-edge as its own workspace

  // The CEO Orb landing is an immersive cockpit — no rail, no topbar. The floating
  // agent chat + command palette (⌘K) stay available; the landing's own Menu button
  // opens the palette to jump into the light HQ system.
  if (surface === 'home') {
    return (
      <div className="hq-cockpit">
        <Landing who={who} />
        <AgentOrb />
        <CommandPalette />
      </div>
    )
  }

  return (
    <div className="hq">
      <Rail who={who} />
      <div className="main">
        <Topbar canSignOut={authed} />
        {!cloudEnabled && !full && (
          <div className="banner">
            Offline preview — add <span className="src" style={{ background: 'transparent', padding: 0 }}>VITE_SUPABASE_URL</span> + anon key to <span className="src" style={{ background: 'transparent', padding: 0 }}>apps/hq/.env.local</span> and sign in to load live data.
          </div>
        )}
        <MobileSubnav />
        <div className={'content' + (full ? ' content-flush' : '')}>
          {full ? <Surface /> : <div className={'content-in' + (wide ? ' wide' : '')}><Surface /></div>}
        </div>
      </div>
      <AgentOrb />
      <MobileNav />
      <CommandPalette />
    </div>
  )
}
