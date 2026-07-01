import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { WORLDS } from '@/data/learn'
import { todayWorldXp, ringPct, dailyCircle } from '@lib/dailyRings'
import { getStreak, touchStreak } from '@lib/streak'
import ExploringNotice from '@components/openworld/ExploringNotice'
import WishlistGoal from '@components/openworld/WishlistGoal'
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
  const [todayXp, setTodayXp] = useState<Record<string, number>>({})
  const outfit = resolvedOutfit()

  useEffect(() => {
    const t = setTimeout(() => setMood('idle'), 1800)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => { setStreak(getStreak()) }, [])

  // The daily circle (3 actions). Only a FULL circle advances the streak — the
  // streak no longer ticks just for opening the app.
  const circle = useMemo(() => dailyCircle(todayXp), [todayXp, xp])
  useEffect(() => { if (circle.full) setStreak(touchStreak()) }, [circle.full])

  // Daily rings = today's XP per world from the cloud event log. Reload on mount,
  // when returning to the Home sub-tab, and whenever the kid's XP changes (they
  // just earned some) so the ring fills live without a refresh.
  useEffect(() => {
    if (hub !== 'home') return
    let on = true
    todayWorldXp().then(x => { if (on) setTodayXp(x) })
    return () => { on = false }
  }, [hub, xp])

  const pctFor = (key: string) => ringPct(todayXp[key] ?? 0)

  const rec = useMemo(() => {
    const ranked = WORLDS.map(w => ({ w, pct: ringPct(todayXp[w.key] ?? 0) })).sort((a, b) => a.pct - b.pct)
    return ranked[0]
  }, [todayXp])

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

          <div className={`ph-circle${circle.full ? ' full' : ''}`}>
            <div className="ph-circle-head">
              <b>⭐ Today's North Star</b>
              <span>{circle.full ? '✓ Full — streak safe today!' : `${circle.done}/4 done`}</span>
            </div>
            <div className="ph-circle-reqs">
              <button className={`ph-req${circle.effort ? ' on' : ''}`} onClick={() => go({ tab: 'learn' })}>{circle.effort ? '✓' : '⏱️'} Focus <b>{Math.min(circle.xp, circle.goalXp)}/{circle.goalXp}</b> XP</button>
              <button className={`ph-req${circle.lesson ? ' on' : ''}`} onClick={() => go({ tab: 'learn' })}>{circle.lesson ? '✓' : '📚'} Finish a lesson</button>
              <button className={`ph-req${circle.drill ? ' on' : ''}`} onClick={() => go({ tab: 'learn' })}>{circle.drill ? '✓' : '⚡'} Do drills <b>{Math.min(circle.drills, circle.drillGoal)}/{circle.drillGoal}</b></button>
              <button className={`ph-req${circle.kin ? ' on' : ''}`} onClick={() => go({ tab: 'kinworld' })}>{circle.kin ? '✓' : '🐾'} Catch a kin</button>
            </div>
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

          <button className="ph-rec" style={{ borderColor: `${rec.w.color}55` }} onClick={() => go({ tab: rec.w.key.toLowerCase() })}>
            <span className="ph-rec-ic" style={{ background: `${rec.w.color}22`, color: rec.w.color }}>{rec.w.icon}</span>
            <span>{rec.pct >= 100 ? <>Rings glowing — keep your <b>{streak}-day</b> streak →</> : <>Play <b>{RING_LABEL[rec.w.key]}</b> to fill today's ring →</>}</span>
          </button>

          <WishlistGoal onOpen={kind => kind === 'mount' ? go({ tab: 'mounts' }) : setHub('shop')} />
          <ExploringNotice onJoin={w => { useAppStore.setState({ enterLand: w }); go({ tab: w.toLowerCase() }) }} />
        </div>
      )}
    </div>
  )
}
