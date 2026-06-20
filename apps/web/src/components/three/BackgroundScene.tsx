import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const CONFIGS: Record<string, (scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer) => (t: number) => void> = {
  arganta(scene, camera) {
    const gems: THREE.Mesh[] = []
    const geo = new THREE.OctahedronGeometry(1, 0)
    const cols = [0x4D9FFF, 0x8B5CF6, 0xFF5EA0, 0x3DE08A, 0x34E5FF]
    for (let i = 0; i < 28; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: cols[i % cols.length], metalness: 0.6, roughness: 0.2, transparent: true, opacity: 0.7 })
      const m = new THREE.Mesh(geo, mat)
      m.position.set((Math.random() - 0.5) * 28, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 14 - 4)
      m.scale.setScalar(0.3 + Math.random() * 1.2)
      scene.add(m)
      gems.push(m)
    }
    scene.add(new THREE.AmbientLight(0x8B5CF6, 0.5))
    const dl = new THREE.DirectionalLight(0x4D9FFF, 1.8); dl.position.set(5, 10, 5); scene.add(dl)
    ;(camera as THREE.PerspectiveCamera).position.z = 16

    return (t) => {
      gems.forEach((g, i) => {
        g.rotation.x = t * 0.4 + i
        g.rotation.y = t * 0.3 + i * 0.7
        g.position.y += Math.sin(t * 0.5 + i) * 0.006
      })
    }
  },

  web(scene, camera) {
    const lines: THREE.Line[] = []
    const nodes: THREE.Mesh[] = []
    const geo = new THREE.SphereGeometry(0.12, 8, 8)
    const mat = new THREE.MeshStandardMaterial({ color: 0x34E5FF, emissive: 0x34E5FF, emissiveIntensity: 0.8 })
    const positions = Array.from({ length: 14 }, () => new THREE.Vector3((Math.random() - 0.5) * 24, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 6 - 6))
    positions.forEach(p => { const n = new THREE.Mesh(geo, mat); n.position.copy(p); scene.add(n); nodes.push(n) })
    for (let i = 0; i < 18; i++) {
      const a = positions[Math.floor(Math.random() * positions.length)]
      const b = positions[Math.floor(Math.random() * positions.length)]
      const lg = new THREE.BufferGeometry().setFromPoints([a, b])
      const l = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x34E5FF, transparent: true, opacity: 0.22 }))
      scene.add(l); lines.push(l)
    }
    scene.add(new THREE.AmbientLight(0x112233, 1))
    ;(camera as THREE.PerspectiveCamera).position.z = 18
    return (t) => {
      nodes.forEach((n, i) => { n.position.y += Math.sin(t * 0.4 + i) * 0.005; n.scale.setScalar(1 + 0.12 * Math.sin(t + i)) })
    }
  },

  ai(scene, camera) {
    const orbs: THREE.Mesh[] = []
    const geo = new THREE.SphereGeometry(1, 32, 32)
    for (let i = 0; i < 5; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x8B5CF6, emissive: 0x5B21B6, emissiveIntensity: 0.4, transparent: true, opacity: 0.55, wireframe: i === 0 })
      const m = new THREE.Mesh(geo, mat)
      m.position.set((i - 2) * 5, 0, -5 + i * 0.5)
      m.scale.setScalar(0.5 + i * 0.3)
      scene.add(m); orbs.push(m)
    }
    scene.add(new THREE.AmbientLight(0x220033, 1))
    const pl = new THREE.PointLight(0xA855F7, 3, 28); pl.position.set(0, 4, 4); scene.add(pl)
    ;(camera as THREE.PerspectiveCamera).position.z = 16
    return (t) => {
      orbs.forEach((o, i) => { o.rotation.y = t * 0.3 + i; o.position.y = Math.sin(t * 0.5 + i * 1.2) * 1.4 })
      pl.position.x = Math.sin(t * 0.6) * 6
    }
  },

  data(scene, camera) {
    const bars: THREE.Mesh[] = []
    const heights = [3, 5, 4, 7, 5.5, 8, 6, 4.5, 7.2, 9]
    const geo = new THREE.BoxGeometry(0.8, 1, 0.8)
    heights.forEach((h, i) => {
      const mat = new THREE.MeshStandardMaterial({ color: i % 2 ? 0x4D9FFF : 0x8B5CF6, transparent: true, opacity: 0.6 })
      const m = new THREE.Mesh(geo, mat)
      m.scale.y = h; m.position.set((i - 4.5) * 2, h / 2 - 3, -4)
      scene.add(m); bars.push(m)
    })
    scene.add(new THREE.AmbientLight(0x111122, 1))
    const dl = new THREE.DirectionalLight(0x4D9FFF, 2); dl.position.set(8, 12, 8); scene.add(dl)
    ;(camera as THREE.PerspectiveCamera).position.z = 20; (camera as THREE.PerspectiveCamera).position.y = 2
    return (t) => {
      bars.forEach((b, i) => { b.scale.y = heights[i] * (0.9 + 0.1 * Math.sin(t * 1.1 + i * 0.7)) })
    }
  },

  studio(scene, camera) {
    const cubes: THREE.Mesh[] = []
    const geo = new THREE.BoxGeometry(1.2, 1.2, 1.2)
    const cols = [0x3DE08A, 0x4D9FFF, 0x8B5CF6, 0xFF5EA0]
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: cols[i % cols.length], wireframe: true, transparent: true, opacity: 0.45 })
      const m = new THREE.Mesh(geo, mat)
      m.position.set((Math.random() - 0.5) * 26, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 10 - 5)
      scene.add(m); cubes.push(m)
    }
    scene.add(new THREE.AmbientLight(0x112211, 1))
    ;(camera as THREE.PerspectiveCamera).position.z = 18
    return (t) => {
      cubes.forEach((c, i) => { c.rotation.x = t * 0.35 + i; c.rotation.y = t * 0.5 + i })
    }
  },

  launch(scene, camera) {
    const points: THREE.Points[] = []
    for (let j = 0; j < 2; j++) {
      const cnt = 800
      const pos = new Float32Array(cnt * 3)
      for (let i = 0; i < cnt; i++) { pos[i*3]=( Math.random()-0.5)*32; pos[i*3+1]=(Math.random()-0.5)*20; pos[i*3+2]=(Math.random()-0.5)*14-8 }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      const mat = new THREE.PointsMaterial({ color: j ? 0x8B5CF6 : 0x4D9FFF, size: 0.09, transparent: true, opacity: 0.6 })
      const p = new THREE.Points(geo, mat); scene.add(p); points.push(p)
    }
    scene.add(new THREE.AmbientLight(0x000011, 1))
    ;(camera as THREE.PerspectiveCamera).position.z = 16
    return (t) => {
      points.forEach((p, i) => { p.rotation.y = t * (i ? 0.04 : -0.025); p.rotation.x = t * 0.015 })
    }
  },
}

export default function BackgroundScene({ tab }: { tab: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    const w = canvas.offsetWidth || window.innerWidth
    const h = canvas.offsetHeight || window.innerHeight
    renderer.setSize(w, h)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 100)

    const key = Object.keys(CONFIGS).find(k => tab.startsWith(k)) ?? 'arganta'
    const tick = CONFIGS[key]?.(scene, camera, renderer) ?? (() => {})

    let start: number | null = null
    const animate = (time: number) => {
      if (!start) start = time
      const t = (time - start) / 1000
      tick(t)
      renderer.render(scene, camera)
      frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)

    const onResize = () => {
      const w2 = canvas.offsetWidth || window.innerWidth
      const h2 = canvas.offsetHeight || window.innerHeight
      renderer.setSize(w2, h2)
      ;(camera as THREE.PerspectiveCamera).aspect = w2 / h2
      ;(camera as THREE.PerspectiveCamera).updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      scene.clear()
    }
  }, [tab])

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
}
