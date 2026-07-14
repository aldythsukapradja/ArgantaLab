import { useEffect, useRef } from 'react'
import type { ProductId, SceneState } from '../contract'
import type { QualityTier } from '../useQualityTier'
import { PRODUCT_ORBIT_META } from '../../surfaces/reactorModel'

// ─────────────────────────────────────────────────────────────────────────
// Core2D — the permanent fallback (no WebGL / reduced-motion / weak mobile).
//
// A flat schematic cousin of the 3D core: concentric rings, an energy core
// that pulses on `intensity`, THINK/KNOW/DO arcs that ease apart on the split
// states, and the five product pods on a ring. It speaks the same SceneState
// so a Director preview here matches the real show's beats, if not its depth.
// Canvas 2D with additive compositing — cheap and mobile-safe.
// ─────────────────────────────────────────────────────────────────────────

const CORES = [
  { id: 'think', color: '#45e8ff', angle: -Math.PI / 2 },
  { id: 'know', color: '#9a72ff', angle: Math.PI * 0.65 },
  { id: 'do', color: '#ffc46b', angle: Math.PI * 0.35 },
] as const

function flareFor(state: SceneState['state']): Record<'think' | 'know' | 'do', number> {
  if (state === 'think') return { think: 1.6, know: 0.4, do: 0.4 }
  if (state === 'know') return { think: 0.4, know: 1.6, do: 0.4 }
  if (state === 'do') return { think: 0.4, know: 0.4, do: 1.6 }
  return { think: 0.7, know: 0.7, do: 0.7 }
}

export function Core2D({ scene, onSelectProduct }: {
  scene: SceneState
  tier: QualityTier
  onSelectProduct?: (id: ProductId) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef(scene)
  sceneRef.current = scene
  const splitRef = useRef(0)
  const podHitRef = useRef<{ id: ProductId; x: number; y: number; r: number }[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let start = performance.now()

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      const s = sceneRef.current
      const t = (now - start) / 1000
      const rect = canvas.getBoundingClientRect()
      const w = rect.width, h = rect.height
      const cx = w / 2, cy = h / 2
      const R = Math.min(w, h) * 0.36

      // ease split toward target (expansion states spread the arcs)
      const splitTarget = ['think', 'know', 'do', 'architecture-unfold'].includes(s.state) ? 1 : 0
      splitRef.current += (splitTarget - splitRef.current) * (s.reducedMotion ? 0.2 : 0.06)
      const split = splitRef.current

      ctx.clearRect(0, 0, w, h)
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 2.2)
      bg.addColorStop(0, '#0b2030')
      bg.addColorStop(0.5, '#06121b')
      bg.addColorStop(1, '#02060a')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)

      ctx.globalCompositeOperation = 'lighter'

      // containment rings
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.arc(cx, cy, R * (0.9 - i * 0.16), 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(120,160,180,${0.14 - i * 0.02})`
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // THINK / KNOW / DO arcs (ease apart on split)
      const flare = flareFor(s.state)
      CORES.forEach(core => {
        const spread = split * 0.5
        const a0 = core.angle - 0.5 + spread
        const a1 = core.angle + 0.5 + spread
        ctx.beginPath()
        ctx.arc(cx, cy, R * (0.6 + split * 0.12), a0, a1)
        const f = flare[core.id]
        ctx.strokeStyle = core.color
        ctx.globalAlpha = 0.35 + f * 0.4
        ctx.lineWidth = 4 + f * 4
        ctx.stroke()
        ctx.globalAlpha = 1
      })

      // energy core, pulsing on intensity
      const pulse = s.reducedMotion ? 1 : 1 + Math.sin(t * 3) * 0.06 * s.intensity
      const coreR = R * 0.16 * pulse * (s.state === 'offline' ? 0.5 : 1)
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3)
      const a = s.state === 'offline' ? 0.15 : 0.35 + s.intensity * 0.5
      glow.addColorStop(0, `rgba(255,255,255,${a})`)
      glow.addColorStop(0.3, `rgba(70,232,255,${a * 0.8})`)
      glow.addColorStop(1, 'rgba(21,151,255,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, coreR * 3, 0, Math.PI * 2)
      ctx.fill()

      // product pods on a ring
      podHitRef.current = []
      PRODUCT_ORBIT_META.forEach((p, i) => {
        const pa = -Math.PI / 2 + (i / PRODUCT_ORBIT_META.length) * Math.PI * 2
        const pr = R * (1.02 + split * 0.14)
        const px = cx + Math.cos(pa) * pr
        const py = cy + Math.sin(pa) * pr
        const focused = s.focusProduct === p.id
        const rad = focused ? 11 : s.focusProduct ? 5 : 7
        ctx.beginPath()
        ctx.arc(px, py, rad, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = focused ? 1 : s.focusProduct ? 0.4 : 0.85
        ctx.fill()
        ctx.globalAlpha = 1
        podHitRef.current.push({ id: p.id, x: px, y: py, r: rad + 6 })
      })

      ctx.globalCompositeOperation = 'source-over'
    }
    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  const onClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left, y = e.clientY - rect.top
    const hit = podHitRef.current.find(p => Math.hypot(p.x - x, p.y - y) <= p.r)
    if (hit) onSelectProduct?.(hit.id)
  }

  return <canvas ref={canvasRef} onClick={onClick} style={{ width: '100%', height: '100%', display: 'block', cursor: 'pointer' }} />
}
