import { useMemo } from 'react'
import { type ThreeEvent } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import type { ReactorLayerSpec } from '../model/layers'
import type { ProductId } from '../contract'
import type { QualityTier } from '../useQualityTier'
import { PRODUCT_ORBIT_META } from '../../surfaces/reactorModel'
import { getProductIconTexture } from './productIcons'

// ─────────────────────────────────────────────────────────────────────────
// ReactorLayer — draws one layer spec. Pure presentation: the parent Rig owns
// the transform (z-explosion, spin, cluster flare); this only builds geometry
// for the spec's `kind` + `material`. That split is what makes every layer
// independently editable and 1:1-replaceable by a GLB later.
// ─────────────────────────────────────────────────────────────────────────

function LayerMaterial({ spec, selected }: { spec: ReactorLayerSpec; selected: boolean }) {
  const emphasis = selected ? 1.4 : 1
  switch (spec.material) {
    case 'metal':
      return <meshStandardMaterial color={spec.color} roughness={0.28} metalness={0.9}
        emissive={spec.color} emissiveIntensity={selected ? 0.5 : 0.08} wireframe={spec.wireframe} />
    case 'glass':
      return <meshPhysicalMaterial color={spec.color} emissive={spec.color}
        emissiveIntensity={2.6 * emphasis} roughness={0.1} metalness={0.05} transmission={0.25}
        thickness={0.5} transparent opacity={0.9} toneMapped={false} wireframe={spec.wireframe} />
    case 'wire':
      return <meshBasicMaterial color={spec.color} wireframe transparent opacity={0.5 * emphasis}
        blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    default: // glow
      return <meshBasicMaterial color={spec.color} transparent opacity={0.85 * emphasis}
        blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} wireframe={spec.wireframe} />
  }
}

/** Vault memory shell — a sphere of glowing points. */
function ParticleShell({ spec, tier }: { spec: ReactorLayerSpec; tier: QualityTier }) {
  const geo = useMemo(() => {
    const count = tier === 'high' ? 1400 : tier === 'medium' ? 800 : 320
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = spec.radius * (0.85 + Math.random() * 0.3)
      const a = Math.random() * Math.PI * 2
      const b = Math.acos(2 * Math.random() - 1)
      pos[i * 3] = r * Math.sin(b) * Math.cos(a)
      pos[i * 3 + 1] = r * Math.sin(b) * Math.sin(a) * 0.7
      pos[i * 3 + 2] = r * Math.cos(b) * 0.5
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [spec.radius, tier])
  return (
    <points geometry={geo}>
      <pointsMaterial color={spec.color} size={0.05} transparent opacity={0.75} depthWrite={false}
        blending={THREE.AdditiveBlending} sizeAttenuation toneMapped={false} />
    </points>
  )
}

export function ReactorLayer({ spec, tier, selected = false, onSelectProduct, onHoverProduct }: {
  spec: ReactorLayerSpec
  tier: QualityTier
  selected?: boolean
  onSelectProduct?: (id: ProductId) => void
  onHoverProduct?: (id: ProductId | null) => void
}) {
  if (!spec.visible) return null

  switch (spec.kind) {
    case 'core':
      return (
        <group>
          <mesh>
            <sphereGeometry args={[spec.radius, 48, 48]} />
            <meshStandardMaterial color="#1597ff" emissive="#f8feff" emissiveIntensity={selected ? 3 : 2}
              roughness={0.12} metalness={0.1} toneMapped={false} />
          </mesh>
          {/* radiating spokes */}
          {Array.from({ length: 12 }, (_, i) => {
            const a = i * (Math.PI / 6)
            return (
              <mesh key={i} position={[Math.cos(a) * spec.radius * 1.3, Math.sin(a) * spec.radius * 1.3, 0.02]} rotation={[0, 0, a]}>
                <planeGeometry args={[spec.radius * 0.5, 0.03]} />
                <meshBasicMaterial color={spec.color} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
              </mesh>
            )
          })}
          <pointLight color={spec.color} intensity={selected ? 6 : 4} distance={13} />
        </group>
      )

    case 'disc':
      return (
        <group>
          <mesh><torusGeometry args={[spec.radius, spec.thickness, 16, 96]} /><LayerMaterial spec={spec} selected={selected} /></mesh>
          <mesh position={[0, 0, -0.02]}>
            <circleGeometry args={[spec.radius * 0.82, 48]} />
            <meshPhysicalMaterial color={spec.color} emissive={spec.color} emissiveIntensity={selected ? 2 : 1.1}
              roughness={0.15} metalness={0.05} transparent opacity={0.4} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        </group>
      )

    case 'ring':
      return <mesh><torusGeometry args={[spec.radius, spec.thickness, 16, 128]} /><LayerMaterial spec={spec} selected={selected} /></mesh>

    case 'coil': {
      const n = spec.count ?? 12
      return (
        <group>
          {Array.from({ length: n }, (_, i) => {
            const a = (i / n) * Math.PI * 2
            return (
              <group key={i} rotation={[0, 0, a]}>
                <mesh position={[0, spec.radius, 0]} castShadow>
                  <boxGeometry args={[0.28, 0.5, 0.4]} />
                  <meshStandardMaterial color="#243841" roughness={0.32} metalness={0.85} />
                </mesh>
                <mesh position={[0, spec.radius, 0.24]}>
                  <boxGeometry args={[0.05, 0.42, 0.05]} />
                  <meshBasicMaterial color={spec.color} transparent opacity={selected ? 1 : 0.8}
                    blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
                </mesh>
              </group>
            )
          })}
        </group>
      )
    }

    case 'segments': {
      // Thin, independent tech panels on a ring — not an enclosing shell.
      const n = spec.count ?? 12
      const arc = (Math.PI * 2 / n) * 0.62
      return (
        <group>
          {Array.from({ length: n }, (_, i) => {
            const a = (i / n) * Math.PI * 2
            return (
              <mesh key={i} rotation={[0, 0, a]} castShadow>
                <torusGeometry args={[spec.radius, spec.thickness * 2.4, 4, 20, arc]} />
                <meshStandardMaterial color={spec.color} roughness={0.34} metalness={0.82}
                  emissive={spec.color} emissiveIntensity={selected ? 0.4 : 0.06} wireframe={spec.wireframe} />
              </mesh>
            )
          })}
        </group>
      )
    }

    case 'particles':
      return <ParticleShell spec={spec} tier={tier} />

    case 'products':
      // Glossy iOS-style app tiles — a squircle carrying each product glyph.
      return (
        <group>
          {PRODUCT_ORBIT_META.map((p, i) => {
            const a = -Math.PI / 2 + (i / PRODUCT_ORBIT_META.length) * Math.PI * 2
            const tex = getProductIconTexture(p.id, p.color)
            return (
              <group key={p.id} position={[Math.cos(a) * spec.radius, Math.sin(a) * spec.radius, 0]}
                onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelectProduct?.(p.id) }}
                onPointerEnter={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHoverProduct?.(p.id); document.body.style.cursor = 'pointer' }}
                onPointerLeave={() => { onHoverProduct?.(null); document.body.style.cursor = '' }}>
                {/* glossy 3D body for the iOS-tile edge/gloss */}
                <RoundedBox args={[0.6, 0.6, 0.16]} radius={0.13} smoothness={4} castShadow>
                  <meshPhysicalMaterial color={p.color} clearcoat={1} clearcoatRoughness={0.14} roughness={0.4} metalness={0.1}
                    emissive={p.color} emissiveIntensity={selected ? 0.4 : 0.14} />
                </RoundedBox>
                {/* the glyph itself, on a front-facing decal so it always reads */}
                <mesh position={[0, 0, 0.085]}>
                  <planeGeometry args={[0.58, 0.58]} />
                  <meshBasicMaterial map={tex} transparent toneMapped={false} />
                </mesh>
              </group>
            )
          })}
        </group>
      )

    case 'signal': {
      const n = spec.count ?? 24
      return (
        <group>
          <mesh><torusGeometry args={[spec.radius, spec.thickness, 8, 128]} /><LayerMaterial spec={spec} selected={selected} /></mesh>
          {Array.from({ length: n }, (_, i) => {
            const a = (i / n) * Math.PI * 2
            return (
              <mesh key={i} position={[Math.cos(a) * (spec.radius + 0.12), Math.sin(a) * (spec.radius + 0.12), 0]} rotation={[0, 0, a]}>
                <planeGeometry args={[0.14, 0.02]} />
                <meshBasicMaterial color={spec.color} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
              </mesh>
            )
          })}
        </group>
      )
    }

    default:
      return null
  }
}
