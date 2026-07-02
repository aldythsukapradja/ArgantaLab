// ============================================================
//  ARGANTALAB · UI · JOYSTICK  (analog thumbstick for overworld movement)
//  A circular pad you drag in any direction. Reports a normalized vector
//  (dx, dy ∈ [-1, 1]) via onChange, with a small deadzone so a resting
//  thumb reads as (0, 0). Used by both KinQuest Town and KinWorld — the
//  parent writes the vector straight into its movement `controls` ref.
// ============================================================

import { useRef, useState } from 'react'

const R = 42          // max thumb travel (px)
const DEAD = 0.16     // deadzone (fraction of R)

export default function Joystick({ onChange, className }: {
  onChange: (dx: number, dy: number) => void
  className?: string
}) {
  const base = useRef<HTMLDivElement>(null)
  const active = useRef(false)
  const [thumb, setThumb] = useState({ x: 0, y: 0 })

  const handle = (clientX: number, clientY: number) => {
    const el = base.current; if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2
    let dx = clientX - cx, dy = clientY - cy
    const dist = Math.hypot(dx, dy) || 1
    const clamped = Math.min(dist, R)
    dx = (dx / dist) * clamped
    dy = (dy / dist) * clamped
    setThumb({ x: dx, y: dy })
    let nx = dx / R, ny = dy / R
    if (Math.hypot(nx, ny) < DEAD) { nx = 0; ny = 0 }
    onChange(nx, ny)
  }

  const start = (e: React.PointerEvent) => {
    active.current = true
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* ignore */ }
    handle(e.clientX, e.clientY)
  }
  const move = (e: React.PointerEvent) => { if (active.current) handle(e.clientX, e.clientY) }
  const end = () => { active.current = false; setThumb({ x: 0, y: 0 }); onChange(0, 0) }

  return (
    <div
      ref={base}
      className={`joystick${className ? ' ' + className : ''}`}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerLeave={end}
      onPointerCancel={end}
      role="application"
      aria-label="Movement joystick"
    >
      <span className="joystick-ring" aria-hidden />
      <span className="joystick-thumb" style={{ transform: `translate(${thumb.x}px, ${thumb.y}px)` }} aria-hidden />
    </div>
  )
}
