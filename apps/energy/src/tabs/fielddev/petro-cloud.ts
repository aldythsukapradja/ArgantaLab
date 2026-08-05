// petro-cloud.ts — assemble the crossplot sample set from the ingested logs.
//
// The crossplots need whole CURVES across every bore, not the per-well
// interpretation the bench runs. This reads the same log digests
// (petro-field/petro-well read them one bore at a time) and hands
// petro-xplot.BoreCurves, which owns the screening and the unit resolution.
//
// TWO facts are carried through deliberately rather than dropped:
//
//   depthKind: 'md'. The digests are on MEASURED depth. Volve's bores are
//   deviated by hundreds of metres, so anything that needs height above a
//   contact must refuse them — and it can only refuse what it is told. Passing
//   depth without saying what it is is how the saturation-height plot silently
//   rendered empty.
//
//   The curve names are the FAMILY where one was resolved, falling back to the
//   raw mnemonic. petro-xplot screens by name against physical ranges, so a
//   curve arriving under a name it does not know is screened only for the LAS
//   absent value — safe, but weaker. Family-first keeps the strong path.
import { useEffect, useMemo, useRef, useState } from 'react';
import { readRecord } from '../../dataqc/readDigest';
import type { DigestedLog } from '../../dataqc/types';
import { depthToMetres } from '../../units';
import type { Workspace } from './workspace';
import type { BoreCurves } from './petro-xplot';

export interface PetroCloud {
  bores: BoreCurves[];
  done: number;
  total: number;
  running: boolean;
  /** bores that carry a log asset but whose digest could not be read */
  skipped: Array<{ well: string; why: string }>;
}

const EMPTY: PetroCloud = { bores: [], done: 0, total: 0, running: false, skipped: [] };

export function usePetroCloud(ws: Workspace, enabled: boolean): PetroCloud {
  const [state, setState] = useState<PetroCloud>(EMPTY);
  const runRef = useRef(0);

  const logged = useMemo(
    () => ws.bores.filter((b) => b.hasLogs && b.assetIds.log),
    [ws.bores],
  );

  useEffect(() => {
    if (!enabled || !logged.length) { setState(EMPTY); return; }
    const run = ++runRef.current;
    let cancelled = false;
    setState({ bores: [], done: 0, total: logged.length, running: true, skipped: [] });

    (async () => {
      const bores: BoreCurves[] = [];
      const skipped: PetroCloud['skipped'] = [];
      for (let i = 0; i < logged.length; i++) {
        if (cancelled || runRef.current !== run) return;
        const b = logged[i];
        try {
          const asset = ws.assets.find((a) => a.id === b.assetIds.log);
          const log = asset ? await readRecord<DigestedLog>(asset) : null;
          if (!log?.md?.length) { skipped.push({ well: b.name, why: 'log digest unreadable' }); continue; }

          const f = depthToMetres(1, log.depthUnit) ?? 1;
          const curves: BoreCurves['curves'] = {};
          for (const c of log.curves) {
            const key = (c.family ?? c.mnemonic).toUpperCase();
            // first writer wins: a family-resolved curve beats a raw mnemonic
            if (!curves[key]) curves[key] = c.values;
          }
          bores.push({
            well: b.name,
            depth: log.md.map((v) => v * f),
            depthKind: 'md',
            curves,
          });
        } catch {
          skipped.push({ well: b.name, why: 'log digest could not be decoded' });
        }
        // yield so a 24-bore decode does not freeze the pane
        setState({ bores: [...bores], done: i + 1, total: logged.length, running: true, skipped: [...skipped] });
        await new Promise((r) => { setTimeout(r, 0); });
      }
      if (!cancelled && runRef.current === run) {
        setState({ bores, done: logged.length, total: logged.length, running: false, skipped });
      }
    })().catch(() => { if (!cancelled) setState(EMPTY); });

    return () => { cancelled = true; };
  }, [ws, logged, enabled]);

  return state;
}
