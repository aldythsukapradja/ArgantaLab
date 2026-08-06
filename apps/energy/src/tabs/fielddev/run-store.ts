// run-store — a dynamic run, saved, so it is computed once and read many times.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
//
// The solve takes ~12 s and blocks the thread. Re-running it every time someone opens
// a tab is not a cost anyone should pay twice, and it makes the Streamline surface
// impossible: streamlines are traced from the SAME flux field the flow solve produced,
// so a second surface that re-ran the case would be tracing a different run and
// quietly disagreeing with the first.
//
// ── WHAT IS STORED, AND WHY EACH PIECE ──────────────────────────────────────
//
//  · the SERIES, because that is what every chart draws;
//  · the COARSE GRID, because the frames and the flux field live on it, not on the
//    geological grid;
//  · per-step SATURATION, for the 3D animation;
//  · per-step FLUX, because streamline tracing needs it and it cannot be recovered
//    from saturation;
//  · the WELLS AS PLACED, in solver order, so allocation can be named;
//  · the ASSUMPTIONS, because a stored number that has lost the caveats it was
//    computed under is worse than no number.
//
// ── AND WHAT KEYS IT ────────────────────────────────────────────────────────
//
// The GRID VERSION. A run belongs to the realisation it was computed on; loading a run
// against a different grid would put a flood on rock it never flowed through. Change
// the basis and the stored run stops matching, which is the point.
import type { RunSeries, RunAssumptions, BuildResult } from './sim-run';

export interface StoredRun {
  id: string;
  fieldId: string;
  /** the static realisation this was solved on — the run is only valid against it */
  gridVersionId: string;
  savedAt: number;
  /** simulated period, days */
  tEnd: number;
  historyEnd: number | null;

  series: RunSeries;
  assumptions: RunAssumptions;

  /** the COARSE flow grid — frames and flux are on this, not the geological grid */
  grid: {
    nx: number; ny: number; nz: number; dx: number; dy: number; x0: number; y0: number;
    activeCol: Uint8Array;
    /** thickness-weighted porosity, needed to re-derive time-of-flight */
    phi: Float64Array;
    /** mean gross thickness of the flow layer, m */
    dz: number;
    /**
     * Structure of the flow layer, per column.
     *
     * Optional because runs saved before this existed have none. A consumer that
     * cannot find it must drape flat AND SAY SO, rather than draping flat while
     * implying it followed the structure.
     */
    topZ?: Float64Array;
    baseZ?: Float64Array;
  };
  /** how much coarser than the geological grid, so frames can be expanded back */
  coarseFactor: number;

  /** report times, days */
  times: number[];
  /** [step] water saturation over the coarse grid */
  sw: Float64Array[];
  /** [step] per-face total flux — what streamline tracing consumes */
  fluxX: Float64Array[];
  fluxY: Float64Array[];

  placed: BuildResult['placed'];
  collisions: BuildResult['collisions'];
}

export interface RunStore {
  get(id: string): Promise<StoredRun | null>;
  put(run: StoredRun): Promise<void>;
  list(fieldId: string): Promise<StoredRun[]>;
  remove(id: string): Promise<void>;
}

const DB = 'arganta-energy-runs';
const STORE = 'runs';

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> => {
  const db = await open();
  return new Promise<T>((res, rej) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => res(req.result as T);
    req.onerror = () => rej(req.error);
  });
};

export const indexedDbRunStore: RunStore = {
  async get(id) {
    try { return (await tx<StoredRun | undefined>('readonly', (s) => s.get(id))) ?? null; }
    catch { return null; }
  },
  async put(run) {
    // a failure to CACHE must never break the surface — the run is already in memory
    try { await tx('readwrite', (s) => s.put(run)); } catch { /* cache only */ }
  },
  async list(fieldId) {
    try {
      const all = (await tx<StoredRun[]>('readonly', (s) => s.getAll())) ?? [];
      return all.filter((r) => r.fieldId === fieldId).sort((a, b) => b.savedAt - a.savedAt);
    } catch { return []; }
  },
  async remove(id) {
    try { await tx('readwrite', (s) => s.delete(id)); } catch { /* cache only */ }
  },
};

/** the id a run takes: one saved run per (field, realisation, period) */
export function runId(fieldId: string, gridVersionId: string, tEnd: number): string {
  return `${fieldId}::${gridVersionId}::${Math.round(tEnd)}d`;
}

/**
 * Is a stored run still usable against the current basis?
 *
 * A run is only valid on the realisation it was solved on. This is checked rather than
 * assumed, because the failure is silent: the charts would render, the animation would
 * play, and the flood would be on rock it never flowed through.
 */
export function runMatches(
  run: StoredRun | null,
  fieldId: string, gridVersionId: string, tEnd: number,
): boolean {
  if (!run) return false;
  return run.fieldId === fieldId
    && run.gridVersionId === gridVersionId
    && Math.round(run.tEnd) === Math.round(tEnd)
    && run.sw.length > 0
    && run.fluxX.length === run.sw.length;
}

/**
 * Why a stored run cannot be used, in words.
 *
 * `runMatches` answers yes/no; a user staring at a surface that decided to re-solve
 * needs to know WHICH assumption moved.
 */
export function mismatchReason(
  run: StoredRun | null,
  fieldId: string, gridVersionId: string, tEnd: number,
): string | null {
  if (!run) return 'no saved run';
  if (run.fieldId !== fieldId) return `saved for ${run.fieldId}`;
  if (run.gridVersionId !== gridVersionId) return `solved on ${run.gridVersionId}, not ${gridVersionId}`;
  if (Math.round(run.tEnd) !== Math.round(tEnd)) return `solved to ${run.tEnd} days, not ${tEnd}`;
  if (!run.sw.length) return 'saved run has no frames';
  if (run.fluxX.length !== run.sw.length) return 'saved run has no flux field — streamlines cannot be traced from it';
  return null;
}
