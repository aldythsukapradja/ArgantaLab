import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

// The CEO reactor core — a real R3F 3D orb tuned to read on the LIGHT cockpit:
// a bright saturated core + crisp concentric rings + a graduated tick-bezel +
// a faint neural web behind, with subtle bloom. Dark palette on the theme toggle.

type Pal = { core: string; ring: string; ring2: string; web: string; bloom: number; thresh: number }
const LIGHT: Pal = { core: '#3b82f6', ring: '#2563eb', ring2: '#0ea5e9', web: '#6aa0e8', bloom: 0.55, thresh: 0.5 }
const DARK: Pal = { core: '#8fe0ff', ring: '#45c8ff', ring2: '#4a86ff', web: '#5aa0ff', bloom: 1.15, thresh: 0.18 }

function circle(r: number, seg = 160): [number, number, number][] {
  const p: [number, number, number][] = []
  for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; p.push([Math.cos(a) * r, Math.sin(a) * r, 0]) }
  return p
}

function Rings({ pal }: { pal: Pal }) {
  const g = useRef<THREE.Group>(null)
  useFrame((_, d) => { if (g.current) g.current.rotation.z += d * 0.05 })
  // radii, weight, opacity, dashed
  const rings: [number, number, number, boolean][] = [
    [2.15, 1, .28, true], [2.0, 1.4, .5, false], [1.82, 1, .3, true], [1.62, 2, .7, false],
    [1.4, 1, .28, false], [1.22, 1.4, .55, false], [1.0, 1, .3, true], [0.78, 1.6, .7, false],
  ]
  return (
    <group ref={g}>
      {rings.map(([r, w, o, dash], i) => (
        <Line key={i} points={circle(r)} color={i % 2 ? pal.ring2 : pal.ring} lineWidth={w} transparent opacity={o} dashed={dash} dashSize={0.06} gapSize={0.06} />
      ))}
    </group>
  )
}

function Bezel({ pal }: { pal: Pal }) {
  const g = useRef<THREE.Group>(null)
  useFrame((_, d) => { if (g.current) g.current.rotation.z -= d * 0.03 })
  const geo = useMemo(() => {
    const pts: number[] = []
    const R0 = 2.28, N = 96
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2
      const long = i % 8 === 0
      const R1 = R0 - (long ? 0.14 : 0.07)
      pts.push(Math.cos(a) * R0, Math.sin(a) * R0, 0, Math.cos(a) * R1, Math.sin(a) * R1, 0)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])
  return <group ref={g}><lineSegments geometry={geo}><lineBasicMaterial color={pal.ring} transparent opacity={0.5} /></lineSegments></group>
}

// Clean inner detail: two crisp counter-rotating rings close to the core
// (replaces the chaotic neural web with elegant concentric motion).
function Inner({ pal }: { pal: Pal }) {
  const a = useRef<THREE.Group>(null); const b = useRef<THREE.Group>(null)
  useFrame((_, d) => { if (a.current) a.current.rotation.z += d * 0.28; if (b.current) b.current.rotation.z -= d * 0.4 })
  return (
    <>
      <group ref={a}><Line points={circle(0.62)} color={pal.ring2} lineWidth={1.4} transparent opacity={0.6} dashed dashSize={0.08} gapSize={0.05} /></group>
      <group ref={b}><Line points={circle(0.5)} color={pal.ring} lineWidth={1} transparent opacity={0.45} /></group>
    </>
  )
}

const CORE_VERT = `
  varying vec3 vN; varying vec3 vP;
  void main(){ vN = normalize(normalMatrix * normal); vP = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const CORE_FRAG = `
  precision highp float;
  varying vec3 vN; varying vec3 vP;
  uniform float uTime; uniform vec3 uColor;
  float hash(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y), f.z); }
  void main(){
    vec3 N = normalize(vN);
    float facing = max(dot(N, vec3(0.0,0.0,1.0)), 0.0);
    float n = noise(vP*4.0 + vec3(0.0,0.0,uTime*0.8));
    float core = pow(facing, 1.4);
    vec3 col = mix(uColor, vec3(1.0), core*core);
    float bright = core*(0.7 + 0.5*n)*2.2 + facing*0.5;
    gl_FragColor = vec4(col*bright, 1.0);
  }
`
function Core({ pal }: { pal: Pal }) {
  const mat = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uColor: { value: new THREE.Color(pal.core) } }), [pal.core])
  useFrame((st) => { if (mat.current) mat.current.uniforms.uTime.value = st.clock.elapsedTime })
  return (
    <group>
      <mesh><sphereGeometry args={[0.42, 48, 48]} />
        <shaderMaterial ref={mat} vertexShader={CORE_VERT} fragmentShader={CORE_FRAG} uniforms={uniforms} toneMapped={false} />
      </mesh>
      <mesh><sphereGeometry args={[0.62, 32, 32]} /><meshBasicMaterial color={pal.core} transparent opacity={0.1} toneMapped={false} /></mesh>
    </group>
  )
}

export function ReactorOrb({ dark }: { dark: boolean }) {
  const pal = dark ? DARK : LIGHT
  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 45 }} gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }} dpr={[1, 1.5]} style={{ width: '100%', height: '100%', display: 'block' }}>
      <ambientLight intensity={0.6} />
      <Bezel pal={pal} />
      <Rings pal={pal} />
      <Inner pal={pal} />
      <Core pal={pal} />
      <EffectComposer>
        <Bloom intensity={pal.bloom} luminanceThreshold={pal.thresh} luminanceSmoothing={0.85} mipmapBlur radius={0.55} />
      </EffectComposer>
    </Canvas>
  )
}
