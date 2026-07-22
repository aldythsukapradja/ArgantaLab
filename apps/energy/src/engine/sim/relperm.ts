// sim/relperm.ts (S4) — Corey rock-fluid relative permeability + fractional flow.
// Feeds the mobility weighting in the FV/streamline transport (S5/S6). Capillary
// pressure neglected at screening (documented in the M5 concept §4.2). Ported 1:1
// from scripts/test-sim.mjs (26/26 truth-lock). Pure TS.

export interface CoreyEndpoints {
  swc: number; sor: number;        // connate water / residual oil
  krwMax: number; kroMax: number;  // endpoint relative perms
  nw: number; no: number;          // Corey exponents (nw≈4–6 water-wet, no≈2–3)
}

/** Screening default endpoints (water-wet North-Sea sand). */
export const COREY_DEFAULTS: CoreyEndpoints = { swc: 0.15, sor: 0.25, krwMax: 0.4, kroMax: 0.9, nw: 3, no: 2 };

/** Corey relative permeabilities at water saturation Sw. */
export function coreyKr(sw: number, e: CoreyEndpoints): { krw: number; kro: number } {
  const se = (sw - e.swc) / (1 - e.swc - e.sor);
  const s = Math.max(0, Math.min(1, se));
  return { krw: e.krwMax * s ** e.nw, kro: e.kroMax * (1 - s) ** e.no };
}

/** Water fractional flow fw = (krw/μw) / (krw/μw + kro/μo). S-shaped in Sw. */
export function fracFlowW(sw: number, e: CoreyEndpoints, muw: number, muo: number): number {
  const { krw, kro } = coreyKr(sw, e);
  const mw = krw / muw, mo = kro / muo;
  return (mw + mo) === 0 ? 0 : mw / (mw + mo);
}

/** Total mobility λt = krw/μw + kro/μo (for the pressure-equation coupling in S5). */
export function totalMobility(sw: number, e: CoreyEndpoints, muw: number, muo: number): number {
  const { krw, kro } = coreyKr(sw, e);
  return krw / muw + kro / muo;
}
