// fielddev/xsection.ts — the maths behind a cross-section.
//
// A section is a line drawn across the map. Everything else follows from it:
// the horizons are SAMPLED along that line to give depth profiles, and the wells
// are PROJECTED onto it to give posts. Both operations are here, in projected
// metres — the same frame the grids and the impact points already live in — so
// nothing is reprojected twice and the section cannot drift from the map that
// defined it.
//
// TWO honesty rules:
//
//  1. OFF-GRID IS NULL, NOT ZERO. A section usually runs past the edge of an
//     interpreted horizon, and it samples nulls inside the outline too. Those
//     come back as null and the renderer BREAKS the line there. Interpolating
//     across a gap would draw structure nobody mapped.
//
//  2. A PROJECTED WELL IS NOT ON THE SECTION. Posting a well 800 m away as if it
//     sat on the line is the classic cross-section lie — it makes a section look
//     better constrained than it is. Every projected well carries the
//     perpendicular distance it was moved, and the caller shows it.

/** A point in the grid's projected CRS. */
export interface P2 { x: number; y: number }

/** A depth grid in its own projected frame. Row 0 is the SOUTH edge. */
export interface SampleGrid {
  ncol: number; nrow: number;
  values: ArrayLike<number>;
  x0: number; y0: number; dx: number; dy: number;
}

export interface SectionSample { dist: number; x: number; y: number; depth: number | null }

export interface ProjectedWell<T> {
  item: T;
  /** distance along the section from its first point, metres */
  dist: number;
  /** perpendicular distance the well was moved to reach the line, metres.
   *  The number that says how much to trust its position on this section. */
  offset: number;
}

/** Total length of a polyline, metres. */
export function pathLength(path: P2[]): number {
  let d = 0;
  for (let i = 1; i < path.length; i++) d += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  return d;
}

/**
 * Bilinear depth at an arbitrary projected position.
 *
 * Returns null outside the grid AND when any of the four surrounding nodes is
 * null — a corner of real data does not justify interpolating a value into a
 * hole. Values come back in the grid's own convention; the caller normalises.
 */
export function bilinearAt(g: SampleGrid, x: number, y: number): number | null {
  const fx = (x - g.x0) / g.dx, fy = (y - g.y0) / g.dy;
  if (!(fx >= 0 && fy >= 0 && fx <= g.ncol - 1 && fy <= g.nrow - 1)) return null;
  const c = Math.min(Math.floor(fx), g.ncol - 2), r = Math.min(Math.floor(fy), g.nrow - 2);
  const tx = fx - c, ty = fy - r;
  const v00 = g.values[r * g.ncol + c];
  const v10 = g.values[r * g.ncol + c + 1];
  const v01 = g.values[(r + 1) * g.ncol + c];
  const v11 = g.values[(r + 1) * g.ncol + c + 1];
  if (![v00, v10, v01, v11].every(Number.isFinite)) return null;
  return (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty;
}

/** Walk the section at a fixed spacing and read the grid at each step. */
export function sampleAlongPath(g: SampleGrid, path: P2[], samples: number): SectionSample[] {
  if (path.length < 2 || samples < 2) return [];
  const total = pathLength(path);
  if (!(total > 0)) return [];
  const step = total / (samples - 1);

  // cumulative distance at each vertex, so a sample can be placed by arc length
  const cum = [0];
  for (let i = 1; i < path.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
  }

  const out: SectionSample[] = [];
  let seg = 1;
  for (let s = 0; s < samples; s++) {
    const d = Math.min(total, s * step);
    while (seg < path.length - 1 && cum[seg] < d) seg++;
    const a = path[seg - 1], b = path[seg];
    const segLen = cum[seg] - cum[seg - 1];
    const t = segLen > 0 ? (d - cum[seg - 1]) / segLen : 0;
    const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
    out.push({ dist: d, x, y, depth: bilinearAt(g, x, y) });
  }
  return out;
}

/**
 * Nearest point on the section to `p`, as distance-along and perpendicular offset.
 * Clamped to the segment ends, so a well beyond the section's end projects onto
 * the end rather than onto the infinite extension of the last segment.
 */
export function projectOnPath(path: P2[], p: P2): { dist: number; offset: number } | null {
  if (path.length < 2) return null;
  let best: { dist: number; offset: number } | null = null;
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const vx = b.x - a.x, vy = b.y - a.y;
    const len2 = vx * vx + vy * vy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2)) : 0;
    const cx = a.x + vx * t, cy = a.y + vy * t;
    const offset = Math.hypot(p.x - cx, p.y - cy);
    if (!best || offset < best.offset) best = { dist: acc + Math.sqrt(len2) * t, offset };
    acc += Math.sqrt(len2);
  }
  return best;
}

/**
 * Project a set of located items onto the section, keeping only those inside a
 * corridor. `corridor` is a HALF-width: a well further than this from the line
 * is not shown at all, because a section is a claim about a plane and a well two
 * kilometres away says nothing about it.
 */
export function projectWells<T extends { easting: number; northing: number }>(
  path: P2[], items: T[], corridor: number,
): Array<ProjectedWell<T>> {
  const out: Array<ProjectedWell<T>> = [];
  for (const it of items) {
    const pr = projectOnPath(path, { x: it.easting, y: it.northing });
    if (!pr || pr.offset > corridor) continue;
    out.push({ item: it, dist: pr.dist, offset: pr.offset });
  }
  return out.sort((a, b) => a.dist - b.dist);
}

/** Depth range across a set of sampled profiles, ignoring gaps. Null when every
 *  sample is a gap — an empty range is not a range. */
export function sampleRange(series: SectionSample[][]): { dmin: number; dmax: number } | null {
  let dmin = Infinity, dmax = -Infinity;
  for (const s of series) {
    for (const p of s) {
      if (p.depth == null || !Number.isFinite(p.depth)) continue;
      if (p.depth < dmin) dmin = p.depth;
      if (p.depth > dmax) dmax = p.depth;
    }
  }
  return Number.isFinite(dmin) && dmax >= dmin ? { dmin, dmax } : null;
}

/** Split a sampled profile at its gaps, so the renderer draws separate lines
 *  instead of one line jumping across un-mapped ground. */
export function splitAtGaps(s: SectionSample[]): SectionSample[][] {
  const runs: SectionSample[][] = [];
  let run: SectionSample[] = [];
  for (const p of s) {
    if (p.depth == null || !Number.isFinite(p.depth)) {
      if (run.length > 1) runs.push(run);
      run = [];
      continue;
    }
    run.push(p);
  }
  if (run.length > 1) runs.push(run);
  return runs;
}
