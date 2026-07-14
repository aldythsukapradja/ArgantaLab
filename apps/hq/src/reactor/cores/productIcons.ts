import * as THREE from 'three'
import type { ProductId } from '../contract'

// ─────────────────────────────────────────────────────────────────────────
// Product icon textures — iOS-style app-tile faces for the product layer.
//
// Each product's mark is drawn once to an offscreen canvas (rounded-square
// background in the product colour + a white glyph) and reused as a texture
// on a 3D squircle tile. Mirrors the Portfolio AppLogo marks 1:1 so the
// reactor pods and the Five Products cards read as the same icon.
// ─────────────────────────────────────────────────────────────────────────

function roundedSquarePath(ctx: CanvasRenderingContext2D, s: number, radius: number) {
  const inset = s * 0.02
  const w = s - inset * 2
  ctx.beginPath()
  ctx.moveTo(inset + radius, inset)
  ctx.arcTo(inset + w, inset, inset + w, inset + w, radius)
  ctx.arcTo(inset + w, inset + w, inset, inset + w, radius)
  ctx.arcTo(inset, inset + w, inset, inset, radius)
  ctx.arcTo(inset, inset, inset + w, inset, radius)
  ctx.closePath()
}

const DRAW: Record<ProductId, (ctx: CanvasRenderingContext2D, s: number, color: string) => void> = {
  arganta: (ctx, s, color) => {
    roundedSquarePath(ctx, s, s * 0.22); ctx.fillStyle = color; ctx.fill()
    ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.06; ctx.lineJoin = 'round'; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(s * 0.5, s * 0.26); ctx.lineTo(s * 0.76, s * 0.39); ctx.lineTo(s * 0.5, s * 0.52); ctx.lineTo(s * 0.24, s * 0.39); ctx.closePath(); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(s * 0.35, s * 0.45); ctx.lineTo(s * 0.35, s * 0.6); ctx.quadraticCurveTo(s * 0.35, s * 0.69, s * 0.5, s * 0.69); ctx.quadraticCurveTo(s * 0.65, s * 0.69, s * 0.65, s * 0.6); ctx.lineTo(s * 0.65, s * 0.45); ctx.stroke()
  },
  kinetik: (ctx, s) => {
    const grad = ctx.createLinearGradient(0, 0, s, s); grad.addColorStop(0, '#22D3EE'); grad.addColorStop(1, '#8B5CF6')
    roundedSquarePath(ctx, s, s * 0.25); ctx.fillStyle = grad; ctx.fill()
    ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.arc(s * 0.5, s * 0.5, s * 0.205, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * 0.66, s * 0.34, s * 0.068, 0, Math.PI * 2); ctx.fill()
  },
  lashira: (ctx, s, color) => {
    roundedSquarePath(ctx, s, s * 0.22); ctx.fillStyle = color; ctx.fill()
    ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = s * 0.06; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(s * 0.5, s * 0.74); ctx.lineTo(s * 0.5, s * 0.5); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(s * 0.5, s * 0.5); ctx.quadraticCurveTo(s * 0.5, s * 0.3, s * 0.7, s * 0.26); ctx.quadraticCurveTo(s * 0.68, s * 0.46, s * 0.5, s * 0.5); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(s * 0.5, s * 0.58); ctx.quadraticCurveTo(s * 0.48, s * 0.42, s * 0.32, s * 0.36); ctx.quadraticCurveTo(s * 0.32, s * 0.54, s * 0.5, s * 0.58); ctx.closePath(); ctx.fill()
  },
  hq: (ctx, s, color) => {
    roundedSquarePath(ctx, s, s * 0.22); ctx.fillStyle = color; ctx.fill()
    ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.075; ctx.lineCap = 'round'; ctx.setLineDash([s * 0.1, s * 0.095])
    ctx.beginPath(); ctx.arc(s * 0.5, s * 0.5, s * 0.22, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([])
  },
  landing: (ctx, s, color) => {
    roundedSquarePath(ctx, s, s * 0.22); ctx.fillStyle = color; ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.moveTo(s * 0.5, s * 0.24); ctx.quadraticCurveTo(s * 0.7, s * 0.42, s * 0.64, s * 0.66); ctx.lineTo(s * 0.5, s * 0.58); ctx.lineTo(s * 0.36, s * 0.66); ctx.quadraticCurveTo(s * 0.3, s * 0.42, s * 0.5, s * 0.24); ctx.closePath(); ctx.fill()
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(s * 0.5, s * 0.42, s * 0.07, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.moveTo(s * 0.38, s * 0.62); ctx.lineTo(s * 0.26, s * 0.78); ctx.lineTo(s * 0.4, s * 0.7); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(s * 0.62, s * 0.62); ctx.lineTo(s * 0.74, s * 0.78); ctx.lineTo(s * 0.6, s * 0.7); ctx.closePath(); ctx.fill()
  },
}

const cache = new Map<string, THREE.CanvasTexture>()

export function getProductIconTexture(id: ProductId, color: string): THREE.CanvasTexture {
  const key = `${id}:${color}`
  const hit = cache.get(key)
  if (hit) return hit
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  DRAW[id](ctx, size, color)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.needsUpdate = true
  cache.set(key, texture)
  return texture
}
