// ============================================================
//  ARGANTALAB · KINWORLD  (the living town — its own Play tab)
//  A full-bleed top-down tiled world. Befriended kin WALK the dirt road grid
//  (turning at intersections), and the town grows silently from a small fort
//  into a sprawling kingdom as the circle befriends more kin. The player rides
//  in the centre of the castle, which is the hub: tap it for the Town Hall,
//  where the diamond-harvest Collect and the Kindex (Pokédex) both live.
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  { key: 'dunes',    name: 'Sunny Dunes',    world: 'num', color: '#f59e0b', emoji: '🏜️' },
  { key: 'grove',    name: 'Whisper Grove',  world: 'wrd', color: '#3b82f6', emoji: '🌳' },
  { key: 'meadow',   name: 'Mood Meadow',    world: 'lif', color: '#ec4899', emoji: '🌸' },
  { key: 'lagoon',   name: 'Tide Lagoon',    world: 'wld', color: '#f97316', emoji: '🐚' },
  { key: 'skyfield', name: 'Cloud Skyfield', world: 'won', color: '#8b5cf6', emoji: '☁️' },
  { key: 'circuit',  name: 'Neon Circuit',   world: 'log', color: '#22c55e', emoji: '🔌' },
]

const STAGE_COUNT = 4
const STAGE_STEP = 3
const STAGE_FOOTPRINT = [0.5, 0.7, 0.86, 1]
const GROWTH_SCALE: Record<string, number> = { baby: 0.62, teen: 0.82, adult: 1 }
const GROWTH_LABEL: Record<string, string> = { baby: 'baby', teen: 'growing', adult: 'kin' }
const GROWTH_EMOJI: Record<string, string> = { baby: '🥚', teen: '🌱', adult: '⭐' }

const DEX_NO: Record<string, number> = Object.fromEntries(KIN.map((k, i) => [k.id, i + 1]))
const pad = (n: number) => String(n).padStart(3, '0')

// The 8 road-grid loops around the central castle block. Each kin walks the
// perimeter of one cell (orthogonal legs = grid walking). Shared keyframes keep
// the CSS tiny no matter how many kin roam. Coordinates are % of the map.
const CELLS: [number, number, number, number][] = [
  [16, 38, 16, 38], [38, 62, 16, 38], [62, 84, 16, 38],
  [16, 38, 38, 62], /* centre = castle */ [62, 84, 38, 62],
  [16, 38, 62, 84], [38, 62, 62, 84], [62, 84, 62, 84],
]
const LOOP_KF = CELLS.map(([x0, x1, y0, y1], i) =>
  `@keyframes kwloop${i}{0%{left:${x0}%;top:${y0}%}25%{left:${x1}%;top:${y0}%}50%{left:${x1}%;top:${y1}%}75%{left:${x0}%;top:${y1}%}100%{left:${x0}%;top:${y0}%}}`
).join('')
const SCENE_KF = LOOP_KF
  + '@keyframes kwface{0%,49.9%{transform:scaleX(1)}50%,100%{transform:scaleX(-1)}}'
  + '@keyframes kwbob2{from{transform:translateY(0)}to{transform:translateY(-3px)}}'

// Settlement that morphs across the four (unlabelled) stages.
function Settlement({ stage }: { stage: number }) {
  if (stage <= 0) return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" preserveAspectRatio="xMidYMax meet">
      <rect x="78" y="70" width="44" height="60" fill="#8a5a2b" />
      <rect x="86" y="96" width="14" height="34" fill="#5e3c19" />
      <path d="M72 70 L100 44 L128 70 Z" fill="#9a3412" />
      <rect x="58" y="120" width="84" height="10" fill="#6b7280" />
      <path d="M64 120 v-8 h6 v8 M84 120 v-8 h6 v8 M110 120 v-8 h6 v8 M130 120 v-8 h6 v8" fill="#9ca3af" />
    </svg>
  )
  if (stage === 1) return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" preserveAspectRatio="xMidYMax meet">
      <rect x="40" y="92" width="40" height="38" fill="#b4761a" /><path d="M36 92 L60 70 L84 92 Z" fill="#9a3412" />
      <rect x="86" y="78" width="48" height="52" fill="#8a5a2b" /><path d="M82 78 L110 52 L138 78 Z" fill="#7a2c12" /><rect x="102" y="104" width="16" height="26" fill="#5e3c19" />
      <rect x="140" y="96" width="34" height="34" fill="#b4761a" /><path d="M136 96 L157 76 L178 96 Z" fill="#9a3412" />
    </svg>
  )
  if (stage === 2) return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" preserveAspectRatio="xMidYMax meet">
      <rect x="30" y="74" width="34" height="56" fill="#85b7eb" /><rect x="70" y="50" width="40" height="80" fill="#378add" />
      <rect x="116" y="64" width="34" height="66" fill="#85b7eb" /><rect x="156" y="84" width="26" height="46" fill="#378add" />
      <g fill="#e6f1fb"><rect x="78" y="58" width="8" height="8" /><rect x="94" y="58" width="8" height="8" /><rect x="78" y="74" width="8" height="8" /><rect x="94" y="74" width="8" height="8" /><rect x="38" y="84" width="7" height="7" /><rect x="124" y="74" width="7" height="7" /></g>
    </svg>
  )
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" preserveAspectRatio="xMidYMax meet">
      <rect x="34" y="64" width="26" height="66" fill="#9ca3af" /><path d="M34 64 h26 v-10 h-6 v6 h-7 v-6 h-7 v6 h-6 z" fill="#6b7280" />
      <rect x="140" y="64" width="26" height="66" fill="#9ca3af" /><path d="M140 64 h26 v-10 h-6 v6 h-7 v-6 h-7 v6 h-6 z" fill="#6b7280" />
      <rect x="64" y="50" width="72" height="80" fill="#b4b2a9" /><path d="M64 50 h72 v-12 h-9 v7 h-9 v-7 h-9 v7 h-9 v-7 h-9 v7 h-9 v-7 h-9 z" fill="#9ca3af" />
      <path d="M88 130 v-30 a12 12 0 0 1 24 0 v30 z" fill="#3c3489" />
      <path d="M100 22 L100 12 L118 16 L100 20 Z" fill="#e24b4a" />
      <rect x="74" y="64" width="10" height="10" fill="#7f77dd" /><rect x="116" y="64" width="10" height="10" fill="#7f77dd" />
    </svg>
  )
}

// Tiled terrain: grass + water + a permanent dirt road grid, with a central
// kingdom block that grows with the stage.
function Terrain({ stage }: { stage: number }) {
  const f = STAGE_FOOTPRINT[stage] ?? 1
  // road centres at the same 16/38/62/84% grid the kin walk (viewBox 600×440)
  const RX = [96, 228, 372, 504], RY = [70, 167, 273, 370]
  return (
    <svg className="kw-terrain" viewBox="0 0 600 440" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern id="kwgrass" width="34" height="28" patternUnits="userSpaceOnUse">
          <rect width="34" height="28" fill="#8ccf6a" />
          {[[-4, 2], [14, 2], [5, 15], [23, 15]].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width="16" height="13" rx="6.5" fill="#a9dc80" stroke="#6fb050" strokeWidth="1" />
          ))}
        </pattern>
        <pattern id="kwdirt" width="22" height="22" patternUnits="userSpaceOnUse">
          <rect width="22" height="22" fill="#d8b27e" />
          <path d="M0 0H22M0 0V22" stroke="#c79f6b" strokeWidth="1" />
        </pattern>
      </defs>

      <rect width="600" height="440" fill="url(#kwgrass)" />
      <rect x="36" y="26" width="96" height="70" rx="14" fill="#8fd0e8" stroke="#6bb8d6" strokeWidth="3" />
      <rect x="470" y="330" width="110" height="80" rx="14" fill="#8fd0e8" stroke="#6bb8d6" strokeWidth="3" />

      {/* permanent road grid the kin walk on */}
      <g>
        {RX.map(x => <rect key={'v' + x} x={x - 11} y="0" width="22" height="440" fill="url(#kwdirt)" />)}
        {RY.map(y => <rect key={'h' + y} x="0" y={y - 11} width="600" height="22" fill="url(#kwdirt)" />)}
      </g>

      {/* central kingdom block — grows silently with the stage */}
      <g style={{ transformOrigin: '300px 220px', transform: `scale(${f})`, transition: 'transform .6s cubic-bezier(.2,.8,.2,1)' }}>
        <rect x="232" y="171" width="136" height="98" rx="16" fill="url(#kwdirt)" stroke="#b98c5a" strokeWidth="3" />
        {stage >= 2 && <rect x="226" y="165" width="148" height="110" rx="20" fill="none" stroke="#d4ccba" strokeWidth="6" />}
      </g>
    </svg>
  )
}

// The full-bleed map: terrain, the castle+rider hub in the centre, and every
// befriended kin walking the road grid.
function KinMap({ roster, stage, mount, collectable, onOpenHall }: {
  roster: KinInstance[]; stage: number; mount: string | undefined; collectable: number; onOpenHall: () => void
}) {
  const sig = roster.map(r => r.id).join(',')
  const castleScale = 0.74 + stage * 0.085
  const walkers = useMemo(() => {
    const per = Math.max(1, Math.ceil(roster.length / CELLS.length))
    return roster.map((inst, i) => {
      const loop = i % CELLS.length
      const phase = Math.floor(i / CELLS.length) / per
      const dur = +(34 + (i % 6) * 4 + Math.random() * 6).toFixed(1) // slow, varied
      const delay = (-(dur * phase) - Math.random() * 2).toFixed(1)
      const bob = (0.5 + Math.random() * 0.2).toFixed(2)
      return { inst, i, loop, dur, delay, bob }
    })
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="kw-map kw-map-full">
      <Terrain stage={stage} />

      <div className="kw-walkers">
        <style>{SCENE_KF}</style>
        {walkers.map(w => {
          const scale = GROWTH_SCALE[w.inst.growth] ?? 1
          const elder = w.inst.growth === 'adult'
          return (
            <div key={w.inst.id} className="kw-wk" style={{ animation: `kwloop${w.loop} ${w.dur}s linear ${w.delay}s infinite` }}>
              <div className="kw-wk-face" style={{ animation: `kwface ${w.dur}s linear ${w.delay}s infinite` }}>
                <div className="kw-wk-bob" style={{ animation: `kwbob2 ${w.bob}s ease-in-out infinite alternate` }}>
                  {elder && <span className="kw-crown" aria-hidden="true"><svg viewBox="0 0 24 16" width="14" height="10"><path d="M2 14 L4 4 L9 10 L12 2 L15 10 L20 4 L22 14 Z" fill="#f0a83a" stroke="#b4761a" strokeWidth="1" strokeLinejoin="round" /></svg></span>}
                  <span className="kw-shadow" />
                  <KinSprite kin={w.inst.kin_key} size={Math.round(46 * scale)} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* the hub: castle with the player riding in the centre */}
      <button className="kw-hub" onClick={onOpenHall} aria-label="Open Town Hall"
        style={{ transform: `translate(-50%, -62%) scale(${castleScale.toFixed(3)})` }}>
        <span className="kw-hub-ring" />
        <Settlement stage={stage} />
        <span className="kw-hub-rider"><AvatarSprite mood="wave" size={60} mount={mount} /></span>
        <span className={`kw-hub-gem${collectable >= 1 ? ' ready' : ''}`}>💎{collectable >= 1 ? ` ${collectable}` : ''}</span>
        <span className="kw-hub-tag">Town Hall</span>
      </button>

      {roster.length === 0 && <div className="kw-empty-hint">Befriend kin in each world and they'll walk your streets.</div>}
    </div>
  )
}

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
  const [equippedMount, setEquippedMount] = useState<string | undefined>(undefined)
  useEffect(() => { myMounts().then(m => setEquippedMount(m.equipped ?? undefined)) }, [session])
  const taskShownAt = useRef(Date.now())

  useEffect(() => {
    let alive = true
    setLoading(true)
    nexusRoster().then(r => { if (alive) { setRoster(r); setLoading(false) } })
    nexusHarvest(false).then(h => { if (alive && h) setHarvest(h) })
    return () => { alive = false }
  }, [session])

  const total = roster.length
  const stageIdx = Math.min(STAGE_COUNT - 1, Math.floor(total / STAGE_STEP))
  const caughtCount = new Set(roster.map(r => r.kin_key)).size

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
      addToast(`Harvested ${h.minted} 💎 from your town!`, '💎')
    } else {
      addToast('Not ripe yet — let your kin trickle a little longer 🌱', '⏳')
    }
  }
  const readyToCollect = harvest ? Math.floor(harvest.pending) : 0

  const dexWorlds = filter === 'all' ? WORLDS : WORLDS.filter(w => w.key === filter)

  return (
    <div className="screen kinworld kw-full">
      <KinMap roster={roster} stage={stageIdx} mount={equippedMount} collectable={readyToCollect} onOpenHall={() => setHallOpen(true)} />

      {/* ── Town Hall: harvest Collect + Kindex, opened from the castle ── */}
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

            {/* harvest + stable */}
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

            {/* kindex pills */}
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
                      <span className="dex-count">{byKey.size}/{all.length}</span>
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
                          <button key={k.id} className="dex-card wild" onClick={() => { setActive(k); setHallOpen(false) }} title={`${k.name} — not yet befriended`}>
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
                  No kin yet — explore a world{learnerName ? `, ${learnerName}` : ''}, win a friendly battle, and they'll move in.
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

      {/* Wild-kin detail drawer (opened from the Kindex) */}
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
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={() => { go({ tab: active.world }); setActive(null) }}>
              Find {active.name} in the wild →
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
