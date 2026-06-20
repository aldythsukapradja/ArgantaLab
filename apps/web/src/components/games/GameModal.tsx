import { useEffect } from 'react'
import { useAppStore } from '@store/appStore'
import { GAMES } from '@/data'

const MinusIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
const SquareIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
const XIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>

export default function GameModal() {
  const { openGameId, closeGame } = useAppStore()
  const game = GAMES.find(g => g.id === openGameId)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeGame() }
    if (openGameId) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [openGameId, closeGame])

  if (!openGameId || !game) return null

  const src = `${import.meta.env.BASE_URL}games/${game.file}`

  return (
    <div className="game-back" onClick={closeGame}>
      <div className="game-win" onClick={e => e.stopPropagation()}>
        <div className="game-tb">
          <div className="lights">
            <button className="light r" onClick={closeGame}><XIcon /></button>
            <button className="light y"><MinusIcon /></button>
            <button className="light g"><SquareIcon /></button>
          </div>
          <div className="game-title">{game.name}</div>
          <button className="game-exit" onClick={closeGame}><XIcon /> Close</button>
        </div>
        <iframe
          src={src}
          title={game.name}
          allow="fullscreen"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      </div>
    </div>
  )
}
