// dataqc/qc.ts — deterministic QC rules. Pure, isomorphic, no LLM.
// Every rule returns a typed QcException with a locator. Rules never repair data;
// they only report, because silently "fixing" a datum or CRS is how a plan ends up
// confidently wrong.
import type {
  AssetKind, DigestedLog, DigestedSurface, GateResult, IngestedAsset,
  QcException, Vertical,
} from './types.ts';
import { REQUIRED_BY_VERTICAL } from './types.ts';
import { curveFamily } from './parse/las.ts';

const ex = (rule: string, severity: QcException['severity'], message: string, locator: string, detail?: string): QcException =>
  ({ rule, severity, message, locator, detail });

/** Recognised depth references. Anything else is reported, not assumed. */
const DATUM_RX = /\b(TVDSS|TVD|MD|KB|RKB|GL|MSL|SS)\b/i;

/** Depth units we understand. `mm`/`cm` are real and appear in the wild (the Volve
 *  bundle has one well in millimetres) — recognised here, with the genuine hazard,
 *  MIXING units across a delivery, caught by qcConsistency instead. `<n> in` is a
 *  real Volve quirk too — DLIS depth channels on roughly half the composite wells
 *  declare a decimal-fraction-of-an-inch unit (e.g. "0.1 in") for integer-resolution
 *  encoding; kept in sync with depthToMetres() in ../units.ts. */
const DEPTH_UNIT_RX = /^(m|mm|cm|km|ft|f|meters?|metres?|feet|foot|[\d.]*\s*in(ch(es)?)?)$/i;

/** Normalised family for cross-asset comparison. */
export function depthUnitFamily(unit: string): string | null {
  const u = unit.trim().toLowerCase();
  if (/^(m|meters?|metres?)$/.test(u)) return 'm';
  if (u === 'mm') return 'mm';
  if (u === 'cm') return 'cm';
  if (u === 'km') return 'km';
  if (/^(ft|f|feet|foot)$/.test(u)) return 'ft';
  if (/^([\d.]*\s*)?in(ch(es)?)?$/.test(u)) return 'in';
  return null;
}

export interface QcLogOptions {
  /** false when values arrive as explicit nulls (structured/bundled data), so the
   *  LAS NULL-sentinel rule does not apply and must not raise a false warning. */
  sentinelApplicable?: boolean;
}

// ── logs ─────────────────────────────────────────────────────────────────────
export function qcLog(log: DigestedLog, warnings: string[] = [], opts: QcLogOptions = {}): QcException[] {
  const { sentinelApplicable = true } = opts;
  const out: QcException[] = [];
  for (const w of warnings) out.push(ex('las.parse', 'warn', w, 'file'));

  if (!log.md.length) out.push(ex('log.empty', 'fail', 'No depth samples parsed.', '~A'));
  if (!log.curves.length) out.push(ex('log.nocurves', 'fail', 'No curves besides depth.', '~C'));

  if (!log.depthUnit) {
    out.push(ex('units.depth.missing', 'fail', 'Depth unit not declared.', `~C ${log.depthMnemonic}`));
  } else if (!DEPTH_UNIT_RX.test(log.depthUnit.trim())) {
    out.push(ex('units.depth.unknown', 'warn', `Unrecognised depth unit "${log.depthUnit}".`, `~C ${log.depthMnemonic}`));
  }

  if (sentinelApplicable && log.nullValue === null) {
    out.push(ex('nulls.undeclared', 'warn', 'No NULL sentinel declared — blanks assumed missing.', '~W NULL'));
  }

  // monotonic depth is a hard requirement for every downstream consumer
  let nonMono = 0;
  for (let i = 1; i < log.md.length; i++) if (!(log.md[i] > log.md[i - 1])) nonMono++;
  if (nonMono > 0) {
    out.push(ex('log.depth.nonmonotonic', 'fail', `Depth is not strictly increasing (${nonMono} steps).`, '~A col 1'));
  }

  // datum: LAS has no standard field, so we look across the header
  const headerText = Object.entries(log.header).map(([k, v]) => `${k} ${v}`).join(' ');
  if (!DATUM_RX.test(headerText)) {
    out.push(ex('datum.missing', 'fail', 'Depth reference (MD/TVDSS/KB) not declared in the header.', '~W'));
  }

  for (const c of log.curves) {
    if (!c.unit) out.push(ex('units.curve.missing', 'warn', `Curve ${c.mnemonic} has no unit.`, `~C ${c.mnemonic}`));
    if (!curveFamily(c.mnemonic)) {
      out.push(ex('mnemonic.unmapped', 'info', `Mnemonic ${c.mnemonic} is not in the known family list.`, `~C ${c.mnemonic}`));
    }
    const total = c.values.length;
    const nulls = c.values.reduce<number>((acc, v) => acc + (v === null ? 1 : 0), 0);
    if (total > 0 && nulls === total) {
      out.push(ex('curve.allnull', 'warn', `Curve ${c.mnemonic} is entirely null.`, `~C ${c.mnemonic}`));
    }
  }
  return out;
}

// ── surfaces ─────────────────────────────────────────────────────────────────
export function qcSurface(s: DigestedSurface): QcException[] {
  const out: QcException[] = [];
  if (s.ncol < 2 || s.nrow < 2) {
    out.push(ex('grid.degenerate', 'fail', `Grid is degenerate (${s.ncol}×${s.nrow}).`, 'header'));
  }
  if (!(Math.abs(s.dx) > 0) || !(Math.abs(s.dy) > 0)) {
    out.push(ex('grid.spacing', 'fail', 'Cell spacing is zero or undefined.', 'header'));
  }
  let live = 0;
  for (let i = 0; i < s.values.length; i++) if (Number.isFinite(s.values[i])) live++;
  const coverage = s.values.length ? live / s.values.length : 0;
  if (live === 0) out.push(ex('grid.empty', 'fail', 'Grid has no live nodes.', 'body'));
  else if (coverage < 0.05) {
    out.push(ex('grid.sparse', 'warn', `Only ${(coverage * 100).toFixed(1)}% of nodes carry values.`, 'body'));
  }
  if (!s.zUnits) out.push(ex('units.z.missing', 'warn', 'Z unit not declared.', 'header'));
  return out;
}

// ── cross-asset consistency ──────────────────────────────────────────────────
/** CRS/datum must agree across the delivery. This is the rule that most often
 *  catches a genuinely dangerous client package. */
export function qcConsistency(assets: IngestedAsset[]): QcException[] {
  const out: QcException[] = [];
  const crsSeen = new Map<string, string[]>();
  const datumSeen = new Map<string, string[]>();

  for (const a of assets) {
    const crs = String(a.meta.crs ?? '').trim();
    const datum = String(a.meta.datum ?? '').trim();
    if (crs) { crsSeen.set(crs, [...(crsSeen.get(crs) ?? []), a.fileName]); }
    if (datum) { datumSeen.set(datum, [...(datumSeen.get(datum) ?? []), a.fileName]); }
  }

  const spatial = assets.filter((a) => a.kind === 'surface' || a.kind === 'trajectory' || a.kind === 'picks');
  if (spatial.length && crsSeen.size === 0) {
    out.push(ex('crs.missing', 'fail', 'No CRS declared on any spatial asset.', 'delivery',
      spatial.map((a) => a.fileName).join(', ')));
  }
  if (crsSeen.size > 1) {
    out.push(ex('crs.conflict', 'fail', `Conflicting CRS across the delivery (${crsSeen.size} values).`, 'delivery',
      [...crsSeen.entries()].map(([k, f]) => `${k}: ${f.join(', ')}`).join(' · ')));
  }
  if (datumSeen.size > 1) {
    out.push(ex('datum.conflict', 'fail', `Conflicting depth reference across the delivery (${datumSeen.size} values).`, 'delivery',
      [...datumSeen.entries()].map(([k, f]) => `${k}: ${f.join(', ')}`).join(' · ')));
  }

  // Mixed depth units across wells is the classic silent 1000× error. Each file
  // declaring its own unit is not dangerous — it just must be normalised before any
  // cross-well work — so this is a warning, not a block. Undeclared units are the
  // failure case, and qcLog already raises those per file.
  const unitSeen = new Map<string, string[]>();
  for (const a of assets) {
    if (a.kind !== 'log') continue;
    const fam = depthUnitFamily(String(a.meta.depthUnit ?? ''));
    if (fam) unitSeen.set(fam, [...(unitSeen.get(fam) ?? []), a.fileName]);
  }
  if (unitSeen.size > 1) {
    out.push(ex('units.depth.mixed', 'warn',
      `Delivery mixes depth units (${[...unitSeen.keys()].join(', ')}) — normalise before cross-well work.`,
      'delivery',
      [...unitSeen.entries()].map(([u, f]) => `${u}: ${f.length} file${f.length === 1 ? '' : 's'}`).join(' · ')));
  }

  // spatial extents must overlap — a surface in a different basin is a real client error
  const boxes = assets
    .filter((a) => a.meta.xmin != null && a.meta.xmax != null)
    .map((a) => ({ n: a.fileName, xmin: Number(a.meta.xmin), xmax: Number(a.meta.xmax), ymin: Number(a.meta.ymin), ymax: Number(a.meta.ymax) }));
  for (let i = 1; i < boxes.length; i++) {
    const a = boxes[0], b = boxes[i];
    const overlap = a.xmin <= b.xmax && b.xmin <= a.xmax && a.ymin <= b.ymax && b.ymin <= a.ymax;
    if (!overlap) {
      out.push(ex('extent.disjoint', 'fail', `Extent of ${b.n} does not overlap ${a.n}.`, 'delivery'));
    }
  }
  return out;
}

export const worstSeverity = (exs: QcException[]): 'pass' | 'warn' | 'fail' =>
  exs.some((e) => e.severity === 'fail') ? 'fail'
    : exs.some((e) => e.severity === 'warn') ? 'warn' : 'pass';

// ── the gate ─────────────────────────────────────────────────────────────────
/** Gate a vertical for a field. Reference cases and Exploration are never gated. */
export function gateFor(vertical: Vertical, assets: IngestedAsset[], dataMode: 'reference' | 'client'): GateResult {
  const required = REQUIRED_BY_VERTICAL[vertical];
  const kinds = new Set(assets.map((a) => a.kind));

  // A loaded reference package is a positive state, not an absence of requirements:
  // the data is digested, compressed and available to the workspace and agents.
  if (dataMode === 'reference' && assets.length > 0) {
    const failing = assets.reduce((n, a) => n + a.qc.exceptions.filter((e) => e.severity === 'fail').length, 0)
      + qcConsistency(assets).filter((e) => e.severity === 'fail').length;
    if (failing > 0) {
      return { status: 'blocked', reason: `${failing} blocking QC exception${failing === 1 ? '' : 's'} in the reference package.`, missing: [], failing };
    }
    const pkg = assets.find((a) => a.origin === 'bundle')?.meta.package;
    const label = typeof pkg === 'string' ? `${pkg} reference package` : 'Reference data';
    return {
      status: 'ready',
      reason: `${label} loaded · ${assets.length} assets digested, compressed and available to the workspace.`,
      missing: [], failing: 0,
    };
  }

  if (dataMode === 'reference' || required.length === 0) {
    return {
      status: 'not-required',
      reason: dataMode === 'reference'
        ? 'Reference case — runs on catalogue and analog data.'
        : 'This lifecycle has no client-gated widgets.',
      missing: [], failing: 0,
    };
  }
  const missing = required.filter((k) => !kinds.has(k)) as AssetKind[];
  const failing = assets.reduce((n, a) => n + a.qc.exceptions.filter((e) => e.severity === 'fail').length, 0)
    + qcConsistency(assets).filter((e) => e.severity === 'fail').length;

  if (missing.length) {
    return { status: 'incomplete', reason: `Awaiting ${missing.join(', ')}.`, missing, failing };
  }
  if (failing > 0) {
    return { status: 'blocked', reason: `${failing} blocking QC exception${failing === 1 ? '' : 's'}.`, missing: [], failing };
  }
  return { status: 'passed', reason: 'All required inputs present and QC-clean.', missing: [], failing: 0 };
}
