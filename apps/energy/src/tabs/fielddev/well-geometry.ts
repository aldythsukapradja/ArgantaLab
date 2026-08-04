// well-geometry.ts — everything the well overlays are built from, loaded once per
// field. Lifted out of AssetDossier so the Data Explorer draws the SAME wells from
// the SAME digests rather than growing a second, drifting pipeline.
//
// ONE SOURCE. Every part of this comes out of the WORKSPACE (workspace.ts) — the
// ingested asset store — including the wellhead slots and the declared CRS, which
// used to be fetched separately from public/wb/index.json and are now an ingested
// `wellmaster` asset like everything else. The Input tree and these overlays
// therefore cannot disagree: they are the same query.
//
//   surveys  → the `trajectory` assets (station MD/TVD/offsets)
//   picks    → the single `picks` asset (formation tops)
//   slots    → the `wellmaster` asset's wellhead coordinates and declared CRS
//   series   → the `production` assets, for the hover card
//
// A field missing any of these simply yields fewer overlays. Never a placed guess.
import { readRecord } from '../../dataqc/readDigest';
import { getWorkspace } from './workspace';
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
  const ws = await getWorkspace(fieldId).catch(() => null);
  if (!ws?.bores.length) return null;

  const byId = new Map(ws.assets.map((a) => [a.id, a]));
  const trajAssets = ws.assets.filter((a) => a.kind === 'trajectory');
  const pickAsset = ws.assets.find((a) => a.kind === 'picks');

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

  // Only bores the workspace says HOLD a production asset are read — the series comes
  // from that asset's own digest, not from a parallel fetch of the raw file.
  const seriesEntries = await Promise.all(ws.bores
    .map((b) => ({ bore: b, id: b.assetIds.production ?? b.assetIds.injection }))
    .filter((e): e is { bore: typeof e.bore; id: string } => !!e.id)
    .map(async ({ bore, id }) => {
      const asset = byId.get(id);
      if (!asset) return null;
      const p = await readRecord<{ monthly?: WellMonth[]; units?: string }>(asset).catch(() => null);
      return p?.monthly?.length ? [bore.name, p] as const : null;
    }));

  const series = new Map<string, WellMonth[]>();
  let unit = '';
  for (const e of seriesEntries) {
    if (!e) continue;
    series.set(wellKey(e[0]), e[1].monthly as WellMonth[]);
    unit = unit || String(e[1].units ?? '');
  }
  // The reference month is the FIELD's last month, so a well that stopped in 2014
  // is not called active just because 2014 is its own final row.
  let refMonth: string | null = null;
  for (const m of series.values()) {
    const last = m[m.length - 1]?.ym;
    if (last && (!refMonth || last > refMonth)) refMonth = last;
  }

  return {
    // The delivery declares its CRS once, in the well master; the zone is parsed from
    // it rather than assumed — a field outside zone 31 would project a zone away.
    // 31 remains the last-resort fallback for a delivery that declares nothing.
    zone: ws.utmZone ?? 31,
    // Only bores the master gave a slot position: a survey with no origin cannot be
    // placed, and putting it at 0,0 would draw the field off the coast of Africa.
    wells: ws.bores
      .filter((b) => b.x != null && b.y != null)
      .map((b) => ({ name: b.name, x: b.x as number, y: b.y as number, role: b.role })),
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
