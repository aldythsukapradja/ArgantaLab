// WS3 — the Cognitive Cortex. A dense, brain-shaped neural constellation over the
// REAL vault, seen from above: left hemisphere = analytic, right = creative,
// front→back = THINK · KNOW · DO. Every real note is an instanced neuron; a
// dense synapse field gives the tissue; real wikilinks are white-matter tracts;
// and a cognition wave sweeps THINK→KNOW→DO, firing nodes as it passes — the
// company thinking. Bloom does the glow. Provenance is encoded in brightness.

import { useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { KModel } from './model'
import { COGNITION_COLOR, BRAIN, type Cognition } from './brain'
import { useKnowledge } from './store'
import { SPINE } from './spine'

const PROV_SCALE: Record<string, number> = { live: 1, partial: 0.7, simulated: 0.5, placeholder: 0.32 }
const COG_C: Record<Cognition, THREE.Color> = {
  think: new THREE.Color(COGNITION_COLOR.think),
  know: new THREE.Color(COGNITION_COLOR.know),
  do: new THREE.Color(COGNITION_COLOR.do),
}

// ─────────────────────────── synapse tissue ───────────────────────────
function NeuronField({ cloud }: { cloud: { positions: Float32Array; bands: Uint8Array } }) {
  const ref = useRef<THREE.Points>(null)
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(cloud.positions, 3))
    const colors = new Float32Array(cloud.positions.length)
    const cc = [COG_C.think, COG_C.know, COG_C.do]
    for (let i = 0; i < cloud.bands.length; i++) {
      const c = cc[cloud.bands[i]]
      colors[i * 3] = c.r * 0.45; colors[i * 3 + 1] = c.g * 0.45; colors[i * 3 + 2] = c.b * 0.45
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [cloud])
  useFrame((s) => { if (ref.current) ref.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.04) * 0.015 })
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={0.06} sizeAttenuation vertexColors transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  )
}

// ─────────────────────────── white-matter tracts ───────────────────────────
function Tracts({ model }: { model: KModel }) {
  const { conf, callosal, sug } = useMemo(() => {
    const conf: number[] = [], callosal: number[] = [], sug: number[] = []
    for (const e of model.edges) {
      const a = model.byId.get(e.a), b = model.byId.get(e.b)
      if (!a || !b) continue
      const seg = [a.pos[0], a.pos[1], a.pos[2], b.pos[0], b.pos[1], b.pos[2]]
      if (e.provenance === 'suggested') sug.push(...seg)
      else if (e.callosal) callosal.push(...seg)
      else conf.push(...seg)
    }
    return { conf: new Float32Array(conf), callosal: new Float32Array(callosal), sug: new Float32Array(sug) }
  }, [model])
  const mk = (arr: Float32Array) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3)); return g }
  const gConf = useMemo(() => mk(conf), [conf])
  const gCall = useMemo(() => mk(callosal), [callosal])
  const gSug = useMemo(() => mk(sug), [sug])
  return (
    <group>
      <lineSegments geometry={gConf}><lineBasicMaterial color="#2f3d6b" transparent opacity={0.22} blending={THREE.AdditiveBlending} toneMapped={false} /></lineSegments>
      <lineSegments geometry={gCall}><lineBasicMaterial color="#aab6ff" transparent opacity={0.3} blending={THREE.AdditiveBlending} toneMapped={false} /></lineSegments>
      <lineSegments geometry={gSug} onUpdate={(l) => (l as THREE.LineSegments).computeLineDistances()}><lineDashedMaterial color="#8b7cf6" dashSize={0.4} gapSize={0.4} transparent opacity={0.14} toneMapped={false} /></lineSegments>
    </group>
  )
}

// ─────────────────────────── neurons (instanced) + cognition wave ───────────────────────────
function Neurons({ model }: { model: KModel }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const setHovered = useKnowledge((s) => s.setHovered)
  const setSelected = useKnowledge((s) => s.setSelected)
  const setFocus = useKnowledge((s) => s.setFocus)

  const N = model.nodes.length
  const data = useMemo(() => model.nodes.map((n) => ({
    color: COG_C[n.cognition], prov: PROV_SCALE[n.provenance] ?? 0.6, z: n.pos[2],
    cognition: n.cognition, hemisphere: n.hemisphere, provName: n.provenance,
  })), [model])

  useLayoutEffect(() => {
    const mesh = ref.current; if (!mesh) return
    const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const s = new THREE.Vector3(); const p = new THREE.Vector3()
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
    // cognition wave: a front→back sweep (THINK +Z → DO −Z), looping
    const wave = st.simRunning ? BRAIN.length - ((t * 3.4) % (BRAIN.length * 2.4)) : 999
    for (let i = 0; i < N; i++) {
      const d = data[i]
      let b = 0.35 + d.prov * 0.55
      // activation as the wave passes this node's depth
      if (st.simRunning) { const dz = d.z - wave; b += Math.exp(-(dz * dz) / 1.6) * 1.5 }
      // hover / selection lift
      const id = model.nodes[i].id
      if (st.selected === id) b += 1.4
      else if (st.hovered === id) b += 0.9
      // filters dim the rest
      if (st.cogFilter && d.cognition !== st.cogFilter) b *= 0.1
      if (st.hemiFilter && d.hemisphere !== st.hemiFilter) b *= 0.1
      if (st.provFilter && d.provName !== st.provFilter) b *= 0.12
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
      <sphereGeometry args={[1, 12, 12]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

// selection/hover ring that follows the active node
function ActiveRing({ model }: { model: KModel }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const st = useKnowledge.getState()
    const id = st.selected || st.hovered
    const n = id ? model.byId.get(id) : null
    const m = ref.current; if (!m) return
    if (n) { m.visible = true; m.position.set(n.pos[0], n.pos[1], n.pos[2]); const sc = n.r * 2.4; m.scale.setScalar(sc); m.rotation.z += 0.03; m.rotation.x = Math.PI / 2.6 }
    else m.visible = false
  })
  return (
    <mesh ref={ref} visible={false}>
      <torusGeometry args={[1, 0.05, 8, 40]} />
      <meshBasicMaterial color="#eef2ff" toneMapped={false} transparent opacity={0.9} />
    </mesh>
  )
}

// always-on labels for the 8 hero-spine neurons
function SpineLabels({ model }: { model: KModel }) {
  return (
    <group>
      {SPINE.map((s) => {
        const n = model.byId.get(s.anchor); if (!n) return null
        const col = COGNITION_COLOR[n.cognition]
        return (
          <Html key={s.key} center position={[n.pos[0], n.pos[1] + n.r + 0.9, n.pos[2]]} distanceFactor={20} style={{ pointerEvents: 'none' }} zIndexRange={[15, 0]}>
            <div style={{ whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700, color: '#eef2ff', letterSpacing: 0.5, textShadow: `0 1px 8px #000, 0 0 12px ${col}` , padding: '2px 8px', borderRadius: 6, background: 'rgba(8,10,22,.5)', border: `1px solid ${col}66` }}>{s.label}</div>
          </Html>
        )
      })}
    </group>
  )
}

// ─────────────────────────── camera ───────────────────────────
function CameraRig({ model }: { model: KModel }) {
  const controls = useRef<any>(null)
  const { camera } = useThree()
  const focus = useKnowledge((s) => s.focus)
  const arrived = useRef(true)
  const last = useRef<string | null>(null)
  const dPos = useRef(new THREE.Vector3(0, 21, 15))
  const dTgt = useRef(new THREE.Vector3(0, 0, -0.5))

  useFrame(() => {
    if (focus !== last.current) {
      last.current = focus; arrived.current = false
      const n = focus ? model.byId.get(focus) : null
      if (n) { const p = new THREE.Vector3(...n.pos); dTgt.current.copy(p); dPos.current.set(p.x + 3, p.y + 7, p.z + 8) }
      else { dTgt.current.set(0, 0, -0.5); dPos.current.set(0, 21, 15) }
    }
    if (!arrived.current) {
      camera.position.lerp(dPos.current, 0.06)
      const c = controls.current; if (c) { c.target.lerp(dTgt.current, 0.06); c.update() }
      if (camera.position.distanceTo(dPos.current) < 0.4) arrived.current = true
    }
  })
  return <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={0.08} minDistance={6} maxDistance={70} rotateSpeed={0.55} />
}

// ─────────────────────────── scene root ───────────────────────────
export function KnowledgeScene({ model, cloud }: { model: KModel; cloud: { positions: Float32Array; bands: Uint8Array } }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 21, 15], fov: 50, near: 0.1, far: 400 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => gl.setClearColor('#04050d', 1)}
    >
      <fog attach="fog" args={['#04050d', 30, 78]} />
      <ambientLight intensity={0.5} />
      <NeuronField cloud={cloud} />
      <Tracts model={model} />
      <Neurons model={model} />
      <ActiveRing model={model} />
      <SpineLabels model={model} />
      <CameraRig model={model} />
      <EffectComposer>
        <Bloom intensity={1.1} luminanceThreshold={0.2} luminanceSmoothing={0.85} mipmapBlur radius={0.75} />
        <Vignette eskil={false} offset={0.18} darkness={0.9} />
      </EffectComposer>
    </Canvas>
  )
}
