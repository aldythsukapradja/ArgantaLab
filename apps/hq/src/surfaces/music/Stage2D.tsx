/**
 * STAGE 2D — the guaranteed-fallback visualizer (no WebGL needed), rebuilt to
 * match Stage3D's design: soft round glows (no square particles), a layered
 * luminous core, the radial spectrum with rounded caps, role stations as
 * glowing discs with level arcs (NO emoji — clean typographic labels), ripple
 * rings and curved note trails. Reads HQ theme tokens live, so it flips with
 * light/dark like everything else.
 */
import { useEffect, useMemo, useRef } from 'react'
import { scaleBand } from 'd3-scale'
import { ROLES, ROLE_LABEL, INSTRUMENTS } from '@arganta/audio'
import { ROLE_COLOR } from './roles'

function hexArr(hex: string): [number, number, number] {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = parseInt(h, 16) || 0
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const lerpStr = (a: number[], b: number[], t: number) =>
  `${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)}`

// pre-rendered soft round glow sprite (tinted per draw via globalAlpha + hue overlay)
function makeGlow(color: string, size = 64): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  const [r, gr, b] = hexArr(color)
  grad.addColorStop(0, `rgba(${r},${gr},${b},1)`)
  grad.addColorStop(0.4, `rgba(${r},${gr},${b},0.45)`)
  grad.addColorStop(1, `rgba(${r},${gr},${b},0)`)
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return c
}

export function Stage2D({ audioRef, transportRef, eventsRef, playing, theme }: any) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const raf = useRef(0)
  const playingRef = useRef(playing); playingRef.current = playing
  const themeRef = useRef(theme); themeRef.current = theme
  const glows = useRef<Record<string, HTMLCanvasElement>>({})
  const dust = useMemo(() => Array.from({ length: 70 }, (_, i) => ({
    a: (i * 137.5) % 360, r: 0.55 + ((i * 61) % 100) / 210, s: 1.5 + ((i * 31) % 100) / 45, ph: (i * 97) % 628 / 100,
  })), [])

  const angle = useMemo(() => {
    const s = scaleBand<string>().domain(ROLES as string[]).range([0, Math.PI * 2]).padding(0)
    return (r: string) => (s(r) || 0) + s.bandwidth() / 2 - Math.PI / 2
  }, [])

  useEffect(() => {
    for (const role of ROLES as string[]) glows.current[role] = makeGlow(ROLE_COLOR[role])
    function frame() { const c = canvasRef.current; if (c) draw(c); raf.current = requestAnimationFrame(frame) }
    raf.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf.current)
  }, []) // eslint-disable-line

  function draw(c: HTMLCanvasElement) {
    const rect = c.getBoundingClientRect()
    // Guard: before layout settles (or if the element is detached) the box can
    // be 0 or the canvas's intrinsic 300×150 — skip rather than paint garbage.
    if (rect.width < 2 || rect.height < 2) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)          // cap DPR — no runaway buffers
    const W = Math.min(2400, Math.round(rect.width))               // cap CSS px too (safety net)
    const H = Math.min(2400, Math.round(rect.height))
    const bw = Math.max(1, Math.round(W * dpr)), bh = Math.max(1, Math.round(H * dpr))
    if (c.width !== bw || c.height !== bh) { c.width = bw; c.height = bh } // only resize on real change
    const g = c.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.31
    g.clearRect(0, 0, W, H)

    const cs = getComputedStyle(c)
    const tokv = (n: string, f: string) => cs.getPropertyValue(n).trim() || f
    const web = tokv('--bd2', '#2c2c37'), tx2 = tokv('--tx2', '#888')
    const accA = hexArr(tokv('--acc', '#6366f1')), magA = hexArr(tokv('--mag', '#ff3d72'))
    const accGlow = glows.current._acc || (glows.current._acc = makeGlow(tokv('--acc', '#6366f1'), 128))

    const a = audioRef.current
    const freq: Uint8Array | undefined = a?.freq
    if (a) a.analyser.getByteFrequencyData(freq)
    const now = performance.now(), rot = now * 0.000025
    const T = themeRef.current
    const evs = eventsRef.current as { role: string; born: number }[]
    const lastByRole: Record<string, number> = {}
    for (const e of evs) lastByRole[e.role] = Math.max(lastByRole[e.role] ?? -9999, e.born)
    let level = 0.28
    if (freq && playingRef.current) {
      let s = 0; const n = Math.floor(freq.length * 0.6)
      for (let i = 0; i < n; i++) s += freq[i]
      level = s / (n * 255)
    }

    // ambient dust — soft ROUND glows drifting on a shell
    for (const d of dust) {
      const ang = (d.a * Math.PI) / 180 + rot * (0.5 + d.r)
      const rr = Math.max(W, H) * 0.5 * d.r * (1 + Math.sin(now / 4000 + d.ph) * 0.04)
      const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr * 0.86
      const tw = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(now / 900 + d.ph * 3)) * (0.5 + level)
      g.globalAlpha = tw
      g.drawImage(accGlow, x - d.s * 2, y - d.s * 2, d.s * 4, d.s * 4)
    }
    g.globalAlpha = 1

    // node ring positions
    const nodePos: Record<string, [number, number]> = {}
    ;(ROLES as string[]).forEach((role: string) => {
      const ang = angle(role)
      nodePos[role] = [cx + Math.cos(ang) * R * 1.28, cy + Math.sin(ang) * R * 1.28]
    })

    // orbit ring (fine, replaces the old spokes-polygon web)
    g.strokeStyle = web; g.lineWidth = 1
    g.beginPath(); g.ellipse(cx, cy, R * 1.28, R * 1.28, 0, 0, Math.PI * 2); g.stroke()

    // radial spectrum — rounded caps, accent→magenta gradient, mirrored
    if (freq) {
      const bars = 96
      for (let i = 0; i < bars; i++) {
        const ang = (i / bars) * Math.PI * 2 - Math.PI / 2 + rot
        const k = i < bars / 2 ? i / (bars / 2) : (bars - i) / (bars / 2)
        const v = freq[Math.floor(k * freq.length * 0.62)] / 255
        const col = lerpStr(accA, magA, Math.min(1, v * 1.1))
        const inner = R * 0.62, outer = inner + (0.05 + v) * R * 0.5
        g.strokeStyle = `rgba(${col},${0.3 + v * 0.6})`
        g.lineWidth = 3; g.lineCap = 'round'
        g.beginPath()
        g.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner)
        g.lineTo(cx + Math.cos(ang) * outer, cy + Math.sin(ang) * outer)
        g.stroke()
      }
    }

    // layered luminous core (no wireframe): outer bloom, body, rim
    const coreR = R * 0.5 + level * 14
    let grad = g.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2.1)
    grad.addColorStop(0, `rgba(${accA.join(',')},${0.28 + level * 0.3})`)
    grad.addColorStop(1, `rgba(${accA.join(',')},0)`)
    g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, coreR * 2.1, 0, Math.PI * 2); g.fill()
    grad = g.createRadialGradient(cx - coreR * 0.25, cy - coreR * 0.3, 0, cx, cy, coreR)
    grad.addColorStop(0, `rgba(${lerpStr(accA, [255, 255, 255], 0.5)},${0.5 + level * 0.3})`)
    grad.addColorStop(0.65, `rgba(${accA.join(',')},${0.3 + level * 0.25})`)
    grad.addColorStop(1, `rgba(${magA.join(',')},0.12)`)
    g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, coreR, 0, Math.PI * 2); g.fill()
    g.strokeStyle = `rgba(${lerpStr(accA, magA, 0.4)},${0.5 + level * 0.4})`
    g.lineWidth = 1.5
    g.beginPath(); g.arc(cx, cy, coreR, 0, Math.PI * 2); g.stroke()

    // note trails: curved core → station, soft glow head + fading tail
    for (let i = evs.length - 1; i >= 0; i--) {
      const e = evs[i], age = now - e.born
      if (age > 900) { evs.splice(i, 1); continue }
      const [nx, ny] = nodePos[e.role] || [cx, cy]
      const sprite = glows.current[e.role]
      const side = e.born % 2 ? 1 : -1
      const ctrlx = cx + (nx - cx) * 0.5 - (ny - cy) * 0.18 * side
      const ctrly = cy + (ny - cy) * 0.5 + (nx - cx) * 0.18 * side
      for (let k = 0; k < 3; k++) {
        const p = Math.min(1, Math.max(0, age / 400 - k * 0.06))
        const inv = 1 - p
        const px = inv * inv * cx + 2 * inv * p * ctrlx + p * p * nx
        const py = inv * inv * cy + 2 * inv * p * ctrly + p * p * ny
        const s = (k === 0 ? 9 : 6 - k) * (1 - age / 1100)
        g.globalAlpha = (k === 0 ? 0.85 : 0.35) * (1 - age / 900)
        if (sprite) g.drawImage(sprite, px - s, py - s, s * 2, s * 2)
      }
      g.globalAlpha = 1
    }

    // stations: glow disc + rim + 270° level arc + typographic label (no emoji)
    ;(ROLES as string[]).forEach((role: string) => {
      const [x, y] = nodePos[role]
      const hot = now - (lastByRole[role] ?? -9999) < 240
      const hotP = hot ? 1 - (now - (lastByRole[role] ?? 0)) / 240 : 0
      const col = ROLE_COLOR[role]
      const colA = hexArr(col)
      const on = T?.roles?.[role]?.on ?? true
      const lvl = T?.roles?.[role]?.level ?? 0.5
      const orbR = 15 + hotP * 5
      const sprite = glows.current[role]
      // halo
      if (sprite) { g.globalAlpha = on ? 0.45 + hotP * 0.5 : 0.12; g.drawImage(sprite, x - orbR * 2.2, y - orbR * 2.2, orbR * 4.4, orbR * 4.4); g.globalAlpha = 1 }
      // body
      const bg = g.createRadialGradient(x - orbR * 0.3, y - orbR * 0.35, 0, x, y, orbR)
      bg.addColorStop(0, `rgba(${lerpStr(colA, [255, 255, 255], 0.55)},${on ? 0.95 : 0.35})`)
      bg.addColorStop(1, `rgba(${colA.join(',')},${on ? 0.85 : 0.25})`)
      g.fillStyle = bg
      g.beginPath(); g.arc(x, y, orbR, 0, Math.PI * 2); g.fill()
      // ripple on fire
      if (hot) {
        const p = 1 - hotP
        g.strokeStyle = `rgba(${colA.join(',')},${0.5 * hotP})`
        g.lineWidth = 2
        g.beginPath(); g.arc(x, y, orbR + 6 + p * 26, 0, Math.PI * 2); g.stroke()
      }
      // level arc
      const gr = orbR + 7, a0 = Math.PI * 0.75, span = Math.PI * 1.5
      g.lineWidth = 3; g.lineCap = 'round'
      g.strokeStyle = web; g.beginPath(); g.arc(x, y, gr, a0, a0 + span); g.stroke()
      g.strokeStyle = col; g.globalAlpha = on ? 1 : 0.35
      g.beginPath(); g.arc(x, y, gr, a0, a0 + span * (on ? lvl : 0)); g.stroke()
      g.globalAlpha = 1
      // label: clean type, role-colored, instrument beneath
      const ang = angle(role)
      const lx = cx + Math.cos(ang) * (R * 1.28 + 46), ly = cy + Math.sin(ang) * (R * 1.28 + 44)
      g.textAlign = 'center'; g.textBaseline = 'middle'
      g.font = '700 12.5px "Segoe UI", system-ui, sans-serif'
      try { (g as any).letterSpacing = '0.08em' } catch { /* older browsers */ }
      g.fillStyle = on ? col : tx2
      g.fillText(ROLE_LABEL[role].toUpperCase(), lx, ly)
      try { (g as any).letterSpacing = '0px' } catch { /* noop */ }
      const instId = role === 'drums' ? (T?.roles?.drums?.kit || '') : (T?.roles?.[role]?.inst || '')
      const instName = role === 'drums' ? instId : ((INSTRUMENTS as any)[instId]?.label || '')
      if (instName) { g.font = '10px ui-monospace, monospace'; g.fillStyle = tx2; g.fillText(instName, lx, ly + 14) }
    })
    void transportRef
  }

  // Canvas lives INSIDE a positioned .msx-viz div (matching Stage3D) so the
  // `.msx-viz canvas{width/height:100%}` rule sizes it — a bare absolutely-
  // positioned <canvas> is a replaced element and ignores inset:0, collapsing
  // to its intrinsic 300×150 (that was the tiny "2D not working" tile).
  return (
    <div className="msx-viz">
      <canvas ref={canvasRef} />
    </div>
  )
}
