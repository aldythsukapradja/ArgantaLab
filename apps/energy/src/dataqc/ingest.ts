// dataqc/ingest.ts — the browser-side pipeline driver.
//   RAW (hash + keep bytes) → DIGESTED + COMPRESSED (in a Worker) → stored (IndexedDB)
// Stage 4 (LINKED) is the Knowledge Extraction Studio; stage 5 (OSDU) is dataqc/osdu.ts.
import { putAsset, putBlob } from './db.ts';
import type { IngestedAsset, QcException, Vertical } from './types.ts';
import type { IngestRequest, IngestResponse } from '../workers/ingest.worker.ts';

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Text-ish assets go through the Worker; binaries are stored raw for the
 *  Extraction Studio to pick up. */
const TEXT_EXT = new Set(['las', 'dat', 'xyz', 'irap', 'gri', 'txt', 'csv', 'asc', 'zmap', 'grd']);
const isTextish = (name: string) => TEXT_EXT.has(name.toLowerCase().split('.').pop() ?? '');

let worker: Worker | null = null;
function getWorker(): Worker {
  if (!worker) worker = new Worker(new URL('../workers/ingest.worker.ts', import.meta.url), { type: 'module' });
  return worker;
}

function digestInWorker(id: string, fileName: string, text: string): Promise<IngestResponse> {
  return new Promise((resolve, reject) => {
    const w = getWorker();
    const onMsg = (e: MessageEvent<IngestResponse>) => {
      if (e.data.id !== id) return;
      w.removeEventListener('message', onMsg);
      e.data.ok ? resolve(e.data) : reject(new Error(e.data.error ?? 'digest failed'));
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ id, fileName, text } satisfies IngestRequest);
  });
}

export interface IngestOptions { fieldId: string; vertical: Vertical }

export async function ingestFile(file: File, opts: IngestOptions): Promise<IngestedAsset> {
  const buf = await file.arrayBuffer();
  const sha = await sha256Hex(buf);
  const id = `ia-${sha.slice(0, 12)}`;
  const blobKey = `raw:${id}`;

  // stage 1 — RAW is always retained, unmodified
  await putBlob(blobKey, new Blob([buf], { type: file.type || 'application/octet-stream' }));

  let asset: IngestedAsset = {
    id, origin: 'client', fieldId: opts.fieldId, vertical: opts.vertical,
    kind: 'unknown', format: 'unknown',
    fileName: file.name, sha256: sha, bytes: buf.byteLength, blobKey,
    meta: {}, qc: { status: 'pass', exceptions: [] },
    uploadedAt: new Date().toISOString(),
  };

  if (isTextish(file.name)) {
    const text = new TextDecoder().decode(buf);
    try {
      // stages 2 + 3 — parse and compress off the main thread
      const r = await digestInWorker(id, file.name, text);
      const digestKey = `digest:${id}`;
      if (r.compressed) {
        // copy into a plain ArrayBuffer — the worker transfers an ArrayBufferLike,
        // which BlobPart does not accept (it could be a SharedArrayBuffer)
        const bytes = new Uint8Array(r.compressed.length);
        bytes.set(r.compressed);
        await putBlob(digestKey, new Blob([bytes.buffer], { type: 'application/gzip' }));
      }
      asset = {
        ...asset,
        kind: (r.kind as IngestedAsset['kind']) ?? 'unknown',
        format: (r.format as IngestedAsset['format']) ?? 'unknown',
        meta: r.meta ?? {},
        digestKey,
        compressedBytes: r.compressedBytes,
        qc: {
          status: (r.status as 'pass' | 'warn' | 'fail') ?? 'pass',
          exceptions: (r.exceptions as QcException[]) ?? [],
        },
      };
    } catch (err) {
      asset.qc = {
        status: 'fail',
        exceptions: [{ rule: 'digest.error', severity: 'fail', message: String((err as Error).message), locator: 'file' }],
      };
    }
  } else {
    // documents/images: raw kept; stage 4 happens in the Extraction Studio
    const ext = file.name.toLowerCase().split('.').pop() ?? '';
    const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
    asset.kind = isImage ? 'image' : 'document';
    asset.format = isImage ? 'image'
      : ext === 'pdf' ? 'pdf' : ext === 'docx' ? 'docx' : ext === 'pptx' ? 'pptx'
      : ext === 'xlsx' || ext === 'xls' ? 'xlsx' : 'unknown';
    asset.meta = { note: 'Awaiting extraction in the Knowledge Extraction Studio.' };
  }

  await putAsset(asset);
  return asset;
}
