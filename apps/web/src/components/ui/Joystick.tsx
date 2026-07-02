// ============================================================
//  ARGANTALAB · UI · JOYSTICK  (analog thumbstick for overworld movement)
//  A circular pad you drag in any direction. Reports a normalized vector
//  (dx, dy ∈ [-1, 1]) via onChange, with a small deadzone. Used by both
//  KinQuest Town and KinWorld — the parent writes the vector straight into
//  its movement `controls` ref.
//
//  Drag tracking uses WINDOW-level pointer listeners once a drag starts, so
//  the thumb keeps following the finger even when it leaves the pad — the key
//  to reliable touch on mobile (element-only pointer capture is flaky there).
//  preventDefault + touch-action:none stop the page from scrolling mid-drag.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react'

const R = 48          // max thumb travel (px)
const DEAD = 0.18     // deadzone (fraction of R)

export default function Joystick({ onChange, className }: {
  onChange: (dx: number, dy: number) => void
  className?: string
}) {
  const base = useRef<HTMLDivElement>(null)
  const active = useRef(false)
  const [thumb, setThumb] = useState({ x: 0, y: 0 })
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange

  const track = useCallback((clientX: number, clientY: number) => {
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
    onChangeRef.current(nx, ny)
  }, [])

  // window listeners live for the component's life; they only act while dragging
  useEffect(() => {
    const move = (e: PointerEvent) => { if (active.current) { e.preventDefault(); track(e.clientX, e.clientY) } }
    const up = () => { if (active.current) { active.current = false; setThumb({ x: 0, y: 0 }); onChangeRef.current(0, 0) } }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [track])

  const down = (e: React.PointerEvent) => {
    active.current = true
    e.preventDefault()
    track(e.clientX, e.clientY)
  }

  return (
    <div
      ref={base}
      className={`joystick${className ? ' ' + className : ''}`}
      onPointerDown={down}
      role="application"
      aria-label="Movement joystick"
    >
      <span className="joystick-ring" aria-hidden />
      <span className="joystick-thumb" style={{ transform: `translate(${thumb.x}px, ${thumb.y}px)` }} aria-hidden />
    </div>
  )
}
