import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface Props { dark: boolean }

export function ThreeCanvas({ dark }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current!
    const w = mount.clientWidth
    const h = mount.clientHeight

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    mount.appendChild(renderer.domElement)

    // Scene
    const scene = new THREE.Scene()
    if (dark) {
      scene.fog = new THREE.FogExp2(0x09090b, 0.018)
    }

    // Camera
    const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 200)
    camera.position.z = 22

    // ── Particle field ────────────────────────────────
    const COUNT = 1800
    const positions = new Float32Array(COUNT * 3)
    const colors = new Float32Array(COUNT * 3)
    const sizes = new Float32Array(COUNT)

    const c1 = new THREE.Color(dark ? '#a78bfa' : '#7c3aed')
    const c2 = new THREE.Color(dark ? '#38bdf8' : '#0ea5e9')
    const tmp = new THREE.Color()

    for (let i = 0; i < COUNT; i++) {
      // Distribute on a sphere shell with some scatter
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 9 + Math.random() * 13

      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      const t = (positions[i * 3 + 1] + 22) / 44
      tmp.copy(c1).lerp(c2, t)
      colors[i * 3]     = tmp.r
      colors[i * 3 + 1] = tmp.g
      colors[i * 3 + 2] = tmp.b

      sizes[i] = 0.04 + Math.random() * 0.06
    }

    const pGeo = new THREE.BufferGeometry()
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    pGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    const pMat = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: dark ? 0.75 : 0.5,
      sizeAttenuation: true,
    })
    const points = new THREE.Points(pGeo, pMat)
    scene.add(points)

    // ── Ring outlines (wireframe circles) ─────────────
    const makeRing = (radius: number, color: number, opacity: number) => {
      const geo = new THREE.TorusGeometry(radius, 0.01, 8, 120)
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity })
      return new THREE.Mesh(geo, mat)
    }
    const ring1 = makeRing(5, 0x22d3ee, dark ? 0.12 : 0.06)
    const ring2 = makeRing(8.5, 0x8b5cf6, dark ? 0.10 : 0.05)
    const ring3 = makeRing(12, 0xc026d3, dark ? 0.08 : 0.04)
    ring1.rotation.x = Math.PI / 2
    ring2.rotation.x = Math.PI / 2.5
    ring3.rotation.x = Math.PI / 2.2
    scene.add(ring1, ring2, ring3)

    // ── App orbs ──────────────────────────────────────
    interface OrbDef { color: number; emissive: number; r: number; speed: number; y: number; size: number; startAngle: number }
    const orbDefs: OrbDef[] = [
      { color: 0x22d3ee, emissive: 0x0891b2, r: 5,    speed: 0.35, y:  1.0, size: 0.45, startAngle: 0 },
      { color: 0x8b5cf6, emissive: 0x6d28d9, r: 8.5,  speed: 0.22, y: -1.0, size: 0.55, startAngle: 2.1 },
      { color: 0xf0abfc, emissive: 0xc026d3, r: 12,   speed: 0.14, y:  0.5, size: 0.38, startAngle: 4.2 },
    ]

    const orbs = orbDefs.map(def => {
      const geo = new THREE.SphereGeometry(def.size, 48, 48)
      const mat = new THREE.MeshStandardMaterial({
        color: def.color,
        emissive: def.emissive,
        emissiveIntensity: dark ? 2.5 : 1.5,
        roughness: 0.15,
        metalness: 0.85,
      })
      const mesh = new THREE.Mesh(geo, mat)
      scene.add(mesh)
      return { mesh, ...def, angle: def.startAngle }
    })

    // ── Central orb (Arganta mark) ────────────────────
    const centerGeo = new THREE.SphereGeometry(1.0, 64, 64)
    const centerMat = new THREE.MeshStandardMaterial({
      color: 0x7c3aed,
      emissive: 0x6d28d9,
      emissiveIntensity: dark ? 3 : 2,
      roughness: 0.05,
      metalness: 0.95,
    })
    const center = new THREE.Mesh(centerGeo, centerMat)
    scene.add(center)

    // Inner glow sphere
    const glowGeo = new THREE.SphereGeometry(1.3, 32, 32)
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x7c3aed,
      transparent: true,
      opacity: dark ? 0.12 : 0.06,
      side: THREE.BackSide,
    })
    const glow = new THREE.Mesh(glowGeo, glowMat)
    scene.add(glow)

    // ── Lights ────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.4))

    const pLight1 = new THREE.PointLight(0x8b5cf6, dark ? 8 : 5, 40)
    pLight1.position.set(0, 0, 6)
    scene.add(pLight1)

    const pLight2 = new THREE.PointLight(0x22d3ee, dark ? 6 : 3, 35)
    pLight2.position.set(-12, 5, 0)
    scene.add(pLight2)

    const pLight3 = new THREE.PointLight(0xc026d3, dark ? 4 : 2, 30)
    pLight3.position.set(10, -5, -5)
    scene.add(pLight3)

    // ── Mouse parallax ────────────────────────────────
    let mx = 0, my = 0
    const onMouse = (e: MouseEvent) => {
      mx = (e.clientX / window.innerWidth  - 0.5) * 2
      my = -(e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', onMouse)

    // ── Resize ────────────────────────────────────────
    const onResize = () => {
      const nw = mount.clientWidth, nh = mount.clientHeight
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
      renderer.setSize(nw, nh)
    }
    window.addEventListener('resize', onResize)

    // ── Animation loop ────────────────────────────────
    const clock = new THREE.Clock()
    let rafId = 0

    const animate = () => {
      rafId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()

      // Slowly rotate the whole particle field
      points.rotation.y = t * 0.018
      points.rotation.x = t * 0.008

      // Tilt rings slowly
      ring1.rotation.z = t * 0.06
      ring2.rotation.z = -t * 0.04
      ring3.rotation.z = t * 0.025

      // Orbit app orbs
      orbs.forEach(o => {
        o.angle += o.speed * 0.01
        o.mesh.position.x = Math.cos(o.angle) * o.r
        o.mesh.position.z = Math.sin(o.angle) * o.r
        o.mesh.position.y = o.y + Math.sin(t * 0.4 + o.startAngle) * 0.6
        o.mesh.rotation.y = t * 0.8
        o.mesh.rotation.x = t * 0.3
      })

      // Pulse center
      const pulse = 1 + Math.sin(t * 2) * 0.04
      center.scale.setScalar(pulse)
      glow.scale.setScalar(pulse * 1.1)

      // Camera parallax
      camera.position.x += (mx * 2.5 - camera.position.x) * 0.025
      camera.position.y += (my * 1.8 - camera.position.y) * 0.025
      camera.lookAt(0, 0, 0)

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMouse)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [dark])

  return (
    <div
      ref={mountRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  )
}
