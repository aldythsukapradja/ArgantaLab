// explore.ts — the exploration decision engine: geological chance of success
// (GCoS = Π of element chance factors), risked in-place / recoverable resource by
// seeded Monte-Carlo, and expected monetary value (EMV). Deterministic + stochastic,
// reusing the V1 volumetric / MC core — the transparent GeoX/Trinity screening
// backbone, NOT the enterprise stack. Data-nature: chance factors = interpreted;
// deterministic volumes = derived; MC distributions, POS-weighting & EMV = scenario.
//
// Refs: GeoX POS decomposition (SLB); prospect risking = independent play/prospect
// chance factors multiplied (Rose 2001, "Risk Analysis and Management of Petroleum
// Exploration Ventures", AAPG). EMV = Newendorp & Schuyler, "Decision Analysis for
// Petroleum Exploration". Grounded in the real Volve 15/9-19 discovery.

import { monteCarlo, type McInput, type McResult } from './mc.ts';
import { stoiip } from './volumetrics.ts';

// ── Geological Chance of Success (GCoS) — GeoX-style 5-element decomposition ──────
export type GcosKey = 'reservoir' | 'trap' | 'seal' | 'charge' | 'timing';

export interface GcosElement { key: GcosKey; label: string; note: string }

/** The 5 independent play/prospect chance factors (Rose/GeoX convention), each
 *  grounded in the real Volve petroleum system (Draupne source → Hugin reservoir). */
export const GCOS_ELEMENTS: GcosElement[] = [
  { key: 'reservoir', label: 'Reservoir presence & quality', note: 'Hugin Fm shallow-marine sst — penetrated & productive at Volve (φ ~0.22, N/G ~0.9).' },
  { key: 'trap',      label: 'Trap / closure',               note: 'Faulted dome on the Sleipner Terrace — mapped four-way with fault dependence.' },
  { key: 'seal',      label: 'Top & fault seal',             note: 'Heather/Draupne shales + the Base Cretaceous Unconformity as regional top seal.' },
  { key: 'charge',    label: 'Source & charge',              note: 'Draupne is early-mature locally → charge from the deep Viking Graben kitchen.' },
  { key: 'timing',    label: 'Migration & timing',           note: 'Trap must pre-date charge; migration access from the kitchen into the Hugin trap.' },
];

/** POS = Π(element chance factors), each clamped to [0,1]. Independent factors
 *  (the transparent GeoX decomposition — dependency modelling is out of scope). */
export function gcos(factors: Array<{ p: number }>): number {
  return factors.reduce((acc, f) => acc * Math.max(0, Math.min(1, f.p)), 1);
}

// ── Risked resource — seeded Monte-Carlo over the volumetric inputs ───────────────
/** The uncertain volumetric inputs for a prospect. `bo` (FVF) is a deterministic
 *  point value (small uncertainty vs the geometric/property terms). */
export interface ProspectMc {
  grv: McInput;   // gross rock volume, m³ (area-depth / closure)
  ntg: McInput;   // net-to-gross, fraction
  phi: McInput;   // porosity, fraction
  sw: McInput;    // water saturation, fraction
  rf: McInput;    // recovery factor, fraction
  bo: number;     // oil FVF (rm³/sm³)
}

export interface RiskedResult {
  inPlace: McResult;      // STOIIP (Sm³) distribution — GIVEN a discovery (unrisked)
  recoverable: McResult;  // recoverable STOIIP·RF (Sm³) — given a discovery
  pos: number;            // chance of success (0..1)
  meanSuccess: number;    // mean recoverable | success (Sm³)
  riskedMean: number;     // pos · meanSuccess (Sm³) — the risked expectation
}

/**
 * riskedResource — run n seeded realizations of the volumetric chain and return the
 * in-place + recoverable distributions (P90/P50/P10 via monteCarlo's oil convention),
 * plus the POS-weighted risked mean. Same seed ⇒ identical, reproducible result.
 */
export function riskedResource(mc: ProspectMc, pos: number, n = 10000, seed = 0xC05704): RiskedResult {
  const inputs: McInput[] = [mc.grv, mc.ntg, mc.phi, mc.sw, mc.rf];
  const st = (v: Record<string, number>) => stoiip(v[mc.grv.key], v[mc.ntg.key], v[mc.phi.key], v[mc.sw.key], mc.bo);
  const inPlace = monteCarlo(inputs, st, n, seed);
  const recoverable = monteCarlo(inputs, (v) => st(v) * v[mc.rf.key], n, seed);
  const meanSuccess = recoverable.mean;
  return { inPlace, recoverable, pos, meanSuccess, riskedMean: Math.max(0, Math.min(1, pos)) * meanSuccess };
}

// ── Expected Monetary Value (EMV) ────────────────────────────────────────────────
export interface EmvInput {
  pos: number;          // chance of success (0..1)
  npvSuccess: number;   // NPV of the discovery case ($)
  dryHoleCost: number;  // cost of a dry hole ($, positive)
}

/** EMV = POS·NPV(success) − (1−POS)·dry-hole cost (Newendorp two-outcome tree). */
export function emv({ pos, npvSuccess, dryHoleCost }: EmvInput): number {
  const p = Math.max(0, Math.min(1, pos));
  return p * npvSuccess - (1 - p) * dryHoleCost;
}

/** Value of information sanity: a prospect is drill-worthy when EMV > 0. */
export const isDrillWorthy = (e: EmvInput): boolean => emv(e) > 0;

// ── Prospect portfolio ranking (creaming / drill-ready inventory) ─────────────────
export interface RankedProspect { id: string; name: string; pos: number; riskedMean: number; emv: number }

/** Rank a prospect inventory by EMV desc, then risked resource — the auto-generated
 *  "Exploration Portfolio Review" ordering. */
export function rankProspects(ps: RankedProspect[]): RankedProspect[] {
  return ps.slice().sort((a, b) => (b.emv - a.emv) || (b.riskedMean - a.riskedMean));
}
