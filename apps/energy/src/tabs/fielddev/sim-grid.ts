// sim-grid.ts — facies (SIS) and porosity (SGS) over a 3D grid (S6 · S7).
//
// `geostat.sis` and `geostat.sgs` are truth-locked and 2D: they simulate onto a set
// of {x,y} targets. A 3D grid is simulated LAYER BY LAYER, each layer being one
// areal slice — the standard treatment, and the one the concept describes.
//
// ── THE COST PROBLEM, AND THE HONEST ANSWER ─────────────────────────────────
//
// Both engines push every simulated node back into the conditioning set and then
// call `nearest()` — a full scan and sort — for the next one. That is O(N² log N)
// per layer. Volve's model grid is 190 × 143 = 27,170 nodes per layer, so a single
// layer is ~10⁹ operations and a 40-layer model is out of reach by three orders of
// magnitude.
//
// The answer is NOT to quietly simulate something smaller and present it as the
// model. It is to simulate on a coarse SIMULATION GRID, upsample to the model grid,
// and say so everywhere the result is shown. A 32 × 32 simulation upsampled onto
// 190 × 143 is a 32 × 32 simulation — it has 32 × 32 worth of spatial detail, and
// calling it anything else would be the whole failure this codebase exists to avoid.
// `SimResult.simGrid` carries the truth and the UI is required to display it.
//
// Pure — no DOM, no IndexedDB, no `import.meta`.
import { sis, sgs, type Vario, type Pt, type FaciesPt } from '../../engine/geostat.ts';
import { phiToK } from '../../engine/perm.ts';

/** The coarse grid a layer is actually simulated on. */
export interface SimGrid {
  nx: number; ny: number;
  dx: number; dy: number;
  x0: number; y0: number;
}

export interface SimConditioning {
  /** areal column of the conditioning datum on the MODEL grid */
  i: number; j: number;
  /** layer index */
  k: number;
  facies: 0 | 1;
  phie: number;
  /** net fraction of the cell — the petrophysical net-to-gross, NOT the facies code.
   *  Simulated as its own property because "is this cell sand" and "how much of this
   *  cell is pay" are different questions with different answers. */
  ntg?: number;
}

export interface SimSpec {
  vario: Vario;
  seed: number;
  /** target sand fraction; defaults to the conditioning proportion */
  globalSand?: number;
  /** nodes per side of the simulation grid — the honest resolution */
  simNodes: number;
  /** φ→k transform coefficients: log10 k = a·φ + b */
  permA: number;
  permB: number;
  /** vertical-to-horizontal permeability ratio */
  kvkh: number;
  /**
   * Which layers to simulate. Omit and every layer is simulated.
   *
   * A φ–k transform is fitted to ONE formation and means nothing outside it. Volve's
   * grid carries 1.2 km of overburden above the Hugin, and simulating it produced
   * porosities of soft shallow sediment that the Hugin transform turned into millions
   * of millidarcy: 78% of the Seabed→Ty cells hit the physical ceiling against 0.2%
   * of the reservoir's. Those cells were never going to be flow-simulated, so the
   * answer is to leave them EMPTY rather than to invent a number and cap it.
   */
  layers?: ReadonlySet<number> | number[];
}

export interface SimLayerResult {
  k: number;
  /** [modelNx*modelNy] facies per column of this layer */
  facies: Uint8Array;
  /** [modelNx*modelNy] porosity */
  phie: Float32Array;
  /** [modelNx*modelNy] net-to-gross, simulated from the upscaled net fraction */
  ntg: Float32Array;
  /** [modelNx*modelNy] HORIZONTAL permeability, mD */
  perm: Float32Array;
  /** [modelNx*modelNy] VERTICAL permeability, mD — kv = kh · kvkh. Without it the
   *  simulator cannot compute vertical flow at all. */
  permZ: Float32Array;
  /** cells whose φ→k extrapolated beyond PERM_MAX_MD and were capped */
  permCapped: number;
  /** conditioning data this layer actually had */
  conditioned: number;
  /** false when the layer was deliberately left outside the property model — its
   *  arrays are zero-filled and must not be read as a realisation */
  simulated: boolean;
}

export interface SimResult {
  layers: SimLayerResult[];
  /** THE resolution the simulation ran at — not the model grid */
  simGrid: SimGrid;
  /** model areal size, for the record */
  modelNx: number; modelNy: number;
  /** sand fraction achieved across every simulated node */
  sandFraction: number;
  /** layers that had no conditioning datum at all */
  unconditionedLayers: number;
  /** layers a realisation was actually produced for */
  simulatedLayers: number;
  /** layers deliberately left outside the property model, per `SimSpec.layers` */
  skippedLayers: number;
  /** cells inside the simulated layers — the denominator for any property statistic */
  simulatedCells: number;
  /** cells whose permeability was capped at the physical ceiling — if this is a large
   *  fraction, the φ–k transform is being used outside its valid range */
  permCapped: number;
  seed: number;
  ms: number;
}

/**
 * Derive the simulation grid from the model grid.
 *
 * Keeps the same extent so a simulated node sits inside the area it describes, and
 * never goes FINER than the model — simulating at higher resolution than the grid
 * that will hold it is work thrown away.
 */
export function deriveSimGrid(
  model: { nx: number; ny: number; dx: number; dy: number; x0: number; y0: number },
  simNodes: number,
): SimGrid {
  const nx = Math.max(2, Math.min(model.nx, Math.round(simNodes)));
  const ny = Math.max(2, Math.min(model.ny, Math.round(simNodes)));
  return {
    nx, ny,
    // the simulation grid spans the same ground, so its cells are proportionally larger
    dx: (model.nx * model.dx) / nx,
    dy: (model.ny * model.dy) / ny,
    x0: model.x0, y0: model.y0,
  };
}

/** World centre of a simulation node. */
export const simNodeXY = (g: SimGrid, i: number, j: number) => ({
  x: g.x0 + (i + 0.5) * g.dx,
  y: g.y0 + (j + 0.5) * g.dy,
});

/** Which simulation node a MODEL column falls in — nearest-neighbour upsampling. */
export function simNodeOf(
  model: { dx: number; dy: number; x0: number; y0: number },
  sim: SimGrid,
  i: number, j: number,
): number {
  const x = model.x0 + (i + 0.5) * model.dx;
  const y = model.y0 + (j + 0.5) * model.dy;
  const si = Math.max(0, Math.min(sim.nx - 1, Math.floor((x - sim.x0) / sim.dx)));
  const sj = Math.max(0, Math.min(sim.ny - 1, Math.floor((y - sim.y0) / sim.dy)));
  return sj * sim.nx + si;
}

/**
 * Simulate one layer.
 *
 * Facies first (SIS), then porosity (SGS) run SEPARATELY PER FACIES — a sand
 * porosity population and a shale porosity population are different distributions,
 * and simulating them together produces a field with neither one's statistics. A
 * facies with no conditioning datum in this layer falls back to the layer's overall
 * φ distribution, which is reported through `conditioned` rather than hidden.
 */
export function simulateLayer(
  cond: SimConditioning[],
  model: { nx: number; ny: number; dx: number; dy: number; x0: number; y0: number },
  sim: SimGrid,
  spec: SimSpec,
  k: number,
): SimLayerResult {
  const nSim = sim.nx * sim.ny;
  const targets: Array<{ x: number; y: number }> = new Array(nSim);
  for (let j = 0; j < sim.ny; j++) {
    for (let i = 0; i < sim.nx; i++) targets[j * sim.nx + i] = simNodeXY(sim, i, j);
  }

  // conditioning data, placed at their MODEL column centres
  const at = (c: SimConditioning) => ({
    x: model.x0 + (c.i + 0.5) * model.dx,
    y: model.y0 + (c.j + 0.5) * model.dy,
  });

  // ── facies ──
  const fPts: FaciesPt[] = cond.map((c) => ({ ...at(c), f: c.facies }));
  // the seed varies per layer, or every layer of the model is the same picture
  const simFacies = sis(fPts, targets, spec.vario, spec.seed + k * 7919, spec.globalSand);

  // ── porosity, per facies, ON NET ROCK ONLY ──
  //
  // The volume equation is GRV × NTG × φ × (1−Sw), so the φ it wants is the porosity
  // of the NET rock — the same φ a petrophysicist quotes. Conditioning on cells that
  // contain no net rock at all pulls the simulated field down toward shale porosity,
  // and multiplying THAT by a net-to-gross removes the shale twice. Cells with no net
  // fraction are therefore excluded from the porosity conditioning while still
  // conditioning facies and NTG, because "how much of this cell is pay" is exactly the
  // question they answer.
  const netCond = cond.filter((c) => !Number.isFinite(c.ntg as number) || (c.ntg as number) > 0);
  const phiCond = netCond.length ? netCond : cond;
  const phiBy: Record<0 | 1, number[]> = { 0: new Array(nSim).fill(NaN), 1: new Array(nSim).fill(NaN) };
  for (const f of [0, 1] as const) {
    const pts: Pt[] = phiCond.filter((c) => c.facies === f).map((c) => ({ ...at(c), v: c.phie }));
    if (pts.length >= 2) {
      const vals = sgs(pts, targets, spec.vario, spec.seed + k * 104729 + f);
      for (let n = 0; n < nSim; n++) phiBy[f][n] = vals[n];
    } else if (pts.length === 1) {
      // one datum is not a distribution to simulate — it is a constant, and saying
      // so beats generating noise around it and calling that a realisation
      phiBy[f].fill(pts[0].v);
    }
  }
  // a facies with no datum at all borrows the other's mean rather than leaving a hole
  const meanOf = (f: 0 | 1) => {
    const pts = phiCond.filter((c) => c.facies === f);
    return pts.length ? pts.reduce((a, c) => a + c.phie, 0) / pts.length : NaN;
  };
  const fallback = (() => {
    const all = phiCond.map((c) => c.phie);
    return all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
  })();
  for (const f of [0, 1] as const) {
    if (Number.isNaN(phiBy[f][0])) {
      const m = meanOf(f);
      phiBy[f].fill(Number.isFinite(m) ? m : fallback);
    }
  }

  // ── net-to-gross, simulated like porosity ──
  //
  // NTG gets its own realisation rather than being read off the facies code. A cell
  // can be classified sand and still be only half pay: the facies code answers "what
  // rock is this", the cutoffs answer "how much of it flows", and substituting one for
  // the other is what put NTG at 0.800 where the logs measure 0.308.
  const ntgHas = cond.some((c) => Number.isFinite(c.ntg as number));
  const ntgBy: number[] = new Array(nSim).fill(NaN);
  if (ntgHas) {
    const pts: Pt[] = cond
      .filter((c) => Number.isFinite(c.ntg as number))
      .map((c) => ({ ...at(c), v: c.ntg as number }));
    if (pts.length >= 2) {
      const vals = sgs(pts, targets, spec.vario, spec.seed + k * 15485863 + 3);
      for (let n = 0; n < nSim; n++) ntgBy[n] = vals[n];
    } else if (pts.length === 1) {
      ntgBy.fill(pts[0].v);
    }
  }

  // ── upsample the simulation onto the model grid ──
  const nCol = model.nx * model.ny;
  const facies = new Uint8Array(nCol);
  const ntg = new Float32Array(nCol);
  const phie = new Float32Array(nCol);
  const perm = new Float32Array(nCol);
  const permZ = new Float32Array(nCol);
  let capped = 0;
  for (let j = 0; j < model.ny; j++) {
    for (let i = 0; i < model.nx; i++) {
      const c = j * model.nx + i;
      const n = simNodeOf(model, sim, i, j);
      const f = simFacies[n] as 0 | 1;
      const p = Math.max(0, Math.min(0.6, phiBy[f][n]));
      facies[c] = f;
      phie[c] = p;
      // a net fraction is a fraction; the simulation can overshoot on back-transform
      ntg[c] = ntgHas ? Math.max(0, Math.min(1, ntgBy[n])) : (f ? 1 : 0);
      const raw = phiToK(p, spec.permA, spec.permB);
      // the transform is log-linear and unbounded; beyond the physical ceiling it is
      // extrapolating, and the cap is COUNTED so the extrapolation stays visible
      if (raw > PERM_MAX_MD) capped++;
      const kh = Math.min(raw, PERM_MAX_MD);
      perm[c] = kh;
      permZ[c] = permV(kh, spec.kvkh);
    }
  }

  return { k, facies, ntg, phie, perm, permZ, permCapped: capped, conditioned: cond.length, simulated: true };
}

/** A layer left outside the property model: zero-filled, and honest about it. */
export function emptyLayer(nCol: number, k: number): SimLayerResult {
  return {
    k,
    facies: new Uint8Array(nCol),
    ntg: new Float32Array(nCol),
    phie: new Float32Array(nCol),
    perm: new Float32Array(nCol),
    permZ: new Float32Array(nCol),
    permCapped: 0, conditioned: 0, simulated: false,
  };
}

/**
 * Simulate every layer.
 *
 * `onLayer` fires per layer so a long run reports rather than freezing, and so it
 * can be cancelled — a modelling run you cannot cancel is one you only start once.
 */
export function simulateGrid(
  condByLayer: Map<number, SimConditioning[]>,
  model: { nx: number; ny: number; nz: number; dx: number; dy: number; x0: number; y0: number },
  spec: SimSpec,
  onLayer?: (k: number, nz: number) => void,
): SimResult {
  const t0 = Date.now();
  const sim = deriveSimGrid(model, spec.simNodes);
  const layers: SimLayerResult[] = [];
  let sand = 0, nodes = 0, unconditioned = 0;

  // a layer with no datum of its own borrows the whole model's — the alternative is
  // an unconditioned layer of pure noise sitting between two conditioned ones
  const allCond = [...condByLayer.values()].flat();

  const want = spec.layers
    ? (spec.layers instanceof Set ? spec.layers : new Set(spec.layers))
    : null;
  const nCol = model.nx * model.ny;
  let skipped = 0;

  for (let k = 0; k < model.nz; k++) {
    if (want && !want.has(k)) {
      layers.push(emptyLayer(nCol, k));
      skipped++;
      onLayer?.(k + 1, model.nz);
      continue;
    }
    const own = condByLayer.get(k) ?? [];
    if (!own.length) unconditioned++;
    const use = own.length ? own : allCond;
    const layer = simulateLayer(use, model, sim, spec, k);
    layers.push(layer);
    for (let c = 0; c < layer.facies.length; c++) { sand += layer.facies[c]; nodes++; }
    onLayer?.(k + 1, model.nz);
  }

  return {
    layers, simGrid: sim,
    permCapped: layers.reduce((n, l) => n + l.permCapped, 0),
    modelNx: model.nx, modelNy: model.ny,
    sandFraction: nodes ? sand / nodes : 0,
    unconditionedLayers: unconditioned,
    simulatedLayers: model.nz - skipped,
    skippedLayers: skipped,
    /** cells the permeability statistics are computed over — skipped layers are not
     *  a zero-permeability rock, they are an unanswered question */
    simulatedCells: (model.nz - skipped) * nCol,
    seed: spec.seed,
    ms: Date.now() - t0,
  };
}

/**
 * The maximum permeability that can be rock.
 *
 * `phiToK` is log-linear — log10 k = a·φ + b — so it has no upper bound. With the
 * analogue coefficients (a = 19, b = −1.5) a porosity of 0.40 gives 1.3 million mD
 * and 0.60 gives 10⁹. The transform is calibrated over a limited φ range and says
 * nothing outside it; extrapolating produces a number a simulator will accept and
 * a reservoir cannot contain. Unconsolidated sand tops out around 20 darcy, so
 * anything beyond this is the transform failing, not the rock succeeding.
 */
export const PERM_MAX_MD = 20000;

/** Vertical permeability from horizontal, by the kv/kh ratio. */
export const permV = (kh: number, kvkh: number) => kh * kvkh;

/**
 * Roughly how long a run will take, so a user can see the cost of asking for a finer
 * simulation grid BEFORE waiting for it. Calibrated on the O(N² log N) shape of the
 * engines rather than measured — it is an order-of-magnitude guide and is presented
 * as one.
 */
export function estimateSimOps(simNodes: number, nz: number): number {
  const n = simNodes * simNodes;
  // per layer: SIS over n targets, plus SGS twice (one per facies)
  return Math.round(3 * n * n * Math.log2(Math.max(2, n)) * nz);
}
