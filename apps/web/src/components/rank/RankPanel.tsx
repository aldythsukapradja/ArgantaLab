import { useEffect, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { myRankPoints, seasonPoints, tierOf, seasonEndsInDays } from '@lib/rank'
import { myCircles, circleRoster } from '@lib/cloudAuth'
import TierIcon from './TierIcon'

// The seasonal rank — the player's tier crest + within-circle standings. Lives
// in Fame; points come only from learning and reset each season.
export default function RankPanel() {
  const { learnerName, activeCircleId, session } = useAppStore()
  const myId = session && session !== 'loading' ? session.user.id : null
  const [points, setPoints] = useState(0)
  const [board, setBoard] = useState<{ id: string; name: string; points: number }[]>([])

  useEffect(() => {
    let on = true
    myRankPoints().then(p => { if (on) setPoints(p) })
    ;(async () => {
      const circleId = activeCircleId ?? (await myCircles())[0]?.id
      if (!circleId) return
      const members = (await circleRoster(circleId)).filter(m => m.is_kid || m.id === myId)
      if (!members.length) return
      const pts = await seasonPoints(members.map(m => m.id))
      if (on) setBoard(members.map(m => ({ id: m.id, name: m.display_name, points: pts[m.id] ?? 0 })).sort((a, b) => b.points - a.points))
    })()
    return () => { on = false }
  }, [activeCircleId, myId])

  const t = tierOf(points)
  const days = seasonEndsInDays()

  return (
    <div className="rank-panel">
      <div className="rank-top">
        <TierIcon color={t.tier.color} glyph={t.tier.glyph} size={52} />
        <div className="rank-info">
          <div className="rank-name" style={{ color: t.tier.color }}>{t.tier.name}
            <span className="rank-stars">{'★'.repeat(t.star)}<span className="dim">{'★'.repeat(t.starsPer - t.star)}</span></span>
          </div>
          <div className="rank-sub">{points.toLocaleString()} XP · season ends in {days} day{days === 1 ? '' : 's'}</div>
        </div>
      </div>
      {board.length > 1 && (
        <div className="rank-board">
          {board.slice(0, 6).map((r, i) => (
            <div key={r.id} className={`rank-row${r.id === myId ? ' me' : ''}`}>
              <span className="rank-pos">{i + 1}</span>
              <span className="rank-who">{r.id === myId ? `${learnerName} (you)` : r.name}</span>
              <span className="rank-pts">{r.points.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
      <p className="rank-hint">Climb by learning — lessons, drills, and quests earn points. Resets every season.</p>
    </div>
  )
}
