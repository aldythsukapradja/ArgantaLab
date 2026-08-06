// grid-versions.ts — named, swappable realisations of the static model.
//
// A geostatistical model has no single answer. Two runs with different seeds are both
// valid and give different volumes, and a modeller's real work is comparing them — so
// a grid you cannot name, keep and swap back to is a grid you can only build once.
//
// ── WHY THE STORE IS BEHIND AN INTERFACE ────────────────────────────────────
//
// The obvious home is Supabase, and that is where this should end up. But a packed grid
// is ~3.5 MB of binary per version: Postgres rows are the wrong shape for it, so the
// bytes belong in object storage with a row pointing at them, which needs a bucket, a
// migration, auth and a network failure mode. None of that changes the UX.
//
// So the UX ships first against IndexedDB — which this app already uses for the asset
// store — behind `VersionStore`. Swapping in Supabase later is one implementation of
// four methods, and nothing above this line changes.
//
// ── WHAT IS SAVED, AND WHAT IS NOT ──────────────────────────────────────────
//
// The RECIPE, not the result: horizons, layering, seed, simulation resolution, the
// property parameters, plus the summary statistics needed to compare versions in a list
// without loading any of them. A realisation rebuilds deterministically from its seed —
// that is the whole point of recording the seed — so storing megabytes of derived cells
// to save a rebuild is a trade this project does not need to make yet.
//
// `stats` is therefore the contract: it must carry everything the comparison table
// shows, because a version that has to be loaded to be compared is one nobody compares.

export interface GridVersionStats {
  nx: number; ny: number; nz: number;
  cells: number;
  activeColumns: number;
  zones: string[];
  /** volume-weighted, over the reservoir */
  ntg: number; phi: number; sw: number;
  stoiipMMSm3: number;
  /** sand fraction of the realisation */
  sandFraction: number;
}

export interface GridVersionRecipe {
  /** horizon ids, stratigraphic order — the interval the grid spans */
  horizons: string[];
  nzPerZone: number;
  layerScheme: string;
  /** the geostatistical seed. A realisation IS its seed. */
  seed: number;
  simNodes: number;
  permAverage: string;
  /** contact used for the volume, m TVDSS */
  owc?: number;
}

export interface GridVersion {
  id: string;
  name: string;
  note?: string;
  createdAt: number;
  fieldId: string;
  recipe: GridVersionRecipe;
  stats: GridVersionStats;
}

/** The persistence seam. IndexedDB today, Supabase later, same four methods. */
export interface VersionStore {
  list(fieldId: string): Promise<GridVersion[]>;
  save(v: GridVersion): Promise<void>;
  remove(id: string): Promise<void>;
  get(id: string): Promise<GridVersion | null>;
}

const DB = 'arganta-static-versions';
const STORE = 'versions';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id' });
        os.createIndex('fieldId', 'fieldId', { unique: false });
      }
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

export const indexedDbVersionStore: VersionStore = {
  async list(fieldId) {
    const all = (await tx<GridVersion[]>('readonly', (os) => os.getAll() as IDBRequest<GridVersion[]>)) ?? [];
    // newest first — a version list is read from the top
    return all.filter((v) => v.fieldId === fieldId).sort((a, b) => b.createdAt - a.createdAt);
  },
  async save(v) { await tx('readwrite', (os) => os.put(v)); },
  async remove(id) { await tx('readwrite', (os) => os.delete(id)); },
  async get(id) { return (await tx<GridVersion>('readonly', (os) => os.get(id))) ?? null; },
};

/**
 * Seed the canonical v0 case, once.
 *
 * v0 is built headlessly by `scripts/build-grid-v0.mjs` and shipped as
 * `public/wb/grid-v0.json`. It is the case every other realisation is compared against,
 * so it must be present before the user has built anything — an empty version list
 * teaches people the feature does not work.
 *
 * Idempotent by id: re-seeding overwrites the shipped record and leaves the user's own
 * realisations alone. Deliberately NOT deleted when the user removes it — if they
 * delete v0 they meant to, and resurrecting it on the next load would be the app
 * arguing with them.
 */
export async function seedV0(store: VersionStore, fieldId: string, fetchJson: (u: string) => Promise<unknown>): Promise<GridVersion | null> {
  try {
    const existing = await store.get('v0');
    if (existing) return existing;
    const raw = (await fetchJson('/wb/grid-v0.json')) as (GridVersion & { volumes?: unknown; maps?: unknown }) | null;
    if (!raw || raw.id !== 'v0') return null;
    // fieldId is stamped at seed time: the shipped artifact knows its field by name,
    // the store keys by whatever the session calls it
    const v: GridVersion = { ...raw, fieldId };
    await store.save(v);
    return v;
  } catch {
    // a missing or malformed seed must never stop the tab loading
    return null;
  }
}

/**
 * A name that will still mean something next week.
 *
 * "Grid 1" tells a reader nothing; the seed and the resolution are what actually
 * distinguish two realisations, so they go in the default. The user can overwrite it —
 * this is a starting point, not a scheme.
 */
export function defaultVersionName(recipe: GridVersionRecipe, existing: number): string {
  return `R${existing + 1} · seed ${recipe.seed} · ${recipe.simNodes}² · ${recipe.nzPerZone}/zone`;
}

/**
 * What changed between two versions, in words.
 *
 * Comparing realisations is the reason versions exist, and "these two differ" is not
 * useful — a modeller needs to know whether the difference is the seed (same model,
 * different draw) or the recipe (a different model entirely).
 */
export function diffVersions(a: GridVersion, b: GridVersion): string[] {
  const out: string[] = [];
  const r1 = a.recipe, r2 = b.recipe;
  if (r1.seed !== r2.seed) out.push(`seed ${r1.seed} → ${r2.seed}`);
  if (r1.simNodes !== r2.simNodes) out.push(`simulation ${r1.simNodes}² → ${r2.simNodes}²`);
  if (r1.nzPerZone !== r2.nzPerZone) out.push(`layers ${r1.nzPerZone} → ${r2.nzPerZone}/zone`);
  if (r1.layerScheme !== r2.layerScheme) out.push(`layering ${r1.layerScheme} → ${r2.layerScheme}`);
  if (r1.permAverage !== r2.permAverage) out.push(`k average ${r1.permAverage} → ${r2.permAverage}`);
  if (r1.horizons.join() !== r2.horizons.join()) {
    out.push(`interval ${r1.horizons.length} → ${r2.horizons.length} horizons`);
  }
  if (r1.owc !== r2.owc) out.push(`contact ${r1.owc ?? '—'} → ${r2.owc ?? '—'} m`);
  // Same recipe, different volume, means the SEED moved the answer — which is the
  // uncertainty the realisation exists to expose, not a bug.
  if (!out.length && Math.abs(a.stats.stoiipMMSm3 - b.stats.stoiipMMSm3) > 1e-9) {
    out.push('same recipe, different result — check the seed was recorded');
  }
  return out;
}
