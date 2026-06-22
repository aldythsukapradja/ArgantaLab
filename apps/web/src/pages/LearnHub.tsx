import { useMemo } from 'react'
import { useAppStore } from '@store/appStore'
import { WORLDS, STAGES, STAGE_META } from '@/data/learn'
import { worldRing, earnedBadges } from '@lib/learnProgress'
import Buddy from '@components/avatar/Buddy'

// Each world is an island on a hand-drawn adventure map. Positions trace a
// winding trail down the page; the Buddy stands at the island you should play
// next (lowest ring). Bright & fantasy, never a dark panel in light mode.
const SPOTS = [
  { x: 27, y: 13 }, { x: 69, y: 25 }, { x: 31, y: 41 },
  { x: 70, y: 57 }, { x: 29, y: 73 }, { x: 64, y: 88 },
]
const MOTIF: Record<string, string> = { NUM: '🔢', WRD: '📖', WON: '🔬', LOG: '🤖', WLD: '🌍', LIF: '🎈' }

function Ring({ pct, color }: { pct: number; color: string }) {
  const r = 15, c = 2 * Math.PI * r
  return (
    <svg width="38" height="38" viewBox="0 0 38 38" className="fmap-ring">
      <circle cx="19" cy="19" r={r} fill="#fff" stroke="#e7e9f0" strokeWidth="4" />
      <circle cx="19" cy="19" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={`${(c * pct / 100).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 19 19)" />
      <text x="19" y="23" textAnchor="middle" fontSize="11" fontWeight="800" fill={color}>{pct}</text>
    </svg>
  )
}

export default function LearnHub() {
  const { go, resolvedOutfit, stageKey, learnerName } = useAppStore()
  const outfit = resolvedOutfit()
  const stage = STAGES.find(s => s.key === stageKey)
  const meta = STAGE_META[stageKey]

  const rings = useMemo(() => WORLDS.map(w => ({ w, pct: worldRing(w) })), [])
  const totalBadges = useMemo(() => WORLDS.reduce((a, w) => a + earnedBadges(w).size, 0), [])
  // "you are here" = first world that isn't finished (lowest ring)
  const hereIdx = useMemo(() => {
    let lo = 0
    rings.forEach((r, i) => { if (r.pct < rings[lo].pct) lo = i })
    return lo
  }, [rings])

  // trail path through the spots (smooth-ish)
  const trail = SPOTS.map((s, i) => `${i ? 'L' : 'M'} ${s.x} ${s.y}`).join(' ')

  return (
    <div className="screen fmap-screen" style={{ justifyContent: 'flex-start' }}>
      <div className="fmap-head">
        <div>
          <div className="kicker"><span className="live" />&nbsp;Adventure Map</div>
          <h1 className="h-title" style={{ marginTop: 6, fontSize: 'clamp(24px,4vw,38px)' }}>Pick your <span className="g">world</span></h1>
        </div>
        {stage && meta && (
          <div className="fmap-stage" style={{ borderColor: `${meta.color}55`, color: meta.color }}>
            <b>{meta.emoji} {stage.label}</b><span>{learnerName} · ages {stage.minAge}–{stage.maxAge} · {totalBadges} 🏅</span>
          </div>
        )}
      </div>

      <div className="fmap">
        {/* sea + trail + decorations */}
        <svg className="fmap-bg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#bfe9ff" /><stop offset="100%" stopColor="#e6f7ff" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="100" height="100" fill="url(#sea)" />
          {/* gentle wave rows */}
          {[12, 30, 48, 66, 84].map((y, i) => (
            <path key={i} d={`M0 ${y} q5 -2 10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0`} stroke="#9fdcff" strokeWidth="0.4" fill="none" opacity="0.5" />
          ))}
        </svg>
        <svg className="fmap-trail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <path d={trail} stroke="#fbbf24" strokeWidth="0.9" strokeDasharray="2.4 2.2" fill="none" strokeLinecap="round" opacity="0.85" />
        </svg>

        {/* compass + clouds */}
        <div className="fmap-compass">🧭</div>
        <div className="fmap-cloud c1">☁️</div>
        <div className="fmap-cloud c2">☁️</div>

        {/* world islands */}
        {rings.map(({ w, pct }, i) => {
          const s = SPOTS[i]
          const here = i === hereIdx
          return (
            <button key={w.key} className={`fmap-island${here ? ' here' : ''}`} style={{ left: `${s.x}%`, top: `${s.y}%`, ['--wc' as string]: w.color }}
              onClick={() => go({ tab: w.key.toLowerCase() })}>
              <span className="fmap-land" style={{ background: `radial-gradient(circle at 38% 30%, color-mix(in srgb,${w.color} 55%,#fff), ${w.color})` }}>
                <span className="fmap-motif">{MOTIF[w.key]}</span>
                <span className="fmap-glyph">{w.icon}</span>
              </span>
              <span className="fmap-ring-badge"><Ring pct={pct} color={w.color} /></span>
              <span className="fmap-flag" style={{ background: w.color }}>{w.name}</span>
              {here && (
                <span className="fmap-here">
                  <span className="fmap-here-buddy"><Buddy size={56} mood="wave" outfit={outfit} /></span>
                  <span className="fmap-here-tag">YOU</span>
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
