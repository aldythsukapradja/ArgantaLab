// WS3 — the Cognitive Cortex. A wrinkled two-hemisphere brain over the REAL
// vault, seen from above. Every note is a small neuron on the cortical surface,
// grouped into the 7 reactor-spine regions; real wikilinks are CURVED axons;
// action-potential pulses fire along them; Command Core is the central hub. The
// whole scene follows the app's light/dark theme.

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { KModel } from './model'
import { REGIONS, REGION_BY_ID, REGION_INDEX, type RegionId } from './brain'
import { useKnowledge } from './store'
import { activationFor } from './activation'

const PROV = { live: 1, partial: 0.72, simulated: 0.5, placeholder: 0.34 } as Record<string, number>
const RCOL: Record<RegionId, THREE.Color> = REGIONS.reduce((m, r) => { m[r.id] = new THREE.Color(r.color); return m }, {} as Record<RegionId, THREE.Color>)

interface Theme {
  clear: string; fog: string; fogNear: number; fogFar: number
  tissueScale: number; tissueOpacity: number; blend: THREE.Blending
  axon: string; axonOpacity: number; pulseOpacity: number
  bloomI: number; bloomT: number; vignette: number
  base: number; provW: number; spike: number; active: number
  labelText: string; labelBg: string; commandColor: string; commandCore: string; ring: string
}
function theme(dark: boolean): Theme {
  return dark ? {
    clear: '#04050d', fog: '#04050d', fogNear: 26, fogFar: 72,
    tissueScale: 0.62, tissueOpacity: 0.6, blend: THREE.AdditiveBlending,
    axon: '#2b3a6b', axonOpacity: 0.16, pulseOpacity: 0.95,
    bloomI: 0.95, bloomT: 0.22, vignette: 0.9,
    base: 0.52, provW: 0.42, spike: 1.6, active: 0.5,
    labelText: '#fff', labelBg: 'rgba(6,9,20,.6)', commandColor: '#70e7ff', commandCore: '#d6f7ff', ring: '#eef2ff',
  } : {
    clear: '#eaeef7', fog: '#eaeef7', fogNear: 30, fogFar: 82,
    tissueScale: 0.95, tissueOpacity: 0.62, blend: THREE.NormalBlending,
    axon: '#93a0c8', axonOpacity: 0.5, pulseOpacity: 0.92,
    bloomI: 0.32, bloomT: 0.55, vignette: 0.32,
    base: 0.86, provW: 0.2, spike: 0.55, active: 0.3,
    labelText: '#0b1020', labelBg: 'rgba(255,255,255,.82)', commandColor: '#0891b2', commandCore: '#0e7490', ring: '#1e293b',
  }
}

const bez = (a: number, c: number, b: number, t: number) => { const it = 1 - t; return it * it * a + 2 * it * t * c + t * t * b }
function control(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3 {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, mz = (a.z + b.z) / 2
  const len = a.distanceTo(b); const out = Math.hypot(mx, mz) || 1
  return new THREE.Vector3(mx + (mx / out) * len * 0.14, my + len * 0.34 + 0.5, mz + (mz / out) * len * 0.14)
}

// ─────────────── cortical tissue (the brain body) ───────────────
function CorticalTissue({ tissue, th }: { tissue: { positions: Float32Array; region: Uint8Array }; th: Theme }) {
  const ref = useRef<THREE.Points>(null)
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(tissue.positions, 3))
    const colors = new Float32Array(tissue.positions.length)
    for (let i = 0; i < tissue.region.length; i++) {
      const c = RCOL[REGION_INDEX[tissue.region[i]]]
      colors[i * 3] = c.r * th.tissueScale; colors[i * 3 + 1] = c.g * th.tissueScale; colors[i * 3 + 2] = c.b * th.tissueScale
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [tissue, th.tissueScale])
  useFrame((s) => { if (ref.current) ref.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.03) * 0.01 })
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={0.05} sizeAttenuation vertexColors transparent opacity={th.tissueOpacity} depthWrite={false} blending={th.blend} toneMapped={false} />
    </points>
  )
}

// ─────────────── curved axons + firing pulses ───────────────
function Axons({ model, th }: { model: KModel; th: Theme }) {
  const SEG = 12, PMAX = 1600
  const { lineGeo, A, C, B, pcol, pcount } = useMemo(() => {
    const verts: number[] = [], A: number[] = [], C: number[] = [], B: number[] = [], pcol: number[] = []
    const va = new THREE.Vector3(), vb = new THREE.Vector3(); let pcount = 0
    for (const e of model.edges) {
      const na = model.byId.get(e.a), nb = model.byId.get(e.b); if (!na || !nb) continue
      va.set(...na.pos); vb.set(...nb.pos); const c = control(va, vb)
      let px = va.x, py = va.y, pz = va.z
      for (let i = 1; i <= SEG; i++) { const t = i / SEG; const x = bez(va.x, c.x, vb.x, t), y = bez(va.y, c.y, vb.y, t), z = bez(va.z, c.z, vb.z, t); verts.push(px, py, pz, x, y, z); px = x; py = y; pz = z }
      if (pcount < PMAX && (e.hub || e.provenance === 'confirmed')) {
        const col = RCOL[na.region]; const n = e.hub ? 3 : 1
        for (let k = 0; k < n && pcount < PMAX; k++) { A.push(va.x, va.y, va.z); C.push(c.x, c.y, c.z); B.push(vb.x, vb.y, vb.z); pcol.push(col.r, col.g, col.b); pcount++ }
      }
    }
    const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
    return { lineGeo, A: new Float32Array(A), C: new Float32Array(C), B: new Float32Array(B), pcol: new Float32Array(pcol), pcount }
  }, [model])

  const pulses = useRef<THREE.Points>(null)
  const pgeo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pcount * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(pcol, 3)); return g }, [pcount, pcol])
  const phase = useMemo(() => Float32Array.from({ length: pcount }, () => Math.random()), [pcount])

  useFrame((state) => {
    if (!pulses.current) return
    const on = useKnowledge.getState().simRunning; const t = state.clock.elapsedTime * (on ? 0.16 : 0.03)
    const arr = (pgeo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
    for (let i = 0; i < pcount; i++) { const tt = (phase[i] + t) % 1, j = i * 3; arr[j] = bez(A[j], C[j], B[j], tt); arr[j + 1] = bez(A[j + 1], C[j + 1], B[j + 1], tt); arr[j + 2] = bez(A[j + 2], C[j + 2], B[j + 2], tt) }
    ;(pgeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
  })
  return (
    <group>
      <lineSegments geometry={lineGeo}><lineBasicMaterial color={th.axon} transparent opacity={th.axonOpacity} blending={th.blend} toneMapped={false} /></lineSegments>
      <points ref={pulses} geometry={pgeo}><pointsMaterial size={0.09} sizeAttenuation vertexColors transparent opacity={th.pulseOpacity} depthWrite={false} blending={th.blend} toneMapped={false} /></points>
    </group>
  )
}

// ─────────────── neurons (instanced) + firing ───────────────
function Neurons({ model, th }: { model: KModel; th: Theme }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const setHovered = useKnowledge((s) => s.setHovered), setSelected = useKnowledge((s) => s.setSelected), setFocus = useKnowledge((s) => s.setFocus)
  const N = model.nodes.length
  const data = useMemo(() => model.nodes.map((n) => ({
    id: n.id, color: RCOL[n.region], prov: PROV[n.provenance] ?? 0.6, region: n.region, triad: n.triad,
    hemisphere: n.hemisphere, provName: n.provenance, phase: Math.random() * Math.PI * 2, rate: 0.5 + Math.random() * 2.5,
  })), [model])
  useLayoutEffect(() => {
    const mesh = ref.current; if (!mesh) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3()
    model.nodes.forEach((n, i) => { p.set(...n.pos); s.setScalar(n.r); m.compose(p, q, s); mesh.setMatrixAt(i, m); mesh.setColorAt(i, data[i].color) })
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [model, data])
  const tmp = useMemo(() => new THREE.Color(), [])
  useFrame((state) => {
    const mesh = ref.current; if (!mesh || !mesh.instanceColor) return
    const st = useKnowledge.getState(); const t = state.clock.elapsedTime
    // Run 2: when a cinematic scene is active, region activation (from the
    // narration/audio-envelope, via activation.ts) drives brightness instead of
    // the ambient THINK→KNOW→DO sweep; individual neurons still spike a little
    // for organic texture, scaled by how active their region is right now.
    const act = activationFor(st.scene)
    const cyc = (t * 0.11) % 3; const activeTriad = cyc < 1 ? 'think' : cyc < 2 ? 'know' : 'do'
    for (let i = 0; i < N; i++) {
      const d = data[i]; let b = th.base + d.prov * th.provW
      if (act) {
        const w = act[d.region] ?? 0.08
        b += w * th.spike
        if (st.simRunning) b += Math.pow(Math.max(0, Math.sin(t * d.rate + d.phase)), 16) * th.spike * 0.35 * (0.4 + w)
      } else if (st.simRunning) {
        b += Math.pow(Math.max(0, Math.sin(t * d.rate + d.phase)), 16) * th.spike; if (d.triad === activeTriad) b += th.active
      }
      if (st.selected === d.id) b += 1.6; else if (st.hovered === d.id) b += 0.9
      if (st.triadFilter && d.triad !== st.triadFilter) b *= 0.08
      if (st.regionFilter && d.region !== st.regionFilter) b *= 0.08
      if (st.hemiFilter && d.hemisphere !== st.hemiFilter) b *= 0.08
      if (st.provFilter && d.provName !== st.provFilter) b *= 0.1
      tmp.copy(d.color).multiplyScalar(b); mesh.setColorAt(i, tmp)
    }
    mesh.instanceColor.needsUpdate = true
  })
  const onMove = (e: any) => { e.stopPropagation(); const id = model.nodes[e.instanceId]?.id; if (id) { setHovered(id); document.body.style.cursor = 'pointer' } }
  const onOut = () => { setHovered(null); document.body.style.cursor = 'auto' }
  const onDown = (e: any) => { e.stopPropagation(); const id = model.nodes[e.instanceId]?.id; if (id) { setSelected(id); setFocus(id) } }
  return (
    <instancedMesh ref={ref} args={[undefined as any, undefined as any, N]} onPointerMove={onMove} onPointerOut={onOut} onPointerDown={onDown}>
      <sphereGeometry args={[1, 10, 10]} /><meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

function CommandCore({ model, th }: { model: KModel; th: Theme }) {
  const ref = useRef<THREE.Mesh>(null), glow = useRef<THREE.Mesh>(null)
  const node = model.commandId ? model.byId.get(model.commandId) : null
  const pos = node ? node.pos : [0, -0.4, 0.4] as [number, number, number]
  useFrame((s) => {
    const st = useKnowledge.getState()
    // Run 2: Command Core pulses harder while a cinematic scene carries intensity
    const boost = st.scene ? 0.7 + st.scene.intensity * 1.1 : 1
    const t = s.clock.elapsedTime, pulse = 1 + Math.sin(t * 2.2) * 0.12 * boost
    if (ref.current) ref.current.scale.setScalar(0.42 * pulse * Math.min(1.35, boost))
    if (glow.current) { glow.current.scale.setScalar((0.9 + Math.sin(t * 2.2) * 0.12) * Math.min(1.5, boost)); (glow.current.material as THREE.Material & { opacity: number }).opacity = (0.14 + Math.sin(t * 2.2) * 0.04) * Math.min(1.4, boost) }
  })
  return (
    <group position={pos}>
      <mesh ref={ref}><sphereGeometry args={[1, 20, 20]} /><meshBasicMaterial color={th.commandCore} toneMapped={false} /></mesh>
      <mesh ref={glow}><sphereGeometry args={[1, 14, 14]} /><meshBasicMaterial color={th.commandColor} transparent opacity={0.14} toneMapped={false} depthWrite={false} /></mesh>
    </group>
  )
}

function RegionLabels({ model, th }: { model: KModel; th: Theme }) {
  return (
    <group>
      {REGIONS.map((r) => {
        const hero = model.nodes.find((n) => n.hero && n.region === r.id)
        const p = hero ? [hero.pos[0], hero.pos[1] + 0.7, hero.pos[2]] : r.anchor
        return (
          <Html key={r.id} center position={p as [number, number, number]} distanceFactor={17} style={{ pointerEvents: 'none' }} zIndexRange={[16, 0]}>
            <div style={{ whiteSpace: 'nowrap', fontSize: r.id === 'command' ? 12.5 : 11, fontWeight: 700, color: th.labelText, letterSpacing: 0.4, textShadow: `0 0 12px ${r.color}`, padding: '2px 9px', borderRadius: 7, background: th.labelBg, border: `1px solid ${r.color}88` }}>{r.label}</div>
          </Html>
        )
      })}
    </group>
  )
}

function ActiveRing({ model, th }: { model: KModel; th: Theme }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const st = useKnowledge.getState(); const id = st.selected || st.hovered
    const n = id ? model.byId.get(id) : null; const m = ref.current; if (!m) return
    if (n) { m.visible = true; m.position.set(...n.pos); m.scale.setScalar(Math.max(0.5, n.r * 3.2)); m.rotation.z += 0.03; m.rotation.x = Math.PI / 2.4 }
    else m.visible = false
  })
  return <mesh ref={ref} visible={false}><torusGeometry args={[1, 0.05, 8, 40]} /><meshBasicMaterial color={th.ring} toneMapped={false} transparent opacity={0.9} /></mesh>
}

function DebugExpose() { const s = useThree(); useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __kg?: unknown }).__kg = s }, [s]); return null }
function Heartbeat({ onFrame }: { onFrame?: () => void }) { useFrame(() => onFrame?.()); return null }
function Resizer({ width, height }: { width: number; height: number }) {
  const setSize = useThree((s) => s.setSize), camera = useThree((s) => s.camera)
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
    if (!arrived.current) { camera.position.lerp(dPos.current, 0.06); const c = controls.current; if (c) { c.target.lerp(dTgt.current, 0.06); c.update() } if (camera.position.distanceTo(dPos.current) < 0.4) arrived.current = true }
  })
  return <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={0.08} minDistance={5} maxDistance={60} rotateSpeed={0.55} />
}

export function KnowledgeScene({ model, tissue, width, height, dark, onFrame }: {
  model: KModel; tissue: { positions: Float32Array; region: Uint8Array }; width: number; height: number; dark: boolean; onFrame?: () => void
}) {
  const th = useMemo(() => theme(dark), [dark])
  return (
    <Canvas style={{ width, height }} dpr={[1, 2]} camera={{ position: [0, 16, 14], fov: 50, near: 0.1, far: 400 }}
      gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      onCreated={({ gl }) => gl.setClearColor(th.clear, 1)}>
      <DebugExpose /><Heartbeat onFrame={onFrame} /><Resizer width={width} height={height} />
      <fog attach="fog" args={[th.fog, th.fogNear, th.fogFar]} />
      <ambientLight intensity={0.5} />
      <CorticalTissue tissue={tissue} th={th} />
      <Axons model={model} th={th} />
      <Neurons model={model} th={th} />
      <CommandCore model={model} th={th} />
      <ActiveRing model={model} th={th} />
      <RegionLabels model={model} th={th} />
      <CameraRig model={model} />
      <EffectComposer>
        <Bloom intensity={th.bloomI} luminanceThreshold={th.bloomT} luminanceSmoothing={0.88} mipmapBlur radius={0.75} />
        <Vignette eskil={false} offset={0.2} darkness={th.vignette} />
      </EffectComposer>
    </Canvas>
  )
}

export { REGION_BY_ID }
