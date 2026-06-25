// ============================================================
//  ARGANTALAND · the 2D overworld engine (generic, data-driven)
//  A CAMERA viewport follows the avatar over a map that's bigger than the screen
//  (room to roam). Move tile-by-tile (keyboard + on-screen D-pad overlaid on the
//  map); grass rolls a weighted wild-kin encounter → the EXISTING battle
//  (OpenworldPlayer) → befriend. CO-OP: a Realtime presence channel shows circle
//  friends walking the same map live. The avatar is the real AvatarSprite, so it
//  wears the kid's equipped cosmetics AND rides their equipped mount.
// ============================================================

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { World } from '@/data/learn'
import { useAppStore } from '@store/appStore'
import { mapFor, tileOf, biomeOf, isWalkable, spawnOf, rollEncounter } from '@/data/openworld/argantaland'
import { kin as kinDef } from '@/data/openworld'
import { myMounts } from '@lib/mounts'
import { joinLand, type Peer, type LandCtrl } from '@lib/landPresence'
import AvatarSprite from './AvatarSprite'
import Buddy from '@components/avatar/Buddy'
import OpenworldPlayer from './OpenworldPlayer'

function shade(hex: string, pct: number): string {
  if (hex[0] !== '#') return hex
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, Math.max(0, (n >> 16) + Math.round(255 * pct)))
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) + Math.round(255 * pct)))
  const b = Math.min(255, Math.max(0, (n & 255) + Math.round(255 * pct)))
  return `rgb(${r},${g},${b})`
}

export default function Argantaland({ world, onExit }: { world: World; onExit: () => void }) {
  const { learnerName, resolvedOutfit, activeCircleId, session } = useAppStore()
  const myId = session && session !== 'loading' ? session.user.id : null
  const map = mapFor(world.key)
  const cols = map ? map.rows[0].length : 0
  const rows = map ? map.rows.length : 0

  const viewRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ w: 440, h: 480 })
  const [pos, setPos] = useState(() => (map ? spawnOf(map) : { r: 1, c: 1 }))
  const [battleKin, setBattleKin] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [mount, setMount] = useState<string | undefined>(undefined)
  const [peers, setPeers] = useState<Peer[]>([])

  useEffect(() => { myMounts().then(m => setMount(m.equipped ?? undefined)) }, [])

  // Measure the viewport so the camera + tile size fit it.
  useLayoutEffect(() => {
    const el = viewRef.current
    if (!el) return
    const measure = () => setView({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [battleKin])

  // Co-op presence: join the map channel, broadcast our position, render friends.
  const ctrl = useRef<LandCtrl | null>(null)
  useEffect(() => {
    if (!myId || !map) return
    const me: Peer = { id: myId, name: learnerName, x: pos.c, y: pos.r, color: world.color, outfit: resolvedOutfit() }
    const c = joinLand(world.key, activeCircleId, me, setPeers)
    ctrl.current = c
    return () => { c.leave(); ctrl.current = null; setPeers([]) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world.key, myId, activeCircleId])
  useEffect(() => { ctrl.current?.move(pos.c, pos.r) }, [pos])

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
  const TILE = Math.max(40, view.w / Math.min(cols, 10))
  const worldW = cols * TILE, worldH = rows * TILE
  const camX = Math.max(0, Math.min(Math.max(0, worldW - view.w), (pos.c + 0.5) * TILE - view.w / 2))
  const camY = Math.max(0, Math.min(Math.max(0, worldH - view.h), (pos.r + 0.5) * TILE - view.h / 2))

  return (
    <div className="al-wrap">
      <div className="al-head">
        <button className="al-leave" onClick={onExit}><span aria-hidden>←</span> Leave</button>
        <div className="al-title"><b style={{ color: world.color }}>{map.name}</b><small>Walk into the grass to meet kin</small></div>
        {peers.length > 0 && <span className="al-online" title="friends exploring"><i className="al-dot" />{peers.length}</span>}
      </div>

      <div ref={viewRef} className="al-view" style={{ ['--frame' as string]: pal.wall }}>
        <div className="al-world" style={{ width: worldW, height: worldH, transform: `translate(${-camX}px, ${-camY}px)`, gridTemplateColumns: `repeat(${cols}, ${TILE}px)`, gridAutoRows: `${TILE}px` }}>
          {map.rows.flatMap((row, r) => [...row].map((ch, c) => {
            const t = tileOf(ch)
            const base = bg(t)
            return <div key={`${r}-${c}`} className="al-tile" style={{ background: (r + c) % 2 ? shade(base, -0.05) : base }}>{t === 'gym' ? <span className="al-gym">★</span> : null}</div>
          }))}

          {peers.map(p => (
            <div key={p.id} className="al-peer" style={{ left: (p.x + 0.5) * TILE, top: (p.y + 0.5) * TILE }}>
              <Buddy mood="idle" size={Math.round(TILE * 1.25)} outfit={p.outfit} />
              <span className="al-peer-tag">{p.name}</span>
            </div>
          ))}

          <div className="al-avatar" style={{ left: (pos.c + 0.5) * TILE, top: (pos.r + 0.5) * TILE }}>
            <AvatarSprite mood="happy" size={Math.round(TILE * 1.5)} mount={mount} />
          </div>
        </div>

        {flash && <div className="al-flash">A wild <b>{flash}</b> appeared!</div>}

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
