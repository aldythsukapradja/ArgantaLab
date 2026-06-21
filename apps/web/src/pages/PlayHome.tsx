import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { GAMES, gameThumb } from '@/data'
import { WORLDS, accessoryFor } from '@/data/learn'
import { worldRing } from '@lib/learnProgress'
import { getStreak, touchStreak } from '@lib/streak'
import { loadMyGames, saveMyGame, deleteMyGame, type SavedGame } from '@lib/myGames'
import { pushGame, deleteGameCloud } from '@lib/gamesCloud'
import { WORLDS as WIZ_WORLDS, CHARACTERS } from '@/data/wizard'
import Buddy, { type Mood } from '@components/avatar/Buddy'

const PlayIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
const PlusIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
const TrashIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>

const worldBg: Record<string, string> = {
  space: 'linear-gradient(135deg,#0a0e27,#1a1147)', ocean: 'linear-gradient(135deg,#012a4a,#01497c)',
  volcano: 'linear-gradient(135deg,#2b0a0a,#6a1212)', ice: 'linear-gradient(135deg,#0a2a3a,#16526b)',
  jungle: 'linear-gradient(135deg,#0c2a12,#1a4d24)', city: 'linear-gradient(135deg,#0a0a1a,#241047)',
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
  const { learnerName, setLearnerName, go, xp, level, openGame, gamesPlayed, playWizardGame, session, costume } = useAppStore()
  const [hover, setHover] = useState<number | null>(null)
  const [mood, setMood] = useState<Mood>('wave')
  const [streak, setStreak] = useState(0)
  const [mine, setMine] = useState<SavedGame[]>([])
  const uid = session && session !== 'loading' ? session.user.id : null

  useEffect(() => {
    setStreak(touchStreak()); setMine(loadMyGames())
    const t = setTimeout(() => setMood('idle'), 1800)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => { setStreak(getStreak()) }, [])

  // recommended = lowest-ring live world
  const rec = useMemo(() => {
    const ranked = WORLDS.map(w => ({ w, pct: worldRing(w) })).sort((a, b) => a.pct - b.pct)
    return ranked[0]
  }, [])

  // eye-follow: look toward the hovered ring
  const look = useMemo(() => {
    if (hover === null) return { x: 0, y: 0 }
    const a = (-90 + hover * 60) * Math.PI / 180
    return { x: Math.cos(a), y: Math.sin(a) }
  }, [hover])

  const editName = () => {
    const n = prompt('Avatar name (you can change it anytime):', learnerName)
    if (n && n.trim()) setLearnerName(n.trim())
  }

  const play = (g: SavedGame) => {
    const updated = { ...g, plays: g.plays + 1 }
    setMine(saveMyGame(updated)); if (uid) pushGame(uid, updated)
    playWizardGame(g.html, g.title)
  }
  const remove = (id: string) => { setMine(deleteMyGame(id)); if (uid) deleteGameCloud(uid, id) }

  return (
    <div className="screen arg ph">
      <div className="ph-greet">
        <div>
          <p className="ph-hi">Hi, <button className="ph-name" onClick={editName}>{learnerName} ✏️</button></p>
          <p className="ph-sub">Level {level} · {xp.toLocaleString()} XP</p>
        </div>
        <div className="ph-streak">🔥 {streak} day{streak === 1 ? '' : 's'}</div>
      </div>

      <div className="ph-orbit">
        {/* connector lines */}
        <svg className="ph-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {WORLDS.map((w, i) => {
            const a = (-90 + i * 60) * Math.PI / 180
            const x = 50 + 38 * Math.cos(a), y = 50 + 38 * Math.sin(a)
            return <line key={w.key} x1="50" y1="50" x2={x} y2={y} stroke={w.color} strokeWidth="0.4" strokeDasharray="2 2" opacity="0.35" />
          })}
        </svg>

        <div className="ph-buddy">
          <Buddy mood={mood} size={132} look={look} accessory={accessoryFor(costume)} />
        </div>

        {WORLDS.map((w, i) => {
          const a = (-90 + i * 60) * Math.PI / 180
          const x = 50 + 38 * Math.cos(a), y = 50 + 38 * Math.sin(a)
          const pct = worldRing(w)
          return (
            <button key={w.key} className="ph-ring" style={{ left: `${x}%`, top: `${y}%` }}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              onClick={() => go({ tab: w.key.toLowerCase() })} title={`${w.name} — ${pct}%`}>
              <span className="ph-ring-art">
                <Ring pct={pct} color={w.color} />
                <span className="ph-ring-glyph" style={{ color: w.color }}>{w.icon}</span>
              </span>
              <span className="ph-ring-label">{w.skills[0] ? w.key : w.key}</span>
            </button>
          )
        })}
      </div>

      <button className="ph-rec" style={{ borderColor: `${rec.w.color}55` }} onClick={() => go({ tab: rec.w.key.toLowerCase() })}>
        <span className="ph-rec-ic" style={{ background: `${rec.w.color}22`, color: rec.w.color }}>{rec.w.icon}</span>
        <span>Try <b>{rec.w.name}</b> to grow your ring →</span>
      </button>

      <div className="section-label">My Creations</div>
      <div className="glist">
        {mine.map(g => {
          const char = g.source === 'procode' ? '🔬' : (CHARACTERS.find(c => c.key === g.config?.character)?.emoji ?? '🎮')
          const world = g.source === 'procode' ? 'Pro-Code' : (WIZ_WORLDS.find(w => w.key === g.config?.world)?.label ?? '')
          return (
            <div key={g.id} className="grow">
              <div className="gic mine" style={{ background: worldBg[g.config?.world ?? ''] || 'var(--grad)' }}><span className="mine-char">{char}</span></div>
              <div className="gmeta"><h3>{g.title}</h3><span>{world} · {g.plays} plays</span></div>
              <div className="mine-actions">
                <button className="get" onClick={() => play(g)}><PlayIcon /> Play</button>
                <button className="mine-del" title="Delete" onClick={() => remove(g.id)}><TrashIcon /></button>
              </div>
            </div>
          )
        })}
        <button className="grow grow-add" onClick={() => go({ tab: 'studio' })}>
          <div className="gic add"><PlusIcon /></div>
          <div className="gmeta"><h3>Build a new game</h3><span>Open the Game Wizard</span></div>
        </button>
      </div>

      <div className="section-label">Game Collection</div>
      <div className="glist">
        {GAMES.map(g => (
          <button key={g.id} className="grow" onClick={() => openGame(g.id)}>
            <div className="gic" dangerouslySetInnerHTML={{ __html: gameThumb(g.hue) }} />
            <div className="gmeta"><h3>{g.name} {gamesPlayed.includes(g.id) && <em>Played</em>}</h3><span>{g.desc}</span></div>
            <div className="get"><PlayIcon /> Play</div>
          </button>
        ))}
      </div>
    </div>
  )
}
