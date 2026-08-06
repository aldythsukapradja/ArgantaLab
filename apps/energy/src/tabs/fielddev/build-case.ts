// build-case.ts — run a whole static model from a recipe, in the browser.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
//
// `grid-versions` stores a RECIPE. Storing a recipe is the right call — a realisation
// rebuilds deterministically from its seed, and keeping megabytes of derived cells to
// avoid that is a trade this project does not need. But a recipe nobody can APPLY is
// just a note about a model that does not exist, which is exactly what v0 was: a record
// in IndexedDB, a version in a dropdown, and an empty viewport.
//
// So this is the missing half. It orchestrates the same pure modules the process
// dialogs drive — `buildZoneModel`, `buildPackedGrid`, `blockWellPath`, `simulateGrid`,
// `writePackedProps`, `gridVolumes` — from one recipe, start to finish, and reports
// progress so a 10-second build is a progress bar rather than a frozen tab.
//
// It is a second ORCHESTRATION of the same primitives, not a second implementation. If
// the physics ever differs between this and the dialogs, one of them is wrong.
import { readRecord, readSurfaceGrid } from '../../dataqc/readDigest';
import type { DigestedLog, DigestedSurface } from '../../dataqc/types';
import { depthToMetres } from '../../units';
import { phiToK, fitPhiK } from '../../engine/perm';
import { buildZoneModel, type HorizonGrid } from './zone-model';
import { buildPackedGrid, layerSpan, zoneSurfaces, type BuiltGrid } from './grid-build';
import { repairZones, reweldStack } from './zone-repair';
import { runPetro, DEFAULT_PARAMS, resolvePublishedArchie, type PetroParams } from './petro-compute';
import {
  blockWellPath, placeSamples, mdToPoint,
  type ColumnLayers, type LogSample, type TrajStation, type UpscaledCell, type PermAverage,
} from './upscale-grid';
import { simulateGrid, type SimConditioning, type SimResult } from './sim-grid';
import { writePackedProps, sourcesFromSim, ensureProp, hcpvSource } from './grid-props';
import { applyPublishedShf, SCAL_ANALOGUE, swAtHeight, pcEntryPressure, fitCuddy, cuddySw } from './fluid-model';
import { gridVolumes, reconcile, type VolumeCell } from './volumes';
import { analyseVariogram, fitVerticalTrend } from './variogram-analysis';
import { depthConvention } from './StructureLayer';
import type { Workspace } from './workspace-model';

export interface CaseRecipe {
  /** horizon ids, stratigraphic order. Empty means "the reservoir interval". */
  horizons: string[];
  nzPerZone: number;
  layerScheme: 'proportional' | 'top-conform' | 'base-conform';
  seed: number;
  simNodes: number;
  permAverage: PermAverage;
  owc?: number;
}

export interface CaseProgress { step: string; done: number; total: number }

export interface CaseResult {
  grid: BuiltGrid;
  upscaled: { cells: UpscaledCell[]; permAverage: PermAverage; skipped: Array<{ well: string; why: string }>; thinCells: number };
  sim: SimResult | null;
  volumes: ReturnType<typeof reconcile> | null;
  reservoirZones: string[];
  /** what the run actually used, so the report can quote it */
  params: PetroParams;
  permFit: { a: number; b: number; n: number } | null;
  /** the MEASURED spatial structure, and whether it could be measured at all */
  vario: {
    range: number; nugget: number; sill: number; model: string;
    azimuthDeg?: number; ratio?: number;
    fitted: boolean; reason?: string; bins: number; pairs: number;
  } | null;
  cuddy: { a: number; b: number; r2: number; n: number } | null;
  warnings: string[];
}

/**
 * The petrophysical parameters a real case is built with.
 *
 * NOT `DEFAULT_PARAMS`. Two of its defaults are wrong for any real reservoir:
 *  · ρfl = 1.00 is FRESH WATER, and φ_D = (ρma − ρb)/(ρma − ρfl) under-reads every
 *    porosity by ~7% when the denominator is wrong;
 *  · the 0.08 porosity cutoff — measured inside the Volve reservoir, φ ≥ 0.05
 *    reproduces the published net-to-gross exactly.
 * ρma stays at quartz 2.65: raising it would flatter the answer with no measurement
 * behind it.
 */
export function caseParams(ws: Workspace): PetroParams {
  const rhoWater = ws.pvt?.density_kgm3?.water;
  const base: PetroParams = {
    ...DEFAULT_PARAMS,
    // read from the delivery when it states a brine density; 1.1013 is Volve's
    rhoFl: Number.isFinite(rhoWater as number) ? (rhoWater as number) / 1000 : 1.1013,
    cutoffs: { ...DEFAULT_PARAMS.cutoffs, phie: 0.05 },
  };
  // the delivery's own Archie evaluation, where it publishes one
  return resolvePublishedArchie(base, ws.shf?.archie ? { ...ws.shf.archie, brine: ws.shf.brine } : null,
    ws.pvt?.T ?? null);
}

/** Layer spans for one column, from each zone's OWN surfaces. */
function layersOf(built: BuiltGrid, i: number, j: number): ColumnLayers | null {
  const p = built.packed;
  const c = j * p.nx + i;
  if (!p.activeCol[c]) return null;
  const spans: Array<[number, number]> = [];
  let any = false;
  for (let k = 0; k < p.nz; k++) {
    const sp = layerSpan(built, c, k);
    if (sp) { spans.push([sp.top, sp.base]); any = true; } else spans.push([NaN, NaN]);
  }
  return any ? { spans } : null;
}

/** Yield to the browser so a long build paints rather than freezing. */
const breathe = () => new Promise((r) => setTimeout(r, 0));

export async function buildCase(
  ws: Workspace,
  recipe: CaseRecipe,
  onProgress?: (p: CaseProgress) => void,
): Promise<CaseResult> {
  const warnings: string[] = [];
  const say = (step: string, done: number, total: number) => onProgress?.({ step, done, total });

  // ── 1 · horizons ──
  say('reading horizons', 0, 6);
  const wanted = recipe.horizons.length
    ? ws.surfaces.filter((s) => recipe.horizons.includes(s.id))
    // no explicit interval: the reservoir and its seal, not the whole column. A grid
    // built from the seabed down spends 3.4 km of section to hold a 70 m reservoir.
    : ws.surfaces.filter((s) => /bcu|hugin/i.test(s.name));
  const withDepth = wanted
    .map((s) => ({ s, mid: s.zmin != null && s.zmax != null ? (Math.abs(s.zmin) + Math.abs(s.zmax)) / 2 : Infinity }))
    .sort((a, b) => a.mid - b.mid);

  const horizons: HorizonGrid[] = [];
  for (const { s } of withDepth) {
    const asset = ws.assets.find((a) => a.id === s.assetId);
    if (!asset) continue;
    const g = (await readSurfaceGrid(asset).catch(() => null)) as DigestedSurface | null;
    if (!g) continue;
    horizons.push({
      id: s.id, name: s.name, ncol: g.ncol, nrow: g.nrow, values: g.values,
      x0: g.x0, y0: g.y0, dx: g.dx, dy: g.dy,
      flip: depthConvention(g.values)?.flip ?? false,
    });
  }
  if (horizons.length < 2) throw new Error('At least two horizons are needed to define a zone.');

  // ── 2 · zones + grid ──
  say('building the grid', 1, 6);
  await breathe();
  const model = buildZoneModel(horizons, { kind: recipe.layerScheme, nz: recipe.nzPerZone });
  if (!model) throw new Error('These horizons produce no zone with a positive thickness anywhere.');
  const built = await buildPackedGrid(model);
  const p = built.packed;

  // repair degenerate geometry before anything is built on it — a base above its top is
  // negative pore volume, and a simulator refuses the deck
  const repair = repairZones(built.zoneLayers, p.nx, p.ny, p.activeCol, {
    zones: built.zoneLayers.map((z) => z.name),
    minThickM: 0.5 * recipe.nzPerZone,
    cellAreaM2: p.dx * p.dy,
  });
  reweldStack(built.zoneLayers, p.nx * p.ny, p.activeCol);
  if (repair.totalRepaired) {
    warnings.push(`${repair.totalRepaired} columns rebuilt from the zone isochore (+${(repair.addedFraction * 100).toFixed(2)}% bulk volume)`);
  }

  // which layers are the RESERVOIR — the interval whose TOP is the reservoir top, not
  // every zone whose name mentions it
  const layerZone: string[] = [];
  for (const zl of built.zoneLayers) for (let k = 0; k < zl.nz; k++) layerZone[zl.k0 + k] = zl.name;
  const reservoirZones = built.zoneLayers.map((z) => z.name).filter((n) => /^hugin[^→]*top\s*→/i.test(n));
  const resSet = new Set(reservoirZones);
  const resLayers: number[] = [];
  for (let k = 0; k < p.nz; k++) if (resSet.has(layerZone[k])) resLayers.push(k);

  // ── 3 · interpret + block the logs ──
  const params = caseParams(ws);
  const todo = ws.bores.filter((b) => b.hasLogs && b.assetIds.log && b.x != null && b.y != null);
  const cells: UpscaledCell[] = [];
  const skipped: Array<{ well: string; why: string }> = [];
  const phis: number[] = [], perms: number[] = [];
  const shfSamples: Array<{ h: number; sw: number; phi: number }> = [];
  const owc = recipe.owc ?? ws.contacts.find((c) => c.tvdss != null)?.tvdss;
  const owcM = owc != null ? Math.abs(owc) : null;

  let n = 0;
  for (const bore of todo) {
    say(`scaling up ${bore.name}`, 2, 6);
    n++;
    const asset = ws.assets.find((a) => a.id === bore.assetIds.log);
    if (!asset) continue;
    const log = await readRecord<DigestedLog>(asset).catch(() => null);
    if (!log?.md?.length) continue;

    // THE DELIVERY MIXES DEPTH UNITS — convert by the log's own declared unit, always
    const f = depthToMetres(1, log.depthUnit);
    if (f == null) { skipped.push({ well: bore.name, why: `unknown depth unit "${log.depthUnit}"` }); continue; }
    const mdM = log.md.map((v) => v * f);
    const byFam = (fa: string) => log.curves.find((c) => c.family === fa);
    const byMnem = (m: string) => log.curves.find((c) => c.mnemonic.toUpperCase() === m);
    const klogh = (byFam('PERM') ?? byMnem('KLOGH'))?.values;

    const res = runPetro({
      md: mdM,
      gr: byFam('GR')?.values, rt: (byFam('RT') ?? byFam('RXO'))?.values,
      rhob: byFam('RHOB')?.values, nphi: byFam('NPHI')?.values, dt: byFam('DT')?.values,
      grMin: byMnem('GRMIN')?.values, grMax: byMnem('GRMAX')?.values,
      klogh,
    }, params);

    const tAsset = bore.assetIds.trajectory ? ws.assets.find((a) => a.id === bore.assetIds.trajectory) : null;
    const traj = tAsset ? await readRecord<{ stations?: TrajStation[] }>(tAsset).catch(() => null) : null;
    const raw = traj?.stations ?? [];
    if (!raw.length) { skipped.push({ well: bore.name, why: 'no directional survey' }); continue; }

    // TVD IS NOT TVDSS — a survey reports depth below the rig floor, the grid is sub-sea
    const kbM = bore.kbM ?? 0;
    const stations = raw.map((st) => ({ ...st, tvd: st.tvd - kbM }));
    const lastMd = stations.reduce((a, st) => (Number.isFinite(st.md) && st.md > a ? st.md : a), -Infinity);

    // harvest for the φ–k fit and the saturation-height fit while we are here
    for (let i = 0; i < mdM.length; i++) {
      const ph = res.phie[i];
      if (klogh && ph != null && res.netRes[i]) {
        const k = klogh[i];
        if (k != null && Number.isFinite(k) && k > 0.01 && ph > 0.03) { phis.push(ph); perms.push(k as number); }
      }
      if (owcM != null && res.netRes[i] && ph != null && res.sw[i] != null) {
        const tvd = mdToPoint(stations, mdM[i]).tvd;
        const h = owcM - tvd;
        if (h > 0) shfSamples.push({ h, sw: res.sw[i] as number, phi: ph });
      }
    }

    const samples: LogSample[] = mdM.map((md, i) => ({
      md, tvdss: md, vsh: res.vsh[i], phie: res.phie[i], sw: res.sw[i],
      // NET RESERVOIR, never net PAY — `ntg` multiplies a (1−Sw) term downstream, so
      // filtering it on saturation as well removes the water twice
      net: res.netRes[i],
    }));
    // never extrapolate past the survey: a sample with no survey to place it is not a
    // sample. Volve's F-15 A ran 588 m past its last station and landed 599 m out.
    const placed = placeSamples({ x: bore.x as number, y: bore.y as number }, stations, samples)
      .filter((s) => s.md <= lastMd + 50);
    if (!placed.length) { skipped.push({ well: bore.name, why: 'no sample lies within the survey' }); continue; }

    const r = blockWellPath(
      { name: bore.name, samples: placed },
      { nx: p.nx, ny: p.ny, dx: p.dx, dy: p.dy, x0: p.x0, y0: p.y0 },
      (i, j) => layersOf(built, i, j),
      { permAverage: recipe.permAverage, phiToK: (phi) => phiToK(phi, 19, -1.5) },
    );
    cells.push(...r.cells);
    if (!r.cells.length) skipped.push({ well: bore.name, why: 'no sample fell inside a layer' });
    if (n % 4 === 0) await breathe();
  }

  // φ–k FITTED on the measured curve where the delivery ships one
  const permFit = phis.length >= 200 ? (() => {
    const fit = fitPhiK(phis, perms);
    return fit ? { a: fit.a, b: fit.b, n: phis.length } : null;
  })() : null;
  if (!permFit) warnings.push('φ–k transform is an ANALOGUE — no permeability curve to fit against');

  // ── 4 · simulate ──
  say('simulating facies and porosity', 3, 6);
  await breathe();
  const byLayer = new Map<number, SimConditioning[]>();
  for (const c of cells) {
    const list = byLayer.get(c.k);
    const d: SimConditioning = { i: c.i, j: c.j, k: c.k, facies: c.facies, phie: c.phie, ntg: c.ntgKnown ? c.ntg : undefined };
    if (list) list.push(d); else byLayer.set(c.k, [d]);
  }
  // ── THE VARIOGRAM, MEASURED ──
  //
  // Every simulation in this project ran on a hardcoded `range 800` that nobody chose by
  // looking at the data. The range controls how far a value propagates from a well, so
  // on a field with nine flowing wells it does more work than almost any other input.
  // Measured here from the blocked cells; if the data cannot support a fit, the fallback
  // is used and SAID SO rather than presented as a finding.
  const varioPts = cells
    .filter((c) => Number.isFinite(c.phie))
    .map((c) => ({ x: p.x0 + (c.i + 0.5) * p.dx, y: p.y0 + (c.j + 0.5) * p.dy, v: c.phie }));
  const analysis = varioPts.length >= 30 ? analyseVariogram(varioPts, { nDirections: 6 }) : null;
  const measured = analysis?.fit.usable ? analysis.vario : null;
  if (analysis && !analysis.fit.usable) {
    warnings.push(`variogram not fitted (${analysis.fit.reason}) — using the analogue range`);
  } else if (!analysis) {
    warnings.push('too few blocked cells to measure a variogram — using the analogue range');
  }
  // a vertical porosity trend breaks the stationarity a variogram assumes; report it so
  // the range is read with that in mind
  const trend = fitVerticalTrend(cells.map((c) => ({ z: c.k, v: c.phie })));
  if (trend.usable) warnings.push(`porosity trends with depth (r² ${trend.r2.toFixed(2)}) — the fitted range is a lower bound`);

  const sim = byLayer.size ? simulateGrid(
    byLayer,
    { nx: p.nx, ny: p.ny, nz: p.nz, dx: p.dx, dy: p.dy, x0: p.x0, y0: p.y0 },
    {
      vario: measured ?? { model: 'spherical', nugget: 0.05, sill: 1, range: 800 },
      seed: recipe.seed, simNodes: recipe.simNodes,
      permA: permFit?.a ?? 19, permB: permFit?.b ?? -1.5, kvkh: 0.1,
      layers: resLayers.length ? resLayers : undefined,
    },
  ) : null;
  if (!sim) warnings.push('no upscaled cell to condition the simulation on');

  // ── 5 · saturation, then write everything into the packed grid ──
  say('writing properties', 4, 6);
  await breathe();
  const cuddyFit = shfSamples.length >= 200 ? fitCuddy(shfSamples) : null;
  const cuddy = cuddyFit && cuddyFit.b < 0 ? cuddyFit : null;

  const dRho = Math.max(1, (ws.pvt?.density_kgm3?.water ?? 1101.3) - (ws.pvt?.density_kgm3?.oil ?? 882));
  if (sim) {
    const src = sourcesFromSim(sim);
    const swOf = (col: number, layer: number) => {
      if (owcM == null) return NaN;
      const sp = layerSpan(built, col, layer);
      if (!sp) return NaN;
      const z = (sp.top + sp.base) / 2;
      const phi = src.phi(col, layer), kMd = src.perm(col, layer);
      // ── A SEAL HOLDS NO HYDROCARBON ──
      //
      // Outside the reservoir the layer is not simulated, so phi is NaN. Returning NaN
      // wrote a 0, which decodes to the property MINIMUM — the lowest water saturation
      // in the model — so the caprock rendered as the most oil-bearing rock on the map.
      // The physically correct answer is 1: the seal is wet.
      if (!(phi > 0)) return 1;
      if (cuddy) return cuddySw(owcM - z, phi, cuddy);
      if (!(kMd > 0)) return NaN;
      const e = applyPublishedShf(SCAL_ANALOGUE, null, kMd);
      const pcE = pcEntryPressure(e, phi, kMd);
      const hEntry = pcE > 0 ? (pcE * 1e5) / (dRho * 9.80665) : 0;
      return swAtHeight(owcM + hEntry - z, e, dRho, phi, kMd);
    };
    ensureProp(p, 'hcpv', 'u16', false);
    const hcpv = hcpvSource(
      { nx: p.nx, ny: p.ny, nz: p.nz, dx: p.dx, dy: p.dy, topZ: p.topZ, baseZ: p.baseZ, activeCol: p.activeCol },
      { ntg: src.ntg, phi: src.phi, sw: swOf },
      { owc: owcM ?? undefined, spanOf: (col, layer) => layerSpan(built, col, layer) },
    );
    const rep = writePackedProps(p, { ...src, sw: swOf, hcpv }, { sw: 1 });
    if (rep.degenerate.length) warnings.push(`single-valued after the write: ${rep.degenerate.join(', ')}`);
  }

  // ── 6 · volumes ──
  say('computing volumes', 5, 6);
  await breathe();
  let volumes: CaseResult['volumes'] = null;
  if (owcM != null && sim) {
    const vcells: VolumeCell[] = [];
    for (let k = 0; k < p.nz; k++) {
      const layer = sim.layers[k];
      const live = layer?.simulated ? layer : null;
      for (let c = 0; c < p.nx * p.ny; c++) {
        if (!p.activeCol[c]) continue;
        const sp = layerSpan(built, c, k);
        if (!sp) continue;
        const thk = sp.base - sp.top;
        const phi = live ? live.phie[c] : 0;
        const kMd = live ? live.perm[c] : 0;
        const z = (sp.top + sp.base) / 2;
        vcells.push({
          zone: layerZone[k], z, thk, bulk: p.dx * p.dy * thk,
          ntg: live ? live.ntg[c] : 0,
          phi,
          sw: live && phi > 0
            ? (cuddy ? cuddySw(owcM - z, phi, cuddy)
              : (() => {
                if (!(kMd > 0)) return 1;
                const e = applyPublishedShf(SCAL_ANALOGUE, null, kMd);
                const pcE = pcEntryPressure(e, phi, kMd);
                const hEntry = pcE > 0 ? (pcE * 1e5) / (dRho * 9.80665) : 0;
                return swAtHeight(owcM + hEntry - z, e, dRho, phi, kMd);
              })())
            : 1,
          active: true,
        });
      }
    }
    const vin = { owc: owcM, bo: ws.pvt?.Bo ?? 1.47, zones: reservoirZones };
    volumes = reconcile(gridVolumes(vcells, vin), vin, undefined, vcells);
  } else if (owcM == null) {
    warnings.push('no fluid contact — there is no volume without one');
  }

  say('done', 6, 6);
  return {
    grid: built,
    upscaled: {
      cells, permAverage: recipe.permAverage, skipped,
      thinCells: cells.filter((c) => c.nSamples < 3).length,
    },
    sim, volumes, reservoirZones, params, permFit,
    vario: analysis ? {
      range: analysis.vario.range, nugget: analysis.vario.nugget,
      sill: analysis.vario.sill, model: analysis.vario.model,
      azimuthDeg: analysis.vario.aniso?.azimuthDeg,
      ratio: analysis.vario.aniso?.ratio,
      fitted: analysis.fit.usable, reason: analysis.fit.reason,
      bins: analysis.exp.bins.length, pairs: analysis.exp.pairs,
    } : null,
    cuddy: cuddy ? { a: cuddy.a, b: cuddy.b, r2: cuddy.r2, n: cuddy.n } : null,
    warnings,
  };
}

/** The v0 recipe — the case the tab opens on when nothing has been built. */
export const V0_RECIPE: CaseRecipe = {
  horizons: [],           // empty = the reservoir interval and its seal
  nzPerZone: 10,
  layerScheme: 'proportional',
  seed: 1000,
  simNodes: 24,
  permAverage: 'geometric',
};

export { zoneSurfaces };
