// dataqc/digest.ts — stages 2 + 3 (DIGESTED → COMPRESSED). Pure and isomorphic so
// the golden-master test can run the exact production code path in Node.
// The browser calls this inside a Worker; nothing here touches the DOM.
import { gzipSync } from 'fflate';
import { gridToGVSURF, type GvSurf } from '../engine/gvsurf.ts';
import { looksLikeLas, parseLas } from './parse/las.ts';
import { detectSurfaceFormat, parseSurface } from './parse/surface.ts';
import { qcLog, qcSurface, worstSeverity } from './qc.ts';
import type { AssetFormat, AssetKind, DigestedLog, DigestedSurface, QcException } from './types.ts';

export interface DigestResult {
  kind: AssetKind;
  format: AssetFormat;
  meta: Record<string, string | number | null>;
  exceptions: QcException[];
  status: 'pass' | 'warn' | 'fail';
  /** compressed payload, ready for IndexedDB (stage 3) */
  compressed: Uint8Array;
  compressedBytes: number;
  /** kept in-memory for the caller that wants to render immediately */
  log?: DigestedLog;
  surface?: DigestedSurface;
  gvsurf?: GvSurf;
}

const DOC_EXT: Record<string, AssetFormat> = {
  pdf: 'pdf', docx: 'docx', pptx: 'pptx', xlsx: 'xlsx', xls: 'xlsx',
  csv: 'csv-curves', txt: 'txt', md: 'txt',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image',
};

export const extOf = (name: string) => name.toLowerCase().split('.').pop() ?? '';

/** Classify without parsing — cheap, used for the inventory row before digest. */
export function classify(fileName: string, headText: string): { kind: AssetKind; format: AssetFormat } {
  const ext = extOf(fileName);
  if (ext === 'las' || looksLikeLas(headText)) return { kind: 'log', format: 'las2' };
  const sf = detectSurfaceFormat(headText, fileName);
  if (sf) {
    const format: AssetFormat = sf === 'irap-ascii' ? 'irap-ascii' : sf === 'zmap' ? 'zmap' : sf === 'earthvision' ? 'earthvision' : 'xyz';
    return { kind: 'surface', format };
  }
  const docFormat = DOC_EXT[ext];
  if (docFormat) return { kind: docFormat === 'image' ? 'image' : 'document', format: docFormat };
  return { kind: 'unknown', format: 'unknown' };
}

const enc = (o: unknown) => gzipSync(new TextEncoder().encode(JSON.stringify(o)), { level: 9 });

/** Digest an already-structured log (bundled reference packages arrive parsed).
 *  Runs the SAME QC rules and the SAME compression as an uploaded LAS — the only
 *  difference is that parsing already happened upstream. */
export function digestLog(log: DigestedLog, format: AssetFormat = 'las2'): DigestResult {
  // structured input carries explicit nulls — the LAS sentinel rule doesn't apply
  const exceptions = qcLog(log, [], { sentinelApplicable: false });
  const compressed = enc(log);
  const finite = log.md.filter(Number.isFinite);
  return {
    kind: 'log', format, exceptions, status: worstSeverity(exceptions),
    compressed, compressedBytes: compressed.byteLength, log,
    meta: {
      well: log.well,
      curves: log.curves.length,
      // WHICH curves, not just how many — "does this well have a density log?" is
      // the question an inventory row has to answer without being opened
      curveList: log.curves.map((c) => c.mnemonic).join(' '),
      families: [...new Set(log.curves.map((c) => c.family).filter(Boolean))].join(' '),
      samples: log.md.length,
      depthUnit: log.depthUnit,
      mdMin: finite.length ? Math.min(...finite) : null,
      mdMax: finite.length ? Math.max(...finite) : null,
      nullValue: log.nullValue,
    },
  };
}

/** Digest an already-structured surface through the shipped GVSURF codec. */
export function digestSurface(surface: DigestedSurface, format: AssetFormat = 'earthvision'): DigestResult {
  const exceptions = qcSurface(surface);
  const gv = gridToGVSURF(surface.name, surface.values, surface.ncol, surface.nrow, {
    x0: surface.x0, xc: surface.dx, xr: 0,
    y0: surface.y0, yc: 0, yr: surface.dy,
  }, { kind: 'depth', zUnits: surface.zUnits });
  const compressed = enc(gv);
  let live = 0, zmin = Infinity, zmax = -Infinity;
  for (let i = 0; i < surface.values.length; i++) {
    const v = surface.values[i];
    if (!Number.isFinite(v)) continue;
    live++;
    if (v < zmin) zmin = v;
    if (v > zmax) zmax = v;
  }
  return {
    kind: 'surface', format, exceptions, status: worstSeverity(exceptions),
    compressed, compressedBytes: compressed.byteLength, surface, gvsurf: gv,
    meta: {
      // the display name is the ONLY thing that lets a surface be matched back to a
      // stratigraphic unit later (surface-context.ts) — it was computed for the GVSURF
      // encode above but never survived onto the asset until now
      name: surface.name || null,
      ncol: surface.ncol, nrow: surface.nrow, nodes: surface.ncol * surface.nrow, live,
      dx: surface.dx, dy: surface.dy,
      // depth range is the fact that makes a horizon row readable at a glance
      zmin: live ? Math.round(zmin * 100) / 100 : null,
      zmax: live ? Math.round(zmax * 100) / 100 : null,
      xmin: surface.x0, xmax: surface.x0 + surface.dx * (surface.ncol - 1),
      ymin: surface.y0, ymax: surface.y0 + surface.dy * (surface.nrow - 1),
      zUnits: surface.zUnits,
    },
  };
}

/** Digest an opaque structured payload (trajectories, picks, production). */
export function digestRecord(kind: AssetKind, payload: unknown, meta: Record<string, string | number | null>): DigestResult {
  const compressed = enc(payload);
  return {
    kind, format: 'unknown', exceptions: [], status: 'pass',
    compressed, compressedBytes: compressed.byteLength, meta,
  };
}

/** Digest a TEXT-based asset (logs and surfaces). Binary documents are handled by
 *  the existing knowledge/extract.ts path, not here. */
export function digestText(fileName: string, text: string): DigestResult {
  const { kind, format } = classify(fileName, text.slice(0, 8000));

  if (kind === 'log') {
    const { log, warnings } = parseLas(text);
    const exceptions = qcLog(log, warnings);
    const compressed = enc(log);
    const finite = log.md.filter(Number.isFinite);
    return {
      kind, format, exceptions, status: worstSeverity(exceptions),
      compressed, compressedBytes: compressed.byteLength, log,
      meta: {
        well: log.well,
        curves: log.curves.length,
        samples: log.md.length,
        depthUnit: log.depthUnit,
        mdMin: finite.length ? Math.min(...finite) : null,
        mdMax: finite.length ? Math.max(...finite) : null,
        datum: detectDatum(log),
        crs: null,
        nullValue: log.nullValue,
      },
    };
  }

  if (kind === 'surface') {
    const sf = format === 'irap-ascii' ? 'irap-ascii' : format === 'zmap' ? 'zmap' : format === 'earthvision' ? 'earthvision' : 'xyz';
    const surface = parseSurface(text, sf);
    const exceptions = qcSurface(surface);
    const gv = gridToGVSURF(surface.name || fileName, surface.values, surface.ncol, surface.nrow, {
      x0: surface.x0, xc: surface.dx, xr: 0,
      y0: surface.y0, yc: 0, yr: surface.dy,
    }, { kind: 'depth', zUnits: surface.zUnits });
    const compressed = enc(gv);
    let live = 0, zmin = Infinity, zmax = -Infinity;
    for (let i = 0; i < surface.values.length; i++) {
      const v = surface.values[i];
      if (!Number.isFinite(v)) continue;
      live++;
      if (v < zmin) zmin = v;
      if (v > zmax) zmax = v;
    }
    return {
      kind, format, exceptions, status: worstSeverity(exceptions),
      compressed, compressedBytes: compressed.byteLength, surface, gvsurf: gv,
      meta: {
        name: surface.name || fileName,
        ncol: surface.ncol, nrow: surface.nrow, nodes: surface.ncol * surface.nrow, live,
        dx: surface.dx, dy: surface.dy,
      // depth range is the fact that makes a horizon row readable at a glance
      zmin: live ? Math.round(zmin * 100) / 100 : null,
      zmax: live ? Math.round(zmax * 100) / 100 : null,
        xmin: surface.x0, xmax: surface.x0 + surface.dx * (surface.ncol - 1),
        ymin: surface.y0, ymax: surface.y0 + surface.dy * (surface.nrow - 1),
        zUnits: surface.zUnits,
        crs: null, datum: null,
      },
    };
  }

  const compressed = enc({ fileName, bytes: text.length });
  return {
    kind, format, exceptions: [], status: 'pass',
    compressed, compressedBytes: compressed.byteLength,
    meta: { note: 'Binary/document asset — extraction runs in the Knowledge Extraction Studio.' },
  };
}

/** LAS has no standard datum field; look across the header for a recognised token. */
function detectDatum(log: DigestedLog): string | null {
  const text = Object.entries(log.header).map(([k, v]) => `${k} ${v}`).join(' ');
  const m = text.match(/\b(TVDSS|TVD|MD|RKB|KB|GL|MSL)\b/i);
  return m ? m[1].toUpperCase() : null;
}
