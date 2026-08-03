// Crossplot3D.tsx — REAL WebGL three-axis crossplot point cloud (r3f), lazy-
// loaded so three.js stays code-split. Points are colored by the GR ramp,
// orbit/zoom via OrbitControls, with labelled axis lines.
import { useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { cssVar } from '../hooks';
import type { LogsJson } from '../../../wb/types';

function samples(log: LogsJson, keys: string[]): number[][] {
  const arrs = keys.map((k) => log.curves[k]?.values ?? []);
  const step = Math.max(1, Math.floor(log.md.length / 5000));
  const out: number[][] = [];
  for (let i = 0; i < log.md.length; i += step) {
    const v = arrs.map((a) => a[i]);
    if (v.some((x) => x == null || !isFinite(x as number))) continue;
    out.push(v as number[]);
  }
  return out;
}
function rangeOf(pts: number[][], i: number): [number, number] {
  let mn = Infinity, mx = -Infinity; for (const p of pts) { if (p[i] < mn) mn = p[i]; if (p[i] > mx) mx = p[i]; }
  if (!isFinite(mn)) return [0, 1]; if (mn === mx) mx = mn + 1; return [mn, mx];
}

function Cloud({ log, xC, yC, zC, colorC }: { log: LogsJson; xC: string; yC: string; zC: string; colorC: string }) {
  const geo = useMemo(() => {
    const pts = samples(log, [xC, yC, zC, colorC]);
    const [xr, yr, zr, cr] = [rangeOf(pts, 0), rangeOf(pts, 1), rangeOf(pts, 2), rangeOf(pts, 3)];
    const n = (v: number, r: [number, number]) => ((v - r[0]) / (r[1] - r[0]) - 0.5) * 2;
    const pos = new Float32Array(pts.length * 3);
    const col = new Float32Array(pts.length * 3);
    const c = new THREE.Color();
    pts.forEach((p, i) => {
      pos[i * 3] = n(p[0], xr); pos[i * 3 + 1] = n(p[1], yr); pos[i * 3 + 2] = n(p[2], zr);
      const t = (p[3] - cr[0]) / Math.max(1e-6, cr[1] - cr[0]);
      c.setHSL((90 - t * 90) / 360, 0.7, 0.55);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, [log, xC, yC, zC, colorC]);
  return (
    <points geometry={geo}>
      <pointsMaterial size={0.03} vertexColors sizeAttenuation transparent opacity={0.85} />
    </points>
  );
}

function Axis({ dir, label, color }: { dir: [number, number, number]; label: string; color: string }) {
  const geo = useMemo(() => new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-dir[0], -dir[1], -dir[2]), new THREE.Vector3(dir[0], dir[1], dir[2]),
  ]), [dir]);
  return (
    <group>
      <line>
        <primitive object={geo} attach="geometry" />
        <lineBasicMaterial color={color} />
      </line>
      <Html position={dir} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <span style={{ font: '600 10px var(--mono)', color }}>{label}</span>
      </Html>
    </group>
  );
}

export default function Crossplot3D({ log, xC, yC, zC, colorC }: { log: LogsJson; xC: string; yC: string; zC: string; colorC: string }) {
  useEffect(() => { const id = requestAnimationFrame(() => window.dispatchEvent(new Event('resize'))); return () => cancelAnimationFrame(id); }, []);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Canvas frameloop="demand" camera={{ position: [2.2, 1.8, 2.4], fov: 45 }} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
        <ambientLight intensity={0.8} />
        <Cloud log={log} xC={xC} yC={yC} zC={zC} colorC={colorC} />
        <Axis dir={[1.15, 0, 0]} label={xC} color={cssVar('--rose')} />
        <Axis dir={[0, 1.15, 0]} label={yC} color={cssVar('--blue')} />
        <Axis dir={[0, 0, 1.15]} label={zC} color={cssVar('--teal')} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.1} zoomToCursor />
      </Canvas>
      <span className="chip mono" style={{ position: 'absolute', top: 6, right: 8, borderColor: 'var(--teal)', color: 'var(--teal)' }}>◈ 3D · WebGL</span>
    </div>
  );
}
