// econ.ts — screening cashflow + mid-year NPV + payback. 1:1 port of the reference
// npv() and Fable-set econ defaults in scripts/test-engine.mjs. Pure TS.
// SCREENING ONLY — not investment advice (we are not a licensed advisor).

export interface EconDefaults {
  oilPrice: number;   // $/bbl
  gasPrice: number;   // $/Mscf
  opexVar: number;    // $/bbl
  opexFix: number;    // $/yr
  capex: number;      // $ field
  capexWell: number;  // $ per single well
  disc: number;       // fraction
  aband: number;      // $ decommissioning at end of life
  taxRate: number;    // Norway petroleum tax (optional toggle)
}

/** Founder-set North Sea offshore screening basis (2026-07-22, all scenario). */
export const ECON_DEFAULTS: EconDefaults = {
  oilPrice: 70,
  gasPrice: 6,
  opexVar: 14,
  opexFix: 45e6,
  capex: 1200e6,
  capexWell: 80e6,
  disc: 0.10,
  aband: 150e6,
  taxRate: 0.78,
};

export interface CashflowInput {
  oilByYear: number[];   // bbl per year
  gasByYear?: number[];  // Mscf per year (optional)
  price: number;         // $/bbl
  gasPrice?: number;     // $/Mscf
  opexVar: number;       // $/bbl
  opexFix: number;       // $/yr
  capex: number;         // $ (year 0)
  aband?: number;        // $ (final year)
  taxRate?: number;      // applied to positive pre-tax annual profit
}

export interface CashflowRow {
  year: number;
  revenue: number;
  opex: number;
  capex: number;
  tax: number;
  net: number;
  cumulative: number;
}

/** Build the annual cashflow rows. Tax (if given) applies to positive net-of-opex profit. */
export function cashflow(inp: CashflowInput): CashflowRow[] {
  const rows: CashflowRow[] = [];
  let cum = 0;
  const nY = inp.oilByYear.length;
  for (let y = 0; y < nY; y++) {
    const oil = inp.oilByYear[y] || 0;
    const gas = inp.gasByYear?.[y] || 0;
    const revenue = oil * inp.price + gas * (inp.gasPrice ?? 0);
    const opex = oil * inp.opexVar + inp.opexFix;
    let capex = 0;
    if (y === 0) capex += inp.capex;
    if (y === nY - 1) capex += inp.aband ?? 0;
    const preTax = revenue - opex - capex;
    const tax = inp.taxRate && preTax > 0 ? preTax * inp.taxRate : 0;
    const net = preTax - tax;
    cum += net;
    rows.push({ year: y, revenue, opex, capex, tax, net, cumulative: cum });
  }
  return rows;
}

/** NPV with mid-year discounting: Σ cf_y / (1+r)^(y+0.5). */
export function npv(cashflows: number[], rate: number): number {
  let v = 0;
  for (let y = 0; y < cashflows.length; y++) v += cashflows[y] / Math.pow(1 + rate, y + 0.5);
  return v;
}

/** Payback: first year index where cumulative net turns non-negative (fractional). */
export function payback(cashflows: number[]): number | null {
  let cum = 0;
  for (let y = 0; y < cashflows.length; y++) {
    const prev = cum;
    cum += cashflows[y];
    if (cum >= 0 && prev < 0) {
      const frac = cashflows[y] !== 0 ? -prev / cashflows[y] : 0;
      return y + frac;
    }
  }
  return null;
}

/** IRR-lite: bisection on the discount rate that zeroes mid-year NPV. */
export function irr(cashflows: number[]): number | null {
  const f = (r: number) => npv(cashflows, r);
  let lo = -0.9, hi = 2.0;
  if (f(lo) * f(hi) > 0) return null;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}
