// volumes.ts — GRV → STOIIP, two independent ways (S9).
//
// The tab always shows BOTH:
//
//   GRID-BASED  Σ over cells of bulk · NTG · φ · (1−Sw), above the contact.
//               Every cell's own properties, so heterogeneity is honoured.
//   MAP-BASED   GRV × N:G × φ × (1−Sw) / Bo, with GRV from the bounding surfaces
//               and the contact, and single average properties.
//
// They should agree. When they do not, the difference is a QC finding about the grid
// — layering too coarse to resolve the contact, a column set active that the surfaces
// exclude, an average that is not representative — and it is DISPLAYED. Reconciling
// them silently, by making one the "answer" and quietly discarding the other, throws
// away the only independent check this workflow has.
//
// THE CONTACT IS A HARD CUT. A cell whose centre lies below the OWC contributes
// nothing. Partial cells at the contact are counted by the fraction of their
// thickness above it, because a 20 m layer straddling the contact would otherwise
// swing the answer by its whole volume depending on which side its centre fell.
//
// Pure — no DOM, no IndexedDB, no `import.meta`.
import { BBL_PER_SM3 } from '../../engine/volumetrics.ts';

export { BBL_PER_SM3 };

export interface VolumeCell {
  /** which zone this cell belongs to — volumes are computed PER ZONE, because the
   *  overburden is not the reservoir and summing it produces a number hundreds of
   *  times too large */
  zone?: string;
  /** cell-centre TVDSS, positive down */
  z: number;
  /** true vertical thickness, m */
  thk: number;
  /** bulk volume, m³ */
  bulk: number;
  ntg: number;
  phi: number;
  sw: number;
  active: boolean;
}

export interface VolumeInputs {
  /** oil-water contact, TVDSS positive down */
  owc: number;
  /** formation volume factor, rm³/sm³ */
  bo: number;
  /**
   * The RESERVOIR zones. Only cells in these contribute.
   *
   * Omitting it counts every zone in the model — including the entire overburden
   * from seabed down, which on Volve produced a STOIIP 218× the official figure.
   * A structural model spans the whole section; a volume belongs to the reservoir.
   */
  zones?: string[];
}

export interface GridVolumes {
  /** gross rock volume above the contact, m³ */
  grvM3: number;
  /** net rock volume = GRV × NTG */
  nrvM3: number;
  /** pore volume */
  pvM3: number;
  /** hydrocarbon pore volume, reservoir m³ */
  hcpvM3: number;
  /** stock-tank oil initially in place, sm³ */
  stoiipSm3: number;
  /** cells that contributed anything */
  cells: number;
  /** cells cut by the contact and counted fractionally */
  straddling: number;
  /** cells excluded because they lie outside the reservoir zones */
  outOfZone: number;
  /** volume-weighted averages over what actually contributed — these are the
   *  numbers the map-based route should be given, not a naive cell mean */
  meanNtg: number;
  meanPhi: number;
  meanSw: number;
}

/**
 * Fraction of a cell that lies ABOVE the contact.
 *
 * 1 when fully above, 0 when fully below, and the linear share in between. A cell
 * with no thickness is treated as a point: above or below, nothing in between.
 */
export function aboveContactFraction(centreZ: number, thk: number, owc: number): number {
  if (!(thk > 0)) return centreZ < owc ? 1 : 0;
  const top = centreZ - thk / 2;
  const base = centreZ + thk / 2;
  if (base <= owc) return 1;
  if (top >= owc) return 0;
  return (owc - top) / thk;
}

/** Sum the grid. Nothing is estimated: every term comes from a cell. */
export function gridVolumes(cells: VolumeCell[], inputs: VolumeInputs): GridVolumes {
  let grv = 0, nrv = 0, pv = 0, hcpv = 0;
  let n = 0, straddling = 0;
  let wNtg = 0, wPhi = 0, wSw = 0;

  const zoneSet = inputs.zones?.length ? new Set(inputs.zones) : null;
  let outOfZone = 0;

  for (const c of cells) {
    if (!c.active) continue;
    // the reservoir, not the whole section
    if (zoneSet && !(c.zone != null && zoneSet.has(c.zone))) { outOfZone++; continue; }
    const f = aboveContactFraction(c.z, c.thk, inputs.owc);
    if (f <= 0) continue;
    if (f < 1) straddling++;
    const bulk = c.bulk * f;
    const net = bulk * c.ntg;
    const pore = net * c.phi;
    grv += bulk;
    nrv += net;
    pv += pore;
    hcpv += pore * (1 - c.sw);
    // weight each average by the volume it describes — a cell mean would give a
    // 1 m sliver the same say as a 20 m layer
    wNtg += c.ntg * bulk;
    wPhi += c.phi * net;
    wSw += c.sw * pore;
    n++;
  }

  return {
    grvM3: grv, nrvM3: nrv, pvM3: pv, hcpvM3: hcpv,
    stoiipSm3: inputs.bo > 0 ? hcpv / inputs.bo : 0,
    cells: n, straddling, outOfZone,
    meanNtg: grv > 0 ? wNtg / grv : 0,
    meanPhi: nrv > 0 ? wPhi / nrv : 0,
    meanSw: pv > 0 ? wSw / pv : 0,
  };
}

export interface MapVolumes {
  grvM3: number;
  stoiipSm3: number;
}

/** The classic deterministic form, for comparison. */
export function mapVolumes(
  grvM3: number,
  p: { ntg: number; phi: number; sw: number; bo: number },
): MapVolumes {
  const stoiip = p.bo > 0 ? (grvM3 * p.ntg * p.phi * (1 - p.sw)) / p.bo : 0;
  return { grvM3, stoiipSm3: stoiip };
}

/**
 * Does the volume-weighted route reproduce the cell summation EXACTLY?
 *
 * It must, and the algebra says why:
 *
 *   GRV · (Σ ntg·bulk / Σ bulk) = Σ net
 *   Σ net · (Σ φ·net / Σ net)   = Σ pore
 *   Σ pore · (1 − Σ sw·pore / Σ pore) = Σ pore·(1−sw) = HCPV
 *
 * So feeding the map formula the grid's own volume-weighted averages is an IDENTITY,
 * not a comparison. That makes it a useful self-test of the summation — a non-zero
 * residual here means the weighting or the accumulation is wrong — and useless as a
 * cross-check on the model. `reconcile` below therefore takes INDEPENDENT averages.
 */
export function identityResidual(grid: GridVolumes, bo: number): number {
  const viaAverages = mapVolumes(grid.grvM3, {
    ntg: grid.meanNtg, phi: grid.meanPhi, sw: grid.meanSw, bo,
  }).stoiipSm3;
  return grid.stoiipSm3 > 0 ? (grid.stoiipSm3 - viaAverages) / grid.stoiipSm3 : 0;
}

/** Averages a person would actually type into a volumetrics table. */
export interface MapProps { ntg: number; phi: number; sw: number }

export interface Reconciliation {
  grid: GridVolumes;
  map: MapVolumes;
  /** the averages the map route was given, and where they came from */
  mapProps: MapProps;
  mapPropsSource: string;
  /** (grid − map) / map, as a fraction */
  relDiff: number;
  /** residual of the weighted identity — a self-test of the summation, expected 0 */
  identityResidual: number;
  /** what the difference most likely is, stated rather than resolved */
  verdict: string;
}

/**
 * Compare the two routes.
 *
 * `mapProps` must be INDEPENDENT of the grid — the zone averages from the
 * petrophysics, or the numbers on a summary sheet — because averages back-derived
 * from the grid reproduce it by construction (see `identityResidual`) and would make
 * this comparison a tautology dressed as a check.
 *
 * When none are supplied the naive UNWEIGHTED cell mean is used, which is what a
 * reader eyeballing a property table would compute, and is exactly the assumption
 * worth testing.
 */
export function reconcile(
  grid: GridVolumes,
  inputs: VolumeInputs,
  mapProps?: MapProps,
  cells?: VolumeCell[],
): Reconciliation {
  let props = mapProps;
  let source = 'supplied independently';
  if (!props) {
    const zoneSet = inputs.zones?.length ? new Set(inputs.zones) : null;
    const live = (cells ?? []).filter((c) => c.active
      && (!zoneSet || (c.zone != null && zoneSet.has(c.zone)))
      && aboveContactFraction(c.z, c.thk, inputs.owc) > 0);
    if (live.length) {
      const mean = (f: (c: VolumeCell) => number) => live.reduce((a, c) => a + f(c), 0) / live.length;
      props = { ntg: mean((c) => c.ntg), phi: mean((c) => c.phi), sw: mean((c) => c.sw) };
      source = 'unweighted cell mean — the number a property table would show';
    } else {
      props = { ntg: grid.meanNtg, phi: grid.meanPhi, sw: grid.meanSw };
      source = 'volume-weighted (no independent average available — this is an identity, not a check)';
    }
  }

  const map = mapVolumes(grid.grvM3, { ...props, bo: inputs.bo });
  const relDiff = map.stoiipSm3 > 0 ? (grid.stoiipSm3 - map.stoiipSm3) / map.stoiipSm3 : 0;
  const pct = Math.abs(relDiff) * 100;

  let verdict: string;
  if (grid.cells === 0) {
    verdict = 'No cell lies above the contact — either the contact is above the model or no column is active.';
  } else if (pct < 0.5) {
    verdict = 'The two routes agree: the averages represent the grid, and heterogeneity is not biasing the answer.';
  } else if (pct < 10) {
    verdict = `A ${pct.toFixed(1)}% gap. The product of averages is not the average of products — expected wherever φ, NTG and Sw are correlated, which in a real reservoir they are.`;
  } else {
    verdict = `A ${pct.toFixed(1)}% gap is large. A single set of averages does not represent this grid: check for strong φ–Sw correlation, or layering too coarse to resolve the contact (${grid.straddling} cells straddle it).`;
  }
  return { grid, map, mapProps: props, mapPropsSource: source, relDiff, identityResidual: identityResidual(grid, inputs.bo), verdict };
}

/** Sm³ → MMstb, the unit a reserves number is actually quoted in. */
export const toMMstb = (sm3: number) => (sm3 * BBL_PER_SM3) / 1e6;
/** Sm³ → MMSm³, the unit Sodir publishes. */
export const toMMSm3 = (sm3: number) => sm3 / 1e6;
