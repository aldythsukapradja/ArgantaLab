import { lazy, Suspense } from 'react'
import { Rail } from './Rail'
import { Topbar } from './Topbar'
import { MobileNav, MobileSubnav } from './MobileNav'
import { useHQ } from './store'
import { cloudEnabled } from '../lib/supabase'
import { CommandPalette } from './CommandPalette'
import { Landing } from '../surfaces/Landing'
import { GlobalCopilot } from '../copilot/GlobalCopilot'

const Data = lazy(() => import('../surfaces/Data').then(module => ({ default: module.Data })))
const Growth = lazy(() => import('../surfaces/Growth').then(module => ({ default: module.Growth })))
const Portfolio = lazy(() => import('../surfaces/Portfolio').then(module => ({ default: module.Portfolio })))
const Content = lazy(() => import('../surfaces/Content').then(module => ({ default: module.Content })))
const Agents = lazy(() => import('../surfaces/Agents').then(module => ({ default: module.Agents })))
const Broadcast = lazy(() => import('../surfaces/Broadcast').then(module => ({ default: module.Broadcast })))
const GameBuilder = lazy(() => import('../surfaces/builders/BuilderShell').then(module => ({ default: module.GameBuilder })))
const AppBuilder = lazy(() => import('../surfaces/builders/BuilderShell').then(module => ({ default: module.AppBuilder })))
const Command = lazy(() => import('../surfaces/command/Command').then(module => ({ default: module.Command })))
const Pixel = lazy(() => import('../surfaces/pixel/Pixel').then(module => ({ default: module.Pixel })))
const Vault = lazy(() => import('../surfaces/Vault').then(module => ({ default: module.Vault })))
const Architecture = lazy(() => import('../surfaces/Architecture').then(module => ({ default: module.Architecture })))
const BattleBuilder = lazy(() => import('../surfaces/battle/BattleBuilder').then(module => ({ default: module.BattleBuilder })))
const CharacterForge = lazy(() => import('../surfaces/character/CharacterForge').then(module => ({ default: module.CharacterForge })))
const OpenworldBuilder = lazy(() => import('../surfaces/world/OpenworldBuilder').then(module => ({ default: module.OpenworldBuilder })))
const MusicBuilder = lazy(() => import('../surfaces/music/MusicBuilder').then(module => ({ default: module.MusicBuilder })))
const VideoBuilder = lazy(() => import('../surfaces/video/VideoBuilder').then(module => ({ default: module.VideoBuilder })))
const MediaCenter = lazy(() => import('../surfaces/media/MediaCenter').then(module => ({ default: module.MediaCenter })))
const CinemaDev = lazy(() => import('../cinema/CinemaDev').then(module => ({ default: module.CinemaDev })))
const ReactorBuilder = lazy(() => import('../reactor/builder/ReactorBuilder').then(module => ({ default: module.ReactorBuilder })))
const ModelRack = lazy(() => import('../surfaces/rack/ModelRack').then(module => ({ default: module.ModelRack })))
const CopilotControl = lazy(() => import('../copilot/CopilotControl').then(module => ({ default: module.CopilotControl })))
const ArgantaCore = lazy(() => import('../surfaces/core/ArgantaCore').then(module => ({ default: module.ArgantaCore })))

function SurfaceLoading() {
  return <div className="auth-wrap" role="status" aria-label="Loading workspace"><div className="spin" /></div>
}

function Surface() {
  const { surface, go, coreReturn } = useHQ()
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
    case 'media': return <MediaCenter />
    case 'knowledge': return <Vault forceView="knowledge" />
    case 'reactor': return <ReactorBuilder />
    case 'rack': return <ModelRack />
    case 'cinema': return <CinemaDev />
    case 'copilot': return <CopilotControl />
    case 'core': return <ArgantaCore onClose={() => go(coreReturn)} />
  }
}

export function Shell({ who = 'Operator', authed = false }: { who?: string; authed?: boolean }) {
  const { surface } = useHQ()
  const wide = surface === 'game' || surface === 'app'
  const full = surface === 'vault' || surface === 'architecture' || surface === 'character' || surface === 'battle' || surface === 'world' || surface === 'music' || surface === 'video' || surface === 'media' || surface === 'broadcast' || surface === 'portfolio' || surface === 'cinema' || surface === 'knowledge' || surface === 'reactor' || surface === 'rack' || surface === 'core' // edge-to-edge workspaces

  // The CEO Orb landing is an immersive cockpit — no rail, no topbar. The floating
  // agent chat + command palette (⌘K) stay available; the landing's own Menu button
  // opens the palette to jump into the light HQ system. GlobalCopilot is mounted
  // ONCE below the branch so voice/gesture + HUD survive every navigation.
  return (
    <>
      {surface === 'home' ? (
        <div className="hq-cockpit">
          <Landing who={who} />
          <CommandPalette />
        </div>
      ) : (
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
              <Suspense fallback={<SurfaceLoading />}>
                {full ? <Surface /> : <div className={'content-in' + (wide ? ' wide' : '')}><Surface /></div>}
              </Suspense>
            </div>
          </div>
          <MobileNav />
          <CommandPalette />
        </div>
      )}
      <GlobalCopilot />
    </>
  )
}
