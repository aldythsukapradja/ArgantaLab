// "Daybreak" — a clean cinematic sky. A few large faceted gems drift around the
// periphery (never behind the hero text), over soft depth clouds. Light mode reads
// as calm premium whitespace; dark mode lets the gems glow like jewels.
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
  return new THREE.CanvasTexture(c)
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
    camera.position.z = mobile ? 26 : 20

    // ── soft depth clouds (few, gentle — never grey smudges) ──
    const cloudTex = softSprite('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)')
    const clouds: THREE.Sprite[] = []
    for (let i = 0; i < (mobile ? 4 : 7); i++) {
      const op = 0.22 + Math.random() * 0.16
      const m = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: op, depthWrite: false })
      const s = new THREE.Sprite(m)
      s.userData.op = op
      s.position.set((Math.random() - 0.5) * 78, (Math.random() - 0.5) * 46, -16 - Math.random() * 20)
      const sc = 22 + Math.random() * 26
      s.scale.set(sc, sc * 0.6, 1)
      scene.add(s); clouds.push(s)
    }

    // ── faceted gems, biased to the PERIPHERY so the centre stays clean ──
    const crystals: THREE.Mesh[] = []
    const geo = new THREE.OctahedronGeometry(1, 0)
    const cols = [0xa78bfa, 0x60a5fa, 0x34d399, 0xfbbf24, 0xf472b6, 0x22d3ee]
    const n = mobile ? 7 : 12
    for (let i = 0; i < n; i++) {
      const col = cols[i % cols.length]
      const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0, metalness: 0.35, roughness: 0.18, transparent: true, opacity: 0.82, flatShading: true })
      const m = new THREE.Mesh(geo, mat)
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.6
      const rad = (mobile ? 16 : 17) + Math.random() * (mobile ? 8 : 13)
      m.position.set(Math.cos(ang) * rad, Math.sin(ang) * rad * 0.72, (Math.random() - 0.5) * 14 - 3)
      m.scale.setScalar((mobile ? 0.7 : 0.9) + Math.random() * (mobile ? 0.8 : 1.4))
      m.userData.spin = 0.15 + Math.random() * 0.25
      scene.add(m); crystals.push(m)
    }

    const amb = new THREE.AmbientLight(0xffffff, 0.9); scene.add(amb)
    const sun = new THREE.DirectionalLight(0xfff2d0, 1.4); sun.position.set(-6, 10, 8); scene.add(sun)
    const fill = new THREE.DirectionalLight(0xc4b5fd, 0.7); fill.position.set(8, -4, 6); scene.add(fill)

    let start: number | null = null
    const animate = (time: number) => {
      if (!start) start = time
      const t = (time - start) / 1000
      const d = darkRef.current
      crystals.forEach((g, i) => {
        const sp = g.userData.spin as number
        g.rotation.x = t * sp + i
        g.rotation.y = t * sp * 0.8 + i * 0.7
        g.position.y += Math.sin(t * 0.35 + i) * 0.004
        const m = g.material as THREE.MeshStandardMaterial
        m.emissiveIntensity += ((d ? 0.6 : 0) - m.emissiveIntensity) * 0.05
        m.opacity += ((d ? 0.92 : 0.8) - m.opacity) * 0.05
      })
      clouds.forEach((s, i) => {
        s.position.x += 0.003 + (i % 3) * 0.0015
        if (s.position.x > 44) s.position.x = -44
        const base = s.userData.op as number
        s.material.opacity += ((d ? base * 0.5 : base) - s.material.opacity) * 0.05
      })
      amb.intensity += ((d ? 0.6 : 0.9) - amb.intensity) * 0.05
      sun.intensity += ((d ? 1.0 : 1.4) - sun.intensity) * 0.05

      const f = focusRef.current
      camera.position.x += (f.x * 0.0013 - camera.position.x) * 0.04
      camera.position.y += (-f.y * 0.0013 - camera.position.y) * 0.04
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
