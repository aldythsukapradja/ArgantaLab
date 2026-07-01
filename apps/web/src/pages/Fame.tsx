import { useEffect, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { loadMyGames } from '@lib/myGames'
import { getLeaderboard } from '@lib/gamesCloud'
import { WORLDS } from '@/data/learn'
import { worldRing } from '@lib/learnProgress'
import { allBadges } from '@lib/badges'
import { tierOf } from '@lib/rank'
import TierIcon from '@components/rank/TierIcon'
import Buddy from '@components/avatar/Buddy'

// Sample board so the world view feels alive until enough real creators sign in.
const SAMPLE = [
  { name: 'RocketKid77', xp: 9200, games: 24, emoji: '🚀' },
  { name: 'Nour_Builds', xp: 7600, games: 18, emoji: '🦄' },
  { name: 'DinoMaster', xp: 6100, games: 31, emoji: '🦕' },
  { name: 'PixelPanda', xp: 4800, games: 12, emoji: '🐼' },
  { name: 'StarCoder', xp: 3300, games: 9, emoji: '⭐' },
]

type Scope = 'world' | 'myworlds' | 'badges'

export default function Fame() {
  const { learnerName, xp, level, resolvedOutfit, go, session } = useAppStore()
  const outfit = resolvedOutfit()
  const [scope, setScope] = useState<Scope>('world')
  const games = loadMyGames().length
  const myId = session && session !== 'loading' ? session.user.id : null
  const [live, setLive] = useState<{ name: string; xp: number; games: number; emoji: string; me: boolean }[] | null>(null)

  useEffect(() => {
    getLeaderboard(20).then(rows => {
      if (!rows || rows.length === 0) { setLive(null); return }
      setLive(rows.map(r => ({ name: r.name, xp: r.xp, games: r.games, emoji: '🎮', me: !!myId && r.id === myId })))
    })
  }, [myId])

  const sampleBoard = (() => {
    const me = { name: learnerName, xp, games, emoji: '😎', me: true }
    return [...SAMPLE.map(s => ({ ...s, me: false })), me].sort((a, b) => b.xp - a.xp)
  })()
  const board = live ?? sampleBoard
  const myRank = board.findIndex(b => b.me) + 1 || board.length

  // Personal world standings (your own rings ranked) — honest, real, local.
  const myWorlds = WORLDS.map(w => ({ w, pct: worldRing(w) })).sort((a, b) => b.pct - a.pct)

  const badges = allBadges()
  const badgesEarned = badges.filter(b => b.earned).length

  return (
    <div className="screen fame" style={{ justifyContent: 'flex-start', gap: 14, paddingTop: 6 }}>
      <div className="fame-hero">
        <Buddy mood="happy" size={70} outfit={outfit} bob={false} />
        <div>
          <div className="kicker"><span className="live" />&nbsp;Hall of Fame</div>
          <h1 className="h-title" style={{ fontSize: 'clamp(26px,4vw,44px)', marginTop: 6 }}>Top <span className="g">creators</span></h1>
        </div>
      </div>

      <div className="fame-tabs">
        <button className={`fame-tab${scope === 'world' ? ' on' : ''}`} onClick={() => setScope('world')}>🌍 World</button>
        <button className={`fame-tab${scope === 'myworlds' ? ' on' : ''}`} onClick={() => setScope('myworlds')}>⭐ My Worlds</button>
        <button className={`fame-tab${scope === 'badges' ? ' on' : ''}`} onClick={() => setScope('badges')}>🎖 Badges</button>
      </div>

      {scope === 'badges' ? (
        <>
          <div className="fame-you"><span>Badges earned</span><b>{badgesEarned}</b><span>of {badges.length}</span></div>
          <div className="badge-grid">
            {badges.map(b => (
              <div key={b.key} className={`badge-cell${b.earned ? ' on' : ''}`} title={b.group}>
                <span className="badge-ic">{b.earned ? b.icon : '🔒'}</span>
                <small className="badge-nm">{b.name}</small>
              </div>
            ))}
          </div>
          <p className="fame-note">🏅 Earn badges by playing every part of ArgantaLab — learn, explore, befriend, build, and keep your streak.</p>
        </>
      ) : scope === 'myworlds' ? (
        <>
          <div className="fame-you"><span>Your skill rings, ranked</span></div>
          <div className="fame-board">
            {myWorlds.map((row, i) => (
              <div key={row.w.key} className="fame-row" onClick={() => go({ tab: row.w.key.toLowerCase() })} style={{ cursor: 'pointer' }}>
                <div className="fame-pos">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</div>
                <div className="fame-av" style={{ color: row.w.color }}>{row.w.icon}</div>
                <div className="fame-name">{row.w.name}</div>
                <div className="fame-xp" style={{ color: row.w.color }}>{row.pct}%</div>
              </div>
            ))}
          </div>
          <p className="fame-note">⭐ Grow each ring to 50% to unlock its costume!</p>
        </>
      ) : (
        <>
          <div className="fame-you">
            <span>Your rank</span><b>#{myRank}</b><span>· Level {level} · {xp.toLocaleString()} XP</span>
          </div>
          <div className="fame-board">
            {board.map((row, i) => (
              <div key={i} className={`fame-row${(row as { me?: boolean }).me ? ' me' : ''}`}>
                <div className="fame-pos">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</div>
                <div className="fame-av" title={tierOf(row.xp).tier.name}><TierIcon color={tierOf(row.xp).tier.color} glyph={tierOf(row.xp).tier.glyph} size={30} /></div>
                <div className="fame-name">{row.name}{(row as { me?: boolean }).me && <em> (you)</em>}</div>
                <div className="fame-xp">⭐ {row.xp.toLocaleString()}</div>
                <div className="fame-games">🎮 {row.games}</div>
              </div>
            ))}
          </div>
          <p className="fame-note">{live ? '🌍 Live world rankings — real ArgantaLab creators!' : '🌍 Live rankings activate once creators sign in. Beat the sample for now!'}</p>
        </>
      )}

      <button className="btn btn-primary fame-cta" style={{ alignSelf: 'flex-start' }} onClick={() => go({ tab: 'learn' })}>📚 Earn more XP →</button>
    </div>
  )
}
