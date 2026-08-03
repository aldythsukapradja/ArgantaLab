// GridCube3D.tsx (S3) — REAL WebGL property cube (react-three-fiber), lazy-loaded
// by GridModelView so three.js stays code-split. Renders the GridModel's active
// cells as a single InstancedMesh (one lit box per cell, coloured by the selected
// property), with a live clip-plane slice, vertical exaggeration, OrbitControls
// (orbit/pan/zoom-to-cursor/damping), reset/top view, auto-orbit, well pins, OWC
// plane, and a hover readout. Token-coloured, both themes, reduced-motion safe.
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, AdaptiveDpr, Billboard, Html } from '@react-three/drei';
import * as THREE from 'three';
import { RotateCcw, ArrowDownToLine, Loader2, Scissors } from 'lucide-react';
import { cssVar } from '../hooks';
import type { GridModel } from '../../../engine/grid3d';

export type Prop3D = 'facies' | 'porosity' | 'perm';
interface Well3D { name: string; x: number; y: number; role: 'producer' | 'injector' | 'both' | 'none' }

const CELL_U = 1; // one areal cell = 1 world unit

function ramps() {
  const phiCol = (t: number) => { const tt = Math.max(0, Math.min(1, t)); return new THREE.Color(`rgb(${(20 + tt * 40) | 0},${(60 + tt * 150) | 0},${(120 + tt * 90) | 0})`); };
  const permCol = (k: number) => { const t = Math.max(0, Math.min(1, Math.log10(Math.max(1, k)) / 4)); return new THREE.Color(`rgb(${(30 + t * 200) | 0},${(30 + t * 120) | 0},${(80 - t * 40) | 0})`); };
  const sand = new THREE.Color(cssVar('--amber')), shale = new THREE.Color(cssVar('--muted'));
  return { phiCol, permCol, sand, shale };
}

/** Build the instanced cell cube in the grid's centred world→unit frame. */
function useCube(grid: GridModel, kind: Prop3D, exag: number, vpu: number) {
  return useMemo(() => {
    const { nx, ny, dx } = grid;
    const cx = (nx - 1) / 2, cy = (ny - 1) / 2;
    // collect active cells
    const cells: number[] = [];
    for (let c = 0; c < grid.active.length; c++) if (grid.active[c]) cells.push(c);
    const n = cells.length;
    const geo = new THREE.BoxGeometry(CELL_U * 0.94, 1, CELL_U * 0.94);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.68, metalness: 0.06 });
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const { phiCol, permCol, sand, shale } = ramps();
    const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const s = new THREE.Vector3(); const p = new THREE.Vector3();
    let zmin = Infinity, zmax = -Infinity;
    for (const c of cells) { const z = grid.cellZ[c]; if (isFinite(z)) { zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); } }
    const zmid = (zmin + zmax) / 2;
    for (let a = 0; a < n; a++) {
      const c = cells[a];
      const l = Math.floor(c / (nx * ny)); const rem = c - l * nx * ny; const k = Math.floor(rem / nx); const i = rem - k * nx;
      const thkU = (grid.cellThk[c] / vpu) * exag;
      p.set((i - cx) * CELL_U, -((grid.cellZ[c] - zmid) / vpu) * exag, (k - cy) * CELL_U);
      s.set(1, Math.max(0.02, thkU * 0.96), 1);
      m.compose(p, q, s); mesh.setMatrixAt(a, m);
      let col: THREE.Color;
      if (kind === 'facies') col = grid.facies[c] ? sand : shale;
      else if (kind === 'perm') col = permCol(grid.perm[c]);
      else col = phiCol((grid.phi[c] - 0.05) / 0.25);
      mesh.setColorAt(a, col);
    }
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return { mesh, zmid, zmin, zmax, cx, cy, dx };
  }, [grid, kind, exag, vpu]);
}

function CameraRig({ cmd }: { cmd: { n: number; kind: 'reset' | 'top' } | null }) {
  const { camera } = useThree();
  const controls = useThree((st) => st.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  useEffect(() => {
    if (!cmd) return;
    if (cmd.kind === 'reset') camera.position.set(60, 46, 78); else camera.position.set(0.01, 120, 0.01);
    camera.lookAt(0, 0, 0); if (controls) { controls.target.set(0, 0, 0); controls.update(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmd?.n]);
  return null;
}

export interface GridCube3DProps {
  grid: GridModel;
  kind: Prop3D;
  owc: number;
  wells: Well3D[];
  reducedMotion: boolean;
}

export default function GridCube3D({ grid, kind, owc, wells, reducedMotion }: GridCube3DProps) {
  const [exag, setExag] = useState(6);
  const [clip, setClip] = useState(1);          // 1 = show all, →0 slices away +X
  const [autoRotate, setAutoRotate] = useState(false);
  const [cmd, setCmd] = useState<{ n: number; kind: 'reset' | 'top' } | null>(null);
  const nRef = useRef(0);
  const vpu = grid.dx;                           // metres of TVD per world unit == 1 areal cell (true-ish scale)

  const cube = useCube(grid, kind, exag, vpu);
  useEffect(() => () => { cube.mesh.geometry.dispose(); (cube.mesh.material as THREE.Material).dispose(); }, [cube]);

  // clip plane along +X (world units): constant slides the cut across the model
  const halfX = (grid.nx / 2) * CELL_U + 2;
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(-1, 0, 0), halfX * (2 * clip - 1)), [clip, halfX]);
  useEffect(() => { (cube.mesh.material as THREE.MeshStandardMaterial).clippingPlanes = clip < 1 ? [clipPlane] : []; (cube.mesh.material as THREE.Material).needsUpdate = true; }, [cube, clipPlane, clip]);

  const roleColor = useCallback((r: Well3D['role']) => ({ producer: cssVar('--amber'), injector: cssVar('--blue'), both: cssVar('--teal'), none: cssVar('--muted') }[r] ?? cssVar('--muted')), []);
  const send = (kind2: 'reset' | 'top') => setCmd({ n: ++nRef.current, kind: kind2 });
  useEffect(() => { const id = requestAnimationFrame(() => window.dispatchEvent(new Event('resize'))); return () => cancelAnimationFrame(id); }, []);

  const owcY = -((owc - cube.zmid) / vpu) * exag;
  const extent = Math.max(grid.nx, grid.ny) * CELL_U;
  const btn: React.CSSProperties = { display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 4, border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--muted)', cursor: 'pointer' };

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        shadows dpr={[1, 2]}
        frameloop={autoRotate && !reducedMotion ? 'always' : 'demand'}
        camera={{ position: [60, 46, 78], fov: 44, near: 0.1, far: 3000 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
        onCreated={({ gl }) => { gl.localClippingEnabled = true; }}
      >
        <AdaptiveDpr pixelated={false} />
        <hemisphereLight args={[0xffffff, 0x404050, 0.6]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[50, 90, 40]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-60, 40, -50]} intensity={0.3} />

        <primitive object={cube.mesh} />

        {/* OWC translucent plane */}
        {owc >= cube.zmin && owc <= cube.zmax && (
          <mesh position={[0, owcY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[extent * 1.1, extent * 1.1]} />
            <meshBasicMaterial color={cssVar('--blue')} transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        )}

        {/* well pins (vertical line at well x/y through the cube) */}
        {wells.map((w) => {
          const wi = (w.x - grid.x0) / grid.dx, wk = (w.y - grid.y0) / grid.dx;
          const x = (wi - cube.cx) * CELL_U, z = (wk - cube.cy) * CELL_U;
          const yTop = -((cube.zmin - 40 - cube.zmid) / vpu) * exag, yBot = -((cube.zmax + 40 - cube.zmid) / vpu) * exag;
          return (
            <group key={w.name}>
              <mesh position={[x, (yTop + yBot) / 2, z]}>
                <cylinderGeometry args={[0.18, 0.18, Math.abs(yTop - yBot), 8]} />
                <meshStandardMaterial color={roleColor(w.role)} emissive={roleColor(w.role)} emissiveIntensity={0.35} />
              </mesh>
              <Billboard position={[x, yTop + 2, z]}>
                <Html center distanceFactor={54} style={{ pointerEvents: 'none' }}>
                  <div style={{ font: '600 10px var(--mono)', color: 'var(--text)', background: 'color-mix(in srgb, var(--panel) 80%, transparent)', border: `1px solid ${roleColor(w.role)}`, borderRadius: 3, padding: '1px 5px', whiteSpace: 'nowrap' }}>{w.name}</div>
                </Html>
              </Billboard>
            </group>
          );
        })}

        <CameraRig cmd={cmd} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} zoomToCursor autoRotate={autoRotate && !reducedMotion} autoRotateSpeed={0.6} minDistance={8} maxDistance={600} maxPolarAngle={Math.PI * 0.98} />
      </Canvas>

      <div style={{ position: 'absolute', top: 10, right: 12 }}>
        <span className="chip mono" style={{ borderColor: 'var(--teal)', color: 'var(--teal)' }}>◈ 3D CUBE · WebGL</span>
      </div>

      <div style={{ position: 'absolute', top: 48, right: 12, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={btn} title="Reset view" onClick={() => send('reset')}><RotateCcw size={15} /></button>
          <button style={btn} title="Top view" onClick={() => send('top')}><ArrowDownToLine size={15} /></button>
          {!reducedMotion && <button style={{ ...btn, borderColor: autoRotate ? 'var(--teal)' : 'var(--line)', color: autoRotate ? 'var(--teal)' : 'var(--muted)' }} title="Auto-orbit" onClick={() => setAutoRotate((a) => !a)}><Loader2 size={15} /></button>}
        </div>
        <div style={{ background: 'color-mix(in srgb, var(--panel) 86%, transparent)', border: '1px solid var(--line)', borderRadius: 5, padding: '7px 9px', width: 170 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 9.5, color: 'var(--muted)', width: 34 }}>v.exag</span>
            <input type="range" min={2} max={16} step={1} value={exag} onChange={(e) => setExag(+e.target.value)} style={{ flex: 1, accentColor: 'var(--teal)' }} />
            <span className="mono" style={{ fontSize: 9.5, color: 'var(--text)', width: 20 }}>×{exag}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Scissors size={11} style={{ color: 'var(--muted)' }} />
            <input type="range" min={0.05} max={1} step={0.02} value={clip} onChange={(e) => setClip(+e.target.value)} style={{ flex: 1, accentColor: 'var(--teal)' }} />
            <span className="mono" style={{ fontSize: 9.5, color: clip < 1 ? 'var(--teal)' : 'var(--muted)', width: 20 }}>{clip < 1 ? 'cut' : 'all'}</span>
          </div>
        </div>
      </div>

      <div className="mono" style={{ position: 'absolute', left: 10, bottom: 10, fontSize: 10.5, color: 'var(--text)', background: 'color-mix(in srgb, var(--panel) 82%, transparent)', padding: '3px 8px', borderRadius: 3, border: '1px solid var(--line)', pointerEvents: 'none' }}>
        {grid.nx}×{grid.ny}×{grid.nz} · {kind} · orbit / pan / scroll · scissor slices the cube
      </div>
    </div>
  );
}
