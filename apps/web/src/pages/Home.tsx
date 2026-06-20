import { useEffect, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { GAMES, gameThumb } from '@/data'
import { loadMyGames, saveMyGame, deleteMyGame, type SavedGame } from '@lib/myGames'
import { WORLDS, CHARACTERS } from '@/data/wizard'

const PlayIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
const StarIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
const PlusIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
const TrashIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>

const worldBg: Record<string, string> = {
  space: 'linear-gradient(135deg,#0a0e27,#1a1147)', ocean: 'linear-gradient(135deg,#012a4a,#01497c)',
  volcano: 'linear-gradient(135deg,#2b0a0a,#6a1212)', ice: 'linear-gradient(135deg,#0a2a3a,#16526b)',
  jungle: 'linear-gradient(135deg,#0c2a12,#1a4d24)', city: 'linear-gradient(135deg,#0a0a1a,#241047)',
}

export default function Home() {
  const { openGame, gamesPlayed, go, completedLessons, xp, level, playWizardGame } = useAppStore()
  const [mine, setMine] = useState<SavedGame[]>([])
  useEffect(() => { setMine(loadMyGames()) }, [])

  const play = (g: SavedGame) => {
    const updated = { ...g, plays: g.plays + 1 }
    setMine(saveMyGame(updated))
    playWizardGame(g.html, g.title)
  }
  const remove = (id: string) => setMine(deleteMyGame(id))

  return (
    <div className="screen arg">
      <div className="arg-hero">
        <div className="kicker"><span className="live" />&nbsp; ArgantaLab · Kids Super-App</div>
        <h1 className="h-title">Play.<br /><span className="g">Learn. Build.</span></h1>
        <p className="lead">Play games your parent built for you. Learn how the internet, AI, and apps work. Then build your own.</p>
        <div className="cta">
          <button className="btn btn-primary" onClick={() => go({ tab: 'web' })}><PlayIcon /> Start Learning</button>
          <button className="btn btn-ghost" onClick={() => go({ tab: 'studio' })}><StarIcon /> Build a Game</button>
        </div>
      </div>

      <div className="chips">
        <div className="statchip"><b>{mine.length}</b><span>games built</span></div>
        <div className="statchip"><b>{completedLessons.length}</b><span>lessons done</span></div>
        <div className="statchip"><b>{xp}</b><span>XP earned</span></div>
        <div className="statchip"><b>Lv {level}</b><span>current level</span></div>
      </div>

      <div className="section-label">My Creations</div>
      <div className="glist">
        {mine.map(g => {
          const char = CHARACTERS.find(c => c.key === g.config.character)?.emoji ?? '🎮'
          const world = WORLDS.find(w => w.key === g.config.world)?.label ?? ''
          return (
            <div key={g.id} className="grow">
              <div className="gic mine" style={{ background: worldBg[g.config.world] || 'var(--grad)' }}>
                <span className="mine-char">{char}</span>
              </div>
              <div className="gmeta">
                <h3>{g.title}</h3>
                <span>{world} · {g.plays} plays</span>
              </div>
              <div className="mine-actions">
                <button className="get" onClick={() => play(g)}><PlayIcon /> Play</button>
                <button className="mine-del" title="Delete" onClick={() => remove(g.id)}><TrashIcon /></button>
              </div>
            </div>
          )
        })}
        <button className="grow grow-add" onClick={() => go({ tab: 'studio' })}>
          <div className="gic add"><PlusIcon /></div>
          <div className="gmeta"><h3>Build a new game</h3><span>Open the Game Wizard</span></div>
        </button>
      </div>

      <div className="section-label">Game Collection</div>
      <div className="glist">
        {GAMES.map(g => (
          <button key={g.id} className="grow" onClick={() => openGame(g.id)}>
            <div className="gic" dangerouslySetInnerHTML={{ __html: gameThumb(g.hue) }} />
            <div className="gmeta">
              <h3>{g.name} {gamesPlayed.includes(g.id) && <em>Played</em>}</h3>
              <span>{g.desc}</span>
            </div>
            <div className="get"><PlayIcon /> Play</div>
          </button>
        ))}
      </div>
    </div>
  )
}
