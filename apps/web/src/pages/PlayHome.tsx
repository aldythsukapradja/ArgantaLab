import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { WORLDS } from '@/data/learn'
import { todayWorldXp, ringPct, dailyCircle } from '@lib/dailyRings'
import { getStreak, touchStreak } from '@lib/streak'
import ExploringNotice from '@components/openworld/ExploringNotice'
import Buddy, { type Mood } from '@components/avatar/Buddy'
import NorthStar from '@components/rank/NorthStar'
import StyleShop from '@components/shop/StyleShop'
import DiamondIcon from '@components/ui/DiamondIcon'

const RING_LABEL: Record<string, string> = {
  NUM: 'Number', WRD: 'Word', WON: 'Wonder', LOG: 'Logic', WLD: 'World', LIF: 'Life',
}

function Ring({ pct, color }: { pct: number; color: string }) {
  const r = 26, c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 60 60" width="58" height="58">
      <circle cx="30" cy="30" r={r} fill="var(--bg-2)" stroke="var(--border)" strokeWidth="5.5" />
      <circle cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="5.5" strokeLinecap="round"
        strokeDasharray={`${(c * pct / 100).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 30 30)" />
    </svg>
  )
}

export default function PlayHome() {
  const { learnerName, setLearnerName, go, xp, level, diamonds, resolvedOutfit } = useAppStore()
  const [wardrobe, setWardrobe] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const [mood, setMood] = useState<Mood>('wave')
  const [streak, setStreak] = useState(0)
  const [todayXp, setTodayXp] = useState<Record<string, number>>({})
  const outfit = resolvedOutfit()

  useEffect(() => { const t = setTimeout(() => setMood('idle'), 1800); return () => clearTimeout(t) }, [])
  useEffect(() => { setStreak(getStreak()) }, [])

  // The daily circle (core 4). Only a FULL circle advances the streak.
  const circle = useMemo(() => dailyCircle(todayXp), [todayXp, xp])
  useEffect(() => { if (circle.full) setStreak(touchStreak()) }, [circle.full])

  // Today's XP per world → the orbit rings. Reloads when XP changes.
  useEffect(() => {
    let on = true
    todayWorldXp().then(x => { if (on) setTodayXp(x) })
    return () => { on = false }
  }, [xp])

  const pctFor = (key: string) => ringPct(todayXp[key] ?? 0)

  const look = useMemo(() => {
    if (hover === null) return { x: 0, y: 0 }
    const a = (-90 + hover * 60) * Math.PI / 180
    return { x: Math.cos(a), y: Math.sin(a) }
  }, [hover])

  const editName = () => {
    const n = prompt('Avatar name (you can change it anytime):', learnerName)
    if (n && n.trim()) setLearnerName(n.trim())
  }

  return (
    <div className="screen play-hub" style={{ justifyContent: 'flex-start' }}>
      <div className="phub-home">
        <div className="ph-greet">
          <div>
            <p className="ph-hi">Hi, <button className="ph-name" onClick={editName}>{learnerName} ✏️</button></p>
            <p className="ph-sub">Level {level} · {xp.toLocaleString()} XP · <DiamondIcon size={13} /> {diamonds}</p>
          </div>
          <div className="ph-streak">🔥 {streak} day{streak === 1 ? '' : 's'}</div>
        </div>

        <NorthStar circle={circle} onGo={t => go({ tab: t })} />

        <div className="ph-orbit">
          <svg className="ph-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            {WORLDS.map((w, i) => {
              const a = (-90 + i * 60) * Math.PI / 180
              const x = 50 + 38 * Math.cos(a), y = 50 + 38 * Math.sin(a)
              return <line key={w.key} x1="50" y1="50" x2={x} y2={y} stroke={w.color} strokeWidth="0.4" strokeDasharray="2 2" opacity="0.35" />
            })}
          </svg>

          <div className="ph-buddy">
            <Buddy mood={mood} size={146} look={look} outfit={outfit} />
          </div>

          {WORLDS.map((w, i) => {
            const a = (-90 + i * 60) * Math.PI / 180
            const x = 50 + 38 * Math.cos(a), y = 50 + 38 * Math.sin(a)
            const pct = pctFor(w.key)
            return (
              <button key={w.key} className="ph-ring" style={{ left: `${x}%`, top: `${y}%` }}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                onClick={() => go({ tab: w.key.toLowerCase() })} title={`${RING_LABEL[w.key]} — ${pct}% of today's goal`}>
                <span className="ph-ring-art">
                  <Ring pct={pct} color={w.color} />
                  <span className="ph-ring-glyph" style={{ color: w.color }}>{w.icon}</span>
                </span>
                <span className="ph-ring-label">{RING_LABEL[w.key]}</span>
              </button>
            )
          })}
        </div>

        <ExploringNotice onJoin={w => { useAppStore.setState({ enterLand: w }); go({ tab: w.toLowerCase() }) }} />
      </div>

      {/* floating hanger → the merged Style & Shop wardrobe */}
      <button className="ss-fab" onClick={() => setWardrobe(true)} aria-label="Style & Shop">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4a2 2 0 1 0 1.4 3.4L12 9 3 15v2h18v-2l-9-6" />
        </svg>
      </button>
      {wardrobe && <StyleShop onClose={() => setWardrobe(false)} />}
    </div>
  )
}
