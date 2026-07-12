/**
 * STAGE 3D — the Music Studio's audio-reactive centrepiece, rebuilt for a
 * professional finish (per the research pass):
 *   · smooth glass-fresnel CORE (no wireframe blob) breathing with the analyser
 *   · a shader SPECTRUM RING — the radial EQ lives on the orbital plane
 *   · 7 role STATIONS as emissive orbs + soft halos + ripple rings on fire
 *   · note events fly as LIGHT STREAKS along curved paths, core → station
 *   · round soft-glow PARTICLES (sprite texture — never square points)
 *   · Bloom post-processing for the HDR glow; themed in-scene backdrop
 * Labels are glass capsule chips with lucide icons — zero emoji.
 * Lazy-loaded by MusicStudio with Stage2D as the guaranteed fallback.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import gsap from 'gsap'
import { ROLES, ROLE_LABEL, INSTRUMENTS } from '@arganta/audio'
import { ROLE_COLOR, ROLE_ICON } from './roles'

const tok = (n: string, f: string) => (typeof document === 'undefined' ? f : getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f)

// ── round soft-glow sprite texture (shared by particles / halos / streaks) ──
let _glowTex: THREE.CanvasTexture | null = null
function glowTexture(): THREE.CanvasTexture {
  if (_glowTex) return _glowTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  _glowTex = new THREE.CanvasTexture(c)
  return _glowTex
}

function readLevel(audioRef: any): number {
  const a = audioRef.current
  if (!a) return 0
  a.analyser.getByteFrequencyData(a.freq)
  const n = Math.floor(a.freq.length * 0.6)
  let s = 0
  for (let i = 0; i < n; i++) s += a.freq[i]
  return s / (n * 255)
}

// ── shared orbital geometry constants (stations + camera math read the SAME
// numbers, so "does it fit the frustum" is computed, not eyeballed) ─────────
const STATION_R = 2.85      // station orbit radius
const LABEL_DROP = 0.55     // label anchor sits this far below a station (+margin)
const ORBIT_TILT = -0.16    // radians — a gentle dial tilt, not the old -0.42
                             // (that steeper tilt was what read as "an ugly oval")
const MIN_Z_MARGIN = 1.08

/** The camera distance below which the tilted orbital plane clips the frustum
 *  (top/bottom from the tilt+label offset, left/right from the aspect ratio).
 *  Exact trig, not a guessed constant — stays correct if the geometry above
 *  ever changes, and adapts live to the stage's actual aspect ratio. */
function minCameraZ(fovDeg: number, aspect: number): number {
  const halfTan = Math.tan((fovDeg * Math.PI) / 360)
  const yLocal = -(STATION_R + LABEL_DROP)                      // worst case: bottom station's label
  const worldY = yLocal * Math.cos(ORBIT_TILT)
  const worldZ = yLocal * Math.sin(ORBIT_TILT)                  // tilt shifts it toward/away from camera
  const minZv = worldZ + Math.abs(worldY) / halfTan             // vertical fit
  const minZh = STATION_R / (halfTan * Math.max(aspect, 0.001)) // horizontal fit (narrow/portrait stages)
  return Math.max(minZv, minZh) * MIN_Z_MARGIN
}

// Ashima / Stefan Gustavson simplex noise 3D (public domain).
const SNOISE = `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + 1.0 * C.xxx; vec3 x2 = x0 - i2 + 2.0 * C.xxx; vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0; vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z *ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ *ns.x + ns.yyyy; vec4 y = y_ *ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}`

// ── the glass-fresnel core (smooth displacement, rim light feeds the bloom) ──
const CORE_VERT = `
uniform float uTime; uniform float uAudio;
varying float vFres; varying float vN;
${SNOISE}
void main(){
  float n = snoise(normal * 1.6 + uTime * 0.18);
  vN = n;
  vec3 p = position + normal * (n * (0.035 + uAudio * 0.17));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 vd = normalize(-mv.xyz);
  vec3 wn = normalize(normalMatrix * normal);
  vFres = pow(1.0 - max(dot(vd, wn), 0.0), 2.2);
  gl_Position = projectionMatrix * mv;
}`
const CORE_FRAG = `
uniform vec3 uColA; uniform vec3 uColB; uniform float uAudio;
varying float vFres; varying float vN;
void main(){
  vec3 base = mix(uColA, uColB, vN * 0.5 + 0.5);
  vec3 col = base * 0.14 + base * vFres * (1.05 + uAudio * 1.5) + vec3(1.0) * vFres * vFres * 0.22;
  gl_FragColor = vec4(col, 0.42 + vFres * 0.58);
}`

function Core({ audioRef, colA, colB, levelRef }: any) {
  const mesh = useRef<THREE.Mesh>(null)
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uAudio: { value: 0 },
    uColA: { value: new THREE.Color(colA) }, uColB: { value: new THREE.Color(colB) },
  }), [])
  useEffect(() => { uniforms.uColA.value.set(colA); uniforms.uColB.value.set(colB) }, [colA, colB, uniforms])
  useFrame((_s, dt) => {
    uniforms.uTime.value += dt
    const lvl = readLevel(audioRef)
    uniforms.uAudio.value += (lvl - uniforms.uAudio.value) * 0.16
    levelRef.current = uniforms.uAudio.value
    if (mesh.current) { mesh.current.rotation.y += dt * 0.1 }
  })
  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[1.12, 96, 96]} />
      <shaderMaterial uniforms={uniforms} vertexShader={CORE_VERT} fragmentShader={CORE_FRAG} transparent />
    </mesh>
  )
}

// ── the spectrum ring: radial EQ drawn in shader space on the orbital plane ──
// An idle shimmer (a slow per-bin sine floor) keeps the ring visibly alive
// even at rest, instead of reading as a flat, gap-toothed dashed circle.
const RING_FRAG = `
uniform sampler2D uFreq; uniform vec3 uColA; uniform vec3 uColB; uniform float uAudio; uniform float uTime;
varying vec2 vPos;
void main(){
  float ang = atan(vPos.y, vPos.x);
  float r = length(vPos);
  float t = (ang + 3.14159265) / 6.2831853;
  float bins = 72.0;
  float bin = floor(t * bins);
  float v = texture2D(uFreq, vec2((bin + 0.5) / bins, 0.5)).r;
  float idle = 0.05 + 0.05 * sin(uTime * 0.6 + bin * 0.35);
  v = max(v, idle);
  float inner = 1.62;
  float outer = inner + 0.06 + v * 0.42;
  // soft radial extent with rounded tip
  float body = smoothstep(inner - 0.02, inner + 0.03, r) * (1.0 - smoothstep(outer - 0.08, outer + 0.02, r));
  // gaps between bars — widened + softened so idle reads as a glow, not dashes
  float f = fract(t * bins);
  float bar = smoothstep(0.14, 0.34, f) * (1.0 - smoothstep(0.66, 0.86, f));
  float a = body * bar * (0.3 + v * 0.85);
  vec3 col = mix(uColA, uColB, clamp(v * 0.85 + 0.15 * sin(uTime * 0.25 + bin * 0.1), 0.0, 1.0));
  gl_FragColor = vec4(col * (0.65 + v * 1.2), a);
}`
const RING_VERT = `
varying vec2 vPos;
void main(){ vPos = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`

function SpectrumRing({ audioRef, colA, colB }: any) {
  const tex = useMemo(() => {
    const t = new THREE.DataTexture(new Uint8Array(72), 72, 1, THREE.RedFormat)
    t.needsUpdate = true
    return t
  }, [])
  const uniforms = useMemo(() => ({
    uFreq: { value: tex }, uAudio: { value: 0 }, uTime: { value: 0 },
    uColA: { value: new THREE.Color(colA) }, uColB: { value: new THREE.Color(colB) },
  }), [tex])
  useEffect(() => { uniforms.uColA.value.set(colA); uniforms.uColB.value.set(colB) }, [colA, colB, uniforms])
  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime
    const a = audioRef.current
    if (!a) return
    const src: Uint8Array = a.freq // refreshed each frame by Core's readLevel
    const dst = (tex.image.data as Uint8Array)
    const n = dst.length, usable = Math.floor(src.length * 0.62)
    for (let i = 0; i < n; i++) {
      // mirror around the top so the ring reads symmetrically
      const k = i < n / 2 ? i / (n / 2) : (n - i) / (n / 2)
      dst[i] = src[Math.floor(k * (usable - 1))]
    }
    tex.needsUpdate = true
  })
  return (
    <mesh>
      <ringGeometry args={[1.55, 2.35, 256, 1]} />
      <shaderMaterial uniforms={uniforms} vertexShader={RING_VERT} fragmentShader={RING_FRAG}
        transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

// ── the dial track: a continuous gradient glow-ring beneath the bars, always
// visible regardless of audio — this is what turns "a plain dashed oval"
// into a proper instrument dial. Per-vertex hue sweep (accent → magenta). ──
function DialTrack({ colA, colB, levelRef }: any) {
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const geo = useMemo(() => {
    const g = new THREE.TorusGeometry(1.58, 0.032, 16, 128)
    const pos = g.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const cA = new THREE.Color(colA), cB = new THREE.Color(colB)
    for (let i = 0; i < pos.count; i++) {
      const ang = Math.atan2(pos.getY(i), pos.getX(i))
      const t = (ang + Math.PI) / (Math.PI * 2)
      const c = cA.clone().lerp(cB, t)
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [colA, colB])
  useFrame(() => { if (mat.current) mat.current.emissiveIntensity = 0.24 + (levelRef?.current || 0) * 0.55 })
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial ref={mat} vertexColors color="#ffffff" emissive="#ffffff" emissiveIntensity={0.24}
        roughness={0.28} metalness={0.12} transparent opacity={0.92} />
    </mesh>
  )
}

// ── role stations: emissive orb + halo + ripple ──────────────────────────────
// (labels live in a DOM overlay outside the canvas — see LabelLayer — so they
// survive the post-processing pipeline and stay crisp/theme-native)
function Station({ role, index, total, eventsRef, theme, anchors }: any) {
  const orb = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const halo = useRef<THREE.Sprite>(null)
  const ripple = useRef<THREE.Mesh>(null)
  const rippleMat = useRef<THREE.MeshBasicMaterial>(null)
  const anchor = useRef<THREE.Group>(null)
  useEffect(() => { anchors.current[role] = anchor.current; return () => { delete anchors.current[role] } }, [role, anchors])
  const ang = (index / total) * Math.PI * 2 - Math.PI / 2
  const R = STATION_R
  const pos: [number, number, number] = [Math.cos(ang) * R, Math.sin(ang) * R, 0]
  const col = ROLE_COLOR[role]
  const on = theme?.roles?.[role]?.on ?? true

  useFrame(() => {
    const evs = eventsRef.current
    let last = -9999
    for (const e of evs) if (e.role === role && e.born > last) last = e.born
    const age = performance.now() - last
    const pop = age < 300 ? 1 - age / 300 : 0
    const s = (on ? 1 : 0.6) + pop * 0.55
    if (orb.current) orb.current.scale.setScalar(s)
    if (mat.current) { mat.current.emissiveIntensity = (on ? 0.9 : 0.2) + pop * 2.4; mat.current.opacity = on ? 1 : 0.4 }
    if (halo.current) { halo.current.scale.setScalar(0.85 + pop * 0.9); (halo.current.material as THREE.SpriteMaterial).opacity = (on ? 0.5 : 0.15) + pop * 0.5 }
    // ripple ring expands + fades over 650ms after a fire
    if (ripple.current && rippleMat.current) {
      if (age < 650) {
        const p = age / 650
        ripple.current.visible = true
        ripple.current.scale.setScalar(0.35 + p * 1.5)
        rippleMat.current.opacity = 0.5 * (1 - p)
      } else ripple.current.visible = false
    }
  })

  return (
    <group position={pos}>
      <mesh ref={orb}>
        <sphereGeometry args={[0.145, 32, 32]} />
        <meshStandardMaterial ref={mat} color={col} emissive={col} emissiveIntensity={0.9} transparent roughness={0.3} metalness={0.05} />
      </mesh>
      <sprite ref={halo} scale={0.85}>
        <spriteMaterial map={glowTexture()} color={col} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <mesh ref={ripple} visible={false}>
        <ringGeometry args={[0.28, 0.31, 48]} />
        <meshBasicMaterial ref={rippleMat} color={col} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* invisible anchor just below the orb — the DOM LabelLayer tracks it */}
      <group ref={anchor} position={[0, -0.48, 0]} />
    </group>
  )
}

// ── label projector: writes screen positions of the anchors to the DOM chips ─
function LabelProjector({ anchors, chips }: any) {
  const v = useMemo(() => new THREE.Vector3(), [])
  const { camera, size } = useThree()
  useFrame(() => {
    for (const role of ROLES as string[]) {
      const a = anchors.current[role]
      const el = chips.current[role]
      if (!a || !el) continue
      a.getWorldPosition(v)
      v.project(camera)
      const x = (v.x * 0.5 + 0.5) * size.width
      const y = (-v.y * 0.5 + 0.5) * size.height
      el.style.transform = `translate(-50%, 0) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
      el.style.opacity = v.z < 1 ? '' : '0'
    }
  })
  return null
}

// ── light streaks: note events travel core → station on a curved path ────────
const STREAK_POOL = 36
function Streaks({ eventsRef, total }: any) {
  const group = useRef<THREE.Group>(null)
  const travelers = useRef<{ role: string; born: number; side: number }[]>([])
  const stationPos = useMemo(() => {
    const m: Record<string, THREE.Vector3> = {}
    ;(ROLES as string[]).forEach((role: string, i: number) => {
      const a = (i / total) * Math.PI * 2 - Math.PI / 2
      m[role] = new THREE.Vector3(Math.cos(a) * STATION_R, Math.sin(a) * STATION_R, 0)
    })
    return m
  }, [total])
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const now = performance.now()
    // adopt new events (flag them so each spawns exactly one traveler)
    for (const e of eventsRef.current) {
      if (!(e as any)._streak) { (e as any)._streak = 1; travelers.current.push({ role: e.role, born: e.born, side: (e.born % 2 ? 1 : -1) }) }
    }
    while (travelers.current.length > 12) travelers.current.shift()
    const g = group.current
    if (!g) return
    let si = 0
    for (let ti = travelers.current.length - 1; ti >= 0; ti--) {
      const tr = travelers.current[ti]
      const life = (now - tr.born) / 430
      if (life > 1) { travelers.current.splice(ti, 1); continue }
      const end = stationPos[tr.role]
      if (!end) continue
      const col = ROLE_COLOR[tr.role]
      // quadratic bezier with a perpendicular bow
      for (let k = 0; k < 3 && si < STREAK_POOL; k++, si++) {
        const p = Math.max(0, life - k * 0.055)
        const sp = g.children[si] as THREE.Sprite | undefined
        if (!sp) break
        const inv = 1 - p
        // ctrl = midpoint + perpendicular offset
        const cx = end.x * 0.5 - end.y * 0.16 * tr.side
        const cy = end.y * 0.5 + end.x * 0.16 * tr.side
        tmp.set(inv * inv * 0 + 2 * inv * p * cx + p * p * end.x, inv * inv * 0 + 2 * inv * p * cy + p * p * end.y, 0)
        sp.position.copy(tmp)
        sp.scale.setScalar((k === 0 ? 0.30 : 0.20 - k * 0.04) * (1 - life * 0.35))
        const m = sp.material as THREE.SpriteMaterial
        m.color.set(col)
        m.opacity = (k === 0 ? 0.9 : 0.4 - k * 0.1) * (1 - life * 0.55)
        sp.visible = true
      }
    }
    for (; si < STREAK_POOL; si++) { const sp = g.children[si] as THREE.Sprite | undefined; if (sp) sp.visible = false }
  })
  return (
    <group ref={group}>
      {Array.from({ length: STREAK_POOL }).map((_, i) => (
        <sprite key={i} visible={false}>
          <spriteMaterial map={glowTexture()} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
      ))}
    </group>
  )
}

// ── ambient dust: round soft sprites on a slow-drifting shell ────────────────
function Dust({ color, levelRef }: any) {
  const pts = useRef<THREE.Points>(null)
  const mat = useRef<THREE.PointsMaterial>(null)
  const geo = useMemo(() => {
    const n = 460, pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const r = 3.6 + Math.random() * 4.4, t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1)
      pos[i * 3] = r * Math.sin(p) * Math.cos(t); pos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t); pos[i * 3 + 2] = r * Math.cos(p)
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); return g
  }, [])
  useFrame((_s, dt) => {
    if (pts.current) { pts.current.rotation.y += dt * 0.016; pts.current.rotation.x += dt * 0.006 }
    if (mat.current) mat.current.size = 0.13 + (levelRef.current || 0) * 0.09
  })
  return (
    <points ref={pts} geometry={geo}>
      <pointsMaterial ref={mat} map={glowTexture()} size={0.13} color={color} transparent opacity={0.5}
        sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  )
}

// ── themed backdrop (in-scene, so bloom + theme flip both behave) ────────────
const BACK_FRAG = `
uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uTint;
varying vec2 vUv;
void main(){
  vec3 col = mix(uBottom, uTop, vUv.y);
  float d = distance(vUv, vec2(0.5, 0.55));
  col += uTint * smoothstep(0.75, 0.0, d) * 0.14;
  gl_FragColor = vec4(col, 1.0);
}`
const BACK_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`

function Backdrop({ top, bottom, tint }: any) {
  const uniforms = useMemo(() => ({
    uTop: { value: new THREE.Color(top) }, uBottom: { value: new THREE.Color(bottom) }, uTint: { value: new THREE.Color(tint) },
  }), [])
  useEffect(() => { uniforms.uTop.value.set(top); uniforms.uBottom.value.set(bottom); uniforms.uTint.value.set(tint) }, [top, bottom, tint, uniforms])
  const { viewport } = useThree()
  return (
    <mesh position={[0, 0, -9]} scale={[Math.max(viewport.width * 3, 60), Math.max(viewport.height * 3, 40), 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial uniforms={uniforms} vertexShader={BACK_VERT} fragmentShader={BACK_FRAG} depthWrite={false} />
    </mesh>
  )
}

// Dollies to a distance derived from the ACTUAL stage size + fov, so the
// tilted dial never clips regardless of how wide/narrow/short the panel is
// (this replaces two hand-picked z values that clipped the bottom station).
function CameraRig({ playing }: { playing: boolean }) {
  const { camera, pointer, size } = useThree()
  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera
    const aspect = size.width / Math.max(1, size.height)
    const minZ = minCameraZ(persp.fov, aspect)
    const targetZ = playing ? minZ : minZ * 1.1
    gsap.to(camera.position, { z: targetZ, duration: 1.2, ease: 'power2.out' })
  }, [playing, camera, size.width, size.height])
  useFrame(() => {
    camera.position.x += (pointer.x * 0.35 - camera.position.x) * 0.03
    camera.position.y += (pointer.y * 0.22 - camera.position.y) * 0.03
    camera.lookAt(0, 0, 0)
  })
  return null
}

export default function Stage3D({ audioRef, eventsRef, playing, theme }: any) {
  const [colors, setColors] = useState(() => ({
    acc: tok('--acc', '#6366f1'), mag: tok('--mag', '#ff3d72'),
    bg: tok('--canvas', '#09090d'), bg2: tok('--bg2', '#121219'),
  }))
  const levelRef = useRef(0)
  const anchors = useRef<Record<string, THREE.Object3D | null>>({})
  const chips = useRef<Record<string, HTMLDivElement | null>>({})
  useEffect(() => {
    const upd = () => setColors({ acc: tok('--acc', '#6366f1'), mag: tok('--mag', '#ff3d72'), bg: tok('--canvas', '#09090d'), bg2: tok('--bg2', '#121219') })
    const mo = new MutationObserver(upd)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => mo.disconnect()
  }, [])
  const total = (ROLES as string[]).length
  return (
    <div className="msx-viz msx-3dhost">
      <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, 8.4], fov: 50 }} gl={{ antialias: true }}>
        <Backdrop top={colors.bg2} bottom={colors.bg} tint={colors.acc} />
        <ambientLight intensity={0.65} />
        <pointLight position={[4, 4, 5]} intensity={1.0} color={colors.acc} />
        <pointLight position={[-4, -2, 2]} intensity={0.5} color={colors.mag} />
        <Core audioRef={audioRef} colA={colors.acc} colB={colors.mag} levelRef={levelRef} />
        {/* the orbital plane: spectrum ring + stations + streaks share one gentle tilt + drift */}
        <OrbitalPlane audioRef={audioRef} eventsRef={eventsRef} theme={theme} total={total} colors={colors} anchors={anchors} levelRef={levelRef} />
        <Dust color={colors.acc} levelRef={levelRef} />
        <CameraRig playing={playing} />
        <LabelProjector anchors={anchors} chips={chips} />
        <EffectComposer>
          <Bloom intensity={0.85} luminanceThreshold={0.22} luminanceSmoothing={0.3} mipmapBlur radius={0.72} />
        </EffectComposer>
      </Canvas>
      {/* DOM label layer — crisp, theme-native, immune to the post pipeline */}
      <div className="msx-labels" aria-hidden>
        {(ROLES as string[]).map((role: string) => {
          const Icon = ROLE_ICON[role]
          const on = theme?.roles?.[role]?.on ?? true
          const instId = role === 'drums' ? (theme?.roles?.drums?.kit || '') : (theme?.roles?.[role]?.inst || '')
          const instName = role === 'drums' ? (instId === 'none' ? 'no kit' : instId + ' kit') : ((INSTRUMENTS as any)[instId]?.label || '')
          return (
            <div key={role} ref={el => { chips.current[role] = el }} className={'msx3d-chip' + (on ? '' : ' off')} style={{ ['--rc' as any]: ROLE_COLOR[role] }}>
              <b><Icon size={11} strokeWidth={2.5} /> {ROLE_LABEL[role]}</b>
              {instName && <span>{instName}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OrbitalPlane({ audioRef, eventsRef, theme, colors, total, anchors, levelRef }: any) {
  const grp = useRef<THREE.Group>(null)
  useFrame((_s, dt) => { if (grp.current) grp.current.rotation.z += dt * 0.014 })
  return (
    <group ref={grp} rotation={[ORBIT_TILT, 0, 0]}>
      <DialTrack colA={colors.acc} colB={colors.mag} levelRef={levelRef} />
      <SpectrumRing audioRef={audioRef} colA={colors.acc} colB={colors.mag} />
      {(ROLES as string[]).map((role: string, i: number) => (
        <Station key={role} role={role} index={i} total={total} eventsRef={eventsRef} theme={theme} anchors={anchors} />
      ))}
      <Streaks eventsRef={eventsRef} total={total} />
    </group>
  )
}
