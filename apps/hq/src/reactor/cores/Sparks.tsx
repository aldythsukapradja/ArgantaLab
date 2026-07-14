import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ─────────────────────────────────────────────────────────────────────────
// Sparks (O1) — GPU point burst radiating from the core. Intensity is read
// from a ref each frame (driven by the Rig from the scene state): a strong
// burst on ignition, a steadier shower during DO / architecture. Fully
// self-contained shader — no runtime particle-engine dependency, so it can't
// stall the scene. Emits nothing when intensity is 0.
// ─────────────────────────────────────────────────────────────────────────

const VERT = `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uPixelRatio;
  attribute vec3 aDir;
  attribute float aSeed;
  attribute float aSpeed;
  varying float vAlpha;
  void main() {
    float life = fract(uTime * aSpeed + aSeed);
    vec3 p = aDir * (0.42 + life * 3.1);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.0 - life) * 5.5 * uPixelRatio * uIntensity;
    vAlpha = (1.0 - life) * uIntensity;
  }
`
const FRAG = `
  precision highp float;
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    gl_FragColor = vec4(uColor * 1.7, smoothstep(0.5, 0.0, d) * vAlpha);
  }
`

export function Sparks({ intensityRef, color = '#8fe9ff', count = 260, reducedMotion = false }: {
  intensityRef: React.MutableRefObject<number>
  color?: string
  count?: number
  reducedMotion?: boolean
}) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const smoothed = useRef(0)

  const geometry = useMemo(() => {
    const dir = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    const speed = new Float32Array(count)
    const pos = new Float32Array(count * 3) // unused positions, required attribute
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const b = Math.acos(2 * Math.random() - 1)
      dir[i * 3] = Math.sin(b) * Math.cos(a)
      dir[i * 3 + 1] = Math.cos(b) * 0.7
      dir[i * 3 + 2] = Math.sin(b) * Math.sin(a)
      seed[i] = Math.random()
      speed[i] = 0.25 + Math.random() * 0.55
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    g.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1))
    g.computeBoundingSphere()
    return g
  }, [count])

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uIntensity: { value: 0 },
    uPixelRatio: { value: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 1.5) },
    uColor: { value: new THREE.Color(color) },
  }), [color])

  useFrame((state, dt) => {
    if (!material.current) return
    const target = reducedMotion ? 0 : intensityRef.current
    smoothed.current += (target - smoothed.current) * Math.min(1, dt * 4)
    material.current.uniforms.uTime.value = state.clock.elapsedTime
    material.current.uniforms.uIntensity.value = smoothed.current
  })

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial ref={material} vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms}
        transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  )
}
