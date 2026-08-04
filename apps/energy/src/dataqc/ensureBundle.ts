// ensureBundle.ts — make sure a bundled field's reference package is digested.
//
// Lifted out of DataQc.tsx because it is no longer only DataQc that needs it. Field
// Development's Data Explorer opens on the BASEMAP, and the basemap is drawn from
// ingested surface digests — so if nothing has ever mounted the QC screen in this
// browser, the map has no horizons to drape. The package must load because the field
// is open, not because a particular screen happens to be showing.
//
// Digests are cached in IndexedDB, so this cost is paid once per browser per field.
// It resumes rather than restarting: only missing (or stale-meta) items are digested,
// so an interrupted load picks up exactly where it stopped.
import { bundleFor, digestBundleItem, planBundle } from './bundle.ts';

import { isAvailable, listAssets, putAsset, putBlob } from './db.ts';
import { DIGEST_VERSION, type Vertical } from './types.ts';

export interface BundleProgress {
  done: number; total: number; label: string;
  /** Set when an item could not be digested, or the package could not be planned
   *  at all. Previously every failure here was swallowed: the caller saw no
   *  progress, no error, and an empty asset store — indistinguishable from "this
   *  field has no data", which is what made a broken ingest look like lost data. */
  error?: string;
  /** items that failed but did not stop the package */
  failed?: number;
}

/**
 * Returns a cancel function. `onProgress(null)` fires when there is nothing left to
 * do; `onDigested` fires periodically so a caller showing a list can refresh it.
 */
export function ensureReferenceBundle(
  fieldId: string,
  vertical: Vertical,
  onProgress?: (p: BundleProgress | null) => void,
  onDigested?: () => void,
): () => void {
  const spec = bundleFor(fieldId);
  if (!spec || !isAvailable()) return () => {};
  let cancelled = false;

  (async () => {
    const existing = await listAssets(fieldId);
    const have = new Set(existing.filter((a) => a.origin === 'bundle').map((a) => a.id));
    const { index, items } = await planBundle(spec);
    if (cancelled) return;

    // Re-digest anything stored under an older meta shape, otherwise a package
    // loaded before a new fact was recorded would show that fact as permanently
    // missing.
    const stale = new Set(
      existing.filter((a) => a.origin === 'bundle' && (a.digestVersion ?? 1) < DIGEST_VERSION).map((a) => a.id),
    );
    const todo = items.filter((it) => {
      const id = `ia-${spec.slug}-${it.key}`;
      return !have.has(id) || stale.has(id);
    });
    if (todo.length === 0) return;
    onProgress?.({ done: 0, total: todo.length, label: spec.label });

    let failed = 0;
    let lastError = '';
    for (let i = 0; i < todo.length; i++) {
      if (cancelled) return;
      onProgress?.({ done: i, total: todo.length, label: todo[i].label, failed: failed || undefined });
      try {
        const out = await digestBundleItem(todo[i], index, spec, fieldId, vertical);
        if (out) {
          const bytes = new Uint8Array(out.compressed.length);
          bytes.set(out.compressed);
          await putBlob(out.asset.digestKey!, new Blob([bytes.buffer], { type: 'application/gzip' }));
          await putAsset(out.asset);
          if (!cancelled && i % 4 === 0) onDigested?.();
        }
      } catch (e) {
        // one bad file must not abort the package — but it must be COUNTED, or a
        // package that half-digested looks identical to one that fully did
        failed += 1;
        lastError = e instanceof Error ? e.message : String(e);
      }
      // Yield to the event loop between items. Without this the whole package is
      // one long synchronous-ish run that starves rendering: the page stops
      // responding for minutes and looks hung rather than busy.
      await new Promise((r) => { setTimeout(r, 0); });
    }
    if (cancelled) return;
    onProgress?.(failed
      ? { done: todo.length, total: todo.length, label: spec.label, failed, error: lastError }
      : null);
    onDigested?.();
  })().catch((e: unknown) => {
    // A package that cannot even be PLANNED (missing public/wb, a 404, bad JSON)
    // used to fail completely silently, leaving an empty store and no explanation.
    if (cancelled) return;
    onProgress?.({
      done: 0, total: 0, label: spec.label,
      error: e instanceof Error ? e.message : 'reference package could not be read',
    });
  });

  return () => { cancelled = true; };
}
