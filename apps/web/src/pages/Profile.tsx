import { useAppStore } from '@store/appStore'
import { WORLDS } from '@/data/learn'
import { worldRing, earnedBadges } from '@lib/learnProgress'
import { loadMyGames } from '@lib/myGames'

function Ring({ pct, color }: { pct: number; color: string }) {
  const r = 22, c = 2 * Math.PI * r
  return (
    <svg width="54" height="54" viewBox="0 0 54 54">
      <circle cx="27" cy="27" r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
      <circle cx="27" cy="27" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${(c * pct / 100).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 27 27)" />
      <text x="27" y="31" textAnchor="middle" fontSize="11" fontWeight="800" fill={color}>{pct}</text>
    </svg>
  )
}

export default function Profile() {
  const { learnerName, xp, level, diamonds, go } = useAppStore()
  const games = loadMyGames().length
  const totalBadges = WORLDS.reduce((a, w) => a + earnedBadges(w).size, 0)

  return (
    <div className="screen" style={{ justifyContent: 'flex-start', gap: 16, paddingTop: 6 }}>
      <div>
        <div className="kicker"><span className="live" />&nbsp;Profile</div>
        <h1 className="h-title" style={{ marginTop: 10 }}>{learnerName}</h1>
        <p className="lead">Level {level} · Explorer</p>
      </div>

      <div className="chips">
        <div className="statchip"><b>{xp.toLocaleString()}</b><span>XP</span></div>
        <div className="statchip"><b>{diamonds}</b><span>Diamonds</span></div>
        <div className="statchip"><b>{totalBadges}</b><span>Badges</span></div>
        <div className="statchip"><b>{games}</b><span>Games built</span></div>
      </div>

      <div className="section-label">Skill rings</div>
      <div className="pf-rings">
        {WORLDS.map(w => (
          <button key={w.key} className="pf-ring" onClick={() => go({ tab: w.key.toLowerCase() })}>
            <Ring pct={worldRing(w)} color={w.color} />
            <small>{w.name}</small>
          </button>
        ))}
      </div>

      <div className="cta" style={{ marginTop: 4 }}>
        <button className="btn btn-ghost" onClick={() => go({ tab: 'avatar' })}>🧑 Avatar</button>
        <button className="btn btn-ghost" onClick={() => go({ tab: 'fame' })}>🏆 Hall of Fame</button>
        <button className="btn btn-ghost" onClick={() => go({ tab: 'shop' })}>💎 Diamond Shop</button>
      </div>
    </div>
  )
}
