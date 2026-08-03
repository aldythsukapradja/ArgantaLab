// petro.ts — shared, deterministic petrophysical screening heuristics.
// Used by LogViewer (per-depth track annotations) and TrajectoryViewer (path
// coloring) so both read the same call at the same depth. These are QUICK-LOOK
// SCREENING FLAGS derived from log curves — never a saturation or lithology
// MODEL — callers must keep labelling them as such in the UI.
import type { DigestedLog } from './types.ts';
import { depthToMetres } from '../units';

export type Fluid = 'gas' | 'oil' | null;
export type Litho = 'sand' | 'shale' | null;

/** Binary-search sample of a curve at an arbitrary depth. Never interpolates
 *  across a null gap — a missing sample stays missing. */
export function sampleAt(mdM: number[], values: (number | null)[], m: number): number {
  const n = mdM.length;
  if (!n) return NaN;
  if (m <= mdM[0]) return values[0] ?? NaN;
  if (m >= mdM[n - 1]) return values[n - 1] ?? NaN;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (mdM[mid] <= m) lo = mid; else hi = mid; }
  const v0 = values[lo], v1 = values[hi];
  if (v0 == null || v1 == null) return NaN;
  const t = (m - mdM[lo]) / ((mdM[hi] - mdM[lo]) || 1);
  return v0 + (v1 - v0) * t;
}

// ── lithology (sand/shale) from GR ───────────────────────────────────────────
/** A well's own P10/P90 GR values as the clean-sand / pure-shale endpoints —
 *  the linear gamma-ray index calibrates to THIS well, not a fixed API cutoff
 *  that would misfire in a different basin. */
export function grEndpoints(gr: (number | null)[]): { clean: number; shale: number } | null {
  const vs = gr.filter((v): v is number => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  if (!vs.length) return null;
  const clean = vs[Math.floor(vs.length * 0.1)];
  const shale = vs[Math.floor(vs.length * 0.9)];
  return shale > clean ? { clean, shale } : null;
}

/** Linear gamma-ray index (a Vsh proxy) — sand below the cutoff, shale above.
 *  0.4 Vsh is a conventional net-to-gross screening cutoff, not a lab result. */
export function classifyLitho(grValue: number, endpoints: { clean: number; shale: number } | null): Litho {
  if (!Number.isFinite(grValue) || !endpoints) return null;
  const igr = (grValue - endpoints.clean) / (endpoints.shale - endpoints.clean);
  const vsh = Math.max(0, Math.min(1, igr));
  return vsh <= 0.4 ? 'sand' : 'shale';
}

// ── fluid (gas/oil) from resistivity + density-neutron crossover ────────────
const SAND_MATRIX_RHOB = 2.65; // g/cc — quick-look sandstone matrix default
const FLUID_RHOB = 1.0;        // g/cc — pore fluid, close enough for a screening density-porosity
const CROSSOVER_PU = 0.08;     // 8 porosity units — a genuinely significant crossover, not curve noise
const ELEVATED_RT_MULT = 3;    // "elevated" = 3x the well's own wet/shale-baseline resistivity

/** Apparent density-neutron porosity separation (phiD − NPHI). Positive and
 *  large ⇒ the classic gas-effect crossover; small/negative is normal in a
 *  wet or oil-bearing zone (a few p.u. of separation there is lithology and
 *  log noise, not gas — this was previously mis-tuned and over-called gas on
 *  Volve, an oil field, hence the explicit 8 p.u. cutoff below). */
export function densityNeutronSeparation(rhob: number, nphi: number): number {
  const phiD = (SAND_MATRIX_RHOB - rhob) / (SAND_MATRIX_RHOB - FLUID_RHOB);
  return phiD - nphi;
}

/** One well-wide baseline: the 20th percentile of its own Rt log, a proxy for
 *  the wet/shale background reading that "elevated" is measured against. */
export function rtBaseline(rt: (number | null)[]): number | null {
  const vs = rt.filter((v): v is number => v != null && Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (!vs.length) return null;
  return vs[Math.floor(vs.length * 0.2)];
}

/** Classify fluid at one depth: needs elevated resistivity to call ANY
 *  hydrocarbon at all (oil and gas both elevate Rt vs a wet baseline — Rt
 *  alone can't tell them apart). Within that, only a genuinely large
 *  density-neutron separation calls gas; anything less reads as oil. */
export function classifyFluid(rhob: number, nphi: number, rt: number, baseline: number | null): Fluid {
  if (!Number.isFinite(rt) || baseline == null || !(rt > baseline * ELEVATED_RT_MULT)) return null;
  if (!Number.isFinite(rhob) || !Number.isFinite(nphi)) return null;
  return densityNeutronSeparation(rhob, nphi) > CROSSOVER_PU ? 'gas' : 'oil';
}

// ── whole-log fluid profile, for callers (TrajectoryViewer) that need to
// color a path by depth rather than annotate one track ──────────────────────
export interface FluidProfile { mdM: number[]; fluid: Fluid[] }

/** Runs classifyFluid across every sample of a digested log, in metres. Returns
 *  null if the log lacks the RHOB/NPHI/RT trio the heuristic needs. */
export function buildFluidProfile(log: DigestedLog): FluidProfile | null {
  const rt = log.curves.find((c) => c.family === 'RT') ?? log.curves.find((c) => c.family === 'RXO');
  const rhob = log.curves.find((c) => c.family === 'RHOB');
  const nphi = log.curves.find((c) => c.family === 'NPHI');
  if (!rt || !rhob || !nphi) return null;
  const f = depthToMetres(1, log.depthUnit) ?? 1;
  const mdM = log.md.map((v) => v * f);
  const baseline = rtBaseline(rt.values);
  const fluid = mdM.map((_, i) => classifyFluid(rhob.values[i] ?? NaN, nphi.values[i] ?? NaN, rt.values[i] ?? NaN, baseline));
  return { mdM, fluid };
}

/** Nearest-neighbor fluid lookup at an arbitrary depth — fluid is categorical,
 *  so unlike sampleAt this never interpolates between two different classes. */
export function nearestFluid(profile: FluidProfile, m: number): Fluid {
  const { mdM, fluid } = profile;
  const n = mdM.length;
  if (!n) return null;
  if (m <= mdM[0]) return fluid[0];
  if (m >= mdM[n - 1]) return fluid[n - 1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (mdM[mid] <= m) lo = mid; else hi = mid; }
  return m - mdM[lo] <= mdM[hi] - m ? fluid[lo] : fluid[hi];
}
