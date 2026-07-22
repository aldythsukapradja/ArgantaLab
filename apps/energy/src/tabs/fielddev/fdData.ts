// fdData.ts — resilient per-well petrophysics loader + derived helpers for the
// V1b/V1c viewers. Handles the wb log-slug quirks (19 BT2 / 19 SR) and wells that
// lack LFP curves. Uses the ported engine (petro/upscale) for all numerics.
import { loadLogs, loadPicks, loadIndex, wellSlug } from '../../wb/load';
import type { LogsJson, PicksJson, WbIndex, WellRow } from '../../wb/types';
import { vsh, phit, phie as phieFn, sw as swFn, zoneAverages, type VshMethod, type NetCutoffs } from '../../engine/petro';
import { upscaleWell, type UpscaleResult } from '../../engine/upscale';

// wb log filenames that don't match wellSlug(name).
const SLUG_ALIAS: Record<string, string> = { '19 BT2': '19-b-bt2', '19 SR': '19-s-sr' };

async function tryLoadLogs(well: string): Promise<LogsJson | null> {
  const cands = [wellSlug(well), SLUG_ALIAS[well]].filter(Boolean) as string[];
  for (const slug of cands) {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL || '/'}wb/logs-${slug}.json`);
      if (r.ok) return (await r.json()) as LogsJson;
    } catch { /* next */ }
  }
  // fall back to the standard loader (memoised) for the canonical slug
  try { return await loadLogs(well); } catch { return null; }
}

export interface HuginInterval { topMd: number; baseMd: number; topTvdss: number | null; baseTvdss: number | null }

/** Hugin Top/Base picks for a well (md-bounded interval), if present. */
export function huginInterval(picks: PicksJson, well: string): HuginInterval | null {
  const ps = picks.picks.filter((p) => p.well === well && /Hugin/i.test(p.surface));
  const top = ps.find((p) => /Top/i.test(p.surface));
  const base = ps.find((p) => /Base/i.test(p.surface));
  if (!top || !base) return null;
  return { topMd: top.md, baseMd: base.md, topTvdss: top.tvdss, baseTvdss: base.tvdss };
}

export interface WellPetro {
  well: WellRow;
  log: LogsJson;
  interval: HuginInterval | null;
  hasLFP: boolean;   // interpreted PHIE/SWE/VSH present
  hasSand: boolean;
}

/** Load a well's logs + Hugin interval. Returns null if no logs. */
export async function loadWellPetro(well: WellRow, picks: PicksJson): Promise<WellPetro | null> {
  const log = await tryLoadLogs(well.name);
  if (!log) return null;
  const c = log.curves;
  return {
    well, log,
    interval: huginInterval(picks, well.name),
    hasLFP: !!(c.PHIE && c.SWE && c.VSH),
    hasSand: !!c.SAND,
  };
}

export interface RecomputeParams {
  grMin: number; grMax: number; rw: number; rhoMa: number; rhoFl: number;
  a: number; m: number; n: number; phiSh: number; vshMethod: VshMethod;
}

/** Recompute VSH/PHIE/SW arrays via Archie from raw GR/RHOB/RT. */
export function recompute(log: LogsJson, p: RecomputeParams): { vsh: (number|null)[]; phie: (number|null)[]; sw: (number|null)[] } {
  const gr = log.curves.GR?.values ?? [];
  const rhob = log.curves.RHOB?.values ?? [];
  const rt = log.curves.RT?.values ?? [];
  const n = log.md.length;
  const oVsh: (number|null)[] = new Array(n).fill(null);
  const oPhie: (number|null)[] = new Array(n).fill(null);
  const oSw: (number|null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const g = gr[i], rb = rhob[i], r = rt[i];
    if (g == null || rb == null) continue;
    const vs = vsh(g, p.grMin, p.grMax, p.vshMethod);
    const pt = phit(rb, p.rhoMa, p.rhoFl);
    const pe = phieFn(pt, vs, p.phiSh);
    oVsh[i] = vs; oPhie[i] = pe;
    if (r != null && r > 0) oSw[i] = swFn(pe, r, p.a, p.m, p.n, p.rw);
  }
  return { vsh: oVsh, phie: oPhie, sw: oSw };
}

/** Interpreted (LFP) zone averages over the Hugin interval. */
export function interpretedZone(wp: WellPetro, cuts: NetCutoffs) {
  if (!wp.interval) return null;
  const c = wp.log.curves;
  return zoneAverages(wp.log.md, {
    vsh: c.VSH?.values, phie: c.PHIE?.values, sw: c.SWE?.values,
  }, wp.interval.topMd, wp.interval.baseMd, cuts);
}

/** Recomputed (Archie) zone averages over the Hugin interval. */
export function derivedZone(wp: WellPetro, rc: { vsh:(number|null)[]; phie:(number|null)[]; sw:(number|null)[] }, cuts: NetCutoffs) {
  if (!wp.interval) return null;
  return zoneAverages(wp.log.md, rc, wp.interval.topMd, wp.interval.baseMd, cuts);
}

/** Upscale a well over its Hugin interval (PHIE mean, net-SAND, majority facies). */
export function upscale(wp: WellPetro): UpscaleResult | null {
  if (!wp.interval) return null;
  const c = wp.log.curves;
  return upscaleWell(
    wp.log.md,
    c.PHIE?.values ?? [],
    c.SAND?.values ?? [],
    wp.interval.topMd, wp.interval.baseMd,
  );
}

export { loadPicks, loadIndex };
export type { PicksJson, WbIndex };
