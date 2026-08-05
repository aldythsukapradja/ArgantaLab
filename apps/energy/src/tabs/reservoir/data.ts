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
  // The universe RM cares about is every wellbore with a PRODUCING OR INJECTING ROLE, plus
  // anything carrying a series — not just `has.production`. Volve files some volumes
  // against a shallow mother bore that cannot be the source (F-11, TD 347 m); the wb build
  // re-attributes those to the deepest terminal bore (F-11 B, TD 4,770 m) and records the
  // reasoning. So we DROP the bore the volumes were merely filed against, and read the
  // series from `metrics.filedOn` for the bore that actually flowed. Role-only producers
  // with no series at all (F-15 C) are still listed — honestly, with no numbers invented.
  const universe = index.wells.filter((w) => !w.metricsFiledElsewhere
    && (w.has.production || w.metrics || /produc|inject/i.test(w.role)));
  const wells: RMWellSeries[] = [];
  for (const w of universe) {
    const src = w.has.production ? w.name : w.metrics?.filedOn ?? null;
    if (src) {
      try {
        const p = await loadProd(src);
        const s = buildWellSeries(p, w.role);
        s.well = w.name;              // the bore that actually flowed, not the filing bore
        wells.push(s);
        continue;
      } catch { /* fall through to the no-series card */ }
    }
    wells.push(emptySeries(w.name, w.role));
  }
  const byWell: Record<string, RMWellSeries> = {};
  for (const w of wells) byWell[w.well] = w;
  return {
    index, patterns,
    field: buildWellSeries(field, 'both'),
    wells,
    // Classify by MEANING, not by an exact literal. The wb index has carried at least two
    // role vocabularies ('producer'/'injector'/'both' and 'oil-producer'/'water-injector'/
    // 'observation'), and an exact match silently emptied both lists when the build
    // changed. Falling back to the actual series (did it ever produce / inject?) means a
    // brand-new role string can never blank the watchlist again.
    producers: wells.filter(isProducer),
    injectors: wells.filter(isInjector),
    byWell,
  };
}

/** A wellbore that is on the books as a producer/injector but carries no series at all.
 *  Rendered as an explicit "no production record" card — never dropped, never zero-filled. */
export function emptySeries(well: string, role: WellRole): RMWellSeries {
  return {
    well, role, raw: [], ym: [], t: [],
    oilRate: [], waterRate: [], gasRate: [], liqRate: [], injRate: [],
    cumOil: [], cumWinj: [], cumLiquid: [], wct: [], wor: [], gor: [],
    bhp: [], thp: [], uptime: [], hall: [],
    vrr: { cum: [], inst: [], final: 0 }, cumOilMM: 0, cumWinjMM: 0,
  };
}

/** Producer if the role says so, or — whatever the role string — if it actually made oil. */
export function isProducer(w: RMWellSeries): boolean {
  if (/inject/i.test(w.role) && !/both/i.test(w.role)) return false;
  return /produc|both/i.test(w.role) || w.cumOilMM > 0;
}
/** Injector if the role says so, or if it actually took water. */
export function isInjector(w: RMWellSeries): boolean {
  return /inject|both/i.test(w.role) || w.cumWinjMM > 0;
}

/** slug helper re-export for consumers that key by file token. */
export { wellSlug };
