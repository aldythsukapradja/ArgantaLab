// A clean, premium backdrop for the launcher.
//  · dark: an elegant slow starfield galaxy + one soft single-hue glow.
//  · light: near-empty — stars hidden (they'd read as grain on paper), just a very
//    faint violet glow for depth. Restraint over decoration. No muddy colour mixing.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

function glowTex(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 200
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(100, 100, 0, 100, 100, 100)
  grd.addColorStop(0, 'rgba(140,110,240,0.9)')
  grd.addColorStop(1, 'rgba(140,110,240,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 200, 200)
  return new THREE.CanvasTexture(c)
}

export default function HubBg({ dark }: { dark: boolean }) {
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

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(62, w / h, 0.1, 100)
    camera.position.z = 20

    // ── starfield galaxy (two layers for depth) ──
    const stars: THREE.Points[] = []
    for (let layer = 0; layer < 2; layer++) {
      const n = layer ? 260 : 520
      const pos = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 70
        pos[i * 3 + 1] = (Math.random() - 0.5) * 46
        pos[i * 3 + 2] = (Math.random() - 0.5) * 24 - (layer ? 4 : 12)
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      const mat = new THREE.PointsMaterial({ color: layer ? 0xe6ecff : 0xc9d4ff, size: layer ? 0.13 : 0.08, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true })
      const p = new THREE.Points(geo, mat)
      scene.add(p); stars.push(p)
    }

    // ── one soft single-hue glow, off-centre, for depth ──
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, opacity: 0.1, depthWrite: false }))
    glow.position.set(11, 7, -8)
    glow.scale.set(40, 40, 1)
    scene.add(glow)
    const glow2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, opacity: 0.06, depthWrite: false }))
    glow2.position.set(-13, -9, -10)
    glow2.scale.set(46, 46, 1)
    scene.add(glow2)

    const mouse = { x: 0, y: 0 }
    const onMove = (e: MouseEvent) => { mouse.x = e.clientX / window.innerWidth - 0.5; mouse.y = e.clientY / window.innerHeight - 0.5 }
    window.addEventListener('mousemove', onMove)

    let startT: number | null = null
    const animate = (time: number) => {
      if (startT === null) startT = time
      const t = (time - startT) / 1000
      const d = darkRef.current
      stars.forEach((p, i) => {
        p.rotation.y = t * (i ? 0.006 : 0.01)
        const m = p.material as THREE.PointsMaterial
        m.opacity += ((d ? (i ? 0.9 : 0.6) : 0) - m.opacity) * 0.04
      })
      ;(glow.material as THREE.SpriteMaterial).opacity += ((d ? 0.16 : 0.05) - (glow.material as THREE.SpriteMaterial).opacity) * 0.04
      ;(glow2.material as THREE.SpriteMaterial).opacity += ((d ? 0.1 : 0.035) - (glow2.material as THREE.SpriteMaterial).opacity) * 0.04
      camera.position.x += (mouse.x * 2.4 - camera.position.x) * 0.03
      camera.position.y += (-mouse.y * 2.4 - camera.position.y) * 0.03
      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)
      frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)

    const onResize = () => { w = window.innerWidth; h = window.innerHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix() }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMove)
      renderer.dispose(); scene.clear()
    }
  }, [])

  return <canvas ref={canvasRef} className="hubbg-canvas" aria-hidden />
}
