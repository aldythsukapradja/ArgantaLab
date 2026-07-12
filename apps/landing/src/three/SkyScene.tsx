// The flight-deck backdrop — the SAME per-pixel shader nebula as the tab shell
// (nebulaShader.ts), so the whole site reads as one background system. This
// replaces the old flat-shaded "gem" octahedrons + cloud sprites, which read as
// cartoonish confetti floating over the premium glass-card scenes. The camera's
// focus point (focusRef, driven by the flight's world-space position) gently
// parallaxes the nebula instead of a real mouse — the scene still feels alive
// as you fly between lanes, without anything ever looking stretched or pixelated.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { NEBULA_VERT, NEBULA_FRAG } from './nebulaShader'

export default function SkyScene({ focusRef, dark }: { focusRef: React.MutableRefObject<{ x: number; y: number }>; dark: boolean }) {
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
      uStars: { value: 0.7 },   // slightly calmer than the hub — real UI sits on top here
    }
    const scene = new THREE.Scene()
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ vertexShader: NEBULA_VERT, fragmentShader: NEBULA_FRAG, uniforms, depthTest: false, depthWrite: false }),
    )
    scene.add(quad)

    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

    let frame = 0
    let running = false
    const draw = (time: number) => {
      uniforms.uTime.value = time / 1000
      uniforms.uDark.value += ((darkRef.current ? 1 : 0) - uniforms.uDark.value) * 0.05
      const f = focusRef.current
      const tx = clamp(f.x / 20000, -0.5, 0.5)
      const ty = clamp(-f.y / 10000, -0.5, 0.5)
      uniforms.uMouse.value.x += (tx - uniforms.uMouse.value.x) * 0.03
      uniforms.uMouse.value.y += (ty - uniforms.uMouse.value.y) * 0.03
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
      quad.geometry.dispose(); (quad.material as THREE.Material).dispose(); renderer.dispose()
    }
  }, [focusRef])

  return <canvas ref={canvasRef} className="cosmos-canvas" aria-hidden />
}
