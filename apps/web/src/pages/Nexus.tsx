// ============================================================
//  ARGANTALAB · NEXUS  (the shared town — its own Play tab)
//  The Nexus is ONE Harvest-Moon style town shared across the whole circle.
//  Kin you befriend in a world's Openworld come to live here, in six
//  color-coded habitats, where they roam, grow, breed, and help harvest
//  diamonds. This reads the REAL cloud roster (person_creatures) — befriended
//  kin show solid + cared-for; the rest of each world's catalog shows as faded
//  "wild" silhouettes you can go find. Care (feed/pet) is server-authoritative
//  via RPC, on a gentle cooldown — happiness always traces to a child showing up.
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { KIN, kin as kinDef, type KinDef } from '@/data/openworld'
import { nexusRoster, careKin, nexusHarvest, type KinInstance, type HarvestState } from '@lib/nexus'
import { myMounts } from '@lib/mounts'
import { DRILLS_BY_WORLD, type DrillItem } from '@/data/drills'
import type { Item } from '@/data/learn'
import { renderItem } from '@components/learn2/interactions'
import { recordAttempt } from '@lib/adaptive'
import { logLearnEvent } from '@lib/analytics'
import KinSprite from '@components/openworld/KinSprite'
import AvatarSprite from '@components/openworld/AvatarSprite'

// The harvest is GATED behind a learning task — diamonds are never free. We draw
// one real question (mcq/type, the renderItem-native kinds) from the worlds the
// kid actually keeps kin in, so the rep is thematically tied to their town. Falls
// back to all worlds if the roster is empty. Returns null only if no drills exist.
function drawHarvestQuestion(roster: KinInstance[]): DrillItem | null {
  const worlds = roster.length
    ? [...new Set(roster.map(r => (r.world_key ?? '').toUpperCase()).filter(Boolean))]
    : Object.keys(DRILLS_BY_WORLD)
  const pool = worlds
    .flatMap(w => DRILLS_BY_WORLD[w] ?? [])
    .flatMap(d => d.gen())
    .filter(it => it.type === 'mcq' || it.type === 'type')
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null
}

// The six Nexus habitats (one per world), color-coded. Data-light on purpose.
const HABITATS: { key: string; name: string; world: string; color: string; emoji: string }[] = [
  { key: 'dunes',    name: 'Sunny Dunes',    world: 'num', color: '#f59e0b', emoji: '🏜️' },
  { key: 'grove',    name: 'Whisper Grove',  world: 'wrd', color: '#3b82f6', emoji: '🌳' },
  { key: 'meadow',   name: 'Mood Meadow',    world: 'lif', color: '#ec4899', emoji: '🌸' },
  { key: 'lagoon',   name: 'Tide Lagoon',    world: 'wld', color: '#f97316', emoji: '🐚' },
  { key: 'skyfield', name: 'Cloud Skyfield', world: 'won', color: '#8b5cf6', emoji: '☁️' },
  { key: 'circuit',  name: 'Neon Circuit',   world: 'log', color: '#22c55e', emoji: '🔌' },
]

// Castle grows on whole-circle progress (placeholder until castle_state lands).
const CASTLE_STAGES = ['Fort', 'Village', 'Town', 'City', 'Kingdom']
const GROWTH_EMOJI: Record<string, string> = { baby: '🥚', teen: '🌱', adult: '⭐' }

export default function Nexus() {
  const { go, session, addToast } = useAppStore()
  const [active, setActive] = useState<KinDef | null>(null)
  const [roster, setRoster] = useState<KinInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [harvest, setHarvest] = useState<HarvestState | null>(null)
  const [collecting, setCollecting] = useState(false)
  const [task, setTask] = useState<DrillItem | null>(null)   // the harvest-gate question
  const [equippedMount, setEquippedMount] = useState<string | undefined>(undefined)
  useEffect(() => { myMounts().then(m => setEquippedMount(m.equipped ?? undefined)) }, [session])
  const taskShownAt = useRef(Date.now())

  // Load the real befriended-kin roster + diamond trickle whenever the session changes.
  useEffect(() => {
    let alive = true
    setLoading(true)
    nexusRoster().then(r => { if (alive) { setRoster(r); setLoading(false) } })
    nexusHarvest(false).then(h => { if (alive && h) setHarvest(h) }) // peek, never mutates
    return () => { alive = false }
  }, [session])

  const total = roster.length
  // The castle stage scales (gently) with how many kin you've befriended.
  const stage = CASTLE_STAGES[Math.min(CASTLE_STAGES.length - 1, Math.floor(total / 3))]

  const care = async (inst: KinInstance, action: 'feed' | 'pet') => {
    setBusyId(inst.id)
    const { kin: updated, cooled } = await careKin(inst.id, action)
    setBusyId(null)
    if (updated) setRoster(rs => rs.map(r => r.id === updated.id ? updated : r))
    if (cooled) addToast('Already happy — come back later 💛', '😴')
    else if (updated) {
      addToast(`${kinDef(updated.kin_key)?.name ?? 'Your kin'} feels loved!`, action === 'feed' ? '🍎' : '💛')
      nexusHarvest(false).then(h => { if (h) setHarvest(h) }) // happier kin → faster trickle
    }
  }

  // Harvest is GATED behind one learning task — gems are never free. Tapping
  // Collect opens a question; only a correct answer unlocks the mint.
  const startHarvest = () => {
    const q = drawHarvestQuestion(roster)
    if (!q) { collect(); return }          // no drills available → graceful direct collect
    taskShownAt.current = Date.now()
    setTask(q)
  }

  // The gate's answer. Wrong = no penalty (kid-kind), just answer one correctly to
  // unlock; right = mint. Either way it logs a real learning rep (telemetry/mastery).
  const onHarvestAnswer = async (correct: boolean) => {
    if (!task) return
    recordAttempt(task.world, task.skill, correct)
    logLearnEvent(task as Item, correct, Date.now() - taskShownAt.current)
    if (!correct) {
      addToast('Not quite — one more to unlock the harvest! 🌱', '🤔')
      taskShownAt.current = Date.now()
      setTask(drawHarvestQuestion(roster))  // retry with a fresh question
      return
    }
    setTask(null)
    await collect()
  }

  // Mint the whole diamonds the town has trickled out. Server-authoritative: it
  // mints into the cloud wallet (ledger truth) and hands back balance + remainder.
  const collect = async () => {
    setCollecting(true)
    const h = await nexusHarvest(true)
    setCollecting(false)
    if (!h) return
    setHarvest(h)
    if (h.minted > 0) {
      useAppStore.setState({ diamonds: h.balance }) // reconcile to server truth
      addToast(`Harvested ${h.minted} 💎 from your town!`, '💎')
    } else {
      addToast('Not ripe yet — let your kin trickle a little longer 🌱', '⏳')
    }
  }
  const readyToCollect = harvest ? Math.floor(harvest.pending) : 0

  return (
    <div className="screen nexus" style={{ justifyContent: 'flex-start', gap: 18, paddingTop: 6 }}>
      {/* Header — castle stage + the player riding in */}
      <div className="nx-head">
        <div>
          <div className="kicker"><span className="live" />&nbsp;Nexus</div>
          <h1 className="h-title" style={{ marginTop: 8 }}>Your <span className="g">town</span></h1>
          <p className="ph-sub" style={{ marginTop: 4 }}>
            {total > 0
              ? <>You've befriended <b>{total}</b> kin — care for them, and they help your <b>{stage}</b> grow.</>
              : <>Befriend kin in each world's Openworld and they'll come live here, helping your <b>{stage}</b> grow.</>}
          </p>
        </div>
        <div className="nx-rider" title={equippedMount ? "That's you on your mount!" : 'That’s you — get a mount in the Stable'}>
          <AvatarSprite mood="wave" size={120} mount={equippedMount} />
          <button className="nx-mount-btn" onClick={() => go({ tab: 'mounts' })}>🐎 Mount Stable</button>
        </div>
      </div>

      {/* Castle progress band */}
      <div className="nx-castle">
        {CASTLE_STAGES.map((s, i) => (
          <div key={s} className={`nx-stage${CASTLE_STAGES.indexOf(stage) >= i ? ' on' : ''}`}>
            <span className="nx-stage-dot" />{s}
          </div>
        ))}
      </div>

      {/* Harvest band — the town's gentle diamond trickle */}
      {harvest && total > 0 && (
        <div className="nx-harvest">
          <div className="nx-harvest-info">
            <b>🌾 Diamond Harvest</b>
            <span className="ph-sub" style={{ fontSize: 12 }}>
              Your kin produce <b>{harvest.ratePerDay.toFixed(2)} 💎/day</b>
              {' · '}<b>{harvest.pending.toFixed(2)} 💎</b> banked
              {' · '}rarer + happier kin earn more
            </span>
          </div>
          <button
            className="btn btn-primary nx-harvest-btn"
            disabled={collecting || readyToCollect < 1}
            onClick={startHarvest}
          >
            {readyToCollect >= 1 ? `Collect ${readyToCollect} 💎` : 'Trickling… 🌱'}
          </button>
        </div>
      )}

      {/* Habitats */}
      <div className="nx-habs">
        {HABITATS.map(h => {
          const residents = roster.filter(r => r.world_key === h.world)
          // Catalog kin from this world you haven't befriended yet → faded "wild".
          const befriendedKeys = new Set(residents.map(r => r.kin_key))
          const wild = KIN.filter(k => k.world === h.world && !befriendedKeys.has(k.id))
          return (
            <div key={h.key} className="nx-hab" style={{ borderColor: `${h.color}44`, background: `${h.color}10` }}>
              <div className="nx-hab-top">
                <b style={{ color: h.color }}>{h.emoji} {h.name}</b>
                <span className="nx-hab-count">{residents.length} living</span>
              </div>

              {/* Befriended residents — solid, cared-for */}
              {residents.length > 0 && (
                <div className="nx-res-row">
                  {residents.map(inst => {
                    const d = kinDef(inst.kin_key)
                    return (
                      <div key={inst.id} className="nx-res" style={{ borderColor: `${h.color}55` }}>
                        <span className="nx-res-art">
                          <KinSprite kin={inst.kin_key} size={58} bob />
                          {inst.count > 1 && <span className="nx-res-count" style={{ background: h.color }}>×{inst.count}</span>}
                        </span>
                        <b className="nx-res-name">{inst.nickname || d?.name || 'Kin'}</b>
                        <span className="nx-res-stage">{GROWTH_EMOJI[inst.growth]} {inst.growth}</span>
                        <div className="nx-res-happy" title={`${inst.happiness}% happy`}>
                          <i style={{ width: `${inst.happiness}%`, background: h.color }} />
                        </div>
                        <div className="nx-care">
                          <button disabled={busyId === inst.id} onClick={() => care(inst, 'feed')}>🍎 Feed</button>
                          <button disabled={busyId === inst.id} onClick={() => care(inst, 'pet')}>💛 Pet</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Wild kin still out there — faded discovery prompts */}
              {wild.length > 0 && (
                <div className="nx-hab-kin">
                  {wild.map(k => (
                    <button key={k.id} className="nx-kin" onClick={() => setActive(k)} title={`${k.name} — wild`}>
                      <span className="nx-kin-art" style={{ opacity: 0.4, filter: 'grayscale(0.6)' }}>
                        <KinSprite kin={k.id} size={56} />
                      </span>
                      <small>{k.name}</small>
                    </button>
                  ))}
                </div>
              )}

              {residents.length === 0 && wild.length === 0 && !loading && (
                <p className="ph-sub" style={{ fontSize: 12 }}>More kin migrating here soon…</p>
              )}

              <button className="nx-hab-go" style={{ color: h.color }} onClick={() => go({ tab: h.world })}>
                Explore {h.name.split(' ')[0]} → befriend kin
              </button>
            </div>
          )
        })}
      </div>

      {/* Harvest task — answer one question to unlock the diamonds (never free) */}
      {task && (
        <div className="nx-drawer-wrap" onClick={() => setTask(null)}>
          <div className="nx-task" onClick={e => e.stopPropagation()}>
            <button className="nx-drawer-x" onClick={() => setTask(null)} aria-label="Close">×</button>
            <div className="nx-task-head">
              <b>🌾 Harvest Task</b>
              <span className="ph-sub" style={{ fontSize: 12 }}>Answer to collect <b>{readyToCollect} 💎</b> from your town</span>
            </div>
            <div className="le-prompt" style={{ marginTop: 4 }}>{task.prompt}</div>
            <div key={task.id} className="le-render">
              {renderItem(task as Item, onHarvestAnswer)}
            </div>
          </div>
        </div>
      )}

      {/* Wild-kin detail drawer */}
      {active && (
        <div className="nx-drawer-wrap" onClick={() => setActive(null)}>
          <div className="nx-drawer" onClick={e => e.stopPropagation()} style={{ borderColor: `${active.color}66` }}>
            <button className="nx-drawer-x" onClick={() => setActive(null)} aria-label="Close">×</button>
            <KinSprite kin={active.id} size={120} bob />
            <h3 style={{ margin: '6px 0 2px' }}>{active.name}</h3>
            <span className="nx-rarity" style={{ background: `${active.color}22`, color: active.color }}>{active.rarity}</span>
            <p className="ph-sub" style={{ marginTop: 8, textAlign: 'center' }}>{active.blurb}</p>
            <div className="nx-stats">
              <span>❤️ {active.baseHp} HP</span>
              <span>🎯 {active.element}</span>
              <span>⚡ {active.gimmick === 'none' ? 'gentle' : active.gimmick}</span>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={() => { go({ tab: active.world }); setActive(null) }}>
              Find {active.name} in the wild →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
