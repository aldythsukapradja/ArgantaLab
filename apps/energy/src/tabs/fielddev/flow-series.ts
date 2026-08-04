// fielddev/flow-series.ts — the monthly flow picture, split into the quantities a
// development chart can honestly stack.
//
// THE GAS PROBLEM, and why this module exists.
//
// A production chart wants to stack oil, gas and water. Two of those are liquids
// measured at surface and converted to reservoir volume by a formation volume
// factor. Gas is not one thing: most of the gas that comes up a Volve well was
// DISSOLVED in the oil in the reservoir and only became gas on the way to the
// separator. That solution gas occupies no separate reservoir volume — it is
// already inside Bo. Stacking produced gas on top of oil voidage counts the same
// cubic metres twice.
//
// So the produced gas is split, using the field's OWN published solution GOR:
//     solution gas = Rs · oil      (already inside the oil voidage)
//     free gas     = max(0, gas − Rs · oil)   (a real, separate reservoir volume)
// On Volve that split is 98.3% solution / 1.7% free across the field life. The
// free-gas band is therefore honestly small, and the chart says so rather than
// drawing a fat gas bar that is mostly double-counted oil.
//
// The SURFACE gas rate is carried through untouched alongside, because "how much
// gas did this field make" is a real question and the answer is the raw number,
// not the voidage decomposition.
import { VOIDAGE_DEFAULT, voidageProduced, voidageInjected, type Voidage } from '../../engine/surveillance.ts';

export interface FlowMonth {
  ym: string;
  oil: number; water: number; wi: number;
  gas?: number | null;
}

export interface FlowPoint {
  ym: string;
  /** reservoir volumes, stackable against each other and against injection */
  oilV: number; freeGasV: number; waterV: number; injV: number;
  /** surface volumes, as published */
  oil: number; gas: number; water: number; wi: number;
  /** produced gas–oil ratio this month, surface. Null when no oil was made:
   *  gas with no oil has no GOR, and reporting 0 would read as "dry oil". */
  gor: number | null;
  /** the part of this month's gas that was already dissolved in the oil */
  solutionGas: number;
  freeGas: number;
}

export interface FlowSeries {
  points: FlowPoint[];
  /** largest single-month produced voidage, for the bar scale */
  maxProduced: number;
  maxInjected: number;
  maxGas: number;
  /** life totals, surface */
  cumOil: number; cumGas: number; cumWater: number; cumWi: number;
  /** share of produced gas that was in solution — the number that justifies the
   *  small free-gas band, quoted in the UI rather than left implicit */
  solutionGasShare: number | null;
  /** the solution GOR used for the split, echoed back so the caller can cite it */
  rs: number | null;
}

/**
 * @param rs solution GOR (Sm³/Sm³) from the field's own PVT. When it is unknown
 *        the split CANNOT be made, so no gas is treated as free — the safe
 *        direction, since claiming free gas that is really in solution would
 *        inflate the voidage. `solutionGasShare` is then null, not 1.
 */
export function buildFlow(months: FlowMonth[], rs: number | null, v: Voidage = VOIDAGE_DEFAULT): FlowSeries {
  const points: FlowPoint[] = [];
  let cumOil = 0, cumGas = 0, cumWater = 0, cumWi = 0, cumSolution = 0;

  for (const m of months) {
    const oil = Number(m.oil) || 0;
    const water = Number(m.water) || 0;
    const wi = Number(m.wi) || 0;
    const gas = Number(m.gas) || 0;

    const solutionGas = rs != null && Number.isFinite(rs) ? Math.min(gas, rs * oil) : gas;
    const freeGas = Math.max(0, gas - solutionGas);

    cumOil += oil; cumGas += gas; cumWater += water; cumWi += wi; cumSolution += solutionGas;

    points.push({
      ym: m.ym,
      oilV: v.Bo * oil,
      // Bg is 0 in the default voidage set for an undersaturated field — the free
      // term then vanishes, which is correct and is exactly why it is computed
      // rather than assumed. A field that publishes a Bg gets a real band.
      freeGasV: v.Bg * freeGas,
      waterV: v.Bw * water,
      injV: voidageInjected({ oil: 0, water: 0, wi }, v),
      oil, gas, water, wi,
      gor: oil > 0 ? gas / oil : null,
      solutionGas, freeGas,
    });
  }

  const produced = points.map((p, i) => voidageProduced(
    { oil: p.oil, water: p.water, wi: 0, gasFree: p.freeGas }, v,
  ) || (points[i].oilV + points[i].waterV));

  return {
    points,
    maxProduced: points.length ? Math.max(1, ...produced) : 1,
    maxInjected: points.length ? Math.max(1, ...points.map((p) => p.injV)) : 1,
    maxGas: points.length ? Math.max(1, ...points.map((p) => p.gas)) : 1,
    cumOil, cumGas, cumWater, cumWi,
    solutionGasShare: rs != null && cumGas > 0 ? cumSolution / cumGas : null,
    rs: rs != null && Number.isFinite(rs) ? rs : null,
  };
}
