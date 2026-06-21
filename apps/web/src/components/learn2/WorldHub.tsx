import { useState } from 'react'
import type { World, JourneyNode, Badge } from '@/data/learn'
import { accessoryFor } from '@/data/learn'
import { useAppStore } from '@store/appStore'
import { getMastery } from '@lib/adaptive'
import { nodeState, nodeUnlocked, setNodeDone, worldRing, earnedBadges } from '@lib/learnProgress'
import ItemPlayer from './ItemPlayer'
import Buddy from '@components/avatar/Buddy'
import BadgeCinematic from './BadgeCinematic'
import CinematicLauncher from './CinematicLauncher'
import Journey from './Journey'
import { pushLearnState } from '@lib/learnCloud'
import { bumpQuest } from '@lib/quests'

type Spine = 'journey' | 'signature' | 'arena' | 'badges' | 'profile'

function Ring({ pct, color, size = 56 }: { pct: number; color: string; size?: number }) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${(c * pct / 100).toFixed(1)} ${c.toFixed(1)}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="54%" textAnchor="middle" fontSize="13" fontWeight="800" fill={color}>{pct}</text>
    </svg>
  )
}

export default function WorldHub({ world }: { world: World }) {
  const { requireAuth, addDiamonds, addToast, costume, session, go } = useAppStore()
  const uid = session && session !== 'loading' ? session.user.id : null
  const [spine, setSpine] = useState<Spine>('journey')
  const [active, setActive] = useState<JourneyNode | null>(null)
  const [badgeQueue, setBadgeQueue] = useState<Badge[]>([])
  const [, force] = useState(0)
  const ring = worldRing(world)
  const flat = world.units.flatMap(u => u.nodes)
  const earned = earnedBadges(world)

  // the current node = first unlocked, not-yet-done node (gets the START bubble)
  const currentKey = flat.find((n, i) => nodeUnlocked(world, i) && nodeState(world.key, n.key).status !== 'done')?.key

  const cinematic = badgeQueue[0]
    ? <BadgeCinematic key={badgeQueue[0].key} name={badgeQueue[0].name} icon={badgeQueue[0].icon}
        color={world.color} accessory={accessoryFor(costume)}
        onDone={() => setBadgeQueue(q => q.slice(1))} />
    : null

  const launch = (node: JourneyNode) => {
    if (!requireAuth('to start learning')) return
    setActive(node)
  }

  const complete = (node: JourneyNode, stars: number) => {
    const wasDone = nodeState(world.key, node.key).status === 'done'
    setNodeDone(world.key, node.key, stars)
    bumpQuest(node.type === 'boss' ? 'boss' : 'node')
    if (!wasDone) {
      addDiamonds(node.rewardDiamonds)
      // queue any newly-earned badges for the unlock cinematic
      const after = earnedBadges(world)
      const fresh = world.badges.filter(b => after.has(b.key) && !earned.has(b.key))
      if (fresh.length) setBadgeQueue(q => [...q, ...fresh])
    }
    if (uid) pushLearnState(uid)   // mirror progress to the cloud (best-effort)
    force(n => n + 1)
  }

  if (active) {
    return (
      <div className="le-world">
        {cinematic}
        <ItemPlayer world={world} node={active}
          onExit={() => { setActive(null); force(n => n + 1) }}
          onComplete={(stars) => complete(active, stars)} />
      </div>
    )
  }

  const TABS: { k: Spine; label: string }[] = [
    { k: 'journey', label: 'Journey' },
    { k: 'signature', label: world.signature },
    { k: 'arena', label: 'Arena' },
    { k: 'badges', label: 'Badges' },
    { k: 'profile', label: 'Profile' },
  ]

  return (
    <div className="le-world">
      {cinematic}
      <div className="le-world-head">
        <button className="le-back" onClick={() => go({ tab: 'learn' })} aria-label="Back to worlds" title="Back to worlds">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="le-world-buddy"><Buddy mood={ring >= 50 ? 'happy' : 'idle'} size={56} color={world.color} accessory={accessoryFor(costume)} /></div>
        <div className="le-world-meta">
          <h1>{world.name}</h1>
          <p style={{ color: world.color }}>{world.vibe}</p>
        </div>
        <Ring pct={ring} color={world.color} />
      </div>

      <div className="le-spine">
        {TABS.map(t => (
          <button key={t.k} className={`le-spine-tab${spine === t.k ? ' on' : ''}`}
            style={spine === t.k ? { color: world.color, borderBottomColor: world.color } : undefined}
            onClick={() => setSpine(t.k)}>{t.label}</button>
        ))}
      </div>

      <div className="le-world-body">
        {spine === 'journey' && (
          <Journey world={world} launch={launch} currentKey={currentKey} costume={costume} />
        )}

        {spine === 'signature' && (
          world.key === 'LOG'
            ? <CinematicLauncher />
            : <div className="le-sig">
                <div className="le-sig-card" style={{ borderColor: `${world.color}55` }}>
                  <h3 style={{ color: world.color }}>{world.signature}</h3>
                  <p>This is {world.name}'s signature play. Jump into a quick mixed drill across every skill.</p>
                  <button className="le-check" style={{ background: world.color }}
                    onClick={() => launch({ key: 'sig-drill', title: `${world.signature} drill`, type: 'practice', skills: world.skills.map(s => s.key), itemCount: 6, rewardDiamonds: 8 })}>
                    ⚡ Quick drill
                  </button>
                </div>
              </div>
        )}

        {spine === 'arena' && (
          <div className="le-soon">
            <div className="le-soon-art">⚔️</div>
            <h3>Arena</h3>
            <p>Challenge friends to live duels and team battles. Coming soon!</p>
          </div>
        )}

        {spine === 'badges' && (
          <div className="le-badges">
            {world.badges.map(b => {
              const got = earned.has(b.key)
              return (
                <div key={b.key} className={`le-badge${got ? ' got' : ''}`} style={got ? { borderColor: world.color } : undefined}>
                  <div className="le-badge-ic" style={{ filter: got ? 'none' : 'grayscale(1)', opacity: got ? 1 : 0.4 }}>{b.icon}</div>
                  <b>{b.name}</b>
                  <small>{got ? 'Earned!' : 'Locked'}</small>
                </div>
              )
            })}
          </div>
        )}

        {spine === 'profile' && (
          <div className="le-wprofile">
            <div className="le-wprofile-ring"><Ring pct={ring} color={world.color} size={92} /></div>
            <div className="le-skills">
              {world.skills.map(s => {
                const m = Math.round(getMastery(world.key, s.key) * 100)
                return (
                  <div key={s.key} className="le-skill">
                    <div className="le-skill-top"><span>{s.label}</span><span style={{ color: world.color }}>{m}%</span></div>
                    <div className="le-skill-bar"><i style={{ width: `${m}%`, background: world.color }} /></div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
