// sim-store — the Simulation surface's own state, shaped exactly like `static-store`.
//
// ── WHAT THE SIMULATION TAB IS FOR ──────────────────────────────────────────
//
// The CORE of a dynamic study is one chain and it ends at a forecast:
//
//     initialise → schedule → run → history match → forecast
//
// Everything downstream of that chain is commentary. Streamline diagnostics tell you
// WHY the match moved; a benchmark tells you whether the recovery is credible; a
// development plan turns the forecast into wells and money. Those are separate
// surfaces because they are separate arguments — but none of them can be made until
// this chain has produced a forecast, so the chain lives in one place and is run in
// one place.
//
// ── THE ONE RULE, INHERITED FROM THE STATIC MODEL ───────────────────────────
//
// A process that has not run produces NOTHING, and says so. It never falls back to a
// default, never borrows last run's answer, and never renders a plausible curve. A
// forecast drawn from an unmatched model is the most expensive kind of wrong number
// this app could produce, so `done` is checked before anything is shown, and a blocked
// process names the step it is waiting for.
import { create } from 'zustand';

export type SimProcessId =
  | 'case' | 'init' | 'schedule' | 'run'
  | 'observed' | 'match' | 'forecast';

export interface SimProcessDef {
  id: SimProcessId;
  name: string;
  /** the question this step answers */
  purpose: string;
  /** what must have run first — a hard gate, not a hint */
  needs: SimProcessId[];
  /** what it produces; nothing downstream may exist without it */
  produces: string;
}

/**
 * The processes, in the order they are run.
 *
 * `needs` is enforced, not documented: you cannot schedule wells into a model that has
 * no initial state, and you cannot match against history you have not loaded. A button
 * that runs and silently produces nothing is worse than a disabled one.
 */
export const SIM_PROCESSES: SimProcessDef[] = [
  {
    id: 'case', name: 'Simulation case', needs: [],
    purpose: 'Which static realisation, which zones, which fluid model — the case is a POINTER to a built grid, never a copy of one.',
    produces: 'SimulationCase',
  },
  {
    id: 'init', name: 'Initialisation', needs: ['case'],
    purpose: 'Equilibrate: pressure datum, contacts, saturation from the capillary curve. The state at time zero.',
    produces: 'InitialState',
  },
  {
    id: 'schedule', name: 'Well schedule', needs: ['case'],
    purpose: 'Completions, controls and rates through time, from the field history and the plan.',
    produces: 'WellSchedule',
  },
  {
    id: 'run', name: 'Run', needs: ['init', 'schedule'],
    purpose: 'Advance the flow solution over the schedule and record rates, pressures and the field state.',
    produces: 'SimulationRun',
  },
  {
    id: 'observed', name: 'Observed data', needs: ['case'],
    purpose: 'The measured history the run is judged against — rates, cumulative volumes, gauge pressures.',
    produces: 'ObservedHistory',
  },
  {
    id: 'match', name: 'History match', needs: ['run', 'observed'],
    purpose: 'Score the run against the history, and adjust the parameters the data can actually constrain.',
    produces: 'MatchedCase',
  },
  {
    id: 'forecast', name: 'Forecast', needs: ['match'],
    purpose: 'Carry the matched case forward under a control strategy. A forecast from an unmatched model is not a forecast.',
    produces: 'ProductionForecast',
  },
];

export const SIM_PROCESS_BY_ID = new Map(SIM_PROCESSES.map((p) => [p.id, p]));

/** The two working modes, mirroring the Static Model's ribbon. */
export const SIM_RIBBON_TABS: Array<{ id: 'model' | 'predict'; label: string; ids: SimProcessId[] }> = [
  { id: 'model', label: 'Case & run', ids: ['case', 'init', 'schedule', 'run'] },
  { id: 'predict', label: 'Match & forecast', ids: ['observed', 'match', 'forecast'] },
];

export interface SimState {
  /** processes that have produced an artifact */
  done: Set<SimProcessId>;
  /** the process dialog currently open, if any */
  open: SimProcessId | null;
  /** the static realisation this case is built on — an id, never a copy */
  gridVersionId: string | null;
  /** which run is being looked at */
  runId: string | null;
  /** the curve the plots are showing */
  curveKey: string;
  /** wells switched on in the tree */
  activeWells: string[] | null;
  /** show the observed history alongside the simulated response */
  showObserved: boolean;
  view: string;

  setOpen: (p: SimProcessId | null) => void;
  markDone: (p: SimProcessId) => void;
  /**
   * Invalidate a process AND everything downstream of it.
   *
   * Re-running initialisation does not leave the old forecast valid — it leaves it
   * STALE, which looks exactly the same on screen. The cascade is what stops a number
   * from outliving the assumption it was computed under.
   */
  invalidate: (p: SimProcessId) => void;
  setGridVersion: (id: string | null) => void;
  setRun: (id: string | null) => void;
  setCurve: (k: string) => void;
  setActiveWells: (w: string[] | null) => void;
  setShowObserved: (b: boolean) => void;
  setView: (v: string) => void;
}

/** every process that depends on `p`, transitively */
export function downstreamOf(p: SimProcessId): SimProcessId[] {
  const out = new Set<SimProcessId>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const def of SIM_PROCESSES) {
      if (out.has(def.id)) continue;
      if (def.needs.some((n) => n === p || out.has(n))) { out.add(def.id); grew = true; }
    }
  }
  return SIM_PROCESSES.filter((d) => out.has(d.id)).map((d) => d.id);
}

/** the first unmet prerequisite of `p`, or null when it is runnable */
export function blockedBy(p: SimProcessId, done: Set<SimProcessId>): string | null {
  const def = SIM_PROCESS_BY_ID.get(p);
  if (!def) return null;
  const missing = def.needs.find((n) => !done.has(n));
  return missing ? (SIM_PROCESS_BY_ID.get(missing)?.name ?? missing) : null;
}

export const useSim = create<SimState>((set) => ({
  done: new Set<SimProcessId>(),
  open: null,
  gridVersionId: null,
  runId: null,
  curveKey: 'oilRate',
  activeWells: null,
  showObserved: true,
  view: 'plots',

  setOpen: (open) => set({ open }),
  markDone: (p) => set((s) => {
    const done = new Set(s.done); done.add(p); return { done };
  }),
  invalidate: (p) => set((s) => {
    const done = new Set(s.done);
    done.delete(p);
    for (const d of downstreamOf(p)) done.delete(d);
    return { done };
  }),
  setGridVersion: (gridVersionId) => set({ gridVersionId }),
  setRun: (runId) => set({ runId }),
  setCurve: (curveKey) => set({ curveKey }),
  setActiveWells: (activeWells) => set({ activeWells }),
  setShowObserved: (showObserved) => set({ showObserved }),
  setView: (view) => set({ view }),
}));
