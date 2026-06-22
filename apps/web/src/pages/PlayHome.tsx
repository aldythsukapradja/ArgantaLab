import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { WORLDS } from '@/data/learn'
import { worldRing } from '@lib/learnProgress'
import { getStreak, touchStreak } from '@lib/streak'
import Buddy, { type Mood } from '@components/avatar/Buddy'
import Avatar from '@/pages/Avatar'
import Fame from '@/pages/Fame'
import Shop from '@/pages/Shop'

// Short, no-abbreviation ring labels (kid-friendly).
const RING_LABEL: Record<string, string> = {
  NUM: 'Number', WRD: 'Word', WON: 'Wonder', LOG: 'Logic', WLD: 'World', LIF: 'Life',
}

type Hub = 'home' | 'style' | 'fame' | 'shop'

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
  const [hub, setHub] = useState<Hub>('home')
  const [hover, setHover] = useState<number | null>(null)
  const [mood, setMood] = useState<Mood>('wave')
  const [streak, setStreak] = useState(0)
  const outfit = resolvedOutfit()

  useEffect(() => {
    setStreak(touchStreak())
    const t = setTimeout(() => setMood('idle'), 1800)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => { setStreak(getStreak()) }, [])

  const rec = useMemo(() => {
    const ranked = WORLDS.map(w => ({ w, pct: worldRing(w) })).sort((a, b) => a.pct - b.pct)
    return ranked[0]
  }, [])

  const look = useMemo(() => {
    if (hover === null) return { x: 0, y: 0 }
    const a = (-90 + hover * 60) * Math.PI / 180
    return { x: Math.cos(a), y: Math.sin(a) }
  }, [hover])

  const editName = () => {
    const n = prompt('Avatar name (you can change it anytime):', learnerName)
    if (n && n.trim()) setLearnerName(n.trim())
  }

  const TABS: { k: Hub; label: string; ic: string }[] = [
    { k: 'home', label: 'Me', ic: '🏠' },
    { k: 'style', label: 'Style', ic: '👕' },
    { k: 'fame', label: 'Fame', ic: '🏆' },
    { k: 'shop', label: 'Shop', ic: '💎' },
  ]

  return (
    <div className="screen play-hub" style={{ justifyContent: 'flex-start' }}>
      <div className="phub-tabs">
        {TABS.map(t => (
          <button key={t.k} className={`phub-tab${hub === t.k ? ' on' : ''}`} onClick={() => setHub(t.k)}>
            <span className="phub-tab-ic">{t.ic}</span>{t.label}
          </button>
        ))}
      </div>

      {hub === 'style' && <Avatar />}
      {hub === 'fame' && <Fame />}
      {hub === 'shop' && <Shop />}

      {hub === 'home' && (
        <div className="phub-home">
          <div className="ph-greet">
            <div>
              <p className="ph-hi">Hi, <button className="ph-name" onClick={editName}>{learnerName} ✏️</button></p>
              <p className="ph-sub">Level {level} · {xp.toLocaleString()} XP · 💎 {diamonds}</p>
            </div>
            <div className="ph-streak">🔥 {streak} day{streak === 1 ? '' : 's'}</div>
          </div>

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
              const pct = worldRing(w)
              return (
                <button key={w.key} className="ph-ring" style={{ left: `${x}%`, top: `${y}%` }}
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                  onClick={() => go({ tab: w.key.toLowerCase() })} title={`${RING_LABEL[w.key]} — ${pct}%`}>
                  <span className="ph-ring-art">
                    <Ring pct={pct} color={w.color} />
                    <span className="ph-ring-glyph" style={{ color: w.color }}>{w.icon}</span>
                  </span>
                  <span className="ph-ring-label">{RING_LABEL[w.key]}</span>
                </button>
              )
            })}
          </div>

          <button className="ph-rec" style={{ borderColor: `${rec.w.color}55` }} onClick={() => go({ tab: rec.w.key.toLowerCase() })}>
            <span className="ph-rec-ic" style={{ background: `${rec.w.color}22`, color: rec.w.color }}>{rec.w.icon}</span>
            <span>Play <b>{RING_LABEL[rec.w.key]}</b> to grow your ring →</span>
          </button>

          <div className="phub-quick">
            <button className="phub-quick-b" onClick={() => setHub('style')}><span>👕</span>Dress up</button>
            <button className="phub-quick-b" onClick={() => setHub('shop')}><span>💎</span>Shop</button>
            <button className="phub-quick-b" onClick={() => go({ tab: 'learn' })}><span>📚</span>Learn</button>
            <button className="phub-quick-b" onClick={() => go({ tab: 'profile' })}><span>👥</span>My Circle</button>
          </div>
        </div>
      )}
    </div>
  )
}
