// zone-model.ts — horizons → a common grid → zones → per-zone GridSpec (S1).
//
// THE PROBLEM THIS SOLVES. Volve's depth grids are not on one grid. They have
// different origins, different node counts and (potentially) different cell sizes,
// because each was gridded by whoever interpreted it. `grid3d.buildGrid` takes ONE
// pair of per-column top/base arrays on ONE areal grid, so before any of it can run
// every horizon has to be resampled onto a single common frame. That resampling is
// the whole of this module, and getting it wrong would misplace every zone
// thickness, every upscaled cell and every volume downstream.
//
// THREE RULES, all of them load-bearing:
//
//  1. A node outside a horizon's own extent is NULL, not extrapolated. The
//     interpretation ends where the interpreter stopped; continuing it with the
//     nearest value would invent structure and then compute volume on it.
//
//  2. A horizon that CROSSES the one above is reported, never clipped. Negative
//     thickness means the structural framework is wrong, and quietly taking
//     max(0, …) turns a visible error into a silent one that survives all the way
//     to a reserves number.
//
//  3. Depth is normalised to POSITIVE-DOWN TVDSS on the way in. The delivery stores
//     elevation in some grids and depth in others; mixing the two conventions makes
//     a zone thickness come out negative for a reason that has nothing to do with
//     geology.
//
// Pure — no DOM, no IndexedDB, no `import.meta` — so scripts/test-zone-model.mjs can
// truth-lock it directly.
import type { GridSpec } from '../../engine/grid3d.ts';

/** A depth grid as it arrives: its own origin, its own node spacing. */
export interface HorizonGrid {
  id: string;
  name: string;
  ncol: number; nrow: number;
  /** row-major [ncol*nrow]; NaN = no data */
  values: ArrayLike<number>;
  x0: number; y0: number; dx: number; dy: number;
  /** true when the grid stores ELEVATION (negative down) rather than depth */
  flip: boolean;
}

/** The single areal frame every horizon is resampled onto. */
export interface CommonGrid {
  nx: number; ny: number;
  dx: number; dy: number;
  x0: number; y0: number;
}

export interface LayerScheme {
  kind: 'proportional' | 'top-conform' | 'base-conform';
  /** layers in this zone */
  nz: number;
}

export interface ZoneSpec {
  /** stratigraphic index, 0 = shallowest */
  index: number;
  name: string;
  topId: string; baseId: string;
  /** per-column depths on the COMMON grid, positive-down, NaN outside extent */
  topZ: Float64Array;
  baseZ: Float64Array;
  /** columns where both surfaces exist AND the base is below the top */
  activeCol: Uint8Array;
  nz: number;
  // ── QC, measured rather than assumed ──
  /** columns where both horizons exist */
  overlapCols: number;
  /** columns where the base sits ABOVE the top — a structural error, reported */
  crossedCols: number;
  /** mean gross thickness over the active columns, metres */
  meanThicknessM: number;
  minThicknessM: number;
  maxThicknessM: number;
}

export interface ZoneModel {
  grid: CommonGrid;
  zones: ZoneSpec[];
  /** total cells the model will hold */
  cells: number;
  /** horizons that contributed nothing on the common grid, with the reason */
  dropped: Array<{ id: string; name: string; why: string }>;
}

/** Depth in metres, positive down, from a grid that may store either convention. */
export const toDepth = (v: number, flip: boolean): number => (flip ? -v : v);

/**
 * The common areal frame.
 *
 * Origin is the south-west-most corner and the extent reaches the north-east-most,
 * so no horizon is cropped. Cell size is the FINEST of the inputs — coarsening to
 * the worst grid would throw away interpretation that was already done, and the
 * whole model inherits its resolution from here.
 *
 * `maxNodes` is a hard ceiling: the finest cell size over the widest extent can
 * produce an areal grid nobody asked for, so the cell size is relaxed until the
 * node count fits and the caller can see what it was relaxed to.
 */
export function deriveCommonGrid(grids: HorizonGrid[], maxNodes = 4_000_000): CommonGrid | null {
  const usable = grids.filter((g) => g.ncol > 1 && g.nrow > 1 && g.dx > 0 && g.dy > 0);
  if (!usable.length) return null;

  const x0 = Math.min(...usable.map((g) => g.x0));
  const y0 = Math.min(...usable.map((g) => g.y0));
  const x1 = Math.max(...usable.map((g) => g.x0 + g.dx * (g.ncol - 1)));
  const y1 = Math.max(...usable.map((g) => g.y0 + g.dy * (g.nrow - 1)));

  let dx = Math.min(...usable.map((g) => g.dx));
  let dy = Math.min(...usable.map((g) => g.dy));
  if (!(dx > 0) || !(dy > 0)) return null;

  let nx = Math.max(2, Math.round((x1 - x0) / dx) + 1);
  let ny = Math.max(2, Math.round((y1 - y0) / dy) + 1);
  // relax until it fits, in steps that keep the aspect ratio honest
  while (nx * ny > maxNodes) {
    dx *= 1.25; dy *= 1.25;
    nx = Math.max(2, Math.round((x1 - x0) / dx) + 1);
    ny = Math.max(2, Math.round((y1 - y0) / dy) + 1);
  }
  return { nx, ny, dx, dy, x0, y0 };
}

/**
 * Bilinear sample of a horizon at a world position.
 *
 * Returns NaN outside the grid, and NaN when any of the four surrounding nodes is
 * null — a corner that touches a hole is a corner with no value. Interpolating
 * across a null would smear the edge of the interpretation outwards, which is the
 * same fabrication as extrapolating, just less obvious.
 */
export function sampleHorizon(g: HorizonGrid, x: number, y: number): number {
  const fi = (x - g.x0) / g.dx;
  const fj = (y - g.y0) / g.dy;
  if (!(fi >= 0) || !(fj >= 0) || fi > g.ncol - 1 || fj > g.nrow - 1) return NaN;
  const i0 = Math.min(g.ncol - 2, Math.floor(fi));
  const j0 = Math.min(g.nrow - 2, Math.floor(fj));
  const tx = fi - i0, ty = fj - j0;
  const at = (i: number, j: number) => {
    const v = g.values[j * g.ncol + i];
    return Number.isFinite(v) ? toDepth(v as number, g.flip) : NaN;
  };
  const v00 = at(i0, j0), v10 = at(i0 + 1, j0), v01 = at(i0, j0 + 1), v11 = at(i0 + 1, j0 + 1);
  if (!Number.isFinite(v00) || !Number.isFinite(v10) || !Number.isFinite(v01) || !Number.isFinite(v11)) return NaN;
  return v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
}

/** Resample one horizon onto the common grid. NaN wherever it has nothing to say. */
export function resample(g: HorizonGrid, common: CommonGrid): Float64Array {
  const out = new Float64Array(common.nx * common.ny);
  for (let k = 0; k < common.ny; k++) {
    const y = common.y0 + k * common.dy;
    for (let i = 0; i < common.nx; i++) {
      out[k * common.nx + i] = sampleHorizon(g, common.x0 + i * common.dx, y);
    }
  }
  return out;
}

/**
 * Build the zone model.
 *
 * `ordered` must be shallowest-first — the caller owns stratigraphic order, because
 * it is a geological judgement (BCU sorts before Hugin in the alphabet and sits
 * above it in the ground) and not something this module can recover from numbers.
 */
export function buildZoneModel(
  ordered: HorizonGrid[],
  scheme: LayerScheme,
  opts: { maxNodes?: number } = {},
): ZoneModel | null {
  const common = deriveCommonGrid(ordered, opts.maxNodes);
  if (!common || ordered.length < 2) return null;

  const dropped: ZoneModel['dropped'] = [];
  const sampled = ordered.map((g) => {
    const z = resample(g, common);
    let live = 0;
    for (let c = 0; c < z.length; c++) if (Number.isFinite(z[c])) live++;
    if (!live) dropped.push({ id: g.id, name: g.name, why: 'no overlap with the common grid' });
    return { g, z, live };
  });

  const nCol = common.nx * common.ny;
  const zones: ZoneSpec[] = [];
  for (let i = 0; i + 1 < sampled.length; i++) {
    const top = sampled[i], base = sampled[i + 1];
    if (!top.live || !base.live) continue;

    const activeCol = new Uint8Array(nCol);
    let overlap = 0, crossed = 0, sum = 0, n = 0;
    let min = Infinity, max = -Infinity;
    for (let c = 0; c < nCol; c++) {
      const t = top.z[c], b = base.z[c];
      if (!Number.isFinite(t) || !Number.isFinite(b)) continue;
      overlap++;
      const thk = b - t;
      if (thk <= 0) { crossed++; continue; }   // reported, never clipped
      activeCol[c] = 1;
      sum += thk; n++;
      if (thk < min) min = thk;
      if (thk > max) max = thk;
    }
    zones.push({
      index: zones.length,
      name: `${top.g.name} → ${base.g.name}`,
      topId: top.g.id, baseId: base.g.id,
      topZ: top.z, baseZ: base.z, activeCol,
      nz: Math.max(1, Math.round(scheme.nz)),
      overlapCols: overlap,
      crossedCols: crossed,
      meanThicknessM: n ? sum / n : 0,
      minThicknessM: n ? min : 0,
      maxThicknessM: n ? max : 0,
    });
  }
  if (!zones.length) return null;

  return {
    grid: common,
    zones,
    cells: zones.reduce((a, z) => a + common.nx * common.ny * z.nz, 0),
    dropped,
  };
}

/** One zone as `grid3d.buildGrid` wants it. */
export function zoneToGridSpec(zone: ZoneSpec, grid: CommonGrid): GridSpec {
  return {
    nx: grid.nx, ny: grid.ny, nz: zone.nz,
    dx: grid.dx, dy: grid.dy, x0: grid.x0, y0: grid.y0,
    topZ: zone.topZ, baseZ: zone.baseZ, activeCol: zone.activeCol,
  };
}

/** Bytes the packed model will occupy, under pack3d's default dtypes (φ/Sw/NTG u16,
 *  facies/perm u8) plus the per-column Float32 top/base. Reported BEFORE building. */
export function packedBytes(model: ZoneModel): number {
  const perCell = 2 + 2 + 2 + 1 + 1;
  const perCol = 4 + 4 + 1;
  return model.cells * perCell + model.grid.nx * model.grid.ny * perCol * model.zones.length;
}

/**
 * Peak memory while BUILDING, if each zone is built and packed in turn.
 *
 * `grid3d.GridModel` is the naive representation — cellZ/cellThk/cellBulk/phi/ntg/
 * sw/perm are Float64 and facies/active are Uint8, so it costs ~58 bytes per cell.
 * Materialising the whole model at once is what makes 10 million cells impossible;
 * building ZONE BY ZONE and packing each before starting the next keeps the peak to
 * the largest single zone, which for a 5-zone model is roughly a fifth of it.
 */
export function peakBuildBytes(model: ZoneModel): { wholeModel: number; perZone: number } {
  const perCell = 8 * 7 + 1 + 1;
  const nCol = model.grid.nx * model.grid.ny;
  const largestZoneCells = Math.max(...model.zones.map((z) => nCol * z.nz));
  return { wholeModel: model.cells * perCell, perZone: largestZoneCells * perCell };
}
