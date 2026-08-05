// fluid-model.ts — PVT · SCAL · initialization. The dynamic model's rock-fluid basis.
//
// WHAT THIS IS. The Fluids & Rock stage produces the `DynamicInitialization`
// artifact: the black-oil PVT tables, the relative-permeability and capillary
// functions, and the equilibration state that a simulation run initialises from.
// Everything downstream of it — the FV/streamline engine, recovery screening, the
// forecast — reads THIS, so it has to be derived rather than typed in.
//
// WHERE THE NUMBERS COME FROM, and where they stop.
//
//   DECK          The Volve Eclipse deck (VOLVE_2016.PRT, METRIC, PVT region 1) is
//                 the delivery's own statement of the fluid: Pi, Pb, Rs, Bo, T, the
//                 datum, the three surface densities and the rock compressibility.
//                 These arrive through the ingested `wellmaster` asset — they are
//                 read, never assumed. A field with no PVT block yields no case.
//   CORRELATION   Everything the deck does NOT state — the shape of Bo(p), Rs(p),
//                 the viscosities, Z, Bw, cw — is a published correlation ANCHORED
//                 to the deck values, so the table passes exactly through the
//                 measured point and the correlation only supplies the curvature
//                 between anchors. Each anchoring factor is reported, because a
//                 correlation forced 30% off its own prediction is a fact about the
//                 fluid the engineer needs to see.
//   ANALOGUE      No SCAL was delivered with Volve — the core folders are empty in
//                 source. So the relative-permeability endpoints are an analogue
//                 water-wet North Sea sand, and they say so on every screen. They
//                 are NOT presented as measured, and the case records that the
//                 largest uncertainty in any waterflood forecast built on it is the
//                 one function nobody measured.
//   MEASURED      The formation-pressure stations (MDT/LWD gauges, ~9 runs per
//                 wellbore) are real measurements, and they are what the
//                 initialization is CHECKED against: fit a gradient through them,
//                 read the fluid density back out, and see whether it agrees with
//                 the deck's oil.
//
// No function here invents a value to keep a chart full. Absent input yields null,
// and the caller renders the absence.
//
// Pure TypeScript, zero imports — scripts/test-fluids.mjs loads it directly.

// ── unit bridges ─────────────────────────────────────────────────────────────
// The correlations are published in field units; the deck and every screen in this
// app are metric. Conversion happens at the correlation boundary, once, here.
export const PSI_PER_BAR = 14.503773773;
/** 1 Sm³/Sm³ of solution gas = 5.614583 scf/STB. */
export const SCF_STB_PER_SM3_SM3 = 5.614583;
/** Air density at the metric standard condition (15 °C, 1.01325 bara), kg/m³. */
export const RHO_AIR_SC = 1.2250;
/** Standard pressure/temperature for the metric gas FVF. */
export const P_SC_BARA = 1.01325;
export const T_SC_K = 288.15;
export const G = 9.80665;

export const barToPsi = (p: number) => p * PSI_PER_BAR;
export const psiToBar = (p: number) => p / PSI_PER_BAR;
export const cToF = (t: number) => t * 9 / 5 + 32;
export const cToK = (t: number) => t + 273.15;
export const sm3ToScf = (rs: number) => rs * SCF_STB_PER_SM3_SM3;

/** Where a number came from. The same vocabulary the rest of the platform uses.
 *  `interpreted` is deliberately distinct from `measured`: Equinor's LFP saturation
 *  curves are somebody's petrophysical interpretation of a log, not a core plug. */
export type Basis = 'deck' | 'measured' | 'interpreted' | 'correlation' | 'analogue' | 'user' | 'regulator';

/** One reported quantity with its provenance attached. Nothing in the case travels
 *  without it — a Bo of 1.47 read off the deck and a Bo of 1.47 produced by Standing
 *  are different claims. */
export interface Quantity {
  value: number;
  unit: string;
  basis: Basis;
  /** the specific source: a file, a correlation name, an analogue */
  source: string;
  note?: string;
}

export const q = (value: number, unit: string, basis: Basis, source: string, note?: string): Quantity =>
  ({ value, unit, basis, source, ...(note ? { note } : {}) });

// ── the anchors: what the delivery itself states ─────────────────────────────

/** The deck's PVT block, exactly as the delivery publishes it. Every field is
 *  required: a partial block cannot initialise a simulation and must not be padded
 *  with defaults that look like data. */
export interface FluidAnchors {
  /** initial reservoir pressure at datum, bara */
  pi: number;
  /** bubble-point pressure, bara */
  pb: number;
  /** solution GOR at the bubble point, Sm³/Sm³ */
  rsb: number;
  /** oil FVF as the deck reports it — at Pi (undersaturated), rm³/Sm³ */
  boAtPi: number;
  /** reservoir temperature, °C */
  tC: number;
  /** the datum the pressure is quoted at, m TVDSS */
  datumTvdss: number;
  /** surface densities, kg/m³ */
  rhoOilSc: number;
  rhoWaterSc: number;
  rhoGasSc: number;
  /** rock compaction reference pressure (bara) and compressibility (1/bar) */
  rockPref: number;
  rockCf: number;
  source: string;
}

/** The shape the `wellmaster` asset carries. Only what this module reads. */
export interface FluidAnchorPayload {
  pvt?: {
    Pi?: unknown; Pb?: unknown; Rs?: unknown; Bo?: unknown; T?: unknown;
    datum_tvdss?: unknown; Bo_note?: unknown; source?: unknown;
    density_kgm3?: { oil?: unknown; water?: unknown; gas?: unknown };
    rock?: { pref_bara?: unknown; cf?: unknown };
  };
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Read the deck's PVT anchors out of the delivery's well master.
 *
 * Returns null when ANY required anchor is missing. That is deliberate: a case
 * built on four of eleven anchors and seven silent defaults is indistinguishable,
 * on screen, from one built on the deck — and it is not the same thing.
 */
export function readAnchors(payload: FluidAnchorPayload | null | undefined): FluidAnchors | null {
  const p = payload?.pvt;
  if (!p) return null;
  const pi = num(p.Pi), pb = num(p.Pb), rsb = num(p.Rs), boAtPi = num(p.Bo), tC = num(p.T);
  const datumTvdss = num(p.datum_tvdss);
  const rhoOilSc = num(p.density_kgm3?.oil);
  const rhoWaterSc = num(p.density_kgm3?.water);
  const rhoGasSc = num(p.density_kgm3?.gas);
  const rockPref = num(p.rock?.pref_bara);
  const rockCf = num(p.rock?.cf);
  if (pi == null || pb == null || rsb == null || boAtPi == null || tC == null || datumTvdss == null) return null;
  if (rhoOilSc == null || rhoWaterSc == null || rhoGasSc == null) return null;
  if (rockPref == null || rockCf == null) return null;
  if (pb > pi) {
    // A bubble point above initial pressure means free gas at discovery — a real
    // state, but not the one the rest of this module assumes, so say so rather
    // than initialising an oil-water case over a gas cap.
    return { pi, pb, rsb, boAtPi, tC, datumTvdss, rhoOilSc, rhoWaterSc, rhoGasSc, rockPref, rockCf, source: String(p.source ?? 'delivery PVT block') };
  }
  return { pi, pb, rsb, boAtPi, tC, datumTvdss, rhoOilSc, rhoWaterSc, rhoGasSc, rockPref, rockCf, source: String(p.source ?? 'delivery PVT block') };
}

// ── derived fluid identity ───────────────────────────────────────────────────

/** Stock-tank oil gravity, °API, from the deck's surface oil density. */
export function oilApi(rhoOilSc: number): number { return 141.5 / (rhoOilSc / 1000) - 131.5; }

/** Gas specific gravity (air = 1) from the deck's surface gas density. */
export function gasGravity(rhoGasSc: number): number { return rhoGasSc / RHO_AIR_SC; }

/**
 * Brine salinity, weight-% NaCl equivalent, back-solved from the deck's surface
 * water density (McCain's ρw(S) at 60 °F, inverted).
 *
 * This is an INFERENCE, not a measurement: the deck states a density, and a density
 * is consistent with exactly one NaCl-equivalent salinity under this correlation.
 * It matters because cw and μw both depend on it far more strongly than on anything
 * else, so leaving it at a default would quietly mis-state the water leg.
 */
export function brineSalinityWtPct(rhoWaterSc: number): number {
  // McCain: ρw [lb/ft³] = 62.368 + 0.438603·S + 1.60074e-3·S²
  const lbft3 = rhoWaterSc / 16.018463;
  const a = 1.60074e-3, b = 0.438603, c = 62.368 - lbft3;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return 0;
  const s = (-b + Math.sqrt(disc)) / (2 * a);
  return Math.max(0, s);
}

// ── PVT correlations (published, named, field units inside) ──────────────────

/** Standing (1947) bubble-point pressure, psia, from Rs [scf/STB]. */
export function standingPb(rsScfStb: number, gammaG: number, api: number, tF: number): number {
  const yg = 10 ** (0.00091 * tF - 0.0125 * api);
  return 18.2 * ((rsScfStb / gammaG) ** 0.83 * yg - 1.4);
}

/** Standing inverted — solution GOR [scf/STB] at a saturation pressure [psia]. */
export function standingRs(pPsia: number, gammaG: number, api: number, tF: number): number {
  const yg = 10 ** (0.00091 * tF - 0.0125 * api);
  const inner = (pPsia / 18.2 + 1.4) / yg;
  return inner <= 0 ? 0 : gammaG * inner ** (1 / 0.83);
}

/** Standing (1947) saturated oil FVF, rb/STB. */
export function standingBo(rsScfStb: number, gammaG: number, gammaO: number, tF: number): number {
  const f = rsScfStb * Math.sqrt(gammaG / gammaO) + 1.25 * tF;
  return 0.9759 + 0.00012 * f ** 1.2;
}

/** Vazquez–Beggs (1980) undersaturated oil compressibility, 1/psi. */
export function vazquezBeggsCo(rsScfStb: number, tF: number, api: number, gammaG: number, pPsia: number): number {
  return (-1433 + 5 * rsScfStb + 17.2 * tF - 1180 * gammaG + 12.61 * api) / (1e5 * pPsia);
}

/** Beggs–Robinson (1975) dead-oil viscosity, cP. */
export function beggsRobinsonMuOd(api: number, tF: number): number {
  const z = 3.0324 - 0.02023 * api;
  const y = 10 ** z;
  const x = y * tF ** -1.163;
  return 10 ** x - 1;
}

/** Beggs–Robinson saturated (live) oil viscosity, cP. */
export function beggsRobinsonMuOb(muOd: number, rsScfStb: number): number {
  const A = 10.715 * (rsScfStb + 100) ** -0.515;
  const B = 5.44 * (rsScfStb + 150) ** -0.338;
  return A * muOd ** B;
}

/** Vazquez–Beggs undersaturated viscosity above the bubble point, cP. */
export function vazquezBeggsMuO(muOb: number, pPsia: number, pbPsia: number): number {
  const m = 2.6 * pPsia ** 1.187 * Math.exp(-11.513 - 8.98e-5 * pPsia);
  return muOb * (pPsia / pbPsia) ** m;
}

/** Sutton (1985) gas pseudo-criticals from gravity — °R and psia. */
export function suttonPseudoCriticals(gammaG: number): { tpc: number; ppc: number } {
  return {
    tpc: 169.2 + 349.5 * gammaG - 74.0 * gammaG * gammaG,
    ppc: 756.8 - 131.0 * gammaG - 3.6 * gammaG * gammaG,
  };
}

/**
 * Dranchuk–Abou-Kassem (1975) gas compressibility factor.
 * Newton iteration on reduced density; converges in <10 steps over the range this
 * model uses. Returns 1 if it cannot converge rather than a half-solved root.
 */
export function dakZ(pr: number, tr: number): number {
  if (!(pr > 0) || !(tr > 0)) return 1;
  const A = [0.3265, -1.0700, -0.5339, 0.01569, -0.05165, 0.5475, -0.7361, 0.1844, 0.1056, 0.6134, 0.7210];
  const c1 = A[0] + A[1] / tr + A[2] / tr ** 3 + A[3] / tr ** 4 + A[4] / tr ** 5;
  const c2 = A[5] + A[6] / tr + A[7] / tr ** 2;
  const c3 = A[8] * (A[6] / tr + A[7] / tr ** 2);
  let rho = 0.27 * pr / tr; // ideal-gas first guess
  for (let i = 0; i < 60; i++) {
    const e = Math.exp(-A[10] * rho * rho);
    const f = -0.27 * pr / tr + rho + c1 * rho ** 2 + c2 * rho ** 3 - c3 * rho ** 6
      + A[9] * (1 + A[10] * rho * rho) * rho ** 3 / tr ** 3 * e;
    const df = 1 + 2 * c1 * rho + 3 * c2 * rho ** 2 - 6 * c3 * rho ** 5
      + A[9] * rho ** 2 / tr ** 3 * e * (3 + A[10] * rho * rho * (3 - 2 * A[10] * rho * rho));
    if (!Number.isFinite(df) || df === 0) break;
    const next = rho - f / df;
    if (!Number.isFinite(next)) break;
    if (Math.abs(next - rho) < 1e-10) { rho = next; break; }
    rho = Math.max(1e-8, next);
  }
  const z = 0.27 * pr / (rho * tr);
  return Number.isFinite(z) && z > 0 ? z : 1;
}

/** Gas FVF, rm³/Sm³, at the metric standard condition. */
export function gasFvf(pBara: number, tK: number, z: number): number {
  return (P_SC_BARA / T_SC_K) * (z * tK / pBara);
}

/** Lee–Gonzalez–Eakin (1966) gas viscosity, cP. */
export function leeGonzalezMuG(rhoGasResKgM3: number, tR: number, mw: number): number {
  const rhoGCm3 = rhoGasResKgM3 / 1000;
  const K = (9.4 + 0.02 * mw) * tR ** 1.5 / (209 + 19 * mw + tR);
  const X = 3.5 + 986 / tR + 0.01 * mw;
  const Y = 2.4 - 0.2 * X;
  return 1e-4 * K * Math.exp(X * rhoGCm3 ** Y);
}

/** McCain water FVF (pure-water volume changes), rb/STB ≡ rm³/Sm³. */
export function mccainBw(pPsia: number, tF: number): number {
  const dVwt = -1.0001e-2 + 1.33391e-4 * tF + 5.50654e-7 * tF * tF;
  const dVwp = -1.95301e-9 * pPsia * tF - 1.72834e-13 * pPsia * pPsia * tF
    - 3.58922e-7 * pPsia - 2.25341e-10 * pPsia * pPsia;
  return (1 + dVwt) * (1 + dVwp);
}

/** Osif (1988) brine compressibility, 1/psi. `cs` is NaCl in g/L. */
export function osifCw(pPsia: number, tF: number, csGL: number): number {
  return 1 / (7.033 * pPsia + 541.5 * csGL - 537 * tF + 403300);
}

/** McCain brine viscosity, cP. `s` is weight-% NaCl. */
export function mccainMuW(pPsia: number, tF: number, s: number): number {
  const A = 109.574 - 8.40564 * s + 0.313314 * s * s + 8.72213e-3 * s ** 3;
  const B = 1.12166 - 2.63951e-2 * s + 6.79461e-4 * s * s + 5.47119e-5 * s ** 3 - 1.55586e-6 * s ** 4;
  const mu1 = A * tF ** -B;
  return mu1 * (0.9994 + 4.0295e-5 * pPsia + 3.1062e-9 * pPsia * pPsia);
}

// ── the PVT tables ───────────────────────────────────────────────────────────

export interface PvtoRow {
  /** solution GOR, Sm³/Sm³ */
  rs: number;
  /** the saturation (bubble-point) pressure of this Rs, bara */
  p: number;
  /** oil FVF at that saturation pressure, rm³/Sm³ */
  bo: number;
  /** oil viscosity at that saturation pressure, cP */
  muo: number;
  /** reservoir-condition oil density, kg/m³ */
  rho: number;
  saturated: boolean;
}

export interface PvdgRow { p: number; bg: number; mug: number; z: number; rho: number }

export interface PvtwRow { p: number; bw: number; cw: number; muw: number; rho: number }

/** Every anchoring factor applied to a correlation, so a table can be audited. */
export interface Calibration {
  /** Standing Rs at the deck's Pb, before anchoring — Sm³/Sm³ */
  rsPredicted: number;
  /** the factor Rs is scaled by so Rs(Pb) equals the deck's Rsb exactly */
  rsFactor: number;
  /** Standing Bo at the deck's Rsb, before anchoring — rm³/Sm³ */
  boPredicted: number;
  boFactor: number;
  /** Bo at the bubble point, back-calculated from the deck's undersaturated Bo(Pi) */
  bob: number;
}

export interface PvtModel {
  api: number;
  gammaG: number;
  gammaO: number;
  salinityWtPct: number;
  /** molecular weight of the surface gas, for Lee–Gonzalez */
  gasMw: number;
  /** undersaturated oil compressibility at Pi, 1/bar (Vazquez–Beggs) */
  co: number;
  /** Bo at the bubble point, rm³/Sm³ */
  bob: number;
  /** live-oil viscosity at the bubble point, cP */
  muob: number;
  /** oil viscosity at initial pressure, cP */
  muoAtPi: number;
  /** water FVF / compressibility / viscosity at the rock reference pressure */
  bw: number; cw: number; muw: number;
  /** reservoir-condition densities at initial conditions, kg/m³ */
  rhoOilRes: number;
  rhoWaterRes: number;
  calibration: Calibration;
  pvto: PvtoRow[];
  pvdg: PvdgRow[];
  pvtw: PvtwRow[];
  /** rows above the bubble point on the live-oil branch (constant Rs = Rsb) */
  undersaturated: PvtoRow[];
}

export interface PvtOptions {
  /** how many saturated rows below Pb */
  saturatedRows?: number;
  /** how many undersaturated rows above Pb, up to `pMax` */
  undersaturatedRows?: number;
  /** top of the pressure tables, bara — defaults to 1.15·Pi so a run can go above initial */
  pMax?: number;
}

/**
 * Build the black-oil PVT tables from the deck anchors.
 *
 * Anchoring, precisely: Standing is evaluated at the deck's own (Pb, Rsb) and the
 * ratio between prediction and deck value becomes a constant multiplier on the whole
 * curve. So the table passes EXACTLY through the measured point, and the correlation
 * contributes only the shape either side of it. Both factors are reported — a factor
 * far from 1 means this fluid does not behave like the correlation's population, and
 * that is a finding, not a nuisance.
 */
export function buildPvt(a: FluidAnchors, opts: PvtOptions = {}): PvtModel {
  const nSat = Math.max(4, opts.saturatedRows ?? 14);
  const nUnsat = Math.max(2, opts.undersaturatedRows ?? 8);
  const pMax = opts.pMax ?? a.pi * 1.15;

  const api = oilApi(a.rhoOilSc);
  const gammaO = a.rhoOilSc / 1000;
  const gammaG = gasGravity(a.rhoGasSc);
  const salinityWtPct = brineSalinityWtPct(a.rhoWaterSc);
  const tF = cToF(a.tC), tK = cToK(a.tC), tR = tF + 459.67;
  // surface gas molecular weight from gravity — Lee–Gonzalez is written in MW
  const gasMw = gammaG * 28.9647;

  // ── anchoring ──
  const pbPsia = barToPsi(a.pb);
  const rsPredScf = standingRs(pbPsia, gammaG, api, tF);
  const rsPredicted = rsPredScf / SCF_STB_PER_SM3_SM3;
  const rsFactor = rsPredicted > 0 ? a.rsb / rsPredicted : 1;

  // The deck quotes Bo at Pi, which is ABOVE the bubble point — so Bo at Pb is
  // larger, recovered by undoing the undersaturated compression over Pi→Pb.
  const rsbScf = sm3ToScf(a.rsb);
  const coPsi = vazquezBeggsCo(rsbScf, tF, api, gammaG, barToPsi(a.pi));
  const co = coPsi * PSI_PER_BAR; // 1/bar
  const bob = a.boAtPi * Math.exp(co * (a.pi - a.pb));

  const boPredicted = standingBo(rsbScf, gammaG, gammaO, tF);
  const boFactor = boPredicted > 0 ? bob / boPredicted : 1;

  const boSat = (rsSm3: number) => boFactor * standingBo(sm3ToScf(rsSm3), gammaG, gammaO, tF);
  const muOd = beggsRobinsonMuOd(api, tF);
  const muSat = (rsSm3: number) => beggsRobinsonMuOb(muOd, sm3ToScf(rsSm3));
  const rhoOilAt = (rsSm3: number, bo: number) => (a.rhoOilSc + rsSm3 * a.rhoGasSc) / bo;

  // ── PVTO: the saturated branch, Pb from ~1 bara up to the deck's Pb ──
  const pvto: PvtoRow[] = [];
  for (let i = 0; i < nSat; i++) {
    const p = 1 + (a.pb - 1) * (i / (nSat - 1));
    const rs = i === nSat - 1 ? a.rsb : Math.max(0, rsFactor * standingRs(barToPsi(p), gammaG, api, tF) / SCF_STB_PER_SM3_SM3);
    const bo = boSat(rs);
    const muo = muSat(rs);
    pvto.push({ rs, p, bo, muo, rho: rhoOilAt(rs, bo), saturated: true });
  }

  // ── the undersaturated branch: Rs frozen at Rsb, Bo compressing, μ rising ──
  const undersaturated: PvtoRow[] = [];
  for (let i = 0; i <= nUnsat; i++) {
    const p = a.pb + (pMax - a.pb) * (i / nUnsat);
    const bo = bob * Math.exp(-co * (p - a.pb));
    const muo = vazquezBeggsMuO(beggsRobinsonMuOb(muOd, rsbScf), barToPsi(p), pbPsia);
    undersaturated.push({ rs: a.rsb, p, bo, muo, rho: rhoOilAt(a.rsb, bo), saturated: false });
  }

  // ── PVDG: dry gas over the same pressure span ──
  const { tpc, ppc } = suttonPseudoCriticals(gammaG);
  const pvdg: PvdgRow[] = [];
  for (let i = 0; i < nSat + nUnsat; i++) {
    const p = 5 + (pMax - 5) * (i / (nSat + nUnsat - 1));
    const z = dakZ(barToPsi(p) / ppc, tR / tpc);
    const bg = gasFvf(p, tK, z);
    const rho = a.rhoGasSc / bg;
    pvdg.push({ p, bg, mug: leeGonzalezMuG(rho, tR, gasMw), z, rho });
  }

  // ── PVTW: brine ──
  const csGL = (salinityWtPct / 100) * a.rhoWaterSc;
  const pvtw: PvtwRow[] = [];
  for (let i = 0; i < nSat + nUnsat; i++) {
    const p = 5 + (pMax - 5) * (i / (nSat + nUnsat - 1));
    const psia = barToPsi(p);
    const bw = mccainBw(psia, tF);
    pvtw.push({
      p, bw,
      cw: osifCw(psia, tF, csGL) * PSI_PER_BAR,
      muw: mccainMuW(psia, tF, salinityWtPct),
      rho: a.rhoWaterSc / bw,
    });
  }

  const psiaRef = barToPsi(a.rockPref);
  const bwRef = mccainBw(psiaRef, tF);
  const muob = beggsRobinsonMuOb(muOd, rsbScf);

  return {
    api, gammaG, gammaO, salinityWtPct, gasMw, co, bob, muob,
    muoAtPi: vazquezBeggsMuO(muob, barToPsi(a.pi), pbPsia),
    bw: bwRef,
    cw: osifCw(psiaRef, tF, csGL) * PSI_PER_BAR,
    muw: mccainMuW(psiaRef, tF, salinityWtPct),
    rhoOilRes: rhoOilAt(a.rsb, a.boAtPi),
    rhoWaterRes: a.rhoWaterSc / bwRef,
    calibration: { rsPredicted, rsFactor, boPredicted, boFactor, bob },
    pvto, pvdg, pvtw, undersaturated,
  };
}

// ── SCAL ─────────────────────────────────────────────────────────────────────

/** Which shape family the relative-permeability curves take. */
export type KrModel = 'corey' | 'let';

export interface ScalEndpoints {
  swc: number;   // connate (irreducible) water
  sor: number;   // residual oil to water
  krwMax: number; // krw at Sor
  kroMax: number; // kro at Swc
  nw: number;    // Corey water exponent
  no: number;    // Corey oil exponent
  /** Brooks–Corey pore-size distribution index for the Pc/transition-zone curve */
  lambda: number;
  /** Leverett J at the displacement entry pressure */
  jEntry: number;
  /** interfacial tension × cos θ, mN/m — the Leverett scaling group */
  sigmaCosTheta: number;
  /** which kr shape family to evaluate. Corey unless a match needs more freedom. */
  model?: KrModel;
  /** LET parameters (Lomeland–Ebeltoft–Thomas 2005), water then oil. Only read when
   *  `model` is 'let'. L governs the slope leaving the endpoint, T the approach to
   *  the far end, E the height through the middle — which is the degree of freedom
   *  Corey does not have and history matching almost always needs. */
  lw?: number; ew?: number; tw?: number;
  lo?: number; eo?: number; to?: number;
}

/**
 * Analogue endpoints: a Middle Jurassic shoreface sand.
 *
 * These are NOT Volve measurements. The delivery's core folders are empty in source,
 * so no SCAL exists to read: nw ≈ 3, no ≈ 2, Swc 0.15, Sor 0.25 are the North Sea
 * sandstone convention, and every screen built from them says `analogue`.
 *
 * DELIBERATELY NOT CALLED "WATER-WET" HERE. Run `diagnoseWettability` on these numbers
 * and Craig's indicators split 2/3 intermediate: the crossover at Sw ≈ 0.54 reads
 * water-wet, but Swc 0.15 and krw-at-Sor 0.40 both read intermediate. The convention
 * these come from is described as water-wet; the endpoints themselves are not
 * unambiguously so, and the tab reports that rather than repeating the label.
 *
 * Swc is capped by the field's own data, not by taste: this delivery's interpreted
 * initial Sw is 0.20, so a connate saturation above that would contradict it — and
 * `validateCase` fails the case when it does.
 *
 * The uncertainty this carries into a waterflood forecast is larger than any other
 * input on this tab, and only core closes it.
 */
export const SCAL_ANALOGUE: ScalEndpoints = {
  swc: 0.15, sor: 0.25, krwMax: 0.4, kroMax: 0.9, nw: 3, no: 2,
  lambda: 2.0, jEntry: 0.25, sigmaCosTheta: 30,
  model: 'corey',
  // LET defaults chosen to sit close to the Corey pair above, so switching model is a
  // change of FREEDOM rather than a jump to a different rock.
  lw: 3, ew: 1, tw: 2, lo: 2, eo: 1, to: 2,
};

/** Normalised water saturation, clamped to the mobile range. */
export function normalizedSw(sw: number, e: ScalEndpoints): number {
  const se = (sw - e.swc) / (1 - e.swc - e.sor);
  return Math.max(0, Math.min(1, se));
}

/**
 * LET relative permeability (Lomeland–Ebeltoft–Thomas 2005).
 *
 *   krw = krwMax · Se^Lw / (Se^Lw + Ew·(1−Se)^Tw)
 *   kro = kroMax · (1−Se)^Lo / ((1−Se)^Lo + Eo·Se^To)
 *
 * Three parameters per phase instead of Corey's one. L is the slope leaving the
 * endpoint, T the approach to the far end, E the elevation through the middle. That
 * middle degree of freedom is the whole point: a Corey curve is pinned by its
 * exponent everywhere at once, so a history match that needs to move the mid-range
 * without moving the endpoints has nowhere to go.
 *
 * NOT a superset of Corey — the two families overlap in behaviour but neither
 * contains the other, so switching model changes the curve. Both honour the same end
 * points exactly, which is what makes the switch safe.
 */
export function letKr(sw: number, e: ScalEndpoints): { krw: number; kro: number } {
  const s = normalizedSw(sw, e);
  const lw = e.lw ?? 3, ew = e.ew ?? 1, tw = e.tw ?? 2;
  const lo = e.lo ?? 2, eo = e.eo ?? 1, to = e.to ?? 2;
  const wNum = s ** lw, wDen = wNum + ew * (1 - s) ** tw;
  const oNum = (1 - s) ** lo, oDen = oNum + eo * s ** to;
  return {
    krw: wDen > 0 ? e.krwMax * (wNum / wDen) : 0,
    kro: oDen > 0 ? e.kroMax * (oNum / oDen) : 0,
  };
}

/** Relative permeabilities at a water saturation, in whichever model the case uses. */
export function coreyKr(sw: number, e: ScalEndpoints): { krw: number; kro: number } {
  if (e.model === 'let') return letKr(sw, e);
  const s = normalizedSw(sw, e);
  return { krw: e.krwMax * s ** e.nw, kro: e.kroMax * (1 - s) ** e.no };
}

/** Water fractional flow. */
export function fracFlow(sw: number, e: ScalEndpoints, muw: number, muo: number): number {
  const { krw, kro } = coreyKr(sw, e);
  const mw = krw / muw, mo = kro / muo;
  return mw + mo === 0 ? 0 : mw / (mw + mo);
}

/** Total mobility λt = krw/μw + kro/μo — the pressure equation's coefficient. */
export function totalMobility(sw: number, e: ScalEndpoints, muw: number, muo: number): number {
  const { krw, kro } = coreyKr(sw, e);
  return krw / muw + kro / muo;
}

// ── wettability ──────────────────────────────────────────────────────────────

export type Wetting = 'water-wet' | 'intermediate' | 'oil-wet';

export interface WettabilityCriterion {
  key: 'swi' | 'crossover' | 'krwMax';
  label: string;
  value: number;
  /** what this single criterion says on its own */
  reads: Wetting;
  /** the published threshold it was judged against */
  rule: string;
}

export interface WettabilityDiagnosis {
  /** the majority verdict across the three criteria */
  verdict: Wetting;
  /** how many of the three agree with the verdict */
  agreeing: number;
  criteria: WettabilityCriterion[];
  /** the saturation at which krw and kro cross, or null if they never do */
  crossoverSw: number | null;
}

/**
 * Craig's (1971) rules of thumb, applied to the case's own kr curves.
 *
 * WHAT THIS IS AND IS NOT. Wettability is measured on core, by Amott–Harvey or USBM.
 * This delivery has no core, so nothing here measures anything. What it does is
 * diagnose the CURVE: Craig's three indicators read wettability off the shape of a
 * relative-permeability pair, so running them backwards tells you what wettability
 * your assumed endpoints actually imply.
 *
 * That check is worth having precisely because it can contradict the label. A curve
 * introduced as "water-wet North Sea sand" whose endpoints read intermediate is a
 * statement about the analogue, not about the reservoir — and it is invisible until
 * someone computes the crossover.
 *
 *   Swi        water-wet rock holds more connate water: > 20–25% water-wet, < 15% oil-wet
 *   crossover  the Sw where krw = kro: > 0.5 water-wet, < 0.5 oil-wet
 *   krw at Sor water-wet rock keeps water in the small pores, so krw stays low:
 *              < 0.3 water-wet, > 0.5 oil-wet
 */
export function diagnoseWettability(e: ScalEndpoints, samples = 2000): WettabilityDiagnosis {
  // the crossover, found on the actual curves rather than assumed from the exponents
  let crossoverSw: number | null = null;
  let prev = coreyKr(e.swc, e);
  let prevDiff = prev.krw - prev.kro;
  for (let i = 1; i <= samples; i++) {
    const sw = e.swc + (1 - e.sor - e.swc) * (i / samples);
    const k = coreyKr(sw, e);
    const diff = k.krw - k.kro;
    if (prevDiff < 0 && diff >= 0) { crossoverSw = sw; break; }
    prevDiff = diff;
  }

  const band = (v: number, wetBelow: boolean, wet: number, oil: number): Wetting => {
    if (wetBelow) return v < wet ? 'water-wet' : v > oil ? 'oil-wet' : 'intermediate';
    return v > wet ? 'water-wet' : v < oil ? 'oil-wet' : 'intermediate';
  };

  const criteria: WettabilityCriterion[] = [
    {
      key: 'swi', label: 'Connate water saturation', value: e.swc,
      reads: band(e.swc, false, 0.25, 0.15),
      rule: 'Craig: > 25% water-wet · < 15% oil-wet',
    },
    {
      key: 'crossover', label: 'krw = kro crossover', value: crossoverSw ?? NaN,
      reads: crossoverSw == null ? 'intermediate' : band(crossoverSw, false, 0.5, 0.5),
      rule: 'Craig: > 0.5 water-wet · < 0.5 oil-wet',
    },
    {
      key: 'krwMax', label: 'krw at residual oil', value: e.krwMax,
      reads: band(e.krwMax, true, 0.3, 0.5),
      rule: 'Craig: < 0.3 water-wet · > 0.5 oil-wet',
    },
  ];

  const tally: Record<Wetting, number> = { 'water-wet': 0, intermediate: 0, 'oil-wet': 0 };
  for (const c of criteria) tally[c.reads]++;
  const verdict = (Object.keys(tally) as Wetting[])
    .reduce((best, k) => (tally[k] > tally[best] ? k : best), 'intermediate');
  return { verdict, agreeing: tally[verdict], criteria, crossoverSw };
}

/** End-point mobility ratio M = (krw@Sor/μw)/(kro@Swc/μo). M > 1 is unfavourable. */
export function mobilityRatio(e: ScalEndpoints, muw: number, muo: number): number {
  return (e.krwMax / muw) / (e.kroMax / muo);
}

/** Microscopic displacement efficiency at residual oil: (1−Swc−Sor)/(1−Swc). */
export function displacementEfficiency(e: ScalEndpoints): number {
  return (1 - e.swc - e.sor) / (1 - e.swc);
}

export interface ScalRow { sw: number; krw: number; kro: number; fw: number; pc: number }

/** The SWOF table — kr and Pc against water saturation. */
export function buildSwof(e: ScalEndpoints, muw: number, muo: number, phi: number, kMd: number, rows = 21): ScalRow[] {
  const out: ScalRow[] = [];
  for (let i = 0; i < rows; i++) {
    const sw = e.swc + (1 - e.sor - e.swc) * (i / (rows - 1));
    const { krw, kro } = coreyKr(sw, e);
    out.push({ sw, krw, kro, fw: fracFlow(sw, e, muw, muo), pc: brooksCoreyPc(sw, e, phi, kMd) });
  }
  return out;
}

/**
 * Brooks–Corey drainage capillary pressure, bar, scaled by the Leverett J-function.
 *
 * Pc = (J(Sw)·σcosθ) / sqrt(k/φ), with J(Sw) = J_entry·Se^(−1/λ). Reservoir k and φ
 * therefore set the height of the transition zone, which is the whole reason this
 * function is on the Fluids & Rock tab rather than buried in the simulator: a
 * 500 mD sand and a 5 mD sand initialise to different in-place volumes from the same
 * contact.
 */
export function brooksCoreyPc(sw: number, e: ScalEndpoints, phi: number, kMd: number): number {
  const c = pcEntryPressure(e, phi, kMd);
  if (c === 0) return 0;
  const se = Math.max(PC_SE_FLOOR, Math.min(1, (sw - e.swc) / (1 - e.swc)));
  return c * se ** (-1 / e.lambda);
}

/**
 * Where the Brooks–Corey curve is truncated.
 *
 * Pc → ∞ as Sw → Swc: that is the model, not a bug, and it is why a SWOF table
 * generated straight from the closed form carries a first row of tens of thousands
 * of bar. No simulator will accept that, and no rock exhibits it — mercury injection
 * stops long before. So the curve is cut at Se = 10⁻³, which puts the maximum Pc at
 * (10³)^(1/λ) times the entry pressure: about 30× at λ = 2. Truncation is stated
 * rather than hidden, because it IS the last SWOF row and someone will read it.
 */
export const PC_SE_FLOOR = 1e-3;

/** The largest capillary pressure the truncated curve can report, bar. */
export function pcMax(e: ScalEndpoints, phi: number, kMd: number): number {
  return pcEntryPressure(e, phi, kMd) * PC_SE_FLOOR ** (-1 / e.lambda);
}

/**
 * The displacement entry pressure, bar — Pc at Se = 1, i.e. the whole Brooks–Corey
 * curve's scale factor. Split out because it is used three ways: as the Pc column of
 * SWOF, as the OWC→FWL offset in the equilibration, and as the top of the transition
 * zone. σ is in mN/m and k in mD; the Leverett group returns Pa.
 */
export function pcEntryPressure(e: ScalEndpoints, phi: number, kMd: number): number {
  if (!(phi > 0) || !(kMd > 0)) return 0;
  const kM2 = kMd * 9.869233e-16;
  return (e.jEntry * e.sigmaCosTheta * 1e-3) / Math.sqrt(kM2 / phi) / 1e5;
}

/**
 * Water saturation at a height above the free-water level.
 *
 * The inverse of the same Pc curve, so the transition zone the initialization draws
 * and the Pc column the simulator reads cannot disagree. Below the FWL, and anywhere
 * the buoyancy head has not yet reached the entry pressure, the rock is 100% water:
 * that band is the reason the OWC and the FWL are different depths.
 */
export function swAtHeight(hM: number, e: ScalEndpoints, dRhoKgM3: number, phi: number, kMd: number): number {
  const c = pcEntryPressure(e, phi, kMd);
  if (hM <= 0 || c === 0 || !(dRhoKgM3 > 0)) return 1;
  const pcBar = dRhoKgM3 * G * hM / 1e5;
  if (pcBar <= c) return 1;
  const se = (pcBar / c) ** -e.lambda;
  return Math.max(e.swc, Math.min(1, e.swc + (1 - e.swc) * se));
}

export interface WelgeResult {
  /** shock-front water saturation (Welge tangent from Swc) */
  swf: number;
  /** fractional flow at the front */
  fwf: number;
  /** average water saturation behind the front at breakthrough */
  swAvgBt: number;
  /** pore volumes injected at breakthrough */
  pviBt: number;
  /** recovery of movable oil at breakthrough, fraction of OOIP */
  recoveryBt: number;
}

/**
 * Buckley–Leverett / Welge tangent construction.
 *
 * Found numerically by scanning Sw for the maximum of fw/(Sw−Swc) — which is the
 * tangent condition — rather than by differentiating an assumed analytic form, so it
 * stays correct if the kr model is ever swapped for LET or a table.
 */
export function welgeFront(e: ScalEndpoints, muw: number, muo: number, samples = 2000): WelgeResult {
  let swf = e.swc, best = -Infinity;
  for (let i = 1; i < samples; i++) {
    const sw = e.swc + (1 - e.sor - e.swc) * (i / samples);
    const fw = fracFlow(sw, e, muw, muo);
    const slope = fw / (sw - e.swc);
    if (slope > best) { best = slope; swf = sw; }
  }
  const fwf = fracFlow(swf, e, muw, muo);
  // Welge: Sw_avg = Swf + (1 − fwf)/(dfw/dSw at the front) = Swc + 1/slope
  const swAvgBt = e.swc + 1 / best;
  return {
    swf, fwf, swAvgBt,
    pviBt: 1 / best,
    recoveryBt: (swAvgBt - e.swc) / (1 - e.swc),
  };
}

// ── the delivery's PUBLISHED saturation-height function ──────────────────────

/** The saturation-height parameters a delivery publishes for its own reservoir. */
export interface PublishedShf {
  formation?: string;
  /** Swn = a·J^b against the Leverett J-function */
  swn: { a: number; b: number };
  /** Swirr = c1·log10(k[mD]) + c2 */
  swirr?: { form: string; c1: number; c2: number };
  /** reservoir oil/water interfacial tension × cos θ, mN/m */
  sigmaResMNm?: number;
  archie?: { mFromK?: { a: number; b: number }; n?: number };
  brine?: { ppmNaClEquivalent?: number; rwOhmM?: number; rwTempC?: number };
  source?: string;
}

/**
 * Convert a published `Swn = a·J^b` into the Brooks–Corey pair this engine uses.
 *
 * Brooks–Corey writes Swn = (J/J_entry)^−λ = J_entry^λ · J^−λ, so matching term by
 * term gives λ = −b and J_entry = a^(1/λ). Same curve, different parameterisation —
 * which is the point: the published relation goes in without the engine having to
 * carry a second capillary model beside the one the SWOF table already uses.
 */
export function shfToBrooksCorey(swn: { a: number; b: number }): { lambda: number; jEntry: number } | null {
  const lambda = -swn.b;
  if (!(lambda > 0) || !(swn.a > 0)) return null;
  return { lambda, jEntry: swn.a ** (1 / lambda) };
}

/** Irreducible water at a permeability, from the delivery's published relation. */
export function publishedSwirr(shf: PublishedShf | null | undefined, kMd: number): number | null {
  const s = shf?.swirr;
  if (!s || !(kMd > 0)) return null;
  const v = s.c1 * Math.log10(kMd) + s.c2;
  return Number.isFinite(v) ? Math.max(0.01, Math.min(0.9, v)) : null;
}

/**
 * Apply a published SHF to a set of endpoints.
 *
 * Only the capillary side is replaced — λ, the entry J and the interfacial tension.
 * The relative-permeability endpoints are a different measurement and are left alone,
 * so adopting a published saturation-height function never silently changes the kr
 * curves a forecast was built on.
 */
export function applyPublishedShf(e: ScalEndpoints, shf: PublishedShf | null | undefined, kMd?: number): ScalEndpoints {
  if (!shf) return e;
  const bc = shfToBrooksCorey(shf.swn);
  if (!bc) return e;
  const swirr = kMd != null ? publishedSwirr(shf, kMd) : null;
  return {
    ...e,
    lambda: bc.lambda,
    jEntry: bc.jEntry,
    sigmaCosTheta: shf.sigmaResMNm ?? e.sigmaCosTheta,
    ...(swirr != null ? { swc: swirr } : {}),
  };
}

// ── anchoring Swc to the delivery's own logs ─────────────────────────────────

/** One depth sample from an interpreted log, for the Buckles analysis. */
export interface SatSample { sw: number; phi: number; vsh: number }

export interface BucklesFit {
  well: string;
  /** samples that survived the clean-and-porous screen */
  n: number;
  /** the low-percentile Buckles numbers, Sw·φ */
  p10: number;
  p25: number;
  /** Swc those imply at the model's porosity */
  swcP10: number;
  swcP25: number;
  /** the lowest Sw the well actually reaches in reservoir-quality rock */
  minSw: number;
  /** false when the well never leaves the water leg — it cannot bound Swc */
  reachesIrreducible: boolean;
}

export interface SwcAnchor {
  /** the recommended connate water saturation at the model porosity */
  swc: number;
  /** the honest spread — P25 and P10 across the contributing wells */
  low: number;
  high: number;
  /** the pooled Buckles number, Sw·φ */
  buckles: number;
  wells: BucklesFit[];
  /** wells that carry the curves but never reach irreducible saturation */
  excluded: string[];
  phi: number;
}

const pctile = (sorted: number[], f: number) =>
  sorted.length ? sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * f)))] : NaN;

/**
 * Estimate connate water saturation from interpreted logs — the Buckles method.
 *
 * WHY THIS MATTERS MORE THAN ANY OTHER ENDPOINT. Swc sets where the kr curves start,
 * how much of the pore space can ever hold oil, and — through (1−Sw) — the in-place
 * volume itself. Leaving it on an analogue while the delivery ships three wells of
 * interpreted saturation is leaving the best-constrained endpoint unconstrained.
 *
 * THE METHOD. In rock at irreducible saturation the water is held in small pores and
 * on grain surfaces, so the product Sw·φ — the Buckles number — is roughly constant:
 * tighter rock holds proportionally more water. Screen to clean, porous samples,
 * take a low percentile of Sw·φ, and read Swc off at the porosity the model uses.
 *
 * WHAT IT CANNOT DO. A well sitting in the water leg never reaches irreducible
 * saturation, and averaging it in would drag Swc upward toward 1. Such wells are
 * EXCLUDED and named, not quietly included. And this is an interpretation of an
 * interpretation — Equinor's LFP saturation curve, not a core plug — so the result is
 * `interpreted`, never `measured`.
 */
export function swcFromLogs(
  perWell: Array<{ well: string; samples: SatSample[] }>,
  phi: number,
  opts: { maxVsh?: number; minPhi?: number; minSamples?: number; wetIfMinSwAbove?: number } = {},
): SwcAnchor | null {
  const maxVsh = opts.maxVsh ?? 0.3;
  const minPhi = opts.minPhi ?? 0.15;
  const minSamples = opts.minSamples ?? 50;
  const wetIfMinSwAbove = opts.wetIfMinSwAbove ?? 0.5;

  const fits: BucklesFit[] = [];
  const excluded: string[] = [];
  for (const { well, samples } of perWell) {
    const clean = (samples ?? []).filter((s) =>
      Number.isFinite(s?.sw) && Number.isFinite(s?.phi) && Number.isFinite(s?.vsh)
      && s.vsh <= maxVsh && s.phi >= minPhi && s.sw > 0 && s.sw <= 1);
    if (clean.length < minSamples) { if (samples?.length) excluded.push(well); continue; }
    const b = clean.map((s) => s.sw * s.phi).sort((x, y) => x - y);
    const minSw = Math.min(...clean.map((s) => s.sw));
    const reachesIrreducible = minSw < wetIfMinSwAbove;
    const p10 = pctile(b, 0.10), p25 = pctile(b, 0.25);
    const fit: BucklesFit = {
      well, n: clean.length, p10, p25,
      swcP10: p10 / phi, swcP25: p25 / phi,
      minSw, reachesIrreducible,
    };
    if (!reachesIrreducible) { excluded.push(well); continue; }
    fits.push(fit);
  }
  if (!fits.length) return null;

  // pool across the contributing wells rather than taking the most optimistic one
  const mean = (xs: number[]) => xs.reduce((a, v) => a + v, 0) / xs.length;
  const buckles = mean(fits.map((f) => f.p25));
  const low = mean(fits.map((f) => f.p10)) / phi;
  const high = mean(fits.map((f) => f.p25)) / phi;
  return {
    swc: Math.max(0.01, Math.min(0.9, high)),
    low: Math.max(0.01, Math.min(0.9, low)),
    high: Math.max(0.01, Math.min(0.9, high)),
    buckles, wells: fits, excluded, phi,
  };
}

// ── initialization / equilibration ───────────────────────────────────────────

export interface ContactSpec {
  kind: string;
  tvdss: number;
  dataNature?: string;
  prov?: string;
}

/** A measured formation-pressure station, referenced to TVDSS. */
export interface PressurePoint {
  well: string;
  tvdss: number;
  pressure: number;
  /** the MD the gauge actually sat at — kept so a point can be traced back */
  md?: number | null;
  temperature?: number | null;
  /** whether the test resolved a formation buildup or only the mud column */
  quality?: 'buildup' | 'column';
}

export interface GradientFit {
  /** bar/m */
  slope: number;
  /** bar at z = 0 */
  intercept: number;
  /** implied fluid density, kg/m³ */
  density: number;
  r2: number;
  n: number;
}

/**
 * Least-squares pressure gradient through measured stations.
 *
 * The slope IS a fluid density: dP/dz = ρg. So a fit over gauge readings is a direct
 * measurement of what fluid the gauge was in, independent of any log or correlation —
 * which is exactly what an initialization needs to be checked against. Returns null
 * below three points or over a depth span too short for a slope to mean anything.
 */
export function fitGradient(points: PressurePoint[], minSpanM = 5): GradientFit | null {
  const pts = points.filter((p) => Number.isFinite(p.tvdss) && Number.isFinite(p.pressure));
  if (pts.length < 3) return null;
  const zs = pts.map((p) => p.tvdss);
  if (Math.max(...zs) - Math.min(...zs) < minSpanM) return null;
  const n = pts.length;
  const mz = zs.reduce((a, z) => a + z, 0) / n;
  const mp = pts.reduce((a, p) => a + p.pressure, 0) / n;
  let szz = 0, szp = 0;
  for (const p of pts) { szz += (p.tvdss - mz) ** 2; szp += (p.tvdss - mz) * (p.pressure - mp); }
  if (szz === 0) return null;
  const slope = szp / szz;
  const intercept = mp - slope * mz;
  let ssRes = 0, ssTot = 0;
  for (const p of pts) {
    const pred = intercept + slope * p.tvdss;
    ssRes += (p.pressure - pred) ** 2;
    ssTot += (p.pressure - mp) ** 2;
  }
  return {
    slope, intercept,
    density: slope * 1e5 / G,
    r2: ssTot === 0 ? 0 : 1 - ssRes / ssTot,
    n,
  };
}

/** One well's own pressure survey, fitted on its own. */
export interface WellGradient {
  well: string;
  fit: GradientFit | null;
  points: PressurePoint[];
  /** does this well actually resolve a fluid gradient, or is it a scatter? */
  resolved: boolean;
  /** the phase the fitted density is consistent with, when one is resolved */
  phase: 'oil' | 'water' | 'other' | null;
}

/**
 * Fit a gradient PER WELL, not across the field.
 *
 * A field-wide fit over a producing field is not a physical object: Volve's gauges
 * span eight years of depletion and injection support, so stacking F-15's 2008
 * readings against F-5's later ones and fitting one line through them measures
 * nothing. Each well's own survey, though, is a snapshot in time — which is exactly
 * what a gradient plot is for.
 *
 * `resolved` is deliberately strict. A well is only credited with a gradient when it
 * has at least `minPoints` buildup stations and the fit explains essentially all of
 * their variance; anything looser and a scatter of mud-column readings would be
 * reported as a fluid.
 */
export function fitByWell(
  points: PressurePoint[],
  opts: { minPoints?: number; minR2?: number; rhoOil?: number; rhoWater?: number; tol?: number } = {},
): WellGradient[] {
  const minPoints = opts.minPoints ?? 3;
  const minR2 = opts.minR2 ?? 0.9;
  const tol = opts.tol ?? 80;
  const byWell = new Map<string, PressurePoint[]>();
  for (const p of points) {
    // a mud-column reading is not a formation pressure and must not enter a fit
    if (p.quality === 'column') continue;
    const list = byWell.get(p.well);
    if (list) list.push(p); else byWell.set(p.well, [p]);
  }
  return [...byWell.entries()]
    .map(([well, pts]) => {
      const fit = pts.length >= minPoints ? fitGradient(pts) : null;
      const resolved = !!fit && fit.n >= minPoints && fit.r2 >= minR2 && fit.slope > 0;
      let phase: WellGradient['phase'] = null;
      if (resolved && fit) {
        if (opts.rhoOil != null && Math.abs(fit.density - opts.rhoOil) <= tol) phase = 'oil';
        else if (opts.rhoWater != null && Math.abs(fit.density - opts.rhoWater) <= tol) phase = 'water';
        else phase = 'other';
      }
      return { well, fit, points: pts, resolved, phase };
    })
    .sort((a, b) => (b.resolved ? 1 : 0) - (a.resolved ? 1 : 0) || b.points.length - a.points.length || a.well.localeCompare(b.well));
}

/** Depth at which two pressure gradients cross — a free-water level estimate. */
export function gradientIntersection(a: GradientFit, b: GradientFit): number | null {
  const d = a.slope - b.slope;
  if (Math.abs(d) < 1e-9) return null;
  return (b.intercept - a.intercept) / d;
}

export interface EquilState {
  datumTvdss: number;
  datumPressure: number;
  /** oil and water phase gradients at reservoir conditions, bar/m */
  oilGradient: number;
  waterGradient: number;
  owc: number | null;
  /** free-water level = OWC displaced by the capillary entry pressure */
  fwl: number | null;
  /** pressure at the contact, bara */
  contactPressure: number | null;
  /** the deck's own EQUIL baseline where the delivery records one, m TVDSS */
  deckContactNote: string | null;
  /** how far the case's initial pressure sits above the bubble point, bar */
  undersaturationBar: number;
  saturationState: 'undersaturated' | 'saturated';
}

/** Phase pressure at a depth, from the datum along the phase's own gradient. */
export function phasePressure(z: number, datum: number, pDatum: number, gradient: number): number {
  return pDatum + gradient * (z - datum);
}

/** Hydrostatic gradient, bar/m, from a reservoir-condition density. */
export function gradientOf(rhoKgM3: number): number { return rhoKgM3 * G / 1e5; }

export function buildEquil(a: FluidAnchors, pvt: PvtModel, contacts: ContactSpec[], e: ScalEndpoints, phi: number, kMd: number): EquilState {
  const oilGradient = gradientOf(pvt.rhoOilRes);
  const waterGradient = gradientOf(pvt.rhoWaterRes);
  const owcSpec = contacts.find((c) => /owc|oil.?water/i.test(c.kind)) ?? null;
  const owc = owcSpec && Number.isFinite(owcSpec.tvdss) ? owcSpec.tvdss : null;
  const dRho = pvt.rhoWaterRes - pvt.rhoOilRes;
  // FWL sits BELOW the OWC by the entry-pressure height — the depth at which oil and
  // water pressures are actually equal, which is what an equilibration solves on.
  const pcEntry = pcEntryPressure(e, phi, kMd);
  const hEntry = dRho > 0 ? pcEntry * 1e5 / (dRho * G) : 0;
  return {
    datumTvdss: a.datumTvdss,
    datumPressure: a.pi,
    oilGradient, waterGradient,
    owc,
    fwl: owc == null ? null : owc + hEntry,
    contactPressure: owc == null ? null : phasePressure(owc, a.datumTvdss, a.pi, oilGradient),
    deckContactNote: owcSpec?.prov ?? null,
    undersaturationBar: a.pi - a.pb,
    saturationState: a.pi >= a.pb ? 'undersaturated' : 'saturated',
  };
}

// ── in place, and the reconciliation that closes the loop ────────────────────

export interface VolumetricInput {
  /** gross rock volume above the contact, m³ */
  grvM3: number;
  phi: number;
  ntg: number;
  /** initial water saturation used for the in-place calculation */
  sw: number;
  /** oil FVF, rm³/Sm³ */
  bo: number;
  /** solution GOR at the bubble point, Sm³/Sm³ — for the associated-gas volume */
  rs?: number;
}

export interface VolumetricResult {
  poreVolumeM3: number;
  hcPoreVolumeM3: number;
  stoiipSm3: number;
  stoiipMMSm3: number;
  /** solution gas initially in place, Sm³ — null when no Rs was supplied */
  giipSm3: number | null;
  /** the same in billions of Sm³, the unit regulators publish gas in */
  giipBcm: number | null;
}

/**
 * STOIIP = GRV·NTG·φ·(1−Sw)/Bo, and the solution gas that comes with it.
 *
 * The gas matters more than it looks. Volve is UNDERSATURATED — there is no gas cap,
 * so every molecule of gas in the field is dissolved in the oil, and GIIP is exactly
 * STOIIP × Rs. That makes the regulator's published gas volume a SECOND, independent
 * check on this calculation, and one that tests a different input: it can only come
 * out right if both the rock volume and the deck's solution GOR are right. Two
 * volumes agreeing with the authority is a much stronger statement than one.
 */
export function stoiip(v: VolumetricInput): VolumetricResult {
  const pore = v.grvM3 * v.ntg * v.phi;
  const hc = pore * (1 - v.sw);
  const oil = v.bo > 0 ? hc / v.bo : 0;
  const gas = v.rs != null && v.rs > 0 ? oil * v.rs : null;
  return {
    poreVolumeM3: pore, hcPoreVolumeM3: hc,
    stoiipSm3: oil, stoiipMMSm3: oil / 1e6,
    giipSm3: gas, giipBcm: gas == null ? null : gas / 1e9,
  };
}

export interface Reconciliation {
  ourMMSm3: number;
  officialMMSm3: number | null;
  deltaPct: number | null;
  /** recovery factor implied against the official in-place, using produced volume */
  rfOfficial: number | null;
  verdict: 'agrees' | 'overstates' | 'understates' | 'unchecked';
  /** the SECOND check: our solution gas against the authority's published GIIP */
  gas: {
    ourBcm: number;
    officialBcm: number;
    deltaPct: number;
    verdict: 'agrees' | 'overstates' | 'understates';
  } | null;
}

/**
 * Check the case's in-place against the regulator's published figure.
 *
 * Volve's screening volumetrics have overstated in-place before — the platform
 * records that explicitly — so a fluid/rock case that quietly produces a different
 * number from the official one has to say so on the same screen, not in a document.
 */
export function reconcile(
  ourMMSm3: number,
  officialMMSm3: number | null,
  producedMMSm3: number | null,
  opts: { tolPct?: number; ourGiipBcm?: number | null; officialGiipBcm?: number | null } = {},
): Reconciliation {
  const tolPct = opts.tolPct ?? 10;
  const gas = opts.ourGiipBcm != null && opts.officialGiipBcm != null && opts.officialGiipBcm > 0
    ? (() => {
      const deltaPct = (opts.ourGiipBcm! - opts.officialGiipBcm!) / opts.officialGiipBcm! * 100;
      return {
        ourBcm: opts.ourGiipBcm!, officialBcm: opts.officialGiipBcm!, deltaPct,
        verdict: (Math.abs(deltaPct) <= tolPct ? 'agrees' : deltaPct > 0 ? 'overstates' : 'understates') as 'agrees' | 'overstates' | 'understates',
      };
    })()
    : null;
  if (officialMMSm3 == null || !(officialMMSm3 > 0)) {
    return { ourMMSm3, officialMMSm3: null, deltaPct: null, rfOfficial: null, verdict: 'unchecked', gas };
  }
  const deltaPct = (ourMMSm3 - officialMMSm3) / officialMMSm3 * 100;
  return {
    ourMMSm3, officialMMSm3, deltaPct,
    rfOfficial: producedMMSm3 == null ? null : producedMMSm3 / officialMMSm3,
    verdict: Math.abs(deltaPct) <= tolPct ? 'agrees' : deltaPct > 0 ? 'overstates' : 'understates',
    gas,
  };
}

// ── the artifact ─────────────────────────────────────────────────────────────

/** Reservoir rock properties the dynamic model needs and petrophysics supplies. */
export interface RockModel {
  phi: number;
  ntg: number;
  /** initial water saturation used for in-place, fraction */
  sw: number;
  /** absolute permeability, mD — screening/analogue unless the delivery states one */
  kMd: number;
  /** rock compressibility, 1/bar, and its reference pressure, bara */
  cf: number;
  pref: number;
  basis: Record<'phi' | 'ntg' | 'sw' | 'kMd' | 'cf', Basis>;
}

/** A blocking problem with the case — a simulation must not be started on it. */
export interface CaseIssue {
  severity: 'fail' | 'warn' | 'info';
  rule: string;
  message: string;
}

/** THE ARTIFACT. What the Fluids & Rock stage publishes and Simulation reads. */
export interface DynamicInitialization {
  fieldId: string;
  anchors: FluidAnchors;
  pvt: PvtModel;
  scal: ScalEndpoints;
  scalBasis: Basis;
  rock: RockModel;
  swof: ScalRow[];
  welge: WelgeResult;
  wettability: WettabilityDiagnosis;
  mobilityRatio: number;
  displacementEfficiency: number;
  equil: EquilState;
  volumetrics: VolumetricResult | null;
  reconciliation: Reconciliation | null;
  /** measured stations the initialization was checked against */
  pressurePoints: PressurePoint[];
  /** one fit per well — the only kind that means anything on a produced field */
  wellGradients: WellGradient[];
  issues: CaseIssue[];
}

export interface CaseInput {
  fieldId: string;
  anchors: FluidAnchors;
  scal?: Partial<ScalEndpoints>;
  scalBasis?: Basis;
  rock?: Partial<RockModel>;
  contacts?: ContactSpec[];
  pressurePoints?: PressurePoint[];
  /** gross rock volume above the contact, m³ — from the static model when it exists */
  grvM3?: number | null;
  officialStoiipMMSm3?: number | null;
  /** the authority's published gas initially in place, Bcm — the second volume check */
  officialGiipBcm?: number | null;
  producedOilMMSm3?: number | null;
  pvtOptions?: PvtOptions;
}

/** Screening permeability. Not a Volve measurement — the delivery ships no core
 *  or well-test permeability, and the legacy simulation used the same 500 mD. */
export const K_SCREENING_MD = 500;

export const ROCK_DEFAULTS: RockModel = {
  phi: 0.225, ntg: 0.9, sw: 0.2, kMd: K_SCREENING_MD, cf: 2e-5, pref: 329,
  basis: { phi: 'deck', ntg: 'deck', sw: 'deck', kMd: 'analogue', cf: 'deck', pref: 'deck' } as RockModel['basis'],
};

/**
 * Build the complete case.
 *
 * The order is the physical one: identify the fluid, build its PVT, lay the rock-fluid
 * functions over it, equilibrate, then compute in place and check it. Each step reads
 * the one before, so changing an endpoint moves the transition zone, which moves the
 * in-place volume, which moves the reconciliation — the chain the tab exists to show.
 */
export function buildCase(input: CaseInput): DynamicInitialization {
  const a = input.anchors;
  const pvt = buildPvt(a, input.pvtOptions);
  const scal: ScalEndpoints = { ...SCAL_ANALOGUE, ...input.scal };
  const rock: RockModel = {
    ...ROCK_DEFAULTS,
    cf: a.rockCf, pref: a.rockPref,
    ...input.rock,
    basis: { ...ROCK_DEFAULTS.basis, ...(input.rock?.basis ?? {}) },
  };
  const contacts = input.contacts ?? [];
  const equil = buildEquil(a, pvt, contacts, scal, rock.phi, rock.kMd);
  const swof = buildSwof(scal, pvt.muw, pvt.muoAtPi, rock.phi, rock.kMd);
  const welge = welgeFront(scal, pvt.muw, pvt.muoAtPi);

  const volumetrics = input.grvM3 && input.grvM3 > 0
    ? stoiip({ grvM3: input.grvM3, phi: rock.phi, ntg: rock.ntg, sw: rock.sw, bo: a.boAtPi, rs: a.rsb })
    : null;
  const reconciliation = volumetrics
    ? reconcile(volumetrics.stoiipMMSm3, input.officialStoiipMMSm3 ?? null, input.producedOilMMSm3 ?? null, {
      ourGiipBcm: volumetrics.giipBcm,
      officialGiipBcm: input.officialGiipBcm ?? null,
    })
    : null;

  const points = input.pressurePoints ?? [];
  const wellGradients = fitByWell(points, { rhoOil: pvt.rhoOilRes, rhoWater: pvt.rhoWaterRes });

  return {
    fieldId: input.fieldId,
    anchors: a, pvt, scal,
    scalBasis: input.scalBasis ?? 'analogue',
    rock, swof, welge,
    wettability: diagnoseWettability(scal),
    mobilityRatio: mobilityRatio(scal, pvt.muw, pvt.muoAtPi),
    displacementEfficiency: displacementEfficiency(scal),
    equil, volumetrics, reconciliation,
    pressurePoints: points,
    wellGradients,
    issues: validateCase({ anchors: a, pvt, scal, rock, equil, reconciliation, wellGradients }),
  };
}

/**
 * What would make this case wrong to simulate.
 *
 * Every rule here is one a reservoir engineer would raise in a model review, and each
 * one is checked against the case's own numbers rather than a remembered expectation.
 */
export function validateCase(c: {
  anchors: FluidAnchors; pvt: PvtModel; scal: ScalEndpoints; rock: RockModel;
  equil: EquilState; reconciliation: Reconciliation | null;
  wellGradients: WellGradient[];
}): CaseIssue[] {
  const out: CaseIssue[] = [];
  const { anchors: a, pvt, scal, rock, equil } = c;

  if (a.pb > a.pi) {
    out.push({ severity: 'fail', rule: 'pvt.saturated', message: `Bubble point ${a.pb} bara is above initial pressure ${a.pi} bara — the reservoir has free gas at discovery and an oil–water case cannot represent it.` });
  }
  if (scal.swc + scal.sor >= 1) {
    out.push({ severity: 'fail', rule: 'scal.endpoints', message: `Swc ${scal.swc} + Sor ${scal.sor} leaves no mobile saturation range.` });
  }
  if (rock.sw < scal.swc - 1e-9) {
    out.push({ severity: 'fail', rule: 'init.sw', message: `Initial Sw ${rock.sw.toFixed(3)} is below the connate water ${scal.swc.toFixed(3)} the SCAL model says is irreducible — the initialization and the kr curves disagree about the same rock.` });
  }
  if (equil.owc == null) {
    out.push({ severity: 'fail', rule: 'init.contact', message: 'No oil–water contact in the delivery — the model cannot be equilibrated.' });
  }
  if (pvt.rhoWaterRes <= pvt.rhoOilRes) {
    out.push({ severity: 'fail', rule: 'init.density', message: 'Reservoir water is not denser than reservoir oil — the phases would not segregate.' });
  }
  // The analogue is INTRODUCED as water-wet. Craig's indicators, run on the actual
  // endpoints, may not agree — and if they do not, the label is wrong rather than the
  // rock being unusual. This is the check that catches a curve nobody re-examined.
  const wet = diagnoseWettability(scal);
  if (wet.agreeing < 3) {
    const dissent = wet.criteria.filter((c) => c.reads !== wet.verdict);
    out.push({
      severity: wet.agreeing <= 1 ? 'warn' : 'info',
      rule: 'scal.wettability',
      message: `These curves read ${wet.verdict} on ${wet.agreeing} of Craig's 3 indicators. ${dissent.map((c) => `${c.label} is ${c.value.toFixed(3)}, which reads ${c.reads} (${c.rule})`).join('; ')}. Wettability is a core measurement and none was delivered — this only says what the assumed curve shape implies, so treat a split verdict as a reason to sensitise, not as a finding about the rock.`,
    });
  }

  const mr = mobilityRatio(scal, pvt.muw, pvt.muoAtPi);
  if (mr > 1) {
    out.push({ severity: 'warn', rule: 'scal.mobility', message: `End-point mobility ratio ${mr.toFixed(2)} is unfavourable — expect viscous fingering and early breakthrough; sweep will be optimistic in a coarse model.` });
  }
  const cal = pvt.calibration;
  if (Math.abs(cal.rsFactor - 1) > 0.25) {
    out.push({ severity: 'warn', rule: 'pvt.calibration', message: `Standing predicts Rs ${cal.rsPredicted.toFixed(0)} Sm³/Sm³ at the deck's bubble point against the deck's ${a.rsb} — a ${((cal.rsFactor - 1) * 100).toFixed(0)}% anchoring correction. The correlation's population does not describe this fluid; treat the saturated branch as indicative.` });
  }
  if (Math.abs(cal.boFactor - 1) > 0.1) {
    out.push({ severity: 'warn', rule: 'pvt.bo', message: `Standing's Bo is anchored by ${((cal.boFactor - 1) * 100).toFixed(1)}% to reach the deck's bubble-point value.` });
  }
  if (c.reconciliation && c.reconciliation.verdict === 'overstates') {
    out.push({ severity: 'warn', rule: 'init.inplace', message: `In-place is ${c.reconciliation.deltaPct?.toFixed(0)}% above the regulator's published figure — the contact or the net-pay cut is optimistic, and any recovery factor quoted off this case will read low.` });
  }
  // The gas check tests a DIFFERENT input from the oil check. Oil in place is rock
  // volume; solution gas is rock volume × Rs. So oil agreeing while gas disagrees
  // isolates the fault to the solution GOR, and both agreeing confirms both.
  const gas = c.reconciliation?.gas;
  if (gas) {
    if (gas.verdict === 'agrees' && c.reconciliation?.verdict === 'agrees') {
      out.push({
        severity: 'info', rule: 'init.gas',
        message: `Solution gas in place is ${gas.ourBcm.toFixed(3)} Bcm against the regulator's ${gas.officialBcm} Bcm (${gas.deltaPct >= 0 ? '+' : ''}${gas.deltaPct.toFixed(1)}%). This is an independent check of the deck's ${a.rsb} Sm³/Sm³ solution GOR: the field is undersaturated, so all of its gas is dissolved and GIIP is exactly STOIIP × Rs. Rock volume and solution GOR are both confirmed.`,
      });
    } else if (gas.verdict !== 'agrees' && c.reconciliation?.verdict === 'agrees') {
      out.push({
        severity: 'warn', rule: 'init.gas',
        message: `Oil in place agrees with the regulator but solution gas does not — ${gas.ourBcm.toFixed(3)} Bcm against ${gas.officialBcm} Bcm (${gas.deltaPct >= 0 ? '+' : ''}${gas.deltaPct.toFixed(0)}%). Since GIIP = STOIIP × Rs and the rock volume checks out, the discrepancy is in the deck's solution GOR of ${a.rsb} Sm³/Sm³.`,
      });
    } else if (gas.verdict !== 'agrees') {
      out.push({
        severity: 'warn', rule: 'init.gas',
        message: `Solution gas in place is ${gas.deltaPct >= 0 ? '+' : ''}${gas.deltaPct.toFixed(0)}% against the regulator's ${gas.officialBcm} Bcm.`,
      });
    }
  }
  // THE independent check: does any well's own gauge survey reproduce the deck fluid?
  const resolved = c.wellGradients.filter((g) => g.resolved && g.fit);
  const oilWell = resolved.find((g) => g.phase === 'oil');
  if (oilWell?.fit) {
    out.push({
      severity: 'info', rule: 'init.gradient',
      message: `${oilWell.well}'s own ${oilWell.fit.n} gauge stations fit a gradient of ${oilWell.fit.slope.toFixed(5)} bar/m — ${oilWell.fit.density.toFixed(0)} kg/m³ at R² ${oilWell.fit.r2.toFixed(3)} — against the deck live oil's ${pvt.rhoOilRes.toFixed(0)} kg/m³. The PVT is confirmed by measurement, independently of any correlation.`,
    });
  } else if (resolved.length) {
    const g = resolved[0];
    out.push({
      severity: 'warn', rule: 'init.gradient',
      message: `No well's gauge survey reproduces the deck oil density. The best fit (${g.well}, ${g.fit?.n} stations) implies ${g.fit?.density.toFixed(0)} kg/m³ against the deck's ${pvt.rhoOilRes.toFixed(0)} kg/m³ — treat the initialization as unconfirmed by measurement.`,
    });
  } else if (c.wellGradients.length) {
    out.push({
      severity: 'warn', rule: 'init.gradient',
      message: `${c.wellGradients.length} well${c.wellGradients.length === 1 ? '' : 's'} carry formation-pressure tests but none resolves a fluid gradient — the stations scatter, so the initialization is not checked against measurement.`,
    });
  }
  if (rock.basis.kMd !== 'measured') {
    out.push({ severity: 'info', rule: 'rock.k', message: `Permeability ${rock.kMd} mD is ${rock.basis.kMd}, not measured — it sets the transition-zone height and the well indices, so treat both as screening.` });
  }
  return out;
}

// ── the seam to the simulator ────────────────────────────────────────────────

/** Exactly what the FV/streamline engine needs, and nothing else. */
export interface SimFluids {
  swc: number; sor: number; krwMax: number; kroMax: number; nw: number; no: number;
  muw: number; muo: number;
  /** oil/water viscosity ratio — what the legacy inspector exposes as one slider */
  muRatio: number;
  bo: number; bw: number;
  phi: number; ntg: number; kMd: number;
  swInit: number;
  pInit: number;
  datumTvdss: number;
  owc: number | null;
  fieldId: string;
}

/** Project the published case onto the simulator's input. One direction only: the
 *  simulator never writes back into the fluid case. */
export function toSimFluids(c: DynamicInitialization): SimFluids {
  return {
    swc: c.scal.swc, sor: c.scal.sor, krwMax: c.scal.krwMax, kroMax: c.scal.kroMax,
    nw: c.scal.nw, no: c.scal.no,
    muw: c.pvt.muw, muo: c.pvt.muoAtPi,
    muRatio: c.pvt.muw > 0 ? c.pvt.muoAtPi / c.pvt.muw : 1,
    bo: c.anchors.boAtPi, bw: c.pvt.bw,
    phi: c.rock.phi, ntg: c.rock.ntg, kMd: c.rock.kMd,
    swInit: c.rock.sw, pInit: c.anchors.pi,
    datumTvdss: c.anchors.datumTvdss, owc: c.equil.owc,
    fieldId: c.fieldId,
  };
}

/** True when nothing blocks a run. Warnings do not block; failures do. */
export function isRunnable(c: DynamicInitialization): boolean {
  return !c.issues.some((i) => i.severity === 'fail');
}

// ── export: the deck the case would write ────────────────────────────────────

const f = (v: number, d = 4) => (Number.isFinite(v) ? v.toFixed(d) : '0');

/**
 * Render the case as ECLIPSE METRIC keywords.
 *
 * Not decoration: it is the case's own statement of itself in the format the
 * industry reads, and it is what makes "this tab is the source for the simulation"
 * checkable by hand rather than asserted.
 */
export function toEclipseDeck(c: DynamicInitialization): string {
  const L: string[] = [];
  L.push(`-- ${c.fieldId} — dynamic initialization`);
  L.push(`-- PVT anchors: ${c.anchors.source}`);
  L.push(`-- SCAL basis: ${c.scalBasis}${c.scalBasis === 'analogue' ? ' (NO measured SCAL in the delivery)' : ''}`);
  L.push('');
  L.push('DENSITY');
  L.push(`  ${f(c.anchors.rhoOilSc, 2)}  ${f(c.anchors.rhoWaterSc, 2)}  ${f(c.anchors.rhoGasSc, 5)} /`);
  L.push('');
  L.push('ROCK');
  L.push(`  ${f(c.rock.pref, 1)}  ${c.rock.cf.toExponential(3)} /`);
  L.push('');
  L.push('PVTW');
  const w = c.pvt.pvtw[Math.floor(c.pvt.pvtw.length / 2)];
  L.push(`  ${f(c.rock.pref, 1)}  ${f(c.pvt.bw, 5)}  ${c.pvt.cw.toExponential(3)}  ${f(c.pvt.muw, 4)}  0.0 /`);
  L.push(`-- reference row taken at the rock reference pressure; μw ${f(w.muw, 4)} cP at ${f(w.p, 0)} bara`);
  L.push('');
  L.push('PVTO');
  L.push('--  Rs        Pb       Bo        Muo');
  for (const r of c.pvt.pvto) {
    L.push(`  ${f(r.rs, 3)}  ${f(r.p, 2)}  ${f(r.bo, 5)}  ${f(r.muo, 5)} /`);
  }
  const last = c.pvt.pvto[c.pvt.pvto.length - 1];
  L.push('-- undersaturated branch at Rs = Rsb');
  for (const r of c.pvt.undersaturated.slice(1)) {
    L.push(`          ${f(r.p, 2)}  ${f(r.bo, 5)}  ${f(r.muo, 5)}`);
  }
  L.push('  /');
  L.push(`-- last saturated node: Rs ${f(last.rs, 1)} at ${f(last.p, 1)} bara`);
  L.push('/');
  L.push('');
  L.push('PVDG');
  L.push('--  P         Bg          Mug');
  for (const r of c.pvt.pvdg) L.push(`  ${f(r.p, 2)}  ${f(r.bg, 6)}  ${f(r.mug, 5)}`);
  L.push('/');
  L.push('');
  L.push('SWOF');
  L.push('--  Sw        Krw       Kro       Pc');
  for (const r of c.swof) L.push(`  ${f(r.sw, 4)}  ${f(r.krw, 5)}  ${f(r.kro, 5)}  ${f(r.pc, 5)}`);
  L.push('/');
  L.push('');
  L.push('EQUIL');
  L.push('--  Datum   Pdatum   OWC     Pc(OWC)  GOC  Pc(GOC)');
  L.push(`  ${f(c.equil.datumTvdss, 1)}  ${f(c.equil.datumPressure, 2)}  ${c.equil.owc == null ? '1*' : f(c.equil.owc, 1)}  0.0  1*  1*  /`);
  return L.join('\n');
}

// ── Cuddy's saturation-height function ──────────────────────────────────────
//
// Cuddy et al. (1993) observed that BULK VOLUME WATER — the product Sw·φ, i.e. the
// fraction of the whole rock occupied by water — follows a simple power law in height
// above the free-water level:
//
//     BVW = Sw · φ = a · H^b        ⇒        Sw = a · H^b / φ
//
// ── WHY IT IS EASIER THAN A LEVERETT J ──────────────────────────────────────
//
// The J-function route needs interfacial tension, a contact angle, a Pc curve and —
// critically — a PERMEABILITY per cell. Every one of those is another number to source
// and another place to be wrong. Cuddy needs two constants and fits them directly to
// the log-derived Sw and φ that the interpretation already produced. Where the
// permeability is an ANALOGUE guess, as it is here, the J-function is propagating that
// guess into the saturation of every cell; Cuddy simply does not ask.
//
// ── WHAT IT GIVES UP, AND WHEN THAT MATTERS ─────────────────────────────────
//
// There is no explicit rock-quality term. Two cells at the same height get the same
// BULK VOLUME of water, so the tighter one — lower φ — is assigned the HIGHER Sw, and
// that much of the physics does survive. What does not survive is permeability: a
// well-sorted 1000 mD sand and a poorly-sorted 50 mD sand of identical porosity get
// identical saturation, where a J-function would separate them. Use Cuddy when the
// permeability is unreliable or absent and log coverage is good; use the J-function
// when core capillary pressure exists and rock types genuinely differ at equal φ.
//
// Both are exposed, and the two disagreeing is a finding worth having.

export interface CuddyShf {
  /** BVW = a·H^b */
  a: number;
  b: number;
  /** samples the fit rests on */
  n: number;
  /** coefficient of determination of the log–log fit */
  r2: number;
  /** the height range actually fitted, metres — the function says nothing outside it */
  hMin: number;
  hMax: number;
}

export interface CuddySample {
  /** height above the FREE-WATER LEVEL, metres. Samples at or below it carry no
   *  information about the transition and must not be fitted. */
  h: number;
  sw: number;
  phi: number;
}

/**
 * Fit BVW = a·H^b by least squares in log–log space.
 *
 * Rejects any sample whose height, Sw or φ is non-positive: the regression is on
 * logarithms, and a single zero would take the whole fit with it. Returns null rather
 * than a fabricated pair when too few samples survive — a two-point "fit" through log
 * noise is not a saturation-height function.
 */
export function fitCuddy(samples: CuddySample[], minSamples = 20): CuddyShf | null {
  const xs: number[] = [], ys: number[] = [];
  let hMin = Infinity, hMax = -Infinity;
  for (const s of samples) {
    if (!(s.h > 0) || !(s.phi > 0) || !(s.sw > 0) || s.sw > 1) continue;
    const bvw = s.sw * s.phi;
    if (!(bvw > 0)) continue;
    xs.push(Math.log10(s.h));
    ys.push(Math.log10(bvw));
    if (s.h < hMin) hMin = s.h;
    if (s.h > hMax) hMax = s.h;
  }
  const n = xs.length;
  if (n < minSamples) return null;

  const mx = xs.reduce((p, q) => p + q, 0) / n;
  const my = ys.reduce((p, q) => p + q, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (!(sxx > 0)) return null;
  const b = sxy / sxx;
  const a = 10 ** (my - b * mx);
  const r2 = syy > 0 ? (sxy * sxy) / (sxx * syy) : 0;
  return { a, b, n, r2, hMin, hMax };
}

/**
 * Water saturation at a height above the free-water level, by Cuddy.
 *
 * Below the FWL the rock is fully water-bearing, and the power law is not evaluated
 * there at all — H ≤ 0 has no logarithm and no meaning. The result is clamped to
 * [swirr, 1]: the raw BVW law is unbounded as φ falls, so a tight cell high in the
 * column can otherwise be handed a saturation above one, which is not a saturation.
 */
export function cuddySw(hM: number, phi: number, c: { a: number; b: number }, swirr = 0.05): number {
  if (!(hM > 0)) return 1;
  if (!(phi > 0)) return 1;
  const bvw = c.a * hM ** c.b;
  return Math.max(swirr, Math.min(1, bvw / phi));
}
