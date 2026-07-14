import * as THREE from 'three'

// ─────────────────────────────────────────────────────────────────────────
// Label textures for the HUD dressing (O3). Each layer's name + micro-verb is
// drawn once to an offscreen canvas and shown on a camera-facing sprite, so
// it reads from any orbit angle and shares the 3D clock. Theme-aware.
// ─────────────────────────────────────────────────────────────────────────

const cache = new Map<string, THREE.CanvasTexture>()

export function makeLabelTexture(label: string, micro: string, dark: boolean): THREE.CanvasTexture {
  const key = `${label}|${micro}|${dark ? 'd' : 'l'}`
  const hit = cache.get(key)
  if (hit) return hit
  const w = 512
  const h = 160
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, w, h)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const main = dark ? '#eafcff' : '#123049'
  const sub = dark ? '#7fd8ef' : '#2f6e9e'
  ctx.shadowColor = dark ? 'rgba(70,232,255,.55)' : 'rgba(255,255,255,.9)'
  ctx.shadowBlur = dark ? 16 : 8
  ctx.font = '700 46px Inter, Arial, sans-serif'
  ctx.fillStyle = main
  ctx.fillText(label.toUpperCase(), 18, 58)
  ctx.font = '400 30px Inter, Arial, sans-serif'
  ctx.fillStyle = sub
  ctx.fillText(micro, 18, 110)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.needsUpdate = true
  cache.set(key, texture)
  return texture
}
