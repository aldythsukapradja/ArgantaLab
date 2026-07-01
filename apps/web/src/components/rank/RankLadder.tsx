import { createPortal } from 'react-dom'
import { TIERS, tierOf, TOP_POINTS } from '@lib/rank'
import TierIcon from './TierIcon'

// The rank ladder popup — shows every tier's XP threshold, where you are, and
// how far to the top. Opened from the rank chip under the North Star rings.
export default function RankLadder({ points, onClose }: { points: number; onClose: () => void }) {
  const cur = tierOf(points)
  return createPortal(
    <div className="rl-wrap" onClick={onClose}>
      <div className="rl-panel" onClick={e => e.stopPropagation()}>
        <div className="rl-head">
          <div><div className="kicker">🏅 Rank ladder</div><h2 className="rl-title">Climb to Luminary</h2></div>
          <button className="rl-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="rl-sub">Your rank is your <b>season XP</b> — every bit of learning (lessons, drills, dungeons, quests) counts. The summit is a long climb; everyone resets each season.</p>

        <div className="rl-list">
          {TIERS.map((t, i) => ({ t, i })).reverse().map(({ t, i }) => {
            const reached = points >= t.at
            const isCur = i === cur.tierIdx
            return (
              <div key={t.name} className={`rl-row${isCur ? ' cur' : ''}${reached ? ' reached' : ''}`} style={isCur ? { borderColor: t.color } : undefined}>
                <TierIcon color={t.color} glyph={t.glyph} size={40} />
                <div className="rl-info">
                  <b style={{ color: t.color }}>{t.name}</b>
                  <span>{t.at.toLocaleString()} XP{i === TIERS.length - 1 ? ' · the summit' : ''}</span>
                </div>
                {isCur ? <span className="rl-you">You · {points.toLocaleString()} XP</span> : reached ? <span className="rl-done">✓</span> : <span className="rl-lock">🔒</span>}
              </div>
            )
          })}
        </div>

        <div className="rl-foot">
          {points >= TOP_POINTS
            ? '👑 You are Luminary — the summit!'
            : <><b>{(TOP_POINTS - points).toLocaleString()}</b> XP to <b>Luminary</b></>}
        </div>
      </div>
    </div>,
    document.body,
  )
}
