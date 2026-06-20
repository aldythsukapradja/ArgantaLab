import { useEffect, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { CHARACTERS, WORLDS } from '@/data/wizard'
import { loadMyGames, saveMyGame, deleteMyGame, type SavedGame } from '@lib/myGames'
import { setGameVisibility, pushGame, deleteGameCloud } from '@lib/gamesCloud'
import { makeSlug } from '@lib/slug'

const Play = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
const Trash = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>

const worldBg: Record<string, string> = {
  space: 'linear-gradient(135deg,#0a0e27,#1a1147)', ocean: 'linear-gradient(135deg,#012a4a,#01497c)',
  volcano: 'linear-gradient(135deg,#2b0a0a,#6a1212)', ice: 'linear-gradient(135deg,#0a2a3a,#16526b)',
  jungle: 'linear-gradient(135deg,#0c2a12,#1a4d24)', city: 'linear-gradient(135deg,#0a0a1a,#241047)',
}

export default function MyGameStore() {
  const { go, playWizardGame, addToast, learnerName, session } = useAppStore()
  const [mine, setMine] = useState<SavedGame[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)
  useEffect(() => { setMine(loadMyGames()) }, [])
  const uid = session && session !== 'loading' ? session.user.id : null
  const origin = window.location.origin

  const publish = (g: SavedGame) => {
    const slug = g.slug || makeSlug(g.title, g.id)
    const updated = { ...g, published: !g.published, slug }
    setMine(saveMyGame(updated))
    if (uid) { pushGame(uid, updated); setGameVisibility(uid, g.id, updated.published ? 'public' : 'private', learnerName, slug) }
    addToast(updated.published ? `“${g.title}” is now public!` : `“${g.title}” is private`, updated.published ? '🌍' : '🔒')
  }
  const linkFor = (g: SavedGame) => `${origin}/play/${g.slug || g.id}`
  const copy = async (g: SavedGame) => {
    try { await navigator.clipboard.writeText(linkFor(g)) } catch { /* ignore */ }
    setCopiedId(g.id); addToast('Link copied — share it!', '📎'); setTimeout(() => setCopiedId(null), 2000)
  }
  const remove = (id: string) => { setMine(deleteMyGame(id)); if (uid) deleteGameCloud(uid, id) }

  return (
    <div className="screen store">
      <div className="disc-head">
        <div className="kicker"><span className="live" />&nbsp;My GameStore</div>
        <h1 className="h-title">Your <span className="g">games</span></h1>
        <p className="lead">Publish a game to get a share link your friends can play — no login needed.</p>
      </div>

      {mine.length === 0 ? (
        <div className="empty-games">
          <b>No games yet</b>
          <span>Build your first game in the Game Wizard or Builder Lab.</span>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => go({ tab: 'studio' })}>Build a game</button>
        </div>
      ) : (
        <div className="store-list">
          {mine.map(g => {
            const emoji = g.source === 'procode' ? '🔬' : (CHARACTERS.find(c => c.key === g.config?.character)?.emoji ?? '🎮')
            const world = g.source === 'procode' ? 'Pro-Code' : (WORLDS.find(w => w.key === g.config?.world)?.label ?? '')
            return (
              <div key={g.id} className={`store-card${g.published ? ' pub' : ''}`}>
                <div className="store-thumb" style={{ background: worldBg[g.config?.world ?? ''] || 'var(--grad)' }}>{emoji}</div>
                <div className="store-body">
                  <div className="store-titlerow">
                    <h3>{g.title}</h3>
                    <span className={`store-badge ${g.published ? 'on' : ''}`}>{g.published ? '🌍 Public' : '🔒 Private'}</span>
                  </div>
                  <div className="store-sub">{world} · {g.plays} plays</div>
                  {g.published && (
                    <div className="store-link">
                      <code>{origin.replace(/^https?:\/\//, '')}/play/{g.slug || g.id}</code>
                      <button className="store-copy" onClick={() => copy(g)}>{copiedId === g.id ? '✓' : 'Copy'}</button>
                    </div>
                  )}
                  <div className="store-actions">
                    <button className="btn btn-soft" onClick={() => playWizardGame(g.html, g.title)}><Play /> Play</button>
                    <button className={`btn ${g.published ? 'btn-soft' : 'btn-primary'}`} onClick={() => publish(g)}>
                      {g.published ? 'Make private' : '🌍 Publish'}
                    </button>
                    <button className="mine-del" title="Delete" onClick={() => remove(g.id)}><Trash /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
