import { useEffect, useMemo, useState } from 'react'
import { WORLDS } from '@/data/learn'
import { ringPct } from '@lib/dailyRings'
import { nexusRoster, type KinInstance } from '@lib/nexus'
import Buddy, { type Mood } from '@components/avatar/Buddy'
import KinSprite from '@components/openworld/KinSprite'

// Home's cozy yard (Neko-Atsume style): the avatar's cottage in the centre, the
// six worlds as signposts on a winding garden path — each with its own per-world
// daily-progress ring — and befriended kin living in the yard. Replaces the old
// straight-spoke orbit; light SVG/CSS (no game engine) so Home stays snappy.

const RING_LABEL: Record<string, string> = { NUM: 'Number', WRD: 'Word', WON: 'Wonder', LOG: 'Logic', WLD: 'World', LIF: 'Life' }
const KIN_SPOTS: [number, number][] = [[30, 72], [70, 74], [24, 40], [76, 46], [50, 26]]

function MiniRing({ pct, color, icon }: { pct: number; color: string; icon: string }) {
  const r = 15, c = 2 * Math.PI * r
  return (
    <span className="yard-ring">
      <svg viewBox="0 0 40 40" width="42" height="42">
        <circle cx="20" cy="20" r={r} fill="#fff" stroke="rgba(0,0,0,.1)" strokeWidth="4" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={`${(c * pct / 100).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 20 20)"
          style={{ transition: 'stroke-dasharray .6s ease' }} />
      </svg>
      <span className="yard-ring-ic" style={{ color }}>{icon}</span>
    </span>
  )
}

export default function HomeYard({ todayXp, outfit, go }: {
  todayXp: Record<string, number>; outfit: Parameters<typeof Buddy>[0]['outfit']; go: (t: { tab: string }) => void
}) {
  const [roster, setRoster] = useState<KinInstance[]>([])
  const [mood, setMood] = useState<Mood>('wave')
  const [hover, setHover] = useState<number | null>(null)
  useEffect(() => { nexusRoster().then(r => setRoster(r.slice(0, 5))) }, [])
  useEffect(() => { const t = setTimeout(() => setMood('idle'), 1800); return () => clearTimeout(t) }, [])

  const signs = useMemo(() => WORLDS.map((w, i) => {
    const a = (-90 + i * 60) * Math.PI / 180
    return { w, x: 50 + Math.cos(a) * 38, y: 50 + Math.sin(a) * 40, pct: ringPct(todayXp[w.key] ?? 0) }
  }), [todayXp])

  const look = hover === null ? { x: 0, y: 0 } : (() => { const a = (-90 + hover * 60) * Math.PI / 180; return { x: Math.cos(a), y: Math.sin(a) } })()

  return (
    <div className="yard">
      <svg className="yard-bg" viewBox="0 0 300 300" preserveAspectRatio="none" aria-hidden="true">
        {/* winding garden loop the signposts sit on (a soft oval, not straight spokes) */}
        <ellipse cx="150" cy="150" rx="112" ry="118" fill="none" stroke="#e6cfa0" strokeWidth="19" />
        <ellipse cx="150" cy="150" rx="112" ry="118" fill="none" stroke="#f0dcae" strokeWidth="9" />
        {signs.map(s => <line key={s.w.key} x1="150" y1="150" x2={s.x / 100 * 300} y2={s.y / 100 * 300} stroke="#e7d2a4" strokeWidth="8" strokeLinecap="round" opacity=".7" />)}
        {/* pond */}
        <ellipse cx="248" cy="256" rx="34" ry="20" fill="#6fd0e8" stroke="#4fb8d6" strokeWidth="3" />
        {/* kin-house */}
        <g transform="translate(56,238)"><rect x="-15" y="-3" width="30" height="18" fill="#d9b98a" /><path d="M-18 -3 L0 -16 L18 -3 Z" fill="#9a6b3f" /><ellipse cx="0" cy="8" rx="9" ry="7" fill="#3a2a1a" /></g>
        {/* flowers */}
        {Array.from({ length: 16 }).map((_, i) => {
          const x = 30 + Math.random() * 240, y = 30 + Math.random() * 240
          if (Math.hypot(x - 150, y - 150) < 55) return null
          return <circle key={i} cx={x} cy={y} r="3" fill={['#ff7eb3', '#ffd86b', '#ffffff', '#ff9a4a'][i % 4]} />
        })}
      </svg>

      <div className="yard-home"><Buddy mood={mood} size={112} look={look} outfit={outfit} /></div>

      {signs.map((s, i) => (
        <button key={s.w.key} className="yard-sign" style={{ left: `${s.x}%`, top: `${s.y}%` }}
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
          onClick={() => go({ tab: s.w.key.toLowerCase() })} title={`${RING_LABEL[s.w.key]} — ${s.pct}% today`}>
          <MiniRing pct={s.pct} color={s.w.color} icon={s.w.icon} />
          <span className="yard-sign-lbl">{RING_LABEL[s.w.key]}</span>
        </button>
      ))}

      {roster.map((k, i) => {
        const [x, y] = KIN_SPOTS[i % KIN_SPOTS.length]
        return (
          <button key={k.id} className="yard-kin" style={{ left: `${x}%`, top: `${y}%` }} onClick={() => go({ tab: 'kinworld' })} title="Tap to visit your kin">
            <span className="yard-kin-in" style={{ animationDelay: `${(i * 0.8).toFixed(1)}s` }}><KinSprite kin={k.kin_key} size={42} bob /></span>
          </button>
        )
      })}
    </div>
  )
}
