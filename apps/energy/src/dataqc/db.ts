// dataqc/db.ts — IndexedDB store for client uploads.
//
// WHY NOT localStorage: everything else in this app persists to localStorage
// (~5–10 MB, and knowledge/vault.ts even catches quota errors). One LAS file is
// 10–100 MB. Client ingestion cannot live there. This is a thin hand-rolled
// wrapper — no new dependency — with two stores:
//   blobs   : key → Blob        (raw bytes + compressed digests)
//   assets  : id  → IngestedAsset metadata (indexed by fieldId)
import type { IngestedAsset } from './types.ts';

const DB_NAME = 'arganta-dataqc';
const DB_VERSION = 1;
const BLOBS = 'blobs';
const ASSETS = 'assets';

let dbPromise: Promise<IDBDatabase> | null = null;

/** How long to wait for the database to open before giving up.
 *
 *  `indexedDB.open` can produce NEITHER success nor error: a version change held
 *  by another tab fires `blocked` and then nothing, and a browser under storage
 *  pressure or in a restricted mode can simply never call back. Every read in
 *  this module awaits `open()`, so a silent hang there stalls the whole workspace
 *  — the Input tree sits on "reading…" with zeros beside every folder forever,
 *  which is precisely the false statement about the delivery this app is not
 *  supposed to make. A rejection is recoverable and legible; a hang is neither. */
// Generous on purpose. This is a LAST RESORT for a callback that is never coming,
// not a latency budget: a cold profile opening a store that already holds ~100 MB
// of digest blobs can legitimately take many seconds, and a tight limit here would
// turn "slow" into "broken" — and because a failed open clears the cache to allow a
// retry, a too-tight limit would also thrash, re-opening in a loop.
const OPEN_TIMEOUT_MS = 30_000;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    let settled = false;
    const done = (fn: () => void) => { if (!settled) { settled = true; fn(); } };
    const timer = setTimeout(
      () => done(() => reject(new Error('IndexedDB did not open within 8s — another tab may be holding it open, or storage is unavailable'))),
      OPEN_TIMEOUT_MS,
    );

    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      clearTimeout(timer);
      done(() => reject(e instanceof Error ? e : new Error('IndexedDB unavailable')));
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS);
      if (!db.objectStoreNames.contains(ASSETS)) {
        const s = db.createObjectStore(ASSETS, { keyPath: 'id' });
        s.createIndex('byField', 'fieldId', { unique: false });
      }
    };
    req.onsuccess = () => { clearTimeout(timer); done(() => resolve(req.result)); };
    req.onerror = () => { clearTimeout(timer); done(() => reject(req.error)); };
    // fired when ANOTHER tab holds an older version open — report it rather than
    // waiting on a callback that is not coming
    req.onblocked = () => {
      clearTimeout(timer);
      done(() => reject(new Error('IndexedDB is blocked by another open tab of this app — close it and reload')));
    };
  });
  // A failed open must NOT be cached: the cause is usually transient (another tab,
  // a locked profile), and a memoised rejection would keep the app broken until a
  // full reload even after the cause has gone away.
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

export const putBlob = (key: string, blob: Blob): Promise<IDBValidKey> =>
  tx(BLOBS, 'readwrite', (s) => s.put(blob, key));

export const getBlob = (key: string): Promise<Blob | undefined> =>
  tx(BLOBS, 'readonly', (s) => s.get(key) as IDBRequest<Blob | undefined>);

export const deleteBlob = (key: string): Promise<undefined> =>
  tx(BLOBS, 'readwrite', (s) => s.delete(key) as IDBRequest<undefined>);

export const putAsset = (asset: IngestedAsset): Promise<IDBValidKey> =>
  tx(ASSETS, 'readwrite', (s) => s.put(asset));

export const getAsset = (id: string): Promise<IngestedAsset | undefined> =>
  tx(ASSETS, 'readonly', (s) => s.get(id) as IDBRequest<IngestedAsset | undefined>);

export function listAssets(fieldId: string): Promise<IngestedAsset[]> {
  return open().then((db) => new Promise<IngestedAsset[]>((resolve, reject) => {
    const t = db.transaction(ASSETS, 'readonly');
    const idx = t.objectStore(ASSETS).index('byField');
    const req = idx.getAll(fieldId);
    req.onsuccess = () => resolve((req.result as IngestedAsset[]) ?? []);
    req.onerror = () => reject(req.error);
  }));
}

/** Every asset across every field. The Extraction Studio is a Knowledge-surface
 *  view, not a field workspace — it reviews the whole delivery history. */
export function listAllAssets(): Promise<IngestedAsset[]> {
  return open().then((db) => new Promise<IngestedAsset[]>((resolve, reject) => {
    const t = db.transaction(ASSETS, 'readonly');
    const req = t.objectStore(ASSETS).getAll();
    req.onsuccess = () => resolve((req.result as IngestedAsset[]) ?? []);
    req.onerror = () => reject(req.error);
  }));
}

export async function removeAsset(id: string): Promise<void> {
  const a = await getAsset(id);
  if (a) {
    await deleteBlob(a.blobKey).catch(() => undefined);
    if (a.digestKey) await deleteBlob(a.digestKey).catch(() => undefined);
  }
  await tx(ASSETS, 'readwrite', (s) => s.delete(id) as IDBRequest<undefined>);
}

/** Rough footprint of what this field is holding, for the UI readout. */
export async function usage(fieldId: string): Promise<{ raw: number; compressed: number; count: number }> {
  const assets = await listAssets(fieldId);
  return {
    raw: assets.reduce((n, a) => n + a.bytes, 0),
    compressed: assets.reduce((n, a) => n + (a.compressedBytes ?? 0), 0),
    count: assets.length,
  };
}

export const isAvailable = (): boolean => typeof indexedDB !== 'undefined';
