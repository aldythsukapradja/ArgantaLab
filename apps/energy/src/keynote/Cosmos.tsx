// The deck's sky — one persistent backdrop behind all nine scenes.
//
// Mounted ONCE in KeynoteSurface, outside the keyed stage, for two reasons that
// are not cosmetic:
//   1. Continuity. A backdrop that remounts per slide flashes on every advance,
//      and the deck stops feeling like one continuous space.
//   2. GL budget. Ten canvases would exhaust the browser's context limit; the
//      scene-level ParticleField already spends one.
//
// The galaxy spiral that used to be the default is GONE. On the wall its bright
// core cut straight through "Nearly the entire upstream lifecycle" — a backdrop
// with a hot centre will always fight a centred headline. Everything here now
// obeys one rule: THE UPPER HALF OF THE FRAME STAYS QUIET, because that is
// where every scene puts its type.
//
//   terrain   ridgelines running to a horizon at ~46% height, scrolling toward
//             the viewer. Geological, and structurally incapable of crossing a
//             headline. The default.
//   nebula    dust sheets, weighted low and dim.
//   deepfield sparse stars only. The quietest fallback.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { prefersReducedMotion } from './timeline';

export type CosmosVariant = 'terrain' | 'nebula' | 'deepfield';
export const COSMOS_VARIANTS: CosmosVariant[] = ['terrain', 'nebula', 'deepfield'];

/** Soft round sprite. Without it, GL points render as hard squares — the single
 *  giveaway that separates "stars" from "particles". */
function dotTexture(): THREE.Texture {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

/* ── terrain ────────────────────────────────────────────────────────────────
   Ridged fractal height from summed sines. No noise library, fully
   deterministic, and `ridge()` — folding the wave at zero — is what turns
   rolling dunes into the sharp crests a geologist reads as structure. */
const ridge = (v: number) => 1 - Math.abs(v);

/** Smoothstep, clamped. Used for the terrain's edge falloff: a linear ramp
 *  still leaves a perceptible line where it starts, this does not. */
function smooth(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function height(x: number, z: number): number {
  let h = 0, amp = 1, fx = 0.019, sum = 0;
  for (let o = 0; o < 5; o += 1) {
    h += amp * ridge(Math.sin(x * fx + z * fx * 0.62) * Math.cos(z * fx * 1.13 - x * fx * 0.37));
    sum += amp;
    amp *= 0.47;
    fx *= 2.07;
  }
  h /= sum;
  // A gentle valley down the middle so the centre of frame — where a centred
  // punchline lands — is the LOWEST part of the range, not a peak.
  const valley = Math.min(1, (Math.abs(x) / 120) ** 1.6);
  return h * h * 30 * (0.25 + 0.75 * valley);
}

const COLD = new THREE.Color('#2C4C7A');
const WARM = new THREE.Color('#C9A25B');

interface Backdrop {
  object: THREE.Object3D;
  /** Advances the backdrop; `t` is seconds. */
  step: (t: number) => void;
  dispose: () => void;
}

function buildTerrain(): Backdrop {
  const COLS = 150, ROWS = 96, W = 460, D = 300;
  const group = new THREE.Group();

  const pos = new Float32Array(COLS * ROWS * 3);
  const col = new Float32Array(COLS * ROWS * 3);
  const grid = (r: number, c: number) => (r * COLS + c);
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const i = grid(r, c) * 3;
      pos[i] = (c / (COLS - 1) - 0.5) * W;
      pos[i + 1] = 0;
      pos[i + 2] = (r / (ROWS - 1) - 0.5) * D;
    }
  }

  // Wireframe: row-wise contour lines only. Full quads read as a fishnet; a
  // contour map is what this audience already knows how to read.
  const idx: number[] = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS - 1; c += 1) { idx.push(grid(r, c), grid(r, c + 1)); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  group.add(lines);

  // Crest motes: the same vertices, drawn only where the ridge is high.
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.42, vertexColors: true, transparent: true, opacity: 0.26,
    map: dotTexture(), blending: THREE.AdditiveBlending,
    depthWrite: false, sizeAttenuation: true,
  }));
  group.add(pts);

  const c = new THREE.Color();
  const step = (t: number) => {
    // Scroll the SAMPLE, not the mesh: the terrain runs forever without any
    // seam to hide and without touching the index buffer.
    const off = t * 1.9;
    const p = geo.attributes.position as THREE.BufferAttribute;
    const k = geo.attributes.color as THREE.BufferAttribute;
    for (let r = 0; r < ROWS; r += 1) {
      for (let cc = 0; cc < COLS; cc += 1) {
        const i = grid(r, cc);
        const x = p.array[i * 3] as number;
        const z = (p.array[i * 3 + 2] as number) + off;
        const h = height(x, z);
        (p.array as Float32Array)[i * 3 + 1] = h;
        // Warm on the crests, cold in the troughs — one lit ridge system.
        c.copy(COLD).lerp(WARM, Math.min(1, h / 22));
        // smoothstep on all four edges, to zero. Anything that bottoms out
        // above zero leaves a visible rectangle where the mesh stops.
        const near = r / (ROWS - 1);               // 0 far, 1 near
        const side = Math.abs(cc / (COLS - 1) - 0.5) * 2;   // 0 centre, 1 edge
        const f = smooth(near / 0.34) * smooth((1 - side) / 0.42) * (0.15 + 0.85 * near);
        (k.array as Float32Array)[i * 3] = c.r * f;
        (k.array as Float32Array)[i * 3 + 1] = c.g * f;
        (k.array as Float32Array)[i * 3 + 2] = c.b * f;
      }
    }
    p.needsUpdate = true;
    k.needsUpdate = true;
  };
  step(0);

  return {
    object: group,
    step,
    dispose: () => {
      geo.dispose();
      (pts.material as THREE.PointsMaterial).map?.dispose();
      (pts.material as THREE.Material).dispose();
      (lines.material as THREE.Material).dispose();
    },
  };
}

/** Stars above the horizon. Sparse and dim on purpose — they exist to stop the
 *  upper frame being dead black, not to be looked at. */
function buildStars(count: number, spread: number, lift: number): THREE.Points {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i += 1) {
    pos[i * 3] = (Math.random() - 0.5) * spread;
    pos[i * 3 + 1] = lift + Math.random() * spread * 0.42;
    pos[i * 3 + 2] = -Math.random() * spread * 0.8;
    c.setRGB(1, 1, 1).multiplyScalar(0.35 + Math.random() * 0.55);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    size: 1.15, vertexColors: true, transparent: true, opacity: 0.65,
    map: dotTexture(), blending: THREE.AdditiveBlending, depthWrite: false,
  }));
}

function buildDust(count: number, weightLow: boolean): Backdrop {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i += 1) {
    const gx = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    const gy = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    pos[i * 3] = gx * 170;
    // Weighted into the lower frame, away from the type.
    pos[i * 3 + 1] = weightLow ? -34 + gy * 52 : gy * 96;
    pos[i * 3 + 2] = -Math.random() * 150;
    c.copy(COLD).lerp(WARM, Math.random() * 0.5).multiplyScalar(0.5 + Math.random() * 0.5);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const p = new THREE.Points(geo, new THREE.PointsMaterial({
    size: weightLow ? 3 : 1.7, vertexColors: true, transparent: true,
    opacity: weightLow ? 0.42 : 0.72, map: dotTexture(),
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  return {
    object: p,
    step: (t: number) => { p.rotation.y = t * 0.012; p.position.x = Math.sin(t * 0.16) * 8; },
    dispose: () => {
      geo.dispose();
      (p.material as THREE.PointsMaterial).map?.dispose();
      (p.material as THREE.Material).dispose();
    },
  };
}

export function Cosmos({ variant = 'terrain' }: { variant?: CosmosVariant }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    const scene = new THREE.Scene();
    // Fog does the heavy lifting: the far ridges dissolve into the deck's own
    // background instead of ending on a visible edge.
    scene.fog = new THREE.Fog(0x000000, 70, 230);
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 900);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // Gentler than the scene-level field: this sits behind type for nine slides
    // and a hot backdrop haloes every headline.
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 1.1, 0.08));
    composer.addPass(new OutputPass());

    const back: Backdrop = variant === 'terrain' ? buildTerrain()
      : buildDust(variant === 'nebula' ? 5200 : 3400, variant === 'nebula');
    scene.add(back.object);

    let stars: THREE.Points | null = null;
    if (variant === 'terrain') {
      stars = buildStars(1400, 520, 30);
      scene.add(stars);
      // Camera sits above the ridges looking slightly DOWN, which puts the
      // horizon at roughly 46% of frame height. Everything above it is sky, so
      // a headline can never land on a ridgeline.
      camera.position.set(0, 26, 118);
      camera.rotation.x = -0.13;
    } else {
      camera.position.set(0, 0, 120);
    }

    const resize = () => {
      const w = el.clientWidth || 1, h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const reduced = prefersReducedMotion();
    let raf = 0;
    const born = performance.now();
    const tick = () => {
      const t = (performance.now() - born) / 1000;
      back.step(t);
      // A breath of sway. Small enough that nobody consciously sees it; without
      // it the backdrop is wallpaper.
      camera.position.x = Math.sin(t * 0.15) * 5;
      composer.render();
      raf = requestAnimationFrame(tick);
    };
    if (reduced) { back.step(0); composer.render(); } else tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      back.dispose();
      if (stars) {
        stars.geometry.dispose();
        (stars.material as THREE.PointsMaterial).map?.dispose();
        (stars.material as THREE.Material).dispose();
      }
      composer.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [variant]);

  return <div className="kn-cosmos" ref={host} aria-hidden />;
}
