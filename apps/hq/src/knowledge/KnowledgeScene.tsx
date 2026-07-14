// WS3 — the Cognitive Cortex. A wrinkled two-hemisphere brain over the REAL
// vault, seen from above. Every note is a neuron on the cortical surface, placed
// in one of the 7 reactor-spine regions; real wikilinks are CURVED axons; signal
// pulses fire along them (action potentials); Command Core is the bright central
// hub radiating to every region. Bloom does the glow.

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { KModel } from './model'
import { REGIONS, REGION_BY_ID, REGION_INDEX, type RegionId } from './brain'
import { useKnowledge } from './store'

const PROV = { live: 1, partial: 0.72, simulated: 0.5, placeholder: 0.34 } as Record<string, number>
const RCOL: Record<RegionId, THREE.Color> = REGIONS.reduce((m, r) => { m[r.id] = new THREE.Color(r.color); return m }, {} as Record<RegionId, THREE.Color>)

// quadratic-bezier control point: bow the axon up and slightly outward so tracts
// arc over the cortex like white matter (never a straight line).
function control(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3 {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, mz = (a.z + b.z) / 2
  const len = a.distanceTo(b)
  const out = Math.hypot(mx, mz) || 1
  return new THREE.Vector3(mx + (mx / out) * len * 0.14, my + len * 0.34 + 0.5, mz + (mz / out) * len * 0.14)
}
const bez = (a: number, c: number, b: number, t: number) => { const it = 1 - t; return it * it * a + 2 * it * t * c + t * t * b }

// ─────────────── cortical tissue (the brain surface) ───────────────
function CorticalTissue({ tissue }: { tissue: { positions: Float32Array; region: Uint8Array } }) {
  const ref = useRef<THREE.Points>(null)
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(tissue.positions, 3))
    const colors = new Float32Array(tissue.positions.length)
    for (let i = 0; i < tissue.region.length; i++) {
      const c = RCOL[REGION_INDEX[tissue.region[i]]]
      colors[i * 3] = c.r * 0.6; colors[i * 3 + 1] = c.g * 0.6; colors[i * 3 + 2] = c.b * 0.6
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [tissue])
  useFrame((s) => { if (ref.current) ref.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.03) * 0.01 })
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={0.05} sizeAttenuation vertexColors transparent opacity={0.62} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  )
}

// ─────────────── curved axons + firing pulses ───────────────
function Axons({ model }: { model: KModel }) {
  const SEG = 12
  const { lineGeo, A, C, B, pcol, pcount } = useMemo(() => {
    const verts: number[] = []
    const A: number[] = [], C: number[] = [], B: number[] = [], pcol: number[] = []
    const va = new THREE.Vector3(), vb = new THREE.Vector3()
    let pcount = 0
    const PMAX = 1600
    for (const e of model.edges) {
      const na = model.byId.get(e.a), nb = model.byId.get(e.b)
      if (!na || !nb) continue
      va.set(...na.pos); vb.set(...nb.pos)
      const c = control(va, vb)
      // sampled polyline for the tract
      let px = va.x, py = va.y, pz = va.z
      for (let i = 1; i <= SEG; i++) {
        const t = i / SEG
        const x = bez(va.x, c.x, vb.x, t), y = bez(va.y, c.y, vb.y, t), z = bez(va.z, c.z, vb.z, t)
        verts.push(px, py, pz, x, y, z); px = x; py = y; pz = z
      }
      // firing pulses ride the same curve
      if (pcount < PMAX && (e.hub || e.provenance === 'confirmed')) {
        const col = RCOL[na.region]
        const n = e.hub ? 3 : 1
        for (let k = 0; k < n && pcount < PMAX; k++) {
          A.push(va.x, va.y, va.z); C.push(c.x, c.y, c.z); B.push(vb.x, vb.y, vb.z)
          pcol.push(col.r, col.g, col.b); pcount++
        }
      }
    }
    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
    return { lineGeo, A: new Float32Array(A), C: new Float32Array(C), B: new Float32Array(B), pcol: new Float32Array(pcol), pcount }
  }, [model])

  const pulses = useRef<THREE.Points>(null)
  const pgeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pcount * 3), 3))
    g.setAttribute('color', new THREE.BufferAttribute(pcol, 3))
    return g
  }, [pcount, pcol])
  const phase = useMemo(() => Float32Array.from({ length: pcount }, () => Math.random()), [pcount])

  useFrame((state) => {
    const p = pulses.current; if (!p) return
    const on = useKnowledge.getState().simRunning
    const speed = on ? 0.16 : 0.03
    const t = state.clock.elapsedTime * speed
    const arr = (pgeo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
    for (let i = 0; i < pcount; i++) {
      const tt = (phase[i] + t) % 1, i3 = i * 3
      arr[i3] = bez(A[i3], C[i3], B[i3], tt)
      arr[i3 + 1] = bez(A[i3 + 1], C[i3 + 1], B[i3 + 1], tt)
      arr[i3 + 2] = bez(A[i3 + 2], C[i3 + 2], B[i3 + 2], tt)
    }
    ;(pgeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
  })

  return (
    <group>
      <lineSegments geometry={lineGeo}><lineBasicMaterial color="#2b3a6b" transparent opacity={0.16} blending={THREE.AdditiveBlending} toneMapped={false} /></lineSegments>
      <points ref={pulses} geometry={pgeo}><pointsMaterial size={0.11} sizeAttenuation vertexColors transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></points>
    </group>
  )
}

// ─────────────── neurons (instanced) + firing ───────────────
function Neurons({ model }: { model: KModel }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const setHovered = useKnowledge((s) => s.setHovered)
  const setSelected = useKnowledge((s) => s.setSelected)
  const setFocus = useKnowledge((s) => s.setFocus)
  const N = model.nodes.length
  const data = useMemo(() => model.nodes.map((n) => ({
    id: n.id, color: RCOL[n.region], prov: PROV[n.provenance] ?? 0.6, region: n.region, triad: n.triad,
    hemisphere: n.hemisphere, provName: n.provenance, phase: Math.random() * Math.PI * 2, rate: 0.5 + Math.random() * 2.5,
  })), [model])

  useLayoutEffect(() => {
    const mesh = ref.current; if (!mesh) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3()
    model.nodes.forEach((n, i) => { p.set(...n.pos); s.setScalar(n.r); m.compose(p, q, s); mesh.setMatrixAt(i, m); mesh.setColorAt(i, data[i].color) })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [model, data])

  const tmp = useMemo(() => new THREE.Color(), [])
  useFrame((state) => {
    const mesh = ref.current; if (!mesh || !mesh.instanceColor) return
    const st = useKnowledge.getState(); const t = state.clock.elapsedTime
    // slow THINK→KNOW→DO activation sweep
    const cyc = (t * 0.11) % 3
    const activeTriad = cyc < 1 ? 'think' : cyc < 2 ? 'know' : 'do'
    for (let i = 0; i < N; i++) {
      const d = data[i]
      let b = 0.52 + d.prov * 0.42
      if (st.simRunning) {
        // spontaneous action potential: sharp occasional flash per neuron
        const spike = Math.pow(Math.max(0, Math.sin(t * d.rate + d.phase)), 16)
        b += spike * 1.6
        if (d.triad === activeTriad) b += 0.5
      }
      if (st.selected === d.id) b += 1.6
      else if (st.hovered === d.id) b += 0.9
      if (st.triadFilter && d.triad !== st.triadFilter) b *= 0.08
      if (st.regionFilter && d.region !== st.regionFilter) b *= 0.08
      if (st.hemiFilter && d.hemisphere !== st.hemiFilter) b *= 0.08
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
      <sphereGeometry args={[1, 12, 12]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

// ─────────────── Command Core (central hub) ───────────────
function CommandCore({ model }: { model: KModel }) {
  const ref = useRef<THREE.Mesh>(null)
  const glow = useRef<THREE.Mesh>(null)
  const node = model.commandId ? model.byId.get(model.commandId) : null
  const pos = node ? node.pos : [0, -0.4, 0.4] as [number, number, number]
  useFrame((s) => {
    const t = s.clock.elapsedTime; const pulse = 1 + Math.sin(t * 2.2) * 0.12
    if (ref.current) ref.current.scale.setScalar(0.72 * pulse)
    if (glow.current) { glow.current.scale.setScalar(1.35 + Math.sin(t * 2.2) * 0.16); (glow.current.material as THREE.Material & { opacity: number }).opacity = 0.14 + Math.sin(t * 2.2) * 0.04 }
  })
  return (
    <group position={pos}>
      <mesh ref={ref}><sphereGeometry args={[1, 24, 24]} /><meshBasicMaterial color="#d6f7ff" toneMapped={false} /></mesh>
      <mesh ref={glow}><sphereGeometry args={[1, 16, 16]} /><meshBasicMaterial color="#70e7ff" transparent opacity={0.14} toneMapped={false} depthWrite={false} /></mesh>
    </group>
  )
}

// ─────────────── the 7 region labels ───────────────
function RegionLabels({ model }: { model: KModel }) {
  return (
    <group>
      {REGIONS.map((r) => {
        // anchor on the region's hero neuron when present, else the atlas anchor
        const hero = model.nodes.find((n) => n.hero && n.region === r.id)
        const p = hero ? [hero.pos[0], hero.pos[1] + 0.9, hero.pos[2]] : r.anchor
        return (
          <Html key={r.id} center position={p as [number, number, number]} distanceFactor={18} style={{ pointerEvents: 'none' }} zIndexRange={[16, 0]}>
            <div style={{ whiteSpace: 'nowrap', fontSize: r.id === 'command' ? 13 : 11.5, fontWeight: 700, color: '#fff', letterSpacing: 0.5, textShadow: `0 1px 8px #000, 0 0 14px ${r.color}`, padding: '2px 9px', borderRadius: 7, background: 'rgba(6,9,20,.6)', border: `1px solid ${r.color}77` }}>
              {r.label}
            </div>
          </Html>
        )
      })}
    </group>
  )
}

// hover/select ring
function ActiveRing({ model }: { model: KModel }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const st = useKnowledge.getState(); const id = st.selected || st.hovered
    const n = id ? model.byId.get(id) : null; const m = ref.current; if (!m) return
    if (n) { m.visible = true; m.position.set(...n.pos); m.scale.setScalar(n.r * 2.6); m.rotation.z += 0.03; m.rotation.x = Math.PI / 2.4 }
    else m.visible = false
  })
  return <mesh ref={ref} visible={false}><torusGeometry args={[1, 0.05, 8, 40]} /><meshBasicMaterial color="#eef2ff" toneMapped={false} transparent opacity={0.9} /></mesh>
}

// ─────────────── plumbing (camera, resize, debug) ───────────────
function DebugExpose() { const s = useThree(); useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __kg?: unknown }).__kg = s }, [s]); return null }
function Heartbeat({ onFrame }: { onFrame?: () => void }) { useFrame(() => onFrame?.()); return null }
function Resizer({ width, height }: { width: number; height: number }) {
  const setSize = useThree((s) => s.setSize); const camera = useThree((s) => s.camera)
  useEffect(() => { if (width < 2 || height < 2) return; setSize(width, height); const c = camera as THREE.PerspectiveCamera; c.aspect = width / height; c.updateProjectionMatrix() }, [width, height, setSize, camera])
  return null
}
function CameraRig({ model }: { model: KModel }) {
  const controls = useRef<any>(null); const { camera } = useThree()
  const focus = useKnowledge((s) => s.focus); const arrived = useRef(true); const last = useRef<string | null>(null)
  const dPos = useRef(new THREE.Vector3(0, 16, 14)); const dTgt = useRef(new THREE.Vector3(0, 0, 0))
  useFrame(() => {
    if (focus !== last.current) {
      last.current = focus; arrived.current = false
      const n = focus ? model.byId.get(focus) : null
      if (n) { const p = new THREE.Vector3(...n.pos); dTgt.current.copy(p); dPos.current.set(p.x + 3, p.y + 6, p.z + 7) }
      else { dTgt.current.set(0, 0, 0); dPos.current.set(0, 16, 14) }
    }
    if (!arrived.current) {
      camera.position.lerp(dPos.current, 0.06); const c = controls.current
      if (c) { c.target.lerp(dTgt.current, 0.06); c.update() }
      if (camera.position.distanceTo(dPos.current) < 0.4) arrived.current = true
    }
  })
  return <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={0.08} minDistance={5} maxDistance={60} rotateSpeed={0.55} />
}

export function KnowledgeScene({ model, tissue, width, height, onFrame }: {
  model: KModel; tissue: { positions: Float32Array; region: Uint8Array }; width: number; height: number; onFrame?: () => void
}) {
  return (
    <Canvas style={{ width, height }} dpr={[1, 2]} camera={{ position: [0, 16, 14], fov: 50, near: 0.1, far: 400 }}
      gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      onCreated={({ gl }) => gl.setClearColor('#04050d', 1)}>
      <DebugExpose /><Heartbeat onFrame={onFrame} /><Resizer width={width} height={height} />
      <fog attach="fog" args={['#04050d', 26, 70]} />
      <ambientLight intensity={0.5} />
      <CorticalTissue tissue={tissue} />
      <Axons model={model} />
      <Neurons model={model} />
      <CommandCore model={model} />
      <ActiveRing model={model} />
      <RegionLabels model={model} />
      <CameraRig model={model} />
      <EffectComposer>
        <Bloom intensity={0.95} luminanceThreshold={0.22} luminanceSmoothing={0.88} mipmapBlur radius={0.75} />
        <Vignette eskil={false} offset={0.2} darkness={0.92} />
      </EffectComposer>
    </Canvas>
  )
}

export { REGION_BY_ID }
