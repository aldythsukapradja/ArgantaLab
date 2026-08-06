// sim-frames — the run's saturation field, as something the 3D viewport can draw.
//
// ── WHY THE FRAMES ARE A SEPARATE THING ─────────────────────────────────────
//
// The solver works on an AREAL grid: one value per column, no layers. The viewport
// draws a LAYERED packed grid. Getting the flood onto the screen is therefore a
// broadcast, and the honest way to describe it is that every layer of a column shows
// the same saturation — because that is exactly what the model computed. Interpolating
// a vertical profile the solver never produced would draw gravity segregation that is
// not in the physics, which is the single most tempting lie this file could tell.
//
// So: `swFrame` broadcasts, and `FRAME_NOTE` says so wherever a frame is shown.
import type { FvResult } from '../../engine/sim/fv';

export const FRAME_NOTE =
  'The solver is areal: every layer of a column carries the same saturation. '
  + 'No vertical profile is drawn, because none was computed.';

export interface FrameGridLike {
  nx: number; ny: number; nz: number;
  activeCol: ArrayLike<number>;
}

/**
 * Broadcast one report step's water saturation over the layered grid.
 *
 * Inactive columns get NaN, not a saturation. A column outside the model has no water
 * in it in the way an aquifer does — it has no rock — and writing 1.0 there paints the
 * whole outside of the field as flooded.
 */
export function swFrame(g: FrameGridLike, sw: ArrayLike<number>): Float64Array {
  const nCol = g.nx * g.ny;
  const out = new Float64Array(nCol * g.nz).fill(NaN);
  for (let l = 0; l < g.nz; l++) {
    for (let c = 0; c < nCol; c++) {
      if (!g.activeCol[c]) continue;
      const v = sw[c];
      out[l * nCol + c] = Number.isFinite(v) ? v : NaN;
    }
  }
  return out;
}

/** the same, for pressure */
export function pFrame(g: FrameGridLike, p: ArrayLike<number>): Float64Array {
  return swFrame(g, p);
}

/**
 * Oil saturation moved out of a column since t=0, as a fraction of its movable oil.
 *
 * ── WHY THIS AND NOT RAW Sw ─────────────────────────────────────────────────
 *
 * A raw saturation map is dominated by where the oil WAS, not by where it went: a
 * column that started at Swc and one that started in the aquifer look completely
 * different at every timestep regardless of what the flood did. Sweep normalises that
 * out — 0 is untouched, 1 is swept to residual — so the picture is the flood front,
 * which is the thing being watched.
 */
export function sweepFrame(
  g: FrameGridLike, sw: ArrayLike<number>, sw0: ArrayLike<number>, sor: number,
): Float64Array {
  const nCol = g.nx * g.ny;
  const out = new Float64Array(nCol * g.nz).fill(NaN);
  for (let c = 0; c < nCol; c++) {
    if (!g.activeCol[c]) continue;
    const a = sw0[c], b = sw[c];
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    // movable oil at t=0: everything above residual
    const movable = (1 - sor) - a;
    // a column with no movable oil cannot be swept; it is not "fully swept" either,
    // and reporting it as 1 would paint the aquifer as the best-swept rock in the field
    const v = movable > 1e-6 ? Math.max(0, Math.min(1, (b - a) / movable)) : NaN;
    for (let l = 0; l < g.nz; l++) out[l * nCol + c] = v;
  }
  return out;
}

export interface FrameSet {
  /** report times, days */
  times: number[];
  /** [step][cell] water saturation, broadcast over layers */
  sw: Float64Array[];
  /** [step][cell] sweep efficiency */
  sweep: Float64Array[];
  /** the range every frame shares, so the colour means the same thing at every step */
  swRange: { lo: number; hi: number };
}

/**
 * Build every frame, with ONE shared colour range.
 *
 * Per-frame auto-scaling is the classic animation bug: each step rescales to its own
 * extremes, so the front appears to stand still while the colours churn. The range has
 * to be fixed across the whole run or the animation is not showing movement.
 */
export function buildFrames(g: FrameGridLike, res: FvResult, sor: number): FrameSet {
  const snaps = res.snapshots;
  if (!snaps.length) return { times: [], sw: [], sweep: [], swRange: { lo: 0, hi: 1 } };
  const sw0 = snaps[0].sw;
  const sw = snaps.map((s) => swFrame(g, s.sw));
  const sweep = snaps.map((s) => sweepFrame(g, s.sw, sw0, sor));

  let lo = Infinity, hi = -Infinity;
  for (const f of sw) for (let i = 0; i < f.length; i++) {
    const v = f[i];
    if (!Number.isFinite(v)) continue;
    if (v < lo) lo = v; if (v > hi) hi = v;
  }
  if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
  if (hi <= lo) hi = lo + 1e-6;

  return { times: snaps.map((s) => s.t), sw, sweep, swRange: { lo, hi } };
}

/**
 * Quantise a frame into an existing packed property's storage.
 *
 * The viewport colours from `packed.props`, so putting a frame on screen means writing
 * it there. The property keeps its own declared min/max — the shared range — so the
 * ramp does not shift under the animation.
 */
export function writeFrame(
  prop: { data: Uint8Array | Uint16Array; dtype: string; min: number; max: number },
  frame: ArrayLike<number>,
): { written: number; missing: number } {
  const span = prop.dtype === 'u8' ? 255 : 65535;
  const rng = prop.max - prop.min;
  let written = 0, missing = 0;
  for (let i = 0; i < prop.data.length; i++) {
    const v = frame[i];
    if (!Number.isFinite(v)) {
      // NaN decodes to the property MINIMUM, which for saturation is the most
      // oil-bearing colour — the same trap the caprock fell into. Missing cells are
      // pinned to the TOP of the range instead, which reads as water, i.e. as "no
      // hydrocarbon here", which is the truthful reading for a cell outside the model.
      prop.data[i] = span;
      missing++;
      continue;
    }
    const t = rng > 0 ? (v - prop.min) / rng : 0;
    prop.data[i] = Math.max(0, Math.min(span, Math.round(t * span)));
    written++;
  }
  return { written, missing };
}
