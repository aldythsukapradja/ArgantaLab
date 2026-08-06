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
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { DigestedSurface } from '../../dataqc/types';
import { readSurfaceGrid } from '../../dataqc/readDigest';
import { buildSurfaceMesh, commonOrigin, sharedDepthRange, type MeshGrid } from './surface-mesh';
import { buildShell, cornerDepths, nodeDepthAt } from '../../engine/gridmesh';
import { GeaNavBar } from './GeaNavBar';
import { SectionDrawer } from './SectionDrawer';
import {
  colorTable, normalise, propRange, rampColor, styleFor, axisExtent,
} from './prop-view';
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
  /** cells in the built grid — 0 until "Build 3D grid" has run */
  gridCells: number;
  /** faces on its shell; the ratio to gridCells is the whole rendering argument */
  gridFaces: number;
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

/** Applies the clear colour on every change — `onCreated` only fires once, so a theme
 *  switch while the scene is mounted would otherwise never reach the renderer. */
function SkyColor({ color }: { color: string }) {
  const { gl } = useThree();
  useEffect(() => { gl.setClearColor(color); }, [gl, color]);
  return null;
}

export function GeaStudio({ ws, onStats }: { ws: Workspace; onStats?: (s: StudioStats) => void }) {
  const visible = useStatic((s) => s.visibleHorizons);
  const zScale = useStatic((s) => s.zScale);
  // the packed property arrays are rewritten IN PLACE, so identity never changes —
  // this counter is what tells every property memo the data underneath it moved
  const propsVersion = useStatic((s) => s.propsVersion);

  // ── THEME ──
  //
  // The scene is drawn into a page that has a light mode, and a black viewport in a
  // light document is not a style choice, it is a hole. `data-theme` is set on <html>
  // by the shell, so the canvas follows it — and it is WATCHED, because the user can
  // switch theme while the scene is mounted and a clear colour set once at creation
  // would stay dark for the rest of the session.
  const [dark, setDark] = useState(() =>
    typeof document === 'undefined' || document.documentElement.getAttribute('data-theme') !== 'light');
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    const read = () => setDark(html.getAttribute('data-theme') !== 'light');
    read();
    const mo = new MutationObserver(read);
    mo.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);
  const sky = dark ? '#0b1017' : '#eef2f7';

  // ── viewport controls, from the STORE ──
  //
  // Shared with the 2D pane so the section map follows the K player and both views
  // colour by the same property. Only `playing` and `sectionMode` stay local — they are
  // this widget's own transient UI, not model state.
  const propKey = useStatic((s) => s.propKey);
  const setPropKey = useStatic((s) => s.setProp);
  const sliceOn = useStatic((s) => s.sliceOn);
  const setSliceOn = useStatic((s) => s.setSliceOn);
  const axis = useStatic((s) => s.sliceAxis);
  const setAxis = useStatic((s) => s.setSliceAxis);
  const sliceIx = useStatic((s) => s.sliceIndex);
  const setSliceIx = useStatic((s) => s.setSliceIndex);
  const secPts = useStatic((s) => s.sectionPoints);
  const setSecPts = useStatic((s) => s.setSectionPoints);
  const showShell = useStatic((s) => s.showShell);
  const setShowShell = useStatic((s) => s.setShowShell);
  const showEdges = useStatic((s) => s.showEdges);
  const propRampMap = useStatic((s) => s.propRamp);
  const propRangeMap = useStatic((s) => s.propRange);
  const setPropRamp = useStatic((s) => s.setPropRamp);
  const setPropRange = useStatic((s) => s.setPropRange);
  const setShowEdges = useStatic((s) => s.setShowEdges);
  const [playing, setPlaying] = useState(false);
  const [sectionMode, setSectionMode] = useState(false);
  const showWells = useStatic((s) => s.showWells);
  const visibleWells = useStatic((s) => s.visibleWells);
  const showContact = useStatic((s) => s.showContact);
  const view = useStatic((s) => s.view);
  const grid = useStatic((s) => s.grid);

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
  //
  // The frame used to come only from the loaded SURFACES, so deselecting every horizon
  // left `built` null and the whole scene — the 3D grid included — was replaced by an
  // empty-state message. A grid is an artifact in its own right: once built it does not
  // stop existing because you stopped drawing the horizons it was built from.
  // `gridFrame` below is the fallback, derived from the grid's own extent.
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

  // ── the built grid, as a SHELL ──
  //
  // gridmesh.buildShell emits a centred mesh with per-vertex UVW; ask for the z-up
  // (east, north, up) frame so it shares the scene's axes with the horizon surfaces
  // for a Data3DTexture, so property colouring later costs one texture upload rather
  // than a geometry rebuild. Its own centring is undone here (the scene has its own
  // origin) and the Z exaggeration is applied as a mesh scale, which is why changing
  // exaggeration does NOT rebuild the shell.
  const gridShell = useMemo(() => {
    if (!grid?.packed) return null;
    // 'z' — the SAME frame surface-mesh.ts uses and the scene declares (x east,
    // y north, z up). The default 'y' is three's Y-up and put the grid on its edge
    // beside the horizon maps.
    const m = buildShell(grid.packed, 'z');
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(m.position, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(m.normal, 3));
    geometry.setAttribute('uvw', new THREE.BufferAttribute(m.uvw, 3));
    geometry.setIndex(new THREE.BufferAttribute(m.index, 1));
    return {
      geometry, uvw: m.uvw,
      cx: m.center[0], cy: m.center[1], cz: m.center[2],
      faces: m.index.length / 3,
    };
  }, [grid]);

  // ── the property, and the range the legend and the mesh SHARE ──
  const packedProp = useMemo(() => {
    const props = grid?.packed?.props ?? [];
    return props.find((x) => x.name === propKey) ?? props[0] ?? null;
  }, [grid, propKey, propsVersion]);

  const autoRange = useMemo(
    () => (grid?.packed && packedProp
      ? propRange(grid.packed, packedProp)
      : { lo: 0, hi: 1, n: 0, dataMin: NaN, dataMax: NaN, clippedLo: 0, clippedHi: 0 }),
    [grid, packedProp, propsVersion],
  );
  // a pinned range wins; otherwise auto tracks the data
  const pinned = packedProp ? propRangeMap[packedProp.name] : undefined;
  const range = pinned ?? autoRange;
  const rampId = packedProp ? propRampMap[packedProp.name] : undefined;

  const table = useMemo(
    () => (packedProp ? colorTable(styleFor(packedProp.name, rampId), range.lo, range.hi) : null),
    [packedProp, range, rampId],
  );

  // ── colour the shell, per vertex, from its own UVW ──
  //
  // buildShell emits a cell-centre UVW per vertex precisely so a property can be looked
  // up without touching the geometry. Colouring on the CPU (rather than through a
  // Data3DTexture and a custom shader) keeps this on the standard lit material, and a
  // property switch rewrites one Float32Array instead of rebuilding a mesh.
  useEffect(() => {
    const g = gridShell?.geometry, p = grid?.packed;
    if (!g || !p || !packedProp || !gridShell) return;
    const style = styleFor(packedProp.name, rampId);
    const uvw = gridShell.uvw;
    const n = uvw.length / 3;
    const col = new Float32Array(n * 3);
    const span = packedProp.dtype === 'u8' ? 255 : 65535;
    for (let v = 0; v < n; v++) {
      // UVW are cell-CENTRE coordinates, so floor(u·nx) recovers the cell index
      const i = Math.min(p.nx - 1, Math.max(0, Math.floor(uvw[v * 3] * p.nx)));
      const j = Math.min(p.ny - 1, Math.max(0, Math.floor(uvw[v * 3 + 1] * p.ny)));
      const l = Math.min(p.nz - 1, Math.max(0, Math.floor(uvw[v * 3 + 2] * p.nz)));
      const raw = packedProp.data[l * (p.nx * p.ny) + j * p.nx + i];
      const val = packedProp.categorical ? raw : packedProp.min + (raw / span) * (packedProp.max - packedProp.min);
      const hexc = packedProp.categorical
        ? (style.codes?.find((c) => c.code === Math.round(val))?.color ?? '#888888')
        : rampColor(style.stops ?? [], normalise(style, val, range.lo, range.hi));
      const h = hexc.replace('#', '');
      col[v * 3] = parseInt(h.slice(0, 2), 16) / 255;
      col[v * 3 + 1] = parseInt(h.slice(2, 4), 16) / 255;
      col[v * 3 + 2] = parseInt(h.slice(4, 6), 16) / 255;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.attributes.color.needsUpdate = true;
  }, [gridShell, grid, packedProp, range, propsVersion, rampId]);

  // scrubbing must never point past the end of a shorter axis
  const extent = grid?.packed ? axisExtent(grid.packed, axis) : 1;
  useEffect(() => { if (sliceIx >= extent) setSliceIx(Math.max(0, extent - 1)); }, [extent, sliceIx]);

  // ── THE SLICE ITSELF ──
  //
  // The nav bar's controls are only controls; this is what makes them do something.
  // A slice is built as its own small geometry — one quad per cell of the cut, coloured
  // from the same ramp and the same range as the shell — rather than by hiding parts of
  // the shell, because the shell is only the outer skin and has no interior faces to
  // reveal. I and J cut vertically; K is one layer in map view.
  const sliceMesh = useMemo(() => {
    const p = grid?.packed;
    if (!p || !sliceOn || !packedProp) return null;
    const style = styleFor(packedProp.name, rampId);
    const span = packedProp.dtype === 'u8' ? 255 : 65535;
    const nCol = p.nx * p.ny;
    const cz = gridShell?.cz ?? 0;

    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const rgb = (v: number) => {
      const h = (packedProp.categorical
        ? (style.codes?.find((c) => c.code === Math.round(v))?.color ?? '#888888')
        : rampColor(style.stops ?? [], normalise(style, v, range.lo, range.hi))).replace('#', '');
      return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
    };
    const quad = (a: number[], b: number[], c: number[], d: number[], v: number) => {
      const n = pos.length / 3;
      pos.push(...a, ...b, ...c, ...d);
      const cc = rgb(v);
      for (let t = 0; t < 4; t++) col.push(...cc);
      idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
    };
    const X = (i: number) => p.x0 + i * p.dx;
    const Yn = (j: number) => p.y0 + j * p.dy;
    const Z = (d: number) => -(d - cz);

    // ── THE SLICE IS A SHEET, NOT A PILE OF TILES ────────────────────────────
    //
    // Each cell used to be drawn as a flat quad at its own centre depth. Its down-dip
    // neighbour is a flat quad at a different depth, and nothing closed the vertical
    // step between them — so on a dipping structure the slice was a venetian blind you
    // could see the background through, and ×3 exaggeration tripled every gap. It read
    // as a sparse, broken model; the model was never sparse.
    //
    // Node-shared depths make adjacent quads meet on identical corners.
    const cd = cornerDepths(p);
    const nodeZ = (i: number, j: number, f: number) => nodeDepthAt(cd, i, j, f);

    const cellVal = (i: number, j: number, l: number) => {
      const c = j * p.nx + i;
      if (!p.activeCol[c]) return NaN;
      const raw = packedProp.data[l * nCol + c];
      return packedProp.categorical ? raw : packedProp.min + (raw / span) * (packedProp.max - packedProp.min);
    };

    if (axis === 'k') {
      const l = Math.min(p.nz - 1, sliceIx);
      // the layer's own mid-surface, sampled at the four shared NODES of the cell
      const f = (l + 0.5) / p.nz;
      for (let j = 0; j < p.ny; j++) for (let i = 0; i < p.nx; i++) {
        const c = j * p.nx + i;
        if (!p.activeCol[c]) continue;
        const v = cellVal(i, j, l);
        if (!Number.isFinite(v)) continue;
        const z00 = nodeZ(i, j, f), z10 = nodeZ(i + 1, j, f);
        const z11 = nodeZ(i + 1, j + 1, f), z01 = nodeZ(i, j + 1, f);
        // a node no active cell touches has no depth; drawing it would plant a corner
        // at the datum, kilometres above the reservoir
        if (![z00, z10, z11, z01].every(Number.isFinite)) continue;
        quad([X(i), Yn(j), Z(z00)], [X(i + 1), Yn(j), Z(z10)],
             [X(i + 1), Yn(j + 1), Z(z11)], [X(i), Yn(j + 1), Z(z01)], v);
      }
    } else {
      // A vertical panel has the SAME problem in its own plane: each column drew its
      // layer boundaries from its own top and base, so the boundary jumped between
      // adjacent columns and left a horizontal crack the whole way down the section.
      const fixed = Math.min(axis === 'i' ? p.nx - 1 : p.ny - 1, sliceIx);
      const n = axis === 'i' ? p.ny : p.nx;
      for (let t = 0; t < n; t++) {
        const i = axis === 'i' ? fixed : t, j = axis === 'i' ? t : fixed;
        const c = j * p.nx + i;
        if (!p.activeCol[c]) continue;
        // the two NODES bounding this cell along the section
        const n0: [number, number] = axis === 'i' ? [i, j] : [i, j];
        const n1: [number, number] = axis === 'i' ? [i, j + 1] : [i + 1, j];
        for (let l = 0; l < p.nz; l++) {
          const v = cellVal(i, j, l);
          if (!Number.isFinite(v)) continue;
          const fT = l / p.nz, fB = (l + 1) / p.nz;
          const aT = nodeZ(n0[0], n0[1], fT), bT = nodeZ(n1[0], n1[1], fT);
          const aB = nodeZ(n0[0], n0[1], fB), bB = nodeZ(n1[0], n1[1], fB);
          if (![aT, bT, aB, bB].every(Number.isFinite)) continue;
          quad([X(n0[0]), Yn(n0[1]), Z(aT)], [X(n1[0]), Yn(n1[1]), Z(bT)],
               [X(n1[0]), Yn(n1[1]), Z(bB)], [X(n0[0]), Yn(n0[1]), Z(aB)], v);
        }
      }
    }
    if (!pos.length) return null;
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(pos), 3));
    g2.setAttribute('color', new THREE.BufferAttribute(Float32Array.from(col), 3));
    g2.setIndex(idx);
    g2.computeVertexNormals();
    return { geometry: g2, quads: idx.length / 6 };
  }, [grid, sliceOn, packedProp, axis, sliceIx, range, gridShell, propsVersion, rampId]);

  useEffect(() => () => { gridShell?.geometry.dispose(); }, [gridShell]);

  // ── trajectories, in the same local frame ──
  // A frame from the GRID alone, for when no horizon is drawn.
  //
  // A grid is an artifact in its own right: once built it does not stop existing
  // because you stopped drawing the horizons it was built from. Without this, clearing
  // the horizon selection replaced the entire scene — grid included — with an
  // empty-state message.
  const gridFrame = useMemo(() => {
    const p = grid?.packed;
    if (!p) return null;
    let zLo = Infinity, zHi = -Infinity;
    for (let c = 0; c < p.topZ.length; c++) {
      const t = p.topZ[c], b = p.baseZ[c];
      if (Number.isFinite(t) && t < zLo) zLo = t;
      if (Number.isFinite(b) && b > zHi) zHi = b;
    }
    if (!Number.isFinite(zLo) || !Number.isFinite(zHi)) return null;
    return {
      meshes: [] as Array<{ id: string; name: string; geometry: THREE.BufferGeometry; stride: number; dropped: number; tris: number; verts: number }>,
      origin: { x: p.x0, y: p.y0 },
      spanX: p.nx * p.dx, spanY: p.ny * p.dy,
      midZ: -((zLo + zHi) / 2) * zScale,
      dropped: 0, tris: 0, verts: 0,
      range: null as null | { dmin: number; dmax: number },
    };
  }, [grid, zScale]);

  /** whichever frame exists — surfaces preferred, grid as the fallback */
  const frame = built ?? gridFrame;

  const pathLines = useMemo(() => {
    if (!built || !paths.length) return [];
    if (!frame) return [];
    const org = frame.origin;
    return paths.map((p) => {
      const pts = p.points.map(([x, y, tvd]) => new THREE.Vector3(
        x - org.x, y - org.y, -Math.abs(tvd) * zScale,
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
    tris: (built?.meshes.reduce((n, m) => n + m.tris, 0) ?? 0) + (gridShell?.faces ?? 0),
    verts: built?.meshes.reduce((n, m) => n + m.verts, 0) ?? 0,
    dropped: built?.meshes.reduce((n, m) => n + m.dropped, 0) ?? 0,
    surfaces: built?.meshes.length ?? 0,
    wells: pathLines.length,
    gridCells: grid ? grid.cells : 0,
    gridFaces: gridShell?.faces ?? 0,
  }), [fps, built, pathLines.length, grid, gridShell]);

  useEffect(() => { onStats?.(stats); }, [stats, onStats]);

  const contact = ws.contacts.find((c) => c.tvdss != null);

  // Only genuinely empty when there is NEITHER a surface NOR a grid.
  if (!frame) {
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

  const span = Math.max(frame.spanX, frame.spanY);
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
          gl.setClearColor(sky);
          camera.up.set(0, 0, 1);
          camera.lookAt(0, 0, 0);
        }}
      >
        {/* re-applied on every theme change; onCreated fires once and would not */}
        <SkyColor color={sky} />
        <ambientLight intensity={dark ? 0.74 : 0.95} />
        <directionalLight position={[1, -1, 2]} intensity={dark ? 1.1 : 0.85} />
        <directionalLight position={[-1.4, 0.8, 0.6]} intensity={0.34} />
        <FpsProbe onFps={setFps} />

        <group position={[-frame.spanX / 2, -frame.spanY / 2, -frame.midZ]}>
          {/* the built 3D grid, drawn as its SHELL — 10 million cells have only a few
              hundred thousand visible faces, and the interior is never a face */}
          {/* When the player is on, the SHELL IS HIDDEN. The shell is the outer skin of
              the whole model, so drawing it over a slice buries the very cells the
              player exists to expose — you would be looking at the outside of the box
              while scrubbing through its inside. */}
          {gridShell && showShell && !sliceOn && (
            <mesh geometry={gridShell.geometry}
              // buildShell centres its geometry on the grid's own mean depth, so the
              // Z centring has to be undone here exactly as the XY centring is. Leaving
              // z at 0 floats the whole grid cz·zScale above the horizons it was built
              // from — on Volve that is ~3.1 km, which is why the viewport showed a
              // block hanging in space with the wells stretched down to reach it.
              position={[gridShell.cx - frame.origin.x, gridShell.cy - frame.origin.y,
                         -gridShell.cz * zScale]}
              scale={[1, 1, zScale]}>
              {/* OPAQUE, and front-faced. At 0.92 alpha on a DoubleSide closed shell
                  you see the base sheet and the layer-banded perimeter walls THROUGH
                  the top one, and the interference reads as combs of missing cells. It
                  was never gaps — it was two surfaces and twenty wall bands showing
                  through each other. A grid should look like rock. */}
              <meshStandardMaterial vertexColors roughness={0.82} metalness={0.02}
                side={THREE.FrontSide} flatShading={false} />
            </mesh>
          )}

          {/* The cell-edge overlay. A shaded skin reads as a lump of geology; the edges
              are what make it read as a GRID — and they are the only way to judge the
              layering and the areal resolution by eye. Drawn from the same geometry, so
              it costs a draw call rather than a rebuild. */}
          {gridShell && showShell && !sliceOn && showEdges && (
            <lineSegments position={[gridShell.cx - frame.origin.x, gridShell.cy - frame.origin.y,
                                     -gridShell.cz * zScale]}
              scale={[1, 1, zScale]}>
              <wireframeGeometry args={[gridShell.geometry]} />
              <lineBasicMaterial color={dark ? '#0f172a' : '#475569'} transparent opacity={0.35} />
            </lineSegments>
          )}
          {/* the IJK slice — same ramp, same range, same frame as the shell */}
          {sliceMesh && (
            <mesh geometry={sliceMesh.geometry}
              position={[-frame.origin.x, -frame.origin.y, -(gridShell?.cz ?? 0) * zScale]}
              scale={[1, 1, zScale]}>
              {/* a cut face is looked at from both sides, so DoubleSide stays — but it
                  is opaque, or the cells behind it bleed through the one being read */}
              <meshStandardMaterial vertexColors side={THREE.DoubleSide}
                roughness={0.85} metalness={0.04} />
            </mesh>
          )}
          {/* ── OCCLUDERS ARE HIDDEN WHILE THE PLAYER IS ON ──
              Hiding the shell was not enough. A horizon surface is a full-extent sheet:
              on a K slice it sandwiches the layer, and on an I or J slice it cuts
              straight across the panel — with the deepest one opaque, a vertical cut is
              hidden almost completely. "Show me cell row i" has to mean row i, not row
              i behind six surfaces. Wells stay: they are thin lines, they occlude
              nothing, and without them a bare slice has no spatial anchor. */}
          {!sliceOn && frame.meshes.map((m, i) => (
            <mesh key={m.id} geometry={m.geometry}>
              {/* the shallower sheets go translucent, or with several opaque surfaces
                  you only ever see the top one */}
              <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.85} metalness={0.05}
                transparent={frame.meshes.length > 1 && i < frame.meshes.length - 1}
                opacity={frame.meshes.length > 1 && i < frame.meshes.length - 1 ? 0.62 : 1} />
            </mesh>
          ))}

          {showContact && !sliceOn && contact?.tvdss != null && (
            <mesh position={[frame.spanX / 2, frame.spanY / 2, -Math.abs(contact.tvdss) * zScale]}>
              <planeGeometry args={[frame.spanX, frame.spanY]} />
              <meshBasicMaterial color="#2f80ed" transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          )}

          {showWells && pathLines
            // null = all; [] = the user switched every one off, which is not the same
            .filter((l) => visibleWells === null || visibleWells.includes(l.well))
            .map((l) => <primitive key={'p:' + l.well} object={l.object} />)}
        </group>

        <OrbitControls makeDefault enableDamping dampingFactor={0.08}
          /* 2D is the same scene locked overhead — one scene, two framings, so the
             map and the model can never disagree about where anything is */
          enableRotate={view !== '2d'} />
      </Canvas>

      {/* ── top bar: property · colour table · IJK player · section ── */}
      {grid?.packed && (
        <GeaNavBar
          propKey={packedProp?.name ?? propKey} onProp={setPropKey}
          available={(grid.packed.props ?? []).map((x) => x.name)}
          table={table}
          rangeInfo={autoRange}
          rampId={rampId ?? styleFor(packedProp?.name ?? 'phi').rampId}
          onRamp={(id) => packedProp && setPropRamp(packedProp.name, id)}
          onRange={(r) => packedProp && setPropRange(packedProp.name, r)}
          pinned={!!pinned}
          sliceOn={sliceOn} onSliceOn={setSliceOn}
          axis={axis} onAxis={(a) => { setAxis(a); setSliceIx(0); }}
          index={sliceIx} onIndex={setSliceIx} extent={extent}
          playing={playing} onPlaying={setPlaying}
          sectionMode={sectionMode} onSectionMode={setSectionMode}
          sectionPoints={secPts.length} onClearSection={() => setSecPts([])}
          showShell={showShell} onShowShell={setShowShell}
          showEdges={showEdges} onShowEdges={setShowEdges}
        />
      )}

      {/* ── the 2D section drawer, over the viewport ── */}
      {sectionMode && grid?.packed && packedProp && (
        <div className="gvs-section-overlay">
          <SectionDrawer
            grid={grid.packed as never}
            prop={packedProp}
            lo={range.lo} hi={range.hi}
            layer={axis === 'k' ? sliceIx : 0}
            points={secPts} onPoints={setSecPts}
            wells={ws.bores
              .filter((b) => b.x != null && b.y != null)
              .map((b) => ({ name: b.name, x: b.x as number, y: b.y as number,
                producer: b.role === 'oil-producer', injector: /inject/i.test(String(b.role ?? '')) }))}
          />
        </div>
      )}

      {loading && <div className="gvs-loading">decoding surfaces…</div>}

      {/* the depth ramp describes the SURFACES; with none drawn there is nothing for
          it to describe, and a legend for an absent thing is worse than no legend */}
      {built?.range && (
        <div className="gvs-legend" title="One ramp across every selected horizon, so their depths are comparable">
          <b>{Math.round(built.range.dmin)}</b>
          <i />
          <b>{Math.round(built.range.dmax)} m</b>
          <em>TVDSS</em>
        </div>
      )}

      <div className="gvs-exag" title="Volve is ~7 km across with ~600 m of relief; at true scale it is a sheet of paper">
        <span>×{zScale} vertical</span>
        {!!built?.meshes.some((m) => m.stride > 1) && (
          <span className="gvs-stride" title="Areal decimation — this view is coarser than the interpretation">
            stride {Math.max(...built.meshes.map((m) => m.stride))}
          </span>
        )}
      </div>
    </div>
  );
}
