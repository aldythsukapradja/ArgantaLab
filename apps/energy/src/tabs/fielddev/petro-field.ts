// petro-field.ts — the interpretation, run across EVERY logged bore.
//
// The single-well bench answers "what is this well". This answers "which well".
// Ranking the field's intervals by net metres is the question that actually drives a
// development decision, and it cannot be answered one well at a time.
//
// THE RULE THIS MODULE ENFORCES — read it before adding a consumer:
//
//   `stats`    ArgantaEnergy's OWN interpretation, from petro-compute.ts under the
//              current parameter set. This is the ONLY column anything forward —
//              static model, volumetrics, FDP — may consume.
//   `refStats` the delivery's own interpreted curves (Equinor's LFP on Volve), run
//              through the same zone averaging. It exists for QC: to show whether
//              our recompute reproduces a known answer. It is NEVER carried forward
//              into a model, and `forwardStats()` below is the only accessor a
//              downstream consumer should use, precisely so that mistake is hard.
//
// Mixing the two would produce a field model that is part ours and part theirs, with
// no way to tell which part is which — the exact failure the provenance vocabulary
// exists to prevent.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DigestedLog } from '../../dataqc/types';
import { readRecord } from '../../dataqc/readDigest';
import { depthToMetres } from '../../units';
import { zoneAverages, type ZoneAverages } from '../../engine/petro';
import type { WellRole } from '../../dataqc/curate';
import { runPetro, type PetroParams } from './petro-compute';
import { ZONE_TINTS } from './petro-well';
import { dedupePicks, type Workspace } from './workspace-model';

const wellKey = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

export interface FieldZoneRow {
  /** stable row id — bore + formation */
  id: string;
  well: string;
  boreKey: string;
  role: WellRole;
  /** the pick surface that tops this interval — the formation you are looking at */
  formation: string;
  top: number;
  base: number;
  tint: string;
  /** OURS. The only statistics anything downstream may use. */
  stats: ZoneAverages | null;
  /** THEIRS, for QC only — present only where the delivery ships an interpretation. */
  refStats: ZoneAverages | null;
}

/**
 * The forward-facing view of a row: our interpretation, and nothing else.
 *
 * Downstream consumers (static model, volumetrics, the FDP package) call THIS rather
 * than reading `.stats` directly, so that "which interpretation did the model use"
 * has one answer and one place to check it.
 */
export const forwardStats = (row: FieldZoneRow): ZoneAverages | null => row.stats;

export interface FieldZones {
  rows: FieldZoneRow[];
  /** bores processed so far / bores to process — a long run reports progress */
  done: number;
  total: number;
  running: boolean;
  /** bores that carry logs but produced no interval, with the reason */
  skipped: Array<{ well: string; why: string }>;
}

const EMPTY: FieldZones = { rows: [], done: 0, total: 0, running: false, skipped: [] };

/**
 * Run the current parameter set over every logged bore.
 *
 * Only starts when `enabled` — this reads and decompresses every log digest in the
 * delivery, which is real work, and doing it for a panel nobody opened would be a
 * cost with no reader. Digests are cached by readDigest, so a second pass under new
 * parameters re-runs the maths but not the I/O.
 *
 * Emits progressively: the table fills in as bores complete rather than staying
 * blank until the last one lands.
 */
export function useFieldZones(ws: Workspace, params: PetroParams, enabled: boolean): FieldZones {
  const [state, setState] = useState<FieldZones>(EMPTY);
  const runRef = useRef(0);

  const bores = useMemo(() => ws.bores.filter((b) => b.hasLogs && b.assetIds.log), [ws.bores]);

  useEffect(() => {
    if (!enabled || !bores.length) { setState(EMPTY); return; }
    const run = ++runRef.current;
    let cancelled = false;

    const rows: FieldZoneRow[] = [];
    const skipped: FieldZones['skipped'] = [];
    setState({ rows: [], done: 0, total: bores.length, running: true, skipped: [] });

    (async () => {
      for (let i = 0; i < bores.length; i++) {
        if (cancelled || runRef.current !== run) return;
        const bore = bores[i];
        try {
          const asset = ws.assets.find((a) => a.id === bore.assetIds.log);
          const log = asset ? await readRecord<DigestedLog>(asset) : null;
          if (!log?.md?.length) { skipped.push({ well: bore.name, why: 'log digest unreadable' }); continue; }

          const f = depthToMetres(1, log.depthUnit) ?? 1;
          const mdM = log.md.map((v) => v * f);
          const byFamily = (fa: string) => log.curves.find((c) => c.family === fa);
          const byMnem = (m: string) => log.curves.find((c) => c.mnemonic.toUpperCase() === m);

          const result = runPetro({
            md: mdM,
            gr: byFamily('GR')?.values,
            rt: (byFamily('RT') ?? byFamily('RXO'))?.values,
            rhob: byFamily('RHOB')?.values,
            nphi: byFamily('NPHI')?.values,
            dt: byFamily('DT')?.values,
            grMin: byMnem('GRMIN')?.values,
            grMax: byMnem('GRMAX')?.values,
          }, params);

          // theirs, run through the SAME averaging so the comparison is like-for-like
          const refVsh = byFamily('VSH')?.values;
          const refPhie = byFamily('PHIE')?.values;
          const refSw = byFamily('SW')?.values;
          const hasRef = !!(refPhie && refSw);

          // A deviated bore genuinely can cut the same surface twice — F-1 C meets
          // Hugin Base at 3504 m and again at 4004 m, and those are two real
          // intervals. But the delivery ALSO contains exact duplicates (F-14 carries
          // Hugin Top twice at the same MD), which are one pick filed twice. The
          // first is data; the second is a defect, and collapsing it here is the
          // difference between five intervals and six.
          const picks = dedupePicks(ws.picks
            .filter((p) => p.well && wellKey(p.well) === bore.key && p.md != null && Number.isFinite(p.md))
            .sort((a, b) => (a.md as number) - (b.md as number)));
          if (!picks.length) { skipped.push({ well: bore.name, why: 'no formation picks' }); continue; }

          const td = mdM[mdM.length - 1];
          picks.forEach((p, k) => {
            const top = p.md as number;
            const base = k + 1 < picks.length ? (picks[k + 1].md as number) : td;
            rows.push({
              // surface AND depth AND ordinal: the first two are the geology, the
              // third guarantees uniqueness whatever the delivery does
              id: `${bore.key}|${p.surface}|${Math.round(top)}|${k}`,
              well: bore.name, boreKey: bore.key, role: bore.role,
              formation: p.surface, top, base,
              tint: ZONE_TINTS[k % ZONE_TINTS.length],
              stats: zoneAverages(mdM, { vsh: result.vsh, phie: result.phie, sw: result.sw }, top, base, params.cutoffs),
              refStats: hasRef
                ? zoneAverages(mdM, { vsh: refVsh, phie: refPhie, sw: refSw }, top, base, params.cutoffs)
                : null,
            });
          });
        } catch {
          skipped.push({ well: bore.name, why: 'interpretation failed' });
        }
        if (cancelled || runRef.current !== run) return;
        // publish as we go — a 24-bore run should fill in, not block
        setState({
          rows: [...rows], done: i + 1, total: bores.length,
          running: i + 1 < bores.length, skipped: [...skipped],
        });
        // yield so the parameter rail stays responsive mid-run
        await new Promise((r) => setTimeout(r, 0));
      }
    })().catch(() => {
      if (!cancelled && runRef.current === run) {
        setState((s) => ({ ...s, running: false }));
      }
    });

    return () => { cancelled = true; };
  }, [enabled, bores, ws.assets, ws.picks, params]);

  return state;
}

/** Rank by net metres — the question the field-wide table exists to answer. Rows the
 *  interpretation could not evaluate sort last rather than as zero, because "no net"
 *  and "not evaluable" are different findings. */
export function rankByNet(rows: FieldZoneRow[]): FieldZoneRow[] {
  return [...rows].sort((a, b) => {
    const an = a.stats?.nSamples ? a.stats.netM : -1;
    const bn = b.stats?.nSamples ? b.stats.netM : -1;
    return bn - an
      || (b.stats?.ntg ?? 0) - (a.stats?.ntg ?? 0)
      || a.well.localeCompare(b.well, 'en', { numeric: true });
  });
}
