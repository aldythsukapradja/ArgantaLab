// sim-run — turn the static realisation and the published fluid case into a run.
//
// ── WHAT THIS IS, AND WHAT IT IS NOT ────────────────────────────────────────
//
// The solver underneath (`engine/sim/fv`) is a two-phase, incompressible,
// IMPES/implicit finite-volume waterflood on an AREAL grid. That means:
//
//   · it is 2D. The 3D layering is collapsed to one areal layer by summing
//     transmissibility and pore volume down each column, which is the standard
//     screening simplification and is EXACTLY right for a waterflood whose vertical
//     sweep is not the question being asked;
//   · it is two-phase. There is no free gas, so a case below bubble point is outside
//     what this can say anything about;
//   · pressure is solved, but the fluids are incompressible — so it reproduces
//     movement and breakthrough, not depletion.
//
// None of that is hidden. `runCase` returns the assumptions it ran under, and the UI
// states them next to every number. A screening simulator that lets someone believe it
// is a full-physics one is worse than no simulator.
//
// ── UNITS ───────────────────────────────────────────────────────────────────
//
// The solver works in RESERVOIR volumes. Everything a reader sees is SURFACE volumes,
// converted by Bo and Bw at the end. Reporting reservoir barrels as stock-tank is the
// single easiest way to overstate a field by 40%, and it has happened in this codebase
// before (STOIIP, before the Bo divide was found).
// TYPE-ONLY. The solver is INJECTED rather than imported, for two reasons: it keeps
// this module runnable in plain node (the truth-lock exercises the layer that decides,
// not the one that paints), and it lets a test drive the conversion with a stub result
// whose numbers it chose, instead of asserting against whatever the solver happens to
// return.
import type { FvCfg, FvResult } from '../../engine/sim/fv';
import type { Well } from '../../engine/sim/pressure';

/**
 * Peaceman equivalent radius and well index.
 *
 * INLINED rather than imported from `engine/sim/pressure`, for the same reason the
 * solver is injected: a value import there is extensionless and will not resolve in
 * plain node, and this module has to stay runnable by the truth-lock. The lock
 * cross-checks both against the engine's own versions, so the copies cannot drift.
 */
export const peacemanR0 = (dx: number, dy: number) => 0.14 * Math.sqrt(dx * dx + dy * dy);
export const wellIndex = (k: number, h: number, r0: number, rw: number, skin = 0) =>
  (2 * Math.PI * k * h) / (Math.log(r0 / rw) + skin);

export interface SimGridLike {
  nx: number; ny: number; nz: number;
  dx: number; dy: number; x0: number; y0: number;
  activeCol: ArrayLike<number>;
  topZ: ArrayLike<number>; baseZ: ArrayLike<number>;
}

/** what the fluid case contributes — the shape `toSimFluids` already produces */
export interface SimFluidsLike {
  swc: number; sor: number; krwMax: number; kroMax: number; nw: number; no: number;
  muw: number; muo: number;
  bo: number; bw: number;
  swInit: number; pInit: number;
}

export interface SimWellInput {
  name: string;
  /** map position, in the grid's own CRS */
  x: number; y: number;
  kind: 'producer' | 'injector';
  /** producers run on bottom-hole pressure, injectors on rate (rm³/d) */
  bhp?: number;
  rate?: number;
}

export interface ColumnAverages {
  /** thickness-weighted mean porosity per column, NaN where inactive */
  phi: Float64Array;
  /** thickness-weighted mean permeability, mD */
  k: Float64Array;
  /** initial water saturation */
  sw: Float64Array;
  /** gross thickness, m */
  h: Float64Array;
}

/**
 * Collapse the 3D property field to one areal layer.
 *
 * Thickness-weighted, and thickness is the CELL's, not the model's — the same trap the
 * volumetrics hit twice. A column with no active cells contributes NaN, never 0: zero
 * porosity is a legitimate value and would enter the average as one.
 */
export function columnAverages(
  g: SimGridLike,
  at: (col: number, layer: number) => { phi: number; perm: number; sw: number } | null,
  spanOf?: (col: number, layer: number) => { top: number; base: number } | null,
): ColumnAverages {
  const nCol = g.nx * g.ny;
  const phi = new Float64Array(nCol).fill(NaN);
  const k = new Float64Array(nCol).fill(NaN);
  const sw = new Float64Array(nCol).fill(NaN);
  const h = new Float64Array(nCol).fill(0);

  for (let c = 0; c < nCol; c++) {
    if (!g.activeCol[c]) continue;
    const t = g.topZ[c], b = g.baseZ[c];
    if (!Number.isFinite(t) || !Number.isFinite(b) || b <= t) continue;
    const uniform = (b - t) / g.nz;
    let pw = 0, kw = 0, sww = 0, w = 0;
    for (let l = 0; l < g.nz; l++) {
      const sp = spanOf?.(c, l);
      const lh = sp ? sp.base - sp.top : uniform;
      if (!(lh > 0)) continue;
      const v = at(c, l);
      if (!v || !Number.isFinite(v.phi)) continue;
      pw += v.phi * lh;
      // PERMEABILITY AVERAGES GEOMETRICALLY IN THE LAYER-PARALLEL SENSE, but for a
      // flow-in-the-layer problem the arithmetic (kh) average is the right one: the
      // layers are in PARALLEL, and parallel conductances add.
      kw += (Number.isFinite(v.perm) ? v.perm : 0) * lh;
      sww += (Number.isFinite(v.sw) ? v.sw : 1) * lh;
      w += lh;
    }
    if (w > 0) { phi[c] = pw / w; k[c] = kw / w; sw[c] = sww / w; h[c] = w; }
  }
  return { phi, k, sw, h };
}

/** grid column index of a map position, or -1 when it falls outside */
export function colAt(g: SimGridLike, x: number, y: number): number {
  const i = Math.floor((x - g.x0) / g.dx);
  const j = Math.floor((y - g.y0) / g.dy);
  if (i < 0 || j < 0 || i >= g.nx || j >= g.ny) return -1;
  return j * g.nx + i;
}

export interface BuildResult {
  cfg: FvCfg;
  /** wells that landed on an active column, in solver order */
  placed: Array<{ name: string; kind: 'producer' | 'injector'; i: number; j: number }>;
  /** wells that could not be placed, and why — never silently dropped */
  rejected: Array<{ name: string; reason: string }>;
  /** mean gross thickness of the active area, m */
  meanH: number;
}

/**
 * Build the solver's input.
 *
 * A well that falls outside the grid, or on an inactive column, is REJECTED WITH A
 * REASON rather than nudged to the nearest live cell. Nudging is how a producer ends
 * up drilled into an aquifer in the model and nowhere near it in the field, and the
 * plot still looks reasonable.
 */
export function buildFvCfg(
  g: SimGridLike,
  cols: ColumnAverages,
  fluids: SimFluidsLike,
  wells: SimWellInput[],
  opts: { defaultBhp?: number; defaultRate?: number; wellRadius?: number; skin?: number } = {},
): BuildResult {
  const nCol = g.nx * g.ny;
  const phi = new Float64Array(nCol);
  const k = new Float64Array(nCol);
  const swInit = new Float64Array(nCol);
  let hs = 0, hn = 0;
  // ── AN INACTIVE COLUMN IS NEARLY NO-FLOW, NOT EXACTLY NO-FLOW ────────────
  //
  // Zero permeability disconnects a cell from the pressure system entirely. Its row
  // has a zero diagonal, the preconditioner divides by it, and the NaN propagates
  // through the whole solution — so on the real Volve grid, which is 47% inactive,
  // every pressure came back NaN and nothing was ever produced. The saturation front
  // still advanced, which is what made it look like it was working.
  //
  // DEAD is therefore 1e-9 of the live mean rather than 0: small enough that nothing
  // measurable flows or is stored there, large enough that the matrix stays solvable.
  let kSum = 0, kN = 0;
  for (let c = 0; c < nCol; c++) {
    if (Number.isFinite(cols.k[c]) && cols.h[c] > 0) { kSum += cols.k[c]; kN++; }
  }
  const kDead = kN ? Math.max(1e-12, (kSum / kN) * 1e-9) : 1e-12;
  const PHI_DEAD = 1e-9;

  for (let c = 0; c < nCol; c++) {
    const ok = Number.isFinite(cols.phi[c]) && cols.h[c] > 0;
    phi[c] = ok ? cols.phi[c] : PHI_DEAD;
    k[c] = ok ? Math.max(1e-6, cols.k[c]) : kDead;
    // a dead column holds water, not oil: it is outside the accumulation, and
    // initialising it at connate would put oil in rock the model says is not there
    swInit[c] = ok && Number.isFinite(cols.sw[c]) ? cols.sw[c] : 1;
    if (ok) { hs += cols.h[c]; hn++; }
  }
  const meanH = hn ? hs / hn : 0;

  const placed: BuildResult['placed'] = [];
  const rejected: BuildResult['rejected'] = [];
  const solverWells: Well[] = [];
  for (const w of wells) {
    const c = colAt(g, w.x, w.y);
    if (c < 0) { rejected.push({ name: w.name, reason: 'outside the grid' }); continue; }
    if (!g.activeCol[c] || !(cols.h[c] > 0)) {
      rejected.push({ name: w.name, reason: 'lands on an inactive column' });
      continue;
    }
    const i = c % g.nx, j = (c - (c % g.nx)) / g.nx;
    if (w.kind === 'injector') {
      // ── SIGN ──
      // The solver adds `rate` to the cell's right-hand side, so a POSITIVE rate is a
      // source: fluid entering the reservoir. Negating it turned every injector into a
      // second producer, which left the incompressible system with no source at all —
      // pressure ran to 1e15 and the flood never started.
      solverWells.push({ i, j, mode: 'rate', rate: w.rate ?? opts.defaultRate ?? 800 });
    } else {
      // ── WELL INDEX ──
      // A bhp well's flow is WI·λ·(p − pbhp). With no WI it is 2π·k·h/ln(r0/rw) = 0:
      // the well contributes nothing to the matrix and produces nothing, and with the
      // only sink gone the pressure solve is singular. Peaceman, on the cell's own
      // permeability and the layer thickness the areal collapse produced.
      const kCell = Math.max(1e-6, cols.k[c]);
      const r0 = peacemanR0(g.dx, g.dy);
      const WI = wellIndex(kCell, meanH, r0, opts.wellRadius ?? 0.1, opts.skin ?? 0);
      solverWells.push({ i, j, mode: 'bhp', bhp: w.bhp ?? opts.defaultBhp ?? 0.6 * fluids.pInit, WI });
    }
    placed.push({ name: w.name, kind: w.kind, i, j });
  }

  return {
    cfg: {
      nx: g.nx, ny: g.ny, dx: g.dx, dy: g.dy, dz: meanH,
      phi, k, muw: fluids.muw, muo: fluids.muo,
      corey: {
        swc: fluids.swc, sor: fluids.sor,
        krwMax: fluids.krwMax, kroMax: fluids.kroMax,
        nw: fluids.nw, no: fluids.no,
      },
      wells: solverWells,
      swInit,
    },
    placed, rejected, meanH,
  };
}

// ── the series a reader actually looks at ───────────────────────────────────

export interface FieldStep {
  /** days */
  t: number;
  /** pore volumes injected */
  pvi: number;
  /** SURFACE rates, Sm³/d */
  oilRate: number; waterRate: number; injRate: number;
  /** SURFACE cumulatives, Sm³ */
  cumOil: number; cumWater: number; cumInj: number;
  watercut: number;
  /** mean reservoir pressure, bar */
  pAvg: number;
  /** recovery factor against the run's own OOIP */
  rf: number;
}

export interface WellStep { t: number; rate: number }

export interface RunSeries {
  field: FieldStep[];
  /** per well, in the order `placed` gives */
  wells: Array<{ name: string; kind: 'producer' | 'injector'; steps: WellStep[] }>;
  /** SURFACE oil in place at t=0, Sm³ */
  ooipSm3: number;
  poreVolume: number;
}

/**
 * Convert the solver's reservoir volumes to surface volumes and difference the
 * cumulatives into rates.
 *
 * Rates are DIFFERENCED, not taken from the solver's instantaneous well rate: the
 * report steps are far coarser than the timesteps, so an instantaneous rate at a report
 * time is a sample of a curve, while the difference of cumulatives is the average over
 * the interval — and only the second one integrates back to the cumulative on the
 * chart beside it. Two curves that do not agree with each other is the fastest way to
 * lose a reader's trust.
 */
export function toSeries(
  res: FvResult,
  placed: BuildResult['placed'],
  fluids: SimFluidsLike,
): RunSeries {
  const bo = fluids.bo > 0 ? fluids.bo : 1;
  const bw = fluids.bw > 0 ? fluids.bw : 1;
  const field: FieldStep[] = [];
  const wells = placed.map((p) => ({ name: p.name, kind: p.kind, steps: [] as WellStep[] }));

  const ooipSm3 = res.ooip / bo;
  let prev: { t: number; co: number; cw: number; ci: number } | null = null;
  let cumInjRes = 0;

  for (const s of res.snapshots) {
    // injected reservoir volume = pore volumes injected x pore volume
    cumInjRes = s.pvi * res.poreVol;
    const co = s.cumOil / bo, cw = s.cumWater / bw, ci = cumInjRes / bw;
    const dt = prev ? s.t - prev.t : 0;
    const oilRate = prev && dt > 0 ? (co - prev.co) / dt : 0;
    const waterRate = prev && dt > 0 ? (cw - prev.cw) / dt : 0;
    const injRate = prev && dt > 0 ? (ci - prev.ci) / dt : 0;

    let ps = 0, pn = 0;
    for (let c = 0; c < s.p.length; c++) if (Number.isFinite(s.p[c])) { ps += s.p[c]; pn++; }

    field.push({
      t: s.t, pvi: s.pvi,
      oilRate, waterRate, injRate,
      cumOil: co, cumWater: cw, cumInj: ci,
      watercut: s.waterCut,
      pAvg: pn ? ps / pn : NaN,
      rf: ooipSm3 > 0 ? co / ooipSm3 : 0,
    });

    for (let w = 0; w < wells.length; w++) {
      const r = s.wellRate[w];
      // the solver signs production positive; injection is reported positive too, so
      // the two read as magnitudes and the sign never has to be explained on a chart
      wells[w].steps.push({ t: s.t, rate: Math.abs(Number.isFinite(r) ? r : 0) / (wells[w].kind === 'injector' ? bw : bo) });
    }
    prev = { t: s.t, co, cw, ci };
  }

  return { field, wells, ooipSm3, poreVolume: res.poreVol };
}

export interface RunAssumptions {
  phases: string;
  dimensionality: string;
  compressibility: string;
  /** anything that makes the run inapplicable, stated up front */
  caveats: string[];
}

/** The assumptions, as text the UI prints beside the numbers. Never omitted. */
export function assumptionsOf(meanH: number, rejected: BuildResult['rejected']): RunAssumptions {
  const caveats: string[] = [];
  if (rejected.length) {
    caveats.push(`${rejected.length} well${rejected.length === 1 ? '' : 's'} could not be placed: ` +
      rejected.map((r) => `${r.name} (${r.reason})`).join(', '));
  }
  if (!(meanH > 0)) caveats.push('the active area has no thickness — nothing can flow');
  return {
    phases: 'two-phase oil/water; no free gas, so a case below bubble point is out of scope',
    dimensionality: `areal (2D), ${meanH.toFixed(1)} m mean gross thickness collapsed from the layered model`,
    compressibility: 'incompressible — reproduces movement and breakthrough, not depletion',
    caveats,
  };
}

export interface RunOptions {
  /** days */
  tEnd: number;
  nReports?: number;
  timestepping?: 'implicit' | 'impes';
}

/** the solver's shape —  satisfies it */
export type FvSolver = (
  cfg: FvCfg,
  opts: { tEnd: number; nReports?: number; cfl?: number; timestepping?: 'implicit' | 'impes'; implicitSubs?: number },
) => FvResult;

export interface RunOutput {
  series: RunSeries;
  result: FvResult;
  build: BuildResult;
  assumptions: RunAssumptions;
}

/** Build, run and convert — the one call the UI makes. */
export function runCase(
  g: SimGridLike, cols: ColumnAverages, fluids: SimFluidsLike,
  wells: SimWellInput[], opts: RunOptions, solve: FvSolver,
): RunOutput {
  const build = buildFvCfg(g, cols, fluids, wells);
  const result = solve(build.cfg, {
    tEnd: opts.tEnd,
    nReports: opts.nReports ?? 60,
    timestepping: opts.timestepping ?? 'implicit',
  });
  return {
    series: toSeries(result, build.placed, fluids),
    result, build,
    assumptions: assumptionsOf(build.meanH, build.rejected),
  };
}

/**
 * Split a run at the history end date.
 *
 * The FORECAST is the part after it, and it is labelled as such on every chart. A
 * curve that runs continuously from history into prediction with nothing marking the
 * join invites the reader to trust the right-hand end as much as the left, which is
 * the whole problem with forecasts.
 */
export function splitAtHistory(series: RunSeries, tHistoryEnd: number): {
  history: FieldStep[]; forecast: FieldStep[];
} {
  return {
    history: series.field.filter((s) => s.t <= tHistoryEnd),
    // the last history point is repeated so the two curves JOIN rather than leaving a
    // one-interval gap the eye reads as a discontinuity in the physics
    forecast: series.field.filter((s, i) => s.t > tHistoryEnd
      || (series.field[i + 1] && series.field[i + 1].t > tHistoryEnd)),
  };
}
