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
