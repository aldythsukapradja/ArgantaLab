// zone-repair.ts — repair degenerate zone geometry before anything is built on it.
//
// A depth grid interpolated from scattered picks will, in places, put a zone's base
// ABOVE its top. That is not geology; it is two surfaces extrapolated independently
// into ground neither of them was constrained by. On Volve it happens in 4,760 cells
// of the Hugin, and the consequences are not cosmetic: a negative-thickness cell has
// negative pore volume, and a simulator either rejects the deck or initialises with
// negative fluid in place.
//
// ── WHICH SURFACE MOVES, AND WHY ────────────────────────────────────────────
//
// The TOP is the better-constrained surface. It is the horizon that gets picked on
// seismic and tied at every well; it is also what defines the trap, so moving it moves
// the closure and the contact relationship. The BASE is the uncertain one — especially
// away from the main accumulation, where no well has ever penetrated it. So the repair
// only ever pushes the base DOWN, and never touches the top.
//
// ── WHY AN ISOCHORE, NOT A MINIMUM THICKNESS ────────────────────────────────
//
// Clamping every bad column to the same minimum stamps a flat-bottomed plateau across
// the defect: uniform in the worst sense, and visible in every section as a machined
// edge that no depositional system produces. Instead the zone's own THICKNESS MAP is
// repaired — the bad columns are filled by diffusion from their valid neighbours, so
// the reconstructed base inherits the local thickening and thinning trend of the rock
// around it, and only then is a floor applied. Valid columns are never modified.
//
// ── THE HONESTY REQUIREMENT ─────────────────────────────────────────────────
//
// This ADDS ROCK VOLUME to the model. Every repair reports the columns it touched, the
// thickness it inserted and the bulk volume that appeared, so the volume can be
// subtracted from the confidence in the STOIIP rather than silently absorbed into it.
//
// Pure — no DOM, no IndexedDB, no `import.meta`.

export interface RepairOptions {
  /** zone names to repair. Others are left exactly as they are. */
  zones: string[];
  /** the floor a repaired column may not go below, metres */
  minThickM?: number;
  /** diffusion passes used to fill the thickness map from valid neighbours */
  passes?: number;
  /** areal cell size, for reporting the volume added */
  cellAreaM2?: number;
}

export interface ZoneRepair {
  zone: string;
  /** columns where the zone existed but was degenerate */
  repaired: number;
  /** columns that were already sound */
  sound: number;
  /** columns where the zone is absent altogether — not a defect */
  absent: number;
  /** repaired columns that had to fall back to the floor because no neighbour
   *  within reach was valid */
  flooredToMin: number;
  /** mean thickness inserted into a repaired column, metres */
  meanInsertedM: number;
  /** the worst single inversion that was present, metres (negative) */
  worstInversionM: number;
  /** bulk rock volume the repair added, m³ */
  addedBulkM3: number;
  /** the zone's bulk volume before the repair, m³ */
  bulkBeforeM3: number;
}

export interface RepairReport {
  zones: ZoneRepair[];
  totalRepaired: number;
  totalAddedBulkM3: number;
  /** the repair as a fraction of the repaired zones' volume — the number that belongs
   *  next to any STOIIP quoted from the repaired model */
  addedFraction: number;
}

export interface RepairableZone {
  name: string;
  nz: number;
  k0: number;
  topZ: Float32Array;
  baseZ: Float32Array;
}

const DEF = { minThickM: 0.5, passes: 64, cellAreaM2: 2500 };

/**
 * Repair the named zones IN PLACE, returning what was changed.
 *
 * In place because the caller holds a packed grid whose column arrays are shared; a
 * copy would have to be threaded through every consumer, and a half-repaired model
 * existing at all is a worse hazard than mutation.
 */
export function repairZones(
  zones: RepairableZone[],
  nx: number,
  ny: number,
  activeCol: Uint8Array | ArrayLike<number>,
  opts: RepairOptions,
): RepairReport {
  const o = { ...DEF, ...opts };
  const want = new Set(opts.zones);
  const nCol = nx * ny;
  const out: ZoneRepair[] = [];

  for (const z of zones) {
    if (!want.has(z.name)) continue;

    // ── 1 · the zone's own thickness map, with the defects knocked out ──
    const thk = new Float64Array(nCol).fill(NaN);
    let sound = 0, bad = 0, absent = 0;
    let worst = 0, bulkBefore = 0;
    for (let c = 0; c < nCol; c++) {
      if (!activeCol[c]) { absent++; continue; }
      const t = z.topZ[c], b = z.baseZ[c];
      if (!Number.isFinite(t) || !Number.isFinite(b)) { absent++; continue; }
      const d = b - t;
      if (d >= o.minThickM) { thk[c] = d; sound++; bulkBefore += d * o.cellAreaM2; }
      else {
        bad++;
        if (d < worst) worst = d;
        if (d > 0) bulkBefore += d * o.cellAreaM2;
        // a degenerate column contributes NOTHING to the map it will be filled from,
        // or the defect propagates into its own repair
      }
    }

    // ── 2 · fill the holes by diffusion from valid neighbours ──
    //
    // Each pass replaces an unknown column by the mean of its known 4-neighbours, so
    // the reconstruction spreads inward from the edge of the defect and carries the
    // surrounding thickening trend with it. Far more faithful than one global mean,
    // and it costs a few passes over a 27 k-column map.
    const filled = Float64Array.from(thk);
    let remaining = bad;
    for (let pass = 0; pass < o.passes && remaining > 0; pass++) {
      const next = Float64Array.from(filled);
      let done = 0;
      for (let c = 0; c < nCol; c++) {
        if (!activeCol[c] || Number.isFinite(filled[c])) continue;
        if (!Number.isFinite(z.topZ[c]) || !Number.isFinite(z.baseZ[c])) continue;
        const i = c % nx, j = (c - i) / nx;
        let sum = 0, n = 0;
        if (i > 0 && Number.isFinite(filled[c - 1])) { sum += filled[c - 1]; n++; }
        if (i < nx - 1 && Number.isFinite(filled[c + 1])) { sum += filled[c + 1]; n++; }
        if (j > 0 && Number.isFinite(filled[c - nx])) { sum += filled[c - nx]; n++; }
        if (j < ny - 1 && Number.isFinite(filled[c + nx])) { sum += filled[c + nx]; n++; }
        if (n) { next[c] = sum / n; done++; }
      }
      if (!done) break;                       // nothing reachable — stop early
      filled.set(next);
      remaining -= done;
    }

    // a column no diffusion reached (an island of defect with no sound neighbour)
    // falls back to the zone's own mean thickness, and is counted separately
    const meanSound = sound ? (() => { let s = 0; for (let c = 0; c < nCol; c++) if (Number.isFinite(thk[c])) s += thk[c]; return s / sound; })() : o.minThickM;

    // ── 3 · rebuild the base from the repaired isochore ──
    let repaired = 0, floored = 0, inserted = 0, added = 0;
    for (let c = 0; c < nCol; c++) {
      if (!activeCol[c]) continue;
      const t = z.topZ[c], b = z.baseZ[c];
      if (!Number.isFinite(t) || !Number.isFinite(b)) continue;
      if (b - t >= o.minThickM) continue;            // sound — never touched

      let d = filled[c];
      if (!Number.isFinite(d)) { d = meanSound; floored++; }
      if (d < o.minThickM) { d = o.minThickM; floored++; }

      const before = Math.max(0, b - t);
      z.baseZ[c] = t + d;
      repaired++;
      inserted += d;
      added += (d - before) * o.cellAreaM2;
    }

    out.push({
      zone: z.name,
      repaired, sound, absent, flooredToMin: floored,
      meanInsertedM: repaired ? inserted / repaired : 0,
      worstInversionM: worst,
      addedBulkM3: added,
      bulkBeforeM3: bulkBefore,
    });
  }

  const totalRepaired = out.reduce((n, r) => n + r.repaired, 0);
  const totalAdded = out.reduce((n, r) => n + r.addedBulkM3, 0);
  const totalBefore = out.reduce((n, r) => n + r.bulkBeforeM3, 0);
  return {
    zones: out,
    totalRepaired,
    totalAddedBulkM3: totalAdded,
    addedFraction: totalBefore > 0 ? totalAdded / totalBefore : 0,
  };
}

/**
 * Push zones below a repaired one down so the stack stays welded.
 *
 * Zone n's base and zone n+1's top are the SAME surface. Deepening a base without
 * deepening the top beneath it opens a void that no cell occupies — rock the model
 * contains but cannot hold fluid in. Returns how many columns had to move.
 *
 * Called with the zones in stratigraphic order, shallowest first.
 */
export function reweldStack(
  zones: RepairableZone[],
  nCol: number,
  activeCol: Uint8Array | ArrayLike<number>,
  tolM = 0.01,
): number {
  let moved = 0;
  for (let z = 0; z + 1 < zones.length; z++) {
    const a = zones[z], b = zones[z + 1];
    for (let c = 0; c < nCol; c++) {
      if (!activeCol[c]) continue;
      const ab = a.baseZ[c], bt = b.topZ[c], bb = b.baseZ[c];
      if (!Number.isFinite(ab) || !Number.isFinite(bt)) continue;
      if (ab - bt <= tolM) continue;              // still welded, or the base is above
      // carry the whole lower zone down by the shift, preserving its own thickness
      const shift = ab - bt;
      b.topZ[c] = ab;
      if (Number.isFinite(bb)) b.baseZ[c] = bb + shift;
      moved++;
    }
  }
  return moved;
}

// ── surface cleaning ────────────────────────────────────────────────────────
//
// A gridded horizon is ONE stratigraphic marker. When a delivery bins a point cloud
// that has more than one surface in it, the result is a single grid holding two
// populations, and every zone bounded by it inherits a fictitious thickness.
//
// Volve's "Seabed" is the worked example: min 83 m, median 1295 m, max 2605 m. p10 is
// 95 m — the real seabed, in ~80 m of water — and the rest is something else. Tested
// and ruled out: it is NOT a row-stride error (the array length is exactly nx·ny and
// neighbour roughness is flat at ~19 m across every candidate stride), so the values
// themselves are wrong rather than merely misplaced.

export interface SurfaceCleanResult {
  /** the cleaned values — a copy; the input is never mutated */
  values: Float64Array;
  /** nodes rejected as belonging to another population */
  rejected: number;
  /** nodes that were already null */
  nullBefore: number;
  /** nodes surviving */
  kept: number;
  /** the depth window that was kept */
  loM: number;
  hiM: number;
  /** true when so much was rejected that the surface should not be used at all */
  unusable: boolean;
  /**
   * The grid holds TWO coherent populations, not one surface with outliers.
   *
   * This is the Volve "Seabed" case and it matters because the median-based clean
   * keeps whichever population is LARGER — which here is the contaminant. Cleaning
   * returns a tidy surface centred on 1295 m that is not a seabed at all. When this
   * is set the grid must be excluded, not cleaned: no filter can decide which of two
   * real surfaces you meant.
   */
  bimodal: boolean;
  /** median of the rejected population, when it is coherent enough to have one */
  otherModeM?: number;
}

/**
 * Reject nodes that do not belong to the dominant population of a surface.
 *
 * Median ± k·MAD rather than mean ± k·σ: a surface half-filled with a second horizon
 * has a mean and a standard deviation that both describe the contamination, so the
 * classical test cannot see it. The median absolute deviation is unmoved by up to half
 * the data being wrong, which is exactly this case.
 *
 * Rejects to NaN rather than interpolating. A node whose value belonged to a different
 * surface carries no information about this one, and inventing a replacement would put
 * a fabricated depth where the honest answer is "not mapped here".
 */
export function cleanSurface(
  values: ArrayLike<number>,
  opts: { madK?: number; minKeptFraction?: number } = {},
): SurfaceCleanResult {
  const madK = opts.madK ?? 6;
  const minKept = opts.minKeptFraction ?? 0.25;

  const finite: number[] = [];
  let nullBefore = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || !Number.isFinite(v)) { nullBefore++; continue; }
    finite.push(v);
  }
  const out = Float64Array.from({ length: values.length }, (_, i) => {
    const v = values[i];
    return v == null || !Number.isFinite(v) ? NaN : v;
  });
  if (finite.length < 8) {
    return { values: out, rejected: 0, nullBefore, kept: finite.length, loM: NaN, hiM: NaN, bimodal: false, unusable: true };
  }

  const sorted = [...finite].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const devs = sorted.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
  const mad = devs[Math.floor(devs.length / 2)];
  // a MAD of zero means a spike of identical values; fall back to the IQR so the test
  // does not collapse to "reject everything that is not exactly the median"
  const spread = mad > 0 ? mad * 1.4826 : (sorted[Math.floor(sorted.length * 0.75)] - sorted[Math.floor(sorted.length * 0.25)]) / 1.349;
  const lo = median - madK * spread;
  const hi = median + madK * spread;

  let rejected = 0, kept = 0;
  for (let i = 0; i < out.length; i++) {
    const v = out[i];
    if (!Number.isFinite(v)) continue;
    if (v < lo || v > hi) { out[i] = NaN; rejected++; } else kept++;
  }

  // Is what we rejected a scatter of outliers, or a second surface? A handful of wild
  // nodes is noise; thousands of them clustered tightly around their own median is
  // another horizon sharing the file.
  const rejVals = finite.filter((v) => v < lo || v > hi).sort((a, b) => a - b);
  let bimodal = false, otherModeM: number | undefined;
  if (rejVals.length >= Math.max(50, finite.length * 0.05)) {
    const rMed = rejVals[Math.floor(rejVals.length / 2)];
    const rDev = rejVals.map((v) => Math.abs(v - rMed)).sort((a, b) => a - b);
    const rMad = rDev[Math.floor(rDev.length / 2)] * 1.4826;
    // tight around its own median, and far from the kept population's
    if (rMad < spread * 4 && Math.abs(rMed - median) > 4 * spread) { bimodal = true; otherModeM = rMed; }
  }

  return {
    values: out, rejected, nullBefore, kept, loM: lo, hiM: hi, bimodal, otherModeM,
    // Unusable if the dominant population is a minority of what was delivered, OR if
    // the grid is bimodal — in the second case the clean "succeeded" and produced the
    // wrong surface, which is worse than failing.
    unusable: kept / Math.max(1, finite.length) < minKept || bimodal,
  };
}

// ── bullseyes ───────────────────────────────────────────────────────────────
//
// A "bullseye" is the concentric ring a contouring algorithm draws around a single
// node that disagrees with its neighbours — the signature of a point cloud binned into
// a grid where one cell caught a stray sounding. On Volve about 1% of every horizon's
// interior nodes are strict local extrema, with residuals against their own
// 8-neighbourhood reaching 33 m where the median residual is 1.4 m.
//
// ── WHY A MEDIAN, AND WHY ONLY THE OUTLIERS ─────────────────────────────────
//
// The temptation is to smooth the whole surface. That removes the bullseyes and the
// geology with them: a fault-flank or a channel edge is a large local residual too, and
// a low-pass filter cannot tell them apart. So two guards are applied together:
//
//   · replacement is by the NEIGHBOUR MEDIAN, which follows a steep flank (half the
//     neighbours are up-dip, half down-dip) where a mean would pull the node off it;
//   · a node is only touched when its residual is an outlier against the residual
//     distribution of the WHOLE surface — measured with a MAD, so the spikes cannot
//     inflate the threshold that is supposed to catch them.
//
// A genuine steep dip is shared with its neighbours and survives both tests. An
// isolated spike fails the second one immediately.

export interface DespikeResult {
  values: Float64Array;
  /** nodes replaced by their neighbourhood median */
  despiked: number;
  /**
   * Bullseyes before and after.
   *
   * NOT merely "strict local extremum" — the crest of a smooth dome is one of those,
   * and counting it made the metric report 102 bullseyes before and 102 after while 726
   * genuine spikes were being removed. A bullseye is an extremum that is ALSO a large
   * residual against its own neighbourhood: isolated in amplitude, not just in sign.
   */
  extremaBefore: number;
  extremaAfter: number;
  /** the residual threshold used, metres */
  thresholdM: number;
  /** the largest residual that was corrected, metres */
  worstM: number;
}

/**
 * Remove isolated spikes from a gridded surface.
 *
 * `k` multiplies the robust spread of the residual distribution; 6 is deliberately
 * conservative — it corrects the visible bullseyes and leaves everything a geologist
 * would defend. Null nodes stay null: an artifact is not a reason to invent coverage.
 */
export function despikeSurface(
  values: ArrayLike<number>, nx: number, ny: number,
  opts: { k?: number; passes?: number } = {},
): DespikeResult {
  // 15, not 6. MEASURED on Volve: at k=6 the filter replaces 6.2% of hugin_top's nodes
  // while the surface contains ZERO bullseyes by the amplitude test — it was smoothing
  // genuine roughness. At k=15 it touches 0.3% and only residuals beyond ~33 m.
  // These surfaces do not have a bullseye problem; the filter is here for the ones that
  // do, and its default must not quietly reshape the ones that don't.
  const k = opts.k ?? 15;
  const passes = opts.passes ?? 2;
  const out = Float64Array.from({ length: values.length }, (_, i) => {
    const v = values[i];
    return v == null || !Number.isFinite(v) ? NaN : v;
  });

  const at = (a: Float64Array, i: number, j: number) =>
    (i < 0 || j < 0 || i >= nx || j >= ny) ? NaN : a[j * nx + i];
  const neighbours = (a: Float64Array, i: number, j: number) => {
    const o: number[] = [];
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const v = at(a, i + di, j + dj);
      if (Number.isFinite(v)) o.push(v);
    }
    return o;
  };
  const median = (a: number[]) => {
    if (!a.length) return NaN;
    const s = [...a].sort((x, y) => x - y);
    return s[Math.floor(s.length / 2)];
  };
  /** amplitude of the residual distribution, used both to count bullseyes and to
   *  set the correction threshold — computed the same way in both places */
  const residualScale = (a: Float64Array) => {
    const mags: number[] = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = at(a, i, j); if (!Number.isFinite(c)) continue;
      const nb = neighbours(a, i, j);
      if (nb.length < 5) continue;
      mags.push(Math.abs(c - median(nb)));
    }
    if (mags.length < 20) return null;
    mags.sort((x, y) => x - y);
    const med = mags[Math.floor(mags.length / 2)];
    const dev = mags.map((v) => Math.abs(v - med)).sort((x, y) => x - y);
    const mad = dev[Math.floor(dev.length / 2)] * 1.4826;
    return { med, mad: mad > 0 ? mad : med || 1 };
  };

  const countExtrema = (a: Float64Array, thr: number) => {
    let n = 0;
    for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const c = at(a, i, j); if (!Number.isFinite(c)) continue;
      const nb = neighbours(a, i, j);
      if (nb.length < 8) continue;
      // a bullseye is isolated in SIGN and large in AMPLITUDE
      if (!(nb.every((v) => v > c) || nb.every((v) => v < c))) continue;
      if (Math.abs(c - median(nb)) > thr) n++;
    }
    return n;
  };

  const scale0 = residualScale(out);
  const thr0 = scale0 ? scale0.med + k * scale0.mad : Infinity;
  const extremaBefore = countExtrema(out, thr0);
  let despiked = 0, worst = 0, threshold = thr0;

  for (let p = 0; p < passes; p++) {
    // residual of every node against its own neighbourhood median
    const resid = new Float64Array(out.length).fill(NaN);
    const mags: number[] = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = at(out, i, j); if (!Number.isFinite(c)) continue;
      const nb = neighbours(out, i, j);
      if (nb.length < 5) continue;                 // an edge node has no neighbourhood
      const r = c - median(nb);
      resid[j * nx + i] = r;
      mags.push(Math.abs(r));
    }
    if (mags.length < 20) break;

    // MAD of the residuals — the spikes must not set the threshold that catches them
    mags.sort((a, b) => a - b);
    const med = mags[Math.floor(mags.length / 2)];
    const dev = mags.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
    const mad = dev[Math.floor(dev.length / 2)] * 1.4826;
    const thr = med + k * (mad > 0 ? mad : med || 1);
    threshold = thr;

    let hit = 0;
    const next = Float64Array.from(out);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const r = resid[j * nx + i];
      if (!Number.isFinite(r) || Math.abs(r) <= thr) continue;
      const m = median(neighbours(out, i, j));
      if (!Number.isFinite(m)) continue;
      next[j * nx + i] = m;
      if (Math.abs(r) > worst) worst = Math.abs(r);
      hit++;
    }
    out.set(next);
    despiked += hit;
    if (!hit) break;                                // converged
  }

  // counted against the ORIGINAL threshold, or a surface that got smoother would move
  // its own goalposts and always look fixed
  return { values: out, despiked, extremaBefore, extremaAfter: countExtrema(out, thr0), thresholdM: threshold, worstM: worst };
}
