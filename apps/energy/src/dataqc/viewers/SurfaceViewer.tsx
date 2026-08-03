// viewers/SurfaceViewer.tsx — depth-surface display in 2D and 3D.
//
// 2D: high-DPI canvas heatmap + d3-contour isolines (d3-contour is the standard for
//     marching-squares contouring and is already a dependency).
// 3D: three.js via @react-three/fiber with a single merged BufferGeometry and baked
//     vertex colours — one draw call for the whole surface, the same technique the
//     founder's GeaVision prototype used. Live FPS is measured from the r3f frame
//     loop, not estimated.
//
// Render density is capped (~180 samples/axis) so a million-node grid still moves;
// the underlying GVSURF stays the authority for calculations.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { contours as d3contours } from 'd3-contour';
import type { DigestedSurface } from '../types.ts';
import { useUnits, depth as depthQ } from '../../units';

const MAX_AXIS = 180;

/** spectral-ish depth ramp; shallow → deep */
function ramp(t: number): [number, number, number] {
  const stops: Array<[number, number, number]> = [
    [158, 1, 66], [244, 109, 67], [254, 224, 139], [171, 221, 164], [50, 136, 189], [94, 79, 162],
  ];
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.floor(x), j = Math.min(stops.length - 1, i + 1), f = x - i;
  return [
    stops[i][0] + (stops[j][0] - stops[i][0]) * f,
    stops[i][1] + (stops[j][1] - stops[i][1]) * f,
    stops[i][2] + (stops[j][2] - stops[i][2]) * f,
  ];
}

function useStats(s: DigestedSurface) {
  return useMemo(() => {
    let lo = Infinity, hi = -Infinity, live = 0;
    for (let i = 0; i < s.values.length; i++) {
      const v = s.values[i];
      if (!Number.isFinite(v)) continue;
      live++;
      const a = Math.abs(v);
      if (a < lo) lo = a; if (a > hi) hi = a;
    }
    return Number.isFinite(lo) ? { lo, hi, live } : { lo: 0, hi: 1, live: 0 };
  }, [s]);
}

// ── 2D ───────────────────────────────────────────────────────────────────────
function Surface2D({ s }: { s: DigestedSurface }) {
  const { system } = useUnits();
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 480 });
  const [showContours, setShowContours] = useState(true);
  const { lo, hi } = useStats(s);

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = cvRef.current; if (!cv || !size.w || !size.h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size.w * dpr; cv.height = size.h * dpr;
    cv.style.width = `${size.w}px`; cv.style.height = `${size.h}px`;
    const g = cv.getContext('2d'); if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size.w, size.h);

    const pad = 10;
    const sc = Math.min((size.w - pad * 2) / s.ncol, (size.h - pad * 2) / s.nrow);
    const ox = (size.w - s.ncol * sc) / 2, oy = (size.h - s.nrow * sc) / 2;

    // heatmap via ImageData — one pass, no per-cell fillRect
    const img = g.createImageData(s.ncol, s.nrow);
    for (let i = 0; i < s.ncol * s.nrow; i++) {
      const v = s.values[i];
      const o = i * 4;
      if (!Number.isFinite(v)) { img.data[o + 3] = 0; continue; }
      const t = (Math.abs(v) - lo) / ((hi - lo) || 1);
      const [r, gg, b] = ramp(t);
      img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
    const off = document.createElement('canvas');
    off.width = s.ncol; off.height = s.nrow;
    off.getContext('2d')!.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(off, ox, oy, s.ncol * sc, s.nrow * sc);

    if (showContours) {
      // d3-contour needs a dense array; nulls become the max so they don't create edges
      const flat = new Array(s.ncol * s.nrow);
      for (let i = 0; i < flat.length; i++) {
        const v = s.values[i];
        flat[i] = Number.isFinite(v) ? Math.abs(v) : hi;
      }
      const levels = 12;
      const thresholds = Array.from({ length: levels }, (_, i) => lo + ((i + 1) / (levels + 1)) * (hi - lo));
      const cs = d3contours().size([s.ncol, s.nrow]).thresholds(thresholds)(flat);
      g.save();
      g.translate(ox, oy); g.scale(sc, sc);
      g.lineWidth = 0.6 / sc;
      g.strokeStyle = 'rgba(15,23,42,0.45)';
      for (const c of cs) {
        g.beginPath();
        for (const poly of c.coordinates) {
          for (const ring of poly) {
            ring.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
            g.closePath();
          }
        }
        g.stroke();
      }
      g.restore();
    }
  }, [s, size, lo, hi, showContours]);

  return (
    <div className="dqv-2d">
      <div className="dqv-bar">
        <button className={'dqv-chip' + (showContours ? ' on' : '')} onClick={() => setShowContours((v) => !v)}>
          Contours
        </button>
        <span className="dqv-legend">
          <i style={{ background: `rgb(${ramp(0).join(',')})` }} /> {depthQ(lo, system).text}
          <i style={{ background: `rgb(${ramp(0.5).join(',')})` }} />
          <i style={{ background: `rgb(${ramp(1).join(',')})` }} /> {depthQ(hi, system).text}
        </span>
      </div>
      <div className="dqv-canvas-wrap" ref={wrapRef}><canvas ref={cvRef} /></div>
    </div>
  );
}

// ── 3D ───────────────────────────────────────────────────────────────────────
function FpsMeter({ onFps }: { onFps: (n: number) => void }) {
  const acc = useRef({ n: 0, t: performance.now() });
  useFrame(() => {
    const a = acc.current; a.n++;
    const now = performance.now();
    if (now - a.t >= 500) { onFps(Math.round((a.n * 1000) / (now - a.t))); a.n = 0; a.t = now; }
  });
  return null;
}

function SurfaceMesh({ s, exaggeration }: { s: DigestedSurface; exaggeration: number }) {
  const { lo, hi } = useStats(s);
  const { invalidate } = useThree();

  const geom = useMemo(() => {
    const step = Math.max(1, Math.ceil(Math.max(s.ncol, s.nrow) / MAX_AXIS));
    const nc = Math.floor((s.ncol - 1) / step) + 1;
    const nr = Math.floor((s.nrow - 1) / step) + 1;
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const map = new Int32Array(nc * nr).fill(-1);
    let vi = 0;
    const spanX = s.dx * s.ncol, spanY = s.dy * s.nrow;
    const scale = 2 / Math.max(spanX, spanY);

    for (let r = 0; r < nr; r++) {
      for (let c = 0; c < nc; c++) {
        const v = s.values[(r * step) * s.ncol + (c * step)];
        if (!Number.isFinite(v)) continue;
        const z = Math.abs(v);
        const t = (z - lo) / ((hi - lo) || 1);
        const [cr, cg, cb] = ramp(t);
        pos.push(
          (c * step * s.dx - spanX / 2) * scale,
          -(z - lo) * scale * exaggeration,
          (r * step * s.dy - spanY / 2) * scale,
        );
        col.push(cr / 255, cg / 255, cb / 255);
        map[r * nc + c] = vi++;
      }
    }
    for (let r = 0; r < nr - 1; r++) {
      for (let c = 0; c < nc - 1; c++) {
        const a = map[r * nc + c], b = map[r * nc + c + 1];
        const d = map[(r + 1) * nc + c], e = map[(r + 1) * nc + c + 1];
        if (a < 0 || b < 0 || d < 0 || e < 0) continue;
        idx.push(a, d, b, b, d, e);
      }
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    gg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    gg.setIndex(idx);
    gg.computeVertexNormals();
    return gg;
  }, [s, lo, hi, exaggeration]);

  useEffect(() => { invalidate(); return () => geom.dispose(); }, [geom, invalidate]);

  return (
    <mesh geometry={geom}>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.85} metalness={0.05} />
    </mesh>
  );
}

function Surface3D({ s }: { s: DigestedSurface }) {
  const [fps, setFps] = useState(0);
  const [exag, setExag] = useState(3);
  const tris = useMemo(() => {
    const step = Math.max(1, Math.ceil(Math.max(s.ncol, s.nrow) / MAX_AXIS));
    const nc = Math.floor((s.ncol - 1) / step) + 1, nr = Math.floor((s.nrow - 1) / step) + 1;
    return (nc - 1) * (nr - 1) * 2;
  }, [s]);

  return (
    <div className="dqv-3d">
      <div className="dqv-bar">
        <span className="dqv-chip on">{fps} FPS</span>
        <span className="dqv-chip">{tris.toLocaleString()} tris · 1 draw call</span>
        <label className="dqv-slider">
          Z ×{exag}
          <input type="range" min={1} max={10} step={1} value={exag} onChange={(e) => setExag(+e.target.value)} />
        </label>
      </div>
      <div className="dqv-canvas-wrap">
        <Canvas camera={{ position: [2.2, 2.0, 2.2], fov: 45 }} dpr={[1, 2]}>
          <ambientLight intensity={0.85} />
          <directionalLight position={[3, 6, 2]} intensity={1.1} />
          <SurfaceMesh s={s} exaggeration={exag} />
          <OrbitControls enableDamping dampingFactor={0.08} />
          <FpsMeter onFps={setFps} />
        </Canvas>
      </div>
    </div>
  );
}

export function SurfaceViewer({ surface }: { surface: DigestedSurface }) {
  const [mode, setMode] = useState<'2d' | '3d'>('2d');
  const { live } = useStats(surface);
  return (
    <div className="dqv-surface">
      <div className="dqv-modes">
        <button className={mode === '2d' ? 'on' : ''} onClick={() => setMode('2d')}>2D</button>
        <button className={mode === '3d' ? 'on' : ''} onClick={() => setMode('3d')}>3D</button>
        <span className="dqv-meta">{surface.ncol}×{surface.nrow} · {live.toLocaleString()} live nodes</span>
      </div>
      {mode === '2d' ? <Surface2D s={surface} /> : <Surface3D s={surface} />}
    </div>
  );
}
