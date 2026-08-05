import type { OpaqueBundle } from './pptx-writer';

/**
 * Storage for PowerPoint-authored slides we preserve but cannot render.
 *
 * These bundles carry embedded media as base64, so a handful of image-heavy
 * slides would blow the ~5 MB localStorage quota and take the whole session
 * store down with them. They live in IndexedDB instead; the content revisions
 * keep only a light `opaqueRef` pointing here.
 */

const DB_NAME = 'fieldcraft-opaque';
const STORE = 'bundles';
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolvePromise, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolvePromise(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolvePromise, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    req.onsuccess = () => resolvePromise(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  }));
}

export async function putBundle(ref: string, bundle: OpaqueBundle): Promise<void> {
  await tx('readwrite', (s) => s.put(bundle, ref) as IDBRequest<IDBValidKey>);
}

export async function getBundle(ref: string): Promise<OpaqueBundle | undefined> {
  return tx<OpaqueBundle | undefined>('readonly', (s) => s.get(ref));
}

/** Load every bundle a deck needs, so an export can re-emit them verbatim. */
export async function getBundles(refs: string[]): Promise<Record<string, OpaqueBundle>> {
  const out: Record<string, OpaqueBundle> = {};
  for (const ref of refs) {
    try {
      const b = await getBundle(ref);
      if (b) out[ref] = b;
    } catch { /* a missing bundle degrades that slide, not the whole export */ }
  }
  return out;
}

export async function listRefs(): Promise<string[]> {
  return tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys()).then((k) => k.map(String));
}

/**
 * Drop bundles no revision references any more. Called explicitly rather than
 * on every write: an old revision may still legitimately need its slide, so
 * "unreferenced" has to be judged across the whole history, not one document.
 */
export async function pruneBundles(liveRefs: Set<string>): Promise<number> {
  const all = await listRefs();
  let removed = 0;
  for (const ref of all) {
    if (liveRefs.has(ref)) continue;
    await tx('readwrite', (s) => s.delete(ref) as unknown as IDBRequest<undefined>);
    removed += 1;
  }
  return removed;
}
