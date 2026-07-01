import { useEffect, useState, type ReactNode } from 'react'
import type { DailyCircle } from '@lib/dailyRings'
import { myRankPoints, tierOf } from '@lib/rank'
import TierIcon from './TierIcon'

// The daily North Star — Apple-Activity-style concentric rings (Focus outermost,
// filling inward through Rings, Quests, Catch), with the rank crest at the centre.
// Each goal also shows as a clean colour-coded card.
export default function NorthStar({ circle, onGo }: { circle: DailyCircle; onGo: (tab: string) => void }) {
  const [points, setPoints] = useState(0)
  useEffect(() => { myRankPoints().then(setPoints) }, [])
  const t = tierOf(points)

  const goals: { on: boolean; ic: string; name: string; count: ReactNode; tab: string; color: string; r: number; frac: number }[] = [
    { on: circle.effort, ic: '🔥', name: 'Focus', count: <>{Math.min(circle.xp, circle.goalXp)}/{circle.goalXp}</>, tab: 'learn', color: '#f0a83a', r: 52, frac: Math.min(1, circle.xp / circle.goalXp) },
    { on: circle.rings, ic: '🎯', name: 'Fill your 6 rings', count: <>{circle.ringsN}/{circle.ringsGoal}</>, tab: 'learn', color: '#37a8c4', r: 40, frac: circle.ringsN / circle.ringsGoal },
    { on: circle.quest, ic: '📜', name: 'Clear quests', count: <>{Math.min(circle.quests, circle.questGoal)}/{circle.questGoal}</>, tab: 'quests', color: '#7a4fd0', r: 28, frac: Math.min(1, circle.quests / circle.questGoal) },
    { on: circle.kin, ic: '🐾', name: 'Catch a kin', count: <>{Math.min(circle.kins, circle.kinGoal)}/{circle.kinGoal}</>, tab: 'kinworld', color: '#ec4899', r: 16, frac: Math.min(1, circle.kins / circle.kinGoal) },
  ]

  return (
    <div className={`ns${circle.full ? ' full' : ''}`}>
      <div className="ns-ring">
        <svg viewBox="0 0 120 120" width="126" height="126">
          <g fill="none" strokeLinecap="round">
            {goals.map((g, i) => {
              const c = 2 * Math.PI * g.r
              return (
                <g key={i}>
                  <circle cx="60" cy="60" r={g.r} stroke={g.color} strokeOpacity="0.18" strokeWidth="9" />
                  <circle cx="60" cy="60" r={g.r} stroke={g.color} strokeWidth="9"
                    strokeDasharray={`${(c * g.frac).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 60 60)"
                    style={{ transition: 'stroke-dasharray .7s cubic-bezier(.2,.8,.2,1)' }} />
                </g>
              )
            })}
          </g>
        </svg>
        <div className="ns-center"><TierIcon color={t.tier.color} glyph={t.tier.glyph} size={34} /></div>
      </div>

      <div className="ns-body">
        <div className="ns-head">
          <b>Today's North Star</b>
          <span className="ns-tier" style={{ color: circle.full ? '#0f6e56' : t.tier.color, background: `${circle.full ? '#1d9e75' : t.tier.color}1e` }}>{t.tier.name} · {circle.done}/4</span>
        </div>
        <div className="ns-goals">
          {goals.map((g, i) => (
            <button key={i} className={`gcard${g.on ? ' on' : ''}`} style={{ ['--c' as string]: g.color }} onClick={() => onGo(g.tab)}>
              <span className="gc-ic">{g.ic}</span>
              <span className="gc-t">{g.name}</span>
              <span className="gc-n">{g.count}</span>
              <span className={`gc-chk${g.on ? ' on' : ''}`}>{g.on ? '✓' : '→'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
