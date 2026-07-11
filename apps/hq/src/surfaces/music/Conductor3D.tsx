import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import gsap from 'gsap'
import { ROLES, ROLE_LABEL } from '@arganta/audio'

// The "Conductor Orb" — a 3D audio-reactive centrepiece (Three.js + r3f + GSAP)
// that keeps our MEANINGFUL structure instead of a generic blob: a morphing
// icosahedron core that breathes/spikes with the live AnalyserNode level, and
// the 7 instrument ROLES as glowing satellites that pop when they fire (from
// the transport's note events). Theme-aware (the themed CSS stage shows through
// the transparent canvas; accent/lights read HQ tokens). Lazy-loaded by
// MusicForge with the Canvas2D visualizer as the guaranteed fallback.

const ROLE_COLOR: Record<string, string> = {
  pad: '#8b5cf6', harmony: '#6366f1', bass: '#3b82f6', lead: '#0ea5a3', arp: '#f59e0b', drums: '#ef4444', sparkle: '#ff3d72',
}
const ROLE_ICON: Record<string, string> = {
  pad: '🌫️', harmony: '🎻', bass: '🎸', lead: '🎶', arp: '🎹', drums: '🥁', sparkle: '✨',
}
const tok = (n: string, f: string) => (typeof document === 'undefined' ? f : getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f)

// Ashima / Stefan Gustavson simplex noise 3D (public domain) — for the orb displacement.
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

const ORB_VERT = `
uniform float uTime; uniform float uAudio; varying float vFres;
${SNOISE}
void main(){
  float n = snoise(normal * 1.15 + uTime * 0.25);
  float disp = n * (0.10 + uAudio * 0.9);
  vec3 p = position + normal * disp;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 vd = normalize(-mv.xyz);
  vec3 wn = normalize(normalMatrix * normal);
  vFres = pow(1.0 - max(dot(vd, wn), 0.0), 1.8);
  gl_Position = projectionMatrix * mv;
}`
const ORB_FRAG = `
uniform vec3 uColor; uniform float uAudio; varying float vFres;
void main(){
  vec3 col = uColor * (0.4 + vFres * 1.4) + uColor * uAudio * 0.9;
  gl_FragColor = vec4(col, 0.9);
}`
const GLOW_VERT = `
varying float vFres;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 vd = normalize(-mv.xyz);
  vec3 wn = normalize(normalMatrix * normal);
  vFres = pow(1.0 - max(dot(vd, -wn), 0.0), 3.0);
  gl_Position = projectionMatrix * mv;
}`
const GLOW_FRAG = `
uniform vec3 uColor; uniform float uAudio; varying float vFres;
void main(){ gl_FragColor = vec4(uColor, vFres * (0.28 + uAudio * 0.5)); }`

// audio level 0..1, smoothed — shared via a ref written by the Orb each frame
function readLevel(audioRef: any) {
  const a = audioRef.current
  if (!a) return 0
  a.analyser.getByteFrequencyData(a.freq)
  const n = Math.floor(a.freq.length * 0.6)
  let s = 0; for (let i = 0; i < n; i++) s += a.freq[i]
  return s / (n * 255)
}

function Orb({ audioRef, color, levelRef }: any) {
  const mesh = useRef<THREE.Mesh>(null)
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uAudio: { value: 0 }, uColor: { value: new THREE.Color(color) } }), [])
  useEffect(() => { uniforms.uColor.value.set(color) }, [color, uniforms])
  useFrame((_s, dt) => {
    uniforms.uTime.value += dt
    const lvl = readLevel(audioRef)
    uniforms.uAudio.value += (lvl - uniforms.uAudio.value) * 0.18
    if (levelRef) levelRef.current = uniforms.uAudio.value
    if (mesh.current) { mesh.current.rotation.y += dt * 0.14; mesh.current.rotation.x += dt * 0.05 }
  })
  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[1.35, 5]} />
      <shaderMaterial uniforms={uniforms} vertexShader={ORB_VERT} fragmentShader={ORB_FRAG} wireframe transparent />
    </mesh>
  )
}
function Glow({ color, levelRef }: any) {
  const uniforms = useMemo(() => ({ uAudio: { value: 0 }, uColor: { value: new THREE.Color(color) } }), [])
  useEffect(() => { uniforms.uColor.value.set(color) }, [color, uniforms])
  useFrame(() => { uniforms.uAudio.value = levelRef?.current ?? 0 })
  return (
    <mesh scale={1.85}>
      <sphereGeometry args={[1, 40, 40]} />
      <shaderMaterial uniforms={uniforms} vertexShader={GLOW_VERT} fragmentShader={GLOW_FRAG} transparent side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  )
}

function Satellite({ role, index, total, eventsRef, transportRef }: any) {
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const ang = (index / total) * Math.PI * 2 - Math.PI / 2
  const R = 2.7, pos: [number, number, number] = [Math.cos(ang) * R, Math.sin(ang) * R, 0]
  const col = ROLE_COLOR[role]
  useFrame(() => {
    const evs = eventsRef.current
    let last = -9999
    for (const e of evs) if (e.role === role && e.born > last) last = e.born
    const age = performance.now() - last
    const pop = age < 260 ? 1 - age / 260 : 0
    const on = transportRef.current?.theme?.roles?.[role]?.on ?? true
    const s = (on ? 0.9 : 0.5) + pop * 0.5
    if (mesh.current) mesh.current.scale.setScalar(s)
    if (mat.current) { mat.current.emissiveIntensity = (on ? 0.5 : 0.15) + pop * 1.6; mat.current.opacity = on ? 1 : 0.4 }
  })
  return (
    <group position={pos}>
      <mesh ref={mesh}>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshStandardMaterial ref={mat} color={col} emissive={col} emissiveIntensity={0.5} transparent roughness={0.35} metalness={0.1} />
      </mesh>
      <Html center distanceFactor={9} position={[0, -0.55, 0]} style={{ pointerEvents: 'none' }}>
        <div className="mf3d-label" style={{ color: col }}>{ROLE_ICON[role]} {ROLE_LABEL[role].toUpperCase()}</div>
      </Html>
    </group>
  )
}

// faint static spokes from the core to each satellite (adds depth/structure)
function Spokes({ total, color }: any) {
  const geo = useMemo(() => {
    const pts: number[] = []
    for (let i = 0; i < total; i++) { const a = (i / total) * Math.PI * 2 - Math.PI / 2; pts.push(0, 0, 0, Math.cos(a) * 2.7, Math.sin(a) * 2.7, 0) }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); return g
  }, [total])
  return <lineSegments geometry={geo}><lineBasicMaterial color={color} transparent opacity={0.18} /></lineSegments>
}

function Particles({ color }: any) {
  const grp = useRef<THREE.Points>(null)
  const geo = useMemo(() => {
    const n = 700, pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { const r = 4 + Math.random() * 6, t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1); pos[i * 3] = r * Math.sin(p) * Math.cos(t); pos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t); pos[i * 3 + 2] = r * Math.cos(p) }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); return g
  }, [])
  useFrame((_s, dt) => { if (grp.current) { grp.current.rotation.y += dt * 0.02; grp.current.rotation.x += dt * 0.008 } })
  return <points ref={grp} geometry={geo}><pointsMaterial size={0.035} color={color} transparent opacity={0.55} sizeAttenuation depthWrite={false} /></points>
}

function Constellation({ eventsRef, transportRef, color }: any) {
  const grp = useRef<THREE.Group>(null)
  useFrame((_s, dt) => { if (grp.current) grp.current.rotation.z += dt * 0.03 })
  return (
    <group ref={grp}>
      <Spokes total={(ROLES as string[]).length} color={color} />
      {(ROLES as string[]).map((role: string, i: number) => (
        <Satellite key={role} role={role} index={i} total={(ROLES as string[]).length} eventsRef={eventsRef} transportRef={transportRef} />
      ))}
    </group>
  )
}

function CameraRig({ playing }: { playing: boolean }) {
  const { camera } = useThree()
  useEffect(() => { gsap.to(camera.position, { z: playing ? 4.7 : 5.8, duration: 1.1, ease: 'power2.out' }) }, [playing, camera])
  return null
}

export default function Conductor3D({ audioRef, transportRef, eventsRef, playing }: any) {
  const [color, setColor] = useState(() => tok('--acc', '#6366f1'))
  const levelRef = useRef(0)
  // follow the HQ light/dark theme (accent + lights); the transparent canvas
  // lets the themed .mf-viz CSS stage show through as the background.
  useEffect(() => {
    const upd = () => setColor(tok('--acc', '#6366f1'))
    const mo = new MutationObserver(upd)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const mq = window.matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener?.('change', upd)
    return () => { mo.disconnect(); mq.removeEventListener?.('change', upd) }
  }, [])
  return (
    <Canvas className="mf-viz" dpr={[1, 1.8]} camera={{ position: [0, 0, 5.8], fov: 55 }} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={0.7} />
      <pointLight position={[4, 4, 5]} intensity={0.9} color={color} />
      <pointLight position={[-4, -2, 2]} intensity={0.4} color={'#ff3d72'} />
      <Orb audioRef={audioRef} color={color} levelRef={levelRef} />
      <Glow color={color} levelRef={levelRef} />
      <Constellation eventsRef={eventsRef} transportRef={transportRef} color={color} />
      <Particles color={color} />
      <CameraRig playing={playing} />
    </Canvas>
  )
}
