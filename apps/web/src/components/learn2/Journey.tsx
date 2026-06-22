import type { World, JourneyNode } from '@/data/learn'
import { nodeState, nodeUnlocked } from '@lib/learnProgress'
import Buddy from '@components/avatar/Buddy'
import type { ResolvedOutfit } from '@/data/cosmetics'

// Each world wears its analog app's skin so the six don't feel the same.
type Skin = 'arcade' | 'story' | 'lab' | 'circuit' | 'map' | 'party'
const STYLE: Record<string, Skin> = {
  NUM: 'arcade', WRD: 'story', WON: 'lab', LOG: 'circuit', WLD: 'map', LIF: 'party',
}

export interface JProps {
  world: World
  launch: (n: JourneyNode) => void
  currentKey?: string
  outfit: ResolvedOutfit
}

interface Meta { fi: number; st: { status: 'open' | 'done'; stars: number }; unlocked: boolean; isBoss: boolean; isChest: boolean; isLesson: boolean; isCurrent: boolean }

function useMeta(world: World) {
  const flat = world.units.flatMap(u => u.nodes)
  const info = (node: JourneyNode, currentKey?: string): Meta => {
    const fi = flat.findIndex(n => n.key === node.key)
    const st = nodeState(world.key, node.key)
    return { fi, st, unlocked: nodeUnlocked(world, fi), isBoss: node.type === 'boss', isChest: node.type === 'chest', isLesson: node.type === 'lesson', isCurrent: node.key === currentKey }
  }
  return { flat, info }
}

// ── Skin config: heading + per-state node glyph + decoration layer ──
const SKINS: Record<Skin, { head: string; sub: string; icon: (m: Meta) => string; deco: JSX.Element }> = {
  arcade: {
    head: '⚡ SPEED STAGE', sub: 'race down the neon track',
    icon: m => m.st.status === 'done' ? '★' : !m.unlocked ? '🔒' : m.isBoss ? '🔥' : m.isChest ? '🎁' : '▶',
    deco: <div className="jr-deco" aria-hidden>{Array.from({ length: 6 }, (_, i) => <i key={i} className="jr-streak" style={{ left: `${10 + i * 16}%`, animationDelay: `${i * 0.3}s` }} />)}<i className="jr-grid" /></div>,
  },
  story: {
    head: '📖 Story Trail', sub: 'follow the path, page by page',
    icon: m => m.st.status === 'done' ? '★' : !m.unlocked ? '🔒' : m.isBoss ? '👑' : m.isChest ? '💎' : '▶',
    deco: <div className="jr-deco" aria-hidden>{['✨', '⭐', '🌟', '✨', '☁️', '☁️'].map((e, i) => <i key={i} className="jr-spark" style={{ left: `${8 + i * 15}%`, top: `${10 + (i % 3) * 28}%`, animationDelay: `${i * 0.5}s` }}>{e}</i>)}</div>,
  },
  lab: {
    head: '🔬 Experiment Bench', sub: 'predict · test · explain',
    icon: m => m.st.status === 'done' ? '✅' : !m.unlocked ? '🔒' : m.isBoss ? '🧠' : m.isChest ? '🧫' : '🧪',
    deco: <div className="jr-deco" aria-hidden>{Array.from({ length: 8 }, (_, i) => <i key={i} className="jr-bubble" style={{ left: `${8 + i * 11}%`, animationDelay: `${i * 0.7}s`, animationDuration: `${4 + (i % 3)}s` }} />)}</div>,
  },
  circuit: {
    head: '</> Circuit Board', sub: 'power up each program',
    icon: m => m.st.status === 'done' ? '✓' : !m.unlocked ? '🔒' : m.isBoss ? '⚙' : m.isChest ? '◈' : '▶',
    deco: <div className="jr-deco" aria-hidden><i className="jr-pcb" />{Array.from({ length: 4 }, (_, i) => <i key={i} className="jr-node-dot" style={{ left: `${15 + i * 22}%`, top: `${20 + i * 18}%` }} />)}</div>,
  },
  map: {
    head: '🧭 Expedition', sub: 'collect a stamp at every stop',
    icon: m => m.st.status === 'done' ? '🚩' : !m.unlocked ? '🔒' : m.isBoss ? '🏁' : m.isChest ? '💰' : '📍',
    deco: <div className="jr-deco" aria-hidden><i className="jr-compass">🧭</i><i className="jr-terrain t1">⛰️</i><i className="jr-terrain t2">🌴</i><i className="jr-terrain t3">🏝️</i></div>,
  },
  party: {
    head: '🎉 Quest Board', sub: 'do good things, have fun',
    icon: m => m.st.status === 'done' ? '🌟' : !m.unlocked ? '🔒' : m.isBoss ? '🎆' : m.isChest ? '🎁' : '🎲',
    deco: <div className="jr-deco" aria-hidden>{Array.from({ length: 14 }, (_, i) => <i key={i} className="jr-confetti" style={{ left: `${(i * 7) % 100}%`, animationDelay: `${i * 0.4}s`, background: ['#f59e0b', '#ec4899', '#22c55e', '#3b82f6', '#a855f7'][i % 5] }} />)}</div>,
  },
}

export default function Journey(p: JProps) {
  const skin = STYLE[p.world.key] ?? 'story'
  const { flat, info } = useMeta(p.world)
  const cfg = SKINS[skin]
  let unitIdx = 0

  return (
    <div className={`jr jr-${skin}`} style={{ ['--wc' as string]: p.world.color }}>
      {cfg.deco}
      <div className="jr-head"><b>{cfg.head}</b><span>{cfg.sub}</span></div>

      <div className="jr-track">
        {p.world.units.map(unit => {
          const done = unit.nodes.filter(n => nodeState(p.world.key, n.key).status === 'done').length
          unitIdx++
          return (
            <div key={unit.key} className="jr-unit">
              <div className="jr-unit-head">
                <span className="jr-unit-no">{unitIdx}</span>
                <b>{unit.title}</b>
                <span className="jr-unit-prog">{done}/{unit.nodes.length} ⭐</span>
              </div>
              {unit.nodes.map(node => {
                const m = info(node, p.currentKey)
                const prevDone = m.fi === 0 || nodeState(p.world.key, flat[m.fi - 1].key).status === 'done'
                const side = m.fi % 2 === 0 ? 'l' : 'r'
                return (
                  <div key={node.key} className={`jr-row ${side}${m.isCurrent ? ' current' : ''}${m.isBoss ? ' boss' : ''}`} style={{ ['--d' as string]: `${(m.fi % 8) * 70}ms` }}>
                    <span className={`jr-link${prevDone ? ' on' : ''}`} aria-hidden />
                    {m.isCurrent && <span className="jr-pin-tag">PLAY ▸</span>}
                    <button className={`jr-node${m.st.status === 'done' ? ' done' : ''}${!m.unlocked ? ' locked' : ''}${m.isBoss ? ' boss' : ''}${m.isChest ? ' chest' : ''}${m.isLesson ? ' lesson' : ''}${m.isCurrent ? ' current' : ''}`}
                      disabled={!m.unlocked} onClick={() => m.unlocked && p.launch(node)} aria-label={node.title}>
                      <span className="jr-glow" aria-hidden />
                      <span className="jr-ring" aria-hidden />
                      <span className="jr-ic">{cfg.icon(m)}</span>
                      {m.st.status === 'done' && m.st.stars > 0 && <span className="jr-stars">{'★'.repeat(m.st.stars)}</span>}
                    </button>
                    {m.isCurrent && (
                      <span className="jr-here">
                        <Buddy size={50} mood="happy" color={p.world.color} outfit={p.outfit} />
                      </span>
                    )}
                    <span className="jr-label">{node.title}{m.isBoss && <em> · Boss</em>}{m.isChest && <em> · Chest</em>}</span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
