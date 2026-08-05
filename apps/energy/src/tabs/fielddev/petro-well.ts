// petro-well.ts — one interpretation per (bore × parameters), shared.
//
// The bench draws it, the zone strip summarises it, the crossplots will project it.
// If each of those loaded the digest and ran the maths itself they would eventually
// disagree — and worse, they would disagree only under parameter changes, which is
// the hardest kind of disagreement to notice. So it is computed ONCE, here, and
// passed down.
//
// Depth is normalised to metres on the way in (the Volve bundle has a well filed in
// mm), because every consumer downstream — picks, zone averages, the contact — is in
// metres and a unit mismatch here would be silent.
import { useEffect, useMemo, useState } from 'react';
import type { DigestedCurve, DigestedLog } from '../../dataqc/types';
import { readRecord } from '../../dataqc/readDigest';
import { depthToMetres } from '../../units';
import { zoneAverages, type ZoneAverages } from '../../engine/petro';
import { runPetro, misfit, type Misfit, type NetCutoffs, type PetroParams, type PetroResult } from './petro-compute';
import { dedupePicks, type Workspace, type WorkspaceBore, type WorkspacePick } from './workspace-model';

/** The curve families the bench and the compute layer both reach for. */
export interface PetroFamilies {
  gr?: DigestedCurve; rt?: DigestedCurve; rhob?: DigestedCurve;
  nphi?: DigestedCurve; dt?: DigestedCurve;
  grMin?: DigestedCurve; grMax?: DigestedCurve;
  /** the delivery's OWN interpreted answer, where it ships one */
  refPhie?: DigestedCurve; refSw?: DigestedCurve; refVsh?: DigestedCurve;
  /** the delivery's permeability log, when it ships one — drives the per-sample
   *  cementation exponent m = a·k^b that this field's evaluation publishes */
  klogh?: DigestedCurve;
}

/** One interval between consecutive picks — what a zone actually is. */
export interface Zone {
  name: string;
  top: number;
  base: number;
  tint: string;
  /** net-weighted statistics over the interval, from the truth-locked engine */
  stats: ZoneAverages | null;
}

export const ZONE_TINTS = ['#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#ef4444', '#06b6d4', '#84cc16', '#f472b6'];

export interface PetroWell {
  bore: WorkspaceBore | null;
  log: DigestedLog | null;
  loading: boolean;
  /** depth index in METRES, whatever the file declared */
  mdM: number[];
  fam: PetroFamilies;
  result: PetroResult | null;
  zones: Zone[];
  range: { lo: number; hi: number };
  /** how well our recompute reproduces the delivery's own interpretation */
  fit: { vsh: Misfit | null; phie: Misfit | null; sw: Misfit | null } | null;
}

const wellKey = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Build the zone column from a bore's own picks.
 *
 * The deepest pick has no base, so it closes on the log's own TD — a zone running
 * off the bottom is drawn to the bottom, never to an invented base. Picks shallower
 * than the log or deeper than TD are kept: they are real picks, and clipping them
 * silently would hide that the log does not cover the whole bore.
 */
export function buildZones(
  picks: WorkspacePick[], tdM: number, result: PetroResult | null, mdM: number[],
  cutoffs: NetCutoffs,
): Zone[] {
  const sorted = dedupePicks(picks
    .filter((p) => p.md != null && Number.isFinite(p.md))
    .sort((a, b) => (a.md as number) - (b.md as number)));
  return sorted.map((p, i) => {
    const top = p.md as number;
    const base = i + 1 < sorted.length ? (sorted[i + 1].md as number) : tdM;
    return {
      name: p.surface, top, base,
      tint: ZONE_TINTS[i % ZONE_TINTS.length],
      // the LIVE cutoffs, not the engine's defaults — a strip that averaged against
      // a different cutoff than the ribbon draws would be two answers on one screen
      stats: result && mdM.length
        ? zoneAverages(mdM, { vsh: result.vsh, phie: result.phie, sw: result.sw }, top, base, cutoffs)
        : null,
    };
  });
}

export function usePetroWell(ws: Workspace, bore: WorkspaceBore | null, params: PetroParams): PetroWell {
  const [log, setLog] = useState<DigestedLog | null>(null);
  const [loading, setLoading] = useState(false);

  const logAssetId = bore?.assetIds.log;
  useEffect(() => {
    const asset = logAssetId ? ws.assets.find((a) => a.id === logAssetId) : null;
    if (!asset) { setLog(null); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    readRecord<DigestedLog>(asset)
      .then((l) => { if (alive) { setLog(l ?? null); setLoading(false); } })
      .catch(() => { if (alive) { setLog(null); setLoading(false); } });
    return () => { alive = false; };
  }, [logAssetId, ws.assets]);

  const fam: PetroFamilies = useMemo(() => {
    const byFamily = (f: string) => log?.curves.find((c) => c.family === f);
    const byMnem = (m: string) => log?.curves.find((c) => c.mnemonic.toUpperCase() === m);
    return {
      gr: byFamily('GR'), rt: byFamily('RT') ?? byFamily('RXO'), rhob: byFamily('RHOB'),
      nphi: byFamily('NPHI'), dt: byFamily('DT'),
      grMin: byMnem('GRMIN'), grMax: byMnem('GRMAX'),
      refPhie: byFamily('PHIE'), refSw: byFamily('SW'), refVsh: byFamily('VSH'),
      klogh: byMnem('KLOGH') ?? byFamily('KLOGH'),
    };
  }, [log]);

  const mdM = useMemo(() => {
    if (!log) return [];
    const f = depthToMetres(1, log.depthUnit) ?? 1;
    return log.md.map((v) => v * f);
  }, [log]);

  const range = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (const v of mdM) { if (!Number.isFinite(v)) continue; if (v < lo) lo = v; if (v > hi) hi = v; }
    return Number.isFinite(lo) ? { lo, hi } : { lo: 0, hi: 1 };
  }, [mdM]);

  const result = useMemo(() => {
    if (!log || !mdM.length) return null;
    return runPetro({
      md: mdM,
      gr: fam.gr?.values, rt: fam.rt?.values, rhob: fam.rhob?.values,
      nphi: fam.nphi?.values, dt: fam.dt?.values,
      grMin: fam.grMin?.values, grMax: fam.grMax?.values,
      refPhie: fam.refPhie?.values, refSw: fam.refSw?.values, refVsh: fam.refVsh?.values,
      klogh: fam.klogh?.values,
    }, params);
  }, [log, mdM, fam, params]);

  const zones = useMemo(() => {
    if (!bore || !range.hi) return [];
    const mine = ws.picks.filter((p) => p.well && wellKey(p.well) === bore.key);
    return buildZones(mine, range.hi, result, mdM, params.cutoffs);
  }, [ws.picks, bore, range.hi, result, mdM, params.cutoffs]);

  const fit = useMemo(() => (result ? {
    vsh: misfit(result.vsh, fam.refVsh?.values),
    phie: misfit(result.phie, fam.refPhie?.values),
    sw: misfit(result.sw, fam.refSw?.values),
  } : null), [result, fam]);

  return { bore, log, loading, mdM, fam, result, zones, range, fit };
}
