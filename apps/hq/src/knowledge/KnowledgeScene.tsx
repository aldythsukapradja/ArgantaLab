// WS3 — the 3D scene. R3F + drei + bloom. Provenance is encoded in the material
// (live = luminous, partial = translucent, simulated = amber wireframe,
// placeholder = hollow); confirmed edges are solid, suggested edges dotted; the
// hero spine carries flowing energy pulses. Bloom does the "wow" glow off the
// emissive nodes. Camera eases to a focus node (manual click or auto tour) and
// returns deterministically to the overview.

import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Html, Line } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { KModel, KNode } from './model'
import { ONTOLOGY_COLOR } from './ontology'
import { PROVENANCE_META, type Provenance } from './provenance'
import { useKnowledge } from './store'

const AMBER = '#f59e0b'
const HOLLOW = '#64748b'

// colour a node paints with (ontology hue, but simulated/placeholder override)
function nodeColor(n: KNode): string {
  if (n.provenance === 'simulated') return AMBER
  if (n.provenance === 'placeholder') return HOLLOW
  return ONTOLOGY_COLOR[n.ontology]
}

// shared geometries (created once)
function useGeoms() {
  return useMemo(() => ({
    sphere: new THREE.SphereGeometry(1, 32, 32),
    lowSphere: new THREE.SphereGeometry(1, 16, 16),
    ico: new THREE.IcosahedronGeometry(1, 1),
    ring: new THREE.TorusGeometry(1.5, 0.045, 12, 48),
  }), [])
}

// ---------------- single node ----------------
function NodeMesh({ node, geoms }: { node: KNode; geoms: ReturnType<typeof useGeoms> }) {
  const grp = useRef<THREE.Group>(null)
  const core = useRef<THREE.Mesh>(null)
  const halo = useRef<THREE.Mesh>(null)
  const setHovered = useKnowledge((s) => s.setHovered)
  const setSelected = useKnowledge((s) => s.setSelected)
  const setFocus = useKnowledge((s) => s.setFocus)

  // selective subscriptions — only THIS node re-renders when its state flips
  const isHover = useKnowledge((s) => s.hovered === node.id)
  const isSel = useKnowledge((s) => s.selected === node.id)
  const dim = useKnowledge((s) => {
    if (s.provFilter && node.provenance !== s.provFilter) return true
    if (s.typeFilter && node.ontology !== s.typeFilter) return true
    if (s.spotlight && !s.spotlight.has(node.id)) return true
    return false
  })

  const color = useMemo(() => new THREE.Color(nodeColor(node)), [node])
  const prov = node.provenance
  const baseR = node.r
  const phase = useMemo(() => Math.random() * Math.PI * 2, [])

  useFrame((state) => {
    const g = grp.current; if (!g) return
    const t = state.clock.elapsedTime
    // gentle bob
    g.position.set(node.pos[0], node.pos[1] + Math.sin(t * 0.6 + phase) * 0.12, node.pos[2])
    // scale ease toward hover/select target
    const target = (isSel ? 1.55 : isHover ? 1.32 : 1) * (dim ? 0.86 : 1)
    const s = THREE.MathUtils.lerp(g.scale.x, target, 0.15)
    g.scale.setScalar(s)
    // opacity ease (dimming)
    const cm = core.current?.material as THREE.Material & { opacity: number; emissiveIntensity?: number }
    if (cm) {
      const wantOpacity = dim ? 0.18 : prov === 'partial' ? 0.62 : prov === 'placeholder' ? 0.4 : 1
      cm.opacity = THREE.MathUtils.lerp(cm.opacity, wantOpacity, 0.15)
      if (cm.emissiveIntensity != null) {
        const glow = (prov === 'live' ? 1.5 : prov === 'partial' ? 0.7 : 0) * (isHover || isSel ? 1.7 : 1) * (dim ? 0.3 : 1)
        cm.emissiveIntensity = THREE.MathUtils.lerp(cm.emissiveIntensity, glow, 0.12)
      }
    }
    if (halo.current) {
      halo.current.rotation.z += 0.004
      halo.current.rotation.x = Math.sin(t * 0.3 + phase) * 0.3
    }
  })

  const onOver = (e: any) => { e.stopPropagation(); setHovered(node.id); document.body.style.cursor = 'pointer' }
  const onOut = () => { setHovered(null); document.body.style.cursor = 'auto' }
  const onDown = (e: any) => { e.stopPropagation(); setSelected(node.id); setFocus(node.id) }

  return (
    <group ref={grp} position={node.pos}>
      <mesh
        ref={core}
        geometry={prov === 'simulated' ? geoms.ico : node.spine ? geoms.sphere : geoms.lowSphere}
        scale={baseR}
        onPointerOver={onOver}
        onPointerOut={onOut}
        onPointerDown={onDown}
      >
        {prov === 'live' && (
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} roughness={0.28} metalness={0.15} transparent opacity={1} toneMapped={false} />
        )}
        {prov === 'partial' && (
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} roughness={0.4} metalness={0.1} transparent opacity={0.62} toneMapped={false} />
        )}
        {prov === 'simulated' && (
          <meshBasicMaterial color={color} wireframe transparent opacity={0.9} toneMapped={false} />
        )}
        {prov === 'placeholder' && (
          <meshBasicMaterial color={color} wireframe transparent opacity={0.4} />
        )}
      </mesh>

      {/* spine hero ring halo */}
      {node.spine && (
        <mesh ref={halo} scale={baseR}>
          <primitive object={geoms.ring} attach="geometry" />
          <meshBasicMaterial color={color} transparent opacity={0.55} toneMapped={false} />
        </mesh>
      )}

      {/* labels: spine always, others on hover/select */}
      {(node.spine || isHover || isSel) && (
        <Html center distanceFactor={node.spine ? 22 : 14} position={[0, baseR * (node.spine ? 2.1 : 1.9) + 0.5, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{
            whiteSpace: 'nowrap', fontSize: node.spine ? 13 : 11,
            fontWeight: node.spine ? 700 : 500,
            color: '#eef2ff', letterSpacing: node.spine ? 0.4 : 0.2,
            textShadow: '0 1px 8px rgba(0,0,0,.9), 0 0 14px ' + nodeColor(node) + '88',
            padding: node.spine ? '2px 8px' : '1px 6px',
            borderRadius: 6,
            background: node.spine ? 'rgba(10,12,26,.55)' : 'transparent',
            border: node.spine ? '1px solid ' + nodeColor(node) + '55' : 'none',
            transform: 'translateY(-2px)',
          }}>
            {node.label}
          </div>
        </Html>
      )}
    </group>
  )
}

// ---------------- edges ----------------
function Edges({ model }: { model: KModel }) {
  const { confirmed, suggested } = useMemo(() => {
    const conf: number[] = []
    const sug: number[] = []
    for (const e of model.edges) {
      if (e.spine) continue // hero edges drawn separately
      const a = model.byId.get(e.a), b = model.byId.get(e.b)
      if (!a || !b) continue
      const arr = e.provenance === 'suggested' ? sug : conf
      arr.push(a.pos[0], a.pos[1], a.pos[2], b.pos[0], b.pos[1], b.pos[2])
    }
    return { confirmed: new Float32Array(conf), suggested: new Float32Array(sug) }
  }, [model])

  const dashRef = useRef<THREE.LineSegments>(null)
  const confGeo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(confirmed, 3)); return g }, [confirmed])
  const sugGeo = useMemo(() => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(suggested, 3))
    return g
  }, [suggested])

  return (
    <group>
      <lineSegments geometry={confGeo}>
        <lineBasicMaterial color="#3a4a7a" transparent opacity={0.32} toneMapped={false} />
      </lineSegments>
      <lineSegments ref={dashRef} geometry={sugGeo} onUpdate={(l) => (l as THREE.LineSegments).computeLineDistances()}>
        <lineDashedMaterial color="#8b7cf6" dashSize={0.5} gapSize={0.45} transparent opacity={0.28} toneMapped={false} />
      </lineSegments>
    </group>
  )
}

// ---------------- hero spine (bright path + flowing pulses) ----------------
function HeroSpine({ model }: { model: KModel }) {
  const segs = useMemo(() => {
    const out: { a: THREE.Vector3; b: THREE.Vector3; color: string }[] = []
    for (const e of model.edges) {
      if (!e.spine) continue
      const a = model.byId.get(e.a), b = model.byId.get(e.b)
      if (!a || !b) continue
      out.push({ a: new THREE.Vector3(...a.pos), b: new THREE.Vector3(...b.pos), color: ONTOLOGY_COLOR[b.ontology] })
    }
    return out
  }, [model])

  const pulses = useRef<THREE.Mesh[]>([])
  useFrame((state) => {
    const t = (state.clock.elapsedTime * 0.28) % 1
    segs.forEach((s, i) => {
      const m = pulses.current[i]; if (!m) return
      const tt = (t + i / segs.length) % 1
      m.position.lerpVectors(s.a, s.b, tt)
    })
  })

  return (
    <group>
      {segs.map((s, i) => (
        <group key={i}>
          <Line points={[s.a, s.b]} color={s.color} lineWidth={2.2} transparent opacity={0.7} toneMapped={false} />
          <mesh ref={(el) => { if (el) pulses.current[i] = el }}>
            <sphereGeometry args={[0.13, 12, 12]} />
            <meshBasicMaterial color={s.color} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---------------- camera rig ----------------
function CameraRig({ model }: { model: KModel }) {
  const controls = useRef<any>(null)
  const { camera } = useThree()
  const focus = useKnowledge((s) => s.focus)
  const tourActive = useKnowledge((s) => s.tourActive)
  const arrived = useRef(true)
  const lastFocus = useRef<string | null>(null)

  const desiredPos = useRef(new THREE.Vector3(0, 4, 30))
  const desiredTarget = useRef(new THREE.Vector3(0, 0, 0))

  useFrame(() => {
    const c = controls.current
    // recompute desired frame when focus changes
    if (focus !== lastFocus.current) {
      lastFocus.current = focus
      arrived.current = false
      const node = focus ? model.byId.get(focus) : null
      if (node) {
        const p = new THREE.Vector3(...node.pos)
        desiredTarget.current.copy(p)
        // vantage: pull back along a stable diagonal, closer for small nodes
        const dist = node.spine ? 8.5 : 5.5
        desiredPos.current.set(p.x + dist * 0.5, p.y + dist * 0.42, p.z + dist)
      } else {
        desiredTarget.current.set(0, 0, 0)
        desiredPos.current.set(0, 4, 30)
      }
    }
    // only drive the camera while touring or until we've arrived at a click focus
    if (tourActive || !arrived.current) {
      camera.position.lerp(desiredPos.current, 0.055)
      if (c) {
        c.target.lerp(desiredTarget.current, 0.055)
        c.update()
      }
      if (camera.position.distanceTo(desiredPos.current) < 0.35) arrived.current = true
    }
  })

  return <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={0.08} minDistance={4} maxDistance={70} rotateSpeed={0.6} />
}

// ---------------- scene root ----------------
export function KnowledgeScene({ model }: { model: KModel }) {
  const geoms = useGeoms()
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 4, 30], fov: 52, near: 0.1, far: 400 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => { gl.setClearColor('#05060f', 1) }}
    >
      <fog attach="fog" args={['#05060f', 34, 88]} />
      <ambientLight intensity={0.45} />
      <pointLight position={[0, 12, 18]} intensity={90} distance={120} color="#9db4ff" />
      <pointLight position={[-18, -6, -12]} intensity={40} distance={90} color="#7c5cff" />
      <Stars radius={120} depth={60} count={2600} factor={3.2} saturation={0} fade speed={0.6} />

      <Edges model={model} />
      <HeroSpine model={model} />
      {model.nodes.map((n) => <NodeMesh key={n.id} node={n} geoms={geoms} />)}

      <CameraRig model={model} />
      <EffectComposer>
        <Bloom intensity={0.9} luminanceThreshold={0.35} luminanceSmoothing={0.9} mipmapBlur radius={0.7} />
        <Vignette eskil={false} offset={0.15} darkness={0.85} />
      </EffectComposer>
    </Canvas>
  )
}

// legend colour lookup for chrome
export const provColor = (p: Provenance) => PROVENANCE_META[p].color
