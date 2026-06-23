import { useEffect, useState } from 'react'
import DeviceFrame from '@components/build/DeviceFrame'
import { fetchPublicGame, bumpPlay } from '@lib/gamesCloud'
import { getMyGame } from '@lib/myGames'
import { useCircleBridge } from '@lib/circleBridge'

interface PublicGame { title: string; html: string; creator: string; plays: number }

// Standalone public page for a shared game — no app chrome, no login required.
export default function PlayPage({ id }: { id: string }) {
  const [game, setGame] = useState<PublicGame | null | 'loading'>('loading')
  const [copied, setCopied] = useState(false)
  const origin = window.location.origin
  useCircleBridge(id)   // answer the game's SDK calls (live when the player is signed in)

  useEffect(() => {
    let cancelled = false
    fetchPublicGame(id).then(g => {
      if (cancelled) return
      if (g) { setGame({ title: g.title, html: g.html, creator: g.creator, plays: g.plays }); bumpPlay(id) }
      else {
        const local = getMyGame(id) // same-browser fallback (before cloud is set up)
        setGame(local ? { title: local.title, html: local.html, creator: 'you', plays: local.plays } : null)
      }
    })
    return () => { cancelled = true }
  }, [id])

  const copy = async () => {
    try { await navigator.clipboard.writeText(`${origin}/play/${id}`) } catch { /* ignore */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  if (game === 'loading') return <div className="pp-load"><div className="pulse" /></div>
  if (!game) return (
    <div className="pp-missing">
      <div className="pp-missing-emoji">🕹️</div>
      <h1>Game not found</h1>
      <p>This game might be private or the link is wrong.</p>
      <a className="btn btn-primary" href={origin}>Make your own game →</a>
    </div>
  )

  return (
    <div className="pp">
      {/* branded attribution / mini ad campaign */}
      <header className="pp-top">
        <a className="pp-pill" href={origin} title="Built at ArgantaLab">
          Made with <span className="pp-heart">💚</span> by <b>{game.creator}</b>
          <span className="pp-x">×</span>
          <span className="pp-brand">ArgantaLab</span>
        </a>
      </header>

      <div className="pp-stage"><DeviceFrame html={game.html} gameId={id} /></div>

      <div className="pp-meta">
        <h1 className="pp-title">{game.title}</h1>
        <div className="pp-stats">▶ {game.plays} plays</div>
        <div className="pp-actions">
          <button className="btn btn-ghost" onClick={copy}>{copied ? '✓ Copied!' : '📋 Copy link'}</button>
          <a className="btn btn-primary" href={origin}>🎮 Make your own game →</a>
        </div>
        <p className="pp-foot">🏘 Built at ArgantaLab — where kids build real games.</p>
      </div>
    </div>
  )
}
