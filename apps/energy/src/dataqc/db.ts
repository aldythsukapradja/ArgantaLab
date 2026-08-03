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

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS);
      if (!db.objectStoreNames.contains(ASSETS)) {
        const s = db.createObjectStore(ASSETS, { keyPath: 'id' });
        s.createIndex('byField', 'fieldId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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
