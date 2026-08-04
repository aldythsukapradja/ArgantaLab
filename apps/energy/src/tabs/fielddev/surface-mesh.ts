// fielddev/surface-mesh.ts — turn a decoded depth grid into triangles.
//
// Pure geometry, no three.js: the caller feeds the arrays straight into a
// BufferGeometry. Keeping it separate is what makes the two rules below testable
// rather than asserted in a comment.
//
// RULE 1 — A NULL NODE KILLS ITS TRIANGLES. An interpreted grid has a real edge.
// Meshing across a null by substituting a value invents structure; meshing to
// zero drops a cliff to datum. Either reads as geology. So a triangle is emitted
// only when all three of its corners are real, and the mesh simply ends where the
// interpretation ends.
//
// RULE 2 — SURFACES MUST SHARE ONE ORIGIN. Volve's five horizons are gridded on
// five different origins (BCU starts at 431128 E, Hugin Top at 432108). Meshing
// each about its own corner would stack them correctly in depth and wrongly in
// map position — the reservoir would sit 1 km from the unconformity above it.
// So the caller passes a common origin and every surface is built relative to it.

export interface MeshGrid {
  ncol: number; nrow: number;
  values: ArrayLike<number>;
  /** projected origin (SW corner) and cell size, in metres */
  x0: number; y0: number; dx: number; dy: number;
}

export interface SurfaceMesh {
  /** xyz triples, metres east / metres north / metres UP from datum */
  positions: Float32Array;
  /** rgb triples in 0..1, one per vertex */
  colors: Float32Array;
  indices: Uint32Array;
  /** how many quads were dropped for touching a null node — reported, not hidden */
  droppedQuads: number;
  liveNodes: number;
}

/** Depth of a node in metres below datum, positive down, from a grid that may
 *  store either convention. Matches StructureLayer's rule so the 3D view and the
 *  map can never disagree about which way is down. */
export function nodeDepth(v: number, flip: boolean): number { return flip ? -v : v; }

/**
 * @param colorAt maps a DEPTH (positive down) to rgb 0..1. Pass one shared
 *        function across every selected surface so their colours are comparable —
 *        that comparability is the whole reason to show them together.
 * @param zScale vertical exaggeration. 1 is true scale, at which a 7 km-wide
 *        field with 600 m of relief is visually flat.
 */
export function buildSurfaceMesh(
  grid: MeshGrid,
  opts: {
    originX: number; originY: number;
    flip: boolean;
    zScale: number;
    colorAt: (depth: number) => [number, number, number];
    /** skip every Nth node to keep large grids interactive; 1 = full resolution */
    stride?: number;
  },
): SurfaceMesh | null {
  const { ncol, nrow, values, x0, y0, dx, dy } = grid;
  const step = Math.max(1, Math.floor(opts.stride ?? 1));
  const cols = Math.floor((ncol - 1) / step) + 1;
  const rows = Math.floor((nrow - 1) / step) + 1;
  if (cols < 2 || rows < 2) return null;

  const positions = new Float32Array(cols * rows * 3);
  const colors = new Float32Array(cols * rows * 3);
  const ok = new Uint8Array(cols * rows);
  let liveNodes = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sc = c * step, sr = r * step;
      const v = values[sr * ncol + sc];
      const i = r * cols + c;
      const o = i * 3;
      positions[o] = (x0 + sc * dx) - opts.originX;
      positions[o + 1] = (y0 + sr * dy) - opts.originY;
      if (!Number.isFinite(v)) { positions[o + 2] = 0; continue; }
      const depth = nodeDepth(v, opts.flip);
      // up is positive, so a depth below datum is a negative height
      positions[o + 2] = -depth * opts.zScale;
      const [cr, cg, cb] = opts.colorAt(depth);
      colors[o] = cr; colors[o + 1] = cg; colors[o + 2] = cb;
      ok[i] = 1; liveNodes++;
    }
  }
  if (liveNodes < 3) return null;

  const idx: number[] = [];
  let droppedQuads = 0;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
      const n = (ok[a] ? 1 : 0) + (ok[b] ? 1 : 0) + (ok[d] ? 1 : 0) + (ok[e] ? 1 : 0);
      if (n < 3) { droppedQuads++; continue; }
      // a quad with one null corner still has one good triangle — keep it rather
      // than losing a whole cell of real interpretation to a single blank node
      if (n === 4) { idx.push(a, d, b, b, d, e); continue; }
      droppedQuads++;
      if (ok[a] && ok[d] && ok[b]) idx.push(a, d, b);
      else if (ok[b] && ok[d] && ok[e]) idx.push(b, d, e);
      else if (ok[a] && ok[d] && ok[e]) idx.push(a, d, e);
      else if (ok[a] && ok[e] && ok[b]) idx.push(a, e, b);
    }
  }
  if (!idx.length) return null;

  return { positions, colors, indices: Uint32Array.from(idx), droppedQuads, liveNodes };
}

/** Common origin for a set of grids: the south-west-most corner, so every surface
 *  is placed in one shared local frame and their map positions stay true. */
export function commonOrigin(grids: MeshGrid[]): { x: number; y: number } | null {
  if (!grids.length) return null;
  return {
    x: Math.min(...grids.map((g) => g.x0)),
    y: Math.min(...grids.map((g) => g.y0)),
  };
}

/** Depth range across a set of grids, so one colour ramp can serve them all. */
export function sharedDepthRange(grids: MeshGrid[], flip: boolean): { dmin: number; dmax: number } | null {
  let dmin = Infinity, dmax = -Infinity;
  for (const g of grids) {
    for (let i = 0; i < g.values.length; i++) {
      const v = g.values[i];
      if (!Number.isFinite(v)) continue;
      const d = nodeDepth(v, flip);
      if (d < dmin) dmin = d;
      if (d > dmax) dmax = d;
    }
  }
  return Number.isFinite(dmin) && dmax > dmin ? { dmin, dmax } : null;
}
