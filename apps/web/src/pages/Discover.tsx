import { useEffect, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { GAMES, gameThumb } from '@/data'
import { CHARACTERS, WORLDS } from '@/data/wizard'
import { loadMyGames, type SavedGame } from '@lib/myGames'
import { fetchPublicGames } from '@lib/gamesCloud'

const Play = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>

interface Community { id: string; title: string; html: string; creator: string; plays: number; emoji: string; bg: string }

const worldBg: Record<string, string> = {
  space: 'linear-gradient(135deg,#0a0e27,#1a1147)', ocean: 'linear-gradient(135deg,#012a4a,#01497c)',
  volcano: 'linear-gradient(135deg,#2b0a0a,#6a1212)', ice: 'linear-gradient(135deg,#0a2a3a,#16526b)',
  jungle: 'linear-gradient(135deg,#0c2a12,#1a4d24)', city: 'linear-gradient(135deg,#0a0a1a,#241047)',
}

export default function Discover() {
  const { openGame, playWizardGame, go } = useAppStore()
  const [community, setCommunity] = useState<Community[]>([])

  useEffect(() => {
    // Local published games (always available) + cloud public games (if set up).
    const local: Community[] = loadMyGames().filter(g => g.published).map(toCommunity)
    setCommunity(local)
    fetchPublicGames().then(cloud => {
      if (!cloud) return
      const merged = new Map<string, Community>()
      for (const g of local) merged.set(g.id, g)
      for (const g of cloud) merged.set(g.id, { id: g.id, title: g.title, html: g.html, creator: g.creator, plays: g.plays, emoji: '🎮', bg: 'var(--grad)' })
      setCommunity([...merged.values()].sort((a, b) => b.plays - a.plays))
    })
  }, [])

  return (
    <div className="screen disc">
      <div className="disc-head">
        <div className="kicker"><span className="live" />&nbsp;Discover</div>
        <h1 className="h-title">Play what kids <span className="g">built</span></h1>
        <p className="lead">Games made by the ArgantaLab community. Find one you love, then build your own.</p>
      </div>

      <div className="section-label">Featured</div>
      <div className="glist">
        {GAMES.map(g => (
          <button key={g.id} className="grow" onClick={() => openGame(g.id)}>
            <div className="gic" dangerouslySetInnerHTML={{ __html: gameThumb(g.hue) }} />
            <div className="gmeta"><h3>{g.name}</h3><span>{g.desc}</span></div>
            <div className="get"><Play /> Play</div>
          </button>
        ))}
      </div>

      <div className="section-label">From the community</div>
      {community.length ? (
        <div className="glist">
          {community.map(g => (
            <button key={g.id} className="grow" onClick={() => playWizardGame(g.html, g.title)}>
              <div className="gic mine" style={{ background: g.bg }}><span className="mine-char">{g.emoji}</span></div>
              <div className="gmeta"><h3>{g.title}</h3><span>by {g.creator} · {g.plays} plays</span></div>
              <div className="get"><Play /> Play</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-games">
          <b>No community games yet</b>
          <span>Publish one from My GameStore and it shows up here!</span>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => go({ tab: 'studio' })}>Build a game</button>
        </div>
      )}
    </div>
  )
}

function toCommunity(g: SavedGame): Community {
  const emoji = g.source === 'procode' ? '🔬' : (CHARACTERS.find(c => c.key === g.config?.character)?.emoji ?? '🎮')
  const bg = worldBg[g.config?.world ?? ''] || 'var(--grad)'
  return { id: g.id, title: g.title, html: g.html, creator: 'you', plays: g.plays, emoji, bg }
}
