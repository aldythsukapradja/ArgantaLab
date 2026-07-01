// A fancy, calm galaxy/aurora backdrop for the launcher: large soft colour clouds
// drifting slowly, plus a faint starfield that fades in only in dark mode. Reads as
// premium colour on light paper, and a glowing nebula at night. No grain.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

function blob(color: string): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 160
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(80, 80, 0, 80, 80, 80)
  grd.addColorStop(0, color)
  grd.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 160, 160)
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
    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100)
    camera.position.z = 20

    const cols = ['rgba(139,92,246,0.9)', 'rgba(6,182,212,0.85)', 'rgba(16,185,129,0.8)', 'rgba(244,114,182,0.8)', 'rgba(96,165,250,0.85)', 'rgba(245,158,11,0.7)']
    const auroras: { s: THREE.Sprite; base: number; sx: number; sy: number }[] = []
    for (let i = 0; i < 6; i++) {
      const m = new THREE.SpriteMaterial({ map: blob(cols[i]), transparent: true, opacity: 0.5, depthWrite: false })
      const s = new THREE.Sprite(m)
      const ang = (i / 6) * Math.PI * 2
      s.position.set(Math.cos(ang) * 14, Math.sin(ang) * 9, -6 - Math.random() * 6)
      const sc = 22 + Math.random() * 16
      s.scale.set(sc, sc, 1)
      scene.add(s)
      auroras.push({ s, base: 0.42 + Math.random() * 0.16, sx: 0.02 + Math.random() * 0.03, sy: 0.015 + Math.random() * 0.02 })
    }

    // faint stars (dark only)
    const sc2 = 420
    const sp = new Float32Array(sc2 * 3)
    for (let i = 0; i < sc2; i++) { sp[i * 3] = (Math.random() - 0.5) * 60; sp[i * 3 + 1] = (Math.random() - 0.5) * 40; sp[i * 3 + 2] = (Math.random() - 0.5) * 20 - 8 }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3))
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 0.09, transparent: true, opacity: 0, depthWrite: false }))
    scene.add(stars)

    const mouse = { x: 0, y: 0 }
    const onMove = (e: MouseEvent) => { mouse.x = (e.clientX / window.innerWidth - 0.5); mouse.y = (e.clientY / window.innerHeight - 0.5) }
    window.addEventListener('mousemove', onMove)

    let start: number | null = null
    const animate = (time: number) => {
      if (!start) start = time
      const t = (time - start) / 1000
      const d = darkRef.current
      auroras.forEach((a, i) => {
        a.s.position.x += Math.sin(t * a.sx + i) * 0.006
        a.s.position.y += Math.cos(t * a.sy + i * 1.3) * 0.005
        a.s.material.opacity += ((d ? a.base * 1.25 : a.base) - a.s.material.opacity) * 0.04
      })
      const sm = stars.material as THREE.PointsMaterial
      sm.opacity += ((d ? 0.6 : 0) - sm.opacity) * 0.04
      stars.rotation.y = t * 0.008
      camera.position.x += (mouse.x * 2 - camera.position.x) * 0.03
      camera.position.y += (-mouse.y * 2 - camera.position.y) * 0.03
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
