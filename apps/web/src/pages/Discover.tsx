import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { GAMES, gameThumb } from '@/data'
import { CHARACTERS } from '@/data/wizard'
import { loadMyGames, type SavedGame } from '@lib/myGames'
import { fetchPublicGames } from '@lib/gamesCloud'
import { loadPitches, TEMPLATE_BY_KEY, type PitchDeck } from '@lib/pitch'
import PitchPresent from '@components/pitch/PitchPresent'

const Play = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>

interface Community { id: string; title: string; html: string; creator: string; plays: number; emoji: string; hue: number }

const worldHue: Record<string, number> = { space: 250, ocean: 205, volcano: 8, ice: 195, jungle: 130, city: 270 }

// The Ship tab: an App-Store-style showcase — featured hero, trending row,
// kid-made games, and a cinematic pitch-deck showcase.
export default function Discover() {
  const { openGame, playWizardGame, go } = useAppStore()
  const [community, setCommunity] = useState<Community[]>([])
  const [pitches, setPitches] = useState<PitchDeck[]>(() => loadPitches())
  const [present, setPresent] = useState<PitchDeck | null>(null)
  const [featIdx, setFeatIdx] = useState(0)

  useEffect(() => {
    const local: Community[] = loadMyGames().filter(g => g.published).map(toCommunity)
    setCommunity(local)
    fetchPublicGames().then(cloud => {
      if (!cloud) return
      const merged = new Map<string, Community>()
      for (const g of local) merged.set(g.id, g)
      for (const g of cloud) merged.set(g.id, { id: g.id, title: g.title, html: g.html, creator: g.creator, plays: g.plays, emoji: '🎮', hue: 250 })
      setCommunity([...merged.values()].sort((a, b) => b.plays - a.plays))
    })
  }, [])

  // rotate the featured hero
  useEffect(() => {
    const t = setInterval(() => setFeatIdx(i => (i + 1) % GAMES.length), 4200)
    return () => clearInterval(t)
  }, [])

  const feat = GAMES[featIdx]
  const trending = useMemo(() => [...community].sort((a, b) => b.plays - a.plays).slice(0, 8), [community])

  if (present) return <PitchPresent deck={present} onExit={() => setPresent(null)} />

  return (
    <div className="screen ship" style={{ justifyContent: 'flex-start', gap: 16 }}>
      <div className="ship-head">
        <div className="kicker"><span className="live" />&nbsp;Ship · Game Store</div>
        <h1 className="h-title" style={{ marginTop: 6 }}>Play what kids <span className="g">built</span></h1>
      </div>

      {/* ── Featured hero ── */}
      <button className="ship-hero" onClick={() => openGame(feat.id)}>
        <div className="ship-hero-art" dangerouslySetInnerHTML={{ __html: gameThumb(feat.hue) }} />
        <div className="ship-hero-info">
          <span className="ship-hero-tag">⭐ Featured</span>
          <h2>{feat.name}</h2>
          <p>{feat.desc}</p>
          <span className="ship-hero-cta"><Play /> Play now</span>
        </div>
        <div className="ship-hero-dots">
          {GAMES.map((g, i) => <span key={g.id} className={`ship-hero-dot${i === featIdx ? ' on' : ''}`} />)}
        </div>
      </button>

      {/* ── Top picks (curated) ── */}
      <div className="section-label">Baginda's picks</div>
      <div className="ship-rail">
        {GAMES.map(g => (
          <button key={g.id} className="ship-app" onClick={() => openGame(g.id)}>
            <div className="ship-app-ic" dangerouslySetInnerHTML={{ __html: gameThumb(g.hue) }} />
            <div className="ship-app-meta"><b>{g.name}</b><small>{g.tags.join(' · ')}</small></div>
            <span className="ship-app-get">GET</span>
          </button>
        ))}
      </div>

      {/* ── Pitch showcase ── */}
      <div className="section-label">🎤 Pitch showcase</div>
      {pitches.length ? (
        <div className="ship-pitches">
          {pitches.map(d => {
            const t = TEMPLATE_BY_KEY[d.template]
            return (
              <button key={d.id} className="ship-pitch" onClick={() => setPresent(d)}
                style={{ background: `linear-gradient(140deg, ${t?.c1}, ${t?.c2})` }}>
                <span className="ship-pitch-emoji">{d.emoji}</span>
                <b>{d.title || 'Untitled'}</b>
                <small>by {d.author}</small>
                <span className="ship-pitch-play">▶ Watch pitch</span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="empty-games">
          <b>No pitches yet</b>
          <span>Build a pitch in the Pitch Studio and present it here!</span>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => go({ tab: 'pitch' })}>🎤 Make a pitch</button>
        </div>
      )}

      {/* ── Trending (community) ── */}
      <div className="section-label">🔥 Trending from the community</div>
      {trending.length ? (
        <div className="ship-grid">
          {trending.map(g => (
            <button key={g.id} className="ship-card" onClick={() => playWizardGame(g.html, g.title)}>
              <div className="ship-card-art" dangerouslySetInnerHTML={{ __html: gameThumb(g.hue) }}>
              </div>
              <div className="ship-card-emoji">{g.emoji}</div>
              <div className="ship-card-meta"><b>{g.title}</b><small>by {g.creator} · {g.plays} plays</small></div>
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
  const hue = worldHue[g.config?.world ?? ''] ?? 250
  return { id: g.id, title: g.title, html: g.html, creator: 'you', plays: g.plays, emoji, hue }
}
