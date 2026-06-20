import * as THREE from 'three'
import { gsap } from 'gsap'

// ============================================================
//  THE SPACE OBSERVATORY — 3D scene for Data Lab
//  Planets of data, a ring station, drifting number-motes, stars.
// ============================================================

interface CamPreset { pos: [number, number, number]; look: [number, number, number] }

const PRESETS: Record<string, CamPreset> = {
  orbit:   { pos: [0, 6, 30],    look: [0, 0, -4] },
  approach:{ pos: [7, 3, 15],    look: [0, 0, -6] },
  surface: { pos: [2, 0.5, 6.5], look: [0, 0, -6] },
  console: { pos: [0, 1.5, 10],  look: [0, 1.5, -6] },
  drift:   { pos: [0, 1.5, 16],  look: [0, 0.5, -34] },
}

export class CinematicSpace {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private raf = 0
  private lookTarget = new THREE.Vector3(0, 0, -4)
  private disposed = false
  private planets: THREE.Mesh[] = []
  private ring: THREE.Mesh
  private motes: THREE.Mesh[] = []
  private stars: THREE.Points
  private glow: THREE.PointLight

  constructor(canvas: HTMLCanvasElement) {
    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h)
    this.renderer.setClearColor(0x000000, 0)
    this.camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 300)
    this.camera.position.set(...PRESETS.orbit.pos)
    this.scene.fog = new THREE.FogExp2(0x03040c, 0.008)

    // stars
    const cnt = 1500
    const pos = new Float32Array(cnt * 3)
    for (let i = 0; i < cnt; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 200
      pos[i * 3 + 1] = (Math.random() - 0.5) * 140
      pos[i * 3 + 2] = (Math.random() - 0.5) * 140 - 20
    }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x9fd0ff, size: 0.32, transparent: true, opacity: 0.85 }))
    this.scene.add(this.stars)

    // main data planet
    const main = new THREE.Mesh(
      new THREE.SphereGeometry(3, 48, 48),
      new THREE.MeshStandardMaterial({ color: 0x1b3a6b, emissive: 0x4d9fff, emissiveIntensity: 0.35, metalness: 0.4, roughness: 0.5 }),
    )
    main.position.set(0, 0, -6)
    this.scene.add(main)
    this.planets.push(main)

    // ring around the main planet
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.6, 0.13, 10, 80),
      new THREE.MeshBasicMaterial({ color: 0x34e5ff, transparent: true, opacity: 0.55 }),
    )
    this.ring.position.copy(main.position)
    this.ring.rotation.x = Math.PI / 2.4
    this.scene.add(this.ring)

    // smaller planets
    const small = [
      { c: 0x8b5cf6, e: 0x8b5cf6, r: 1.1, p: [-9, 3, -14] as [number, number, number] },
      { c: 0xff5ea0, e: 0xff5ea0, r: 0.8, p: [10, -3, -18] as [number, number, number] },
      { c: 0x3de08a, e: 0x3de08a, r: 0.9, p: [8, 5, -22] as [number, number, number] },
    ]
    small.forEach(s => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(s.r, 32, 32),
        new THREE.MeshStandardMaterial({ color: s.c, emissive: s.e, emissiveIntensity: 0.4, roughness: 0.6 }),
      )
      m.position.set(...s.p)
      this.scene.add(m)
      this.planets.push(m)
    })

    // floating "number motes"
    const mg = new THREE.SphereGeometry(0.09, 6, 6)
    const cols = [0x34e5ff, 0x4d9fff, 0xffc24b, 0x8b5cf6]
    for (let i = 0; i < 60; i++) {
      const m = new THREE.Mesh(mg, new THREE.MeshBasicMaterial({ color: cols[i % cols.length] }))
      m.position.set((Math.random() - 0.5) * 26, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 20 - 6)
      m.userData = { sp: 0.2 + Math.random() * 0.6, ph: Math.random() * 6 }
      this.scene.add(m)
      this.motes.push(m)
    }

    this.scene.add(new THREE.AmbientLight(0x22335a, 0.8))
    const key = new THREE.DirectionalLight(0x9fc0ff, 1.1)
    key.position.set(-10, 8, 12)
    this.scene.add(key)
    this.glow = new THREE.PointLight(0x4d9fff, 0, 50)
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
    gsap.to(this.glow, { intensity: on ? 2.6 : 0.4, duration: 1.2, ease: 'power2.out' })
    const mat = this.planets[0].material as THREE.MeshStandardMaterial
    gsap.to(mat, { emissiveIntensity: on ? 0.7 : 0.35, duration: 1.2 })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setEffect(_effect: 'normal' | 'xray' | 'paint' = 'normal') { /* space has no material swap */ }

  pulse() {
    this.motes.forEach((m, i) => {
      gsap.to(m.scale, { x: 2.4, y: 2.4, z: 2.4, duration: 0.35, delay: i * 0.008, yoyo: true, repeat: 1, ease: 'power2.out' })
    })
    gsap.fromTo(this.glow, { intensity: 5 }, { intensity: 2.6, duration: 0.9 })
    gsap.fromTo(this.ring.scale, { x: 1, y: 1, z: 1 }, { x: 1.15, y: 1.15, z: 1.15, duration: 0.5, yoyo: true, repeat: 1 })
  }

  private animate() {
    if (this.disposed) return
    const t = performance.now() / 1000
    this.planets.forEach((p, i) => { p.rotation.y = t * (0.15 + i * 0.05) })
    this.ring.rotation.z = t * 0.2
    this.stars.rotation.y = t * 0.01
    this.motes.forEach(m => {
      const u = m.userData as { sp: number; ph: number }
      m.position.y += Math.sin(t * u.sp + u.ph) * 0.004
    })
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
