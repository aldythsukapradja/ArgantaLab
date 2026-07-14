import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { OrbitControls } from '@react-three/drei'
import { easing } from 'maath'
import * as THREE from 'three'
import type { ProductId, SceneState } from '../contract'
import { DPR_CAP, allowHeavyPost, type QualityTier } from '../useQualityTier'
import { DEFAULT_LAYERS, type ReactorLayerSpec } from '../model/layers'
import { choreoFor, clusterFlare } from '../model/choreography'
import { layerPosition } from '../model/layout'
import { ReactorLayer } from './ReactorLayer'
import { Sparks } from './Sparks'
import { makeLabelTexture } from './labelTexture'

// ─────────────────────────────────────────────────────────────────────────
// CoreR3F — renders the 7-layer model and drives the axial explosion.
//
// Rest: layers packed near z=0, camera front → flat emblem (ref 3). On the
// story's cue `explosion` rises and each layer fans to its zExploded along
// the axis, camera to three-quarter → arc-reactor read (ref 2). It never
// rotates edge-on; layers only self-spin about the view axis.
//
// Runtime: camera is Director-driven (locked). Builder: `interactive` mounts
// OrbitControls (rotate/pan/zoom) and hands the camera to the founder, and
// `manualExplosion` scrubs the accordion independent of the scenario.
// ─────────────────────────────────────────────────────────────────────────

function Lights({ dark }: { dark: boolean }) {
  return (
    <>
      <hemisphereLight args={[dark ? '#75cfff' : '#ffffff', dark ? '#010204' : '#c7d6e6', dark ? 0.5 : 1.0]} />
      {!dark && <ambientLight intensity={0.5} />}
      <directionalLight color={dark ? '#9ce8ff' : '#ffffff'} intensity={dark ? 3.2 : 2.4} position={[-5, 7, 9]} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight color="#ffaf59" intensity={dark ? 1.7 : 1.0} position={[7, -2, -6]} />
      <pointLight color="#137dff" intensity={2.2} distance={22} position={[-2, 1, 6]} />
    </>
  )
}

function Rig({ sceneRef, manualRef, layers, tier, interactive, dark, selectedLayerId, onSelectProduct, onHoverProduct }: {
  sceneRef: React.MutableRefObject<SceneState>
  manualRef: React.MutableRefObject<number | null>
  layers: ReactorLayerSpec[]
  tier: QualityTier
  interactive: boolean
  dark: boolean
  selectedLayerId: string | null
  onSelectProduct?: (id: ProductId) => void
  onHoverProduct?: (id: ProductId | null) => void
}) {
  const groupRefs = useRef<(THREE.Group | null)[]>([])
  const pulseRefs = useRef<(THREE.Mesh | null)[]>([])
  const spineRef = useRef<THREE.Mesh>(null)
  const hubRefs = useRef<(THREE.Mesh | null)[]>([])
  const labelRefs = useRef<(THREE.Sprite | null)[]>([])
  const sparkRef = useRef(0)
  const expl = useRef(0)

  // HUD labels — one billboard sprite per layer, built once per theme.
  const labelMaterials = useMemo(
    () => layers.map(l => new THREE.SpriteMaterial({
      map: makeLabelTexture(l.label, l.micro, dark), transparent: true, opacity: 0,
      depthWrite: false, depthTest: false, toneMapped: false,
    })),
    [layers, dark],
  )
  useEffect(() => () => labelMaterials.forEach(m => m.dispose()), [labelMaterials])

  useFrame((rs, dt) => {
    const scene = sceneRef.current
    const rm = scene.reducedMotion
    const smooth = rm ? 0.12 : 0.5
    const target = choreoFor(scene.state, scene.choreography)
    const explTarget = manualRef.current != null ? manualRef.current : target.explosion
    expl.current = THREE.MathUtils.damp(expl.current, explTarget, 3.2, dt)

    // Breathe whenever a voice is narrating (speaker set), not only in the two
    // explicit speaking states — the orb "speaks" through the whole story.
    const speaking = scene.speaker !== null
    const t = rs.clock.elapsedTime

    // Spark intensity: a big burst on ignition, a steadier shower during
    // outward-execution beats, off otherwise.
    const sparkTarget = scene.state === 'booting' ? 1
      : scene.state === 'do' || scene.state === 'architecture-unfold' ? 0.5
      : scene.state === 'think' || scene.state === 'know' ? 0.22 : 0
    sparkRef.current = sparkTarget
    layers.forEach((spec, i) => {
      const g = groupRefs.current[i]
      if (!g) return
      const [px, py, pz] = layerPosition(spec, target.layout, expl.current, i, layers.length)
      g.position.set(px, py, pz)
      if (!rm) g.rotation.z += spec.spin * dt * (0.35 + expl.current)
      const flare = clusterFlare(target.flare, spec.cluster)
      const s = 0.94 + flare * 0.1
      if (spec.cluster === 'core') {
        // The core breathes: a gentle idle breath, and while Jarvis speaks it
        // pulses with a speech-like envelope — the "speaking orb". The envelope
        // is clock-driven so it animates regardless of re-render cadence;
        // scene.intensity (the voice level) scales how big the pulses get.
        const idle = rm ? 1 : 1 + 0.03 * Math.sin(t * 2)
        const env = 0.5 * (0.5 + 0.5 * Math.sin(t * 7.1))
          + 0.3 * (0.5 + 0.5 * Math.sin(t * 13.7 + 1.3))
          + 0.2 * (0.5 + 0.5 * Math.sin(t * 3.1 + 0.6))
        const voice = speaking && !rm ? env * (0.5 + 0.5 * scene.intensity) * 0.2 : 0
        g.scale.setScalar(s * (idle + voice))
      } else {
        easing.damp3(g.scale, [s, s, s], smooth, dt)
      }
    })

    // Runtime owns the camera; in Builder OrbitControls has it instead.
    if (!interactive) {
      easing.damp3(rs.camera.position, target.camera, smooth, dt)
      rs.camera.lookAt(0, 0, 0)
      easing.damp(rs.gl, 'toneMappingExposure', target.exposure, smooth, dt)
    }

    // Shared Spine — the axle the layers hang on. It runs along the depth
    // axis (the direction the layers fan) and threads through every one. At
    // rest it collapses to nothing (invisible dot facing the camera); as the
    // reactor opens it extends to skewer all seven, with a hub where it
    // pierces each layer.
    // The spine follows the axial fan; it fades out for the non-axial layouts
    // (triad/orbital/helix scatter the layers off-axis, where an axle reads
    // wrong). It threads the actual layer z-extent for the axial family.
    const axial = target.layout === 'axial' || target.layout === 'iris'
    let zLo = Infinity
    let zHi = -Infinity
    layers.forEach((spec, i) => {
      const z = layerPosition(spec, target.layout, expl.current, i, layers.length)[2]
      if (z < zLo) zLo = z
      if (z > zHi) zHi = z
    })
    const beam = spineRef.current
    if (beam) {
      const len = Math.max(0.001, (zHi - zLo) * 1.12)
      beam.position.z = (zLo + zHi) / 2
      beam.scale.set(1, len, 1) // local Y → world Z after the mesh's rotation
      ;(beam.material as THREE.MeshBasicMaterial).opacity = expl.current * (axial ? 0.3 : 0.05)
    }
    hubRefs.current.forEach((m, i) => {
      const spec = layers[i]
      if (!m || !spec) return
      const p = layerPosition(spec, target.layout, expl.current, i, layers.length)
      m.position.set(axial ? 0 : p[0], axial ? 0 : p[1], p[2])
      m.scale.setScalar(expl.current * (axial ? 0.9 : 0.5))
    })

    // HUD labels ride beside each layer and fade in once expanded.
    labelRefs.current.forEach((sp, i) => {
      const spec = layers[i]
      if (!sp || !spec) return
      const p = layerPosition(spec, target.layout, expl.current, i, layers.length)
      sp.position.set(p[0] + spec.radius * 0.72 + 0.35, p[1] + 0.12, p[2])
      ;(sp.material as THREE.SpriteMaterial).opacity = Math.max(0, expl.current - 0.15) * 0.92
    })

    // Flow pulses travelling the axis — visible only once the reactor fans
    // open. First four move inward (Sense→…→Core), last four outward (Core→…).
    pulseRefs.current.forEach((m, i) => {
      if (!m) return
      const inward = i < 4
      const phase = (t * 0.35 + i * 0.25) % 1
      const z = (inward ? 1 - phase : phase) * 4.2 * expl.current * (inward ? 1 : -1)
      m.position.set(0, ((i % 4) - 1.5) * 0.06, z)
      m.scale.setScalar(rm ? 0 : expl.current * (0.5 + 0.5 * Math.sin(phase * Math.PI)))
    })
  })

  return (
    <group>
      {layers.map((spec, i) => (
        <group key={spec.id} ref={el => { groupRefs.current[i] = el }} position={[0, 0, spec.zRest]}>
          <ReactorLayer spec={spec} tier={tier} selected={spec.id === selectedLayerId}
            onSelectProduct={onSelectProduct} onHoverProduct={onHoverProduct} />
        </group>
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={`pulse-${i}`} ref={el => { pulseRefs.current[i] = el }} scale={0}>
          <sphereGeometry args={[0.05, 10, 10]} />
          <meshBasicMaterial color={i < 4 ? '#4be5bd' : '#ffc46b'} transparent opacity={0.9}
            blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      <Sparks intensityRef={sparkRef} reducedMotion={sceneRef.current.reducedMotion} />
      {/* Shared Spine axle — rotated so its height runs along the depth axis. */}
      <mesh ref={spineRef} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.001, 1]}>
        <cylinderGeometry args={[0.02, 0.02, 1, 8]} />
        <meshBasicMaterial color="#7fe8ff" transparent opacity={0}
          blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {layers.map((spec, i) => (
        <mesh key={`hub-${spec.id}`} ref={el => { hubRefs.current[i] = el }} scale={0}>
          <sphereGeometry args={[0.055, 12, 12]} />
          <meshBasicMaterial color="#4be5bd" transparent opacity={0.7}
            blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      {layers.map((spec, i) => (
        <sprite key={`label-${spec.id}`} ref={el => { labelRefs.current[i] = el }}
          material={labelMaterials[i]} scale={[1.5, 0.47, 1]} />
      ))}
    </group>
  )
}

export function CoreR3F({
  scene, tier, layers = DEFAULT_LAYERS, manualExplosion = null, interactive = false,
  selectedLayerId = null, dark = true, onSelectProduct, onHoverProduct,
}: {
  scene: SceneState
  tier: QualityTier
  layers?: ReactorLayerSpec[]
  manualExplosion?: number | null
  interactive?: boolean
  selectedLayerId?: string | null
  dark?: boolean
  onSelectProduct?: (id: ProductId) => void
  onHoverProduct?: (id: ProductId | null) => void
}) {
  const heavy = allowHeavyPost(tier)
  // Flat field, theme-matched to the surface behind it. No fog, no vignette,
  // and a tight bloom (below) so nothing bleeds a "teardrop" halo onto the bg.
  const bgColor = dark ? 0x05090f : 0xeef3f9
  const wrap = useRef<HTMLDivElement>(null)
  const sceneRef = useRef(scene)
  sceneRef.current = scene
  const manualRef = useRef(manualExplosion)
  manualRef.current = manualExplosion
  const noPost = typeof location !== 'undefined' && new URLSearchParams(location.search).has('nopost')

  // Embedded browser panes can miss R3F's initial ResizeObserver callback,
  // leaving the drawing buffer at the 300×150 default; nudge until real size.
  useEffect(() => {
    let tries = 0
    let timer = 0
    const tick = () => {
      const canvas = wrap.current?.querySelector('canvas')
      const parent = wrap.current
      if (canvas && parent && canvas.clientWidth <= 300) window.dispatchEvent(new Event('resize'))
      if (++tries < 20) timer = window.setTimeout(tick, 80)
    }
    tick()
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div ref={wrap} style={{ width: '100%', height: '100%' }}>
      <Canvas
        shadows
        resize={{ offsetSize: true }}
        camera={{ position: [0, 0, 18], fov: 30, near: 0.1, far: 120 }}
        dpr={DPR_CAP[tier]}
        // preserveDrawingBuffer enables the deterministic capture / video path.
        gl={{ antialias: tier !== 'mobile', alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        onCreated={({ gl, scene: s }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.15
          gl.setClearColor(bgColor, noPost ? 1 : 0)
          s.fog = null
        }}
        style={{ width: '100%', height: '100%', display: 'block' }}>
        <Lights dark={dark} />
        <Rig sceneRef={sceneRef} manualRef={manualRef} layers={layers} tier={tier}
          interactive={interactive} dark={dark} selectedLayerId={selectedLayerId}
          onSelectProduct={onSelectProduct} onHoverProduct={onHoverProduct} />
        {interactive && (
          // Every layer is a flat ring facing +Z; swinging the camera a full
          // 90° in either azimuth (to the X axis) or polar (to the Y axis)
          // views them edge-on and collapses them into thin slivers. Clamp
          // both to a generous but bounded range — still a real orbit, never
          // the degenerate profile view.
          <OrbitControls makeDefault enablePan enableDamping dampingFactor={0.08} target={[0, 0, 0]}
            minDistance={6} maxDistance={44}
            minPolarAngle={Math.PI * 0.24} maxPolarAngle={Math.PI * 0.76}
            minAzimuthAngle={-Math.PI * 0.32} maxAzimuthAngle={Math.PI * 0.32} />
        )}
        {!noPost && (
          <EffectComposer multisampling={heavy ? 4 : 0}>
            <Bloom mipmapBlur luminanceThreshold={dark ? 0.5 : 0.62} luminanceSmoothing={0.3} intensity={heavy ? (dark ? 0.9 : 0.6) : 0.5} radius={0.38} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  )
}
