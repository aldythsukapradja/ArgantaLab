// WS3 — the Cognitive Cortex. A dense, wrinkled two-hemisphere brain over the
// REAL vault: the cortical TISSUE is the brain body; note-neurons are brighter
// points on it, grouped into the 7 reactor-spine regions; real wikilinks are
// curved axons with firing pulses. When a context is active (a cinematic beat,
// a filter, or a selection) that region lights and everything else greys out —
// so the audience sees which part of the brain is engaged. The camera never
// zooms out: it sways gently left/right, breathes a little, and leans toward
// whatever is active. Follows the app light/dark theme.

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { KModel } from './model'
import { REGIONS, REGION_BY_ID, REGION_INDEX, regionCentroid, type RegionId, type Triad } from './brain'
import { useKnowledge } from './store'
import { activationFor, activeRegionSet } from './activation'

const PROV = { live: 1, partial: 0.72, simulated: 0.5, placeholder: 0.34 } as Record<string, number>
const RCOL: Record<RegionId, THREE.Color> = REGIONS.reduce((m, r) => { m[r.id] = new THREE.Color(r.color); return m }, {} as Record<RegionId, THREE.Color>)
const TRIAD_REGIONS: Record<Triad, Set<RegionId>> = { think: new Set(), know: new Set(), do: new Set() }
REGIONS.forEach((r) => TRIAD_REGIONS[r.triad].add(r.id))

interface Theme {
  clear: string; fog: string; fogNear: number; fogFar: number
  tissueScale: number; tissueOpacity: number; blend: THREE.Blending
  axon: string; axonOpacity: number; pulseOpacity: number
  bloomI: number; bloomT: number; vignette: number
  base: number; provW: number; spike: number
  labelText: string; labelBg: string; commandColor: string; commandCore: string; ring: string
  grey: string; greyDim: number
}
function theme(dark: boolean): Theme {
  return dark ? {
    clear: '#04050d', fog: '#04050d', fogNear: 34, fogFar: 90,
    tissueScale: 0.74, tissueOpacity: 0.7, blend: THREE.AdditiveBlending,
    axon: '#2b3a6b', axonOpacity: 0.14, pulseOpacity: 0.95,
    bloomI: 0.9, bloomT: 0.22, vignette: 0.9,
    base: 0.55, provW: 0.42, spike: 1.5,
    labelText: '#fff', labelBg: 'rgba(6,9,20,.6)', commandColor: '#70e7ff', commandCore: '#d6f7ff', ring: '#eef2ff',
    grey: '#525c7c', greyDim: 0.85,
  } : {
    clear: '#eaeef7', fog: '#eaeef7', fogNear: 34, fogFar: 92,
    tissueScale: 0.92, tissueOpacity: 0.6, blend: THREE.NormalBlending,
    axon: '#9aa6cc', axonOpacity: 0.4, pulseOpacity: 0.92,
    bloomI: 0.3, bloomT: 0.55, vignette: 0.32,
    base: 0.86, provW: 0.2, spike: 0.55,
    labelText: '#0b1020', labelBg: 'rgba(255,255,255,.82)', commandColor: '#0891b2', commandCore: '#0e7490', ring: '#1e293b',
    grey: '#b7c0d4', greyDim: 0.9,
  }
}

// ── shared "what's active" — computed once per frame, read by tissue+neurons+camera ──
const ACTIVE: { regions: Set<RegionId> | null; hemi: 'left' | 'right' | null; key: string } = { regions: null, hemi: null, key: '' }
function ActiveController({ model }: { model: KModel }) {
  useFrame(() => {
    const st = useKnowledge.getState()
    let regions: Set<RegionId> | null = null
    let hemi: 'left' | 'right' | null = null
    const hf = st.hemiFilter === 'left' || st.hemiFilter === 'right' ? st.hemiFilter : null
    if (st.scene) regions = activeRegionSet(st.scene)
    else if (st.regionFilter) { regions = new Set([st.regionFilter]); hemi = hf }
    else if (st.triadFilter) { regions = TRIAD_REGIONS[st.triadFilter]; hemi = hf }
    else if (hf) hemi = hf
    else { const sel = st.selected || st.hovered; if (sel) { const n = model.byId.get(sel); if (n) regions = new Set([n.region]) } }
    ACTIVE.regions = regions; ACTIVE.hemi = hemi
    ACTIVE.key = (regions ? [...regions].sort().join(',') : '*') + '|' + (hemi || '*')
  })
  return null
}

// ─────────────── cortical tissue (the brain body) ───────────────
function CorticalTissue({ tissue, th }: { tissue: { positions: Float32Array; region: Uint8Array; fade: Float32Array }; th: Theme }) {
  const ref = useRef<THREE.Points>(null)
  const grey = useMemo(() => new THREE.Color(th.grey), [th.grey])
  const N = tissue.region.length
  const hemi = useMemo(() => {
    const a = new Uint8Array(N)
    for (let i = 0; i < N; i++) a[i] = tissue.positions[i * 3] < 0 ? 0 : 1 // 0 left, 1 right
    return a
  }, [tissue, N])
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(tissue.positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    return g
  }, [tissue, N])
  const lastKey = useRef('')
  const tmp = useMemo(() => new THREE.Color(), [])
  useFrame((s) => {
    if (ref.current) ref.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.02) * 0.008
    if (ACTIVE.key === lastKey.current) return
    lastKey.current = ACTIVE.key
    const colors = (geo.getAttribute('color') as THREE.BufferAttribute).array as Float32Array
    for (let i = 0; i < N; i++) {
      const rid = REGION_INDEX[tissue.region[i]]
      const inR = !ACTIVE.regions || ACTIVE.regions.has(rid)
      const inH = ACTIVE.hemi == null || (hemi[i] === 0 ? 'left' : 'right') === ACTIVE.hemi
      const f = tissue.fade[i]
      if (inR && inH) { tmp.copy(RCOL[rid]).multiplyScalar(th.tissueScale * f) }
      else { tmp.copy(grey).multiplyScalar(th.greyDim * 0.5 * f) }
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b
    }
    ;(geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true
  })
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={0.05} sizeAttenuation vertexColors transparent opacity={th.tissueOpacity} depthWrite={false} blending={th.blend} toneMapped={false} />
    </points>
  )
}

// ─────────────── curved axons + firing pulses ───────────────
const bez = (a: number, c: number, b: number, t: number) => { const it = 1 - t; return it * it * a + 2 * it * t * c + t * t * b }
function control(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3 {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, mz = (a.z + b.z) / 2
  const len = a.distanceTo(b); const out = Math.hypot(mx, mz) || 1
  return new THREE.Vector3(mx + (mx / out) * len * 0.12, my + len * 0.3 + 0.6, mz + (mz / out) * len * 0.12)
}
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

// ─────────────── neurons (instanced) + firing + grey-out ───────────────
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
  const grey = useMemo(() => new THREE.Color(th.grey), [th.grey])
  useFrame((state) => {
    const mesh = ref.current; if (!mesh || !mesh.instanceColor) return
    const st = useKnowledge.getState(); const t = state.clock.elapsedTime
    const act = activationFor(st.scene)
    for (let i = 0; i < N; i++) {
      const d = data[i]
      const inR = !ACTIVE.regions || ACTIVE.regions.has(d.region)
      const inH = ACTIVE.hemi == null || d.hemisphere === ACTIVE.hemi
      const inP = !st.provFilter || d.provName === st.provFilter
      if (!(inR && inH && inP)) { tmp.copy(grey).multiplyScalar(th.greyDim * 0.9); mesh.setColorAt(i, tmp); continue }
      let b = th.base + d.prov * th.provW
      if (act) {
        const w = act[d.region] ?? 0.08
        b += w * th.spike
        if (st.simRunning) b += Math.pow(Math.max(0, Math.sin(t * d.rate + d.phase)), 16) * th.spike * 0.4 * (0.4 + w)
      } else if (st.simRunning) {
        b += Math.pow(Math.max(0, Math.sin(t * d.rate + d.phase)), 16) * th.spike
      }
      if (st.selected === d.id) b += 1.6; else if (st.hovered === d.id) b += 0.9
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
        const p = hero ? [hero.pos[0], hero.pos[1] + 0.9, hero.pos[2]] : r.anchor
        return (
          <Html key={r.id} center position={p as [number, number, number]} distanceFactor={19} style={{ pointerEvents: 'none' }} zIndexRange={[16, 0]}>
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
    if (n) { m.visible = true; m.position.set(...n.pos); m.scale.setScalar(Math.max(0.5, n.r * 3.4)); m.rotation.z += 0.03; m.rotation.x = Math.PI / 2.4 }
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

// Manual orbit + zoom is the founder's own navigation (drag to orbit, wheel/
// pinch to zoom, right-drag to pan). The gentle sway/breathe/lean is an IDLE
// ambient behaviour only: it pauses the instant the founder touches the
// controls and waits a grace period after release before easing back in —
// never fights the user's own framing.
const BASE_RADIUS = 20.5
function CameraRig({ autoEnabled }: { autoEnabled: boolean }) {
  const controlsRef = useRef<any>(null)
  const { camera } = useThree()
  const target = useRef(new THREE.Vector3(0, 0.4, 0.5))
  const tTgt = useMemo(() => new THREE.Vector3(), [])
  const tPos = useMemo(() => new THREE.Vector3(), [])
  const userActive = useRef(false)
  const idleSince = useRef(0)

  useEffect(() => {
    const c = controlsRef.current; if (!c) return
    const onStart = () => { userActive.current = true }
    const onEnd = () => { userActive.current = false; idleSince.current = performance.now() }
    c.addEventListener('start', onStart)
    c.addEventListener('end', onEnd)
    return () => { c.removeEventListener('start', onStart); c.removeEventListener('end', onEnd) }
  }, [])

  useFrame((state) => {
    const c = controlsRef.current
    const idleLongEnough = performance.now() - idleSince.current > 1400
    if (autoEnabled && c && !userActive.current && idleLongEnough) {
      const t = state.clock.elapsedTime
      const regions = ACTIVE.regions
      let cy = 0.4, cz = 0.5
      if (regions && regions.size >= 1 && regions.size <= 3) {
        let y = 0, z = 0; regions.forEach((r) => { const rc = regionCentroid(r); y += rc[1]; z += rc[2] })
        cy = (y / regions.size) * 0.4 + 0.3; cz = (z / regions.size) * 0.5
      }
      target.current.lerp(tTgt.set(0, cy, cz), 0.015)
      const zoomIn = regions && regions.size <= 3 ? 2 : 0          // lean IN on a focused context
      const breathe = Math.abs(Math.sin(t * 0.1)) * 1.2            // inward-only breathing
      const radius = BASE_RADIUS - zoomIn - breathe
      const az = Math.sin(t * 0.06) * 0.3                          // gentle left/right sway
      const pol = 0.56 + Math.sin(t * 0.05) * 0.04                 // top-down-ish (reads as a brain)
      tPos.set(
        target.current.x + radius * Math.sin(pol) * Math.sin(az),
        target.current.y + radius * Math.cos(pol),
        target.current.z + radius * Math.sin(pol) * Math.cos(az),
      )
      camera.position.lerp(tPos, 0.02)
      c.target.lerp(target.current, 0.02)
    }
    if (c) c.update()
  })
  return (
    <OrbitControls ref={controlsRef} enablePan enableZoom enableRotate
      enableDamping dampingFactor={0.08} minDistance={5} maxDistance={46} rotateSpeed={0.55} zoomSpeed={0.85} panSpeed={0.7} />
  )
}

export function KnowledgeScene({ model, tissue, width, height, dark, autoCamera = true, onFrame }: {
  model: KModel; tissue: { positions: Float32Array; region: Uint8Array; fade: Float32Array }; width: number; height: number; dark: boolean; autoCamera?: boolean; onFrame?: () => void
}) {
  const th = useMemo(() => theme(dark), [dark])
  return (
    <Canvas style={{ width, height }} dpr={[1, 2]} camera={{ position: [0, 17, 18], fov: 50, near: 0.1, far: 400 }}
      gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      onCreated={({ gl }) => gl.setClearColor(th.clear, 1)}>
      <DebugExpose /><Heartbeat onFrame={onFrame} /><Resizer width={width} height={height} /><ActiveController model={model} />
      <fog attach="fog" args={[th.fog, th.fogNear, th.fogFar]} />
      <ambientLight intensity={0.5} />
      <CorticalTissue tissue={tissue} th={th} />
      <Axons model={model} th={th} />
      <Neurons model={model} th={th} />
      <CommandCore model={model} th={th} />
      <ActiveRing model={model} th={th} />
      <RegionLabels model={model} th={th} />
      <CameraRig autoEnabled={autoCamera} />
      <EffectComposer>
        <Bloom intensity={th.bloomI} luminanceThreshold={th.bloomT} luminanceSmoothing={0.88} mipmapBlur radius={0.75} />
        <Vignette eskil={false} offset={0.2} darkness={th.vignette} />
      </EffectComposer>
    </Canvas>
  )
}

export { REGION_BY_ID }
