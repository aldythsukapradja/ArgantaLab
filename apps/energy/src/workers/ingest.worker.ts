// ingest.worker.ts — run client-data parsing + compression OFF the main thread.
// A 50 MB LAS or a million-node surface must not freeze the shell. Thin wrapper
// over the pure dataqc/digest.ts, matching the geostat/sim worker pattern.
import { digestText } from '../dataqc/digest';

export interface IngestRequest { id: string; fileName: string; text: string }
export interface IngestResponse {
  id: string;
  ok: boolean;
  error?: string;
  kind?: string;
  format?: string;
  meta?: Record<string, string | number | null>;
  exceptions?: unknown[];
  status?: string;
  compressed?: Uint8Array;
  compressedBytes?: number;
}

self.onmessage = (e: MessageEvent<IngestRequest>) => {
  const { id, fileName, text } = e.data;
  try {
    const r = digestText(fileName, text);
    const msg: IngestResponse = {
      id, ok: true,
      kind: r.kind, format: r.format, meta: r.meta,
      exceptions: r.exceptions, status: r.status,
      compressed: r.compressed, compressedBytes: r.compressedBytes,
    };
    // transfer the compressed buffer instead of copying it
    (self as unknown as Worker).postMessage(msg, [r.compressed.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: String((err as Error)?.message ?? err) } satisfies IngestResponse);
  }
};
