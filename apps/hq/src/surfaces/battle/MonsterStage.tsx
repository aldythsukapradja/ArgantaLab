import { useEffect, useState } from 'react'

// The Monster Lab's animated pixel stage — the monster analogue of Character
// Forge's <CompositeStage>. Instead of compositing layered part sheets, it plays
// the bestiary's real walk-cycle frames (apps/hq/public/farm-art/creatures/<id>/
// walk/<dir>/0..N.png — copied 1:1 from the game's own art). Falls back
// walk-cycle → directional still → emoji, so an un-authored monster never breaks
// the stage (same resilience posture as the art-override seam in the game).

// Real frame counts per animal (verified against the copied sprite sheets).
// Every direction has the same count. Tiger has stills only (no walk cycle yet).
const FRAMES: Record<string, number> = { squirrel: 9, fox: 4, badger: 9, boar: 9, deer: 4, tiger: 0 }
export const EMOJI: Record<string, string> = { squirrel: '🐿️', fox: '🦊', badger: '🦡', boar: '🐗', deer: '🦌', tiger: '🐯' }
const DIR_FILE: Record<string, string> = { S: 'south', E: 'east', N: 'north', W: 'west' }
const ART_BASE = ((import.meta as any).env?.VITE_LASHIRA_ART_BASE || '/farm-art/creatures').replace(/\/$/, '')

export function frameCountFor(id: string) { return FRAMES[id] ?? 0 }

export function MonsterStage({ id, dir, playing, speedMs = 130, zoom = 1, onFrame }:
  { id: string; dir: string; playing: boolean; speedMs?: number; zoom?: number; onFrame?: (i: number, n: number) => void }) {
  const n = FRAMES[id] ?? 0
  const [frame, setFrame] = useState(0)
  const [broken, setBroken] = useState(false)
  const dirFile = DIR_FILE[dir] || 'south'
  useEffect(() => { setFrame(0); setBroken(false) }, [id, dirFile])
  useEffect(() => {
    if (!n || !playing) return
    const t = setInterval(() => setFrame(f => (f + 1) % n), speedMs)
    return () => clearInterval(t)
  }, [n, playing, speedMs, id, dirFile])
  // Report the current frame to the parent from a proper effect (post-commit) —
  // NOT from inside the setFrame updater above, which can run during React's
  // render phase and trip "update a component while rendering a different one".
  useEffect(() => { onFrame?.(frame, n) }, [frame, n])

  return (
    <div className="bf-mstage" style={{ transform: `scale(${zoom})` }}>
      {broken ? <span className="em">{EMOJI[id] || '❓'}</span> : (
        <img className="bf-spr" width={120} height={120}
          src={n > 0 ? `${ART_BASE}/${id}/walk/${dirFile}/${frame}.png` : `${ART_BASE}/${id}/${dirFile}.png`}
          onError={() => setBroken(true)} alt={id} />
      )}
    </div>
  )
}

// A small still-frame sprite for roster rows / quick-grids — never animates, so a
// list of many monsters stays cheap. Same fallback chain as the big stage.
export function MonsterThumb({ id, size = 30 }: { id: string; size?: number }) {
  const [broken, setBroken] = useState(false)
  if (broken) return <span className="em" style={{ fontSize: size * 0.8 }}>{EMOJI[id] || '❓'}</span>
  const n = FRAMES[id] ?? 0
  const src = n > 0 ? `${ART_BASE}/${id}/walk/south/0.png` : `${ART_BASE}/${id}/south.png`
  return <img className="bf-spr" width={size} height={size} src={src} onError={() => setBroken(true)} alt={id} />
}
