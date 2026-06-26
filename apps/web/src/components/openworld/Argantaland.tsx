// ============================================================
//  ARGANTALAND · the 2D overworld engine (generic, data-driven)
//  A CAMERA viewport follows the avatar over a map bigger than the screen. Wild
//  kin are VISIBLE on the map (you see them and walk into them) — weighted so
//  commons are everywhere and legendaries are rare (+ one on the gym tile).
//  Walking onto a kin → the EXISTING battle (OpenworldPlayer) → befriend, then a
//  fresh kin respawns. CO-OP lives HERE: a Realtime presence channel shows circle
//  friends walking the map, and in-map invites let you host/join a co-op battle.
//  The avatar is the real AvatarSprite, so it wears equipped cosmetics + mount.
// ============================================================

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { World } from '@/data/learn'
import { useAppStore } from '@store/appStore'
import { mapFor, tileOf, biomeOf, isWalkable, spawnOf, rollEncounter, makeKinSpawns, grassTiles, type KinSpawn } from '@/data/openworld/argantaland'
import { kin as kinDef } from '@/data/openworld'
import { myMounts } from '@lib/mounts'
import { joinLand, type Peer, type LandCtrl } from '@lib/landPresence'
import AvatarSprite from './AvatarSprite'
import KinSprite from './KinSprite'
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
  const [kins, setKins] = useState<KinSpawn[]>(() => (map ? makeKinSpawns(map) : []))
  const [battleKin, setBattleKin] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [mount, setMount] = useState<string | undefined>(undefined)
  const [peers, setPeers] = useState<Peer[]>([])
  const engaged = useRef<string | null>(null)

  useEffect(() => { myMounts().then(m => setMount(m.equipped ?? undefined)) }, [])

  useLayoutEffect(() => {
    const el = viewRef.current
    if (!el) return
    const measure = () => setView({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [battleKin])

  // presence: friends walking the same map
  const ctrl = useRef<LandCtrl | null>(null)
  useEffect(() => {
    if (!myId || !map) return
    const me: Peer = { id: myId, name: learnerName, world: world.key, x: pos.c, y: pos.r, color: world.color, outfit: resolvedOutfit(), mount }
    const c = joinLand(activeCircleId, me, setPeers)
    ctrl.current = c
    return () => { c.leave(); ctrl.current = null; setPeers([]) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world.key, myId, activeCircleId])
  useEffect(() => { ctrl.current?.move(pos.c, pos.r) }, [pos])
  useEffect(() => { ctrl.current?.update({ mount }) }, [mount])

  const move = useCallback((dr: number, dc: number) => {
    if (!map || battleKin || flash) return
    const r = pos.r + dr, c = pos.c + dc
    if (r < 0 || c < 0 || r >= map.rows.length || c >= map.rows[0].length) return
    if (!isWalkable(tileOf(map.rows[r][c]))) return
    setPos({ r, c })
    const hit = kins.find(k => k.r === r && k.c === c)   // walked onto a visible kin
    if (hit) { engaged.current = hit.id; setFlash(kinDef(hit.kinId)?.name ?? 'A wild kin'); window.setTimeout(() => { setFlash(null); setBattleKin(hit.kinId) }, 650) }
  }, [map, battleKin, flash, pos, kins])

  // after a battle: remove the kin we fought, respawn a fresh one elsewhere
  const endBattle = useCallback(() => {
    setBattleKin(null)
    if (!map) return
    setKins(prev => {
      const left = prev.filter(k => k.id !== engaged.current)
      const taken = new Set(left.map(k => `${k.r}-${k.c}`))
      const free = grassTiles(map).filter(g => !taken.has(`${g.r}-${g.c}`) && !(g.r === pos.r && g.c === pos.c))
      if (free.length) {
        const cell = free[Math.floor(Math.random() * free.length)]
        const id = rollEncounter(map.world, false)
        if (id) left.push({ id: `${cell.r}-${cell.c}-${Date.now()}`, kinId: id, r: cell.r, c: cell.c })
      }
      return left
    })
    engaged.current = null
  }, [map, pos])

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
  if (battleKin) return <div className="le-world"><OpenworldPlayer world={world} kinId={battleKin} onExit={endBattle} /></div>

  const pal = biomeOf(map)
  const bg = (t: string) => t === 'wall' ? pal.wall : t === 'water' ? pal.water : t === 'grass' ? pal.grass : t === 'gym' ? pal.gym : pal.ground
  const TILE = Math.max(view.w / cols, view.h / rows)   // cover the viewport (no empty frame)
  const worldW = cols * TILE, worldH = rows * TILE
  const camX = Math.max(0, Math.min(Math.max(0, worldW - view.w), (pos.c + 0.5) * TILE - view.w / 2))
  const camY = Math.max(0, Math.min(Math.max(0, worldH - view.h), (pos.r + 0.5) * TILE - view.h / 2))

  return (
    <div className="al-wrap">
      <div className="al-head">
        <button className="al-leave" onClick={onExit}><span aria-hidden>←</span> Leave</button>
        <div className="al-title"><b style={{ color: world.color }}>{map.name}</b><small>Walk up to a kin to battle &amp; befriend it</small></div>
        {peers.length > 0 && <span className="al-online" title="friends exploring"><i className="al-dot" />{peers.length}</span>}
      </div>

      <div ref={viewRef} className="al-view" style={{ ['--frame' as string]: pal.wall }}>
        <div className="al-world" style={{ width: worldW, height: worldH, transform: `translate(${-camX}px, ${-camY}px)`, gridTemplateColumns: `repeat(${cols}, ${TILE}px)`, gridAutoRows: `${TILE}px` }}>
          {map.rows.flatMap((row, r) => [...row].map((ch, c) => {
            const t = tileOf(ch)
            const base = bg(t)
            return <div key={`${r}-${c}`} className="al-tile" style={{ background: (r + c) % 2 ? shade(base, -0.05) : base }}>{t === 'gym' ? <span className="al-gym">★</span> : null}</div>
          }))}

          {kins.map(k => (
            <div key={k.id} className="al-kin" style={{ left: (k.c + 0.5) * TILE, top: (k.r + 0.5) * TILE, width: TILE, height: TILE }}>
              <KinSprite kin={k.kinId} size={Math.round(TILE * 0.92)} bob />
            </div>
          ))}

          {peers.filter(p => p.world === world.key).map(p => (
            <div key={p.id} className="al-peer" style={{ left: ((p.x ?? 0) + 0.5) * TILE, top: ((p.y ?? 0) + 0.5) * TILE }}>
              <AvatarSprite mood="idle" size={Math.round(TILE * 1.5)} outfit={p.outfit} mount={p.mount} />
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
