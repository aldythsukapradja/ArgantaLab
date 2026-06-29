import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface Props {
  dark: boolean
  step?: number
  total?: number
}

const WORLD_COLORS = ['#f59e0b', '#3b82f6', '#8b5cf6', '#22c55e', '#f97316', '#ec4899']

export function ThreeCanvas({ dark, step = 0, total = 13 }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const stepRef = useRef(step)

  useEffect(() => {
    stepRef.current = step
  }, [step])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = dark ? 1.28 : 0.84
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(dark ? 0x050711 : 0xf8f7ff, dark ? 0.018 : 0.022)

    const camera = new THREE.PerspectiveCamera(52, mount.clientWidth / mount.clientHeight, 0.1, 220)
    camera.position.set(0, 0, 24)

    const root = new THREE.Group()
    const core = new THREE.Group()
    const worlds = new THREE.Group()
    const safety = new THREE.Group()
    const circles = new THREE.Group()
    scene.add(root)
    root.add(core, worlds, safety, circles)

    // Star/intelligence field.
    const mobile = window.innerWidth < 760
    const count = mobile ? 900 : 1700
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const c1 = new THREE.Color(dark ? '#a78bfa' : '#7c3aed')
    const c2 = new THREE.Color(dark ? '#43e7ff' : '#0ea5e9')
    const c3 = new THREE.Color(dark ? '#ffd166' : '#f6b83f')
    const tmp = new THREE.Color()

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const radius = 9 + Math.random() * 18
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = radius * Math.cos(phi) - 2
      tmp.copy(c1).lerp(c2, Math.random())
      if (Math.random() > 0.86) tmp.lerp(c3, 0.55)
      colors[i * 3] = tmp.r
      colors[i * 3 + 1] = tmp.g
      colors[i * 3 + 2] = tmp.b
      sizes[i] = 0.04 + Math.random() * 0.07
    }

    const fieldGeo = new THREE.BufferGeometry()
    fieldGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    fieldGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    fieldGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    const fieldMat = new THREE.PointsMaterial({
      size: mobile ? 0.06 : 0.075,
      vertexColors: true,
      transparent: true,
      opacity: dark ? 0.72 : 0.26,
      sizeAttenuation: true,
    })
    const field = new THREE.Points(fieldGeo, fieldMat)
    root.add(field)

    // Argons: warm particles moving through the product loop.
    const argonCount = mobile ? 90 : 180
    const argonPositions = new Float32Array(argonCount * 3)
    for (let i = 0; i < argonCount; i++) {
      const a = i / argonCount * Math.PI * 8
      const r = 2.4 + (i % 34) * 0.18
      argonPositions[i * 3] = Math.cos(a) * r
      argonPositions[i * 3 + 1] = Math.sin(a * 0.7) * 2.2
      argonPositions[i * 3 + 2] = Math.sin(a) * r
    }
    const argonGeo = new THREE.BufferGeometry()
    argonGeo.setAttribute('position', new THREE.BufferAttribute(argonPositions, 3))
    const argonMat = new THREE.PointsMaterial({
      size: 0.12,
      color: new THREE.Color(dark ? '#ffd166' : '#f6b83f'),
      transparent: true,
      opacity: dark ? 0.95 : 0.42,
      sizeAttenuation: true,
    })
    const argons = new THREE.Points(argonGeo, argonMat)
    core.add(argons)

    // Arganta Core.
    const coreMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#7c3aed'),
      emissive: new THREE.Color(dark ? '#7c3aed' : '#5b21b6'),
      emissiveIntensity: dark ? 2.6 : 0.72,
      roughness: 0.18,
      metalness: 0.72,
    })
    const coreSphere = new THREE.Mesh(new THREE.SphereGeometry(1.14, 64, 64), coreMat)
    core.add(coreSphere)

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.82, 48, 48),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(dark ? '#8b5cf6' : '#7c3aed'),
        transparent: true,
        opacity: dark ? 0.18 : 0.055,
        side: THREE.BackSide,
      }),
    )
    core.add(glow)

    const makeTorus = (radius: number, tube: number, color: string, opacity: number) => {
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(radius, tube, 10, 180),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity }),
      )
      core.add(mesh)
      return mesh
    }

    const coreRing1 = makeTorus(2.3, 0.012, '#43e7ff', dark ? 0.34 : 0.1)
    const coreRing2 = makeTorus(3.55, 0.01, '#a78bfa', dark ? 0.24 : 0.075)
    const coreRing3 = makeTorus(5.0, 0.008, '#ffd166', dark ? 0.16 : 0.055)
    coreRing1.rotation.x = Math.PI / 2.6
    coreRing2.rotation.x = Math.PI / 2.1
    coreRing2.rotation.y = Math.PI / 5
    coreRing3.rotation.x = Math.PI / 2

    // Six world rings and nodes.
    const worldNodes: Array<{ mesh: THREE.Mesh; halo: THREE.Mesh; angle: number; radius: number; speed: number; y: number }> = []
    WORLD_COLORS.forEach((color, i) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(6.6 + i * 0.54, 0.01, 8, 160),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: dark ? 0.16 : 0.04 }),
      )
      ring.rotation.x = Math.PI / (2.05 + i * 0.04)
      ring.rotation.y = i * 0.19
      worlds.add(ring)

      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        emissive: new THREE.Color(color),
        emissiveIntensity: dark ? 1.9 : 0.42,
        roughness: 0.24,
        metalness: 0.55,
      })
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.34 + (i % 2) * 0.05, 36, 36), mat)
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.64, 24, 24),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: dark ? 0.12 : 0.035, side: THREE.BackSide }),
      )
      worlds.add(mesh, halo)
      worldNodes.push({ mesh, halo, angle: i / 6 * Math.PI * 2, radius: 6.6 + i * 0.54, speed: 0.16 + i * 0.018, y: (i % 3 - 1) * 0.58 })
    })

    // Trusted circle nodes.
    for (let i = 0; i < 10; i++) {
      const color = i % 3 === 0 ? '#ffd166' : i % 2 ? '#43e7ff' : '#a78bfa'
      const node = new THREE.Mesh(
        new THREE.SphereGeometry(i % 3 === 0 ? 0.12 : 0.09, 18, 18),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: dark ? 0.8 : 0.24 }),
      )
      const a = i / 10 * Math.PI * 2
      node.position.set(Math.cos(a) * 11.6, Math.sin(a * 1.7) * 1.7, Math.sin(a) * 11.6)
      circles.add(node)
    }

    // Safety shield rings.
    const shield1 = new THREE.Mesh(
      new THREE.TorusGeometry(12.8, 0.012, 10, 220),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#43e7ff'), transparent: true, opacity: dark ? 0.12 : 0.026 }),
    )
    const shield2 = new THREE.Mesh(
      new THREE.TorusGeometry(14.1, 0.01, 10, 220),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#a78bfa'), transparent: true, opacity: dark ? 0.1 : 0.022 }),
    )
    shield1.rotation.x = Math.PI / 2.25
    shield2.rotation.x = Math.PI / 2.55
    shield2.rotation.y = Math.PI / 6
    safety.add(shield1, shield2)

    scene.add(new THREE.AmbientLight(0xffffff, dark ? 0.42 : 0.54))
    const keyLight = new THREE.PointLight(0x8b5cf6, dark ? 8 : 2.4, 46)
    keyLight.position.set(0, 0, 7)
    const cyanLight = new THREE.PointLight(0x43e7ff, dark ? 5.6 : 1.65, 38)
    cyanLight.position.set(-11, 5, 2)
    const goldLight = new THREE.PointLight(0xffd166, dark ? 3.2 : 1.05, 36)
    goldLight.position.set(9, -5, 5)
    scene.add(keyLight, cyanLight, goldLight)

    let mx = 0
    let my = 0
    const onMouse = (event: MouseEvent) => {
      mx = (event.clientX / window.innerWidth - 0.5) * 2
      my = -(event.clientY / window.innerHeight - 0.5) * 2
    }
    const onResize = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    window.addEventListener('mousemove', onMouse)
    window.addEventListener('resize', onResize)

    const clock = new THREE.Clock()
    let raf = 0

    const animate = () => {
      raf = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()
      const progress = Math.min(1, stepRef.current / Math.max(1, total - 1))
      const act = stepRef.current % 6

      field.rotation.y = t * 0.015
      field.rotation.x = t * 0.006
      core.rotation.y = t * 0.12 + progress * Math.PI * 1.45
      core.rotation.x = Math.sin(t * 0.18) * 0.08 + (act - 2.5) * 0.018
      worlds.rotation.y = -t * 0.052 + progress * Math.PI * 1.9
      circles.rotation.y = t * 0.035
      safety.rotation.z = -t * 0.018

      coreRing1.rotation.z = t * 0.34
      coreRing2.rotation.z = -t * 0.22
      coreRing3.rotation.z = t * 0.13
      shield1.rotation.z = t * 0.04
      shield2.rotation.z = -t * 0.03
      argons.rotation.y = -t * 0.3
      argons.rotation.z = t * 0.08

      const pulse = 1 + Math.sin(t * 2.1) * 0.035
      coreSphere.scale.setScalar(pulse)
      glow.scale.setScalar(1.02 + Math.sin(t * 1.6) * 0.08)

      worldNodes.forEach(node => {
        const a = node.angle + t * node.speed
        node.mesh.position.set(Math.cos(a) * node.radius, node.y + Math.sin(t * 0.7 + node.angle) * 0.4, Math.sin(a) * node.radius)
        node.halo.position.copy(node.mesh.position)
        node.halo.scale.setScalar(1 + Math.sin(t * 1.8 + node.angle) * 0.12)
      })

      const targetZ = mobile
        ? (dark ? 31 - progress * 2 : 35 - progress)
        : (dark ? 24 + Math.sin(progress * Math.PI * 1.2) * 4 : 31 + Math.sin(progress * Math.PI * 1.2) * 2)
      const targetX = mx * 2.0 + Math.sin(progress * Math.PI * 2) * (mobile ? 1.4 : 3.2)
      const targetY = my * 1.4 + Math.cos(progress * Math.PI * 1.4) * (mobile ? 0.8 : 1.5)
      camera.position.x += (targetX - camera.position.x) * 0.03
      camera.position.y += (targetY - camera.position.y) * 0.03
      camera.position.z += (targetZ - camera.position.z) * 0.025
      camera.lookAt(0, 0, 0)

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMouse)
      window.removeEventListener('resize', onResize)
      scene.traverse(obj => {
        const mesh = obj as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const material = mesh.material
        if (Array.isArray(material)) material.forEach(m => m.dispose())
        else if (material) material.dispose()
      })
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [dark])

  return <div ref={mountRef} className="three-canvas" />
}
