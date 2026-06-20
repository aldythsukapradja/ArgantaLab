import * as THREE from 'three'
import { gsap } from 'gsap'

// ============================================================
//  THE DIGITAL CITY — interactive 3D scene for Web Quest
//  A glowing night city. Camera presets fly between lesson beats.
// ============================================================

interface CamPreset { pos: [number, number, number]; look: [number, number, number] }

const PRESETS: Record<string, CamPreset> = {
  // high above, looking down at the whole grid
  orbit:    { pos: [2, 34, 30],   look: [0, 0, -6] },
  // descending toward the hero building
  approach: { pos: [10, 12, 20],  look: [0, 7, -10] },
  // street level, facing the hero building + its sign
  street:   { pos: [9, 4, 13],    look: [0, 5, -10] },
  // down on the ground / the plot of land
  ground:   { pos: [4, 1.4, 9],   look: [0, 4, -10] },
  // low POV driving down the road toward the building
  drive:    { pos: [0.5, 1.6, 17], look: [0, 2.5, -30] },
  // standing at the base of the hero building, looking up (control-room feel)
  inside:   { pos: [3, 1.2, 4], look: [0, 11, -10] },
}

export class CinematicCity {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private raf = 0
  private buildings: THREE.Object3D[] = []
  private heroGlow: THREE.PointLight
  private packets: THREE.Mesh[] = []
  private lookTarget = new THREE.Vector3(0, 0, -6)
  private disposed = false

  constructor(canvas: HTMLCanvasElement) {
    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight

    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h)
    this.renderer.setClearColor(0x000000, 0)

    this.camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 200)
    this.camera.position.set(...PRESETS.orbit.pos)

    this.scene.fog = new THREE.FogExp2(0x05060f, 0.012)

    this.buildCity()

    // lighting
    this.scene.add(new THREE.AmbientLight(0x223055, 0.7))
    const moon = new THREE.DirectionalLight(0x6f8bff, 0.9)
    moon.position.set(-12, 24, 10)
    this.scene.add(moon)
    this.heroGlow = new THREE.PointLight(0x4d9fff, 0, 40)
    this.heroGlow.position.set(0, 8, -10)
    this.scene.add(this.heroGlow)

    this.animate = this.animate.bind(this)
    this.raf = requestAnimationFrame(this.animate)
  }

  private buildCity() {
    // ground plane
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: 0x070a16, metalness: 0.4, roughness: 0.8 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.01
    this.scene.add(ground)

    // glowing road grid
    const roadMat = new THREE.LineBasicMaterial({ color: 0x1c2c55, transparent: true, opacity: 0.5 })
    const grid = new THREE.Group()
    for (let i = -50; i <= 50; i += 10) {
      const a = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(i, 0.02, -50), new THREE.Vector3(i, 0.02, 50)])
      const b = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-50, 0.02, i), new THREE.Vector3(50, 0.02, i)])
      grid.add(new THREE.Line(a, roadMat), new THREE.Line(b, roadMat))
    }
    this.scene.add(grid)

    // hero building (index 0) — argantalab, tall & bright
    const hero = this.makeBuilding(0x4d9fff, 4, 16, 4, 0xffffff)
    hero.position.set(0, 8, -10)
    this.scene.add(hero)
    this.buildings.push(hero)

    // surrounding city
    const palette = [0x8b5cf6, 0x34e5ff, 0xff5ea0, 0x3de08a, 0x4d9fff]
    let idx = 1
    for (let gx = -4; gx <= 4; gx++) {
      for (let gz = -5; gz <= 1; gz++) {
        if (gx === 0 && gz === 0) continue // hero spot
        if (Math.random() < 0.28) continue // gaps = streets/plazas
        const hgt = 3 + Math.random() * 11
        const col = palette[idx % palette.length]
        const b = this.makeBuilding(0x0c1226, 2.2, hgt, 2.2, col)
        b.position.set(gx * 6 + (Math.random() - 0.5) * 1.5, hgt / 2, gz * 6 - 6)
        this.scene.add(b)
        this.buildings.push(b)
        idx++
      }
    }

    // data packets — bright dots that travel along the roads
    const pgeo = new THREE.SphereGeometry(0.16, 8, 8)
    for (let i = 0; i < 22; i++) {
      const col = palette[i % palette.length]
      const m = new THREE.Mesh(pgeo, new THREE.MeshBasicMaterial({ color: col }))
      m.userData = {
        axis: Math.random() < 0.5 ? 'x' : 'z',
        lane: (Math.floor(Math.random() * 11) - 5) * 6,
        speed: (0.04 + Math.random() * 0.06) * (Math.random() < 0.5 ? 1 : -1),
        t: Math.random() * 100,
      }
      m.position.y = 0.4
      this.scene.add(m)
      this.packets.push(m)
    }
  }

  private makeBuilding(body: number, w: number, h: number, d: number, glow: number): THREE.Group {
    const g = new THREE.Group()
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: body, metalness: 0.6, roughness: 0.35, emissive: glow, emissiveIntensity: 0.06 }),
    )
    g.add(mesh)
    // window strips
    const winMat = new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.55 })
    const rows = Math.max(2, Math.floor(h / 1.6))
    for (let r = 0; r < rows; r++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w * 1.01, 0.18, d * 1.01), winMat)
      strip.position.y = -h / 2 + 1 + r * (h / rows)
      g.add(strip)
    }
    g.userData = { mesh, glow, base: 0.06 }
    return g
  }

  /** Fly the camera to a named preset. */
  goTo(preset: string, duration = 1.6) {
    const p = PRESETS[preset] ?? PRESETS.orbit
    gsap.to(this.camera.position, { x: p.pos[0], y: p.pos[1], z: p.pos[2], duration, ease: 'power2.inOut' })
    gsap.to(this.lookTarget, { x: p.look[0], y: p.look[1], z: p.look[2], duration, ease: 'power2.inOut' })
  }

  /** Pulse the hero glow + lift the spotlighted building. */
  spotlight(on: boolean) {
    gsap.to(this.heroGlow, { intensity: on ? 2.4 : 0, duration: 1.2, ease: 'power2.out' })
    const hero = this.buildings[0]?.userData as { mesh: THREE.Mesh } | undefined
    if (hero?.mesh) {
      const mat = hero.mesh.material as THREE.MeshStandardMaterial
      gsap.to(mat, { emissiveIntensity: on ? 0.5 : 0.06, duration: 1.2 })
    }
  }

  /** Switch the whole city's visual treatment: normal / xray (wireframe) / paint. */
  setEffect(effect: 'normal' | 'xray' | 'paint' = 'normal') {
    this.buildings.forEach(b => {
      const u = b.userData as { mesh?: THREE.Mesh; base?: number }
      if (!u.mesh) return
      const mat = u.mesh.material as THREE.MeshStandardMaterial
      if (effect === 'xray') {
        mat.wireframe = true
        gsap.to(mat, { emissiveIntensity: 0.22, duration: 0.8, ease: 'power2.out' })
      } else if (effect === 'paint') {
        mat.wireframe = false
        gsap.to(mat, { emissiveIntensity: 0.55, duration: 1.0, ease: 'power2.out' })
      } else {
        mat.wireframe = false
        gsap.to(mat, { emissiveIntensity: u.base ?? 0.06, duration: 0.8, ease: 'power2.out' })
      }
    })
  }

  /** Fire a bright packet burst from the hero building (interactive feedback). */
  pulse() {
    this.packets.forEach((m, i) => {
      gsap.fromTo((m.material as THREE.MeshBasicMaterial),
        { opacity: 1 },
        { opacity: 0.4, duration: 0.6, delay: i * 0.02, yoyo: true, repeat: 1 })
      gsap.to(m.scale, { x: 2, y: 2, z: 2, duration: 0.3, delay: i * 0.02, yoyo: true, repeat: 1, ease: 'power2.out' })
    })
    gsap.fromTo(this.heroGlow, { intensity: 4 }, { intensity: 2.4, duration: 0.8 })
  }

  private animate() {
    if (this.disposed) return
    const t = performance.now() / 1000
    // drift packets along their lanes
    this.packets.forEach(m => {
      const u = m.userData as { axis: string; lane: number; speed: number }
      if (u.axis === 'x') {
        m.position.x += u.speed
        m.position.z = u.lane - 6
        if (m.position.x > 50) m.position.x = -50
        if (m.position.x < -50) m.position.x = 50
      } else {
        m.position.z += u.speed
        m.position.x = u.lane
        if (m.position.z > 50) m.position.z = -50
        if (m.position.z < -50) m.position.z = 50
      }
    })
    // gentle window shimmer
    this.buildings.forEach((b, i) => {
      const u = b.userData as { mesh?: THREE.Mesh }
      void u; void i; void t
    })
    this.camera.lookAt(this.lookTarget)
    this.renderer.render(this.scene, this.camera)
    this.raf = requestAnimationFrame(this.animate)
  }

  resize() {
    const canvas = this.renderer.domElement
    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight
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
