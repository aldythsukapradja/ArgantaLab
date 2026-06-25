import { useEffect, useState } from 'react'
import type { World, JourneyNode, Badge } from '@/data/learn'
import { STAGES, STAGE_META } from '@/data/learn'
import { useAppStore } from '@store/appStore'
import { getMastery } from '@lib/adaptive'
import { nodeState, nodeUnlocked, setNodeDone, nodeDoneToday, earnedBadges } from '@lib/learnProgress'
import { todayWorldXp, ringPct } from '@lib/dailyRings'
import { myMounts } from '@lib/mounts'
import AvatarSprite from '@components/openworld/AvatarSprite'
import ItemPlayer from './ItemPlayer'
import DrillPlayer from './DrillPlayer'
import Buddy from '@components/avatar/Buddy'
import BadgeCinematic from './BadgeCinematic'
import CinematicLauncher from './CinematicLauncher'
import Journey from './Journey'
import { DRILLS_BY_WORLD, type Drill } from '@/data/drills'
import { pushLearnState } from '@lib/learnCloud'
import { bumpQuest } from '@lib/quests'
import { earnDiamonds } from '@lib/wallet'
import { sectionDoneToday } from '@lib/sectionDaily'
import { KIN } from '@/data/openworld'
import KinSprite from '@components/openworld/KinSprite'
import OpenworldPlayer from '@components/openworld/OpenworldPlayer'
import CoopBattle from '@components/openworld/CoopBattle'
import Argantaland from '@components/openworld/Argantaland'

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
  const { requireAuth, addToast, resolvedOutfit, session, go, stageKey, setStage, isKidMode, xp, pendingCoop } = useAppStore()
  const outfit = resolvedOutfit()
  const stage = STAGES.find(s => s.key === stageKey)
  const stageMeta = STAGE_META[stageKey]
  const adult = !isKidMode()
  const uid = session && session !== 'loading' ? session.user.id : null
  const [spine, setSpine] = useState<Spine>('journey')
  const [active, setActive] = useState<JourneyNode | null>(null)
  const [activeDrill, setActiveDrill] = useState<Drill | null>(null)
  const [battleKin, setBattleKin] = useState<string | null>(null)
  const [coopView, setCoopView] = useState(false)
  const [landView, setLandView] = useState(false)
  const [coopJoinSid, setCoopJoinSid] = useState<string | undefined>(undefined)

  // A Home co-op invite routed here → open the co-op screen and auto-join it.
  useEffect(() => {
    if (pendingCoop && pendingCoop.world === world.key) {
      setCoopJoinSid(pendingCoop.sessionId); setCoopView(true)
      useAppStore.setState({ pendingCoop: null })
    }
  }, [pendingCoop, world.key])
  const [badgeQueue, setBadgeQueue] = useState<Badge[]>([])
  const [, force] = useState(0)
  // DAILY world ring (today's XP in this world, resets at local midnight) —
  // reloads whenever the kid earns XP so it fills live as they play.
  const [todayXp, setTodayXp] = useState<Record<string, number>>({})
  useEffect(() => { let on = true; todayWorldXp().then(x => { if (on) setTodayXp(x) }); return () => { on = false } }, [xp])
  const ring = ringPct(todayXp[world.key] ?? 0)
  // The kid's equipped mount rides along in the world header (cosmetic).
  const [equippedMount, setEquippedMount] = useState<string | undefined>(undefined)
  useEffect(() => { myMounts().then(m => setEquippedMount(m.equipped ?? undefined)) }, [])
  const flat = world.units.flatMap(u => u.nodes)
  const earned = earnedBadges(world)

  // the current node = first unlocked node not yet done TODAY (gets the START
  // bubble). Because "done" resets daily, the pin walks the journey again each
  // day — so there's always a fresh node to play.
  const currentKey = flat.find((n, i) => nodeUnlocked(world, i) && !nodeDoneToday(world.key, n.key))?.key

  const cinematic = badgeQueue[0]
    ? <BadgeCinematic key={badgeQueue[0].key} name={badgeQueue[0].name} icon={badgeQueue[0].icon}
        color={world.color} outfit={outfit}
        onDone={() => setBadgeQueue(q => q.slice(1))} />
    : null

  const launch = (node: JourneyNode) => {
    if (!requireAuth('to start learning')) return
    setActive(node)
  }

  const launchDrill = (drill: Drill) => {
    if (!requireAuth('to start a drill')) return
    setActiveDrill(drill)
  }

  const complete = (node: JourneyNode, stars: number) => {
    // Reward once per LOCAL DAY per node — so replaying tomorrow pays again
    // (server-capped), but spamming the same node today doesn't. Unlock state is
    // permanent, so progression is never lost.
    const earnedToday = nodeDoneToday(world.key, node.key)
    setNodeDone(world.key, node.key, stars)
    bumpQuest(node.type === 'boss' ? 'boss' : 'node')
    if (!earnedToday) {
      earnDiamonds(node.rewardDiamonds, 'journey', `journey:${world.key}:${node.key}`)
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

  if (activeDrill) {
    return (
      <div className="le-world">
        {cinematic}
        <DrillPlayer world={world} drill={activeDrill}
          onExit={() => { setActiveDrill(null); if (uid) pushLearnState(uid); force(n => n + 1) }} />
      </div>
    )
  }

  if (battleKin) {
    return (
      <div className="le-world">
        {cinematic}
        <OpenworldPlayer world={world} kinId={battleKin}
          onExit={() => { setBattleKin(null); if (uid) pushLearnState(uid); force(n => n + 1) }} />
      </div>
    )
  }

  if (coopView) {
    return (
      <div className="le-world">
        {cinematic}
        <CoopBattle world={world} joinSessionId={coopJoinSid} onExit={() => { setCoopView(false); setCoopJoinSid(undefined); if (uid) pushLearnState(uid); force(n => n + 1) }} />
      </div>
    )
  }

  if (landView) {
    return (
      <div className="le-world">
        {cinematic}
        <Argantaland world={world} onExit={() => { setLandView(false); if (uid) pushLearnState(uid); force(n => n + 1) }} />
      </div>
    )
  }

  const TABS: { k: Spine; label: string }[] = [
    { k: 'journey', label: 'Journey' },
    { k: 'signature', label: world.signature },
    { k: 'arena', label: 'Openworld' },
    { k: 'badges', label: 'Badges' },
    { k: 'profile', label: 'Profile' },
  ]

  // A nudge dot on each playable sub-tab until that section is done TODAY:
  // Journey = a node still left to play; Drills/Openworld = no round done today.
  const tabDot: Partial<Record<Spine, boolean>> = {
    journey: !!currentKey,
    signature: !sectionDoneToday(world.key, 'drills'),
    arena: !sectionDoneToday(world.key, 'openworld'),
  }

  // Wild kin you can hunt + befriend in this world's Openworld.
  const wildKin = KIN.filter(k => k.world === world.key.toLowerCase())

  return (
    <div className="le-world">
      {cinematic}
      <div className="le-world-head">
        <button className="le-back" onClick={() => go({ tab: 'learn' })} aria-label="Back to worlds" title="Back to worlds">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="le-world-buddy" onClick={() => go({ tab: 'mounts' })} title={equippedMount ? 'On your mount — tap for the Mount Stable' : 'Tap to visit the Mount Stable'} style={{ cursor: 'pointer' }}>
          {equippedMount
            ? <AvatarSprite mood={ring >= 50 ? 'happy' : 'idle'} size={64} mount={equippedMount} />
            : <Buddy mood={ring >= 50 ? 'happy' : 'idle'} size={56} color={world.color} outfit={outfit} />}
        </div>
        <div className="le-world-meta">
          <h1>{world.name}</h1>
          <p style={{ color: world.color }}>{world.vibe}</p>
          {adult ? (
            <select className="le-stage-pick" value={stageKey} onChange={e => setStage(e.target.value)}
              title="Preview content for an age band"
              style={{ background: `${stageMeta.color}1f`, color: stageMeta.color, border: 'none', borderRadius: 999, padding: '4px 10px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              {STAGES.map(s => <option key={s.key} value={s.key} style={{ color: '#111' }}>{STAGE_META[s.key].emoji} {s.label} · ages {s.minAge}–{s.maxAge}</option>)}
            </select>
          ) : (
            stage && stageMeta && <span className="le-stage-pill" style={{ background: `${stageMeta.color}1f`, color: stageMeta.color }}>{stageMeta.emoji} {stage.label} · ages {stage.minAge}–{stage.maxAge}</span>
          )}
        </div>
        <Ring pct={ring} color={world.color} />
      </div>

      <div className="le-spine">
        {TABS.map(t => (
          <button key={t.k} className={`le-spine-tab${spine === t.k ? ' on' : ''}`}
            style={spine === t.k ? { color: world.color, borderBottomColor: world.color } : undefined}
            onClick={() => setSpine(t.k)}>
            {t.label}
            {tabDot[t.k] && <span className="le-spine-dot" style={{ background: world.color }} aria-label="not done today" />}
          </button>
        ))}
      </div>

      <div className="le-world-body">
        {spine === 'journey' && (
          <Journey world={world} launch={launch} currentKey={currentKey} outfit={outfit} />
        )}

        {spine === 'signature' && (
          <div className="le-sig">
            {world.key === 'LOG' && <CinematicLauncher />}
            <div className="dr-gallery-head">
              <h3 style={{ color: world.color }}>⚡ {world.name} Drills</h3>
              <p>Short, repeatable rounds to sharpen one skill. New questions every time.</p>
            </div>
            <div className="dr-gallery">
              {(DRILLS_BY_WORLD[world.key] ?? []).map(d => (
                <button key={d.key} className="dr-card" style={{ borderColor: `${world.color}33` }} onClick={() => launchDrill(d)}>
                  <div className="dr-card-ic" style={{ background: `${world.color}1a`, color: world.color }}>{d.emoji}</div>
                  <div className="dr-card-body">
                    <b>{d.title}</b>
                    <small>{d.blurb}</small>
                    <div className="dr-card-rew">
                      <span className="dr-chip" style={{ color: world.color }}>+{d.xp} XP</span>
                      <span className="dr-chip">+{d.diamonds} 💎</span>
                    </div>
                  </div>
                  <span className="dr-card-go" style={{ color: world.color }}>▶</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {spine === 'arena' && (
          <div className="le-sig">
            <div className="dr-gallery-head">
              <h3 style={{ color: world.color }}>🗺️ {world.name} Openworld</h3>
              <p>Explore and battle wild kin. Answer to power your abilities, weaken a kin, then befriend it — it comes to live in your <b>Nexus</b>.</p>
            </div>
            <button className="ow-land-btn" onClick={() => { if (requireAuth('to explore')) setLandView(true) }}
              style={{ borderColor: world.color }}>
              <span className="ow-land-ic" style={{ background: `${world.color}22`, color: world.color }}>🗺️</span>
              <span className="ow-land-txt"><b style={{ color: world.color }}>Enter ArgantaLand</b><small>Walk the {world.name} map &amp; meet wild kin</small></span>
              <span className="ow-land-go" style={{ color: world.color }}>▶</span>
            </button>
            <button className="ow-coop-toggle" onClick={() => { if (requireAuth('to play co-op')) setCoopView(true) }}
              style={{ borderColor: world.color, color: world.color, marginTop: 8 }}>
              <span>👫 Co-op</span>
              <b>Play with a circle friend →</b>
            </button>
            <div className="ow-lobby">
              {wildKin.map(k => (
                <button key={k.id} className="ow-kincard" style={{ borderColor: `${k.color}44` }}
                  onClick={() => { if (requireAuth('to enter the Openworld')) setBattleKin(k.id) }}>
                  <span className="ow-kincard-art"><KinSprite kin={k.id} size={72} /></span>
                  <div className="ow-kincard-body">
                    <b>{k.name}</b>
                    <small>{k.blurb}</small>
                    <div className="ow-kincard-tags">
                      <span className="ow-rarity" style={{ background: `${k.color}22`, color: k.color }}>{k.rarity}</span>
                      <span className="dr-chip">❤️ {k.baseHp}</span>
                      <span className="dr-chip" style={{ color: k.color }}>weak: {k.element}</span>
                    </div>
                  </div>
                  <span className="dr-card-go" style={{ color: k.color }}>⚔️</span>
                </button>
              ))}
              {wildKin.length === 0 && <p className="ph-sub">More kin are migrating to {world.name} soon…</p>}
            </div>
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
