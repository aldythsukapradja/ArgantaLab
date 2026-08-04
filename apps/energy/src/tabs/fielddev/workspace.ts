// workspace.ts — THE WORKSPACE QUERY. One source, read once per field.
//
// WHY THIS EXISTS. Before this module the Input tree, the map overlays and the Field
// Manager each assembled their own picture of the delivery: the tree counted wells
// from public/wb/index.json, the overlays read trajectories out of IndexedDB, the
// Field Manager curated a third view. Three readers, three shapes, and nothing
// forcing them to agree — so a well could be listed in the tree and missing from the
// map, and the only way to notice was to look at both.
//
// Now there is ONE query. `getWorkspace(fieldId)` reads the ingested asset store —
// the workspace's own store, the one the Data Explorer fills — and derives
// everything from it:
//
//   wells        wellhead slots → bores, each with role, wellhead position and the
//                asset ids for its trajectory, logs, tops, production, drilling,
//                pressure
//   curveTypes   the curve TYPES actually present, read from the log digests
//                themselves (not from a meta string), with which wells carry each
//   tops         the pick SURFACES actually present, per-surface and per-well
//   trajectories per-well station counts, TD in MD/TVD, maximum inclination
//   surfaces     the ingested depth grids
//   contacts     the delivery's fluid contacts
//
// NOTHING here fetches from public/. The well master — slots, genealogy, regulator
// role, declared CRS, contacts — is itself an ingested `wellmaster` asset (see
// bundle.ts). That is what makes this a single source rather than a store plus a
// side channel.
//
// Absence is reported as absence. A field whose delivery carries no trajectories
// yields `trajectories: []` and every bore reads `hasTrajectory: false` — never a
// synthesised path, and never a count taken from a capability flag instead of a file.
import { useEffect, useState } from 'react';
import { listAssets } from '../../dataqc/db';
import { readRecord } from '../../dataqc/readDigest';
import { wellKey } from '../../dataqc/audit';
import { curateInventory, type WellRole, type WellheadSpec, type WellMetrics } from '../../dataqc/curate';
import { resolveKbContext, type KbContext } from '../../dataqc/masterkb';
import type { DigestedLog, IngestedAsset } from '../../dataqc/types';
import { useScene } from './scene';
import {
  buildCurveTypes, buildTops, utmZoneOf,
  type Workspace, type WorkspaceBore, type WorkspaceContact, type WorkspacePick,
  type WorkspaceSurface, type WorkspaceTrajectory, type WorkspaceWellhead,
} from './workspace-model';

export * from './workspace-model';

interface PicksPayload { picks?: WorkspacePick[] }

interface WellMasterPayload {
  crs?: string;
  datum?: string;
  wells?: Array<{
    name: string; x?: number; y?: number;
    role?: string; purpose?: string | null;
    metrics?: WellMetrics;
  }>;
  wellheads?: WellheadSpec[];
  contacts?: WorkspaceContact[];
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** An empty workspace is a real state — the folders exist and are waiting for a
 *  delivery. That is a different statement from "this field does not exist". */
export function emptyWorkspace(fieldId: string): Workspace {
  return {
    fieldId, crs: null, datum: null, utmZone: null,
    wellheads: [], bores: [], curveTypes: [], tops: [],
    trajectories: [], surfaces: [], contacts: [], picks: [],
    assets: [], fieldLevel: [],
  };
}

/** Resolve, or give up and carry on.
 *
 *  The KB spine is 5 MB of stratigraphy and it only ENRICHES the workspace — it
 *  names rock units, it does not decide what the delivery contains. Awaiting it
 *  unconditionally meant one slow or stalled fetch could hold the entire Input
 *  tree on "reading…" with a zero beside every folder, reporting a delivery that
 *  is sitting right there in the asset store. The inventory must not wait on the
 *  enrichment; a workspace without KB context is degraded, not wrong. */
function optional<T>(p: Promise<T>, ms = 6000): Promise<T | null> {
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((r) => { setTimeout(() => r(null), ms); }),
  ]);
}

export async function loadWorkspace(fieldId: string): Promise<Workspace> {
  const [assets, kb] = await Promise.all([
    listAssets(fieldId).catch(() => [] as IngestedAsset[]),
    optional(resolveKbContext(fieldId)) as Promise<KbContext | null>,
  ]);
  if (!assets.length) return emptyWorkspace(fieldId);

  // ── the well master: slots, genealogy, regulator role, CRS, contacts ────────
  const masterAsset = assets.find((a) => a.kind === 'wellmaster');
  const master = masterAsset
    ? await readRecord<WellMasterPayload>(masterAsset).catch(() => null)
    : null;

  const slots = new Map<string, { x: number | null; y: number | null }>();
  const rolesByBore = new Map<string, WellRole>();
  const metricsByBore = new Map<string, WellMetrics>();
  for (const w of master?.wells ?? []) {
    const k = wellKey(w.name);
    slots.set(k, { x: num(w.x), y: num(w.y) });
    // the regulator's published purpose, already resolved to a role by the build —
    // the authority for what a bore is FOR, above anything inferred from the data
    if (w.role && w.role !== 'none') rolesByBore.set(k, w.role as WellRole);
    if (w.metrics) metricsByBore.set(k, w.metrics);
  }

  // ── the tops: one delivery-wide picks asset, attributed per well ────────────
  const picksAsset = assets.find((a) => a.kind === 'picks');
  const picksRec = picksAsset ? await readRecord<PicksPayload>(picksAsset).catch(() => null) : null;
  const picks = picksRec?.picks ?? [];
  const { tops, byWell: topsByWell, countByWell: picksByWell } = buildTops(picks);

  // ── the logs: curve types read from the DIGESTS, not from a meta string ─────
  const logAssets = assets.filter((a) => a.kind === 'log');
  const perWellCurves = (await Promise.all(logAssets.map(async (a) => {
    const log = await readRecord<DigestedLog>(a).catch(() => null);
    const well = String(log?.well ?? a.meta.well ?? '').trim();
    if (!well || !log?.curves?.length) return null;
    return {
      well,
      curves: log.curves.map((c) => ({ mnemonic: c.mnemonic, family: c.family ?? null, unit: c.unit })),
    };
  }))).filter((v): v is { well: string; curves: Array<{ mnemonic: string; family: string | null; unit: string }> } => !!v);
  const { curveTypes, byWell: curvesByWell } = buildCurveTypes(perWellCurves);

  // ── the trajectories: measured facts already recorded at digest time ────────
  const trajectories: WorkspaceTrajectory[] = assets
    .filter((a) => a.kind === 'trajectory')
    .map((a) => ({
      well: String(a.meta.well ?? '').trim(),
      assetId: a.id,
      stations: num(a.meta.records) ?? 0,
      tdMdM: num(a.meta.tdMdM),
      tdTvdM: num(a.meta.tdTvdM),
      maxInclDeg: num(a.meta.maxInclDeg),
    }))
    .filter((t) => t.well)
    .sort((a, b) => a.well.localeCompare(b.well, 'en', { numeric: true }));

  const surfaces: WorkspaceSurface[] = assets
    .filter((a) => a.kind === 'surface')
    .map((a) => ({
      id: a.id, assetId: a.id,
      name: String(a.meta.name ?? a.fileName),
      zmin: num(a.meta.zmin), zmax: num(a.meta.zmax),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // ── the wells: curated by the SAME rules the Field Manager uses ─────────────
  const curated = curateInventory(assets, kb, {
    picksByWell, picksAssetId: picksAsset?.id ?? null,
    wellheads: master?.wellheads,
    rolesByBore: rolesByBore.size ? rolesByBore : undefined,
    metricsByBore: metricsByBore.size ? metricsByBore : undefined,
  });

  const bores: WorkspaceBore[] = [];
  const boreByKey = new Map<string, WorkspaceBore>();
  for (const g of curated.groups) {
    const slot = slots.get(g.key);
    const assetIds: WorkspaceBore['assetIds'] = {};
    for (const a of g.assets) assetIds[a.kind] = a.id;
    // picks are field-wide; the bore points at the shared asset, which is honest —
    // there is no per-well picks file to open
    if (g.picksAssetId) assetIds.picks = g.picksAssetId;
    const bore: WorkspaceBore = {
      key: g.key, name: g.well, role: g.role, roleFromKb: g.roleFromKb,
      x: slot?.x ?? null, y: slot?.y ?? null,
      hasLogs: g.hasLogs, hasTrajectory: g.hasTrajectory, hasPicks: g.hasPicks,
      hasProduction: g.hasProduction, hasInjection: g.hasInjection,
      hasDrilling: g.hasDrilling, hasPressure: g.hasPressure,
      curves: curvesByWell.get(g.key) ?? [],
      tops: topsByWell.get(g.key) ?? [],
      assetIds,
      metrics: metricsByBore.get(g.key) ?? null,
      completeness: g.completeness,
    };
    bores.push(bore);
    boreByKey.set(g.key, bore);
  }

  // the wellhead's bores are the SAME objects as in `bores` — one identity, so a
  // selection made against either list matches in both
  const wellheads: WorkspaceWellhead[] = curated.wellheads.map((h) => ({
    well: h.well,
    role: h.role,
    bores: h.bores.map((b) => boreByKey.get(b.key)).filter((b): b is WorkspaceBore => !!b),
    metrics: h.metrics,
  }));

  const crs = master?.crs ? String(master.crs) : null;
  return {
    fieldId,
    crs,
    datum: master?.datum ? String(master.datum) : null,
    utmZone: utmZoneOf(crs),
    wellheads, bores,
    curveTypes, tops, trajectories, surfaces,
    contacts: master?.contacts ?? [],
    picks,
    assets,
    fieldLevel: curated.fieldLevel,
  };
}

// ── shared instance ──────────────────────────────────────────────────────────
//
// The tree, the map, Petrophysics and the analytics tabs all want this and must all
// get the SAME object — two mounts deriving it twice is how they start disagreeing.
// Keyed by field AND by the scene's dataVersion, so a package that finishes digesting
// invalidates it instead of leaving a stale, half-empty model in place forever.
const cache = new Map<string, Promise<Workspace>>();

export function getWorkspace(fieldId: string, dataVersion = 0): Promise<Workspace> {
  const key = `${fieldId}#${dataVersion}`;
  let p = cache.get(key);
  if (!p) {
    p = loadWorkspace(fieldId);
    cache.set(key, p);
    // only the current version can be asked for again; earlier ones are dead weight
    for (const k of [...cache.keys()]) {
      if (k !== key && k.startsWith(`${fieldId}#`)) cache.delete(k);
    }
  }
  return p;
}

/**
 * Subscribe to the workspace for the field the scene is currently on.
 *
 * `ready` distinguishes "still loading" from "loaded and genuinely empty" — a tree
 * that renders zeros while the package is still digesting is lying about the
 * delivery, so callers need to be able to say "counting…" instead.
 */
export function useWorkspace(): { ws: Workspace; ready: boolean } {
  const fieldId = useScene((s) => s.fieldId);
  const dataVersion = useScene((s) => s.dataVersion);
  const [state, setState] = useState<{ ws: Workspace; ready: boolean }>(
    () => ({ ws: emptyWorkspace(fieldId ?? ''), ready: false }),
  );

  useEffect(() => {
    if (!fieldId) { setState({ ws: emptyWorkspace(''), ready: false }); return; }
    let alive = true;
    setState((prev) => ({ ...prev, ready: false }));
    getWorkspace(fieldId, dataVersion)
      .then((ws) => { if (alive) setState({ ws, ready: true }); })
      .catch(() => { if (alive) setState({ ws: emptyWorkspace(fieldId), ready: true }); });
    return () => { alive = false; };
  }, [fieldId, dataVersion]);

  return state;
}
