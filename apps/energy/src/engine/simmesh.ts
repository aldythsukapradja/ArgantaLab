// simmesh.ts (G5) — build a single BufferGeometry that drapes the dynamic-sim areal grid
// (nx·ny) as a lit surface for the lightweight 3D HC-flow viewer. Each vertex carries a
// UV into the per-frame saturation texture, so the flood front animates by swapping the
// texture — never a geometry rebuild. Optional `zAt(x,y)` samples the real reservoir top
// (from a GVSURF depth surface) so the sheet follows structure; otherwise it's flat.
// Pure TS (no three/DOM) → runs in a Worker and is unit-testable.
//
// three space: px = x−cx (east), py = −(z−cz) (depth up), pz = y−cy (north). zExag is a
// mesh.scale.y in the viewer. UV = areal texcoord ((i+.5)/nx, (j+.5)/ny).
import type { MeshBuffers } from './gridmesh';

export interface SimGrid { nx: number; ny: number; dx: number; dy: number; x0: number; y0: number; active?: ArrayLike<number> }
export interface SimSurfaceOpts { zAt?: (x: number, y: number) => number | null }

export function buildSimSurface(g: SimGrid, opts: SimSurfaceOpts = {}): MeshBuffers {
  const { nx, ny, dx, dy, x0, y0 } = g;
  const wx = (i: number) => x0 + (i + 0.5) * dx;
  const wy = (j: number) => y0 + (j + 0.5) * dy;
  const isActive = (i: number, j: number) => !g.active || g.active[j * nx + i] >= 0.5;
  const depthAt = (i: number, j: number) => { const z = opts.zAt ? opts.zAt(wx(i), wy(j)) : 0; return z == null || !Number.isFinite(z) ? null : z; };

  // centre (cx,cy east/north; cz mean depth over live cells)
  const cx = x0 + (nx * dx) / 2, cy = y0 + (ny * dy) / 2;
  let zs = 0, zn = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (isActive(i, j)) { const d = depthAt(i, j); if (d != null) { zs += d; zn++; } }
  const cz = zn ? zs / zn : 0;

  // one vertex per live cell centre
  const vid = new Int32Array(nx * ny).fill(-1);
  const pos: number[] = [], uvw: number[] = [], nrm: number[] = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (!isActive(i, j)) continue;
    const d = depthAt(i, j); if (d == null) continue;
    vid[j * nx + i] = pos.length / 3;
    pos.push(wx(i) - cx, -(d - cz), wy(j) - cy);
    uvw.push((i + 0.5) / nx, (j + 0.5) / ny, 0);
    nrm.push(0, 0, 0);
  }

  // triangulate quads between four live neighbours; accumulate face normals
  const idx: number[] = [];
  const addN = (v: number, x: number, y: number, z: number) => { nrm[v * 3] += x; nrm[v * 3 + 1] += y; nrm[v * 3 + 2] += z; };
  const faceN = (a: number, b: number, c: number) => {
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
    const ux = pos[b * 3] - ax, uy = pos[b * 3 + 1] - ay, uz = pos[b * 3 + 2] - az;
    const vx = pos[c * 3] - ax, vy = pos[c * 3 + 1] - ay, vz = pos[c * 3 + 2] - az;
    let nx2 = uy * vz - uz * vy, ny2 = uz * vx - ux * vz, nz2 = ux * vy - uy * vx;
    if (ny2 < 0) { nx2 = -nx2; ny2 = -ny2; nz2 = -nz2; } // face up
    addN(a, nx2, ny2, nz2); addN(b, nx2, ny2, nz2); addN(c, nx2, ny2, nz2);
  };
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = vid[j * nx + i], b = vid[j * nx + i + 1], c = vid[(j + 1) * nx + i + 1], d = vid[(j + 1) * nx + i];
    if (a < 0 || b < 0 || c < 0 || d < 0) continue;
    idx.push(a, b, c, a, c, d); faceN(a, b, c); faceN(a, c, d);
  }

  // normalise accumulated normals
  for (let v = 0; v < pos.length / 3; v++) {
    const x = nrm[v * 3], y = nrm[v * 3 + 1], z = nrm[v * 3 + 2], l = Math.hypot(x, y, z) || 1;
    nrm[v * 3] = x / l; nrm[v * 3 + 1] = y / l; nrm[v * 3 + 2] = z / l;
  }

  const position = new Float32Array(pos), normal = new Float32Array(nrm), uv = new Float32Array(uvw);
  const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < position.length; v += 3) for (let a = 0; a < 3; a++) { const val = position[v + a]; if (val < min[a]) min[a] = val; if (val > max[a]) max[a] = val; }
  return { position, normal, uvw: uv, index: new Uint32Array(idx), center: [cx, cy, cz], bounds: { min, max } };
}
