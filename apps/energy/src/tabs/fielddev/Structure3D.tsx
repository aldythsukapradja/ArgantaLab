// Structure3D — the horizons as they actually sit, one above the other.
//
// The 2D map answers "where is the crest". It cannot answer "how much section is
// between the unconformity and the reservoir", or "does this well land above or
// below the contact", because both are questions about the vertical, and a map
// has no vertical. That is the whole reason this view exists, and it is why the
// surface selector here is MULTI-select while the map's is single: one surface in
// 3D is a map with extra steps.
//
// Three things are load-bearing and are enforced in surface-mesh.ts, not here:
//   • every surface is built in ONE shared local frame, because Volve's five
//     horizons are gridded on five different origins and meshing each about its
//     own corner would stack them right in depth and wrong in map position;
//   • a triangle needs three real corners, so the mesh ends where the
//     interpretation ends instead of dropping a cliff to datum;
//   • one colour ramp spans every selected surface, so their depths are
//     comparable — which is the point of showing them together.
//
// VERTICAL EXAGGERATION IS ALWAYS SHOWN. Volve is ~7 km across with ~600 m of
// relief; at true scale it is a sheet of paper. Every geoscientist expects
// exaggeration and every one of them wants to know the number.
import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { DigestedSurface } from '../../dataqc/types';
import { buildSurfaceMesh, commonOrigin, sharedDepthRange, type MeshGrid } from './surface-mesh';
import { depthConvention, rampRgb } from './StructureLayer';
import { ROLE_FILL, type ImpactMarker } from './ImpactMarkers';

export interface Structure3DSurface {
  id: string;
  /** display name, as ingested */
  name: string;
  short: string;
  grid: DigestedSurface;
  /** projected origin + cell, from the surface asset's own header */
  geo: { x0: number; y0: number; cell: number };
}

export interface Structure3DProps {
  surfaces: Structure3DSurface[];
  /** impact points for the horizons on show, in PROJECTED coordinates */
  wells: Array<ImpactMarker & { easting: number; northing: number }>;
  contactDepth?: number | null;
  contactLabel?: string;
  zScale: number;
}

/** Cap on emitted vertices per surface. Five full Volve grids at 50 m is ~1.1 M
 *  nodes, which is a stutter on an integrated GPU for no readable gain — the
 *  structure is smooth at 100–150 m. The stride actually used is reported. */
const MAX_NODES = 60_000;

function strideFor(ncol: number, nrow: number): number {
  let s = 1;
  while (Math.ceil(ncol / s) * Math.ceil(nrow / s) > MAX_NODES) s++;
  return s;
}

function SurfaceMeshView({ geometry, opacity }: { geometry: THREE.BufferGeometry; opacity: number }) {
  return (
    <mesh geometry={geometry}>
      {/* double-sided: a horizon is viewed from above and below in the same orbit */}
      <meshStandardMaterial
        vertexColors side={THREE.DoubleSide}
        transparent={opacity < 1} opacity={opacity}
        roughness={0.82} metalness={0.05} flatShading={false}
      />
    </mesh>
  );
}

/** A slow idle orbit until the user takes hold, so the view reads as 3D on sight
 *  rather than looking like a flat image that happens to be in a canvas. */
function IdleSpin({ enabled, group }: { enabled: boolean; group: React.RefObject<THREE.Group> }) {
  useFrame((_, dt) => { if (enabled && group.current) group.current.rotation.z += dt * 0.055; });
  return null;
}

export function Structure3D({ surfaces, wells, contactDepth, contactLabel, zScale }: Structure3DProps) {
  const [idle, setIdle] = useState(true);
  const [hover, setHover] = useState<string | null>(null);
  const group = useRef<THREE.Group>(null);

  const built = useMemo(() => {
    const grids: MeshGrid[] = surfaces.map((s) => ({
      ncol: s.grid.ncol, nrow: s.grid.nrow, values: s.grid.values,
      x0: s.geo.x0, y0: s.geo.y0, dx: s.geo.cell, dy: s.geo.cell,
    }));
    const origin = commonOrigin(grids);
    if (!origin) return null;
    // convention is read from the data, exactly as the 2D layer reads it, so the
    // two views can never disagree about which way is down
    const conv = depthConvention(surfaces[0].grid.values);
    const flip = conv?.flip ?? true;
    const range = sharedDepthRange(grids, flip);
    if (!range) return null;

    const colorAt = (d: number): [number, number, number] => {
      const [r, g, b] = rampRgb((d - range.dmin) / (range.dmax - range.dmin));
      return [r / 255, g / 255, b / 255];
    };

    const meshes: Array<{ id: string; short: string; geometry: THREE.BufferGeometry; stride: number; dropped: number }> = [];
    for (let i = 0; i < grids.length; i++) {
      const stride = strideFor(grids[i].ncol, grids[i].nrow);
      const m = buildSurfaceMesh(grids[i], {
        originX: origin.x, originY: origin.y, flip, zScale, colorAt, stride,
      });
      if (!m) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
      g.setAttribute('color', new THREE.BufferAttribute(m.colors, 3));
      g.setIndex(new THREE.BufferAttribute(m.indices, 1));
      g.computeVertexNormals();
      meshes.push({ id: surfaces[i].id, short: surfaces[i].short, geometry: g, stride, dropped: m.droppedQuads });
    }
    if (!meshes.length) return null;

    // centre the model on its own footprint so the orbit pivots on the field
    const spanX = Math.max(...grids.map((g) => g.x0 + g.dx * (g.ncol - 1))) - origin.x;
    const spanY = Math.max(...grids.map((g) => g.y0 + g.dy * (g.nrow - 1))) - origin.y;
    const midZ = -((range.dmin + range.dmax) / 2) * zScale;

    return { meshes, origin, flip, range, spanX, spanY, midZ };
  }, [surfaces, zScale]);

  const wellPts = useMemo(() => {
    if (!built) return [];
    return wells
      .filter((w) => w.tvdss != null && Number.isFinite(w.easting))
      .map((w) => ({
        ...w,
        pos: new THREE.Vector3(
          w.easting - built.origin.x,
          w.northing - built.origin.y,
          // tvdss is published negative-down in this bundle; normalise to a depth
          // and then to a height, the same way the mesh does
          -Math.abs(w.tvdss as number) * zScale,
        ),
      }));
  }, [wells, built, zScale]);

  if (!built) {
    return <div className="fds-3d-empty">No decoded horizon to render — select a surface.</div>;
  }

  const span = Math.max(built.spanX, built.spanY);
  const cam = span * 1.15;

  return (
    <div className="fds-3d" onPointerDown={() => setIdle(false)}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [cam * 0.75, -cam * 0.95, cam * 0.62], fov: 42, near: span / 500, far: span * 12 }}
        onCreated={({ gl }) => { gl.setClearColor('#050d16'); }}
      >
        <ambientLight intensity={0.72} />
        <directionalLight position={[1, -1, 2]} intensity={1.15} />
        <directionalLight position={[-1.4, 0.8, 0.6]} intensity={0.34} />

        <group ref={group} position={[-built.spanX / 2, -built.spanY / 2, -built.midZ]}>
          {built.meshes.map((m, i) => (
            <SurfaceMeshView key={m.id} geometry={m.geometry}
              /* the topmost surfaces go translucent so the ones beneath them stay
                 readable — with five opaque sheets you only ever see the shallowest */
              opacity={built.meshes.length > 1 && i < built.meshes.length - 1 ? 0.62 : 1} />
          ))}

          {/* the contact as the horizontal plane it physically is */}
          {contactDepth != null && Number.isFinite(contactDepth) && (
            <mesh position={[built.spanX / 2, built.spanY / 2, -contactDepth * zScale]}>
              <planeGeometry args={[built.spanX, built.spanY]} />
              <meshBasicMaterial color="#2f9bff" transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          )}

          {wellPts.map((w) => (
            <group key={w.well} position={w.pos}>
              <mesh
                onPointerOver={(e) => { e.stopPropagation(); setHover(w.well); }}
                onPointerOut={() => setHover(null)}
              >
                <sphereGeometry args={[span / 140, 14, 12]} />
                {/* same rule as the 2D symbols: colour reports what the well IS */}
                <meshStandardMaterial color={ROLE_FILL[w.role]} roughness={0.35} />
              </mesh>
              {hover === w.well && (
                <Html center distanceFactor={span * 0.9} zIndexRange={[30, 0]}>
                  <div className="fds-3d-tip">
                    <b>{w.well}</b>
                    <span>{Math.round(Math.abs(w.tvdss ?? 0)).toLocaleString('en-US')} m TVDSS</span>
                    {w.stats && <span>{Math.round(w.stats.cumOil).toLocaleString('en-US')} cum oil</span>}
                  </div>
                </Html>
              )}
            </group>
          ))}
        </group>

        <IdleSpin enabled={idle} group={group} />
        <OrbitControls enableDamping dampingFactor={0.08} makeDefault
          minDistance={span * 0.18} maxDistance={span * 4} />
      </Canvas>

      <div className="fds-3d-key">
        <b>{built.meshes.length} horizon{built.meshes.length === 1 ? '' : 's'}</b>
        <span>{Math.round(built.range.dmin)}–{Math.round(built.range.dmax)} m, one shared ramp</span>
        {/* exaggeration and decimation are stated, never silent */}
        <span>vertical ×{zScale}</span>
        {built.meshes.some((m) => m.stride > 1) && (
          <span title="grids are decimated so the view stays interactive; the structure is unchanged">
            gridded every {Math.max(...built.meshes.map((m) => m.stride))} nodes
          </span>
        )}
        {contactDepth != null && <span>{contactLabel ?? 'contact'} {Math.round(contactDepth)} m</span>}
        {wellPts.length > 0 && <span>{wellPts.length} well penetrations</span>}
      </div>
    </div>
  );
}
