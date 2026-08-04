// workspace-model.ts — the PURE half of the workspace model.
//
// Split out from workspace.ts on purpose: workspace.ts reaches IndexedDB and imports
// masterkb.ts, which reads `import.meta.env` at module scope and therefore cannot be
// loaded by a plain node test runner (the same limitation documented on curate.ts and
// engine/sim/fv.ts). Everything in here is a pure function over plain data, so
// scripts/test-workspace.mjs can truth-lock the derivations directly.
//
// No fabrication anywhere: every function reports what its input contains, and says
// nothing when the input contains nothing.
import { wellKey } from '../../dataqc/audit.ts';
import { curveFamily } from '../../dataqc/parse/las.ts';
import type { WellRole, WellMetrics } from '../../dataqc/curate.ts';
import type { IngestedAsset } from '../../dataqc/types.ts';

export interface WorkspacePick {
  well: string | null;
  surface: string;
  md: number | null;
  tvdss?: number | null;
}

export interface WorkspaceContact {
  kind: string;
  tvdss: number | null;
  dataNature?: string;
  prov?: string;
}

/** One curve TYPE across the delivery — Petrel's "global well log". `mnemonics` are
 *  the raw names that mapped to this type; a `family` of null means the mnemonic
 *  matched no known family and stands alone under its own name rather than being
 *  forced into a neighbour's. */
export interface WorkspaceCurveType {
  /** display key: the curve family when one resolved, else the raw mnemonic */
  key: string;
  family: string | null;
  mnemonics: string[];
  /** wellbore display names carrying this curve type */
  wells: string[];
  unit: string | null;
}

/** One pick SURFACE across the delivery — the tops equivalent of a curve type. */
export interface WorkspaceTop {
  surface: string;
  /** wellbore display names with a pick for this surface */
  wells: string[];
  /** total picks for this surface, including any that carry no well name */
  count: number;
}

export interface WorkspaceTrajectory {
  well: string;
  assetId: string;
  stations: number;
  tdMdM: number | null;
  tdTvdM: number | null;
  maxInclDeg: number | null;
}

export interface WorkspaceSurface {
  id: string;
  assetId: string;
  name: string;
  zmin: number | null;
  zmax: number | null;
}

/** A single WELLBORE as the workspace sees it. */
export interface WorkspaceBore {
  key: string;
  name: string;
  role: WellRole;
  roleFromKb: boolean;
  /** wellhead position in the delivery's declared CRS; null when the master has none */
  x: number | null;
  y: number | null;
  hasLogs: boolean; hasTrajectory: boolean; hasPicks: boolean;
  hasProduction: boolean; hasInjection: boolean;
  hasDrilling: boolean; hasPressure: boolean;
  /** curve types this bore's own logs carry (keys into `Workspace.curveTypes`) */
  curves: string[];
  /** pick surfaces this bore has a top for */
  tops: string[];
  /** the asset behind each data type, for the viewers */
  assetIds: Partial<Record<IngestedAsset['kind'], string>>;
  metrics: WellMetrics | null;
  /** how many of the seven tracked data types this bore carries */
  completeness: number;
}

/** A surface SLOT and the bores drilled from it. */
export interface WorkspaceWellhead {
  well: string;
  role: WellRole;
  bores: WorkspaceBore[];
  metrics: WellMetrics | null;
}

export interface Workspace {
  fieldId: string;
  /** the delivery's declared coordinate system, from the well master */
  crs: string | null;
  datum: string | null;
  /** UTM zone parsed from the CRS — never assumed; null means "do not project" */
  utmZone: number | null;
  wellheads: WorkspaceWellhead[];
  /** flat bore list — the SAME objects that appear under `wellheads` */
  bores: WorkspaceBore[];
  curveTypes: WorkspaceCurveType[];
  tops: WorkspaceTop[];
  trajectories: WorkspaceTrajectory[];
  surfaces: WorkspaceSurface[];
  contacts: WorkspaceContact[];
  /** the raw picks, for callers that need depths rather than the inventory */
  picks: WorkspacePick[];
  /** every asset the field holds — what this whole model was derived from */
  assets: IngestedAsset[];
  /** field-wide assets with no owning wellbore: surfaces, the master, patterns, reports */
  fieldLevel: IngestedAsset[];
}

/** UTM zone from a declared CRS string. Null when the CRS names no zone — assuming
 *  31 would project a field in another zone hundreds of kilometres away. */
export function utmZoneOf(crs: string | null | undefined): number | null {
  const m = String(crs ?? '').match(/UTM\s*(?:zone\s*)?(\d{1,2})/i);
  const z = m ? Number(m[1]) : NaN;
  return Number.isFinite(z) && z >= 1 && z <= 60 ? z : null;
}

/**
 * Roll the delivery's picks into per-surface and per-well inventories.
 *
 * A pick with no well name is counted in its surface's total but cannot be
 * attributed — it is real data with an unusable key, so it is neither dropped nor
 * assigned to some arbitrary well.
 */
export function buildTops(picks: WorkspacePick[]): {
  tops: WorkspaceTop[];
  byWell: Map<string, string[]>;
  countByWell: Map<string, number>;
} {
  const bySurface = new Map<string, { wells: string[]; seen: Set<string>; count: number }>();
  const byWell = new Map<string, string[]>();
  const countByWell = new Map<string, number>();

  for (const p of picks) {
    const surface = String(p?.surface ?? '').trim();
    if (!surface) continue;
    let s = bySurface.get(surface);
    if (!s) { s = { wells: [], seen: new Set(), count: 0 }; bySurface.set(surface, s); }
    s.count++;
    const well = typeof p.well === 'string' ? p.well.trim() : '';
    if (!well) continue;
    if (!s.seen.has(well)) { s.seen.add(well); s.wells.push(well); }
    const k = wellKey(well);
    countByWell.set(k, (countByWell.get(k) ?? 0) + 1);
    const list = byWell.get(k);
    if (!list) byWell.set(k, [surface]);
    else if (!list.includes(surface)) list.push(surface);
  }

  // the surfaces picked in the most wells first — that is the correlation backbone
  const tops = [...bySurface.entries()]
    .map(([surface, s]) => ({ surface, wells: s.wells, count: s.count }))
    .sort((a, b) => b.wells.length - a.wells.length || a.surface.localeCompare(b.surface));
  return { tops, byWell, countByWell };
}

/**
 * Roll per-well curve lists into the delivery's global curve TYPES.
 *
 * Grouped by curve FAMILY where one resolves, so GR and its aliases read as one "GR"
 * type the way Petrel's global well logs do. A mnemonic with no family keeps its own
 * name — an unrecognised curve is an unrecognised curve, not a GR.
 */
export function buildCurveTypes(
  perWell: Array<{ well: string; curves: Array<{ mnemonic: string; family?: string | null; unit?: string | null }> }>,
): { curveTypes: WorkspaceCurveType[]; byWell: Map<string, string[]> } {
  const types = new Map<string, WorkspaceCurveType & { seen: Set<string> }>();
  const byWell = new Map<string, string[]>();

  for (const { well, curves } of perWell) {
    const mine: string[] = [];
    for (const c of curves ?? []) {
      const mnemonic = String(c?.mnemonic ?? '').trim();
      if (!mnemonic) continue;
      const family = c.family ?? curveFamily(mnemonic) ?? null;
      const key = family ?? mnemonic.toUpperCase();
      let t = types.get(key);
      if (!t) { t = { key, family, mnemonics: [], wells: [], unit: null, seen: new Set() }; types.set(key, t); }
      if (!t.mnemonics.includes(mnemonic)) t.mnemonics.push(mnemonic);
      if (!t.unit && c.unit) t.unit = String(c.unit);
      if (!t.seen.has(well)) { t.seen.add(well); t.wells.push(well); }
      if (!mine.includes(key)) mine.push(key);
    }
    byWell.set(wellKey(well), mine);
  }

  const curveTypes = [...types.values()]
    .map(({ seen: _seen, ...t }) => t)
    .sort((a, b) => b.wells.length - a.wells.length || a.key.localeCompare(b.key));
  return { curveTypes, byWell };
}

/**
 * The curve types present in EVERY one of the given wells.
 *
 * This is the question a correlation panel actually asks: which track can I draw
 * across all of these wells without a gap? Answered from the inventory, so a curve
 * missing in one well disqualifies it rather than producing a panel with a hole.
 */
export function commonCurveTypes(types: WorkspaceCurveType[], wells: string[]): string[] {
  if (!wells.length) return [];
  const keys = wells.map((w) => wellKey(w));
  return types
    .filter((t) => {
      const have = new Set(t.wells.map((w) => wellKey(w)));
      return keys.every((k) => have.has(k));
    })
    .map((t) => t.key);
}

/**
 * The pick surfaces present in every one of the given wells — the horizons a
 * correlation panel can actually flatten on.
 */
export function commonTops(tops: WorkspaceTop[], wells: string[]): string[] {
  if (!wells.length) return [];
  const keys = wells.map((w) => wellKey(w));
  return tops
    .filter((t) => {
      const have = new Set(t.wells.map((w) => wellKey(w)));
      return keys.every((k) => have.has(k));
    })
    .map((t) => t.surface);
}
