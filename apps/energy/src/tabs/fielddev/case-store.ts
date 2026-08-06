// case-store.ts — the BUILT model, persisted.
//
// ── WHY THE RESULT AND NOT JUST THE RECIPE ──────────────────────────────────
//
// `grid-versions` stores a recipe on the argument that a realisation rebuilds
// deterministically from its seed. That is true and it is the wrong trade for a
// reference case, for two reasons:
//
//  1. it costs ten seconds every time the tab is opened, to produce something that was
//     already produced;
//  2. and — the real argument — a case that is RECOMPUTED is not ground truth. It
//     tracks the code. Change a cutoff, a default, an upsampling rule, and "v0" quietly
//     becomes a different model with the same name, which is precisely what a reference
//     must never do.
//
// So the built artifact is stored. v0 is then a fixed thing you can disagree with, and
// a later code change shows up as a DIFFERENCE against it rather than as a silent
// redefinition.
//
// ── WHAT IS STORED, AND WHAT IS DROPPED ─────────────────────────────────────
//
// The packed grid (~3.5 MB of typed arrays — IndexedDB stores those natively via
// structured clone, no serialisation), the upscaled cells, the volumes, and the zone
// bands. The SIMULATION's per-layer arrays are NOT stored: another ~7 MB whose only
// consumer is the step that writes the properties, and those properties are already in
// the packed grid. What survives is the summary a reader actually quotes — seed,
// resolution, layers simulated, sand fraction, cells capped.
import type { BuiltGrid } from './grid-build';
import type { UpscaledCell, PermAverage } from './upscale-grid';
import type { Reconciliation } from './volumes';

/** What a reader quotes about a realisation, without the arrays behind it. */
export interface SimSummary {
  seed: number;
  simNodes: number;
  modelNx: number; modelNy: number;
  simulatedLayers: number;
  totalLayers: number;
  unconditionedLayers: number;
  sandFraction: number;
  permCapped: number;
  simulatedCells: number;
}

export interface StoredCase {
  id: string;
  fieldId: string;
  savedAt: number;
  /** true for a reference case: rebuilding it is a deliberate act, not a side effect */
  groundTruth?: boolean;
  grid: BuiltGrid;
  upscaled: {
    cells: UpscaledCell[];
    permAverage: PermAverage;
    skipped: Array<{ well: string; why: string }>;
    thinCells: number;
  };
  simInfo: SimSummary | null;
  volumes: Reconciliation | null;
  reservoirZones: string[];
  warnings: string[];
}

export interface CaseStore {
  get(id: string): Promise<StoredCase | null>;
  put(c: StoredCase): Promise<void>;
  remove(id: string): Promise<void>;
  list(fieldId: string): Promise<Array<{ id: string; savedAt: number; groundTruth?: boolean }>>;
}

const DB = 'arganta-static-cases';
const STORE = 'cases';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const tx = <T>(mode: IDBTransactionMode, fn: (os: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
  open().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  }));

export const indexedDbCaseStore: CaseStore = {
  async get(id) { return (await tx<StoredCase>('readonly', (os) => os.get(id))) ?? null; },
  async put(c) { await tx('readwrite', (os) => os.put(c)); },
  async remove(id) { await tx('readwrite', (os) => os.delete(id)); },
  async list(fieldId) {
    const all = (await tx<StoredCase[]>('readonly', (os) => os.getAll() as IDBRequest<StoredCase[]>)) ?? [];
    return all
      .filter((c) => c.fieldId === fieldId)
      .map((c) => ({ id: c.id, savedAt: c.savedAt, groundTruth: c.groundTruth }))
      .sort((a, b) => b.savedAt - a.savedAt);
  },
};

/**
 * Is a stored case still usable by this build of the app?
 *
 * A packed grid is a plain object of typed arrays, so an older record survives a
 * structured clone intact — but it may predate a property the current code expects, and
 * a case missing `hcpv` will render an empty map rather than fail loudly. Checking the
 * shape here turns that into a rebuild instead of a mystery.
 */
export function caseIsUsable(c: StoredCase | null, requiredProps: string[] = ['phi', 'sw', 'ntg', 'facies']): boolean {
  if (!c?.grid?.packed?.props?.length) return false;
  const have = new Set(c.grid.packed.props.map((p) => p.name));
  return requiredProps.every((n) => have.has(n));
}

/** Summarise a simulation for storage, dropping the per-layer arrays. */
export function summariseSim(sim: {
  seed: number; simGrid: { nx: number }; modelNx: number; modelNy: number;
  simulatedLayers: number; layers: unknown[]; unconditionedLayers: number;
  sandFraction: number; permCapped: number; simulatedCells: number;
} | null): SimSummary | null {
  if (!sim) return null;
  return {
    seed: sim.seed,
    simNodes: sim.simGrid.nx,
    modelNx: sim.modelNx, modelNy: sim.modelNy,
    simulatedLayers: sim.simulatedLayers,
    totalLayers: sim.layers.length,
    unconditionedLayers: sim.unconditionedLayers,
    sandFraction: sim.sandFraction,
    permCapped: sim.permCapped,
    simulatedCells: sim.simulatedCells,
  };
}
