// data.ts — Reservoir-Management data adapter. Loads REAL Volve production/injection/
// pressure (wb/*.json) and derives the surveillance/diagnostic series every RM tab
// consumes, reusing engine/surveillance.ts. Units: source is Sm³/bara; we present in
// field units (bbl/bopd/scf/psi) to match the founder's reference templates, but VRR is
// unitless (computed on Sm³ voidage). Deterministic; no fabrication.
import { loadIndex, loadProd, loadProdField, loadPatterns, wellSlug } from '../../wb/load';
import type { WbIndex, ProdJson, ProdMonth, PatternsJson, WellRole } from '../../wb/types';
import { cumulativeVrr, waterCut, gor as gorFn, type MonthVols } from '../../engine/surveillance';

export const SM3_TO_BBL = 6.2898;
export const SM3GAS_TO_SCF = 35.3147;
export const BARA_TO_PSI = 14.5038;

/** Index of the last month a well was actually producing (oil rate > 0) — skips the
 *  trailing zero months a field carries after shut-in (Volve: Oct–Dec 2016). */
export function lastLiveIdx(w: RMWellSeries): number {
  for (let i = w.oilRate.length - 1; i >= 0; i--) if (w.oilRate[i] > 0) return i;
  return Math.max(0, w.oilRate.length - 1);
}

export function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
/** Whole-month index → days since first month start (for Chan's log-time axis). */
function monthDays(months: ProdMonth[]): number[] {
  const out: number[] = []; let acc = 0;
  for (let i = 0; i < months.length; i++) { out.push(acc + daysInMonth(months[i].ym) / 2); acc += daysInMonth(months[i].ym); }
  return out;
}

export interface RMWellSeries {
  well: string; role: WellRole;
  raw: ProdMonth[];
  ym: string[]; t: number[];
  oilRate: number[]; waterRate: number[]; gasRate: number[]; liqRate: number[]; injRate: number[];
  cumOil: number[]; cumWinj: number[]; cumLiquid: number[];
  wct: number[]; wor: number[]; gor: number[];
  bhp: Array<number | null>; thp: Array<number | null>; uptime: Array<number | null>;
  hall: number[];
  vrr: { cum: number[]; inst: number[]; final: number };
  cumOilMM: number; cumWinjMM: number;
}

/** Derive every diagnostic series for one well (or the field aggregate) from ProdMonth[]. */
export function buildWellSeries(p: ProdJson, role: WellRole = 'producer'): RMWellSeries {
  const M = p.monthly;
  const t = monthDays(M);
  const oilRate: number[] = [], waterRate: number[] = [], gasRate: number[] = [], liqRate: number[] = [], injRate: number[] = [];
  const cumOil: number[] = [], cumWinj: number[] = [], cumLiquid: number[] = [];
  const wct: number[] = [], wor: number[] = [], gor: number[] = [];
  const bhp: Array<number | null> = [], thp: Array<number | null> = [], uptime: Array<number | null> = [];
  const hall: number[] = [];
  let co = 0, cw = 0, cl = 0, hallAcc = 0, lastThp = 0;
  for (let i = 0; i < M.length; i++) {
    const m = M[i], d = daysInMonth(m.ym);
    const oilB = m.oil * SM3_TO_BBL, watB = m.water * SM3_TO_BBL, wiB = m.wi * SM3_TO_BBL, gasScf = m.gas * SM3GAS_TO_SCF;
    oilRate.push(oilB / d); waterRate.push(watB / d); gasRate.push(gasScf / 1000 / d); liqRate.push((oilB + watB) / d); injRate.push(wiB / d);
    co += oilB; cw += wiB; cl += oilB + watB;
    cumOil.push(co / 1e6); cumWinj.push(cw / 1e6); cumLiquid.push(cl / 1e6);
    wct.push(waterCut(m.oil, m.water) * 100);
    wor.push(Math.max(1e-3, m.water / Math.max(1e-9, m.oil)));
    gor.push(m.oil > 0 ? gorFn(gasScf, oilB) : 0);
    const b = m.bhp != null ? m.bhp * BARA_TO_PSI : null, th = m.thp != null ? m.thp * BARA_TO_PSI : null;
    bhp.push(b); thp.push(th); uptime.push(m.uptime ?? null);
    // Hall integral uses THP (reference convention), forward-filled, ×Δt
    if (th != null && th > 0) lastThp = th;
    if (lastThp > 0) hallAcc += lastThp * d;
    hall.push(hallAcc);
  }
  const vols: MonthVols[] = M.map((m) => ({ oil: m.oil, water: m.water, wi: m.wi }));
  return {
    well: p.well, role, raw: M, ym: M.map((m) => m.ym), t,
    oilRate, waterRate, gasRate, liqRate, injRate,
    cumOil, cumWinj, cumLiquid, wct, wor, gor, bhp, thp, uptime, hall,
    vrr: cumulativeVrr(vols),
    cumOilMM: co / 1e6, cumWinjMM: cw / 1e6,
  };
}

export interface RMData {
  index: WbIndex;
  field: RMWellSeries;
  wells: RMWellSeries[];               // producers + injectors with production
  producers: RMWellSeries[];
  injectors: RMWellSeries[];
  patterns: PatternsJson;
  byWell: Record<string, RMWellSeries>;
}

/** Load the full Reservoir-Management dataset (field + every produced/injected well). */
export async function loadRMData(): Promise<RMData> {
  const [index, field, patterns] = await Promise.all([loadIndex(), loadProdField(), loadPatterns().catch(() => ({ dataNature: 'derived', method: '', injectors: [], producers: [], patterns: [] } as PatternsJson))]);
  const roleOf = new Map(index.wells.map((w) => [w.name, w.role] as const));
  const names = index.wells.filter((w) => w.has.production).map((w) => w.name);
  const wells: RMWellSeries[] = [];
  for (const name of names) {
    try { const p = await loadProd(name); wells.push(buildWellSeries(p, roleOf.get(name) ?? 'producer')); } catch { /* skip */ }
  }
  const byWell: Record<string, RMWellSeries> = {};
  for (const w of wells) byWell[w.well] = w;
  return {
    index, patterns,
    field: buildWellSeries(field, 'both'),
    wells,
    producers: wells.filter((w) => w.role === 'producer' || w.role === 'both'),
    injectors: wells.filter((w) => w.role === 'injector'),
    byWell,
  };
}

/** slug helper re-export for consumers that key by file token. */
export { wellSlug };
