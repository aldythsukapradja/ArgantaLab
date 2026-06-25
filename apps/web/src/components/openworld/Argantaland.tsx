// ============================================================
//  ARGANTALAND · the 2D overworld engine (generic, data-driven)
//  Renders ANY map from data/openworld/argantaland.ts, moves the avatar tile by
//  tile (keyboard + on-screen D-pad overlaid on the map), and rolls weighted
//  wild-kin encounters in the grass → hands off to the EXISTING battle
//  (OpenworldPlayer) → befriend → the kin joins the Nexus. The grid is fully
//  responsive (a ResizeObserver measures the cell size, so the avatar scales
//  with it). The avatar is the real AvatarSprite, so it wears the kid's equipped
//  cosmetics AND rides their equipped mount.
// ============================================================

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { World } from '@/data/learn'
import { mapFor, tileOf, biomeOf, isWalkable, spawnOf, rollEncounter } from '@/data/openworld/argantaland'
import { kin as kinDef } from '@/data/openworld'
import { myMounts } from '@lib/mounts'
import AvatarSprite from './AvatarSprite'
import OpenworldPlayer from './OpenworldPlayer'

// Darken a #rrggbb by pct (negative = darker) — for the subtle checker on tiles.
function shade(hex: string, pct: number): string {
  if (hex[0] !== '#') return hex
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, Math.max(0, (n >> 16) + Math.round(255 * pct)))
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) + Math.round(255 * pct)))
  const b = Math.min(255, Math.max(0, (n & 255) + Math.round(255 * pct)))
  return `rgb(${r},${g},${b})`
}

export default function Argantaland({ world, onExit }: { world: World; onExit: () => void }) {
  const map = mapFor(world.key)
  const cols = map ? map.rows[0].length : 0
  const rows = map ? map.rows.length : 0

  const gridRef = useRef<HTMLDivElement>(null)
  const [cell, setCell] = useState(40)
  const [pos, setPos] = useState(() => (map ? spawnOf(map) : { r: 1, c: 1 }))
  const [battleKin, setBattleKin] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [mount, setMount] = useState<string | undefined>(undefined)

  useEffect(() => { myMounts().then(m => setMount(m.equipped ?? undefined)) }, [])

  // Measure the grid so the avatar + movement scale with the responsive tiles.
  useLayoutEffect(() => {
    const el = gridRef.current
    if (!el || !cols) return
    const measure = () => setCell(el.clientWidth / cols)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [cols, battleKin])

  const tryEncounter = useCallback((t: string, gym: boolean) => {
    if (t !== 'grass' && !gym) return
    if (Math.random() < (gym ? 0.5 : 0.18)) {
      const id = rollEncounter(world.key, gym)
      if (id) { setFlash(kinDef(id)?.name ?? 'A wild kin'); window.setTimeout(() => { setFlash(null); setBattleKin(id) }, 750) }
    }
  }, [world.key])

  const move = useCallback((dr: number, dc: number) => {
    if (!map || battleKin || flash) return
    const r = pos.r + dr, c = pos.c + dc
    if (r < 0 || c < 0 || r >= map.rows.length || c >= map.rows[0].length) return
    const t = tileOf(map.rows[r][c])
    if (!isWalkable(t)) return
    setPos({ r, c })
    tryEncounter(t, t === 'gym')
  }, [map, battleKin, flash, pos, tryEncounter])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const m: Record<string, [number, number]> = {
        arrowup: [-1, 0], w: [-1, 0], arrowdown: [1, 0], s: [1, 0],
        arrowleft: [0, -1], a: [0, -1], arrowright: [0, 1], d: [0, 1],
      }
      const v = m[e.key.toLowerCase()]
      if (v) { e.preventDefault(); move(v[0], v[1]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [move])

  if (!map) return <div className="le-world"><p className="ig-kc">This world’s map is coming soon.</p><button className="btn btn-primary" onClick={onExit}>← Back</button></div>
  if (battleKin) return <div className="le-world"><OpenworldPlayer world={world} kinId={battleKin} onExit={() => setBattleKin(null)} /></div>

  const pal = biomeOf(map)
  const bg = (t: string) => t === 'wall' ? pal.wall : t === 'water' ? pal.water : t === 'grass' ? pal.grass : t === 'gym' ? pal.gym : pal.ground

  return (
    <div className="al-wrap">
      <div className="al-head">
        <button className="al-leave" onClick={onExit}><span aria-hidden>←</span> Leave</button>
        <div className="al-title"><b style={{ color: world.color }}>{map.name}</b><small>Walk into the grass to meet kin</small></div>
      </div>

      <div className="al-stage">
        <div ref={gridRef} className="al-grid" style={{ ['--frame' as string]: pal.wall, gridTemplateColumns: `repeat(${cols}, 1fr)`, aspectRatio: `${cols} / ${rows}` }}>
          {map.rows.flatMap((row, r) => [...row].map((ch, c) => {
            const t = tileOf(ch)
            const base = bg(t)
            return <div key={`${r}-${c}`} className="al-tile" style={{ background: (r + c) % 2 ? shade(base, -0.05) : base }}>{t === 'gym' ? <span className="al-gym">★</span> : null}</div>
          }))}
          <div className="al-avatar" style={{ left: (pos.c + 0.5) * cell, top: (pos.r + 0.5) * cell }}>
            <AvatarSprite mood="happy" size={Math.round(cell * 1.5)} mount={mount} />
          </div>
          {flash && <div className="al-flash">A wild <b>{flash}</b> appeared!</div>}
        </div>

        <div className="al-dpad" role="group" aria-label="move">
          <button className="al-up" onClick={() => move(-1, 0)} aria-label="up">▲</button>
          <button className="al-left" onClick={() => move(0, -1)} aria-label="left">◀</button>
          <button className="al-right" onClick={() => move(0, 1)} aria-label="right">▶</button>
          <button className="al-down" onClick={() => move(1, 0)} aria-label="down">▼</button>
        </div>
      </div>
    </div>
  )
}
