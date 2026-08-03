// dataqc/bundle.ts — shipped reference packages ("Project Data Bundles").
//
// A bundle is a field whose delivery already lives in the app (public/wb for Volve).
// It is NOT a special case in the pipeline: bundle files run through the SAME QC
// rules and the SAME compression codecs as a client upload. The only differences:
//   · the raw is already served from public/, so we don't duplicate 45 MB into
//     IndexedDB — blobKey points at the public path
//   · parsing already happened upstream, so we enter at digestLog/digestSurface
//     instead of the LAS/EarthVision text parsers
//
// This is what makes Volve the end-to-end proof: real curves, real grids, real
// compression ratios, real OSDU records — with nothing typed in by hand.
//
// Adding field #2 = adding a row here + dropping its files. No pipeline change.
import { digestLog, digestRecord, digestSurface } from './digest.ts';
import { extractDoc, buildCandidates } from '../knowledge/extract.ts';
import { buildEntityIndex } from '../knowledge/tag.ts';
import { mergeVault, loadUserNotes } from '../knowledge/vault.ts';
import type {
  AssetKind, DigestedCurve, DigestedLog, DigestedSurface, IngestedAsset, Vertical,
} from './types.ts';
import { curveFamily } from './parse/las.ts';

const BASE = import.meta.env.BASE_URL || '/';

export interface BundleSpec {
  slug: string;
  label: string;
  provider: string;
  root: string;        // public path root
  licence: string;
}

/** Reference packages, keyed by the OSDU field id's native segment.
 *  Volve = NPDID 3420717 (Sodir authority). */
export const BUNDLES: Record<string, BundleSpec> = {
  'no-field-3420717': {
    slug: 'volve', label: 'Volve', provider: 'Equinor',
    root: `${BASE}wb`, licence: 'Equinor Open Data Licence',
  },
};

export function bundleFor(fieldId: string): BundleSpec | null {
  const native = fieldId.split(':').pop() ?? fieldId;
  return BUNDLES[native] ?? null;
}

// ── wb payload shapes we adapt from (mirror of wb/types.ts) ──────────────────
interface WbIndexLite {
  crs: string; datum: string;
  wells: Array<{ name: string; has: { logs: boolean; traj: boolean; production: boolean; picks: boolean } }>;
  surfaces: Array<{ id: string; name: string }>;
}

/** Unstructured source documents shipped with the package. These are the REAL Volve
 *  reports (Equinor open data) — they run through the same deterministic extractor
 *  the Knowledge Extraction Studio uses (pdfjs text layer → blocks with page
 *  locators → entity tagging against the knowledge base). No OCR, no LLM. */
export const BUNDLE_DOCS: Array<{ file: string; label: string }> = [
  { file: 'Volve_PUD.pdf', label: 'Volve Plan for Development and Operation' },
  { file: 'Hugin_Petrophysical_Evaluation_2005.pdf', label: 'Hugin Fm petrophysical evaluation (2005)' },
  { file: '15_9-19A_Biostratigraphy.pdf', label: '15/9-19 A biostratigraphy' },
  { file: 'LFP_Petrophysics_15_9-19A.pdf', label: 'LFP petrophysics 15/9-19 A' },
  { file: 'LFP_Petrophysics_15_9-19SR.pdf', label: 'LFP petrophysics 15/9-19 SR' },
  { file: 'F-12_Formation_Pressure_MWD.pdf', label: 'F-12 formation pressure (MWD)' },
  { file: 'F-10_Petrophysical_Report.pdf', label: 'F-10 petrophysical report' },
];
interface WbLogs { well: string; depth_unit?: string; source_id?: string; dataNature?: string; md: number[]; curves: Record<string, { unit: string; values: (number | null)[] }> }
interface WbSurface { id: string; name: string; source?: string; nx: number; ny: number; x0: number; y0: number; cell: number; z: (number | null)[] }

const slugWell = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** One planned unit of bundle work — resolved before any fetching happens, so the
 *  UI can show an honest total and progress. */
export interface BundleItem {
  key: string;            // stable asset key within the bundle
  kind: AssetKind;
  url: string;
  label: string;
}

export async function planBundle(spec: BundleSpec): Promise<{ index: WbIndexLite; items: BundleItem[] }> {
  const index = (await fetch(`${spec.root}/index.json`).then((r) => r.json())) as WbIndexLite;
  const items: BundleItem[] = [];
  for (const s of index.surfaces) {
    items.push({ key: `surface-${s.id}`, kind: 'surface', url: `${spec.root}/surface-${s.id}.json`, label: s.name });
  }
  for (const w of index.wells) {
    const sw = slugWell(w.name);
    if (w.has.logs) items.push({ key: `logs-${sw}`, kind: 'log', url: `${spec.root}/logs-${sw}.json`, label: `${w.name} logs` });
    if (w.has.traj) items.push({ key: `traj-${sw}`, kind: 'trajectory', url: `${spec.root}/traj-${sw}.json`, label: `${w.name} trajectory` });
    // production carries injection too (`wi` = water injected per month)
    if (w.has.production) items.push({ key: `prod-${sw}`, kind: 'production', url: `${spec.root}/prod-${sw}.json`, label: `${w.name} production` });
  }
  items.push({ key: 'prod-field', kind: 'production', url: `${spec.root}/prod-field.json`, label: 'Field production & injection' });
  items.push({ key: 'patterns', kind: 'patterns', url: `${spec.root}/patterns.json`, label: 'Injector–producer patterns' });
  items.push({ key: 'picks', kind: 'picks', url: `${spec.root}/picks.json`, label: 'Formation picks' });
  for (const d of BUNDLE_DOCS) {
    items.push({ key: `doc-${d.file}`, kind: 'document', url: `${spec.root}/docs/${d.file}`, label: d.label });
  }
  return { index, items };
}

/** Adapt + digest one bundle item. Returns null if the file isn't present
 *  (the index advertises capability, not guaranteed files). */
/** Stage 4 (LINKED) for an unstructured document: run the SAME deterministic
 *  extractor the Knowledge Extraction Studio uses — pdfjs text layer → blocks with
 *  page locators → entity tagging against the live knowledge base. No OCR, no LLM.
 *  Returns the extracted doc plus what it matched in the KB. */
/** Bounded so one long report cannot stall the package load. The Extraction Studio
 *  itself reads documents in full; this is the background auto-load path. */
const BUNDLE_DOC_MAX_PAGES = 40;

async function digestDocument(item: BundleItem, blob: Blob) {
  const file = new File([blob], item.url.split('/').pop() ?? item.key, { type: 'application/pdf' });
  const doc = await extractDoc(file, { maxPages: BUNDLE_DOC_MAX_PAGES });
  const idx = buildEntityIndex(mergeVault(loadUserNotes()));
  const candidates = buildCandidates(doc, idx);
  const matched = [...new Set(
    candidates.flatMap((c) => c.matchedEntities.map((m) => m.entity)),
  )].slice(0, 24);
  const pages = new Set(doc.blocks.map((b) => b.locator)).size;
  const chars = doc.blocks.reduce((n, b) => n + (b.text?.length ?? 0), 0);
  return { doc, candidates, matched, pages, chars };
}

export async function digestBundleItem(
  item: BundleItem,
  index: WbIndexLite,
  spec: BundleSpec,
  fieldId: string,
  vertical: Vertical,
): Promise<{ asset: IngestedAsset; compressed: Uint8Array } | null> {
  const res = await fetch(item.url);
  if (!res.ok) return null;

  // ── unstructured branch: real bytes, real pdfjs extraction, real KB tagging ──
  if (item.kind === 'document') {
    const blob = await res.blob();
    const { doc, candidates, matched, pages, chars } = await digestDocument(item, blob);
    const r = digestRecord('document', { doc, candidates }, {});
    const fileName = item.url.split('/').pop() ?? item.key;
    const asset: IngestedAsset = {
      id: `ia-${spec.slug}-${item.key}`,
      origin: 'bundle', fieldId, vertical,
      kind: 'document', format: 'pdf',
      fileName,
      sha256: doc.sha256,
      bytes: blob.size,
      blobKey: item.url,
      digestKey: `digest:${spec.slug}:${item.key}`,
      compressedBytes: r.compressedBytes,
      meta: {
        title: item.label,
        pages, blocks: doc.blocks.length, characters: chars,
        candidates: candidates.length,
        package: spec.label, licence: spec.licence,
        crs: index.crs, datum: index.datum,
      },
      qc: {
        status: chars > 0 ? 'pass' : 'warn',
        exceptions: chars > 0 ? [] : [{
          rule: 'doc.notext', severity: 'warn',
          message: 'No text layer — this PDF is scanned. OCR is out of scope, so no text was extracted.',
          locator: 'file',
        }],
      },
      linked: { entities: matched.length, candidates: candidates.length, matched },
      uploadedAt: new Date().toISOString(),
    };
    return { asset, compressed: r.compressed };
  }

  const text = await res.text();
  const bytes = new TextEncoder().encode(text).byteLength;
  const json = JSON.parse(text);

  let r;
  let fileName = item.url.split('/').pop() ?? item.key;

  if (item.kind === 'log') {
    const w = json as WbLogs;
    const curves: DigestedCurve[] = Object.entries(w.curves).map(([mnemonic, c]) => ({
      mnemonic, unit: c.unit ?? '', family: curveFamily(mnemonic), values: c.values,
    }));
    const log: DigestedLog = {
      well: w.well,
      depthUnit: w.depth_unit ?? 'm',
      depthMnemonic: 'DEPT',
      md: w.md,
      curves,
      nullValue: null,
      // the bundle's CRS/datum are declared once in index.json — surface them on
      // every asset so the cross-asset consistency rule can actually see them
      header: { WELL: w.well, FLD: spec.label, LOC: `${index.datum} reference, ${index.crs}` },
    };
    r = digestLog(log);
    if (w.source_id) fileName = w.source_id.split(/[\\/]/).pop() ?? fileName;
  } else if (item.kind === 'surface') {
    const s = json as WbSurface;
    const values = new Float64Array(s.nx * s.ny).fill(NaN);
    for (let i = 0; i < s.nx * s.ny; i++) {
      const v = s.z[i];
      if (v != null && Number.isFinite(v)) values[i] = v;
    }
    const surface: DigestedSurface = {
      name: s.name, ncol: s.nx, nrow: s.ny, values,
      x0: s.x0, y0: s.y0, dx: s.cell, dy: s.cell, zUnits: 'meters',
    };
    r = digestSurface(surface);
    if (s.source) fileName = s.source;
  } else if (item.kind === 'production' || item.kind === 'injection') {
    // Production and INJECTION arrive in the same monthly series (`wi` = water
    // injected). They are different disciplines with different QC, so a pure
    // injector is classified as `injection` rather than hidden inside production.
    const months: Array<{ ym: string; oil: number; gas: number; water: number; wi: number }> = json.monthly ?? [];
    const sum = (k: 'oil' | 'gas' | 'water' | 'wi') => months.reduce((n, m) => n + (Number(m[k]) || 0), 0);
    const injected = sum('wi');
    const produced = sum('oil');
    const kind: AssetKind = injected > 0 && produced === 0 ? 'injection' : 'production';
    r = digestRecord(kind, json, {
      well: json.well ?? null,
      months: months.length,
      firstMonth: months[0]?.ym ?? null,
      lastMonth: months[months.length - 1]?.ym ?? null,
      cumOilSm3: Math.round(sum('oil')),
      cumGasSm3: Math.round(sum('gas')),
      cumWaterSm3: Math.round(sum('water')),
      cumInjectedSm3: Math.round(injected),
      role: injected > 0 && produced === 0 ? 'injector' : injected > 0 ? 'both' : 'producer',
      units: json.units ?? null,
    });
  } else if (item.kind === 'patterns') {
    r = digestRecord('patterns', json, {
      injectors: json.injectors?.length ?? 0,
      producers: json.producers?.length ?? 0,
      patterns: json.patterns?.length ?? 0,
      method: json.method ?? null,
    });
  } else {
    const n = Array.isArray(json?.stations) ? json.stations.length
      : Array.isArray(json?.picks) ? json.picks.length : null;
    // `well` must survive onto the asset — the viewer resolves formation picks by it,
    // and without it a trajectory row is unidentifiable in the inventory.
    r = digestRecord(item.kind, json, {
      well: json?.well ?? null,
      records: n,
      dataNature: json?.dataNature ?? null,
    });
  }

  const asset: IngestedAsset = {
    id: `ia-${spec.slug}-${item.key}`,
    origin: 'bundle',
    fieldId, vertical,
    kind: r.kind, format: r.format,
    fileName,
    sha256: '',                     // bundle files are versioned by the build, not hashed here
    bytes,
    blobKey: item.url,              // already served — not duplicated into IndexedDB
    digestKey: `digest:${spec.slug}:${item.key}`,
    compressedBytes: r.compressedBytes,
    meta: { ...r.meta, crs: index.crs, datum: index.datum, package: spec.label, licence: spec.licence },
    qc: { status: r.status, exceptions: r.exceptions },
    uploadedAt: new Date().toISOString(),
  };
  return { asset, compressed: r.compressed };
}
