// Map3D.tsx — REAL WebGL structural 3D scene (react-three-fiber), lazy-loaded
// by MapView so three.js is code-split out of the base bundle. Renders the
// active structural grid as a lit, depth-colored BufferGeometry surface with
// null cells left as holes, stackable secondary horizons with opacity, real 3D
// well tubes from trajectories, OrbitControls (orbit/pan/zoom-to-cursor/damping),
// vertical-exaggeration, wireframe + auto-rotate toggles, reset/top view, and a
// live hover cell readout. Token-colored, both themes, reduced-motion safe.
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Html, Billboard, AdaptiveDpr } from '@react-three/drei';
import * as THREE from 'three';
import { RotateCcw, ArrowDownToLine, Grid3x3, Loader2 } from 'lucide-react';
import { useAsync, cssVar } from '../hooks';
import { depthRamp } from '../colormap';
import { loadSurface } from '../../../wb/load';
import type { SurfaceJson } from '../../../engine/grid';
import type { WellRow, TrajJson } from '../../../wb/types';

const CELL_U = 1;            // one grid cell = 1 world unit (horizontal)
const V_METERS_PER_UNIT = 50; // metres of TVD per world unit at ×1 (== cell size → true-scale)

type Traj = { w: WellRow; t: TrajJson };
type Planned = { name: string; role: WellRow['role']; pts: Array<[number, number]>; landingTVD: number | null };

interface StackDef { id: string; name: string; color: string }

// secondary horizons available to stack on top of the active one
const STACK_SURFACES: StackDef[] = [
  { id: 'hugin_top', name: 'Hugin Top', color: '--teal' },
  { id: 'hugin_base', name: 'Hugin Base', color: '--amber' },
  { id: 'bcu', name: 'BCU', color: '--violet' },
];

/** Shared depth transform: metres TVDSS → world Y (up is negative depth). */
function makeTransform(grid: SurfaceJson, mm: { min: number; max: number }, exag: number) {
  const zmid = (mm.min + mm.max) / 2;
  const cx = (grid.nx - 1) / 2;
  const cy = (grid.ny - 1) / 2;
  return {
    X: (ix: number) => (ix - cx) * CELL_U,
    Z: (iy: number) => (iy - cy) * CELL_U,
    Y: (tvdss: number) => -((tvdss - zmid) / V_METERS_PER_UNIT) * exag,
    // world (easting/northing) → grid index space for wells
    Xw: (wx: number) => ((wx - grid.x0) / grid.cell - cx) * CELL_U,
    Zw: (wy: number) => ((wy - grid.y0) / grid.cell - cy) * CELL_U,
  };
}

/** Build a lit, depth-colored BufferGeometry from a grid, skipping null cells. */
function buildSurfaceGeometry(
  grid: SurfaceJson,
  mm: { min: number; max: number },
  exag: number,
  ramp: (t: number) => string,
) {
  const { nx, ny, z } = grid;
  const T = makeTransform(grid, mm, exag);
  const span = Math.max(1e-6, mm.max - mm.min);
  const pos = new Float32Array(nx * ny * 3);
  const col = new Float32Array(nx * ny * 3);
  const tmp = new THREE.Color();
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const k = iy * nx + ix;
      const v = z[k];
      const zz = v == null || !isFinite(v) ? mm.max : v;
      pos[k * 3] = T.X(ix);
      pos[k * 3 + 1] = T.Y(zz);
      pos[k * 3 + 2] = T.Z(iy);
      const t = (zz - mm.min) / span;
      tmp.setStyle(ramp(t));
      col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
    }
  }
  // indices — two triangles per cell, only when all four corners are present
  const idx: number[] = [];
  const ok = (ix: number, iy: number) => {
    const v = z[iy * nx + ix];
    return v != null && isFinite(v);
  };
  for (let iy = 0; iy < ny - 1; iy++) {
    for (let ix = 0; ix < nx - 1; ix++) {
      if (!ok(ix, iy) || !ok(ix + 1, iy) || !ok(ix, iy + 1) || !ok(ix + 1, iy + 1)) continue;
      const a = iy * nx + ix, b = iy * nx + ix + 1, c = (iy + 1) * nx + ix, d = (iy + 1) * nx + ix + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function SurfaceMesh({ grid, mm, exag, wireframe, opacity, flat }: {
  grid: SurfaceJson; mm: { min: number; max: number }; exag: number;
  wireframe: boolean; opacity: number; flat?: string;
}) {
  const ramp = useMemo(() => depthRamp(), [flat]);
  const geo = useMemo(() => buildSurfaceGeometry(grid, mm, exag, ramp), [grid, mm, exag, ramp]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial
        vertexColors wireframe={wireframe}
        transparent={opacity < 1} opacity={opacity}
        roughness={0.72} metalness={0.05}
        side={THREE.DoubleSide} flatShading={false}
      />
    </mesh>
  );
}

/** A secondary (stacked) surface, loaded lazily, drawn semi-transparent. */
function StackedSurface({ def, refGrid, mm, exag, opacity }: {
  def: StackDef; refGrid: SurfaceJson; mm: { min: number; max: number }; exag: number; opacity: number;
}) {
  const res = useAsync<SurfaceJson>(() => loadSurface(def.id), [def.id]);
  if (!res.data) return null;
  // Re-index the loaded grid onto the reference grid's centre so surfaces align.
  return <AlignedSurface grid={res.data} refGrid={refGrid} mm={mm} exag={exag} opacity={opacity} tint={cssVar(def.color)} />;
}

function AlignedSurface({ grid, refGrid, mm, exag, opacity, tint }: {
  grid: SurfaceJson; refGrid: SurfaceJson; mm: { min: number; max: number }; exag: number; opacity: number; tint: string;
}) {
  const geo = useMemo(() => {
    // build geometry in the reference grid's world→unit frame so overlays register
    const { nx, ny, z } = grid;
    const zmid = (mm.min + mm.max) / 2;
    const rcx = (refGrid.nx - 1) / 2, rcy = (refGrid.ny - 1) / 2;
    const pos = new Float32Array(nx * ny * 3);
    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        const k = iy * nx + ix;
        const v = z[k];
        const zz = v == null || !isFinite(v) ? mm.max : v;
        const wx = grid.x0 + ix * grid.cell, wy = grid.y0 + iy * grid.cell;
        pos[k * 3] = ((wx - refGrid.x0) / refGrid.cell - rcx) * CELL_U;
        pos[k * 3 + 1] = -((zz - zmid) / V_METERS_PER_UNIT) * exag;
        pos[k * 3 + 2] = ((wy - refGrid.y0) / refGrid.cell - rcy) * CELL_U;
      }
    }
    const idx: number[] = [];
    const ok = (ix: number, iy: number) => { const v = z[iy * nx + ix]; return v != null && isFinite(v); };
    for (let iy = 0; iy < ny - 1; iy++) for (let ix = 0; ix < nx - 1; ix++) {
      if (!ok(ix, iy) || !ok(ix + 1, iy) || !ok(ix, iy + 1) || !ok(ix + 1, iy + 1)) continue;
      const a = iy * nx + ix, b = iy * nx + ix + 1, c = (iy + 1) * nx + ix, d = (iy + 1) * nx + ix + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }, [grid, refGrid, mm, exag]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={tint} transparent opacity={opacity} roughness={0.6} metalness={0.1} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** A single well as a 3D tube from its trajectory, with a billboard label. */
function WellTube({ traj, T, color, planned }: {
  traj: Traj; T: ReturnType<typeof makeTransform>; color: string; planned?: boolean;
}) {
  const { curve, top } = useMemo(() => {
    const pts = traj.t.stations
      .filter((s) => isFinite(s.tvd))
      .map((s) => new THREE.Vector3(
        T.Xw(traj.w.x + s.dispEw),
        T.Y(s.tvd), // approx TVDSS; same centering + exag as the surface
        T.Zw(traj.w.y + s.dispNs),
      ));
    if (pts.length < 2) return { curve: null as THREE.CatmullRomCurve3 | null, top: pts[0] ?? new THREE.Vector3() };
    return { curve: new THREE.CatmullRomCurve3(pts), top: pts[0] };
  }, [traj, T]);
  const geo = useMemo(() => (curve ? new THREE.TubeGeometry(curve, 96, 0.35, 8, false) : null), [curve]);
  useEffect(() => () => geo?.dispose(), [geo]);
  const col = new THREE.Color(color);
  return (
    <group>
      {geo && (
        <mesh geometry={geo}>
          <meshStandardMaterial color={col} emissive={col} emissiveIntensity={planned ? 0.15 : 0.35} roughness={0.4} metalness={0.3} transparent={planned} opacity={planned ? 0.7 : 1} />
        </mesh>
      )}
      <mesh position={top}>
        <sphereGeometry args={[0.7, 16, 16]} />
        <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.5} />
      </mesh>
      <Billboard position={[top.x, top.y + 2.4, top.z]}>
        <Html center distanceFactor={60} style={{ pointerEvents: 'none' }}>
          <div style={{ font: '600 10px var(--mono)', color: 'var(--text)', background: 'color-mix(in srgb, var(--panel) 80%, transparent)', border: `1px solid ${color}`, borderRadius: 3, padding: '1px 5px', whiteSpace: 'nowrap' }}>
            {planned ? '⚑ ' : ''}{traj.w.name}
          </div>
        </Html>
      </Billboard>
    </group>
  );
}

/** Imperative camera commands (reset / top view) driven from outside the Canvas. */
function CameraRig({ cmd, reduced }: { cmd: { n: number; kind: 'reset' | 'top' } | null; reduced: boolean }) {
  const { camera } = useThree();
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  useEffect(() => {
    if (!cmd) return;
    if (cmd.kind === 'reset') camera.position.set(90, 70, 120);
    else camera.position.set(0.01, 175, 0.01);
    camera.lookAt(0, 0, 0);
    if (controls) { controls.target.set(0, 0, 0); controls.update(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmd?.n]);
  void reduced;
  return null;
}

export interface Map3DProps {
  grid: SurfaceJson;
  minmax: { min: number; max: number };
  activeSurfaceId: string;
  vExag: number;
  trajectories: Traj[];
  planned: Planned[];
  reducedMotion: boolean;
}

export default function Map3D({ grid, minmax, activeSurfaceId, vExag, trajectories, planned, reducedMotion }: Map3DProps) {
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [stack, setStack] = useState<Record<string, boolean>>({});
  const [stackOpacity, setStackOpacity] = useState(0.5);
  const [cmd, setCmd] = useState<{ n: number; kind: 'reset' | 'top' } | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ ix: number; iy: number; z: number } | null>(null);
  const nRef = useRef(0);

  const T = useMemo(() => makeTransform(grid, minmax, vExag), [grid, minmax, vExag]);
  const roleColor = useCallback((r: WellRow['role']) => {
    const m: Record<string, string> = { producer: cssVar('--amber'), injector: cssVar('--blue'), both: cssVar('--teal'), none: cssVar('--muted') };
    return m[r] ?? cssVar('--muted');
  }, []);

  const onSurfaceHover = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const p = e.point;
    const cx = (grid.nx - 1) / 2, cy = (grid.ny - 1) / 2;
    const ix = Math.round(p.x / CELL_U + cx);
    const iy = Math.round(p.z / CELL_U + cy);
    const v = grid.z[iy * grid.nx + ix];
    if (v != null && isFinite(v)) setHoverInfo({ ix, iy, z: v });
  }, [grid]);

  const send = (kind: 'reset' | 'top') => setCmd({ n: ++nRef.current, kind });

  // r3f measures its container on mount; when mounted into a just-revealed
  // (Suspense→content) absolute box the first measure can lag → nudge a resize.
  useEffect(() => {
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    return () => cancelAnimationFrame(id);
  }, []);

  const btn: React.CSSProperties = {
    display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 4,
    border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--muted)', cursor: 'pointer',
  };

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        frameloop={autoRotate && !reducedMotion ? 'always' : 'demand'}
        camera={{ position: [90, 70, 120], fov: 42, near: 0.1, far: 4000 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
        onPointerMissed={() => setHoverInfo(null)}
      >
        <AdaptiveDpr pixelated={false} />
        <hemisphereLight args={[0xffffff, 0x404050, 0.55]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[60, 120, 40]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-80, 40, -60]} intensity={0.35} />

        <group onPointerMove={onSurfaceHover}>
          <SurfaceMesh grid={grid} mm={minmax} exag={vExag} wireframe={wireframe} opacity={1} flat={activeSurfaceId} />
        </group>

        {STACK_SURFACES.filter((s) => stack[s.id] && s.id !== activeSurfaceId).map((s) => (
          <StackedSurface key={s.id} def={s} refGrid={grid} mm={minmax} exag={vExag} opacity={stackOpacity} />
        ))}

        {trajectories.map((tj) => (
          <WellTube key={tj.w.name} traj={tj} T={T} color={roleColor(tj.w.role)} />
        ))}
        {planned.map((p, i) => p.landingTVD != null && (
          <PlannedMarker key={`pl-${i}`} p={p} T={T} color={cssVar('--rose')} />
        ))}

        <CameraRig cmd={cmd} reduced={reducedMotion} />
        <OrbitControls
          makeDefault enableDamping dampingFactor={0.08}
          zoomToCursor autoRotate={autoRotate && !reducedMotion} autoRotateSpeed={0.6}
          minDistance={12} maxDistance={800} maxPolarAngle={Math.PI * 0.98}
        />
      </Canvas>

      {/* WebGL badge */}
      <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="chip mono" style={{ borderColor: 'var(--teal)', color: 'var(--teal)' }}>◈ 3D · WebGL</span>
      </div>

      {/* control cluster */}
      <div style={{ position: 'absolute', top: 48, right: 12, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={btn} title="Reset view" onClick={() => send('reset')}><RotateCcw size={15} /></button>
          <button style={btn} title="Top view" onClick={() => send('top')}><ArrowDownToLine size={15} /></button>
          <button style={{ ...btn, borderColor: wireframe ? 'var(--teal)' : 'var(--line)', color: wireframe ? 'var(--teal)' : 'var(--muted)' }} title="Wireframe" onClick={() => setWireframe((w) => !w)}><Grid3x3 size={15} /></button>
          {!reducedMotion && (
            <button style={{ ...btn, borderColor: autoRotate ? 'var(--teal)' : 'var(--line)', color: autoRotate ? 'var(--teal)' : 'var(--muted)' }} title="Auto-orbit" onClick={() => setAutoRotate((a) => !a)}><Loader2 size={15} /></button>
          )}
        </div>
        <div style={{ background: 'color-mix(in srgb, var(--panel) 86%, transparent)', border: '1px solid var(--line)', borderRadius: 5, padding: '7px 9px', width: 168 }}>
          <div className="eyebrow" style={{ fontSize: 9, marginBottom: 5, color: 'var(--muted)' }}>Stack horizons</div>
          {STACK_SURFACES.map((s) => (
            <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, marginBottom: 3, opacity: s.id === activeSurfaceId ? 0.4 : 1 }}>
              <input type="checkbox" disabled={s.id === activeSurfaceId} checked={!!stack[s.id]} onChange={(e) => setStack((p) => ({ ...p, [s.id]: e.target.checked }))} />
              <span style={{ width: 9, height: 9, borderRadius: 2, background: cssVar(s.color) }} />
              <span style={{ color: 'var(--text)' }}>{s.name}{s.id === activeSurfaceId ? ' · active' : ''}</span>
            </label>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <span style={{ fontSize: 9.5, color: 'var(--muted)' }}>opacity</span>
            <input type="range" min={0.15} max={1} step={0.05} value={stackOpacity} onChange={(e) => setStackOpacity(+e.target.value)} style={{ flex: 1, accentColor: 'var(--teal)' }} />
          </div>
        </div>
      </div>

      {/* hover readout */}
      <div className="mono" style={{ position: 'absolute', left: 10, bottom: 10, fontSize: 10.5, color: 'var(--text)', background: 'color-mix(in srgb, var(--panel) 82%, transparent)', padding: '3px 8px', borderRadius: 3, border: '1px solid var(--line)', pointerEvents: 'none' }}>
        {hoverInfo
          ? `cell ${hoverInfo.ix},${hoverInfo.iy} · X ${(grid.x0 + hoverInfo.ix * grid.cell).toFixed(0)} · Y ${(grid.y0 + hoverInfo.iy * grid.cell).toFixed(0)} · Z ${hoverInfo.z.toFixed(1)} m`
          : `${grid.name} · ${grid.nx}×${grid.ny} · orbit / pan / scroll to zoom`}
      </div>
    </div>
  );
}

function PlannedMarker({ p, T, color }: { p: Planned; T: ReturnType<typeof makeTransform>; color: string }) {
  const surf = p.pts[0];
  const y = p.landingTVD != null ? T.Y(p.landingTVD) : 0;
  const x = T.Xw(surf[0]); const z = T.Zw(surf[1]);
  const col = new THREE.Color(color);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y + 40, z), new THREE.Vector3(x, y, z)]);
    return g;
  }, [x, y, z]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group>
      <line>
        <primitive object={geo} attach="geometry" />
        <lineBasicMaterial color={col} transparent opacity={0.7} />
      </line>
      <mesh position={[x, y, z]}>
        <coneGeometry args={[0.9, 2.2, 6]} />
        <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.4} />
      </mesh>
      <Billboard position={[x, y + 3, z]}>
        <Html center distanceFactor={60} style={{ pointerEvents: 'none' }}>
          <div style={{ font: '600 10px var(--mono)', color: 'var(--rose)', background: 'color-mix(in srgb, var(--panel) 80%, transparent)', border: `1px solid ${color}`, borderRadius: 3, padding: '1px 5px', whiteSpace: 'nowrap' }}>⚑ {p.name}</div>
        </Html>
      </Billboard>
    </group>
  );
}
