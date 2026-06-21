import { useAppStore } from '@store/appStore'
import { WORLDS } from '@/data/learn'
import { worldRing } from '@lib/learnProgress'

function MiniRing({ pct, color }: { pct: number; color: string }) {
  const r = 24, c = 2 * Math.PI * r
  return (
    <svg width="58" height="58" viewBox="0 0 58 58">
      <circle cx="29" cy="29" r={r} fill="none" stroke="var(--border)" strokeWidth="5.5" />
      <circle cx="29" cy="29" r={r} fill="none" stroke={color} strokeWidth="5.5" strokeLinecap="round"
        strokeDasharray={`${(c * pct / 100).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 29 29)" />
      <text x="29" y="33" textAnchor="middle" fontSize="13" fontWeight="800" fill={color}>{pct}</text>
    </svg>
  )
}

export default function LearnHub() {
  const { go } = useAppStore()
  return (
    <div className="screen" style={{ justifyContent: 'flex-start', gap: 16, paddingTop: 6 }}>
      <div>
        <div className="kicker"><span className="live" />&nbsp;Learn</div>
        <h1 className="h-title" style={{ marginTop: 10 }}>Six <span className="g">worlds</span></h1>
        <p className="lead">Play games, earn badges, grow your skill rings. Pick a world to start.</p>
      </div>
      <div className="lh-grid">
        {WORLDS.map(w => {
          const pct = worldRing(w)
          return (
            <button key={w.key} className="lh-card" style={{ borderColor: `${w.color}44` }} onClick={() => go({ tab: w.key.toLowerCase() })}>
              <div className="lh-top">
                <div className="lh-ic" style={{ background: `${w.color}22`, borderColor: `${w.color}55`, color: w.color }}>{w.icon}</div>
                <MiniRing pct={pct} color={w.color} />
              </div>
              <b className="lh-name">{w.name}</b>
              <small className="lh-vibe" style={{ color: w.color }}>{w.vibe}</small>
            </button>
          )
        })}
      </div>
    </div>
  )
}
