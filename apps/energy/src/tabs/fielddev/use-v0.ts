// use-v0 — the one realisation the whole vertical stands on, loaded on demand.
//
// ── WHY THIS IS A SHARED HOOK AND NOT A COPY PER SURFACE ────────────────────
//
// The Static Model, the Simulation and the Streamline surface all draw the SAME rock,
// and the 3D viewport reads that rock from one place: the static store. A surface that
// forgets to load it does not fail loudly — the viewport simply renders empty, and it
// looks like the surface has no 3D rather than like it has no grid. That is exactly
// what happened to the Streamline tab: it drew streamlines over a viewport that had
// never been given a grid, and the 3D view read as missing.
//
// So the load lives once, here, and any surface that needs the grid calls it.
//
// It LOADS, never invents. If the recipe cannot be rebuilt the hook reports why and
// leaves the grid null, so the caller shows a reasoned blank instead of a model it
// made up.
import { useEffect, useState } from 'react';
import { useStatic } from './static-store';
import { indexedDbCaseStore } from './case-store';
import { buildCase, V0_RECIPE } from './build-case';
import type { Workspace } from './workspace-model';

/** the id every surface in this vertical agrees to stand on */
export const V0 = 'v0';

export interface V0Basis {
  /** null until it is loaded — a caller must not draw a grid it does not have */
  ready: boolean;
  /** progress or failure, in words, for the surface to show */
  note: string | null;
}

/**
 * Ensure the v0 grid is in the static store.
 *
 * Restored from the case store when it has been built before, rebuilt from
 * `V0_RECIPE` when it has not. Idempotent: a second surface mounting while the first
 * is still building does not start a second build, because the store already holds the
 * grid by the time it finishes.
 */
export function useV0Basis(ws: Workspace, wsReady: boolean): V0Basis {
  const grid = useStatic((s) => s.grid);
  const setGrid = useStatic((s) => s.setGrid);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (grid?.packed || !wsReady || !ws.fieldId) return;
    let alive = true;
    (async () => {
      setNote('loading v0…');
      try {
        const saved = await indexedDbCaseStore.get(V0).catch(() => null);
        if (!alive) return;
        if (saved?.grid) {
          setGrid(saved.grid);
          setNote('v0 (restored)');
          return;
        }
        setNote('building v0 from its recipe…');
        const out = await buildCase(ws, V0_RECIPE, (p) => {
          if (alive) setNote(`building v0 — ${p.step} ${p.done}/${p.total}`);
        });
        if (!alive) return;
        setGrid(out.grid);
        setNote('v0 (built)');
        await indexedDbCaseStore.put({
          id: V0, fieldId: ws.fieldId, savedAt: Date.now(), groundTruth: true,
          grid: out.grid, upscaled: out.upscaled, simInfo: null,
        } as never).catch(() => {});
      } catch (e) {
        // a failure to build is REPORTED, not swallowed into an empty viewport
        if (alive) setNote(`v0 could not be built: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
    return () => { alive = false; };
  }, [grid, wsReady, ws, setGrid]);

  return { ready: !!grid?.packed, note };
}
