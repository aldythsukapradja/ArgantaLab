import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { KB_NOTES } from '../../vault/kb.generated'
import { pointBudget, type QualityTier } from '../useQualityTier'

// ─────────────────────────────────────────────────────────────────────────
// KnowledgeField (O2) — the KNOW layer's real memory field.
//
// Every particle is derived from the generated Vault: note roots, headings,
// wiki-links and content blocks (harvested from the original ReactorOrb). It
// communicates structure only — never invents business activity. Replaces the
// random point shell so KNOW reads as genuine provenance, not decoration.
// ─────────────────────────────────────────────────────────────────────────

type KnowledgeAtom = { key: string; family: number }

function hash(input: string) {
  let value = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

const KNOWLEDGE_ATOMS: KnowledgeAtom[] = (() => {
  const atoms: KnowledgeAtom[] = []
  KB_NOTES.forEach((note, family) => {
    atoms.push({ key: note.id, family })
    const headings = note.md.match(/^#{1,6}\s+.+$/gm) ?? []
    headings.forEach((heading, index) => atoms.push({ key: `${note.id}:h:${index}:${heading}`, family }))
    const links = Array.from(note.md.matchAll(/\[\[([^\]|#]+)/g)).map(match => match[1].trim())
    Array.from(new Set(links)).forEach((link, index) => atoms.push({ key: `${note.id}:l:${index}:${link}`, family }))
    const blocks = Math.min(10, Math.max(1, Math.floor(note.md.length / 640)))
    for (let index = 0; index < blocks; index += 1) atoms.push({ key: `${note.id}:b:${index}`, family })
  })
  return atoms.slice(0, 2800)
})()

function makePointGeometry(limit: number) {
  const atoms = KNOWLEDGE_ATOMS.slice(0, limit)
  const positions = new Float32Array(atoms.length * 3)
  const sizes = new Float32Array(atoms.length)
  const phases = new Float32Array(atoms.length)
  const drifts = new Float32Array(atoms.length)
  const tones = new Float32Array(atoms.length)
  atoms.forEach((atom, index) => {
    const seed = hash(atom.key)
    const u = ((seed & 0xffff) + 0.5) / 65536
    const v = (((seed >>> 16) & 0xffff) + 0.5) / 65536
    const theta = Math.PI * 2 * u
    const phi = Math.acos(1 - 2 * v)
    const shell = index % 17 === 0 ? 1.55 : index % 7 === 0 ? 1.36 : 0.52 + ((seed >>> 8) % 1530) / 1700
    const flatten = 0.82 + ((seed >>> 24) % 15) / 100
    positions[index * 3] = Math.sin(phi) * Math.cos(theta) * shell
    positions[index * 3 + 1] = Math.cos(phi) * shell * flatten
    positions[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * shell * 0.7
    sizes[index] = index % 41 === 0 ? 5.4 : index % 13 === 0 ? 3.3 : 1.25 + (seed % 120) / 110
    phases[index] = u * Math.PI * 2
    drifts[index] = 0.28 + v * 0.72
    tones[index] = (atom.family % 7) / 6
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
  geometry.setAttribute('aDrift', new THREE.BufferAttribute(drifts, 1))
  geometry.setAttribute('aTone', new THREE.BufferAttribute(tones, 1))
  geometry.computeBoundingSphere()
  return geometry
}

const POINT_VERTEX = `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSize;
  attribute float aPhase;
  attribute float aDrift;
  attribute float aTone;
  varying float vTone;
  varying float vPulse;
  void main() {
    vec3 p = position;
    float angle = uTime * (0.011 + aDrift * 0.016) + aPhase * 0.014;
    float c = cos(angle), s = sin(angle);
    p.xz = mat2(c, -s, s, c) * p.xz;
    p += normalize(p) * sin(uTime * 0.28 + aPhase * 5.0) * (0.009 + aDrift * 0.012);
    p.y += sin(uTime * 0.09 + aPhase) * 0.018;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * clamp(7.0 / -mv.z, 0.62, 2.1);
    vTone = aTone;
    vPulse = 0.62 + 0.38 * sin(uTime * 0.58 + aPhase * 11.0);
  }
`
const POINT_FRAGMENT = `
  precision highp float;
  uniform vec3 uCyan;
  uniform vec3 uBlue;
  uniform vec3 uViolet;
  varying float vTone;
  varying float vPulse;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float core = smoothstep(0.24, 0.0, d);
    float halo = smoothstep(0.5, 0.06, d);
    vec3 color = vTone < 0.52 ? mix(uCyan, uBlue, vTone * 1.92) : mix(uBlue, uViolet, (vTone - 0.52) * 2.08);
    gl_FragColor = vec4(color * (0.72 + core * 1.9), halo * (0.38 + vPulse * 0.52));
  }
`

export function KnowledgeField({ radius, color, tier, reducedMotion = false }: {
  radius: number
  color: string
  tier: QualityTier
  reducedMotion?: boolean
}) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const geometry = useMemo(() => makePointGeometry(pointBudget(tier)), [tier])
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPixelRatio: { value: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 1.5) },
    uCyan: { value: new THREE.Color('#45e8ff') },
    uBlue: { value: new THREE.Color('#6aa0ff') },
    uViolet: { value: new THREE.Color(color) },
  }), [color])

  useFrame(state => {
    if (material.current) material.current.uniforms.uTime.value = reducedMotion ? 0 : state.clock.elapsedTime
  })

  useEffect(() => () => geometry.dispose(), [geometry])

  const scale = radius / 1.55
  return (
    <points geometry={geometry} scale={scale}>
      <shaderMaterial ref={material} vertexShader={POINT_VERTEX} fragmentShader={POINT_FRAGMENT} uniforms={uniforms}
        transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  )
}
