import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { gsap } from 'gsap'
import * as THREE from 'three'
import { KB_NOTES } from '../vault/kb.generated'
import type { ProductId } from './Portfolio'
import { PRODUCT_ORBIT_META, type ReactorSignalState } from './reactorModel'

type QualityTier = 'high' | 'medium' | 'low'

type Palette = {
  core: string
  coreHot: string
  cyan: string
  blue: string
  violet: string
  line: string
  blending: THREE.Blending
}

const LIGHT: Palette = {
  core: '#1769ff', coreHot: '#f4fdff', cyan: '#00a9d6', blue: '#1769ff',
  violet: '#6548db', line: '#2565b8', blending: THREE.NormalBlending,
}
const DARK: Palette = {
  core: '#2c8cff', coreHot: '#f8feff', cyan: '#45e8ff', blue: '#287dff',
  violet: '#9a72ff', line: '#286cb8', blending: THREE.AdditiveBlending,
}

type LayerId = 'knowledge' | 'aiml' | 'agent' | 'ui' | 'platform'

const ARCHITECTURE_LAYERS: { id: LayerId; color: string; radius: number; thickness: number; segments: number; gap: number; speed: number; phase: number }[] = [
  { id: 'knowledge', color: '#8b5cf6', radius: 1.08, thickness: .022, segments: 18, gap: .28, speed: -.015, phase: .02 },
  { id: 'aiml', color: '#18b9a6', radius: 1.38, thickness: .028, segments: 12, gap: .22, speed: .012, phase: .21 },
  { id: 'agent', color: '#ff4f7d', radius: 1.71, thickness: .036, segments: 7, gap: .18, speed: -.009, phase: .05 },
  { id: 'ui', color: '#6366f1', radius: 2.05, thickness: .025, segments: 14, gap: .32, speed: .007, phase: .14 },
  { id: 'platform', color: '#647eaa', radius: 2.4, thickness: .033, segments: 10, gap: .2, speed: -.005, phase: .08 },
]

const PRODUCT_ROTATION_SECONDS = 160
const PRODUCT_ROTATION_SPEED = Math.PI * 2 / PRODUCT_ROTATION_SECONDS

type KnowledgeAtom = { key: string; family: number }

function hash(input: string) {
  let value = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

// Every particle is derived from the generated Vault: note roots, headings,
// wiki references and content blocks. Geometry communicates structure only;
// it never invents business activity or synthetic performance data.
const KNOWLEDGE_ATOMS: KnowledgeAtom[] = (() => {
  const atoms: KnowledgeAtom[] = []
  KB_NOTES.forEach((note, family) => {
    atoms.push({ key: note.id, family })
    const headings = note.md.match(/^#{1,6}\s+.+$/gm) ?? []
    headings.forEach((heading, index) => atoms.push({ key: `${note.id}:heading:${index}:${heading}`, family }))
    const links = Array.from(note.md.matchAll(/\[\[([^\]|#]+)/g)).map(match => match[1].trim())
    Array.from(new Set(links)).forEach((link, index) => atoms.push({ key: `${note.id}:link:${index}:${link}`, family }))
    const blocks = Math.min(10, Math.max(1, Math.floor(note.md.length / 640)))
    for (let index = 0; index < blocks; index += 1) atoms.push({ key: `${note.id}:block:${index}`, family })
  })
  return atoms.slice(0, 2800)
})()

function pointLimit(tier: QualityTier) {
  if (tier === 'high') return 2800
  if (tier === 'medium') return 1650
  return 620
}

function makePointGeometry(limit: number) {
  const atoms = KNOWLEDGE_ATOMS.slice(0, limit)
  const positions = new Float32Array(atoms.length * 3)
  const sizes = new Float32Array(atoms.length)
  const phases = new Float32Array(atoms.length)
  const drifts = new Float32Array(atoms.length)
  const tones = new Float32Array(atoms.length)

  atoms.forEach((atom, index) => {
    const seed = hash(atom.key)
    const u = ((seed & 0xffff) + .5) / 65536
    const v = (((seed >>> 16) & 0xffff) + .5) / 65536
    const theta = Math.PI * 2 * u
    const phi = Math.acos(1 - 2 * v)
    const shell = index % 17 === 0 ? 2.76 : index % 7 === 0 ? 2.43 : .92 + ((seed >>> 8) % 1530) / 1000
    const flatten = .82 + ((seed >>> 24) % 15) / 100
    positions[index * 3] = Math.sin(phi) * Math.cos(theta) * shell
    positions[index * 3 + 1] = Math.cos(phi) * shell * flatten
    positions[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * shell
    sizes[index] = index % 41 === 0 ? 5.9 : index % 13 === 0 ? 3.6 : 1.35 + (seed % 120) / 100
    phases[index] = u * Math.PI * 2
    drifts[index] = .28 + v * .72
    tones[index] = (atom.family % 7) / 6
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
  geometry.setAttribute('aDrift', new THREE.BufferAttribute(drifts, 1))
  geometry.setAttribute('aTone', new THREE.BufferAttribute(tones, 1))
  geometry.computeBoundingSphere()
  return { geometry, atoms }
}

// A halo built from scattered glowing dust instead of a single flat stroke —
// each point varies in size/tone/twinkle like a small graph node, echoing a
// knowledge-node field rather than a plain drafting-compass circle.
function makeCoreDustGeometry(count: number, radius: number, spread: number) {
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const phases = new Float32Array(count)
  const drifts = new Float32Array(count)
  const tones = new Float32Array(count)
  for (let index = 0; index < count; index += 1) {
    const seed = hash(`core-dust-${index}`)
    const angle = ((seed & 0xffff) / 65536) * Math.PI * 2
    const jitter = (((seed >>> 16) & 0xff) / 255 - .5) * spread
    const r = radius + jitter
    positions[index * 3] = Math.cos(angle) * r
    positions[index * 3 + 1] = Math.sin(angle) * r
    positions[index * 3 + 2] = (((seed >>> 24) & 0xff) / 255 - .5) * spread * .5
    const major = index % 13 === 0
    sizes[index] = major ? 3.4 : 1.0 + ((seed >>> 8) & 0x3f) / 63
    phases[index] = angle
    drifts[index] = .25 + ((seed >>> 4) & 0xff) / 255 * .85
    tones[index] = ((index * 7) % 11) / 10
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
  geometry.setAttribute('aDrift', new THREE.BufferAttribute(drifts, 1))
  geometry.setAttribute('aTone', new THREE.BufferAttribute(tones, 1))
  geometry.computeBoundingSphere()
  return geometry
}

const RING_DUST_VERTEX = `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSize;
  attribute float aPhase;
  attribute float aDrift;
  attribute float aTone;
  varying float vTone;
  varying float vTwinkle;
  void main() {
    vec3 p = position;
    float angle = uTime * (0.05 + aDrift * 0.05);
    float c = cos(angle), s = sin(angle);
    p.xy = mat2(c, -s, s, c) * p.xy;
    float radial = 1.0 + sin(uTime * 0.6 + aPhase * 6.0) * 0.035;
    p.xy *= radial;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * clamp(9.0 / -mv.z, 0.7, 2.4);
    vTone = aTone;
    vTwinkle = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.8 + aDrift * 1.4) + aPhase * 9.0));
  }
`
const RING_DUST_FRAGMENT = `
  precision highp float;
  uniform vec3 uCyan;
  uniform vec3 uBlue;
  uniform vec3 uViolet;
  varying float vTone;
  varying float vTwinkle;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float core = smoothstep(0.26, 0.0, d);
    float halo = smoothstep(0.5, 0.08, d);
    vec3 color = vTone < 0.5 ? mix(uCyan, uBlue, vTone * 2.0) : mix(uBlue, uViolet, (vTone - 0.5) * 2.0);
    gl_FragColor = vec4(color * (0.7 + core * 1.6), halo * vTwinkle);
  }
`

const POINT_VERTEX = `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSize;
  attribute float aPhase;
  attribute float aDrift;
  attribute float aTone;
  varying float vTone;
  varying float vPulse;
  void main() {
    vec3 p = position;
    float angle = uTime * (0.011 + aDrift * 0.016) + aPhase * 0.014;
    float c = cos(angle), s = sin(angle);
    p.xz = mat2(c, -s, s, c) * p.xz;
    p += normalize(p) * sin(uTime * 0.28 + aPhase * 5.0) * (0.009 + aDrift * 0.012);
    p.y += sin(uTime * 0.09 + aPhase) * 0.018;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * clamp(7.0 / -mv.z, 0.62, 2.1);
    vTone = aTone;
    vPulse = 0.62 + 0.38 * sin(uTime * 0.58 + aPhase * 11.0);
  }
`

const POINT_FRAGMENT = `
  precision highp float;
  uniform vec3 uCyan;
  uniform vec3 uBlue;
  uniform vec3 uViolet;
  varying float vTone;
  varying float vPulse;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float core = smoothstep(0.24, 0.0, d);
    float halo = smoothstep(0.5, 0.06, d);
    vec3 color = vTone < 0.52 ? mix(uCyan, uBlue, vTone * 1.92) : mix(uBlue, uViolet, (vTone - 0.52) * 2.08);
    gl_FragColor = vec4(color * (0.72 + core * 1.9), halo * (0.38 + vPulse * 0.52));
  }
`

// --- Canvas-texture glyphs -------------------------------------------------
// Every icon used inside the reactor (product logos, architecture-layer
// glyphs) is drawn once to an offscreen canvas and reused as a transparent
// THREE.Sprite texture. No DOM/CSS is involved, so every icon shares the
// exact same rotation clock as the 3D group it belongs to.

function makeIconTexture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  draw(ctx, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

function roundedSquarePath(ctx: CanvasRenderingContext2D, s: number, radius: number) {
  const inset = s * .06
  const w = s - inset * 2
  ctx.beginPath()
  ctx.moveTo(inset + radius, inset)
  ctx.arcTo(inset + w, inset, inset + w, inset + w, radius)
  ctx.arcTo(inset + w, inset + w, inset, inset + w, radius)
  ctx.arcTo(inset, inset + w, inset, inset, radius)
  ctx.arcTo(inset, inset, inset + w, inset, radius)
  ctx.closePath()
}

// Mirrors AppLogo (Portfolio.tsx) 1:1 — same bg tone per product, same glyph
// silhouette — so the reactor pod and the Five Products card read as the
// exact same mark, just rendered as a GPU texture instead of DOM/SVG.
const PRODUCT_LOGO_DRAW: Record<ProductId, (ctx: CanvasRenderingContext2D, s: number, color: string) => void> = {
  arganta: (ctx, s, color) => {
    roundedSquarePath(ctx, s, s * .22)
    ctx.fillStyle = color
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = s * .075
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    // graduation cap: diamond board + hanging tassel, same read as lucide's GraduationCap
    ctx.beginPath()
    ctx.moveTo(s * .5, s * .24)
    ctx.lineTo(s * .78, s * .38)
    ctx.lineTo(s * .5, s * .52)
    ctx.lineTo(s * .22, s * .38)
    ctx.closePath()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(s * .34, s * .44)
    ctx.lineTo(s * .34, s * .6)
    ctx.quadraticCurveTo(s * .34, s * .7, s * .5, s * .7)
    ctx.quadraticCurveTo(s * .66, s * .7, s * .66, s * .6)
    ctx.lineTo(s * .66, s * .44)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(s * .78, s * .38)
    ctx.lineTo(s * .78, s * .58)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(s * .78, s * .63, s * .028, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
  },
  kinetik: (ctx, s) => {
    // identical gradient-ring mark used by AppLogo's raw <svg> for Kinetik
    const grad = ctx.createLinearGradient(0, 0, s, s)
    grad.addColorStop(0, '#22D3EE')
    grad.addColorStop(1, '#8B5CF6')
    roundedSquarePath(ctx, s, s * .25)
    ctx.fillStyle = grad
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = s * .08
    ctx.beginPath()
    ctx.arc(s * .5, s * .5, s * .205, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(s * .66, s * .34, s * .068, 0, Math.PI * 2)
    ctx.fill()
  },
  lashira: (ctx, s, color) => {
    roundedSquarePath(ctx, s, s * .22)
    ctx.fillStyle = color
    ctx.fill()
    // sprout: two curved leaves rising from a stem, matches lucide's Sprout
    ctx.strokeStyle = '#fff'
    ctx.fillStyle = '#fff'
    ctx.lineWidth = s * .06
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(s * .5, s * .74)
    ctx.lineTo(s * .5, s * .5)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(s * .5, s * .5)
    ctx.quadraticCurveTo(s * .5, s * .3, s * .7, s * .26)
    ctx.quadraticCurveTo(s * .68, s * .46, s * .5, s * .5)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(s * .5, s * .58)
    ctx.quadraticCurveTo(s * .48, s * .42, s * .32, s * .36)
    ctx.quadraticCurveTo(s * .32, s * .54, s * .5, s * .58)
    ctx.closePath()
    ctx.fill()
  },
  hq: (ctx, s, color) => {
    roundedSquarePath(ctx, s, s * .22)
    ctx.fillStyle = color
    ctx.fill()
    // dashed ring, matches lucide's CircleDashed
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = s * .075
    ctx.lineCap = 'round'
    ctx.setLineDash([s * .1, s * .095])
    ctx.beginPath()
    ctx.arc(s * .5, s * .5, s * .22, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  },
  landing: (ctx, s, color) => {
    roundedSquarePath(ctx, s, s * .22)
    ctx.fillStyle = color
    ctx.fill()
    // rocket: body + nose + two side fins, matches lucide's Rocket
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.moveTo(s * .5, s * .22)
    ctx.quadraticCurveTo(s * .7, s * .4, s * .64, s * .66)
    ctx.lineTo(s * .5, s * .58)
    ctx.lineTo(s * .36, s * .66)
    ctx.quadraticCurveTo(s * .3, s * .4, s * .5, s * .22)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(s * .5, s * .4, s * .07, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.moveTo(s * .38, s * .62)
    ctx.lineTo(s * .26, s * .78)
    ctx.lineTo(s * .4, s * .7)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(s * .62, s * .62)
    ctx.lineTo(s * .74, s * .78)
    ctx.lineTo(s * .6, s * .7)
    ctx.closePath()
    ctx.fill()
  },
}

function drawLayerGlyph(ctx: CanvasRenderingContext2D, s: number, color: string, id: LayerId, variant: number) {
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = s * .05
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const c = s / 2
  if (id === 'knowledge') {
    // micro-dots + database-stack glyph
    for (let ring = 0; ring < 3; ring += 1) {
      const ry = s * (.3 + ring * .13)
      ctx.beginPath()
      ctx.ellipse(c, ry, s * .22, s * .07, 0, 0, Math.PI * 2)
      ctx.globalAlpha = ring === 0 ? .95 : .55
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    if (variant === 1) {
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2
        ctx.beginPath()
        ctx.arc(c + Math.cos(a) * s * .34, c + Math.sin(a) * s * .34, s * .028, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    return
  }
  if (id === 'aiml') {
    // waveform arc + neural pulse node
    ctx.beginPath()
    for (let i = 0; i <= 24; i += 1) {
      const x = s * .16 + (s * .68) * (i / 24)
      const y = c + Math.sin(i / 24 * Math.PI * (variant === 1 ? 3 : 2)) * s * .16
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(c, c, s * .05, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  if (id === 'agent') {
    // segmented command rail + agent glyph
    roundedSquarePath(ctx, s * .62, s * .1)
    ctx.save()
    ctx.translate(s * .19, s * .19)
    ctx.stroke()
    ctx.restore()
    ctx.beginPath()
    ctx.arc(c - s * .11, c, s * .045, 0, Math.PI * 2)
    ctx.arc(c + s * .11, c, s * .045, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(c - s * .14, c + s * .16)
    ctx.lineTo(c + s * .14, c + s * .16)
    ctx.stroke()
    return
  }
  if (id === 'ui') {
    // viewport brackets + cursor signal
    const b = s * .16
    const arm = s * .14
    ;[[b, b, 1, 1], [s - b, b, -1, 1], [b, s - b, 1, -1], [s - b, s - b, -1, -1]].forEach(([x, y, dx, dy]) => {
      ctx.beginPath()
      ctx.moveTo(x + arm * dx, y)
      ctx.lineTo(x, y)
      ctx.lineTo(x, y + arm * dy)
      ctx.stroke()
    })
    if (variant === 1) {
      ctx.beginPath()
      ctx.moveTo(c - s * .06, c - s * .1)
      ctx.lineTo(c + s * .1, c + s * .04)
      ctx.lineTo(c + s * .01, c + s * .06)
      ctx.lineTo(c + s * .03, c + s * .16)
      ctx.lineTo(c - s * .06, c - s * .1)
      ctx.fill()
    }
    return
  }
  // platform / infrastructure — hexagon relay + cloud/shield/server
  ctx.beginPath()
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i - Math.PI / 2
    const x = c + Math.cos(a) * s * .3
    const y = c + Math.sin(a) * s * .3
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.stroke()
  if (variant === 0) {
    for (let row = 0; row < 3; row += 1) {
      ctx.beginPath()
      ctx.moveTo(c - s * .13, c - s * .12 + row * s * .12)
      ctx.lineTo(c + s * .13, c - s * .12 + row * s * .12)
      ctx.stroke()
    }
  } else {
    ctx.beginPath()
    ctx.arc(c, c - s * .02, s * .12, Math.PI * .15, Math.PI * .85, true)
    ctx.arc(c - s * .1, c, s * .09, Math.PI * .5, Math.PI * 1.55, true)
    ctx.arc(c + s * .1, c, s * .09, Math.PI * 1.45, Math.PI * .45, true)
    ctx.fill()
  }
}

function useIgnition(ref: React.RefObject<THREE.Group>, delay: number, timeScale: number, immediate: boolean, ease = 'power3.out') {
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    gsap.killTweensOf(node.scale)
    if (immediate) {
      node.scale.setScalar(1)
      return
    }
    node.scale.setScalar(.001)
    const tween = gsap.to(node.scale, {
      x: 1, y: 1, z: 1,
      duration: .72 * timeScale,
      delay: delay * timeScale,
      ease,
    })
    return () => { tween.kill() }
  }, [delay, ease, immediate, ref, timeScale])
}

function KnowledgeField({ palette, tier, timeScale, immediate, reducedMotion }: {
  palette: Palette; tier: QualityTier; timeScale: number; immediate: boolean; reducedMotion: boolean
}) {
  const group = useRef<THREE.Group>(null)
  const material = useRef<THREE.ShaderMaterial>(null)
  const model = useMemo(() => makePointGeometry(pointLimit(tier)), [tier])
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, tier === 'high' ? 1.25 : tier === 'medium' ? 1.4 : 1) },
    uCyan: { value: new THREE.Color(palette.cyan) },
    uBlue: { value: new THREE.Color(palette.blue) },
    uViolet: { value: new THREE.Color(palette.violet) },
  }), [palette, tier])
  // Particles ignite late — they expand outward once the architecture,
  // arcs and logos have already locked into place.
  useIgnition(group, 2.7, timeScale, immediate, 'expo.out')

  useFrame((state, delta) => {
    if (group.current && !reducedMotion) {
      group.current.rotation.y += delta * .011
      group.current.rotation.z = Math.sin(state.clock.elapsedTime * .055) * .042
      group.current.rotation.x = Math.sin(state.clock.elapsedTime * .038) * .026
    }
    if (material.current) material.current.uniforms.uTime.value = reducedMotion ? 0 : state.clock.elapsedTime
  })

  useEffect(() => () => { model.geometry.dispose() }, [model])

  return (
    <group ref={group}>
      <points geometry={model.geometry}>
        <shaderMaterial ref={material} vertexShader={POINT_VERTEX} fragmentShader={POINT_FRAGMENT} uniforms={uniforms}
          transparent depthWrite={false} blending={palette.blending} toneMapped={false} />
      </points>
    </group>
  )
}

function ArchitectureRings({ palette, tier, timeScale, immediate, reducedMotion }: {
  palette: Palette; tier: QualityTier; timeScale: number; immediate: boolean; reducedMotion: boolean
}) {
  const refs = useRef<THREE.Group[]>([])
  const glyphMaterialRefs = useRef<THREE.SpriteMaterial[][]>([])
  const segmentMaterialRefs = useRef<THREE.MeshBasicMaterial[][]>([])

  useLayoutEffect(() => {
    const layers = refs.current.filter(Boolean)
    layers.forEach(layer => gsap.killTweensOf(layer.scale))
    if (immediate) {
      layers.forEach(layer => layer.scale.setScalar(1))
      glyphMaterialRefs.current.flat().forEach(material => { if (material) material.opacity = .85 })
      return
    }
    layers.forEach(layer => layer.scale.setScalar(.001))
    // Architecture activates inside-out; each layer's glyphs acquire signal
    // individually, a beat after that layer's own ring locks in.
    const timeline = gsap.timeline({ delay: .55 * timeScale })
    layers.forEach((layer, index) => {
      const start = index * .16 * timeScale
      timeline.to(layer.scale, { x: 1, y: 1, z: 1, duration: .42 * timeScale, ease: 'back.out(1.8)' }, start)
      const glyphMaterials = glyphMaterialRefs.current[index] ?? []
      glyphMaterials.forEach((material, glyphIndex) => {
        if (!material) return
        timeline.to(material, { opacity: .85, duration: .3 * timeScale }, start + .22 * timeScale + glyphIndex * .05 * timeScale)
      })
    })
    return () => { timeline.kill() }
  }, [immediate, timeScale])

  useFrame((state, delta) => {
    if (reducedMotion) return
    const elapsed = state.clock.elapsedTime
    refs.current.forEach((layer, index) => {
      if (layer) layer.rotation.z += delta * ARCHITECTURE_LAYERS[index].speed
    })
    // A traveling brightness wave per layer — each ring's data "flows" at its
    // own speed and direction, so the five layers read as five distinct
    // living systems instead of one static striped ball.
    segmentMaterialRefs.current.forEach((materials, layerIndex) => {
      const layer = ARCHITECTURE_LAYERS[layerIndex]
      const base = palette.blending === THREE.NormalBlending ? .82 : .74
      const scanSpeed = 1.1 + layerIndex * .45
      const direction = layer.speed < 0 ? -1 : 1
      materials.forEach((material, index) => {
        if (!material) return
        const wave = .5 + .5 * Math.sin(direction * elapsed * scanSpeed - index * (Math.PI * 2 / Math.max(4, layer.segments)) * 2.2)
        material.opacity = base * (.55 + wave * .75)
      })
    })
  })

  return (
    <group rotation={[.045, 0, 0]}>
      {ARCHITECTURE_LAYERS.map((layer, layerIndex) => {
        const sector = Math.PI * 2 / layer.segments
        const arc = sector * (1 - layer.gap)
        return (
          <group key={layer.id} ref={node => { if (node) refs.current[layerIndex] = node }} rotation={[0, 0, layer.phase]}>
            <mesh>
              <torusGeometry args={[layer.radius + .045, .005, 4, 128]} />
              <meshBasicMaterial color={layer.color} transparent opacity={palette.blending === THREE.NormalBlending ? .28 : .2} blending={palette.blending} depthWrite={false} />
            </mesh>
            {Array.from({ length: layer.segments }, (_, index) => (
              <mesh key={index} rotation={[0, 0, index * sector]}>
                <torusGeometry args={[layer.radius, layer.thickness, 6, 22, arc]} />
                <meshBasicMaterial ref={node => {
                  if (!node) return
                  ;(segmentMaterialRefs.current[layerIndex] ??= [])[index] = node
                }} color={layer.color} transparent opacity={palette.blending === THREE.NormalBlending ? .82 : .74}
                  blending={palette.blending} depthWrite={false} toneMapped={false} />
              </mesh>
            ))}
            <GlyphMaterialCollector layer={layer} tier={tier} blending={palette.blending}
              onMaterials={materials => { glyphMaterialRefs.current[layerIndex] = materials }} />
          </group>
        )
      })}
    </group>
  )
}

// Wraps LayerGlyphs so ArchitectureRings can reach into its sprite materials
// for the ignition opacity timeline without prop-drilling refs through JSX.
function GlyphMaterialCollector({ layer, tier, blending, onMaterials }: {
  layer: typeof ARCHITECTURE_LAYERS[number]; tier: QualityTier; blending: THREE.Blending
  onMaterials: (materials: THREE.SpriteMaterial[]) => void
}) {
  const count = tier === 'high' ? 4 : tier === 'medium' ? 3 : 2
  const variants = layer.id === 'platform' ? 2 : 1
  const materials = useMemo(() => Array.from({ length: variants }, (_, variant) => {
    const texture = makeIconTexture(96, (ctx, s) => drawLayerGlyph(ctx, s, layer.color, layer.id, variant))
    texture.colorSpace = THREE.SRGBColorSpace
    return new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false, blending, toneMapped: false })
  }), [layer.color, layer.id, variants, blending])

  const glyphs = useMemo(() => Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + layer.phase * 3.4
    const scale = layer.radius * .22
    return {
      key: `${layer.id}-${index}`,
      material: materials[index % materials.length],
      position: [Math.cos(angle) * layer.radius, Math.sin(angle) * layer.radius, .02] as [number, number, number],
      scale,
    }
  }), [count, layer.id, layer.phase, layer.radius, materials])

  useEffect(() => {
    onMaterials(materials)
  }, [materials, onMaterials])

  useEffect(() => () => {
    materials.forEach(material => { material.map?.dispose(); material.dispose() })
  }, [materials])

  return (
    <>
      {glyphs.map(glyph => (
        <sprite key={glyph.key} position={glyph.position} scale={[glyph.scale, glyph.scale, 1]} material={glyph.material} />
      ))}
    </>
  )
}

function ProductOrbit({ palette, selected, onSelect, onHover, timeScale, immediate, reducedMotion }: {
  palette: Palette
  selected?: ProductId | null
  onSelect?: (product: ProductId) => void
  onHover?: (product: ProductId | null) => void
  timeScale: number
  immediate: boolean
  reducedMotion: boolean
}) {
  const group = useRef<THREE.Group>(null)
  const logoGroup = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState<ProductId | null>(null)
  // Arcs deploy and lock only after the architecture layers have settled.
  useIgnition(group, 1.7, timeScale, immediate, 'back.out(1.6)')
  // Logos attach a beat after their arc has locked into place.
  useIgnition(logoGroup, 2.25, timeScale, immediate, 'back.out(2.2)')

  const logoMaterials = useMemo(() => PRODUCT_ORBIT_META.map(product => {
    const texture = makeIconTexture(192, (ctx, s) => PRODUCT_LOGO_DRAW[product.id](ctx, s, product.color))
    texture.colorSpace = THREE.SRGBColorSpace
    return new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false })
  }), [])

  useEffect(() => () => {
    logoMaterials.forEach(material => { material.map?.dispose(); material.dispose() })
  }, [logoMaterials])

  useEffect(() => () => { document.body.style.cursor = '' }, [])
  useFrame((_, delta) => {
    if (!reducedMotion) {
      if (group.current) group.current.rotation.z += delta * PRODUCT_ROTATION_SPEED
      // Logos live in their own group so a sprite's world position always
      // lands at the arc midpoint, but they share the identical clock —
      // there is no independent CSS/DOM rotation anywhere in this system.
      if (logoGroup.current) logoGroup.current.rotation.z += delta * PRODUCT_ROTATION_SPEED
    }
  })

  const sector = Math.PI * 2 / PRODUCT_ORBIT_META.length
  const gap = .28
  const arc = sector - gap
  const choose = (event: ThreeEvent<MouseEvent>, product: ProductId) => {
    event.stopPropagation()
    onSelect?.(product)
  }
  const enter = (event: ThreeEvent<PointerEvent>, product: ProductId) => {
    event.stopPropagation()
    setHovered(product)
    onHover?.(product)
    document.body.style.cursor = 'pointer'
  }
  const leave = () => {
    setHovered(null)
    onHover?.(null)
    document.body.style.cursor = ''
  }

  return (
    <>
      <group ref={group} rotation={[.025, 0, 0]}>
        {PRODUCT_ORBIT_META.map((product, index) => {
          const start = -Math.PI / 2 + index * sector + gap / 2
          const end = start + arc
          const active = hovered === product.id || selected === product.id
          const thickness = product.role === 'primary' ? .061 : product.role === 'governance' ? .047 : .041
          return (
            <group key={product.id}>
              <mesh rotation={[0, 0, start]}>
                <torusGeometry args={[3.12, active ? thickness * 1.22 : thickness, 8, 92, arc]} />
                <meshBasicMaterial color={product.color} transparent opacity={active ? 1 : product.role === 'primary' ? .78 : .62}
                  blending={palette.blending} depthWrite={false} toneMapped={false} />
              </mesh>
              <mesh rotation={[0, 0, start]}>
                <torusGeometry args={[3.22, .009, 5, 80, arc]} />
                <meshBasicMaterial color={product.color} transparent opacity={active ? .86 : .29}
                  blending={palette.blending} depthWrite={false} toneMapped={false} />
              </mesh>
              <mesh rotation={[0, 0, start]} onClick={event => choose(event, product.id)}
                onPointerEnter={event => enter(event, product.id)} onPointerLeave={leave}>
                <torusGeometry args={[3.12, .145, 6, 72, arc]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
              {[start, end].map((angle, capIndex) => (
                <mesh key={capIndex} position={[Math.cos(angle) * 3.12, Math.sin(angle) * 3.12, .015]}>
                  <sphereGeometry args={[active ? .055 : .04, 12, 12]} />
                  <meshBasicMaterial color={product.color} transparent opacity={active ? 1 : .72}
                    blending={palette.blending} depthWrite={false} toneMapped={false} />
                </mesh>
              ))}
            </group>
          )
        })}
      </group>
      <group ref={logoGroup} rotation={[.025, 0, 0]}>
        {PRODUCT_ORBIT_META.map((product, index) => {
          // The blank gap between two arcs is centered on the sector boundary
          // (-90deg + index*sector), NOT the arc's own midpoint — placing the
          // logo there keeps it in open space instead of on top of the line.
          const mid = -Math.PI / 2 + index * sector
          const active = hovered === product.id || selected === product.id
          // Sized to the gap's chord (2 * radius * sin(gap / 2) ≈ .87) so the
          // logo fills the space between the two arc ends without overlapping them.
          const scale = active ? .84 : .74
          return (
            <sprite key={product.id} position={[Math.cos(mid) * 3.12, Math.sin(mid) * 3.12, .05]}
              scale={[scale, scale, 1]} material={logoMaterials[index]}
              onClick={event => choose(event, product.id)}
              onPointerEnter={event => enter(event, product.id)} onPointerLeave={leave} />
          )
        })}
      </group>
    </>
  )
}

function CalibrationTicks({ palette, signalState, timeScale, immediate, reducedMotion }: {
  palette: Palette; signalState: ReactorSignalState; timeScale: number; immediate: boolean; reducedMotion: boolean
}) {
  const group = useRef<THREE.Group>(null)
  const materials = useRef<THREE.MeshBasicMaterial[]>([])
  // Calibration ticks are the last ring to arrive, just before the shockwave.
  useIgnition(group, 3.05, timeScale, immediate, 'power4.out')
  const color = signalState === 'live' ? '#4be5bd' : signalState === 'partial' ? '#f5b54f' : palette.line
  const baseOpacity = signalState === 'offline' ? .16 : .42
  const tickCount = 12
  const sector = Math.PI * 2 / tickCount

  useFrame((state) => {
    if (!reducedMotion && group.current) group.current.rotation.z -= .0009
    materials.current.forEach((material, index) => {
      if (!material) return
      const pulse = reducedMotion ? 1 : .55 + .45 * Math.sin(state.clock.elapsedTime * .6 + index * 1.7)
      material.opacity = baseOpacity * pulse
    })
  })

  return (
    <group ref={group} rotation={[.015, 0, .04]}>
      {Array.from({ length: tickCount }, (_, index) => (
        <mesh key={index} rotation={[0, 0, index * sector]}>
          <torusGeometry args={[3.48, .01, 4, 6, sector * .16]} />
          <meshBasicMaterial ref={node => { if (node) materials.current[index] = node }} color={color}
            transparent opacity={baseOpacity} blending={palette.blending} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

const CORE_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const CORE_FRAGMENT = `
  precision highp float;
  uniform float uTime;
  uniform vec3 uCore;
  uniform vec3 uHot;
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    float facing = max(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0);
    float bands = sin(vPosition.y * 19.0 - uTime * 0.74) * 0.075;
    float energy = pow(facing, 2.0) + bands;
    vec3 color = mix(uCore, uHot, smoothstep(0.40, 1.08, energy) * 0.78);
    gl_FragColor = vec4(color * (0.62 + facing * 1.36), 1.0);
  }
`

function EnergyCore({ palette, timeScale, immediate, reducedMotion }: {
  palette: Palette; timeScale: number; immediate: boolean; reducedMotion: boolean
}) {
  const boot = useRef<THREE.Group>(null)
  const pulse = useRef<THREE.Group>(null)
  const material = useRef<THREE.ShaderMaterial>(null)
  const dustMaterial = useRef<THREE.ShaderMaterial>(null)
  const shockwave = useRef<THREE.Mesh>(null)
  const shockMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const bladeGroup = useRef<THREE.Group>(null)
  const casingGroup = useRef<THREE.Group>(null)
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uCore: { value: new THREE.Color(palette.core) }, uHot: { value: new THREE.Color(palette.coreHot) },
  }), [palette])
  const dustGeometry = useMemo(() => makeCoreDustGeometry(150, .83, .16), [])
  const dustUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.4) },
    uCyan: { value: new THREE.Color(palette.cyan) },
    uBlue: { value: new THREE.Color(palette.blue) },
    uViolet: { value: new THREE.Color(palette.violet) },
  }), [palette])
  useEffect(() => () => dustGeometry.dispose(), [dustGeometry])
  // The core is the very first thing to spark, at a small scale, well before
  // anything else in the reactor ignites.
  useIgnition(boot, .12, timeScale, immediate, 'back.out(2.4)')

  useLayoutEffect(() => {
    if (!shockwave.current || !shockMaterial.current) return
    gsap.killTweensOf(shockwave.current.scale)
    gsap.killTweensOf(shockMaterial.current)
    if (immediate) {
      shockwave.current.scale.setScalar(1)
      shockMaterial.current.opacity = .08
      return
    }
    shockwave.current.scale.setScalar(.2)
    shockMaterial.current.opacity = 0
    // The shockwave is the reactor's final "ready" confirmation — it fires
    // after every other system (layers, glyphs, arcs, logos, particles) has
    // already settled.
    const timeline = gsap.timeline({ delay: 3.25 * timeScale })
      .to(shockMaterial.current, { opacity: .58, duration: .16 * timeScale })
      .to(shockwave.current.scale, { x: 3.8, y: 3.8, z: 3.8, duration: .72 * timeScale, ease: 'power3.out' }, '<')
      .to(shockMaterial.current, { opacity: 0, duration: .56 * timeScale }, '-=.46')
    return () => { timeline.kill() }
  }, [immediate, timeScale])

  useFrame((state, delta) => {
    if (material.current) material.current.uniforms.uTime.value = reducedMotion ? 0 : state.clock.elapsedTime
    if (dustMaterial.current) dustMaterial.current.uniforms.uTime.value = reducedMotion ? 0 : state.clock.elapsedTime
    if (pulse.current) {
      const amount = reducedMotion ? 1 : 1 + Math.sin(state.clock.elapsedTime * .72) * .024
      pulse.current.scale.setScalar(amount)
    }
    if (!reducedMotion) {
      if (bladeGroup.current) bladeGroup.current.rotation.z += delta * .32
      if (casingGroup.current) casingGroup.current.rotation.z -= delta * .05
    }
  })

  return (
    <group ref={boot}>
      <group ref={pulse}>
        <mesh><sphereGeometry args={[.49, 56, 56]} /><shaderMaterial ref={material} uniforms={uniforms} vertexShader={CORE_VERTEX} fragmentShader={CORE_FRAGMENT} toneMapped={false} /></mesh>
        <mesh><sphereGeometry args={[.72, 36, 36]} /><meshBasicMaterial color={palette.cyan} transparent opacity={.065} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
        <points geometry={dustGeometry}>
          <shaderMaterial ref={dustMaterial} vertexShader={RING_DUST_VERTEX} fragmentShader={RING_DUST_FRAGMENT} uniforms={dustUniforms}
            transparent depthWrite={false} blending={palette.blending} toneMapped={false} />
        </points>
        {/* Turbine core: a faceted blade fan spinning one way inside a
            bolted casing ring spinning the other — this is the piece that
            actually reads as a mechanical arc-reactor chest-piece rather
            than a glowing ball with a couple of decorative lines. */}
        <group ref={bladeGroup}>
          {Array.from({ length: 8 }, (_, index) => {
            const wedge = Math.PI * 2 / 8
            const gap = wedge * .16
            return (
              <mesh key={`blade-${index}`} rotation={[0, 0, index * wedge + gap / 2]}>
                <ringGeometry args={[.34, .59, 3, 1, 0, wedge - gap]} />
                <meshBasicMaterial color={index % 2 === 0 ? palette.cyan : palette.blue} transparent
                  opacity={.55} blending={palette.blending} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
              </mesh>
            )
          })}
        </group>
        <group ref={casingGroup}>
          <mesh><torusGeometry args={[.95, .026, 6, 100]} /><meshBasicMaterial color={palette.line} transparent opacity={.5} blending={palette.blending} depthWrite={false} toneMapped={false} /></mesh>
          {Array.from({ length: 24 }, (_, index) => {
            const sector = Math.PI * 2 / 24
            const arc = sector * .68
            return (
              <mesh key={`bolt-${index}`} rotation={[0, 0, index * sector]}>
                <torusGeometry args={[.95, .034, 4, 6, arc]} />
                <meshBasicMaterial color={palette.cyan} transparent opacity={.32} blending={palette.blending} depthWrite={false} toneMapped={false} />
              </mesh>
            )
          })}
        </group>
        {/* Arc-reactor chest-piece detail: radiating spokes over a segmented
            notch ring, both facing the camera — the classic Stark reactor
            silhouette instead of a plain glowing ball. */}
        {Array.from({ length: 12 }, (_, index) => {
          const angle = index * (Math.PI / 6)
          return (
            <mesh key={`spoke-${index}`} position={[Math.cos(angle) * .66, Math.sin(angle) * .66, .01]} rotation={[0, 0, angle]}>
              <planeGeometry args={[.24, .014]} />
              <meshBasicMaterial color={palette.cyan} transparent opacity={.5} blending={palette.blending} depthWrite={false} toneMapped={false} />
            </mesh>
          )
        })}
        {Array.from({ length: 16 }, (_, index) => {
          const sector = Math.PI * 2 / 16
          const arc = sector * .62
          return (
            <mesh key={`notch-${index}`} rotation={[0, 0, index * sector]}>
              <torusGeometry args={[.6, .017, 5, 10, arc]} />
              <meshBasicMaterial color={palette.cyan} transparent opacity={.6} blending={palette.blending} depthWrite={false} toneMapped={false} />
            </mesh>
          )
        })}
        <pointLight color={palette.cyan} intensity={2.15} distance={5.2} decay={2} />
      </group>
      <mesh ref={shockwave}>
        <torusGeometry args={[.75, .012, 5, 96]} />
        <meshBasicMaterial ref={shockMaterial} color={palette.cyan} transparent opacity={0} blending={palette.blending} depthWrite={false} />
      </mesh>
    </group>
  )
}

// A tilted camera reads a wide-radius ring as a keystoned, uneven curve
// rather than a clean circle at this fov/distance — reverted to straight-on.
const CAMERA_BASE: [number, number, number] = [0, 0, 9.25]

function CameraDrift({ reducedMotion }: { reducedMotion: boolean }) {
  useFrame((state) => {
    if (reducedMotion) {
      state.camera.position.set(...CAMERA_BASE)
      state.camera.lookAt(0, 0, 0)
      return
    }
    const time = state.clock.elapsedTime
    state.camera.position.x = CAMERA_BASE[0] + Math.sin(time * .05) * .09
    state.camera.position.y = CAMERA_BASE[1] + Math.cos(time * .039) * .065
    state.camera.position.z = CAMERA_BASE[2]
    state.camera.lookAt(0, 0, 0)
  })
  return null
}

function BootCompletion({ duration, onComplete }: { duration: number; onComplete?: () => void }) {
  const completed = useRef(false)
  useFrame(state => {
    if (!completed.current && state.clock.elapsedTime >= duration) {
      completed.current = true
      onComplete?.()
    }
  })
  return null
}

function useQualityTier() {
  const compute = () => {
    const width = window.innerWidth
    if (width >= 2200) return 'high' as const
    if (width <= 680) return 'low' as const
    return 'medium' as const
  }
  const [tier, setTier] = useState<QualityTier>(compute)
  useEffect(() => {
    const update = () => setTier(compute())
    window.addEventListener('resize', update, { passive: true })
    return () => window.removeEventListener('resize', update)
  }, [])
  return tier
}

export function ReactorOrb({
  dark,
  selectedProduct = null,
  onSelectProduct,
  onHoverProduct,
  signalState = 'offline',
  bootKey = 0,
  quickBoot = false,
  skipBoot = false,
  reducedMotion = false,
  onBootComplete,
}: {
  dark: boolean
  selectedProduct?: ProductId | null
  onSelectProduct?: (product: ProductId) => void
  onHoverProduct?: (product: ProductId | null) => void
  signalState?: ReactorSignalState
  bootKey?: number
  quickBoot?: boolean
  skipBoot?: boolean
  reducedMotion?: boolean
  onBootComplete?: () => void
}) {
  const palette = dark ? DARK : LIGHT
  const tier = useQualityTier()
  const immediate = skipBoot || reducedMotion
  const timeScale = quickBoot ? .28 : 1
  // Total ignition runs core-spark -> layers -> glyphs -> arcs -> logos ->
  // particles -> shockwave; boot completion (which releases the HUD
  // instrument entrances) waits until that whole chain has resolved.
  const duration = immediate ? .04 : 4.6 * timeScale
  const dpr: [number, number] = tier === 'high' ? [1, 1.25] : tier === 'medium' ? [1, 1.4] : [1, 1]

  return (
    <Canvas key={bootKey} camera={{ position: CAMERA_BASE, fov: 43 }} dpr={dpr}
      gl={{ alpha: true, antialias: tier !== 'low', premultipliedAlpha: false, powerPreference: 'high-performance' }}
      onCreated={({ gl, scene }) => { gl.setClearColor(0x000000, 0); scene.background = null }}
      style={{ width: '100%', height: '100%', display: 'block' }}>
      <CameraDrift reducedMotion={reducedMotion} />
      <ambientLight intensity={.22} />
      <ArchitectureRings palette={palette} tier={tier} timeScale={timeScale} immediate={immediate} reducedMotion={reducedMotion} />
      <ProductOrbit palette={palette} selected={selectedProduct} onSelect={onSelectProduct} onHover={onHoverProduct}
        timeScale={timeScale} immediate={immediate} reducedMotion={reducedMotion} />
      <CalibrationTicks palette={palette} signalState={signalState} timeScale={timeScale} immediate={immediate} reducedMotion={reducedMotion} />
      <KnowledgeField palette={palette} tier={tier} timeScale={timeScale} immediate={immediate} reducedMotion={reducedMotion} />
      <EnergyCore palette={palette} timeScale={timeScale} immediate={immediate} reducedMotion={reducedMotion} />
      <BootCompletion duration={duration} onComplete={onBootComplete} />
      {tier !== 'low' && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur luminanceThreshold={.18} luminanceSmoothing={.35} intensity={tier === 'high' ? 1.05 : .8} radius={.55} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
