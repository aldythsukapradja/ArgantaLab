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

/**
 * Which axis points up in the emitted mesh.
 *
 * ── WHY THIS IS AN OPTION AND NOT A CONSTANT ────────────────────────────────
 *
 * This module historically emitted (east, UP, north) — three.js's default Y-up. But
 * `surface-mesh.ts` emits (east, north, UP), and a viewer that shows both puts a
 * horizon map beside a grid that is rotated 90° onto its edge. That is exactly what
 * the Volve viewport was showing: a flat structure map with a vertical wall above it.
 *
 * It cannot be repaired with a rotation at the consumer. (east, up, north) is
 * LEFT-handed — east × up = −north — so no rotation maps it onto the right-handed ENU
 * frame the scene uses; every candidate either mirrors north or turns the model upside
 * down. The swap has to happen where the vertices are written, and because swapping two
 * axes is a reflection, the triangle winding must be reversed with it or every face
 * ends up lit from inside.
 */
export type UpAxis = 'y' | 'z';

// simple growable buffers
class Buf {
  pos: number[] = []; nrm: number[] = []; uvw: number[] = []; idx: number[] = [];
  /** true when the mesh is emitted in the right-handed ENU frame (z up).
   *  A plain field, not a constructor parameter property — node's strip-only
   *  TypeScript mode rejects those, and every truth-lock imports this file directly. */
  zUp: boolean;
  constructor(zUp = false) { this.zUp = zUp; }
  vert(px: number, py: number, pz: number, nx: number, ny: number, nz: number, u: number, v: number, w: number) {
    // callers work in (east, up, north); z-up swaps the last two on the way out so the
    // buffer holds (east, north, up)
    if (this.zUp) { this.pos.push(px, pz, py); this.nrm.push(nx, nz, ny); }
    else { this.pos.push(px, py, pz); this.nrm.push(nx, ny, nz); }
    this.uvw.push(u, v, w); return this.pos.length / 3 - 1;
  }
  quad(a: number, b: number, c: number, d: number) {
    // a y↔z swap is a reflection, so the winding flips to keep faces outward
    if (this.zUp) this.idx.push(a, c, b, a, d, c);
    else this.idx.push(a, b, c, a, c, d);
  }
}

/** Shell = ONE continuous solid skin (Petrel-style): a smooth top surface + smooth base
 * surface that share corner positions (no gaps, no per-cell stair-steps / floating boxes)
 * plus layer-banded walls around the OUTER perimeter of the whole active region. Corner
 * depths are averaged over the up-to-4 active cells touching each grid corner, so the body
 * reads as one geologic solid. Per-cell UVW is kept (crisp property colouring) by emitting
 * duplicate verts at matching corner positions — visually watertight, cell-accurate colour. */
/**
 * Top and base depth at every grid NODE, averaged over the active cells that touch it.
 *
 * ── WHY EVERY SURFACE IN THIS APP HAS TO GO THROUGH HERE ────────────────────
 *
 * A cell drawn at its own centre depth is a flat tile floating at one height. Its
 * neighbour, one cell down-dip, is a flat tile at a DIFFERENT height, and nothing
 * closes the vertical step between them — so a dipping surface rendered cell-by-cell
 * is a venetian blind you can see the background through, and vertical exaggeration
 * multiplies every gap. That is not a small artefact: at ×3 on Volve's flanks it
 * removes most of the picture, and it reads as a sparse or broken model.
 *
 * Sharing NODE depths makes adjacent quads land on byte-identical corner positions,
 * so the sheet is watertight by construction rather than by luck.
 */
export function cornerDepths(p: PackedGrid3D): {
  top: Float64Array; base: Float64Array; n: Uint16Array; nx1: number;
  /** node index */ cid: (i: number, k: number) => number;
} {
  const { nx, ny } = p;
  const nx1 = nx + 1, ny1 = ny + 1;
  const top = new Float64Array(nx1 * ny1), base = new Float64Array(nx1 * ny1);
  const n = new Uint16Array(nx1 * ny1);
  const cid = (i: number, k: number) => k * nx1 + i;
  for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) {
    if (!active(p, i, k)) continue;
    const c = col(p, i, k), t = p.topZ[c], bz = p.baseZ[c];
    if (!Number.isFinite(t) || !Number.isFinite(bz)) continue;
    for (const [ci, ck] of [[i, k], [i + 1, k], [i + 1, k + 1], [i, k + 1]] as const) {
      const q = cid(ci, ck); top[q] += t; base[q] += bz; n[q]++;
    }
  }
  for (let q = 0; q < n.length; q++) if (n[q]) { top[q] /= n[q]; base[q] /= n[q]; }
  return { top, base, n, nx1, cid };
}

/**
 * Depth of a LAYER BOUNDARY at a node, under proportional layering.
 *
 * `f` is the fraction through the zone: 0 is the top of layer 0, 1 the base of the last
 * layer. Returns NaN at a node no active cell touches, so a caller can refuse to draw
 * rather than plant a corner at depth zero.
 */
export function nodeDepthAt(
  cd: { top: Float64Array; base: Float64Array; n: Uint16Array; cid: (i: number, k: number) => number },
  i: number, k: number, f: number,
): number {
  const q = cd.cid(i, k);
  if (!cd.n[q]) return NaN;
  return cd.top[q] + f * (cd.base[q] - cd.top[q]);
}

export function buildShell(p: PackedGrid3D, upAxis: UpAxis = 'y'): MeshBuffers {
  const [cx, cy, cz] = centreOf(p);
  const b = new Buf(upAxis === 'z');
  const { nx, ny, nz, dx, dy } = p;
  const Y = (depth: number) => -(depth - cz);          // depth up
  const U = (i: number) => (i + 0.5) / nx, V = (k: number) => (k + 0.5) / ny, W = (l: number) => (l + 0.5) / nz;

  // ── corner-averaged depths → a continuous (gap-free) top & base surface ─────────
  const cd = cornerDepths(p);
  const { top: cornerTop, base: cornerBase, n: cornerN, cid } = cd;
  const depthAt = (i: number, k: number, top: boolean) => (top ? cornerTop : cornerBase)[cid(i, k)];

  // smooth surface normal from the corner depth-gradient (central diff). Surface y=−depth,
  // so n ∝ (∂depth/∂x, 1, ∂depth/∂z) up to sign; base flips vertical component.
  const surfNormal = (i: number, k: number, top: boolean): [number, number, number] => {
    const D = top ? cornerTop : cornerBase;
    // ── ONLY DIFFERENCE AGAINST CORNERS THAT EXIST ──────────────────────────
    //
    // A corner no active cell touches is still 0 in the accumulator, and 0 is a depth —
    // roughly 3 km shallower than the reservoir. Differencing against one produces a
    // near-vertical gradient, so the lighting along the model's edge came from a slope
    // that is not there. Falling back to a one-sided difference (and to flat when
    // neither neighbour exists) keeps the normal on real ground.
    const has = (q: number) => cornerN[q] > 0;
    const grad = (qLo: number, qHi: number, q0: number, h: number) => {
      const lo = has(qLo), hi = has(qHi);
      if (lo && hi) return (D[qHi] - D[qLo]) / (2 * h);
      if (hi && has(q0)) return (D[qHi] - D[q0]) / h;
      if (lo && has(q0)) return (D[q0] - D[qLo]) / h;
      return 0;
    };
    const q0 = cid(i, k);
    const gx = grad(cid(Math.max(0, i - 1), k), cid(Math.min(nx, i + 1), k), q0, dx);
    const gz = grad(cid(i, Math.max(0, k - 1)), cid(i, Math.min(ny, k + 1)), q0, dy);
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
      // ── WINDING, NOT NORMALS, DECIDES WHAT IS CULLED ────────────────────────
      //
      // three.js picks the front face from the screen-space winding; the normal
      // attribute only lights it. Both surfaces used to be wound the other way, so on
      // a FrontSide material the top and the base were BOTH discarded and the viewer
      // saw the perimeter wall bands from inside — which reads as a terraced grid full
      // of gaps, and is exactly the "why is it so ugly" picture. Lighting looked right
      // the whole time, because the normals were never wrong.
      //
      // The corner order (i,k)→(i,k+1)→(i+1,k+1)→(i+1,k) is counter-clockwise seen from
      // ABOVE, which is what makes the top face upward; the base takes the reverse.
      if (top) b.quad(n0, n3, n2, n1); else b.quad(n0, n1, n2, n3);
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
