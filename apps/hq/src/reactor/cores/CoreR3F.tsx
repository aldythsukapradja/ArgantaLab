import { useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { OrbitControls } from '@react-three/drei'
import { easing } from 'maath'
import * as THREE from 'three'
import type { ProductId, SceneState } from '../contract'
import { DPR_CAP, allowHeavyPost, type QualityTier } from '../useQualityTier'
import { DEFAULT_LAYERS, type ReactorLayerSpec } from '../model/layers'
import { choreoFor, clusterFlare } from '../model/choreography'
import { ReactorLayer } from './ReactorLayer'

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

function Rig({ sceneRef, manualRef, layers, tier, interactive, selectedLayerId, onSelectProduct, onHoverProduct }: {
  sceneRef: React.MutableRefObject<SceneState>
  manualRef: React.MutableRefObject<number | null>
  layers: ReactorLayerSpec[]
  tier: QualityTier
  interactive: boolean
  selectedLayerId: string | null
  onSelectProduct?: (id: ProductId) => void
  onHoverProduct?: (id: ProductId | null) => void
}) {
  const groupRefs = useRef<(THREE.Group | null)[]>([])
  const expl = useRef(0)

  useFrame((rs, dt) => {
    const scene = sceneRef.current
    const rm = scene.reducedMotion
    const smooth = rm ? 0.12 : 0.5
    const target = choreoFor(scene.state)
    const explTarget = manualRef.current != null ? manualRef.current : target.explosion
    expl.current = THREE.MathUtils.damp(expl.current, explTarget, 3.2, dt)

    const speaking = scene.state === 'jarvis-speaking' || scene.state === 'specialist-speaking'
    const t = rs.clock.elapsedTime
    layers.forEach((spec, i) => {
      const g = groupRefs.current[i]
      if (!g) return
      g.position.z = THREE.MathUtils.lerp(spec.zRest, spec.zExploded, expl.current)
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
  })

  return (
    <group>
      {layers.map((spec, i) => (
        <group key={spec.id} ref={el => { groupRefs.current[i] = el }} position={[0, 0, spec.zRest]}>
          <ReactorLayer spec={spec} tier={tier} selected={spec.id === selectedLayerId}
            onSelectProduct={onSelectProduct} onHoverProduct={onHoverProduct} />
        </group>
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
  // Scene background follows the HQ theme. Light mode drops the dark vignette
  // teardrop entirely; dark keeps a soft one.
  const bgColor = dark ? 0x02060a : 0xeef4fb
  const fogColor = dark ? 0x02060a : 0xeef4fb
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
          s.fog = new THREE.FogExp2(fogColor, dark ? 0.016 : 0.01)
        }}
        style={{ width: '100%', height: '100%', display: 'block' }}>
        <Lights dark={dark} />
        <Rig sceneRef={sceneRef} manualRef={manualRef} layers={layers} tier={tier}
          interactive={interactive} selectedLayerId={selectedLayerId}
          onSelectProduct={onSelectProduct} onHoverProduct={onHoverProduct} />
        {interactive && <OrbitControls makeDefault enablePan enableDamping dampingFactor={0.08} target={[0, 0, 0]} minDistance={6} maxDistance={44} />}
        {!noPost && (
          <EffectComposer multisampling={heavy ? 4 : 0}>
            <Bloom mipmapBlur luminanceThreshold={dark ? 0.32 : 0.55} luminanceSmoothing={0.4} intensity={heavy ? (dark ? 1.15 : 0.7) : 0.6} radius={0.7} />
            <Vignette eskil={false} offset={0.4} darkness={dark ? 0.5 : 0.18} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  )
}
