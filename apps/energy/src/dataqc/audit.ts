// dataqc/audit.ts — data availability audit. Answers "which well has which data,
// and what is missing" from the assets actually ingested, so a gap is visible as
// a gap rather than as a silently absent row.
//
// Pure and deterministic: it reports presence, never infers or backfills. A well
// known to the Master KB but carrying no data appears as a fully-empty row —
// that absence IS the finding (Volve's 19-series exploration wells have logs and
// picks but no directional survey was ever published, which this makes explicit).
import type { AssetKind, IngestedAsset } from './types.ts';

/** Mirrors IngestedAsset['qc']['status'] — types.ts does not name it. */
export type QcStatus = IngestedAsset['qc']['status'];

export const AUDIT_COLUMNS = ['log', 'trajectory', 'picks', 'production', 'injection', 'document'] as const;
export type AuditColumn = (typeof AUDIT_COLUMNS)[number];

export const COLUMN_LABEL: Record<AuditColumn, string> = {
  log: 'Logs', trajectory: 'Trajectory', picks: 'Picks',
  production: 'Production', injection: 'Injection', document: 'Reports',
};

export interface AuditCell {
  present: boolean;
  /** measured from the asset — curve count, station count, months, never a guess */
  detail: string | null;
  status: QcStatus | null;
  /** the asset to open when the cell is clicked, when one backs it */
  assetId: string | null;
}

export interface AuditWellRow {
  well: string;
  key: string;
  cells: Record<AuditColumn, AuditCell>;
  /** how many of the tracked data types this well actually has */
  have: number;
  /** present in the Master KB wellbore spine */
  inKb: boolean;
}

export interface AuditFieldAsset {
  id: string;
  kind: AssetKind;
  name: string;
  detail: string | null;
  status: QcStatus;
}

export interface AuditResult {
  wells: AuditWellRow[];
  /** wells carrying that data type, per column */
  coverage: Record<AuditColumn, number>;
  wellCount: number;
  /** assets that describe the whole field, not one wellbore (surfaces, patterns, field production) */
  fieldLevel: AuditFieldAsset[];
  /** wells that have data but no Master KB wellbore record — a provenance gap */
  notInKb: string[];
  /** KB wellbores with no ingested data at all */
  emptyWells: string[];
}

/** Canonical wellbore key. Deliberately aggressive — it must equate the four
 *  spellings the same wellbore arrives under: the wb data ("F-15 A"), the Master
 *  KB id segment ("f-15-a"), and the raw forms a report's text carries
 *  ("15/9-F-15A", "NO 15/9-F-15 A"). Strips the quadrant/block prefix and every
 *  separator, so matching is exact-equality against the known well universe and
 *  a stray token like "19" simply matches nothing. */
export const wellKey = (s: string) => s
  .trim()
  .replace(/^NO\s+/i, '')
  .replace(/_/g, '/')
  .replace(/^15\/9-/, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '');

/** Field-wide rollups arrive with this sentinel in place of a wellbore. */
const FIELD_SENTINEL = /^(field|total|all)$/i;

const EMPTY_CELL: AuditCell = { present: false, detail: null, status: null, assetId: null };

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Per-kind one-line summary, measured from the asset's own digest metadata. */
function detailFor(a: IngestedAsset): string | null {
  const m = a.meta;
  switch (a.kind) {
    case 'log': {
      const c = num(m.curves), s = num(m.samples);
      if (c == null) return null;
      return `${c} curve${c === 1 ? '' : 's'}${s != null ? ` · ${s.toLocaleString('en-US')} samples` : ''}`;
    }
    case 'trajectory': {
      const n = num(m.records);
      return n == null ? null : `${n} station${n === 1 ? '' : 's'}`;
    }
    case 'production':
    case 'injection': {
      const mo = num(m.months);
      const span = m.firstMonth && m.lastMonth ? `${m.firstMonth}→${m.lastMonth}` : null;
      return [mo != null ? `${mo} months` : null, span].filter(Boolean).join(' · ') || null;
    }
    case 'document': {
      const p = num(m.pages), e = num(m.candidates);
      return [p != null ? `${p} pages` : null, e != null ? `${e} candidates` : null].filter(Boolean).join(' · ') || null;
    }
    case 'surface': {
      const c = num(m.ncol), r = num(m.nrow);
      return c != null && r != null ? `${c}×${r} grid` : null;
    }
    case 'picks': {
      const n = num(m.records);
      return n == null ? null : `${n} pick${n === 1 ? '' : 's'}`;
    }
    default: {
      const n = num(m.records);
      return n == null ? null : `${n} records`;
    }
  }
}

const cellFrom = (a: IngestedAsset, detail?: string | null): AuditCell => ({
  present: true,
  detail: detail !== undefined ? detail : detailFor(a),
  status: a.qc.status,
  assetId: a.id,
});

export interface AuditInput {
  assets: IngestedAsset[];
  /** Master KB wellbore ids (`atlas:wellbore:sodir:f-11-t2`) — the well universe
   *  this field is *expected* to have, so absence can be shown rather than omitted. */
  kbWellboreIds?: string[];
  /** picks live in one delivery-wide asset; the caller reads its digest and passes
   *  the per-well counts in. Absent map = picks simply not attributed. */
  picksByWell?: Map<string, number>;
  /** id of the asset the pick counts came from, so a picks cell can open it */
  picksAssetId?: string | null;
}

export function buildAudit({ assets, kbWellboreIds = [], picksByWell, picksAssetId = null }: AuditInput): AuditResult {
  const rows = new Map<string, AuditWellRow>();

  const ensure = (name: string, inKb: boolean): AuditWellRow => {
    const key = wellKey(name);
    let row = rows.get(key);
    if (!row) {
      row = {
        well: name, key, have: 0, inKb,
        cells: Object.fromEntries(AUDIT_COLUMNS.map((c) => [c, { ...EMPTY_CELL }])) as Record<AuditColumn, AuditCell>,
      };
      rows.set(key, row);
    }
    // a real asset name beats an id-derived placeholder
    if (inKb) row.inKb = true;
    return row;
  };

  // 1 · the expected universe from the Master KB, so a well with nothing still shows
  for (const id of kbWellboreIds) {
    const seg = id.split(':').pop() ?? id;
    ensure(seg.toUpperCase(), true);
  }

  // 2 · what is actually ingested
  const fieldLevel: AuditFieldAsset[] = [];
  for (const a of assets) {
    const rawWell = typeof a.meta.well === 'string' ? a.meta.well.trim() : '';
    // a field rollup (`prod-field.json` carries well:"FIELD") is not a wellbore
    const wellName = FIELD_SENTINEL.test(rawWell) ? '' : rawWell;

    // Anything without a wellbore describes the field, not one well — surfaces,
    // the field production rollup, and reports (a report is field-level AND, via
    // the entity links below, attributed to every wellbore it discusses).
    // Delivery-wide picks are the exception: once attributed per well they stop
    // being a field-level row.
    if (!wellName && (a.kind !== 'picks' || !picksByWell?.size)) {
      fieldLevel.push({
        id: a.id, kind: a.kind,
        name: String(a.meta.title ?? a.fileName),
        detail: detailFor(a), status: a.qc.status,
      });
    }

    if (wellName) {
      const key = wellKey(wellName);
      const existing = rows.get(key);
      const row = existing ?? ensure(wellName, false);
      // prefer the human name carried by the data over the KB id placeholder
      if (existing && existing.well !== wellName && /^[A-Z0-9-]+$/.test(existing.well)) existing.well = wellName;

      const col: AuditColumn | null =
        a.kind === 'log' ? 'log'
        : a.kind === 'trajectory' ? 'trajectory'
        : a.kind === 'production' ? 'production'
        : a.kind === 'injection' ? 'injection'
        : a.kind === 'document' ? 'document'
        : a.kind === 'picks' ? 'picks'
        : null;
      if (col) row.cells[col] = cellFrom(a);

      // a producer that also injects carries both — surface the injected volume
      // rather than letting it hide inside the production cell
      if (a.kind === 'production') {
        const inj = num(a.meta.cumInjectedSm3);
        if (inj != null && inj > 0) {
          row.cells.injection = cellFrom(a, `${(inj / 1e6).toFixed(2)} MMSm³ injected`);
        }
      }
    }

    // Documents name the wells they discuss through deterministic entity
    // matching. Entities arrive in raw source spelling ("15/9-19A"), so they are
    // resolved through the same canonical key — a hit only counts when it lands
    // on a wellbore that already exists, never by creating one from prose.
    if (a.kind === 'document' && a.linked?.matched?.length) {
      for (const m of a.linked.matched) {
        const row = rows.get(wellKey(m));
        if (row && !row.cells.document.present) {
          row.cells.document = cellFrom(a, String(a.meta.title ?? a.fileName));
        }
      }
    }
  }

  // 3 · picks, attributed from the delivery-wide picks asset
  if (picksByWell) {
    for (const [key, n] of picksByWell) {
      const row = rows.get(key);
      if (!row || n <= 0) continue;
      row.cells.picks = { present: true, detail: `${n} pick${n === 1 ? '' : 's'}`, status: 'pass', assetId: picksAssetId };
    }
  }

  const wells = [...rows.values()];
  for (const r of wells) r.have = AUDIT_COLUMNS.filter((c) => r.cells[c].present).length;
  wells.sort((a, b) => (b.have - a.have) || a.well.localeCompare(b.well, 'en', { numeric: true }));

  const coverage = Object.fromEntries(
    AUDIT_COLUMNS.map((c) => [c, wells.filter((w) => w.cells[c].present).length]),
  ) as Record<AuditColumn, number>;

  return {
    wells,
    coverage,
    wellCount: wells.length,
    fieldLevel: fieldLevel.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)),
    notInKb: wells.filter((w) => !w.inKb && w.have > 0).map((w) => w.well),
    emptyWells: wells.filter((w) => w.have === 0).map((w) => w.well),
  };
}
