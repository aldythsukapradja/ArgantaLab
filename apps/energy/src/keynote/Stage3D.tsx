// The three.js stage — where "cinematic" actually comes from.
//
// Nothing reads as filmic without light bleed, so every scene that uses this
// runs through UnrealBloomPass. v1 had none, which is the single biggest reason
// it looked like a website rather than a film.
//
// One renderer, one composer, reused across scenes. Ten canvases would exhaust
// the browser's GL context budget.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { prefersReducedMotion } from './timeline';

export type FieldMode = 'connected' | 'breaking' | 'reforming';

/** A field of glowing motes with links between them — the archive (slide 4) and
 *  its healing (slide 5) are the same object in two states, which is the point:
 *  the audience should recognise what came apart. */
export function ParticleField({
  mode, accent = '#69D6FF', count = 1400,
}: { mode: FieldMode; accent?: string; count?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 200);
    camera.position.z = 34;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // strength / radius / threshold — tuned so points bloom but lines stay crisp.
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.15, 0.62, 0.02);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    // ── the motes ──────────────────────────────────────────────────────────
    const home = new Float32Array(count * 3);
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      // A slab, not a sphere — it reads as an archive rather than a nebula.
      const x = (Math.random() - 0.5) * 46;
      const y = (Math.random() - 0.5) * 24;
      const z = (Math.random() - 0.5) * 16;
      home[i * 3] = x; home[i * 3 + 1] = y; home[i * 3 + 2] = z;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: new THREE.Color(accent), size: 0.26,
      transparent: true, opacity: 0.92,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    // ── the links ──────────────────────────────────────────────────────────
    // Only near neighbours, capped — a fully connected graph is visual mud.
    const pairs: [number, number][] = [];
    for (let i = 0; i < count && pairs.length < 900; i += 7) {
      for (let j = i + 1; j < Math.min(i + 40, count); j += 11) {
        const dx = home[i * 3] - home[j * 3];
        const dy = home[i * 3 + 1] - home[j * 3 + 1];
        const dz = home[i * 3 + 2] - home[j * 3 + 2];
        if (dx * dx + dy * dy + dz * dz < 26) pairs.push([i, j]);
      }
    }
    const linePos = new Float32Array(pairs.length * 6);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(accent), transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lines);

    const resize = () => {
      const w = el.clientWidth || 1, h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      bloom.resolution.set(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el);

    // ── the loop ───────────────────────────────────────────────────────────
    let raf = 0, t = 0, dispersion = 0;
    const reduced = prefersReducedMotion();
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const lineAttr = lineGeo.getAttribute('position') as THREE.BufferAttribute;

    const tick = () => {
      t += reduced ? 0 : 0.0042;
      const m = modeRef.current;

      // `breaking` pushes dispersion toward 1 and it never fully recovers on
      // slide 4 — the archive does not come back. `reforming` pulls it home.
      const target = m === 'breaking' ? 1 : 0;
      dispersion += (target - dispersion) * (m === 'reforming' ? 0.014 : 0.006);

      for (let i = 0; i < count; i += 1) {
        const k = i * 3;
        if (m === 'breaking' && dispersion < 0.98 && vel[k] === 0) {
          vel[k] = (Math.random() - 0.5) * 0.09;
          vel[k + 1] = (Math.random() - 0.5) * 0.06;
          vel[k + 2] = (Math.random() - 0.5) * 0.05;
        }
        const drift = Math.sin(t * 1.6 + i * 0.21) * 0.16;
        pos[k] = home[k] + vel[k] * dispersion * 120 + drift;
        pos[k + 1] = home[k + 1] + vel[k + 1] * dispersion * 120 + Math.cos(t * 1.3 + i * 0.17) * 0.14;
        pos[k + 2] = home[k + 2] + vel[k + 2] * dispersion * 120;
      }
      posAttr.needsUpdate = true;

      // Links fade as the field disperses — the connections are what is lost.
      lineMat.opacity = 0.16 * (1 - dispersion) ** 2;
      if (lineMat.opacity > 0.005) {
        pairs.forEach(([a, b], n) => {
          const o = n * 6;
          linePos[o] = pos[a * 3]; linePos[o + 1] = pos[a * 3 + 1]; linePos[o + 2] = pos[a * 3 + 2];
          linePos[o + 3] = pos[b * 3]; linePos[o + 4] = pos[b * 3 + 1]; linePos[o + 5] = pos[b * 3 + 2];
        });
        lineAttr.needsUpdate = true;
      }

      // Slow parallax rotation gives the field depth the eye can read.
      points.rotation.y = lines.rotation.y = Math.sin(t * 0.5) * 0.12;
      points.rotation.x = lines.rotation.x = Math.cos(t * 0.38) * 0.06;
      camera.position.z = 34 + dispersion * 9;   // pull back as it falls apart

      composer.render();
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      composer.dispose();
      renderer.dispose();
      geo.dispose(); lineGeo.dispose(); mat.dispose(); lineMat.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [accent, count]);

  return <div className="kn-gl" ref={host} aria-hidden />;
}

/** Slide 6 — nine depth planes the camera dollies through, so plate-to-well is
 *  one continuous move rather than nine labelled boxes. */
export function DepthRail({ steps, progress }: { steps: number; progress: number }) {
  const host = useRef<HTMLDivElement>(null);
  const progRef = useRef(progress);
  progRef.current = progress;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 300);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.7, 0.05);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    // One glowing ring per step, receding into depth.
    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < steps; i += 1) {
      const g = new THREE.RingGeometry(3.4, 3.55, 96);
      const m = new THREE.MeshBasicMaterial({
        color: new THREE.Color(i / steps < 0.5 ? '#69D6FF' : '#D8B15A'),
        transparent: true, opacity: 0.5, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.z = -i * 11;
      scene.add(mesh);
      rings.push(mesh);
    }

    const resize = () => {
      const w = el.clientWidth || 1, h = el.clientHeight || 1;
      renderer.setSize(w, h, false); composer.setSize(w, h); bloom.resolution.set(w, h);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el);

    let raf = 0, z = 12;
    const tick = () => {
      const want = 12 - progRef.current * (steps - 1) * 11;
      z += (want - z) * 0.045;              // eased follow = camera with mass
      camera.position.z = z;
      rings.forEach((r, i) => {
        const d = Math.abs(r.position.z - (z - 12));
        (r.material as THREE.MeshBasicMaterial).opacity = Math.max(0.06, 0.62 - d * 0.014);
        r.rotation.z += 0.0009 * (i % 2 ? 1 : -1);
      });
      composer.render();
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      composer.dispose(); renderer.dispose();
      rings.forEach((r) => { r.geometry.dispose(); (r.material as THREE.Material).dispose(); });
      el.removeChild(renderer.domElement);
    };
  }, [steps]);

  return <div className="kn-gl" ref={host} aria-hidden />;
}
