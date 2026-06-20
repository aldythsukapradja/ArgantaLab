import * as THREE from 'three'
import { gsap } from 'gsap'

// ============================================================
//  THE NEURAL FORGE — 3D scene for AI Forge
//  A living brain: nodes, connections, light pulses, a bright core.
// ============================================================

interface CamPreset { pos: [number, number, number]; look: [number, number, number] }

const PRESETS: Record<string, CamPreset> = {
  orbit:   { pos: [0, 4, 26],   look: [0, 0, -4] },
  approach:{ pos: [6, 2, 14],   look: [0, 1, -5] },
  core:    { pos: [0, 0, 7],    look: [0, 0, -6] },
  terminal:{ pos: [2.5, 1, 9],  look: [0, 1.5, -6] },
  drift:   { pos: [0, 1, 15],   look: [0, 0.5, -32] },
}

interface Pulse { mesh: THREE.Mesh; a: THREE.Vector3; b: THREE.Vector3; t: number; sp: number }

export class CinematicNeural {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private raf = 0
  private lookTarget = new THREE.Vector3(0, 0, -4)
  private disposed = false
  private nodes: THREE.Mesh[] = []
  private pulses: Pulse[] = []
  private core: THREE.Mesh
  private glow: THREE.PointLight
  private cloud = new THREE.Group()

  constructor(canvas: HTMLCanvasElement) {
    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h)
    this.renderer.setClearColor(0x000000, 0)
    this.camera = new THREE.PerspectiveCamera(54, w / h, 0.1, 200)
    this.camera.position.set(...PRESETS.orbit.pos)
    this.scene.fog = new THREE.FogExp2(0x07041a, 0.01)
    this.scene.add(this.cloud)
    this.cloud.position.z = -6

    // node positions in a rough brain cloud
    const positions: THREE.Vector3[] = []
    const ng = new THREE.SphereGeometry(0.18, 12, 12)
    const cols = [0x8b5cf6, 0xa855f7, 0x4d9fff, 0x34e5ff]
    for (let i = 0; i < 28; i++) {
      const r = 3 + Math.random() * 4
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(2 * Math.random() - 1)
      const v = new THREE.Vector3(r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th) * 0.7, r * Math.cos(ph))
      positions.push(v)
      const col = cols[i % cols.length]
      const m = new THREE.Mesh(ng, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9 }))
      m.position.copy(v)
      this.cloud.add(m)
      this.nodes.push(m)
    }

    // connections between nearby nodes
    const lineMat = new THREE.LineBasicMaterial({ color: 0x6a4fd0, transparent: true, opacity: 0.28 })
    const edges: [THREE.Vector3, THREE.Vector3][] = []
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        if (positions[i].distanceTo(positions[j]) < 3.4) {
          edges.push([positions[i], positions[j]])
          const lg = new THREE.BufferGeometry().setFromPoints([positions[i], positions[j]])
          this.cloud.add(new THREE.Line(lg, lineMat))
        }
      }
    }

    // traveling light pulses along a sample of edges
    const pg = new THREE.SphereGeometry(0.12, 8, 8)
    const sample = edges.sort(() => Math.random() - 0.5).slice(0, 22)
    sample.forEach(([a, b]) => {
      const mesh = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: 0x9fe8ff }))
      this.cloud.add(mesh)
      this.pulses.push({ mesh, a, b, t: Math.random(), sp: 0.2 + Math.random() * 0.5 })
    })

    // bright core
    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0xcda8ff, emissive: 0x8b5cf6, emissiveIntensity: 1.2, roughness: 0.3 }),
    )
    this.cloud.add(this.core)

    this.scene.add(new THREE.AmbientLight(0x261a4a, 1))
    this.glow = new THREE.PointLight(0xa855f7, 2.4, 40)
    this.glow.position.set(0, 0, -6)
    this.scene.add(this.glow)

    this.animate = this.animate.bind(this)
    this.raf = requestAnimationFrame(this.animate)
  }

  goTo(preset: string, duration = 1.6) {
    const p = PRESETS[preset] ?? PRESETS.orbit
    gsap.to(this.camera.position, { x: p.pos[0], y: p.pos[1], z: p.pos[2], duration, ease: 'power2.inOut' })
    gsap.to(this.lookTarget, { x: p.look[0], y: p.look[1], z: p.look[2], duration, ease: 'power2.inOut' })
  }

  spotlight(on: boolean) {
    gsap.to(this.glow, { intensity: on ? 4 : 2.4, duration: 1.2, ease: 'power2.out' })
    const mat = this.core.material as THREE.MeshStandardMaterial
    gsap.to(mat, { emissiveIntensity: on ? 2 : 1.2, duration: 1.2 })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setEffect(_effect: 'normal' | 'xray' | 'paint' = 'normal') { /* neural has no material swap */ }

  pulse() {
    this.pulses.forEach(p => { gsap.to(p, { sp: p.sp * 3, duration: 0.2, yoyo: true, repeat: 1 }) })
    this.nodes.forEach((n, i) => {
      gsap.to(n.scale, { x: 1.8, y: 1.8, z: 1.8, duration: 0.3, delay: i * 0.01, yoyo: true, repeat: 1, ease: 'power2.out' })
    })
    gsap.fromTo(this.glow, { intensity: 6 }, { intensity: 4, duration: 0.9 })
  }

  private animate() {
    if (this.disposed) return
    const t = performance.now() / 1000
    this.cloud.rotation.y = t * 0.06
    this.pulses.forEach(p => {
      p.t += p.sp * 0.01
      if (p.t > 1) p.t -= 1
      p.mesh.position.lerpVectors(p.a, p.b, p.t)
    })
    const cm = this.core.material as THREE.MeshStandardMaterial
    cm.emissiveIntensity = 1.2 + Math.sin(t * 2) * 0.25
    this.camera.lookAt(this.lookTarget)
    this.renderer.render(this.scene, this.camera)
    this.raf = requestAnimationFrame(this.animate)
  }

  resize() {
    const c = this.renderer.domElement
    const w = c.clientWidth || window.innerWidth
    const h = c.clientHeight || window.innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.scene.traverse(o => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
      if (m.material) {
        const mat = m.material as THREE.Material | THREE.Material[]
        Array.isArray(mat) ? mat.forEach(x => x.dispose()) : mat.dispose()
      }
    })
    this.renderer.dispose()
  }
}
