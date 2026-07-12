// The launcher backdrop — a fullscreen fragment-shader nebula (shared with
// SkyScene.tsx so the whole site reads as ONE background system). Everything
// is computed per pixel at native resolution — no stretched textures — with
// an in-shader dither so 8-bit banding is impossible at any DPR.
// Battery-aware: pauses on hidden tabs; renders a single static frame under
// prefers-reduced-motion.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { NEBULA_VERT, NEBULA_FRAG } from './nebulaShader'

export default function HubBg({ dark }: { dark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const darkRef = useRef(dark)
  darkRef.current = dark

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    let w = window.innerWidth, h = window.innerHeight
    renderer.setSize(w, h)

    const uniforms = {
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(w * renderer.getPixelRatio(), h * renderer.getPixelRatio()) },
      uDark: { value: darkRef.current ? 1 : 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uStars: { value: 1 },
    }
    const scene = new THREE.Scene()
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ vertexShader: NEBULA_VERT, fragmentShader: NEBULA_FRAG, uniforms, depthTest: false, depthWrite: false }),
    )
    scene.add(quad)

    const mouse = { x: 0, y: 0 }
    const onMove = (e: MouseEvent) => { mouse.x = e.clientX / window.innerWidth - 0.5; mouse.y = 0.5 - e.clientY / window.innerHeight }
    window.addEventListener('mousemove', onMove)

    let frame = 0
    let running = false
    const draw = (time: number) => {
      uniforms.uTime.value = time / 1000
      uniforms.uDark.value += ((darkRef.current ? 1 : 0) - uniforms.uDark.value) * 0.05
      uniforms.uMouse.value.x += (mouse.x - uniforms.uMouse.value.x) * 0.04
      uniforms.uMouse.value.y += (mouse.y - uniforms.uMouse.value.y) * 0.04
      renderer.render(scene, cam)
      if (running) frame = requestAnimationFrame(draw)
    }
    const start = () => { if (!running && !reduced) { running = true; frame = requestAnimationFrame(draw) } }
    const stop = () => { running = false; cancelAnimationFrame(frame) }

    uniforms.uDark.value = darkRef.current ? 1 : 0
    draw(1200)
    if (!reduced) start()

    const onVis = () => (document.visibilityState === 'hidden' ? stop() : start())
    document.addEventListener('visibilitychange', onVis)

    const onResize = () => {
      w = window.innerWidth; h = window.innerHeight
      renderer.setSize(w, h)
      uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio())
      if (reduced) draw(1200)
    }
    window.addEventListener('resize', onResize)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMove)
      quad.geometry.dispose(); (quad.material as THREE.Material).dispose(); renderer.dispose()
    }
  }, [])

  return <canvas ref={canvasRef} className="hubbg-canvas" aria-hidden />
}
