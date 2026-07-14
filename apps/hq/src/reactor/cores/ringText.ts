import * as THREE from 'three'

// ─────────────────────────────────────────────────────────────────────────
// Ring text — a layer's name drawn curved along a circular arc (arc-reactor
// HUD look). Rendered on a transparent square canvas whose text baseline sits
// at a fixed radius fraction, so mapping it onto a plane of side
// `radius / TEXT_RADIUS_FRAC` lands the text exactly on that layer's ring.
// Per-glyph advance is measured so spacing stays even across the arc.
// ─────────────────────────────────────────────────────────────────────────

const SIZE = 1024
/** Text baseline radius as a fraction of half the canvas. */
export const TEXT_RADIUS_FRAC = 0.4

const cache = new Map<string, THREE.CanvasTexture>()

export function makeRingTextTexture(
  text: string,
  color: string,
  opts: { startDeg?: number; fontPx?: number; glow?: string } = {},
): THREE.CanvasTexture {
  const startDeg = opts.startDeg ?? -90
  const fontPx = opts.fontPx ?? 44
  const key = `${text}|${color}|${startDeg}|${fontPx}`
  const hit = cache.get(key)
  if (hit) return hit

  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, SIZE, SIZE)
  const cx = SIZE / 2
  const cy = SIZE / 2
  const R = (SIZE / 2) * TEXT_RADIUS_FRAC
  ctx.font = `700 ${fontPx}px Inter, Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.shadowColor = opts.glow ?? color
  ctx.shadowBlur = 14

  const upper = text.toUpperCase()
  const spaced = upper.split('')
  const total = spaced.reduce((sum, ch) => sum + ctx.measureText(ch).width * 1.02, 0)
  const arc = total / R // radians the text subtends
  // Sweep clockwise (screen space) centred on startDeg; negate so text reads
  // left-to-right along the top of the ring.
  let angle = startDeg * (Math.PI / 180) - arc / 2

  for (const ch of spaced) {
    const w = ctx.measureText(ch).width * 1.02
    angle += (w / 2) / R
    const x = cx + Math.cos(angle) * R
    const y = cy + Math.sin(angle) * R
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle + Math.PI / 2) // tangent to the circle
    ctx.fillText(ch, 0, 0)
    ctx.restore()
    angle += (w / 2) / R
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.needsUpdate = true
  cache.set(key, texture)
  return texture
}
