// petro-compute.ts — the interactive petrophysics computation (P2).
//
// Pure. No DOM, no IndexedDB, no `import.meta` — so scripts/test-petro-compute.mjs
// can truth-lock it directly, and so the bench, the crossplots and the zonation table
// all get the SAME numbers from the same call rather than three near-identical
// recomputes that drift.
//
// It wraps `engine/petro.ts` (vsh · phit · phie · sw · netFlag · zoneAverages, already
// truth-locked in test-engine.mjs) and adds only what the interactive tab needs:
//   · the shale-corrected saturation models Archie alone cannot cover
//   · endpoint resolution — auto from the well's own distribution, or user-set,
//     or read from the GRMIN/GRMAX curves when the delivery ships them
//   · a whole-log run that reports, per curve, WHICH input was missing when it
//     could not produce an answer
//
// The rule the whole module obeys: a result requires its inputs. No Sw without Rt,
// no porosity without RHOB or DT, no Vsh without GR. A missing input yields `null`
// samples and a named reason — never a default that looks like a measurement.
import { vsh as vshOf, phit as phitOf, phie as phieOf, sw as archieSw, netFlag, type VshMethod, type NetCutoffs } from '../../engine/petro.ts';

export type { VshMethod, NetCutoffs };

/** Saturation models. Archie assumes clean sand; the other two correct for shale,
 *  which matters wherever Vsh runs high — Volve's Vsh median is 0.15 but its tail
 *  reaches 0.99, and clean-sand Archie over-estimates Sw right there. */
export type SwModel = 'archie' | 'simandoux' | 'indonesia';

export type PorosityModel = 'density' | 'density-neutron' | 'sonic';

/** Where a parameter came from. Mirrors the platform-wide vocabulary; `calibrated`
 *  may only be set once a misfit has actually been measured against a known answer. */
export type Nature = 'measured' | 'interpreted' | 'derived' | 'calibrated' | 'analog' | 'user' | 'default';

export interface PetroParams {
  // ── Vsh ──
  vshMethod: VshMethod;
  /** null ⇒ resolve from the well's own P5/P95, or from GRMIN/GRMAX if present */
  grClean: number | null;
  grShale: number | null;

  // ── porosity ──
  porosityModel: PorosityModel;
  rhoMa: number;      // matrix density, g/cm³ (2.65 sand · 2.71 lime · 2.87 dolo)
  rhoFl: number;      // pore-fluid density, g/cm³
  phiSh: number;      // shale porosity, for the total → effective correction
  dtMa: number;       // matrix transit time, µs/ft (Wyllie)
  dtFl: number;       // fluid transit time, µs/ft

  // ── saturation ──
  swModel: SwModel;
  a: number; m: number; n: number;
  rw: number;         // formation-water resistivity at formation temperature, Ω·m
  rsh: number;        // shale resistivity, Ω·m — used by Simandoux and Indonesia only

  // ── net / pay ──
  cutoffs: NetCutoffs;
}

export const DEFAULT_PARAMS: PetroParams = {
  vshMethod: 'larionov_tertiary',
  grClean: null, grShale: null,
  porosityModel: 'density',
  rhoMa: 2.65, rhoFl: 1.0, phiSh: 0.1,
  dtMa: 55.5, dtFl: 189,
  swModel: 'archie',
  a: 1, m: 2, n: 2,
  rw: 0.03, rsh: 4,
  cutoffs: { vsh: 0.5, phie: 0.08, sw: 0.6 },
};

// ── saturation models ────────────────────────────────────────────────────────

/**
 * Simandoux (Bardon–Pied modified form), solved in closed form.
 *
 * `n` is not a free parameter here: the closed form is the n = 2 solution of the
 * quadratic. Callers are told rather than silently having their n ignored — see
 * `swModelHonoursN`.
 */
export function simandouxSw(phie: number, rt: number, vsh: number, a: number, m: number, rw: number, rsh: number): number {
  if (phie <= 0 || rt <= 0 || rw <= 0) return 1;
  const phim = Math.pow(phie, m);
  const c = phim / (a * rw);
  const x = rsh > 0 ? vsh / rsh : 0;
  const s = (Math.sqrt(x * x + (4 * c) / rt) - x) / (2 * c);
  return Math.max(0, Math.min(1, s));
}

/**
 * Indonesia (Poupon–Leveaux) — the dispersed-shale workhorse.
 *
 *   1/√Rt = [ Vsh^(1−Vsh/2)/√Rsh + φ^(m/2)/√(a·Rw) ] · Sw^(n/2)
 */
export function indonesiaSw(phie: number, rt: number, vsh: number, a: number, m: number, n: number, rw: number, rsh: number): number {
  if (phie <= 0 || rt <= 0 || rw <= 0) return 1;
  const v = Math.max(0, Math.min(1, vsh));
  const shaleTerm = rsh > 0 ? Math.pow(v, 1 - v / 2) / Math.sqrt(rsh) : 0;
  const sandTerm = Math.pow(phie, m / 2) / Math.sqrt(a * rw);
  const denom = shaleTerm + sandTerm;
  if (denom <= 0) return 1;
  const s = Math.pow((1 / Math.sqrt(rt)) / denom, 2 / n);
  return Math.max(0, Math.min(1, s));
}

/** Simandoux's closed form fixes n at 2. The UI must disable the n control rather
 *  than let a user set a number that is then quietly discarded. */
export const swModelHonoursN = (model: SwModel) => model !== 'simandoux';
/** Only the shale-corrected models read Rsh. */
export const swModelUsesRsh = (model: SwModel) => model !== 'archie';

export function saturation(model: SwModel, phie: number, rt: number, vsh: number, p: PetroParams): number {
  switch (model) {
    case 'simandoux': return simandouxSw(phie, rt, vsh, p.a, p.m, p.rw, p.rsh);
    case 'indonesia': return indonesiaSw(phie, rt, vsh, p.a, p.m, p.n, p.rw, p.rsh);
    case 'archie':
    default: return archieSw(phie, rt, p.a, p.m, p.n, p.rw);
  }
}

// ── Rw from salinity ─────────────────────────────────────────────────────────

/**
 * Arps: resistivity of the same brine at another temperature.
 * `R2 = R1 · (T1 + 6.77) / (T2 + 6.77)` in °F; converted here so callers work in °C.
 */
export function arps(r1: number, t1C: number, t2C: number): number {
  const f = (c: number) => c * 1.8 + 32;
  return r1 * (f(t1C) + 6.77) / (f(t2C) + 6.77);
}

/**
 * Bateman–Konen: NaCl-equivalent salinity (ppm) → Rw at a temperature.
 *
 *   Rw = ( 400000 / (T_F · ppm) )^0.88
 *
 * A screening correlation, not a measurement — anything derived from it must carry
 * nature `derived`, and is worth checking against a measured RW curve where one exists.
 */
export function rwFromSalinity(ppm: number, tempC: number): number | null {
  if (!(ppm > 0)) return null;
  const tF = tempC * 1.8 + 32;
  if (!(tF > 0)) return null;
  return Math.pow(400000 / (tF * ppm), 0.88);
}

/** The inverse, for the panel's other direction: Rw + temperature → ppm. */
export function salinityFromRw(rw: number, tempC: number): number | null {
  if (!(rw > 0)) return null;
  const tF = tempC * 1.8 + 32;
  if (!(tF > 0)) return null;
  return 400000 / (tF * Math.pow(rw, 1 / 0.88));
}

/** Temperature at depth from a surface temperature and a gradient (°C per 100 m). */
export const tempAtDepth = (tvdM: number, surfaceC: number, gradCper100m: number) =>
  surfaceC + (tvdM / 100) * gradCper100m;

// ── endpoints ────────────────────────────────────────────────────────────────

export interface Endpoints { clean: number; shale: number; nature: Nature }

/**
 * Resolve the GR clean/shale endpoints.
 *
 * Priority: an explicit user value, then the delivery's own GRMIN/GRMAX curves
 * (their MEDIAN — Equinor's are depth-varying, so a single number is a summary and
 * is labelled `interpreted` to say whose it is), then this well's own P5/P95.
 *
 * Per-well by default on purpose: a fixed API cutoff misfires across a basin, and
 * Volve proves it — the shipped endpoints span 7–54 API clean and 58–193 API shale.
 */
export function resolveEndpoints(
  gr: (number | null)[] | undefined,
  p: Pick<PetroParams, 'grClean' | 'grShale'>,
  shipped?: { grMin?: (number | null)[]; grMax?: (number | null)[] },
): Endpoints | null {
  if (p.grClean != null && p.grShale != null && p.grShale > p.grClean) {
    return { clean: p.grClean, shale: p.grShale, nature: 'user' };
  }
  const med = (xs?: (number | null)[]) => {
    if (!xs) return null;
    const v = xs.filter((x): x is number => x != null && Number.isFinite(x)).sort((a, b) => a - b);
    return v.length ? v[v.length >> 1] : null;
  };
  const sc = med(shipped?.grMin), ss = med(shipped?.grMax);
  if (sc != null && ss != null && ss > sc) return { clean: sc, shale: ss, nature: 'interpreted' };

  const v = (gr ?? []).filter((x): x is number => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length < 8) return null;
  const clean = v[Math.floor(v.length * 0.05)];
  const shale = v[Math.floor(v.length * 0.95)];
  return shale > clean ? { clean, shale, nature: 'derived' } : null;
}

// ── the whole-log run ────────────────────────────────────────────────────────

/** The curves the run needs, already resolved by family. Everything is optional —
 *  what is absent determines what cannot be produced. */
export interface PetroInputs {
  md: number[];
  gr?: (number | null)[];
  rt?: (number | null)[];
  rhob?: (number | null)[];
  nphi?: (number | null)[];
  dt?: (number | null)[];
  /** the delivery's own endpoint curves, when it ships them */
  grMin?: (number | null)[];
  grMax?: (number | null)[];
  /** an existing INTERPRETED answer, for the overlay and for calibration */
  refPhie?: (number | null)[];
  refSw?: (number | null)[];
  refVsh?: (number | null)[];
}

export interface PetroResult {
  vsh: (number | null)[];
  phit: (number | null)[];
  phie: (number | null)[];
  sw: (number | null)[];
  /** true where all three cutoffs pass; null where the flag could not be evaluated */
  net: (boolean | null)[];
  endpoints: Endpoints | null;
  /** why a track is absent, keyed by the track it would have been */
  missing: Partial<Record<'vsh' | 'phie' | 'sw', string>>;
  /** how many samples produced a finite value, per track */
  counts: { vsh: number; phie: number; sw: number; net: number };
}

const finite = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

/**
 * Run the interpretation over a whole log.
 *
 * Arrays come back index-aligned to `md`, with `null` wherever an input sample was
 * missing — nulls are preserved, never interpolated across, because a gap in a curve
 * is a gap in the evidence.
 */
export function runPetro(inp: PetroInputs, p: PetroParams): PetroResult {
  const n = inp.md.length;
  const vsh: (number | null)[] = new Array(n).fill(null);
  const phit: (number | null)[] = new Array(n).fill(null);
  const phie: (number | null)[] = new Array(n).fill(null);
  const sw: (number | null)[] = new Array(n).fill(null);
  const net: (boolean | null)[] = new Array(n).fill(null);
  const missing: PetroResult['missing'] = {};

  const endpoints = resolveEndpoints(inp.gr, p, { grMin: inp.grMin, grMax: inp.grMax });
  if (!inp.gr) missing.vsh = 'no GR curve';
  else if (!endpoints) missing.vsh = 'GR present but its clean/shale endpoints could not be resolved';

  const usesDensity = p.porosityModel !== 'sonic';
  if (usesDensity && !inp.rhob) missing.phie = 'no RHOB curve';
  else if (!usesDensity && !inp.dt) missing.phie = 'no DT curve';
  else if (p.porosityModel === 'density-neutron' && !inp.nphi) missing.phie = 'no NPHI curve for the density–neutron model';
  if (!inp.rt) missing.sw = 'no RT curve';
  else if (missing.phie) missing.sw = `no porosity (${missing.phie})`;

  for (let i = 0; i < n; i++) {
    // ── Vsh ──
    let v: number | null = null;
    if (inp.gr && endpoints) {
      const g = inp.gr[i];
      if (finite(g)) v = vshOf(g, endpoints.clean, endpoints.shale, p.vshMethod);
    }
    vsh[i] = v;

    // ── porosity ──
    let pt: number | null = null;
    if (p.porosityModel === 'sonic') {
      const d = inp.dt?.[i];
      if (finite(d) && p.dtFl !== p.dtMa) pt = (d - p.dtMa) / (p.dtFl - p.dtMa);
    } else {
      const rb = inp.rhob?.[i];
      if (finite(rb)) pt = phitOf(rb, p.rhoMa, p.rhoFl);
      if (p.porosityModel === 'density-neutron') {
        const np = inp.nphi?.[i];
        // the gas-tolerant RMS form; a gas crossover pulls φD up and φN down, and
        // the root splits the difference instead of believing either alone
        if (pt != null && finite(np)) pt = Math.sqrt((pt * pt + np * np) / 2);
        else pt = null;
      }
    }
    if (pt != null && Number.isFinite(pt)) {
      pt = Math.max(0, Math.min(1, pt));
      phit[i] = pt;
      phie[i] = v != null ? phieOf(pt, v, p.phiSh) : pt;
    }

    // ── saturation ──
    const rtv = inp.rt?.[i];
    const pe = phie[i];
    if (finite(rtv) && pe != null && rtv > 0) {
      sw[i] = saturation(p.swModel, pe, rtv, v ?? 0, p);
    }

    // ── net flag: only where every cutoff has something to test ──
    if (pe != null && sw[i] != null && v != null) {
      net[i] = netFlag(v, pe, sw[i] as number, p.cutoffs);
    }
  }

  const count = (xs: Array<number | boolean | null>) => xs.reduce<number>((k, x) => k + (x == null ? 0 : 1), 0);
  return {
    vsh, phit, phie, sw, net, endpoints, missing,
    counts: { vsh: count(vsh), phie: count(phie), sw: count(sw), net: count(net) },
  };
}

// ── calibration ──────────────────────────────────────────────────────────────

export interface Misfit {
  /** samples where BOTH ours and theirs are finite — the only ones comparable */
  n: number;
  rms: number;
  bias: number;      // mean(ours − theirs); positive = we read high
  /** coefficient of determination against the 1:1 line, not against a fitted line —
   *  we are asking "do we reproduce it", not "are we correlated with it" */
  r2: number;
}

/**
 * Compare a computed track with an interpreted one.
 *
 * Returns null when fewer than 8 samples overlap: an RMS over three points is a
 * number, not a calibration, and reporting it as one would be the whole failure
 * this module exists to avoid.
 */
export function misfit(ours: (number | null)[], theirs: (number | null)[] | undefined): Misfit | null {
  if (!theirs) return null;
  let n = 0, se = 0, sd = 0, sum = 0, sumT = 0;
  const len = Math.min(ours.length, theirs.length);
  for (let i = 0; i < len; i++) {
    const a = ours[i], b = theirs[i];
    if (!finite(a) || !finite(b)) continue;
    n++; se += (a - b) ** 2; sd += a - b; sum += a; sumT += b;
  }
  if (n < 8) return null;
  const meanT = sumT / n;
  let ssTot = 0;
  for (let i = 0; i < len; i++) {
    const a = ours[i], b = theirs[i];
    if (!finite(a) || !finite(b)) continue;
    ssTot += (b - meanT) ** 2;
  }
  return {
    n,
    rms: Math.sqrt(se / n),
    bias: sd / n,
    r2: ssTot > 0 ? 1 - se / ssTot : 0,
  };
}
