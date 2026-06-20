import { useAppStore } from '@store/appStore'
import { GAMES, gameThumb } from '@/data'

const PlayIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
const StarIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>

export default function Home() {
  const { openGame, gamesPlayed, go, completedLessons, xp, level } = useAppStore()

  return (
    <div className="screen arg">
      <div className="arg-hero">
        <div className="kicker">
          <span className="live" />&nbsp; ArgantaLab · Kids Super-App
        </div>
        <h1 className="h-title">
          Play.<br /><span className="g">Learn. Build.</span>
        </h1>
        <p className="lead">Play games your parent built for you. Learn how the internet, AI, and apps work. Then build your own.</p>
        <div className="cta">
          <button className="btn btn-primary" onClick={() => go({ tab: 'web' })}>
            <PlayIcon /> Start Learning
          </button>
          <button className="btn btn-ghost" onClick={() => go({ tab: 'studio' })}>
            <StarIcon /> Open Studio
          </button>
        </div>
      </div>

      <div className="chips">
        <div className="statchip"><b>{gamesPlayed.length}</b><span>games played</span></div>
        <div className="statchip"><b>{completedLessons.length}</b><span>lessons done</span></div>
        <div className="statchip"><b>{xp}</b><span>XP earned</span></div>
        <div className="statchip"><b>Lv {level}</b><span>current level</span></div>
      </div>

      <div className="section-label">Game Collection</div>

      <div className="glist">
        {GAMES.length > 0 ? GAMES.map(g => (
          <button key={g.id} className="grow" onClick={() => openGame(g.id)}>
            <div className="gic" dangerouslySetInnerHTML={{ __html: gameThumb(g.hue) }} />
            <div className="gmeta">
              <h3>{g.name} {gamesPlayed.includes(g.id) && <em>Played</em>}</h3>
              <span>{g.desc}</span>
            </div>
            <div className="get"><PlayIcon /> Play</div>
          </button>
        )) : (
          <div className="empty-games">
            <b>Games coming soon</b>
            <span>Game files will appear here once deployed to GitHub Pages. Ask Baba to deploy!</span>
          </div>
        )}
      </div>
    </div>
  )
}
