// "Daybreak" — the light cinematic sky the camera flies through. Soft volumetric
// cloud sprites at varied depth, faceted daylight crystals catching light, drifting
// pollen, and gentle god-ray streaks. Parallaxes against the camera focus point.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

function softSprite(inner: string, outer: string): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, inner)
  grd.addColorStop(1, outer)
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  return t
}

export default function SkyScene({ focusRef, dark }: { focusRef: React.MutableRefObject<{ x: number; y: number }>; dark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number>(0)
  const darkRef = useRef(dark)
  darkRef.current = dark

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    let w = window.innerWidth, h = window.innerHeight
    renderer.setSize(w, h)

    const mobile = w < 820
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(58, w / h, 0.1, 200)
    camera.position.z = mobile ? 24 : 18

    // ── clouds: soft sprite planes at varied depth ──
    const cloudTex = softSprite('rgba(255,255,255,0.95)', 'rgba(255,255,255,0)')
    const clouds: THREE.Sprite[] = []
    for (let i = 0; i < (mobile ? 9 : 16); i++) {
      const op = 0.5 + Math.random() * 0.3
      const m = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: op, depthWrite: false })
      const s = new THREE.Sprite(m)
      s.userData.op = op
      const z = -10 - Math.random() * 26
      s.position.set((Math.random() - 0.5) * 70, (Math.random() - 0.5) * 40, z)
      const sc = 14 + Math.random() * 22
      s.scale.set(sc, sc * 0.62, 1)
      scene.add(s); clouds.push(s)
    }

    // ── god-ray streaks (additive, subtle) ──
    const rayTex = softSprite('rgba(255,247,224,0.7)', 'rgba(255,247,224,0)')
    const rays: THREE.Sprite[] = []
    for (let i = 0; i < 4; i++) {
      const m = new THREE.SpriteMaterial({ map: rayTex, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })
      const s = new THREE.Sprite(m)
      s.position.set((i - 1.5) * 16, 6, -20)
      s.scale.set(8, 60, 1)
      s.material.rotation = -0.3 + i * 0.12
      scene.add(s); rays.push(s)
    }

    // ── faceted daylight crystals ──
    const crystals: THREE.Mesh[] = []
    const geo = new THREE.OctahedronGeometry(1, 0)
    const cols = [0xc4b5fd, 0xa5d8ff, 0xb2f2bb, 0xffd8a8, 0xffc9c9, 0x99e9f2]
    const crystalN = mobile ? 12 : 26
    const crystalMax = mobile ? 0.8 : 1.25
    for (let i = 0; i < crystalN; i++) {
      const col = cols[i % cols.length]
      const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0, metalness: 0.45, roughness: 0.15, transparent: true, opacity: 0.72, flatShading: true })
      const m = new THREE.Mesh(geo, mat)
      m.position.set((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 18 - 4)
      m.scale.setScalar(0.3 + Math.random() * crystalMax)
      scene.add(m); crystals.push(m)
    }

    // ── pollen drifting up ──
    const pc = 280
    const pp = new Float32Array(pc * 3)
    for (let i = 0; i < pc; i++) { pp[i * 3] = (Math.random() - 0.5) * 60; pp[i * 3 + 1] = (Math.random() - 0.5) * 40; pp[i * 3 + 2] = (Math.random() - 0.5) * 20 - 4 }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3))
    const pollen = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xfff4d6, size: 0.12, transparent: true, opacity: 0.7, depthWrite: false }))
    scene.add(pollen)

    const amb = new THREE.AmbientLight(0xffffff, 0.85); scene.add(amb)
    const sun = new THREE.DirectionalLight(0xfff2d0, 1.5); sun.position.set(-6, 10, 8); scene.add(sun)
    const fill = new THREE.DirectionalLight(0xc4b5fd, 0.6); fill.position.set(8, -4, 6); scene.add(fill)

    let start: number | null = null
    const animate = (time: number) => {
      if (!start) start = time
      const t = (time - start) / 1000
      crystals.forEach((g, i) => {
        g.rotation.x = t * 0.3 + i
        g.rotation.y = t * 0.22 + i * 0.7
        g.position.y += Math.sin(t * 0.4 + i) * 0.005
      })
      clouds.forEach((s, i) => { s.position.x += 0.004 + (i % 3) * 0.002; if (s.position.x > 40) s.position.x = -40 })
      const arr = pollen.geometry.attributes.position.array as Float32Array
      for (let i = 0; i < pc; i++) { arr[i * 3 + 1] += 0.01; if (arr[i * 3 + 1] > 20) arr[i * 3 + 1] = -20 }
      pollen.geometry.attributes.position.needsUpdate = true
      rays.forEach((s, i) => { s.material.opacity = 0.14 + 0.06 * Math.sin(t * 0.4 + i) })

      // night: dim clouds, light up the crystals like jewels
      const d = darkRef.current
      amb.intensity += ((d ? 0.55 : 0.85) - amb.intensity) * 0.05
      sun.intensity += ((d ? 1.0 : 1.5) - sun.intensity) * 0.05
      crystals.forEach(g => {
        const m = g.material as THREE.MeshStandardMaterial
        m.emissiveIntensity += ((d ? 0.62 : 0) - m.emissiveIntensity) * 0.06
        m.opacity += ((d ? 0.9 : 0.72) - m.opacity) * 0.06
      })
      clouds.forEach(s => {
        const base = (s.userData.op as number) ?? 0.6
        s.material.opacity += ((d ? base * 0.28 : base) - s.material.opacity) * 0.06
      })

      const f = focusRef.current
      camera.position.x += (f.x * 0.0014 - camera.position.x) * 0.04
      camera.position.y += (-f.y * 0.0014 - camera.position.y) * 0.04
      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)
      frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)

    const onResize = () => {
      w = window.innerWidth; h = window.innerHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      scene.clear()
    }
  }, [focusRef])

  return <canvas ref={canvasRef} className="cosmos-canvas" aria-hidden />
}
