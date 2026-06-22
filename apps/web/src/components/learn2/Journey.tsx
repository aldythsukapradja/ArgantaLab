import type { World, JourneyNode } from '@/data/learn'
import { nodeState, nodeUnlocked } from '@lib/learnProgress'
import Buddy from '@components/avatar/Buddy'
import type { ResolvedOutfit } from '@/data/cosmetics'

// Each world wears its analog app's skin so the six don't feel the same.
const STYLE: Record<string, 'arcade' | 'story' | 'lab' | 'circuit' | 'map' | 'party'> = {
  NUM: 'arcade', WRD: 'story', WON: 'lab', LOG: 'circuit', WLD: 'map', LIF: 'party',
}

export interface JProps {
  world: World
  launch: (n: JourneyNode) => void
  currentKey?: string
  outfit: ResolvedOutfit
}

export default function Journey(p: JProps) {
  switch (STYLE[p.world.key] ?? 'story') {
    case 'arcade': return <Arcade {...p} />
    case 'lab': return <Lab {...p} />
    case 'circuit': return <Circuit {...p} />
    case 'map': return <MapTrail {...p} />
    case 'party': return <Party {...p} />
    default: return <Story {...p} />
  }
}

// ── shared helpers ───────────────────────────────────────────
function useMeta(world: World) {
  const flat = world.units.flatMap(u => u.nodes)
  const info = (node: JourneyNode, currentKey?: string) => {
    const fi = flat.findIndex(n => n.key === node.key)
    const st = nodeState(world.key, node.key)
    return { fi, st, unlocked: nodeUnlocked(world, fi), isBoss: node.type === 'boss', isCurrent: node.key === currentKey }
  }
  return { flat, info }
}

// ════════════════════════════════════════════════════════════
//  STORY  (WordQuest · Duolingo) — winding candy path
// ════════════════════════════════════════════════════════════
const OFFSETS = [0, 42, 58, 42, 0, -42, -58, -42]
function Story({ world, launch, currentKey, outfit }: JProps) {
  const { info } = useMeta(world)
  return (
    <div className="le-path jx">
      {world.units.map(unit => {
        const done = unit.nodes.filter(n => nodeState(world.key, n.key).status === 'done').length
        return (
          <div key={unit.key} className="le-path-unit">
            <div className="le-unit-banner" style={{ background: `linear-gradient(100deg, ${unit.color}, ${unit.color}cc)` }}>
              <div className="le-unit-banner-t"><small>UNIT</small><b>{unit.title}</b></div>
              <span className="le-unit-banner-prog">{done}/{unit.nodes.length} ⭐</span>
            </div>
            {unit.nodes.map(node => {
              const m = info(node, currentKey)
              return (
                <div key={node.key} className="le-path-row" style={{ transform: `translateX(${OFFSETS[m.fi % OFFSETS.length]}px)` }}>
                  {m.isCurrent && <div className="le-start-bubble">START</div>}
                  <button className={`le-orb${m.st.status === 'done' ? ' done' : ''}${!m.unlocked ? ' locked' : ''}${m.isBoss ? ' boss' : ''}${m.isCurrent ? ' current' : ''}`}
                    disabled={!m.unlocked} style={{ ['--wc' as string]: world.color }} onClick={() => m.unlocked && launch(node)}>
                    {m.isCurrent && <span className="le-orb-halo" />}
                    <span className="le-orb-ic">{m.st.status === 'done' ? (m.isBoss ? '👑' : '★') : m.isBoss ? '👑' : m.unlocked ? '▶' : '🔒'}</span>
                    {m.st.status === 'done' && <span className="le-orb-stars">{'⭐'.repeat(m.st.stars)}</span>}
                  </button>
                  {m.isCurrent && <div className="le-orb-buddy"><Buddy size={50} mood="happy" color={world.color} outfit={outfit} /></div>}
                  <span className="le-orb-label">{node.title}{m.isBoss && <em> · Boss</em>}</span>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  ARCADE  (NumberDash · Times Tables Rock Stars) — neon speed stage
// ════════════════════════════════════════════════════════════
function Arcade({ world, launch, currentKey }: JProps) {
  const { flat, info } = useMeta(world)
  return (
    <div className="jx-arcade" style={{ ['--wc' as string]: world.color }}>
      <div className="jx-arcade-head">⚡ SPEED STAGE <span>tap a disc to play fast</span></div>
      <div className="jx-arcade-track">
        {flat.map(node => {
          const m = info(node, currentKey)
          return (
            <button key={node.key} className={`jx-disc${m.st.status === 'done' ? ' done' : ''}${!m.unlocked ? ' locked' : ''}${m.isBoss ? ' boss' : ''}${m.isCurrent ? ' current' : ''}`}
              disabled={!m.unlocked} onClick={() => m.unlocked && launch(node)}>
              <span className="jx-disc-ring" />
              <span className="jx-disc-ic">{m.st.status === 'done' ? '★' : m.isBoss ? '🔥' : m.unlocked ? '▶' : '🔒'}</span>
              <span className="jx-disc-label">{node.title}{m.isCurrent && <em> · GO!</em>}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  LAB  (WonderLab · Brilliant / Mystery Science) — experiment bench
// ════════════════════════════════════════════════════════════
function Lab({ world, launch, currentKey }: JProps) {
  const { flat, info } = useMeta(world)
  const flask = ['⚗️', '🔬', '🧪', '🧫', '🔭', '🧲']
  return (
    <div className="jx-lab" style={{ ['--wc' as string]: world.color }}>
      <div className="jx-lab-head">🔬 Experiment Bench <span>predict · test · explain</span></div>
      <div className="jx-lab-grid">
        {flat.map((node, i) => {
          const m = info(node, currentKey)
          return (
            <button key={node.key} className={`jx-flask${m.st.status === 'done' ? ' done' : ''}${!m.unlocked ? ' locked' : ''}${m.isCurrent ? ' current' : ''}`}
              disabled={!m.unlocked} onClick={() => m.unlocked && launch(node)}>
              <span className="jx-flask-ic">{m.st.status === 'done' ? '✅' : !m.unlocked ? '🔒' : m.isBoss ? '🧠' : flask[i % flask.length]}</span>
              <b>{node.title}</b>
              <small>{m.isBoss ? 'Lab Boss' : 'Experiment'}</small>
              <span className="jx-flask-tag">Predict → Test → Explain</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  CIRCUIT  (LogicLand · Code.org) — PCB of connected chips
// ════════════════════════════════════════════════════════════
function Circuit({ world, launch, currentKey }: JProps) {
  const { flat, info } = useMeta(world)
  return (
    <div className="jx-circuit" style={{ ['--wc' as string]: world.color }}>
      <div className="jx-circuit-head">{'<'}/{'>'} Circuit Board <span>run each program</span></div>
      <div className="jx-circuit-track">
        {flat.map(node => {
          const m = info(node, currentKey)
          return (
            <div key={node.key} className="jx-chip-row">
              <span className="jx-trace" />
              <button className={`jx-chip${m.st.status === 'done' ? ' done' : ''}${!m.unlocked ? ' locked' : ''}${m.isCurrent ? ' current' : ''}`}
                disabled={!m.unlocked} onClick={() => m.unlocked && launch(node)}>
                <span className="jx-chip-ic">{m.st.status === 'done' ? '✓' : !m.unlocked ? '🔒' : m.isBoss ? '⚙' : '▶'}</span>
              </button>
              <span className="jx-chip-label">{node.title}{m.isBoss && <em> · boss()</em>}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  MAP  (WorldTrail · GeoGuessr) — passport expedition trail
// ════════════════════════════════════════════════════════════
const PINX = [22, 60, 38, 72, 30, 64]
function MapTrail({ world, launch, currentKey }: JProps) {
  const { flat, info } = useMeta(world)
  return (
    <div className="jx-map" style={{ ['--wc' as string]: world.color }}>
      <div className="jx-map-head">🧭 Expedition <span>collect a stamp at every stop</span></div>
      <div className="jx-map-trail">
        {flat.map(node => {
          const m = info(node, currentKey)
          return (
            <div key={node.key} className="jx-stop" style={{ marginLeft: `${PINX[m.fi % PINX.length]}%` }}>
              <button className={`jx-pin${m.st.status === 'done' ? ' done' : ''}${!m.unlocked ? ' locked' : ''}${m.isCurrent ? ' current' : ''}`}
                disabled={!m.unlocked} onClick={() => m.unlocked && launch(node)}>
                <span className="jx-pin-ic">{m.st.status === 'done' ? '🛂' : !m.unlocked ? '🔒' : m.isBoss ? '🏁' : '📍'}</span>
              </button>
              <span className="jx-pin-label">{node.title}{m.isBoss && <em> · Final</em>}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  PARTY  (LifeQuest · Habitica / Jackbox) — cozy quest board
// ════════════════════════════════════════════════════════════
function Party({ world, launch, currentKey, outfit }: JProps) {
  const { flat, info } = useMeta(world)
  const tilt = [-2, 1.5, -1, 2, -1.5, 1]
  return (
    <div className="jx-party" style={{ ['--wc' as string]: world.color }}>
      <div className="jx-party-head">🎉 Quest Board <span>do good things, have fun</span></div>
      <div className="jx-party-cards">
        {flat.map(node => {
          const m = info(node, currentKey)
          return (
            <button key={node.key} className={`jx-card${m.st.status === 'done' ? ' done' : ''}${!m.unlocked ? ' locked' : ''}${m.isCurrent ? ' current' : ''}`}
              disabled={!m.unlocked} style={{ transform: `rotate(${tilt[m.fi % tilt.length]}deg)` }} onClick={() => m.unlocked && launch(node)}>
              {m.isCurrent && <span className="jx-card-ribbon">PLAY!</span>}
              <span className="jx-card-ic">{m.st.status === 'done' ? '🌟' : !m.unlocked ? '🔒' : m.isBoss ? '🎈' : '🎲'}</span>
              <b>{node.title}</b>
              {m.isCurrent && <span className="jx-card-buddy"><Buddy size={40} mood="celebrate" color={world.color} outfit={outfit} bob={false} /></span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
