// WS3 — the Cognitive Cortex. A brain-shaped neural twin of the REAL vault seen
// from above: left hemisphere analytic, right creative, front→back THINK · KNOW
// · DO. Every real note is a bright instanced neuron; real wikilinks are axons;
// signal particles FLOW along those axons (so every dot rides a real connection);
// a faint tissue haze gives the brain its form; and a THINK→KNOW→DO wave fires
// the neurons front→back — the company thinking. Bloom does the glow.

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { KModel } from './model'
import { COGNITION_COLOR, BRAIN, type Cognition } from './brain'
import { useKnowledge } from './store'
import { SPINE } from './spine'

const PROV_SCALE: Record<string, number> = { live: 1, partial: 0.72, simulated: 0.52, placeholder: 0.34 }
const COG_C: Record<Cognition, THREE.Color> = {
  think: new THREE.Color(COGNITION_COLOR.think),
  know: new THREE.Color(COGNITION_COLOR.know),
  do: new THREE.Color(COGNITION_COLOR.do),
}

// ─────────────── faint tissue haze (brain form, clearly background) ───────────────
function TissueHaze({ cloud }: { cloud: { positions: Float32Array; bands: Uint8Array } }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(cloud.positions, 3))
    const colors = new Float32Array(cloud.positions.length)
    const cc = [COG_C.think, COG_C.know, COG_C.do]
    for (let i = 0; i < cloud.bands.length; i++) {
      const c = cc[cloud.bands[i]]
      colors[i * 3] = c.r * 0.32; colors[i * 3 + 1] = c.g * 0.32; colors[i * 3 + 2] = c.b * 0.32
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [cloud])
  return (
    <points geometry={geo}>
      <pointsMaterial size={0.035} sizeAttenuation vertexColors transparent opacity={0.32} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  )
}

// ─────────────── axons (tract lines) ───────────────
function Tracts({ model }: { model: KModel }) {
  const { conf, callosal } = useMemo(() => {
    const conf: number[] = [], callosal: number[] = []
    for (const e of model.edges) {
      if (e.provenance === 'suggested') continue
      const a = model.byId.get(e.a), b = model.byId.get(e.b)
      if (!a || !b) continue
      ;(e.callosal ? callosal : conf).push(a.pos[0], a.pos[1], a.pos[2], b.pos[0], b.pos[1], b.pos[2])
    }
    return { conf: new Float32Array(conf), callosal: new Float32Array(callosal) }
  }, [model])
  const g1 = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(conf, 3)); return g }, [conf])
  const g2 = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(callosal, 3)); return g }, [callosal])
  return (
    <group>
      <lineSegments geometry={g1}><lineBasicMaterial color="#33437a" transparent opacity={0.28} blending={THREE.AdditiveBlending} toneMapped={false} /></lineSegments>
      <lineSegments geometry={g2}><lineBasicMaterial color="#b3c0ff" transparent opacity={0.38} blending={THREE.AdditiveBlending} toneMapped={false} /></lineSegments>
    </group>
  )
}

// ─────────────── signal particles flowing along the axons ───────────────
function AxonFlow({ model }: { model: KModel }) {
  const CAP = 2800
  const { positions, colors, A, B, baseT, count } = useMemo(() => {
    const segs: { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Color }[] = []
    for (const e of model.edges) {
      if (e.provenance === 'suggested') continue
      const a = model.byId.get(e.a), b = model.byId.get(e.b)
      if (!a || !b) continue
      segs.push({ a: new THREE.Vector3(...a.pos), b: new THREE.Vector3(...b.pos), c: COG_C[a.cognition] })
    }
    const per = Math.max(1, Math.min(4, Math.floor(CAP / Math.max(1, segs.length))))
    const count = Math.min(CAP, segs.length * per)
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const A = new Float32Array(count * 3), B = new Float32Array(count * 3), baseT = new Float32Array(count)
    let k = 0
    for (const s of segs) {
      for (let j = 0; j < per && k < count; j++, k++) {
        A[k * 3] = s.a.x; A[k * 3 + 1] = s.a.y; A[k * 3 + 2] = s.a.z
        B[k * 3] = s.b.x; B[k * 3 + 1] = s.b.y; B[k * 3 + 2] = s.b.z
        baseT[k] = (j / per) + Math.random() * 0.12
        colors[k * 3] = s.c.r; colors[k * 3 + 1] = s.c.g; colors[k * 3 + 2] = s.c.b
        positions[k * 3] = s.a.x; positions[k * 3 + 1] = s.a.y; positions[k * 3 + 2] = s.a.z
      }
    }
    return { positions, colors, A, B, baseT, count }
  }, [model])

  const ref = useRef<THREE.Points>(null)
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [positions, colors])

  useFrame((state) => {
    const pts = ref.current; if (!pts) return
    const attr = geo.getAttribute('position') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    const flow = useKnowledge.getState().simRunning ? 0.14 : 0.03
    const t = state.clock.elapsedTime * flow
    for (let i = 0; i < count; i++) {
      let tt = (baseT[i] + t) % 1
      const i3 = i * 3
      arr[i3] = A[i3] + (B[i3] - A[i3]) * tt
      arr[i3 + 1] = A[i3 + 1] + (B[i3 + 1] - A[i3 + 1]) * tt
      arr[i3 + 2] = A[i3 + 2] + (B[i3 + 2] - A[i3 + 2]) * tt
    }
    attr.needsUpdate = true
  })

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={0.1} sizeAttenuation vertexColors transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  )
}

// ─────────────── neurons (instanced) + cognition wave ───────────────
function Neurons({ model }: { model: KModel }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const setHovered = useKnowledge((s) => s.setHovered)
  const setSelected = useKnowledge((s) => s.setSelected)
  const setFocus = useKnowledge((s) => s.setFocus)

  const N = model.nodes.length
  const data = useMemo(() => model.nodes.map((n) => ({
    id: n.id, color: COG_C[n.cognition], prov: PROV_SCALE[n.provenance] ?? 0.6, z: n.pos[2],
    cognition: n.cognition, hemisphere: n.hemisphere, provName: n.provenance,
  })), [model])

  useLayoutEffect(() => {
    const mesh = ref.current; if (!mesh) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3()
    model.nodes.forEach((n, i) => {
      p.set(n.pos[0], n.pos[1], n.pos[2]); s.setScalar(n.r)
      m.compose(p, q, s); mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, data[i].color)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [model, data])

  const tmp = useMemo(() => new THREE.Color(), [])
  useFrame((state) => {
    const mesh = ref.current; if (!mesh || !mesh.instanceColor) return
    const st = useKnowledge.getState()
    const t = state.clock.elapsedTime
    const wave = st.simRunning ? BRAIN.length - ((t * 3.4) % (BRAIN.length * 2.4)) : 999
    for (let i = 0; i < N; i++) {
      const d = data[i]
      let b = 0.62 + d.prov * 0.5
      if (st.simRunning) { const dz = d.z - wave; b += Math.exp(-(dz * dz) / 1.6) * 1.6 }
      if (st.selected === d.id) b += 1.5
      else if (st.hovered === d.id) b += 0.9
      if (st.cogFilter && d.cognition !== st.cogFilter) b *= 0.09
      if (st.hemiFilter && d.hemisphere !== st.hemiFilter) b *= 0.09
      if (st.provFilter && d.provName !== st.provFilter) b *= 0.1
      tmp.copy(d.color).multiplyScalar(b)
      mesh.setColorAt(i, tmp)
    }
    mesh.instanceColor.needsUpdate = true
  })

  const onMove = (e: any) => { e.stopPropagation(); const id = model.nodes[e.instanceId]?.id; if (id) { setHovered(id); document.body.style.cursor = 'pointer' } }
  const onOut = () => { setHovered(null); document.body.style.cursor = 'auto' }
  const onDown = (e: any) => { e.stopPropagation(); const id = model.nodes[e.instanceId]?.id; if (id) { setSelected(id); setFocus(id) } }

  return (
    <instancedMesh ref={ref} args={[undefined as any, undefined as any, N]} onPointerMove={onMove} onPointerOut={onOut} onPointerDown={onDown}>
      <sphereGeometry args={[1, 14, 14]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

function ActiveRing({ model }: { model: KModel }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const st = useKnowledge.getState()
    const id = st.selected || st.hovered
    const n = id ? model.byId.get(id) : null
    const m = ref.current; if (!m) return
    if (n) { m.visible = true; m.position.set(n.pos[0], n.pos[1], n.pos[2]); m.scale.setScalar(n.r * 2.6); m.rotation.z += 0.03; m.rotation.x = Math.PI / 2.6 }
    else m.visible = false
  })
  return (
    <mesh ref={ref} visible={false}>
      <torusGeometry args={[1, 0.05, 8, 40]} />
      <meshBasicMaterial color="#eef2ff" toneMapped={false} transparent opacity={0.9} />
    </mesh>
  )
}

function SpineLabels({ model }: { model: KModel }) {
  return (
    <group>
      {SPINE.map((s) => {
        const n = model.byId.get(s.anchor); if (!n) return null
        const col = COGNITION_COLOR[n.cognition]
        return (
          <Html key={s.key} center position={[n.pos[0], n.pos[1] + n.r + 0.9, n.pos[2]]} distanceFactor={20} style={{ pointerEvents: 'none' }} zIndexRange={[15, 0]}>
            <div style={{ whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700, color: '#eef2ff', letterSpacing: 0.5, textShadow: `0 1px 8px #000, 0 0 12px ${col}`, padding: '2px 8px', borderRadius: 6, background: 'rgba(8,10,22,.55)', border: `1px solid ${col}66` }}>{s.label}</div>
          </Html>
        )
      })}
    </group>
  )
}

// Drive the canvas size imperatively from the parent's measured dimensions.
// R3F's own measurement (react-use-measure) defers to requestAnimationFrame,
// which a backgrounded tab pauses — leaving the canvas frozen at the 300×150
// default (looks blank). The parent measures with a ResizeObserver (not rAF),
// so forcing setSize here guarantees a filled canvas regardless of tab focus.
function Resizer({ width, height }: { width: number; height: number }) {
  const setSize = useThree((s) => s.setSize)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    if (width < 2 || height < 2) return
    setSize(width, height)
    const cam = camera as THREE.PerspectiveCamera
    cam.aspect = width / height
    cam.updateProjectionMatrix()
  }, [width, height, setSize, camera])
  return null
}

// dev-only: expose the R3F root so a headless (rAF-paused) tab can force a manual
// render + pixel readback for verification.
function DebugExpose() {
  const state = useThree()
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __kg?: unknown }).__kg = state }, [state])
  return null
}

function CameraRig({ model }: { model: KModel }) {
  const controls = useRef<any>(null)
  const { camera } = useThree()
  const focus = useKnowledge((s) => s.focus)
  const arrived = useRef(true)
  const last = useRef<string | null>(null)
  const dPos = useRef(new THREE.Vector3(0, 19, 14))
  const dTgt = useRef(new THREE.Vector3(0, 0, -0.5))
  useFrame(() => {
    if (focus !== last.current) {
      last.current = focus; arrived.current = false
      const n = focus ? model.byId.get(focus) : null
      if (n) { const p = new THREE.Vector3(...n.pos); dTgt.current.copy(p); dPos.current.set(p.x + 3, p.y + 6, p.z + 7) }
      else { dTgt.current.set(0, 0, -0.5); dPos.current.set(0, 19, 14) }
    }
    if (!arrived.current) {
      camera.position.lerp(dPos.current, 0.06)
      const c = controls.current; if (c) { c.target.lerp(dTgt.current, 0.06); c.update() }
      if (camera.position.distanceTo(dPos.current) < 0.4) arrived.current = true
    }
  })
  return <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={0.08} minDistance={5} maxDistance={70} rotateSpeed={0.55} />
}

// ─────────────── scene root ───────────────
export function KnowledgeScene({ model, cloud, width, height }: { model: KModel; cloud: { positions: Float32Array; bands: Uint8Array }; width: number; height: number }) {
  return (
    <Canvas
      className="kg-canvas"
      style={{ width, height }}
      dpr={[1, 2]}
      camera={{ position: [0, 19, 14], fov: 50, near: 0.1, far: 400 }}
      gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      onCreated={({ gl }) => gl.setClearColor('#04050d', 1)}
    >
      <DebugExpose />
      <Resizer width={width} height={height} />
      <fog attach="fog" args={['#04050d', 28, 76]} />
      <ambientLight intensity={0.5} />
      <TissueHaze cloud={cloud} />
      <Tracts model={model} />
      <AxonFlow model={model} />
      <Neurons model={model} />
      <ActiveRing model={model} />
      <SpineLabels model={model} />
      <CameraRig model={model} />
      <EffectComposer>
        <Bloom intensity={1.15} luminanceThreshold={0.18} luminanceSmoothing={0.85} mipmapBlur radius={0.8} />
        <Vignette eskil={false} offset={0.2} darkness={0.92} />
      </EffectComposer>
    </Canvas>
  )
}
