// Scene Studio preview — a real Three.js scene via R3F. A brand-colored reactor
// core (icosahedron + wireframe shell) on a slow orbit, drag to rotate. Stands
// in for the "scene as data → embeddable module" engine; genuinely 3D today.

import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useRef } from 'react'
import type { Mesh, Group } from 'three'

function Core({ color, accent }: { color: string; accent: string }) {
  const core = useRef<Mesh>(null)
  const shell = useRef<Group>(null)
  useFrame((_, dt) => {
    if (core.current) { core.current.rotation.x += dt * 0.25; core.current.rotation.y += dt * 0.35 }
    if (shell.current) { shell.current.rotation.y -= dt * 0.12; shell.current.rotation.z += dt * 0.06 }
  })
  return (
    <>
      <mesh ref={core}>
        <icosahedronGeometry args={[1.15, 1]} />
        <meshStandardMaterial color={color} emissive={accent} emissiveIntensity={0.5} metalness={0.6} roughness={0.25} flatShading />
      </mesh>
      <group ref={shell}>
        <mesh>
          <icosahedronGeometry args={[1.9, 1]} />
          <meshBasicMaterial color={accent} wireframe transparent opacity={0.28} />
        </mesh>
      </group>
    </>
  )
}

export function SceneCanvas({ color = '#7c3aad', accent = '#ef8060' }: { color?: string; accent?: string }) {
  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 45 }} style={{ width: '100%', height: '100%', borderRadius: 10 }} dpr={[1, 2]}>
      <color attach="background" args={['#0e0a1e']} />
      <ambientLight intensity={0.5} />
      <pointLight position={[4, 5, 5]} intensity={80} color={accent} />
      <pointLight position={[-5, -3, 2]} intensity={40} color={color} />
      <Core color={color} accent={accent} />
      <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.6} />
    </Canvas>
  )
}
