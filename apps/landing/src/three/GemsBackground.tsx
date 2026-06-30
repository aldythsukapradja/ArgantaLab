// The REAL ArgantaLab floating background (the `arganta` config from
// apps/web/src/components/three/BackgroundScene.tsx): 28 octahedron gems drifting
// in violet ambient + blue directional light. Here it's the persistent cosmos the
// camera flies through — it parallaxes against the camera's focus point.

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function GemsBackground({ focusRef }: { focusRef: React.MutableRefObject<{ x: number; y: number }> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    let w = window.innerWidth, h = window.innerHeight
    renderer.setSize(w, h)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 100)
    camera.position.z = 16

    // ── the real `arganta` gem field ──
    const gems: THREE.Mesh[] = []
    const geo = new THREE.OctahedronGeometry(1, 0)
    const cols = [0x4d9fff, 0x8b5cf6, 0xff5ea0, 0x3de08a, 0x34e5ff]
    for (let i = 0; i < 34; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: cols[i % cols.length], metalness: 0.6, roughness: 0.2, transparent: true, opacity: 0.65 })
      const m = new THREE.Mesh(geo, mat)
      m.position.set((Math.random() - 0.5) * 34, (Math.random() - 0.5) * 22, (Math.random() - 0.5) * 16 - 4)
      m.scale.setScalar(0.3 + Math.random() * 1.3)
      scene.add(m)
      gems.push(m)
    }
    // faint star dust behind the gems for depth
    const starCnt = 600
    const sPos = new Float32Array(starCnt * 3)
    for (let i = 0; i < starCnt; i++) { sPos[i * 3] = (Math.random() - 0.5) * 60; sPos[i * 3 + 1] = (Math.random() - 0.5) * 40; sPos[i * 3 + 2] = (Math.random() - 0.5) * 20 - 16 }
    const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3))
    const stars = new THREE.Points(sGeo, new THREE.PointsMaterial({ color: 0xbcd2ff, size: 0.08, transparent: true, opacity: 0.5 }))
    scene.add(stars)

    scene.add(new THREE.AmbientLight(0x8b5cf6, 0.55))
    const dl = new THREE.DirectionalLight(0x4d9fff, 1.9); dl.position.set(5, 10, 5); scene.add(dl)

    let start: number | null = null
    const animate = (time: number) => {
      if (!start) start = time
      const t = (time - start) / 1000
      gems.forEach((g, i) => {
        g.rotation.x = t * 0.4 + i
        g.rotation.y = t * 0.3 + i * 0.7
        g.position.y += Math.sin(t * 0.5 + i) * 0.006
      })
      stars.rotation.y = t * 0.01
      // parallax: drift the whole cosmos opposite the camera focus, slowly
      const f = focusRef.current
      camera.position.x += (f.x * 0.0016 - camera.position.x) * 0.04
      camera.position.y += (-f.y * 0.0016 - camera.position.y) * 0.04
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
