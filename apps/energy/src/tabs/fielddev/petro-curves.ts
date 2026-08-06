// petro-curves.ts — the interpretation, run across every bore, KEPT AS CURVES.
//
// useFieldZones already runs the same parameter set field-wide, but it reduces
// each bore to zone statistics. The correlation panel needs what that reduction
// throws away: the curves themselves, sample by sample, so they can be drawn.
//
// WHY THIS MATTERS FOR CORRELATION. Volve delivers PHIE, SWE and VSH in three of
// twenty-four bores — the LFP-interpreted wells. A panel drawn from DELIVERED
// curves would therefore be three columns of logs and twenty-one blanks, which
// says nothing about the field. Drawn from OURS it is twenty-four columns of the
// same interpretation under the same parameters, which is the only version of
// this panel that can be correlated at all.
//
// The delivered curves are still carried, per bore, as `ref` — never merged,
// never averaged, never substituted. Where a bore has both, the panel can show
// ours against theirs and the difference is visible rather than reconciled away.
import { useEffect, useMemo, useRef, useState } from 'react';
import { readRecord } from '../../dataqc/readDigest';
import type { DigestedLog } from '../../dataqc/types';
import { depthToMetres } from '../../units';
import { runPetro, type PetroParams } from './petro-compute';
import { dedupePicks } from './workspace-model';
import { wellKey } from './well-paths';
import type { Workspace, WorkspaceBore } from './workspace';
import type { WellRole } from '../../dataqc/curate';

export interface BoreCurveSet {
  well: string;
  boreKey: string;
  role: WellRole;
  md: number[];
  /** OURS — computed here, under the parameter set the rail is showing */
  vsh: (number | null)[];
  phie: (number | null)[];
  sw: (number | null)[];
  net: (boolean | null)[];
  /** raw, for the GR track */
  gr: (number | null)[] | undefined;
  /**
   * EVERY delivered curve on this bore, keyed by FAMILY, kept aligned with the
   * interpretation.
   *
   * It was four named fields and that was the bug. The Input tree lists the
   * seventeen curve families the delivery actually carries, and a panel that can
   * only draw four of them makes thirteen of those rows a click that does
   * nothing — which reads, correctly, as "the tree is not connected".
   *
   * Keyed by family so a tick on the tree row reaches the curve directly: the
   * tree's key IS the family (see workspace-model.buildCurveTypes). One decode
   * serves both halves — reading the digests a second time for the raw curves
   * could disagree with the interpretation about which sample is which.
   */
  raw: Record<string, (number | null)[] | undefined>;
  /** THEIRS, where the delivery ships an interpretation. QC only. */
  ref: { phie?: (number | null)[]; sw?: (number | null)[]; vsh?: (number | null)[] };
  /**
   * Picks on this bore. `md` is what the correlation lines join; `tvdss` is
   * carried because it is the ONLY bridge this panel has between a contact
   * (published in TVDSS) and an MD track. Fitting md↔tvdss from a bore's own
   * picks needs no KB elevation and no survey — it uses the delivery's own two
   * readings of the same surface.
   */
  picks: Array<{ surface: string; md: number; tvdss?: number | null }>;
}

export interface FieldCurves {
  bores: BoreCurveSet[];
  done: number;
  total: number;
  running: boolean;
  skipped: Array<{ well: string; why: string }>;
}

const EMPTY: FieldCurves = { bores: [], done: 0, total: 0, running: false, skipped: [] };

/** Every curve keyed by family, first writer wins — a family-resolved curve
 *  beats a raw mnemonic, the same precedence petro-cloud uses. */
function rawByFamily(
  curves: Array<{ mnemonic: string; family?: string | null; values: (number | null)[] }>,
): Record<string, (number | null)[] | undefined> {
  const out: Record<string, (number | null)[] | undefined> = {};
  for (const c of curves) {
    const key = (c.family ?? c.mnemonic).toUpperCase();
    if (!out[key]) out[key] = c.values;
  }
  return out;
}

export function useFieldCurves(ws: Workspace, params: PetroParams, enabled: boolean): FieldCurves {
  const [state, setState] = useState<FieldCurves>(EMPTY);
  const runRef = useRef(0);

  const logged = useMemo(
    () => ws.bores.filter((b: WorkspaceBore) => b.hasLogs && b.assetIds.log),
    [ws.bores],
  );

  useEffect(() => {
    if (!enabled || !logged.length) { setState(EMPTY); return; }
    const run = ++runRef.current;
    let cancelled = false;
    setState({ bores: [], done: 0, total: logged.length, running: true, skipped: [] });

    (async () => {
      const bores: BoreCurveSet[] = [];
      const skipped: FieldCurves['skipped'] = [];

      for (let i = 0; i < logged.length; i++) {
        if (cancelled || runRef.current !== run) return;
        const bore = logged[i];
        try {
          const asset = ws.assets.find((a) => a.id === bore.assetIds.log);
          const log = asset ? await readRecord<DigestedLog>(asset) : null;
          if (!log?.md?.length) { skipped.push({ well: bore.name, why: 'log digest unreadable' }); continue; }

          const f = depthToMetres(1, log.depthUnit) ?? 1;
          const md = log.md.map((v) => v * f);
          const byFamily = (fa: string) => log.curves.find((c) => c.family === fa);
          const byMnem = (m: string) => log.curves.find((c) => c.mnemonic.toUpperCase() === m);

          // the SAME entry point the bench and the zonation use — one interpretation
          const res = runPetro({
            md,
            gr: byFamily('GR')?.values,
            rt: (byFamily('RT') ?? byFamily('RXO'))?.values,
            rhob: byFamily('RHOB')?.values,
            nphi: byFamily('NPHI')?.values,
            dt: byFamily('DT')?.values,
            grMin: byMnem('GRMIN')?.values,
            grMax: byMnem('GRMAX')?.values,
          }, params);

          bores.push({
            well: bore.name,
            boreKey: bore.key,
            role: bore.role,
            md,
            vsh: res.vsh, phie: res.phie, sw: res.sw, net: res.net,
            gr: byFamily('GR')?.values,
            raw: rawByFamily(log.curves),
            ref: {
              phie: byMnem('PHIE')?.values,
              sw: (byMnem('SWE') ?? byMnem('SW'))?.values,
              vsh: byMnem('VSH')?.values,
            },
            // WorkspaceBore.tops carries surface NAMES only; the picks with a depth
            // live on the workspace, so they are matched here on the normalised
            // well name — the same key the rest of the suite joins bores on.
            picks: dedupePicks(
              ws.picks
                .filter((p) => p.well && wellKey(p.well) === wellKey(bore.name)
                  && p.md != null && Number.isFinite(p.md))
                .sort((a, b) => (a.md as number) - (b.md as number)),
            ).map((p) => ({ surface: p.surface, md: p.md as number, tvdss: p.tvdss ?? null })),
          });
        } catch {
          skipped.push({ well: bore.name, why: 'log digest could not be decoded' });
        }
        // emit progressively and yield, so 24 bores do not freeze the pane
        setState({
          bores: [...bores], done: i + 1, total: logged.length, running: true, skipped: [...skipped],
        });
        await new Promise((r) => { setTimeout(r, 0); });
      }

      if (!cancelled && runRef.current === run) {
        setState({ bores, done: logged.length, total: logged.length, running: false, skipped });
      }
    })().catch(() => { if (!cancelled) setState(EMPTY); });

    return () => { cancelled = true; };
  }, [ws, logged, params, enabled]);

  return state;
}

/**
 * Depth transform for the panel.
 *
 * 'md'      raw measured depth — what the log was recorded on
 * 'tvdss'   NOT offered here: the digests carry MD only, and faking TVD by
 *           treating MD as vertical would mis-hang every deviated bore, which on
 *           Volve is all of them. The panel offers it only when a survey is wired.
 * 'flatten' every bore shifted so the chosen pick sits on one datum. This is the
 *           whole point of a correlation panel: structure is removed and only the
 *           stratigraphy is left, so thickness changes are real rather than an
 *           artefact of where the wells sit on the structure.
 */
export type HangMode = 'md' | 'flatten';

/** Shift for a bore under the current hang. Null when the bore has no pick for
 *  the flattening surface — such a bore CANNOT be flattened onto it, and the
 *  panel must show it unflattened and say so rather than guess an offset. */
export function hangShift(b: BoreCurveSet, mode: HangMode, surface: string | null): number | null {
  if (mode === 'md' || !surface) return 0;
  const p = b.picks.find((q) => q.surface === surface);
  return p ? -p.md : null;
}
