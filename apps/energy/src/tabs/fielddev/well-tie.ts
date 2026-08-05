// well-tie.ts — does the gridded horizon agree with the wells it was built from?
//
// This is the first check a geoscientist runs on a structural model and the one whose
// absence cost this project the most. A depth surface is interpolated from seismic and
// tied at wells; the wells also carry their OWN formation picks. If the two disagree,
// every downstream number is computed on rock the well says is somewhere else.
//
// ── WHAT IT COST HERE ───────────────────────────────────────────────────────
//
// On Volve the gridded Hugin at the platform columns spans ~65 m while the wells'
// picked Hugin spans 200–400 m of TVD. F-14 — the field's SECOND LARGEST PRODUCER at
// 39.3% of cumulative oil — blocked to NTG 0.000 and φ 0.020, while its own logs over
// its own picked Hugin read RHOB 2.254 (φ 0.234), GR 36 and KLOGH 308 mD. The
// petrophysics was right the whole time; the samples were being blocked into Heather.
// Those cells then conditioned the indicator and Gaussian simulations for the entire
// field, so one untied well depressed the net-to-gross everywhere.
//
// ── THE SIGN TRAP ───────────────────────────────────────────────────────────
//
// Pick files carry TVDSS in the ELEVATION convention — negative below sea level
// (Volve's Hugin Top at F-14 is `tvdss: -2805.46`). The grid is positive-down. A
// comparison that forgets this reads a 5,600 m mistie and reports every well as
// catastrophically wrong, which is indistinguishable from the tool being broken.
// `normaliseTvdss` is the single place that is handled.
//
// Pure — no DOM, no IndexedDB, no `import.meta`.

export interface FormationPick {
  well: string;
  /** e.g. "Hugin Fm. VOLVE Top" */
  surface: string;
  md: number | null;
  tvdss: number | null;
}

export interface TiePoint {
  well: string;
  /** the pick, positive-down */
  pickTvdss: number;
  /** the gridded surface at the well's position, positive-down */
  gridTvdss: number;
  /** grid minus pick: positive means the grid puts the surface DEEPER than the well */
  misfitM: number;
}

export interface WellTieResult {
  surface: string;
  ties: TiePoint[];
  /** wells with a pick that fell outside the gridded extent */
  offGrid: string[];
  /** wells with no pick for this surface at all */
  noPick: string[];
  meanMisfitM: number;
  /** mean of |misfit| — the number that matters, since a grid can be right on average
   *  and wrong at every single well */
  meanAbsMisfitM: number;
  rmsMisfitM: number;
  worst: TiePoint | null;
  /** ties beyond the tolerance */
  outOfTolerance: number;
  toleranceM: number;
}

/**
 * Depths to a positive-down convention.
 *
 * Pick files are commonly elevation (negative below datum) while grids are depth.
 * Taking the absolute value is safe here because no petroleum formation top sits above
 * sea level in this dataset — and a surface that legitimately could would need a real
 * convention flag, not a guess.
 */
export const normaliseTvdss = (v: number): number => Math.abs(v);

/** The picks for one surface, keyed by well, deepest-first duplicates collapsed. */
export function picksForSurface(
  picks: FormationPick[],
  match: RegExp,
  /** a deviated bore can re-enter the same formation many times; the SHALLOWEST pick
   *  is the structural top, which is what a depth surface represents */
  pick: 'shallowest' | 'deepest' = 'shallowest',
): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of picks) {
    if (!match.test(p.surface)) continue;
    if (p.tvdss == null || !Number.isFinite(p.tvdss)) continue;
    const z = normaliseTvdss(p.tvdss);
    const prev = out.get(p.well);
    if (prev == null) { out.set(p.well, z); continue; }
    out.set(p.well, pick === 'shallowest' ? Math.min(prev, z) : Math.max(prev, z));
  }
  return out;
}

export interface TieWell {
  name: string;
  x: number;
  y: number;
}

/**
 * Compare a gridded surface against the wells' own picks.
 *
 * `gridAt` returns the surface depth at a world position, or null outside its extent.
 * A well outside the grid is reported separately rather than folded into the misfit —
 * "we could not test this one" and "this one is 40 m out" are different findings.
 */
export function tieSurface(
  surface: string,
  wells: TieWell[],
  pickByWell: Map<string, number>,
  gridAt: (x: number, y: number) => number | null,
  toleranceM = 15,
): WellTieResult {
  const ties: TiePoint[] = [];
  const offGrid: string[] = [];
  const noPick: string[] = [];

  for (const w of wells) {
    const pickTvdss = pickByWell.get(w.name);
    if (pickTvdss == null) { noPick.push(w.name); continue; }
    const g = gridAt(w.x, w.y);
    if (g == null || !Number.isFinite(g)) { offGrid.push(w.name); continue; }
    const gridTvdss = normaliseTvdss(g);
    ties.push({ well: w.name, pickTvdss, gridTvdss, misfitM: gridTvdss - pickTvdss });
  }

  const n = ties.length;
  const sum = ties.reduce((a, t) => a + t.misfitM, 0);
  const sumAbs = ties.reduce((a, t) => a + Math.abs(t.misfitM), 0);
  const sumSq = ties.reduce((a, t) => a + t.misfitM * t.misfitM, 0);
  let worst: TiePoint | null = null;
  for (const t of ties) if (!worst || Math.abs(t.misfitM) > Math.abs(worst.misfitM)) worst = t;

  return {
    surface, ties, offGrid, noPick,
    meanMisfitM: n ? sum / n : 0,
    meanAbsMisfitM: n ? sumAbs / n : 0,
    rmsMisfitM: n ? Math.sqrt(sumSq / n) : 0,
    worst,
    outOfTolerance: ties.filter((t) => Math.abs(t.misfitM) > toleranceM).length,
    toleranceM,
  };
}

/**
 * The gross interval a well's own picks describe, against what the grid gives it.
 *
 * A top that ties within tolerance is not enough. If the grid's top and base are 65 m
 * apart where the well penetrated 210 m of the same formation, the zone cannot hold
 * the well's reservoir however well the top matches — and the blocking will quietly
 * put most of the log in the wrong zone.
 */
export interface ThicknessTie {
  well: string;
  pickedGrossM: number;
  griddedGrossM: number;
  /** gridded ÷ picked; 1.0 is agreement, 0.3 means the zone holds a third of the rock */
  ratio: number;
}

export function tieThickness(
  wells: TieWell[],
  topByWell: Map<string, number>,
  baseByWell: Map<string, number>,
  gridTop: (x: number, y: number) => number | null,
  gridBase: (x: number, y: number) => number | null,
): ThicknessTie[] {
  const out: ThicknessTie[] = [];
  for (const w of wells) {
    const t = topByWell.get(w.name), b = baseByWell.get(w.name);
    if (t == null || b == null) continue;
    const picked = Math.abs(b - t);
    const gt = gridTop(w.x, w.y), gb = gridBase(w.x, w.y);
    if (gt == null || gb == null || !Number.isFinite(gt) || !Number.isFinite(gb)) continue;
    const gridded = Math.abs(normaliseTvdss(gb) - normaliseTvdss(gt));
    if (!(picked > 0)) continue;
    out.push({ well: w.name, pickedGrossM: picked, griddedGrossM: gridded, ratio: gridded / picked });
  }
  return out;
}
