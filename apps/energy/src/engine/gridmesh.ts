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

/** Shell = ONE continuous solid skin (Petrel-style): a smooth top surface + smooth base
 * surface that share corner positions (no gaps, no per-cell stair-steps / floating boxes)
 * plus layer-banded walls around the OUTER perimeter of the whole active region. Corner
 * depths are averaged over the up-to-4 active cells touching each grid corner, so the body
 * reads as one geologic solid. Per-cell UVW is kept (crisp property colouring) by emitting
 * duplicate verts at matching corner positions — visually watertight, cell-accurate colour. */
export function buildShell(p: PackedGrid3D): MeshBuffers {
  const [cx, cy, cz] = centreOf(p);
  const b = new Buf();
  const { nx, ny, nz, dx, dy } = p;
  const Y = (depth: number) => -(depth - cz);          // depth up
  const U = (i: number) => (i + 0.5) / nx, V = (k: number) => (k + 0.5) / ny, W = (l: number) => (l + 0.5) / nz;

  // ── corner-averaged depths → a continuous (gap-free) top & base surface ─────────
  const NX1 = nx + 1, NY1 = ny + 1;
  const cornerTop = new Float64Array(NX1 * NY1), cornerBase = new Float64Array(NX1 * NY1);
  const cornerN = new Uint16Array(NX1 * NY1);
  const cid = (i: number, k: number) => k * NX1 + i;
  for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) {
    if (!active(p, i, k)) continue;
    const c = col(p, i, k), t = p.topZ[c], bz = p.baseZ[c];
    if (!Number.isFinite(t) || !Number.isFinite(bz)) continue;
    for (const [ci, ck] of [[i, k], [i + 1, k], [i + 1, k + 1], [i, k + 1]] as const) {
      const q = cid(ci, ck); cornerTop[q] += t; cornerBase[q] += bz; cornerN[q]++;
    }
  }
  for (let q = 0; q < cornerN.length; q++) if (cornerN[q]) { cornerTop[q] /= cornerN[q]; cornerBase[q] /= cornerN[q]; }
  const depthAt = (i: number, k: number, top: boolean) => (top ? cornerTop : cornerBase)[cid(i, k)];

  // smooth surface normal from the corner depth-gradient (central diff). Surface y=−depth,
  // so n ∝ (∂depth/∂x, 1, ∂depth/∂z) up to sign; base flips vertical component.
  const surfNormal = (i: number, k: number, top: boolean): [number, number, number] => {
    const D = top ? cornerTop : cornerBase;
    const gx = (D[cid(Math.min(nx, i + 1), k)] - D[cid(Math.max(0, i - 1), k)]) / (2 * dx);
    const gz = (D[cid(i, Math.min(ny, k + 1))] - D[cid(i, Math.max(0, k - 1))]) / (2 * dy);
    const ny0 = top ? 1 : -1;
    const L = Math.hypot(gx, 1, gz) || 1; return [(gx * ny0) / L, ny0 / L, (gz * ny0) / L];
  };

  // ── top + base surfaces (continuous corner-shared positions, smooth normals) ────
  for (const top of [true, false]) {
    const wl = top ? W(0) : W(nz - 1);
    for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) {
      if (!active(p, i, k)) continue;
      const u = U(i), v = V(k);
      const P = (ci: number, ck: number) => {
        const x = p.x0 + ci * dx - cx, z = p.y0 + ck * dy - cy, y = Y(depthAt(ci, ck, top));
        const n = surfNormal(ci, ck, top);
        return b.vert(x, y, z, n[0], n[1], n[2], u, v, wl);
      };
      const n0 = P(i, k), n1 = P(i + 1, k), n2 = P(i + 1, k + 1), n3 = P(i, k + 1);
      if (top) b.quad(n0, n1, n2, n3); else b.quad(n0, n3, n2, n1); // base wound downward
    }
  }

  // ── perimeter walls: exposed boundary edges only, layer-banded, aligned to the
  // corner surfaces so the walls meet top & base seamlessly (the layered "block" side). ──
  const wall = (i: number, k: number, di: number, dk: number) => {
    if (active(p, i + di, k + dk)) return; // interior edge → skip (keeps the body solid)
    // the two shared corners of the exposed vertical face
    let a: readonly [number, number], c2: readonly [number, number];
    if (di > 0) { a = [i + 1, k]; c2 = [i + 1, k + 1]; }
    else if (di < 0) { a = [i, k + 1]; c2 = [i, k]; }
    else if (dk > 0) { a = [i + 1, k + 1]; c2 = [i, k + 1]; }
    else { a = [i, k]; c2 = [i + 1, k]; }
    const nrm: [number, number, number] = di !== 0 ? [di, 0, 0] : [0, 0, dk];
    const u = U(i), v = V(k);
    const ax = p.x0 + a[0] * dx - cx, az = p.y0 + a[1] * dy - cy;
    const bx = p.x0 + c2[0] * dx - cx, bz = p.y0 + c2[1] * dy - cy;
    const aT = depthAt(a[0], a[1], true), aB = depthAt(a[0], a[1], false);
    const bT = depthAt(c2[0], c2[1], true), bB = depthAt(c2[0], c2[1], false);
    for (let l = 0; l < nz; l++) {
      const w = W(l);
      const aYt = Y(aT + (l / nz) * (aB - aT)), aYb = Y(aT + ((l + 1) / nz) * (aB - aT));
      const bYt = Y(bT + (l / nz) * (bB - bT)), bYb = Y(bT + ((l + 1) / nz) * (bB - bT));
      const q0 = b.vert(ax, aYt, az, nrm[0], 0, nrm[2], u, v, w);
      const q1 = b.vert(bx, bYt, bz, nrm[0], 0, nrm[2], u, v, w);
      const q2 = b.vert(bx, bYb, bz, nrm[0], 0, nrm[2], u, v, w);
      const q3 = b.vert(ax, aYb, az, nrm[0], 0, nrm[2], u, v, w);
      b.quad(q0, q1, q2, q3);
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
