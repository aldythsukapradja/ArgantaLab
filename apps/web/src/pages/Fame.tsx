import { useState } from 'react'
import { useAppStore } from '@store/appStore'
import { loadMyGames } from '@lib/myGames'

// Sample board so the screen feels alive until real cross-user leaderboards
// land (those need an aggregate public view / RPC).
const SAMPLE = [
  { name: 'RocketKid77', xp: 9200, games: 24, emoji: '🚀' },
  { name: 'Nour_Builds', xp: 7600, games: 18, emoji: '🦄' },
  { name: 'DinoMaster', xp: 6100, games: 31, emoji: '🦕' },
  { name: 'PixelPanda', xp: 4800, games: 12, emoji: '🐼' },
  { name: 'StarCoder', xp: 3300, games: 9, emoji: '⭐' },
]

export default function Fame() {
  const { learnerName, xp, level, go } = useAppStore()
  const [scope, setScope] = useState<'circle' | 'world'>('world')
  const games = loadMyGames().length

  // Splice the player into the sample board by XP.
  const me = { name: learnerName, xp, games, emoji: '😎', me: true }
  const board = [...SAMPLE.map(s => ({ ...s, me: false })), me].sort((a, b) => b.xp - a.xp)
  const myRank = board.findIndex(b => (b as { me?: boolean }).me) + 1

  return (
    <div className="screen fame">
      <div className="disc-head">
        <div className="kicker"><span className="live" />&nbsp;Hall of Fame</div>
        <h1 className="h-title">Top <span className="g">creators</span></h1>
        <p className="lead">Earn XP by learning, building, and getting plays. Climb the ranks!</p>
      </div>

      <div className="fame-tabs">
        <button className={`fame-tab${scope === 'circle' ? ' on' : ''}`} onClick={() => setScope('circle')}>🏘 My Circle</button>
        <button className={`fame-tab${scope === 'world' ? ' on' : ''}`} onClick={() => setScope('world')}>🌍 World</button>
      </div>

      <div className="fame-you">
        <span>Your rank</span>
        <b>#{myRank}</b>
        <span>· Level {level} · {xp} XP</span>
      </div>

      <div className="fame-board">
        {board.map((row, i) => (
          <div key={i} className={`fame-row${(row as { me?: boolean }).me ? ' me' : ''}`}>
            <div className="fame-pos">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</div>
            <div className="fame-av">{row.emoji}</div>
            <div className="fame-name">{row.name}{(row as { me?: boolean }).me && <em> (you)</em>}</div>
            <div className="fame-xp">⭐ {row.xp.toLocaleString()}</div>
            <div className="fame-games">🎮 {row.games}</div>
          </div>
        ))}
      </div>

      {scope === 'circle'
        ? <p className="fame-note">🏘 Circle leaderboards connect to your family Circle app — coming soon.</p>
        : <p className="fame-note">🌍 Live world rankings are being built. For now, beat the sample creators!</p>}

      <button className="btn btn-primary fame-cta" onClick={() => go({ tab: 'web' })}>📚 Earn more XP →</button>
    </div>
  )
}
