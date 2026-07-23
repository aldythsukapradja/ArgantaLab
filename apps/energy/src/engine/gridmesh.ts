// gridmesh.ts (G3) — build the GPU geometry for a PackedGrid3D: the reservoir SHELL
// (top surface + base surface + boundary side-walls) and a vertical SECTION (the
// X-section), as a single BufferGeometry each. Pure TS (no three/DOM) so it runs in a
// Worker and is unit-testable. Positions are centred + depth-up (three space); a per-
// vertex UVW indexes the property Data3DTexture, so recolour/attribute/timestep never
// rebuilds geometry. Millions of cells → O(shell) faces, one draw call.
//
// three space: px = x−cx (east), py = −(z−cz) (depth up), pz = y−cy (north). zExag is a
// mesh.scale.y in the viewer (no rebuild). UVW = cell-centre texcoord ((i+.5)/nx, …).
import type { PackedGrid3D } from './pack3d';

export interface MeshBuffers {
  position: Float32Array;   // [n·3] centred, depth-up
  normal: Float32Array;     // [n·3]
  uvw: Float32Array;        // [n·3] Data3DTexture coord in [0,1]
  index: Uint32Array;       // triangle indices
  center: [number, number, number]; // (cx, cy, cz) world centre used
  bounds: { min: [number, number, number]; max: [number, number, number] };
}

const col = (p: PackedGrid3D, i: number, k: number) => k * p.nx + i;
const active = (p: PackedGrid3D, i: number, k: number) =>
  i >= 0 && k >= 0 && i < p.nx && k < p.ny && p.activeCol[col(p, i, k)] === 1;

/** world centre (cx,cy east/north, cz mean depth) used to centre all geometry. */
function centreOf(p: PackedGrid3D): [number, number, number] {
  const cx = p.x0 + (p.nx * p.dx) / 2, cy = p.y0 + (p.ny * p.dy) / 2;
  let zs = 0, n = 0;
  for (let c = 0; c < p.activeCol.length; c++) if (p.activeCol[c]) { zs += (p.topZ[c] + p.baseZ[c]) / 2; n++; }
  return [cx, cy, n ? zs / n : 0];
}

// simple growable buffers
class Buf {
  pos: number[] = []; nrm: number[] = []; uvw: number[] = []; idx: number[] = [];
  vert(px: number, py: number, pz: number, nx: number, ny: number, nz: number, u: number, v: number, w: number) {
    this.pos.push(px, py, pz); this.nrm.push(nx, ny, nz); this.uvw.push(u, v, w); return this.pos.length / 3 - 1;
  }
  quad(a: number, b: number, c: number, d: number) { this.idx.push(a, b, c, a, c, d); }
}

/** Shell = top surface + base surface + boundary side-walls, coloured by the volume texture. */
export function buildShell(p: PackedGrid3D): MeshBuffers {
  const [cx, cy, cz] = centreOf(p);
  const b = new Buf();
  const { nx, ny, nz, dx, dy } = p;
  const Y = (depth: number) => -(depth - cz);          // depth up
  const U = (i: number) => (i + 0.5) / nx, V = (k: number) => (k + 0.5) / ny, W = (l: number) => (l + 0.5) / nz;

  // top (l=0) and base (l=nz-1) surfaces — per-cell quads (robust to the active mask)
  for (const [depthOf, wl, ny3] of [
    [(i: number, k: number) => p.topZ[col(p, i, k)], W(0), 1] as const,
    [(i: number, k: number) => p.baseZ[col(p, i, k)], W(nz - 1), -1] as const,
  ]) {
    for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) {
      if (!active(p, i, k)) continue;
      const d = depthOf(i, k), y = Y(d);
      const x0 = p.x0 + i * dx - cx, x1 = p.x0 + (i + 1) * dx - cx;
      const z0 = p.y0 + k * dy - cy, z1 = p.y0 + (k + 1) * dy - cy;
      const u = U(i), v = V(k);
      const n0 = b.vert(x0, y, z0, 0, ny3, 0, u, v, wl);
      const n1 = b.vert(x1, y, z0, 0, ny3, 0, u, v, wl);
      const n2 = b.vert(x1, y, z1, 0, ny3, 0, u, v, wl);
      const n3 = b.vert(x0, y, z1, 0, ny3, 0, u, v, wl);
      if (ny3 > 0) b.quad(n0, n1, n2, n3); else b.quad(n0, n3, n2, n1);
    }
  }

  // side-walls around the active boundary (one quad per exposed edge), subdivided by layer
  const wall = (i: number, k: number, di: number, dk: number) => {
    if (active(p, i + di, k + dk)) return; // neighbour present → interior edge, skip
    const c = col(p, i, k), top = p.topZ[c], base = p.baseZ[c];
    // edge endpoints (the shared face between cell and the absent neighbour)
    const ex0 = p.x0 + (i + (di > 0 ? 1 : 0) + (dk !== 0 ? 0 : 0)) * dx;
    // build the two horizontal corners of this vertical face
    let ax, az, bx, bz;
    if (di !== 0) { const xx = p.x0 + (i + (di > 0 ? 1 : 0)) * dx - cx; ax = xx; az = p.y0 + k * dy - cy; bx = xx; bz = p.y0 + (k + 1) * dy - cy; }
    else { const zz = p.y0 + (k + (dk > 0 ? 1 : 0)) * dy - cy; ax = p.x0 + i * dx - cx; az = zz; bx = p.x0 + (i + 1) * dx - cx; bz = zz; }
    void ex0;
    const nrm: [number, number, number] = di !== 0 ? [di, 0, 0] : [0, 0, dk];
    for (let l = 0; l < nz; l++) {
      const yT = Y(top + (l / nz) * (base - top)), yB = Y(top + ((l + 1) / nz) * (base - top));
      const w = W(l), u = U(i), v = V(k);
      const a0 = b.vert(ax, yT, az, nrm[0], 0, nrm[2], u, v, w);
      const a1 = b.vert(bx, yT, bz, nrm[0], 0, nrm[2], u, v, w);
      const a2 = b.vert(bx, yB, bz, nrm[0], 0, nrm[2], u, v, w);
      const a3 = b.vert(ax, yB, az, nrm[0], 0, nrm[2], u, v, w);
      b.quad(a0, a1, a2, a3);
    }
  };
  for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) {
    if (!active(p, i, k)) continue;
    wall(i, k, -1, 0); wall(i, k, 1, 0); wall(i, k, 0, -1); wall(i, k, 0, 1);
  }

  return finalize(b, [cx, cy, cz]);
}

/** Vertical section (the X-section): slice the volume at a constant i (axis 'i') or k
 * (axis 'k'); a (n × nz) quad grid whose vertices carry the property UVW. */
export function buildSection(p: PackedGrid3D, axis: 'i' | 'k', index: number): MeshBuffers {
  const [cx, cy, cz] = centreOf(p);
  const b = new Buf();
  const { nx, ny, nz, dx, dy } = p;
  const Y = (depth: number) => -(depth - cz);
  const n = axis === 'i' ? ny : nx;
  const iOf = (t: number) => (axis === 'i' ? index : t);
  const kOf = (t: number) => (axis === 'i' ? t : index);
  const nrm: [number, number, number] = axis === 'i' ? [1, 0, 0] : [0, 0, 1];
  // grid of (n+1) columns × (nz+1) rows of vertices along the slice
  const vid: number[][] = [];
  for (let t = 0; t <= n; t++) {
    vid[t] = [];
    const ti = Math.min(n - 1, t), i = iOf(ti), k = kOf(ti);
    const c = col(p, Math.min(nx - 1, iOf(Math.min(n - 1, t))), Math.min(ny - 1, kOf(Math.min(n - 1, t))));
    const top = p.topZ[c], base = p.baseZ[c];
    const x = axis === 'i' ? p.x0 + (index + 0.5) * dx - cx : p.x0 + t * dx - cx;
    const z = axis === 'i' ? p.y0 + t * dy - cy : p.y0 + (index + 0.5) * dy - cy;
    const u = (i + 0.5) / nx, v = (k + 0.5) / ny;
    for (let l = 0; l <= nz; l++) {
      const depth = Number.isFinite(top) && Number.isFinite(base) ? top + (l / nz) * (base - top) : NaN;
      vid[t][l] = b.vert(x, Y(depth || cz), z, nrm[0], nrm[1], nrm[2], u, v, Math.min(0.999, (l + 0.5) / nz));
    }
  }
  for (let t = 0; t < n; t++) for (let l = 0; l < nz; l++) {
    const iSrc = Math.min(nx - 1, iOf(t)), kSrc = Math.min(ny - 1, kOf(t));
    if (!active(p, iSrc, kSrc)) continue;
    b.quad(vid[t][l], vid[t + 1][l], vid[t + 1][l + 1], vid[t][l + 1]);
  }
  return finalize(b, [cx, cy, cz]);
}

function finalize(b: Buf, center: [number, number, number]): MeshBuffers {
  const position = new Float32Array(b.pos), normal = new Float32Array(b.nrm), uvw = new Float32Array(b.uvw);
  const index = new Uint32Array(b.idx);
  const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < position.length; v += 3) for (let a = 0; a < 3; a++) {
    const val = position[v + a]; if (val < min[a]) min[a] = val; if (val > max[a]) max[a] = val;
  }
  return { position, normal, uvw, index, center, bounds: { min, max } };
}
