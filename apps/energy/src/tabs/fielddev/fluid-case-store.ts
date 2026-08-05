// fluid-case-store.ts — the PUBLISHED dynamic initialization.
//
// The Fluids & Rock stage builds a `DynamicInitialization`; this is where it hands it
// over. One case at a time, scoped to a field, written by exactly one surface and read
// by every surface that needs to initialise a flow calculation.
//
// WHY A STORE RATHER THAN A PROP. The simulation surface is not a child of the fluids
// surface — they are sibling stages of a workflow, and in the legacy workbench they
// are not even in the same tree. Before this, the simulator carried its own
// COREY_DEFAULTS and its own viscosity-ratio slider, so an engineer could change the
// oil viscosity on the Fluids tab and the simulation would keep running the old one
// with nothing on either screen saying they disagreed. That is the failure this
// module exists to make impossible.
//
// FALLBACK IS EXPLICIT, NEVER SILENT. `useSimFluids()` returns null when no case has
// been published, so a caller has to decide what to do about it and SAY so, rather
// than defaulting into a number that looks published.
import { create } from 'zustand';
import { toSimFluids, type DynamicInitialization, type SimFluids } from './fluid-model';

interface FluidCaseState {
  /** the case as published, or null when the Fluids & Rock stage has not run */
  published: DynamicInitialization | null;
  /** bumped on every publish, so a memo keyed on it re-runs a simulation */
  version: number;
  publish: (init: DynamicInitialization | null) => void;
}

export const useFluidCase = create<FluidCaseState>((set) => ({
  published: null,
  version: 0,
  publish: (init) => set((s) => (
    // Publishing the identical object again is a no-op: the Fluids tab rebuilds its
    // case on every render, and bumping the version each time would restart any
    // simulation reading it on a loop.
    s.published === init ? s : { published: init, version: s.version + 1 }
  )),
}));

/**
 * The rock-fluid inputs for a flow calculation on this field, or null.
 *
 * Scoped by field on purpose: a case published for Volve must not silently initialise
 * a run on a different field just because it happens to be the last one published.
 */
export function useSimFluids(fieldId: string | null | undefined): SimFluids | null {
  const published = useFluidCase((s) => s.published);
  if (!published) return null;
  if (fieldId && published.fieldId !== fieldId) return null;
  return toSimFluids(published);
}
