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
import { Architecture } from '../surfaces/Architecture'
import { BattleBuilder } from '../surfaces/battle/BattleBuilder'
import { CharacterForge } from '../surfaces/character/CharacterForge'
import { OpenworldBuilder } from '../surfaces/world/OpenworldBuilder'
import { MusicBuilder } from '../surfaces/music/MusicBuilder'
import { VideoBuilder } from '../surfaces/video/VideoBuilder'

function Surface() {
  const { surface } = useHQ()
  switch (surface) {
    case 'home': return <Landing />
    case 'architecture': return <Architecture />
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
    case 'battle': return <BattleBuilder />
    case 'character': return <CharacterForge />
    case 'world': return <OpenworldBuilder />
    case 'music': return <MusicBuilder />
    case 'video': return <VideoBuilder />
  }
}

export function Shell({ who = 'Operator', authed = false }: { who?: string; authed?: boolean }) {
  const { surface } = useHQ()
  const wide = surface === 'game' || surface === 'app'
  const full = surface === 'vault' || surface === 'architecture' || surface === 'character' || surface === 'battle' || surface === 'world' || surface === 'music' || surface === 'video' || surface === 'broadcast' || surface === 'portfolio' // edge-to-edge workspaces

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
