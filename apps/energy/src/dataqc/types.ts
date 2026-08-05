// dataqc/types.ts — the client-data ingestion contract (v1.0.0).
// Shared by EVERY lifecycle vertical: Data QC is the platform's user-generated-data
// interface, not a Field Development feature. Scoped by fieldId + vertical so a second
// field is uploads, never code.
//
// Pipeline:  RAW → DIGESTED → COMPRESSED → LINKED → OSDU → master ArgantaEnergy
// Every stage is deterministic. No LLM parses, infers or repairs anything here.

/** The five lifecycle verticals that can mount Data QC. */
export type Vertical =
  | 'exploration' | 'field-development' | 'well-delivery'
  | 'reservoir-management' | 'drilling-sequence';

/** Reference cases (catalogue/breadth) are never gated; client cases are. */
export type DataMode = 'reference' | 'client';

export type AssetKind =
  | 'log' | 'surface' | 'picks' | 'trajectory'
  | 'production'          // monthly oil/gas/water for a producing well
  | 'injection'           // monthly water injection (same source series, `wi`)
  | 'drilling'            // mud log: MW in/out, ECD, ROP, WOB, RPM, SPP, torque, gas
  | 'pressure'            // formation pressure while drilling (FPWD/MDT stations)
  | 'patterns'            // injector→producer associations
  | 'wellmaster'          // the delivery's WELL MASTER: slots, bores, genealogy, roles,
                          // wellhead coordinates, declared CRS/datum and fluid contacts
  | 'document' | 'image' | 'unknown';

/** Concrete file formats we detect. `unknown` still ingests (raw is always kept). */
export type AssetFormat =
  | 'las2' | 'csv-curves'
  | 'earthvision' | 'irap-ascii' | 'zmap' | 'cps3' | 'xyz'
  | 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'txt' | 'image'
  | 'unknown';

export type QcSeverity = 'info' | 'warn' | 'fail';

/** A QC finding. `locator` always points at where the problem is — never a bare message. */
export interface QcException {
  rule: string;              // stable id, e.g. 'crs.missing'
  severity: QcSeverity;
  message: string;
  locator: string;           // 'header ~W', 'curve GR', 'file', 'node 12,7'
  detail?: string;
}

/** Digested log — the typed structure a LAS/CSV becomes. */
export interface DigestedCurve {
  mnemonic: string;
  unit: string;
  description?: string;
  family?: string;           // mapped curve family (GR, RHOB, NPHI, RT…) or undefined
  values: (number | null)[]; // nulls are real nulls; the sentinel is resolved at parse time
}

export interface DigestedLog {
  well: string;
  depthUnit: string;
  depthMnemonic: string;     // usually DEPT/DEPTH/MD
  md: number[];
  curves: DigestedCurve[];
  nullValue: number | null;  // declared sentinel (LAS ~W NULL)
  header: Record<string, string>;
  start?: number; stop?: number; step?: number;
}

/** Digested surface — grid geometry + values, pre-compression. */
export interface DigestedSurface {
  name: string;
  ncol: number; nrow: number;
  /** row-major, length ncol*nrow; NaN = no data */
  values: Float64Array;
  /** world coords per node when the source is scattered/irregular */
  x0: number; y0: number; dx: number; dy: number;
  rotationDeg?: number;
  zUnits: string;
  nullValue?: number;
}

/** Where an asset came from.
 *  - 'client'  — user upload. Raw bytes are copied into IndexedDB (we own them).
 *  - 'bundle'  — a shipped reference package (Volve = bundle #1). The raw is already
 *                served from public/, so only the compressed digest is stored;
 *                `blobKey` points at the public path instead of a blob. */
export type AssetOrigin = 'client' | 'bundle';

/** One ingested file. Raw bytes are ALWAYS retained; digests are derived and cacheable. */
export interface IngestedAsset {
  id: string;                // ia-<sha256[0..12]>
  origin: AssetOrigin;
  fieldId: string;           // scoping key — never Volve-hardcoded
  vertical: Vertical;
  kind: AssetKind;
  format: AssetFormat;
  fileName: string;
  sha256: string;            // evidence anchor (consistent with knowledge/ ledger)
  bytes: number;
  blobKey: string;           // IndexedDB key for the raw bytes
  digestKey?: string;        // IndexedDB key for the compressed digest (GVSURF / log JSON)
  compressedBytes?: number;  // size after stage 3 — powers the compression readout
  meta: Record<string, string | number | null>;  // CRS, datum, units, ncol/nrow, curve list…
  qc: { status: 'pass' | 'warn' | 'fail'; exceptions: QcException[] };
  /** stage 4 — what this asset was linked to in the knowledge base */
  linked?: { entities: number; candidates: number; matched: string[] };
  osduId?: string;           // set once stage 5 emits
  uploadedAt: string;
  /** Shape version of the digest META (not the payload). Bumped when a new fact is
   *  recorded at digest time, so a reference package already sitting in IndexedDB
   *  re-digests instead of showing an inventory row with facts permanently missing. */
  digestVersion?: number;
}

/** Bump when digest.ts / bundle.ts start recording a new meta fact.
 *  2 — curve list on logs, TD/inclination/step-out on trajectories, depth range on surfaces.
 *  3 — inclination read via incl_deg where present (WITSML surveys store `incl` in
 *      radians, so v2 reported a 55° well as 1°). */
export const DIGEST_VERSION = 3;

/** Per-vertical gate verdict. Computed, never stored.
 *  'ready' = a reference package is loaded, digested and QC-clean — the workspace
 *  and agents can consume it. That is the normal state for Volve, and it is a
 *  positive statement, not an absence of requirements. */
export type GateStatus = 'ready' | 'not-required' | 'incomplete' | 'blocked' | 'passed';

export interface GateResult {
  status: GateStatus;
  reason: string;
  missing: AssetKind[];
  failing: number;           // count of fail-severity exceptions
}

/** What each vertical needs before its client-gated widgets may run.
 *  Exploration is deliberately empty — 0 of its 27 widgets are client-gated,
 *  so it is never gated (it runs on the world catalogue). */
export const REQUIRED_BY_VERTICAL: Record<Vertical, AssetKind[]> = {
  exploration: [],
  'field-development': ['log', 'surface'],
  'well-delivery': ['trajectory'],
  'reservoir-management': ['log'],
  'drilling-sequence': ['trajectory'],
};

export const PIPELINE_STAGES = [
  { id: 'raw', label: 'Raw', hint: 'hashed · retained' },
  { id: 'digested', label: 'Digested', hint: 'deterministic parse' },
  { id: 'compressed', label: 'Compressed', hint: 'web-ready' },
  { id: 'linked', label: 'Linked', hint: 'knowledge' },
  { id: 'osdu', label: 'OSDU', hint: 'governed record' },
] as const;
