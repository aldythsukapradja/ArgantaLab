// GeaStudio — the one big canvas.
//
// Petrel keeps a single 3D window and floats every process dialog over it. This is
// that window: full-bleed, always rendering, never replaced by a panel. Processes
// change what is IN it; they never take it away.
//
// What it draws is real: the ingested depth grids, meshed in ONE shared local frame
// by surface-mesh.ts (Volve's horizons are gridded on different origins, so meshing
// each about its own corner would stack them right in depth and wrong in map
// position), coloured by a single shared ramp so their depths are comparable, plus
// the wellbore paths and the fluid contact.
//
// The scene conventions are lifted from Structure3D, deliberately and exactly:
//   · the frame is the grid's own — x east, y north, z UP, in METRES
//   · camera up is +Z, not three's default +Y, or the orbit pivots about north and
//     reads as an arbitrary tumble
//   · geometry is built imperatively and gets computeVertexNormals(), or a
//     standard material renders unlit
//   · the group is translated so the orbit pivots on the field, not on its corner
// Two 3D views of one field that disagree about which way is down would be worse
// than having only one.
//
// The FPS counter is measured from the render loop. It is the number that says
// whether the last thing you did was affordable — the question this viewport has to
// answer before a 10-million-cell grid is pointed at it.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { DigestedSurface } from '../../dataqc/types';
import { readSurfaceGrid } from '../../dataqc/readDigest';
import { buildSurfaceMesh, commonOrigin, sharedDepthRange, type MeshGrid } from './surface-mesh';
import { depthConvention, rampRgb } from './StructureLayer';
import { loadWellGeometry, buildPaths3D, type Path3D } from './well-geometry';
import { useStatic } from './static-store';
import type { Workspace } from './workspace-model';

interface Loaded { id: string; name: string; grid: MeshGrid }

export interface StudioStats {
  fps: number;
  tris: number;
  verts: number;
  dropped: number;
  surfaces: number;
  wells: number;
}

/** Rolling FPS from the render loop itself, so the number is the real frame cadence
 *  rather than a React render count. */
function FpsProbe({ onFps }: { onFps: (n: number) => void }) {
  const acc = useRef({ frames: 0, t: 0 });
  useFrame(() => {
    const now = performance.now();
    if (!acc.current.t) acc.current.t = now;
    acc.current.frames++;
    const dt = now - acc.current.t;
    if (dt >= 500) {
      onFps(Math.round((acc.current.frames * 1000) / dt));
      acc.current.frames = 0;
      acc.current.t = now;
    }
  });
  return null;
}

/** Areal decimation, so a large interpretation grid stays interactive. Reported to
 *  the HUD — a decimated view that looks like the model is how someone ends up
 *  quoting a number off a picture that was never the model. */
function strideFor(ncol: number, nrow: number): number {
  const nodes = ncol * nrow;
  if (nodes <= 60_000) return 1;
  if (nodes <= 250_000) return 2;
  if (nodes <= 1_000_000) return 3;
  return 4;
}

export function GeaStudio({ ws, onStats }: { ws: Workspace; onStats?: (s: StudioStats) => void }) {
  const visible = useStatic((s) => s.visibleHorizons);
  const zScale = useStatic((s) => s.zScale);
  const showWells = useStatic((s) => s.showWells);
  const showContact = useStatic((s) => s.showContact);
  const view = useStatic((s) => s.view);

  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [loading, setLoading] = useState(false);
  const [paths, setPaths] = useState<Path3D[]>([]);
  const [fps, setFps] = useState(0);

  // ── decode the selected horizons ──
  useEffect(() => {
    if (!visible.length) { setLoaded([]); return; }
    let alive = true;
    setLoading(true);
    (async () => {
      const out: Loaded[] = [];
      for (const id of visible) {
        const surf = ws.surfaces.find((s) => s.id === id);
        const asset = surf ? ws.assets.find((a) => a.id === surf.assetId) : null;
        if (!asset) continue;
        const g = (await readSurfaceGrid(asset).catch(() => null)) as DigestedSurface | null;
        if (!g) continue;
        out.push({
          id, name: surf!.name,
          grid: { ncol: g.ncol, nrow: g.nrow, values: g.values, x0: g.x0, y0: g.y0, dx: g.dx, dy: g.dy },
        });
      }
      if (alive) { setLoaded(out); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [visible, ws.surfaces, ws.assets]);

  // ── wellbore paths, from the same workspace query the map uses ──
  useEffect(() => {
    if (!showWells || !ws.fieldId) { setPaths([]); return; }
    let alive = true;
    loadWellGeometry(ws.fieldId)
      .then((geo) => { if (alive && geo) setPaths(buildPaths3D(geo)); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [showWells, ws.fieldId]);

  // ── build every mesh in one shared frame ──
  const built = useMemo(() => {
    if (!loaded.length) return null;
    const grids = loaded.map((l) => l.grid);
    const origin = commonOrigin(grids);
    if (!origin) return null;
    // the convention is READ from the data, exactly as the 2D layer reads it, so the
    // two views can never disagree about which way is down
    const conv = depthConvention(loaded[0].grid.values);
    const flip = conv?.flip ?? true;
    const range = sharedDepthRange(grids, flip);
    if (!range) return null;

    const span01 = (range.dmax - range.dmin) || 1;
    const colorAt = (d: number): [number, number, number] => {
      const [r, g, b] = rampRgb((d - range.dmin) / span01);
      return [r / 255, g / 255, b / 255];
    };

    const meshes: Array<{ id: string; name: string; geometry: THREE.BufferGeometry; stride: number; dropped: number; tris: number; verts: number }> = [];
    for (let i = 0; i < grids.length; i++) {
      const stride = strideFor(grids[i].ncol, grids[i].nrow);
      const m = buildSurfaceMesh(grids[i], { originX: origin.x, originY: origin.y, flip, zScale, colorAt, stride });
      if (!m) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
      g.setAttribute('color', new THREE.BufferAttribute(m.colors, 3));
      g.setIndex(new THREE.BufferAttribute(m.indices, 1));
      // without this a standard material has no normals to light and renders black
      g.computeVertexNormals();
      meshes.push({
        id: loaded[i].id, name: loaded[i].name, geometry: g, stride,
        dropped: m.droppedQuads, tris: m.indices.length / 3, verts: m.positions.length / 3,
      });
    }
    if (!meshes.length) return null;

    const spanX = Math.max(...grids.map((g) => g.x0 + g.dx * (g.ncol - 1))) - origin.x;
    const spanY = Math.max(...grids.map((g) => g.y0 + g.dy * (g.nrow - 1))) - origin.y;
    const midZ = -((range.dmin + range.dmax) / 2) * zScale;
    return { meshes, origin, flip, range, spanX, spanY, midZ };
  }, [loaded, zScale]);

  // dispose the previous set rather than leaking a BufferGeometry per rebuild — the
  // exaggeration slider rebuilds every mesh on every step
  useEffect(() => () => { built?.meshes.forEach((m) => m.geometry.dispose()); }, [built]);

  // ── trajectories, in the same local frame ──
  const pathLines = useMemo(() => {
    if (!built || !paths.length) return [];
    return paths.map((p) => {
      const pts = p.points.map(([x, y, tvd]) => new THREE.Vector3(
        x - built.origin.x, y - built.origin.y, -Math.abs(tvd) * zScale,
      ));
      const geometry = new THREE.BufferGeometry().setFromPoints(pts);
      // a THREE.Line object rather than a <line> element: in TSX that tag resolves
      // to SVG's line, not R3F's
      const material = new THREE.LineBasicMaterial({
        color: p.role === 'producer' ? 0x22c55e : p.role === 'injector' ? 0x60a5fa : 0x94a3b8,
        transparent: true, opacity: 0.85,
      });
      return { well: p.well, object: new THREE.Line(geometry, material) };
    });
  }, [paths, built, zScale]);

  useEffect(() => () => {
    pathLines.forEach((l) => { l.object.geometry.dispose(); (l.object.material as THREE.Material).dispose(); });
  }, [pathLines]);

  const stats: StudioStats = useMemo(() => ({
    fps,
    tris: built?.meshes.reduce((n, m) => n + m.tris, 0) ?? 0,
    verts: built?.meshes.reduce((n, m) => n + m.verts, 0) ?? 0,
    dropped: built?.meshes.reduce((n, m) => n + m.dropped, 0) ?? 0,
    surfaces: built?.meshes.length ?? 0,
    wells: pathLines.length,
  }), [fps, built, pathLines.length]);

  useEffect(() => { onStats?.(stats); }, [stats, onStats]);

  const contact = ws.contacts.find((c) => c.tvdss != null);

  if (!visible.length || !built) {
    return (
      <div className="gvs-void">
        <b>{loading ? 'Decoding surfaces…' : 'Nothing to draw'}</b>
        <span>
          {ws.surfaces.length
            ? 'Open “Make horizons” and choose from the ingested depth grids. The viewport draws what the model contains — never a placeholder of what it might.'
            : 'This delivery carries no depth grid, so there is no structure to draw.'}
        </span>
      </div>
    );
  }

  const span = Math.max(built.spanX, built.spanY);
  const cam = span * 1.15;

  return (
    <div className="gvs-canvas">
      <Canvas
        dpr={[1, 1.75]}
        /* Looking NORTH from the south, from a low elevation. The scene is in the
           grid's own frame — x east, y north, z up — but three's default camera up
           is +Y, which is NORTH here; +Z is what makes the orbit pivot correctly and
           the stacked horizons legible. */
        camera={{ position: [0, -cam * 1.05, cam * 0.34], up: [0, 0, 1], fov: 42, near: span / 500, far: span * 12 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor('#0b1017');
          camera.up.set(0, 0, 1);
          camera.lookAt(0, 0, 0);
        }}
      >
        <ambientLight intensity={0.74} />
        <directionalLight position={[1, -1, 2]} intensity={1.1} />
        <directionalLight position={[-1.4, 0.8, 0.6]} intensity={0.34} />
        <FpsProbe onFps={setFps} />

        <group position={[-built.spanX / 2, -built.spanY / 2, -built.midZ]}>
          {built.meshes.map((m, i) => (
            <mesh key={m.id} geometry={m.geometry}>
              {/* the shallower sheets go translucent, or with several opaque surfaces
                  you only ever see the top one */}
              <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.85} metalness={0.05}
                transparent={built.meshes.length > 1 && i < built.meshes.length - 1}
                opacity={built.meshes.length > 1 && i < built.meshes.length - 1 ? 0.62 : 1} />
            </mesh>
          ))}

          {showContact && contact?.tvdss != null && (
            <mesh position={[built.spanX / 2, built.spanY / 2, -Math.abs(contact.tvdss) * zScale]}>
              <planeGeometry args={[built.spanX, built.spanY]} />
              <meshBasicMaterial color="#e11d74" transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          )}

          {showWells && pathLines.map((l) => <primitive key={'p:' + l.well} object={l.object} />)}
        </group>

        <OrbitControls makeDefault enableDamping dampingFactor={0.08}
          /* 2D is the same scene locked overhead — one scene, two framings, so the
             map and the model can never disagree about where anything is */
          enableRotate={view !== '2d'} />
      </Canvas>

      {loading && <div className="gvs-loading">decoding surfaces…</div>}

      <div className="gvs-legend" title="One ramp across every selected horizon, so their depths are comparable">
        <b>{Math.round(built.range.dmin)}</b>
        <i />
        <b>{Math.round(built.range.dmax)} m</b>
        <em>TVDSS</em>
      </div>

      <div className="gvs-exag" title="Volve is ~7 km across with ~600 m of relief; at true scale it is a sheet of paper">
        <span>×{zScale} vertical</span>
        {built.meshes.some((m) => m.stride > 1) && (
          <span className="gvs-stride" title="Areal decimation — this view is coarser than the interpretation">
            stride {Math.max(...built.meshes.map((m) => m.stride))}
          </span>
        )}
      </div>
    </div>
  );
}
