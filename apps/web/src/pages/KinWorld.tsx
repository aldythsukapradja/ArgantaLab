// ============================================================
//  ARGANTALAB · KINWORLD  (the living hub — its own Play tab)
//  The map is a Phaser pixel-dungeon (KinWorldGame): a keep ringed by guardian
//  kin, six themed gates in the walls, and a movable hero. Walking a gate drops
//  into that world's Argantaland dungeon; tapping the keep opens the Town Hall
//  (Kindex + Collect), which stays a React overlay. Care + harvest are
//  server-authoritative.
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '@store/appStore'
import { KIN, kin as kinDef, type KinDef } from '@/data/openworld'
import { nexusRoster, careKin, nexusHarvest, type KinInstance, type HarvestState } from '@lib/nexus'
import { bumpQuest } from '@lib/quests'
import { DRILLS_BY_WORLD, type DrillItem } from '@/data/drills'
import type { Item } from '@/data/learn'
import { renderItem } from '@components/learn2/interactions'
import { recordAttempt } from '@lib/adaptive'
import { logLearnEvent } from '@lib/analytics'
import KinSprite from '@components/openworld/KinSprite'
import KinWorldGame from '@components/openworld/KinWorldGame'

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

const WORLDS: { key: string; name: string; world: string; color: string; emoji: string }[] = [
  { key: 'dunes',    name: 'Numeria Dunes',   world: 'num', color: '#f59e0b', emoji: '☀️' },
  { key: 'grove',    name: 'Wordveil Grove',  world: 'wrd', color: '#3b82f6', emoji: '📖' },
  { key: 'meadow',   name: 'Mood Meadow',     world: 'lif', color: '#ec4899', emoji: '💗' },
  { key: 'lagoon',   name: 'World Lagoon',    world: 'wld', color: '#f97316', emoji: '🌊' },
  { key: 'skyfield', name: 'Wonder Skyfield', world: 'won', color: '#8b5cf6', emoji: '✨' },
  { key: 'circuit',  name: 'Circuit Wastes',  world: 'log', color: '#22c55e', emoji: '🔌' },
]

const GROWTH_LABEL: Record<string, string> = { baby: 'baby', teen: 'growing', adult: 'kin' }
const GROWTH_EMOJI: Record<string, string> = { baby: '🥚', teen: '🌱', adult: '⭐' }
const DEX_NO: Record<string, number> = Object.fromEntries(KIN.map((k, i) => [k.id, i + 1]))
const pad = (n: number) => String(n).padStart(3, '0')

export default function KinWorld() {
  const { go, session, addToast, learnerName } = useAppStore()
  const [active, setActive] = useState<KinDef | null>(null)
  const [roster, setRoster] = useState<KinInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [harvest, setHarvest] = useState<HarvestState | null>(null)
  const [collecting, setCollecting] = useState(false)
  const [task, setTask] = useState<DrillItem | null>(null)
  const [hallOpen, setHallOpen] = useState(false)
  const [filter, setFilter] = useState('all')
  const taskShownAt = useRef(Date.now())

  useEffect(() => {
    let alive = true
    setLoading(true)
    nexusRoster().then(r => { if (alive) { setRoster(r); setLoading(false) } })
    nexusHarvest(false).then(h => { if (alive && h) setHarvest(h) })
    return () => { alive = false }
  }, [session])

  const caughtCount = new Set(roster.map(r => r.kin_key)).size
  // central building matures with how many kin are befriended (Class→Town→City→Kingdom)
  const stage = Math.min(3, Math.floor(caughtCount / 4))

  // Walk through a gate → drop into that world's Argantaland dungeon (enterLand).
  const enterDungeon = (world: string) => {
    useAppStore.setState({ enterLand: world.toUpperCase() })
    go({ tab: world })
  }

  const care = async (inst: KinInstance, action: 'feed' | 'pet') => {
    setBusyId(inst.id)
    const { kin: updated, cooled } = await careKin(inst.id, action)
    setBusyId(null)
    if (updated) setRoster(rs => rs.map(r => r.id === updated.id ? updated : r))
    if (cooled) addToast('Already happy — come back later 💛', '😴')
    else if (updated) {
      addToast(`${kinDef(updated.kin_key)?.name ?? 'Your kin'} feels loved!`, action === 'feed' ? '🍎' : '💛')
      nexusHarvest(false).then(h => { if (h) setHarvest(h) })
    }
  }

  const startHarvest = () => {
    const q = drawHarvestQuestion(roster)
    if (!q) { collect(); return }
    taskShownAt.current = Date.now()
    setTask(q)
  }

  const onHarvestAnswer = async (correct: boolean) => {
    if (!task) return
    recordAttempt(task.world, task.skill, correct)
    logLearnEvent(task as Item, correct, Date.now() - taskShownAt.current)
    if (!correct) {
      addToast('Not quite — one more to unlock the harvest! 🌱', '🤔')
      taskShownAt.current = Date.now()
      setTask(drawHarvestQuestion(roster))
      return
    }
    setTask(null)
    await collect()
  }

  const collect = async () => {
    setCollecting(true)
    const h = await nexusHarvest(true)
    setCollecting(false)
    if (!h) return
    setHarvest(h)
    if (h.minted > 0) {
      useAppStore.setState({ diamonds: h.balance })
      bumpQuest('harvest')
      addToast(`Harvested ${h.minted} 💎 from your town!`, '💎')
    } else {
      addToast('Not ripe yet — let your kin trickle a little longer 🌱', '⏳')
    }
  }
  const readyToCollect = harvest ? Math.floor(harvest.pending) : 0
  const dexWorlds = filter === 'all' ? WORLDS : WORLDS.filter(w => w.key === filter)

  return (
    <div className="screen kinworld kw-full">
      <KinWorldGame roster={roster} stage={stage} onEnterDungeon={enterDungeon} onOpenHall={() => setHallOpen(true)} />

      {/* ── Town Hall: harvest Collect + Kindex, opened from the keep ── */}
      {hallOpen && createPortal(
        <div className="dex-wrap" onClick={() => setHallOpen(false)}>
          <div className="dex-panel" onClick={e => e.stopPropagation()}>
            <div className="dex-head">
              <div>
                <div className="kicker">🏰 Town Hall</div>
                <h2 className="dex-title">{caughtCount} of {KIN.length} kin befriended</h2>
              </div>
              <button className="dex-x" onClick={() => setHallOpen(false)} aria-label="Close">✕</button>
            </div>

            <div className="hall-actions">
              <div className="hall-harvest">
                <div>
                  <b>🌾 Diamond Harvest</b>
                  <span className="ph-sub" style={{ fontSize: 12, display: 'block' }}>
                    {harvest ? `${harvest.ratePerDay.toFixed(2)} 💎/day · ${harvest.pending.toFixed(2)} banked` : 'Befriend kin to start the trickle'}
                  </span>
                </div>
                <button className="btn btn-primary" disabled={collecting || readyToCollect < 1} onClick={startHarvest}>
                  {readyToCollect >= 1 ? `Collect ${readyToCollect} 💎` : 'Trickling… 🌱'}
                </button>
              </div>
              <button className="nx-mount-btn hall-mount" onClick={() => go({ tab: 'mounts' })}>🐎 Mount Stable</button>
            </div>

            <div className="dex-pills">
              <button className={`dex-pill${filter === 'all' ? ' on' : ''}`} onClick={() => setFilter('all')}>All</button>
              {WORLDS.map(w => (
                <button key={w.key} className={`dex-pill${filter === w.key ? ' on' : ''}`}
                  style={filter === w.key ? { background: w.color, borderColor: w.color, color: '#fff' } : undefined}
                  onClick={() => setFilter(w.key)}>{w.name}</button>
              ))}
            </div>

            <div className="dex-scroll">
              {dexWorlds.map(w => {
                const all = KIN.filter(k => k.world === w.world)
                const mine = roster.filter(r => r.world_key === w.world)
                const byKey = new Map(mine.map(m => [m.kin_key, m]))
                return (
                  <div key={w.key} className="dex-section">
                    <div className="dex-section-head" style={{ color: w.color }}>
                      <b>{w.emoji} {w.name}</b>
                      <button className="dex-go" style={{ color: w.color, borderColor: `${w.color}66` }}
                        onClick={() => { setHallOpen(false); enterDungeon(w.world) }}>Go to dungeon →</button>
                    </div>
                    <div className="dex-grid">
                      {all.map(k => {
                        const inst = byKey.get(k.id)
                        const no = DEX_NO[k.id] ?? 0
                        if (inst) return (
                          <div key={k.id} className="dex-card" style={{ borderColor: `${w.color}55` }}>
                            <span className="dex-no">#{pad(no)}</span>
                            <span className="dex-art">
                              <KinSprite kin={k.id} size={62} bob />
                              {inst.count > 1 && <span className="dex-mult" style={{ background: w.color }}>×{inst.count}</span>}
                            </span>
                            <b className="dex-name">{inst.nickname || k.name}</b>
                            <span className="dex-stage">{GROWTH_EMOJI[inst.growth]} {GROWTH_LABEL[inst.growth] ?? inst.growth} · {k.rarity}</span>
                            <div className="dex-happy" title={`${inst.happiness}% happy`}><i style={{ width: `${inst.happiness}%`, background: w.color }} /></div>
                            <div className="dex-care">
                              <button disabled={busyId === inst.id} onClick={() => care(inst, 'feed')}>🍎 Feed</button>
                              <button disabled={busyId === inst.id} onClick={() => care(inst, 'pet')}>💛 Pet</button>
                            </div>
                          </div>
                        )
                        return (
                          <button key={k.id} className="dex-card wild" onClick={() => { setHallOpen(false); enterDungeon(w.world) }} title={`${k.name} — find it in the ${w.name} dungeon`}>
                            <span className="dex-no">#{pad(no)}</span>
                            <span className="dex-art" style={{ opacity: 0.32, filter: 'grayscale(1)' }}>
                              <KinSprite kin={k.id} size={62} />
                            </span>
                            <b className="dex-name dex-name-wild">{k.name}</b>
                            <span className="dex-stage">{k.rarity} · wild</span>
                            <span className="dex-find" style={{ color: w.color }}>Find →</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {!loading && caughtCount === 0 && filter === 'all' && (
                <p className="ph-sub" style={{ fontSize: 12.5, textAlign: 'center', padding: '8px 0' }}>
                  No kin yet — walk to a gate{learnerName ? `, ${learnerName}` : ''}, win a friendly battle, and they'll move in.
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Harvest task — answer one question to unlock the diamonds (never free) */}
      {task && createPortal(
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
        </div>,
        document.body
      )}

      {/* Wild-kin detail drawer */}
      {active && createPortal(
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
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={() => { enterDungeon(active.world); setActive(null) }}>
              Find {active.name} in the wild →
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
