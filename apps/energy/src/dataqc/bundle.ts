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
import { DIGEST_VERSION } from './types.ts';
import { stationInclDeg } from './insight.ts';
import { curveFamily } from './parse/las.ts';
import { worstSeverity } from './qc.ts';

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
  wells: Array<{
    name: string;
    has: { logs: boolean; traj: boolean; production: boolean; picks: boolean; drilling?: boolean; pressure?: boolean };
    // the WELL MASTER facts — surface slot position and what the regulator says the
    // bore is for. Digested into a `wellmaster` asset so the workspace never has to
    // reach back to the raw index for them.
    x?: number; y?: number; role?: string; purpose?: string | null;
  }>;
  surfaces: Array<{ id: string; name: string }>;
  wellheads?: unknown[];
  contacts?: unknown[];
  official?: unknown;
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
    // the DRILLING record (mud log): MW in/out, ECD, ROP, WOB, RPM, SPP, torque, gas
    if (w.has.drilling) items.push({ key: `drill-${sw}`, kind: 'drilling', url: `${spec.root}/drill-${sw}.json`, label: `${w.name} drilling parameters` });
    // formation pressure while drilling — one file per wellbore, many test stations
    if (w.has.pressure) items.push({ key: `press-${sw}`, kind: 'pressure', url: `${spec.root}/press-${sw}.json`, label: `${w.name} formation pressure` });
  }
  items.push({ key: 'prod-field', kind: 'production', url: `${spec.root}/prod-field.json`, label: 'Field production & injection' });
  items.push({ key: 'patterns', kind: 'patterns', url: `${spec.root}/patterns.json`, label: 'Injector–producer patterns' });
  items.push({ key: 'picks', kind: 'picks', url: `${spec.root}/picks.json`, label: 'Formation picks' });
  // The WELL MASTER. index.json is the delivery's own manifest — slots, bore genealogy,
  // regulator role, wellhead coordinates, declared CRS/datum and fluid contacts. It is
  // digested like any other file so that the workspace has ONE source (the ingested
  // asset store) rather than a store plus a side-channel fetch of the raw index.
  items.push({ key: 'wellmaster', kind: 'wellmaster', url: `${spec.root}/index.json`, label: 'Well master & contacts' });
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
    digestVersion: DIGEST_VERSION,
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
  } else if (item.kind === 'drilling') {
    // Real QC, not a hardcoded pass. The build screened physically-impossible values
    // to null and recorded the counts; this surfaces them as exceptions so a
    // screened channel is VISIBLE rather than silently repaired.
    const curves: Record<string, { unit?: string; values: (number | null)[]; screened?: number; allNull?: boolean }> = json.curves ?? {};
    const names = Object.keys(curves);
    const exceptions: IngestedAsset['qc']['exceptions'] = [];
    const nSamples = Array.isArray(json.md) ? json.md.length : 0;
    if (!nSamples) {
      exceptions.push({ rule: 'drill.empty', severity: 'fail', message: 'No depth index — the mud log carries no samples.', locator: 'md' });
    }
    if (!names.length) {
      exceptions.push({ rule: 'drill.nocurves', severity: 'fail', message: 'No drilling channels resolved from this mud log.', locator: 'curves' });
    }
    if (!curves.MWIN) {
      exceptions.push({ rule: 'drill.nomudweight', severity: 'warn', message: 'No mud-weight-in channel (MDIA) — the primary well-control record is absent.', locator: 'curves.MWIN' });
    }
    for (const [name, c] of Object.entries(curves)) {
      if (c.allNull) {
        exceptions.push({ rule: 'drill.curve.allnull', severity: 'warn', message: `Channel ${name} was logged but contains no usable value.`, locator: `curves.${name}` });
      } else if (c.screened) {
        exceptions.push({
          rule: 'drill.screened', severity: 'info',
          message: `${c.screened} of ${nSamples} ${name} samples were outside the physical range for the channel and were set to null.`,
          locator: `curves.${name}`,
          detail: 'These mud logs declare no null sentinel yet carry impossible values (e.g. -273.15 degC, 0 sg density). Operational zeros are preserved.',
        });
      }
    }
    r = digestRecord('drilling', json, {
      well: json.well ?? null,
      samples: nSamples,
      channels: names.length,
      curveList: names.join(' '),
      mudWeightUnit: curves.MWIN?.unit ?? null,
      depthUnit: json.depth_unit ?? null,
      run: json.run ?? null,
      dataNature: json.dataNature ?? null,
    });
    r = { ...r, exceptions, status: worstSeverity(exceptions) };
  } else if (item.kind === 'pressure') {
    const runs: Array<{ n_rows?: number; rows_source?: string; curves?: Record<string, { values: (number | null)[]; screened?: number }> }> = json.runs ?? [];
    const exceptions: IngestedAsset['qc']['exceptions'] = [];
    if (!runs.length) {
      exceptions.push({ rule: 'press.empty', severity: 'fail', message: 'No pressure runs in this file.', locator: 'runs' });
    }
    let totalRows = 0, screened = 0, decimated = 0;
    for (const [i, run] of runs.entries()) {
      totalRows += run.n_rows ?? 0;
      if (run.rows_source === 'preview') decimated++;
      for (const [name, c] of Object.entries(run.curves ?? {})) {
        if (c.screened) {
          screened += c.screened;
          exceptions.push({
            rule: 'press.screened', severity: 'info',
            message: `Run ${i + 1}: ${c.screened} ${name} samples outside the physical range were set to null.`,
            locator: `runs[${i}].curves.${name}`,
          });
        }
      }
    }
    if (decimated) {
      exceptions.push({
        rule: 'press.decimated', severity: 'warn',
        message: `${decimated} of ${runs.length} runs were read from the decimated preview because the full decode was unavailable.`,
        locator: 'runs',
        detail: 'A decimated pressure test can miss the drawdown/buildup inflections the measurement exists to capture.',
      });
    }
    r = digestRecord('pressure', json, {
      well: json.well ?? null,
      runs: runs.length,
      rows: totalRows,
      screened,
      dataNature: json.dataNature ?? null,
    });
    r = { ...r, exceptions, status: worstSeverity(exceptions) };
  } else if (item.kind === 'wellmaster') {
    // Real QC on the master itself: a bore with no wellhead coordinate cannot be
    // positioned, and a delivery with no declared CRS cannot be projected. Both are
    // reported here rather than discovered later as a missing overlay.
    const wells: WbIndexLite['wells'] = json.wells ?? [];
    const noSlot = wells.filter((w) => !Number.isFinite(w.x) || !Number.isFinite(w.y));
    const exceptions: IngestedAsset['qc']['exceptions'] = [];
    if (!wells.length) {
      exceptions.push({ rule: 'master.empty', severity: 'fail', message: 'The well master lists no wellbores.', locator: 'wells' });
    }
    if (!json.crs) {
      exceptions.push({ rule: 'master.nocrs', severity: 'fail', message: 'No CRS is declared, so no wellhead can be projected.', locator: 'crs' });
    }
    if (noSlot.length) {
      exceptions.push({
        rule: 'master.noslot', severity: 'warn',
        message: `${noSlot.length} of ${wells.length} wellbores carry no wellhead coordinate.`,
        locator: 'wells[].x/y',
        detail: `Without a slot position a survey has no origin, so these bores cannot be drawn: ${noSlot.map((w) => w.name).join(', ')}.`,
      });
    }
    r = digestRecord('wellmaster', json, {
      wells: wells.length,
      wellheads: Array.isArray(json.wellheads) ? json.wellheads.length : 0,
      contacts: Array.isArray(json.contacts) ? json.contacts.length : 0,
      surfaces: Array.isArray(json.surfaces) ? json.surfaces.length : 0,
      wellsWithSlot: wells.length - noSlot.length,
    });
    r = { ...r, exceptions, status: worstSeverity(exceptions) };
    fileName = 'index.json';
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
    // A trajectory's headline fact is where it ENDED — TD in MD and TVD, and how
    // far it stepped out. Derived here from the survey itself rather than read from
    // a master table, so a client survey with no master record still reports it.
    const stations: Array<{ md?: number; tvd?: number; incl?: number; incl_deg?: number; dispNs?: number; dispEw?: number }> =
      Array.isArray(json?.stations) ? json.stations : [];
    const fin = (xs: (number | undefined)[]) => xs.filter((v): v is number => Number.isFinite(v as number));
    const mds = fin(stations.map((st) => st.md));
    const tvds = fin(stations.map((st) => st.tvd));
    const incls = fin(stations.map((st) => stationInclDeg(st) ?? undefined));
    const last = stations[stations.length - 1];
    r = digestRecord(item.kind, json, {
      well: json?.well ?? null,
      records: n,
      ...(item.kind === 'trajectory' ? {
        tdMdM: mds.length ? Math.max(...mds) : null,
        tdTvdM: tvds.length ? Math.max(...tvds) : null,
        maxInclDeg: incls.length ? Math.round(Math.max(...incls) * 10) / 10 : null,
        stepOutM: last && Number.isFinite(last.dispNs) && Number.isFinite(last.dispEw)
          ? Math.round(Math.hypot(last.dispNs as number, last.dispEw as number)) : null,
      } : {}),
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
    digestVersion: DIGEST_VERSION,
  };
  return { asset, compressed: r.compressed };
}
