// struct-qc.ts — structural quality control on the built grid (S3.5).
//
// The question a dynamic modeller asks before accepting a static grid is not "is it
// pretty" but "will the simulator run on it, and will the answer mean anything". Both
// failures are geometric and both are silent: a negative-volume cell produces negative
// pore volume, a zero-thickness cell divides by zero in the transmissibility, and a
// 500:1 aspect ratio collapses the timestep until the run is unaffordable.
//
// ── WHAT THIS GRID CAN AND CANNOT GET WRONG ─────────────────────────────────
//
// Honesty about the geometry matters more than a long list of green ticks. This is a
// VERTICAL-PILLAR grid: every cell is an axis-aligned box, dx × dy wide, spanning one
// layer of one column. That construction makes several classic corner-point defects
// IMPOSSIBLE rather than absent —
//
//   · twisted (self-intersecting) cells need non-vertical pillars;
//   · non-planar cell faces need four corners at four different depths;
//   · crossing pillars need pillars that can lean.
//
// Reporting those as "0 found ✓" would claim a test was passed when no test was run.
// They are reported as INAPPLICABLE, with the reason, and they become real checks the
// day the grid gains faults. What this grid genuinely CAN get wrong — and does, on
// Volve — is thickness: horizons that cross, zones that overlap or leave a void, and
// layers thin enough to stall a simulator.
//
// Pure — no DOM, no IndexedDB, no `import.meta`.

export type QcVerdict = 'ok' | 'warn' | 'fail' | 'n/a';

export interface QcCheck {
  id: string;
  label: string;
  verdict: QcVerdict;
  /** how many cells/columns tripped it */
  count: number;
  /** how many were examined — 0 when the check does not apply */
  of: number;
  /** what was found, in words */
  finding: string;
  /** why it matters to the simulator; absent when there is nothing to say */
  consequence?: string;
}

export interface ZoneGeometry {
  name: string;
  k0: number;
  nz: number;
  /** columns where this zone has a usable top AND base */
  columns: number;
  cells: number;
  /** cells with positive thickness */
  liveCells: number;
  minThickM: number;
  meanThickM: number;
  maxThickM: number;
  /** mean thickness of ONE layer — the number that drives the aspect ratio */
  meanLayerM: number;
}

export interface StructuralQc {
  checks: QcCheck[];
  zones: ZoneGeometry[];
  /** the worst verdict across every check that actually ran */
  worst: QcVerdict;
  totalCells: number;
  liveCells: number;
}

export interface QcGrid {
  packed: {
    nx: number; ny: number; nz: number;
    dx: number; dy: number;
    activeCol: Uint8Array | ArrayLike<number>;
  };
  zoneLayers: Array<{ name: string; nz: number; k0: number; topZ: ArrayLike<number>; baseZ: ArrayLike<number> }>;
}

export interface QcOptions {
  /** below this a layer is a pinch-out rather than a cell, metres */
  minThickM?: number;
  /** dx / thickness beyond which the timestep suffers */
  maxAspect?: number;
  /** depth tolerance for "these two surfaces are the same surface", metres */
  tolM?: number;
}

const DEF: Required<QcOptions> = { minThickM: 0.3, maxAspect: 100, tolM: 0.01 };

/** Worst of two verdicts, ignoring the ones that did not run. */
const worse = (a: QcVerdict, b: QcVerdict): QcVerdict => {
  const rank: Record<QcVerdict, number> = { 'n/a': -1, ok: 0, warn: 1, fail: 2 };
  return rank[b] > rank[a] ? b : a;
};

const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(2)}%` : '—');

/**
 * Run every structural check.
 *
 * Order matters in the output: the two that can stop a simulator dead come first.
 */
export function structuralQc(grid: QcGrid, opts: QcOptions = {}): StructuralQc {
  const o = { ...DEF, ...opts };
  const p = grid.packed;
  const nCol = p.nx * p.ny;
  const checks: QcCheck[] = [];

  // ── per-zone geometry, and the cell-level thickness census ────────────────
  const zones: ZoneGeometry[] = [];
  let negative = 0, zeroThick = 0, thin = 0, highAspect = 0;
  let totalCells = 0, liveCells = 0;
  let examined = 0;
  // active columns that never produced a single live cell — they occupy the ACTNUM
  // but contain no rock, and a simulator will carry them as dead weight
  const colLive = new Uint8Array(nCol);

  for (const zl of grid.zoneLayers) {
    let cols = 0, cells = 0, live = 0;
    let min = Infinity, max = -Infinity, sum = 0;

    for (let c = 0; c < nCol; c++) {
      if (!p.activeCol[c]) continue;
      const t = zl.topZ[c], b = zl.baseZ[c];
      totalCells += zl.nz;
      cells += zl.nz;
      if (!Number.isFinite(t) || !Number.isFinite(b)) continue;   // zone absent here
      examined += zl.nz;
      cols++;

      const thk = b - t;
      // A crossing horizon gives base ABOVE top. `zone-model` counts and excludes
      // those columns, so any survivor here is a defect the grid build let through.
      if (thk < -o.tolM) { negative += zl.nz; continue; }
      if (Math.abs(thk) <= o.tolM) { zeroThick += zl.nz; continue; }

      const layerThk = thk / zl.nz;
      live += zl.nz;
      liveCells += zl.nz;
      colLive[c] = 1;
      if (layerThk < o.minThickM) thin += zl.nz;
      if (Math.max(p.dx, p.dy) / layerThk > o.maxAspect) highAspect += zl.nz;

      if (thk < min) min = thk;
      if (thk > max) max = thk;
      sum += thk;
    }

    zones.push({
      name: zl.name, k0: zl.k0, nz: zl.nz,
      columns: cols, cells, liveCells: live,
      minThickM: Number.isFinite(min) ? min : 0,
      meanThickM: cols ? sum / cols : 0,
      maxThickM: Number.isFinite(max) ? max : 0,
      meanLayerM: cols ? sum / cols / zl.nz : 0,
    });
  }

  checks.push({
    id: 'cell.negative', label: 'Negative-volume cells',
    verdict: negative === 0 ? 'ok' : 'fail',
    count: negative, of: examined,
    finding: negative === 0 ? 'none — every cell base lies below its top' : `${negative} cells (${pct(negative, examined)}) have their base ABOVE their top`,
    consequence: negative === 0 ? undefined : 'negative pore volume; the simulator either refuses the deck or initialises with negative fluid in place',
  });

  checks.push({
    id: 'cell.zero', label: 'Zero-thickness cells',
    verdict: zeroThick === 0 ? 'ok' : 'fail',
    count: zeroThick, of: examined,
    finding: zeroThick === 0 ? 'none' : `${zeroThick} cells (${pct(zeroThick, examined)}) are exactly degenerate`,
    consequence: zeroThick === 0 ? undefined : 'transmissibility divides by the cell thickness; a zero is a divide-by-zero, not a small number',
  });

  // A pinch-out is legitimate geology, so it warns rather than fails — but it must be
  // NAMED, because the usual fix (a minimum cell thickness) changes the pore volume.
  checks.push({
    id: 'cell.thin', label: `Pinch-out cells (< ${o.minThickM} m)`,
    verdict: thin === 0 ? 'ok' : thin / Math.max(1, liveCells) > 0.05 ? 'warn' : 'ok',
    count: thin, of: liveCells,
    finding: thin === 0 ? 'none' : `${thin} cells (${pct(thin, liveCells)}) are thinner than ${o.minThickM} m`,
    consequence: thin === 0 ? undefined : 'very thin cells shrink the stable timestep; most workflows set a minimum thickness, which alters pore volume and must be declared',
  });

  checks.push({
    id: 'cell.aspect', label: `Aspect ratio (> ${o.maxAspect}:1)`,
    verdict: highAspect === 0 ? 'ok' : highAspect / Math.max(1, liveCells) > 0.05 ? 'warn' : 'ok',
    count: highAspect, of: liveCells,
    finding: highAspect === 0
      ? `worst cell is well inside ${o.maxAspect}:1`
      : `${highAspect} cells (${pct(highAspect, liveCells)}) exceed ${o.maxAspect}:1 areal-to-vertical`,
    consequence: highAspect === 0 ? undefined : 'extreme aspect ratios make the pressure solve ill-conditioned and slow the run without improving the answer',
  });

  // ── zone stacking: consecutive zones must share a surface ─────────────────
  //
  // Zone n's base and zone n+1's top are THE SAME HORIZON. If they disagree in a
  // column, the grid either double-counts that rock (overlap) or has a void nothing
  // occupies (gap) — and a void between two zones is volume the model silently loses.
  let overlap = 0, gap = 0, stackCols = 0;
  let worstMismatch = 0;
  for (let z = 0; z + 1 < grid.zoneLayers.length; z++) {
    const a = grid.zoneLayers[z], b = grid.zoneLayers[z + 1];
    for (let c = 0; c < nCol; c++) {
      if (!p.activeCol[c]) continue;
      const ab = a.baseZ[c], bt = b.topZ[c];
      if (!Number.isFinite(ab) || !Number.isFinite(bt)) continue;
      stackCols++;
      const d = bt - ab;
      if (Math.abs(d) > Math.abs(worstMismatch)) worstMismatch = d;
      if (d < -o.tolM) overlap++;
      else if (d > o.tolM) gap++;
    }
  }
  const stackBad = overlap + gap;
  checks.push({
    id: 'zone.stacking', label: 'Zone stacking (shared surfaces)',
    verdict: stackCols === 0 ? 'n/a' : stackBad === 0 ? 'ok' : 'fail',
    count: stackBad, of: stackCols,
    finding: stackCols === 0
      ? 'only one zone — nothing to stack'
      : stackBad === 0
        ? `every consecutive pair shares its surface to within ${o.tolM} m`
        : `${overlap} overlapping and ${gap} gapped column-pairs; worst mismatch ${worstMismatch.toFixed(2)} m`,
    consequence: stackBad === 0 ? undefined : 'an overlap counts the same rock in two zones; a gap is pore volume the model contains but no cell holds',
  });

  // ── stratigraphic order per column ────────────────────────────────────────
  let inverted = 0, orderCols = 0;
  for (let z = 0; z + 1 < grid.zoneLayers.length; z++) {
    const a = grid.zoneLayers[z], b = grid.zoneLayers[z + 1];
    for (let c = 0; c < nCol; c++) {
      if (!p.activeCol[c]) continue;
      const at = a.topZ[c], bt = b.topZ[c];
      if (!Number.isFinite(at) || !Number.isFinite(bt)) continue;
      orderCols++;
      if (bt < at - o.tolM) inverted++;
    }
  }
  checks.push({
    id: 'zone.order', label: 'Stratigraphic order',
    verdict: orderCols === 0 ? 'n/a' : inverted === 0 ? 'ok' : 'fail',
    count: inverted, of: orderCols,
    finding: orderCols === 0 ? 'only one zone' : inverted === 0
      ? 'every zone lies below the one above it, in every column'
      : `${inverted} column-pairs where the LOWER zone starts above the upper one`,
    consequence: inverted === 0 ? undefined : 'the layer index no longer runs downwards, so k-direction transmissibility connects cells in the wrong order',
  });

  // ── active columns that hold no rock ──────────────────────────────────────
  let activeCols = 0, hollow = 0;
  for (let c = 0; c < nCol; c++) {
    if (!p.activeCol[c]) continue;
    activeCols++;
    if (!colLive[c]) hollow++;
  }
  checks.push({
    id: 'col.hollow', label: 'Active columns with no live cell',
    verdict: hollow === 0 ? 'ok' : 'warn',
    count: hollow, of: activeCols,
    finding: hollow === 0 ? 'none' : `${hollow} of ${activeCols} active columns (${pct(hollow, activeCols)}) contain no cell of positive thickness`,
    consequence: hollow === 0 ? undefined : 'they occupy the activity mask without holding rock; ACTNUM should exclude them or the simulator carries dead cells',
  });

  // ── connectivity: one body, or several? ───────────────────────────────────
  //
  // A simulator will happily run an island that touches nothing — and report it as
  // undrained volume forever, because no well can reach it.
  const comp = components(p.nx, p.ny, colLive);
  checks.push({
    id: 'grid.connected', label: 'Areal connectivity',
    verdict: comp.count <= 1 ? 'ok' : 'warn',
    count: comp.count, of: activeCols,
    finding: comp.count <= 1
      ? 'the live grid is one connected body'
      : `${comp.count} disconnected bodies; the largest holds ${pct(comp.largest, comp.live)} of live columns`,
    consequence: comp.count <= 1 ? undefined : 'an isolated body cannot be reached by any well, so its volume can never be produced and will sit in the report as a permanent shortfall',
  });

  // ── the checks this geometry makes impossible ─────────────────────────────
  const NA = (id: string, label: string, why: string): QcCheck =>
    ({ id, label, verdict: 'n/a', count: 0, of: 0, finding: why });
  checks.push(
    NA('cell.twisted', 'Twisted cells',
      'impossible by construction — twisting requires non-vertical pillars, and every pillar here is vertical'),
    NA('cell.nonplanar', 'Non-planar faces',
      'impossible by construction — a cell face is a horizontal rectangle at one depth, so it cannot warp'),
    NA('pillar.crossing', 'Crossing pillars',
      'impossible by construction — vertical pillars on a regular areal mesh never converge'),
    NA('fault.throw', 'Fault-throw consistency',
      'no faults in the model; this becomes a real check the day the grid gains them'),
  );

  let worst: QcVerdict = 'ok';
  for (const c of checks) if (c.verdict !== 'n/a') worst = worse(worst, c.verdict);

  return { checks, zones, worst, totalCells, liveCells };
}

/** 4-connected components over the live-column mask. */
function components(nx: number, ny: number, live: Uint8Array): { count: number; largest: number; live: number } {
  const seen = new Uint8Array(nx * ny);
  let count = 0, largest = 0, total = 0;
  const stack: number[] = [];
  for (let c = 0; c < live.length; c++) if (live[c]) total++;

  for (let s = 0; s < live.length; s++) {
    if (!live[s] || seen[s]) continue;
    count++;
    let size = 0;
    stack.push(s); seen[s] = 1;
    while (stack.length) {
      const c = stack.pop() as number;
      size++;
      const i = c % nx, j = (c - i) / nx;
      if (i > 0 && live[c - 1] && !seen[c - 1]) { seen[c - 1] = 1; stack.push(c - 1); }
      if (i < nx - 1 && live[c + 1] && !seen[c + 1]) { seen[c + 1] = 1; stack.push(c + 1); }
      if (j > 0 && live[c - nx] && !seen[c - nx]) { seen[c - nx] = 1; stack.push(c - nx); }
      if (j < ny - 1 && live[c + nx] && !seen[c + nx]) { seen[c + nx] = 1; stack.push(c + nx); }
    }
    if (size > largest) largest = size;
  }
  return { count, largest, live: total };
}
