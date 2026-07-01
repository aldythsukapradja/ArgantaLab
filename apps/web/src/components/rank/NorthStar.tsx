import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '@store/appStore'
import type { DailyCircle } from '@lib/dailyRings'
import { myRankPoints, tierOf } from '@lib/rank'
import { DAILY_RING_REWARD, ringRewardClaimedToday, claimRingReward, celebrationSeenToday, markCelebrationSeen } from '@lib/dailyReward'
import { earnDiamonds } from '@lib/wallet'
import DiamondIcon from '@components/ui/DiamondIcon'
import { localDay } from '@lib/day'
import TierIcon from './TierIcon'
import RankLadder from './RankLadder'

// deterministic confetti pieces for the celebration burst
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  x: (i * 53) % 100,
  color: ['#f0a83a', '#37a8c4', '#7a4fd0', '#ec4899', '#5ec257', '#f4c14e'][i % 6],
  d: (i % 6) * 0.12,
  r: (i * 47) % 360,
}))

// The daily North Star — Apple-Activity-style concentric rings (Focus outermost,
// filling inward through Rings, Quests, Catch), with the rank crest at the centre.
// Completing all four goals awards a daily diamond bonus + a celebration.
export default function NorthStar({ circle, onGo }: { circle: DailyCircle; onGo: (tab: string) => void }) {
  const learnerName = useAppStore(s => s.learnerName)
  const [points, setPoints] = useState(0)
  const [ladder, setLadder] = useState(false)
  const [claimed, setClaimed] = useState(ringRewardClaimedToday())
  const [celebrate, setCelebrate] = useState(false)
  useEffect(() => { myRankPoints().then(setPoints) }, [])
  const t = tierOf(points)

  // Daily bonus: complete the WHOLE North Star (all 4 goals) → 100 💎, once a day.
  const done = circle.full
  const giftReady = done && !claimed

  const claimGift = async () => {
    if (!done || claimed || !claimRingReward()) return
    setClaimed(true)
    await earnDiamonds(DAILY_RING_REWARD, 'quest', `northstar:${localDay()}`)
    useAppStore.getState().addToast(`+${DAILY_RING_REWARD} 💎 · North Star complete!`, '💎')
  }

  // Pop the celebration once, the moment the North Star fills.
  useEffect(() => {
    if (done && !claimed && !celebrationSeenToday()) { markCelebrationSeen(); setCelebrate(true) }
  }, [done, claimed])

  const goals: { on: boolean; ic: string; name: string; count: ReactNode; tab: string; color: string; r: number; frac: number }[] = [
    { on: circle.effort, ic: '🔥', name: 'Focus', count: <>{Math.min(circle.xp, circle.goalXp)}/{circle.goalXp}</>, tab: 'learn', color: '#f0a83a', r: 52, frac: Math.min(1, circle.xp / circle.goalXp) },
    { on: circle.rings, ic: '🎯', name: 'Fill your 6 rings', count: <>{circle.ringsN}/{circle.ringsGoal}</>, tab: 'learn', color: '#37a8c4', r: 40, frac: circle.ringsN / circle.ringsGoal },
    { on: circle.quest, ic: '📜', name: 'Clear quests', count: <>{Math.min(circle.quests, circle.questGoal)}/{circle.questGoal}</>, tab: 'quests', color: '#7a4fd0', r: 28, frac: Math.min(1, circle.quests / circle.questGoal) },
    { on: circle.kin, ic: '🐾', name: 'Catch a kin', count: <>{Math.min(circle.kins, circle.kinGoal)}/{circle.kinGoal}</>, tab: 'kinworld', color: '#ec4899', r: 16, frac: Math.min(1, circle.kins / circle.kinGoal) },
  ]

  return (
    <div className={`ns${circle.full ? ' full' : ''}`}>
      <div className="ns-ringcol">
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
      <button className="ns-rank" onClick={() => setLadder(true)} style={{ ['--tc' as string]: t.tier.color }}>
        <b>{t.tier.name}</b><span>{points.toLocaleString()} XP · how to climb ›</span>
      </button>

      {/* daily bonus capsule — complete the North Star to claim 100 💎 (resets daily) */}
      <button className={`ns-gift${giftReady ? ' ready' : ''}${claimed ? ' done' : ''}`} onClick={claimGift} disabled={!giftReady}>
        <DiamondIcon size={14} />
        {claimed
          ? <span>Claimed <b>✓</b></span>
          : giftReady
            ? <span>Claim <b>{DAILY_RING_REWARD}</b></span>
            : <span><b>{DAILY_RING_REWARD}</b> · {circle.done}/4</span>}
      </button>
      </div>

      <div className="ns-body">
        <div className="ns-head">
          <b>North Star</b>
          <span className="ns-tier" style={{ color: circle.full ? '#0f6e56' : 'var(--t2)', background: circle.full ? '#1d9e751e' : 'var(--panel-2)' }}>{circle.done}/4 done</span>
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

      {ladder && <RankLadder points={points} onClose={() => setLadder(false)} />}

      {celebrate && createPortal(
        <div className="nsc-wrap" onClick={() => setCelebrate(false)}>
          <div className="nsc-card" onClick={e => e.stopPropagation()}>
            <div className="nsc-confetti" aria-hidden>
              {CONFETTI.map((c, i) => <i key={i} style={{ left: `${c.x}%`, background: c.color, animationDelay: `${c.d}s`, transform: `rotate(${c.r}deg)` }} />)}
            </div>
            <button className="nsc-x" onClick={() => setCelebrate(false)} aria-label="Close">✕</button>
            <div className="nsc-badge"><TierIcon color={t.tier.color} glyph={t.tier.glyph} size={58} /></div>
            <h2 className="nsc-title">🎉 North Star complete!</h2>
            <p className="nsc-sub">You lit up your whole day{learnerName ? `, ${learnerName}` : ''}. Here's your daily bonus.</p>
            <button className="nsc-claim" onClick={async () => { await claimGift(); setCelebrate(false) }}>
              {claimed ? <>Claimed ✓</> : <>Claim {DAILY_RING_REWARD} <DiamondIcon size={18} /></>}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
