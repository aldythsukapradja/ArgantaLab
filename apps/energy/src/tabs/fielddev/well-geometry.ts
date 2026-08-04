// well-geometry.ts — everything the well overlays are built from, loaded once per
// field. Lifted out of AssetDossier so the Data Explorer draws the SAME wells from
// the SAME digests rather than growing a second, drifting pipeline.
//
// Sources, all of them already ingested — nothing here fetches a new thing:
//   surveys  → the `trajectory` assets Data QC digested (station MD/TVD/offsets)
//   picks    → the single `picks` asset (formation tops)
//   slots    → the bundle index's own wellhead coordinates and declared CRS
//   series   → the bundle's monthly production files, for the hover card
//
// A field missing any of these simply yields fewer overlays. Never a placed guess.
import { listAssets } from '../../dataqc/db';
import { readRecord } from '../../dataqc/readDigest';
import { loadIndex, loadProd } from '../../wb/load';
import type { FormationPick } from './horizon-picks';
import { wellKey, type PathStation, type PathWellhead } from './well-paths';
import type { WellMonth } from './well-stats';

export interface WellGeometry {
  zone: number;
  wells: PathWellhead[];
  surveys: Array<{ well: string; stations: PathStation[] }>;
  picks: FormationPick[];
  series: Map<string, WellMonth[]>;
  refMonth: string | null;
  unit: string;
}

export async function loadWellGeometry(fieldId: string): Promise<WellGeometry | null> {
  const [assets, index] = await Promise.all([
    listAssets(fieldId).catch(() => []),
    loadIndex().catch(() => null),
  ]);
  if (!index?.wells?.length) return null;

  const trajAssets = assets.filter((a) => a.kind === 'trajectory');
  const pickAsset = assets.find((a) => a.kind === 'picks');

  const [surveysRaw, picksRec] = await Promise.all([
    Promise.all(trajAssets.map(async (a) => {
      const rec = await readRecord<{ well?: string; stations?: PathStation[] }>(a).catch(() => null);
      const well = String(rec?.well ?? a.meta.well ?? '');
      return rec?.stations?.length && well ? { well, stations: rec.stations } : null;
    })),
    pickAsset
      ? readRecord<{ picks?: FormationPick[] }>(pickAsset).catch(() => null)
      : Promise.resolve(null),
  ]);

  // Only bores the index says publish production are read.
  const flowing = index.wells.filter((w) => w.has?.production);
  const seriesEntries = await Promise.all(flowing.map(async (w) => {
    const p = await loadProd(w.name).catch(() => null);
    return p?.monthly?.length ? [String(w.name), p] as const : null;
  }));

  const series = new Map<string, WellMonth[]>();
  let unit = '';
  for (const e of seriesEntries) {
    if (!e) continue;
    series.set(wellKey(e[0]), e[1].monthly as WellMonth[]);
    unit = unit || String((e[1] as { units?: string }).units ?? '');
  }
  // The reference month is the FIELD's last month, so a well that stopped in 2014
  // is not called active just because 2014 is its own final row.
  let refMonth: string | null = null;
  for (const m of series.values()) {
    const last = m[m.length - 1]?.ym;
    if (last && (!refMonth || last > refMonth)) refMonth = last;
  }

  return {
    // The bundle declares its CRS once, at the index level; parse the zone from it
    // rather than assuming 31 — a field outside zone 31 would project a zone away.
    zone: Number(String(index.crs ?? '').match(/UTM\s*(\d{1,2})/i)?.[1]) || 31,
    wells: index.wells.map((w) => ({ name: String(w.name), x: w.x, y: w.y, role: w.role })),
    surveys: surveysRaw.filter((s): s is { well: string; stations: PathStation[] } => !!s),
    picks: picksRec?.picks ?? [],
    series, refMonth, unit,
  };
}

/** A full wellbore path in PROJECTED metres, with true vertical depth per station —
 *  what a 3D scene needs. `buildWellPaths` is its map-only (x,y) sibling. */
export interface Path3D {
  well: string;
  role: string;
  /** [easting, northing, tvd] surface → TD. tvd is a positive depth. */
  points: Array<[number, number, number]>;
}

/**
 * Join wellheads to surveys and emit full 3D paths.
 *
 * A station needs a finite offset AND a finite TVD to be drawn — half a station is
 * not a point on a trajectory. Fewer than two survivors produces no path, because
 * one point is not a well path.
 */
export function buildPaths3D(geo: WellGeometry): Path3D[] {
  const heads = new Map<string, PathWellhead>();
  for (const w of geo.wells) {
    if (!Number.isFinite(w.x) || !Number.isFinite(w.y)) continue;
    heads.set(wellKey(w.name), w);
  }
  const out: Path3D[] = [];
  for (const s of geo.surveys) {
    const head = heads.get(wellKey(s.well));
    if (!head) continue;
    const x0 = head.x as number, y0 = head.y as number;
    const points: Array<[number, number, number]> = [];
    for (const st of s.stations ?? []) {
      const ew = Number(st.dispEw), ns = Number(st.dispNs), tvd = Number(st.tvd);
      if (!Number.isFinite(ew) || !Number.isFinite(ns) || !Number.isFinite(tvd)) continue;
      points.push([x0 + ew, y0 + ns, Math.abs(tvd)]);
    }
    if (points.length < 2) continue;
    out.push({ well: head.name, role: String(head.role ?? ''), points });
  }
  return out;
}
