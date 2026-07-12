// The launcher backdrop — a fullscreen fragment-shader nebula. Everything is
// computed PER PIXEL at native resolution (no stretched textures — the old
// sprite-glow banded/pixelated on mobile because a 200px radial texture was
// blown across the whole screen). A tiny in-shader dither kills 8-bit banding
// outright, at any DPR.
//  · dark: deep-space indigo, domain-warped violet/cyan nebula, twinkling
//    hash-grid stars (sharper than the old point cloud), soft vignette.
//  · light: Daybreak — near-white with faint analytic violet/cyan washes.
// Battery-aware: pauses on hidden tabs; renders a single static frame under
// prefers-reduced-motion.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const VERT = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime; uniform vec2 uRes; uniform float uDark; uniform vec2 uMouse;

  float h21(vec2 p){ p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(7.3, 3.1); a *= 0.5; }
    return v;
  }
  // one twinkling star layer on a hash grid — crisp at any DPR
  float stars(vec2 uvPx, float cell, float density, float t){
    vec2 p = uvPx / cell;
    vec2 i = floor(p), f = fract(p) - 0.5;
    float rnd = h21(i);
    if (rnd < 1.0 - density) return 0.0;
    vec2 off = (vec2(h21(i + 1.3), h21(i + 2.7)) - 0.5) * 0.6;
    float d = length(f - off);
    float tw = 0.65 + 0.35 * sin(t * (0.6 + rnd * 2.4) + rnd * 40.0);
    return smoothstep(0.09, 0.0, d) * tw;
  }

  void main(){
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 asp = vec2(uRes.x / uRes.y, 1.0);
    vec2 p = (uv - 0.5) * asp + uMouse * 0.06;
    float t = uTime * 0.018;

    // ── domain-warped nebula (the "fancier" flow) ──
    float q = fbm(p * 1.4 + t);
    float r = fbm(p * 1.4 + q * 1.6 - t * 0.7 + vec2(4.7, 9.2));
    float n = fbm(p * 1.5 + r * 1.8);
    float n2 = fbm(p * 2.1 - r * 1.2 + vec2(11.0, 3.0) + t * 0.5);

    // ── DARK: deep space ──
    vec3 dBase = mix(vec3(0.040, 0.038, 0.095), vec3(0.078, 0.070, 0.190), smoothstep(0.0, 1.0, 1.0 - uv.y));
    vec3 violet = vec3(0.545, 0.361, 0.965);
    vec3 cyan   = vec3(0.290, 0.760, 0.965);
    vec3 dark = dBase;
    dark += violet * smoothstep(0.48, 0.92, n)  * 0.230;
    dark += cyan   * smoothstep(0.55, 0.95, n2) * 0.115;
    dark += violet * smoothstep(0.72, 1.00, n * n2 * 2.2) * 0.10;   // bright seams where clouds cross
    float s = stars(gl_FragCoord.xy, 110.0, 0.10, uTime)
            + stars(gl_FragCoord.xy + 37.0, 55.0, 0.05, uTime * 1.4) * 0.6;
    dark += vec3(0.85, 0.89, 1.0) * s * (0.55 + 0.45 * smoothstep(0.3, 0.7, n));
    float vig = smoothstep(1.25, 0.35, length((uv - 0.5) * asp));
    dark *= mix(0.72, 1.0, vig);

    // ── LIGHT: Daybreak wash ──
    vec3 lBase = mix(vec3(0.984, 0.982, 0.998), vec3(0.955, 0.948, 0.988), uv.y);
    float wa = smoothstep(0.9, 0.0, length((uv - vec2(0.78, 0.80)) * asp));
    float wb = smoothstep(1.0, 0.0, length((uv - vec2(0.16, 0.12)) * asp));
    vec3 light = lBase
      - violet * wa * 0.045
      - cyan   * wb * 0.030
      - violet * smoothstep(0.55, 0.95, n) * 0.018;   // whisper of texture

    vec3 col = mix(light, dark, uDark);
    // in-shader dither — kills 8-bit banding everywhere, doubles as fine grain
    col += (h21(gl_FragCoord.xy + fract(uTime) * 61.7) - 0.5) * (2.4 / 255.0);
    gl_FragColor = vec4(col, 1.0);
  }
`

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
    }
    const scene = new THREE.Scene()
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, depthTest: false, depthWrite: false }),
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

    // paint the first frame synchronously — no black flash, and shader-compile
    // errors surface immediately even when rAF is paused (hidden tabs)
    uniforms.uDark.value = darkRef.current ? 1 : 0
    draw(1200)
    if (!reduced) start()

    // battery: pause when the tab is hidden
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
