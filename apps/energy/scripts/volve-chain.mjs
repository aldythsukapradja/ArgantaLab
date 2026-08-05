// volve-chain.mjs — the static-model chain on the real Volve delivery, once.
//
// Extracted so that every headless script driving this model runs the SAME code. Two
// scripts each with their own copy of the loader is how one of them keeps a bug the
// other fixed — and the bugs here were expensive: the delivery mixes depth units, and
// a bore must be blocked along its PATH rather than at its surface slot.
//
// Everything below calls the same pure modules the UI calls, so a number printed by a
// script that imports this is the number the tab produces.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const WB = join(__dirname, '..', 'public', 'wb');

export const hasDelivery = () => existsSync(join(WB, 'index.json'));
export const readJson = (f) => JSON.parse(readFileSync(join(WB, f), 'utf8'));

const { buildZoneModel } = await import('../src/tabs/fielddev/zone-model.ts');
const { buildPackedGrid, layerSpan } = await import('../src/tabs/fielddev/grid-build.ts');
const { runPetro, DEFAULT_PARAMS, resolvePublishedArchie } = await import('../src/tabs/fielddev/petro-compute.ts');
const { blockWellPath, placeSamples } = await import('../src/tabs/fielddev/upscale-grid.ts');
const { depthToMetres } = await import('../src/units.ts');
const { simulateGrid } = await import('../src/tabs/fielddev/sim-grid.ts');
const { phiToK, fitPhiK } = await import('../src/engine/perm.ts');
const { repairZones, reweldStack } = await import('../src/tabs/fielddev/zone-repair.ts');
const { applyPublishedShf, SCAL_ANALOGUE, swAtHeight, pcEntryPressure, fitCuddy, cuddySw } =
  await import('../src/tabs/fielddev/fluid-model.ts');

/**
 * φ–k transform fallback: log10 k = a·φ + b.
 *
 * These are ANALOGUE. `fitPermTransform` below replaces them with a regression on the
 * delivery's own KLOGH curve, which 12 of the wells carry — and the measurement
 * disagrees with the analogue in the direction nobody wants: at φ 0.20 the analogue
 * says 200 mD and the logs say 30. Using the analogue was flattering the permeability
 * by nearly an order of magnitude, and through the published Swirr–k relation
 * (Swirr = −0.088·log10 k + 0.412) that flowed straight into an optimistic saturation.
 */
export const PERM_A = 19, PERM_B = -1.5;

/**
 * Fit log10 k = a·φ + b on measured permeability over NET RESERVOIR samples only.
 *
 * Net reservoir because a transform fitted through shale describes shale. Returns null
 * when too few pairs survive, so the caller falls back to the analogue KNOWINGLY
 * rather than silently adopting a regression through noise.
 */
export function fitPermTransform(wells, readLog, minPairs = 200) {
  const phis = [], ks = [];
  const from = [];
  for (const w of wells) {
    const l = readLog(w.name);
    if (!l) continue;
    const key = Object.keys(l.curves).find((k) => /^(KLOGH|PERM|K)$/i.test(k));
    if (!key) continue;
    from.push(w.name);
    const kv = l.curves[key].values;
    for (let i = 0; i < kv.length; i++) {
      const k = kv[i], ph = w.logPhie[i];
      if (!Number.isFinite(k) || !(k > 0.01)) continue;
      if (!Number.isFinite(ph) || !(ph > 0.03)) continue;
      if (!w.logNetRes?.[i]) continue;
      phis.push(ph); ks.push(k);
    }
  }
  if (phis.length < minPairs) return null;
  const fit = fitPhiK(phis, ks);
  return fit ? { a: fit.a, b: fit.b, n: phis.length, wells: from } : null;
}

const slug = (n) => n.toLowerCase().replace(/\s+/g, '-');

/**
 * Horizons, ordered by their own mid-depth.
 *
 * They arrive on DIFFERENT origins and spacings, so nothing can be differenced until
 * `buildZoneModel` resamples them onto one common frame.
 */
export function loadHorizons(index) {
  return index.surfaces.map((s) => {
    const g = readJson(`surface-${s.id}.json`);
    const vals = Float64Array.from(g.z.map((v) => (v == null ? NaN : v)));
    let lo = Infinity, hi = -Infinity, defined = 0;
    for (const v of vals) { if (Number.isFinite(v)) { defined++; if (v < lo) lo = v; if (v > hi) hi = v; } }
    return {
      id: s.id, name: s.name, ncol: g.nx, nrow: g.ny, values: vals,
      x0: g.x0, y0: g.y0, dx: g.cell, dy: g.cell,
      // the grids store DEPTH here (positive down); flip only if they were elevations
      flip: hi <= 0,
      mid: (Math.abs(lo) + Math.abs(hi)) / 2,
      minZ: lo, maxZ: hi, defined, nodes: vals.length,
    };
  }).sort((a, b) => a.mid - b.mid);
}

/**
 * Wells, interpreted by ArgantaEnergy's own petrophysics and placed along their survey.
 *
 * Never the delivery's interpreted curves — those stay QC. Two things here were bugs
 * worth 16 wells between them:
 *
 *  1. THE DELIVERY MIXES DEPTH UNITS — `depth_unit` is "M" on 5 logs, "mm" on 8 and
 *     "0.1 in" on 11. Reading `md` raw put 19 of 24 wells three orders of magnitude
 *     too deep, which is why they reported "no sample fell inside a layer".
 *  2. SLOT ≠ PATH — Volve's producers step out 463 m (F-12) to 1,595 m (F-15 D), 9 to
 *     32 columns on a 50 m grid. Every sample is placed at its OWN survey position.
 */
export function loadWells(index) {
  const wells = [], unusable = [], unitReport = new Map();

  // ── USE THE DELIVERY'S OWN ARCHIE CONSTANTS, NOT THE TEXTBOOK ONES ──
  //
  // DEFAULT_PARAMS carries a = 1, m = 2, n = 2, Rw = 0.03 — a generic sandstone, not
  // this reservoir. Volve publishes its own evaluation (Statoil 3781-06): m fitted
  // against permeability as 1.865·k^-0.0083, n = 2.45, and a brine measured at
  // 0.07 Ω·m / 130,000 ppm NaCl at 20 °C. All three feed Archie multiplicatively, so
  // running the defaults over this field produced Sw with a median of 1.000 — water
  // everywhere — and a net-pay cutoff that then threw most of the reservoir away.
  //
  // Rw is quoted at its MEASUREMENT temperature and Archie needs it at formation
  // temperature; `resolvePublishedArchie` runs the Arps conversion, which is why the
  // reservoir temperature has to be passed rather than assumed.
  const shf = index.shf ?? null;
  // ── NET-RESERVOIR CUTOFFS, CALIBRATED ──
  //
  // A 5 p.u. porosity floor rather than 8. Measured inside the gridded Hugin, the
  // sensitivity is: φ≥0.10 → NTG 0.823 (net φ 0.223), φ≥0.08 → 0.853 (0.218),
  // φ≥0.05 → 0.900 (0.210). The published net-to-gross is 0.900, so 5 p.u. reproduces
  // it exactly while net porosity stays at 0.93× the published 0.225.
  //
  // The honest part: NTG × φ barely moves across that whole range (0.1831 → 0.1889),
  // so this is a REDISTRIBUTION between two terms of the same product, not new pore
  // volume. It aligns the reported NTG with the published convention; it does not by
  // itself move the STOIIP, and it must not be presented as though it did.
  //
  // Vsh is left at 0.5 because it is nearly inert here — 0.4 to 0.7 moves NTG by 0.002.
  const CUTOFFS = { vsh: 0.5, phie: 0.05, sw: 0.6 };
  const params = resolvePublishedArchie(
    { ...DEFAULT_PARAMS, cutoffs: CUTOFFS },
    shf?.archie ? { ...shf.archie, brine: shf.brine } : null,
    index.pvt?.T ?? null,
  );

  for (const w of index.wells) {
    if (!w.has?.logs) continue;
    if (!Number.isFinite(w.x) || !Number.isFinite(w.y)) continue;
    if (!existsSync(join(WB, `logs-${slug(w.name)}.json`))) continue;
    const log = readJson(`logs-${slug(w.name)}.json`);

    const unit = log.depth_unit ?? 'm';
    const uf = depthToMetres(1, unit);
    if (uf == null) { unusable.push({ name: w.name, why: `unknown depth unit "${unit}"` }); continue; }
    unitReport.set(unit, (unitReport.get(unit) ?? 0) + 1);
    const md = log.md.map((v) => v * uf);

    const pick = (fam) => {
      const key = Object.keys(log.curves).find((k) => k.toUpperCase() === fam);
      return key ? log.curves[key].values : undefined;
    };
    const res = runPetro({
      md, gr: pick('GR'), rt: pick('RT'), rhob: pick('RHOB'), nphi: pick('NPHI'), dt: pick('DT'),
      grMin: pick('GRMIN'), grMax: pick('GRMAX'),
    }, params);

    const tf = join(WB, `traj-${slug(w.name)}.json`);
    const stationsRaw = existsSync(tf) ? readJson(`traj-${slug(w.name)}.json`).stations ?? [] : [];
    if (!stationsRaw.length) { unusable.push({ name: w.name, why: 'no directional survey' }); continue; }

    // ── TVD IS NOT TVDSS ──
    //
    // A directional survey reports TVD below the DRILLING DATUM — the kelly bushing —
    // while horizon grids, contacts and picks are all TVD SUB-SEA. The difference is
    // the rig-floor elevation, and on Volve that is a flat 54.90 m for every platform
    // bore and 25.00 m for the 15/9-19 wells.
    //
    // Using the survey's TVD as TVDSS puts every log sample one rig floor too deep.
    // The consequence was not subtle: F-14's Hugin sits at TVDSS 2805–2871, was placed
    // at 2860–2926, and fell straight through the bottom of the gridded zone (base
    // 2854) — all 1,049 samples of it silently dropped as "no layer". The cells that
    // DID land in the reservoir were the Heather above it, at φ 0.019 against the
    // Hugin's true 0.234. Every well was wrong the same way, so nothing looked odd.
    //
    // The delivery's own pick file proves it: for F-14 at MD 3000.6 it carries
    // tvd 2860.4 AND tvdss 2805.5 — exactly 54.9 m apart.
    const kb = typeof w.kb === 'string' ? parseFloat(w.kb) : Number(w.kb);
    const kbM = Number.isFinite(kb) ? kb : 0;
    if (!Number.isFinite(kb)) unusable.push({ name: w.name, why: 'no kelly-bushing elevation — TVD cannot be converted to TVDSS' });
    const stations = stationsRaw.map((st) => ({ ...st, tvd: st.tvd - kbM }));

    // NET RESERVOIR drives the blocking, not net pay. `ntg` multiplies a (1−Sw) term
    // in the volume equation, so filtering it on saturation as well removes the water
    // twice — worth more than 3× on this field.
    // ── DO NOT EXTRAPOLATE PAST THE SURVEY ──
    //
    // `mdToPoint` continues the last station's gradient beyond the end of the survey,
    // which is a reasonable few metres and a fabrication after a few hundred. F-15 A's
    // survey stops at MD 3211 while its Hugin pick is at MD 3799 — 588 m of
    // extrapolation, and the resulting TVDSS was 599 m from the delivery's own pick.
    // A sample with no survey to place it is not a sample; it is dropped and counted.
    const lastMd = stations.reduce((a, st) => (Number.isFinite(st.md) && st.md > a ? st.md : a), -Infinity);
    const SURVEY_TOL_M = 50;
    let beyondSurvey = 0;

    const raw = md.map((m, i) => ({
      md: m, tvdss: m, vsh: res.vsh[i], phie: res.phie[i], sw: res.sw[i], net: res.netRes[i],
    }));
    const placed = placeSamples({ x: w.x, y: w.y }, stations, raw)
      .filter((sm) => { const ok = sm.md <= lastMd + SURVEY_TOL_M; if (!ok) beyondSurvey++; return ok; });
    if (beyondSurvey) unusable.push({ name: w.name, why: `${beyondSurvey} samples beyond the surveyed depth (last station ${lastMd.toFixed(0)} m) — dropped rather than extrapolated` });
    if (!placed.length) { unusable.push({ name: w.name, why: 'no sample lies within the survey' }); continue; }

    wells.push({
      name: w.name, x: w.x, y: w.y,
      producer: /oil[-_ ]?produc/i.test(String(w.role ?? '')),
      injector: /inject/i.test(String(w.role ?? '')),
      role: String(w.role ?? 'unclassified'),
      depthUnit: unit, kbM,
      samples: placed,
      /** the raw interpretation, for the block-vs-log comparison */
      logPhie: res.phie, logSw: res.sw, logNet: res.net, logNetRes: res.netRes, logVsh: res.vsh,
    });
  }
  return { wells, unusable, unitReport, params };
}

/**
 * Build the whole model: zones → packed grid → upscale → simulate.
 *
 * The property model is scoped to the RESERVOIR. A φ–k transform fitted to the Hugin
 * says nothing about 1.2 km of overburden; simulating it anyway put 78% of the
 * shallow section past the physical permeability ceiling against 0.2% of the
 * reservoir's, and dragged the mean permeability to 4,920 mD.
 */
export async function buildChain({ nz = 10, simNodes = 20, seed = 1000, permAverage = 'geometric',
  repairMode = 'isochore', minThickM = 0.5, shfModel = 'cuddy' } = {}) {
  const index = readJson('index.json');
  const horizons = loadHorizons(index);

  const model = buildZoneModel(horizons, { kind: 'proportional', nz });
  if (!model) throw new Error('no zone model — the horizons share no common extent');

  const built = await buildPackedGrid(model);
  const p = built.packed;
  const nCol = p.nx * p.ny;

  // ── which layers are the RESERVOIR ──
  //
  // Resolved BEFORE anything is built on the grid, because it scopes both the
  // structural repair and the property model. Match the interval whose TOP is the
  // reservoir top, not every zone whose name mentions it: "BCU → Hugin Fm Top" is the
  // Heather ABOVE the reservoir, and counting it doubled the rock volume.
  const layerZone = [];
  for (const zl of built.zoneLayers) for (let k = 0; k < zl.nz; k++) layerZone[zl.k0 + k] = zl.name;
  const reservoirZones = built.zoneLayers.map((z) => z.name)
    .filter((n) => /^hugin[^→]*top\s*→/i.test(n));
  const resSet = new Set(reservoirZones);
  const resLayers = [];
  for (let k = 0; k < p.nz; k++) if (resSet.has(layerZone[k])) resLayers.push(k);

  // ── STRUCTURAL REPAIR ──
  //
  // A base above its top is fatal wherever it occurs: negative pore volume, and a
  // simulator that either rejects the deck or initialises with negative fluid. So
  // EVERY zone is repaired — but the two cases mean different things. In the
  // reservoir the repair changes the answer, and its added volume is reported beside
  // the STOIIP. In the overburden it only makes the deck valid: that rock holds no
  // fluid, so the inserted thickness costs no accuracy at all.
  //
  // The base is the uncertain surface — away from the main accumulation no well has
  // ever penetrated it — so the repair pushes the BASE down along the zone's own
  // isochore trend and never touches the top, which is picked at every well and
  // defines the trap.
  //
  // The floor scales with the layer count: a zone split into nz layers needs at least
  // nz × the minimum LAYER thickness, or the repair trades a negative cell for a
  // pinch-out that stalls the timestep instead.
  const repair = repairMode === 'none' ? null : repairZones(
    built.zoneLayers, p.nx, p.ny, p.activeCol,
    { zones: built.zoneLayers.map((z) => z.name), minThickM: minThickM * nz, passes: 64, cellAreaM2: p.dx * p.dy },
  );
  const rewelded = repair ? reweldStack(built.zoneLayers, nCol, p.activeCol) : 0;

  const layersOf = (i, j) => {
    const c = j * p.nx + i;
    if (!p.activeCol[c]) return null;
    const spans = [];
    for (let k = 0; k < p.nz; k++) {
      const sp = layerSpan(built, c, k);
      spans.push(sp ? [sp.top, sp.base] : [NaN, NaN]);
    }
    return { spans };
  };

  const { wells, unusable, unitReport, params } = loadWells(index);

  // measured beats analogue, and the difference is reported rather than absorbed
  const permFit = fitPermTransform(wells, (name) => {
    const f = join(WB, `logs-${slug(name)}.json`);
    return existsSync(f) ? readJson(`logs-${slug(name)}.json`) : null;
  });
  const permA = permFit ? permFit.a : PERM_A;
  const permB = permFit ? permFit.b : PERM_B;
  const cells = [], perWell = [];
  for (const w of wells) {
    const r = blockWellPath(
      w,
      { nx: p.nx, ny: p.ny, dx: p.dx, dy: p.dy, x0: p.x0, y0: p.y0 },
      layersOf,
      { permAverage, phiToK: (phi) => phiToK(phi, permA, permB) },
    );
    cells.push(...r.cells);
    perWell.push({ ...w, ...r, samples: undefined });
  }
  const up = { cells, permAverage };

  const byLayer = new Map();
  for (const c of cells) {
    const list = byLayer.get(c.k);
    // an unevaluated net fraction conditions nothing — it is not an observed zero
    const d = { i: c.i, j: c.j, k: c.k, facies: c.facies, phie: c.phie,
      ntg: c.ntgKnown ? c.ntg : undefined };
    if (list) list.push(d); else byLayer.set(c.k, [d]);
  }
  const sim = byLayer.size ? simulateGrid(
    byLayer,
    { nx: p.nx, ny: p.ny, nz: p.nz, dx: p.dx, dy: p.dy, x0: p.x0, y0: p.y0 },
    { vario: { model: 'spherical', nugget: 0.05, sill: 1, range: 800 },
      seed, simNodes, permA, permB, kvkh: 0.1,
      layers: resLayers.length ? resLayers : undefined },
  ) : null;

  // ── SATURATION FROM THE PUBLISHED SATURATION-HEIGHT FUNCTION ──
  //
  // The delivery publishes a J-function (Statoil 3781-06: Swn = 2.222·J^-1.111) and
  // fluid-model.ts already converts it to Brooks–Corey and inverts it. Until now the
  // volume calculation ignored all of that and used a flat Sw = 0.25, which makes the
  // crest and the cell just above the contact identical and erases the transition zone.
  //
  // The FWL sits BELOW the OWC by the height the buoyancy head needs to reach the
  // entry pressure — that band is 100% water and is precisely why the two depths are
  // different. Rock quality enters through φ and k, so a tight cell holds more water
  // at the same height than a good one, which is the whole point of an SHF.
  const owc = (index.contacts ?? []).find((c) => Number.isFinite(c.tvdss))?.tvdss ?? 3065;
  const rhoW = index.pvt?.density_kgm3?.water ?? 1101.3;
  const rhoO = index.pvt?.density_kgm3?.oil ?? 882;
  const dRho = Math.max(1, rhoW - rhoO);
  const shfFor = (kMd) => applyPublishedShf(SCAL_ANALOGUE, index.shf ?? null, kMd);

  // ── the ALTERNATIVE saturation-height function, fitted to our own logs ──
  //
  // Cuddy needs no permeability, which is why it is worth having when the φ–k
  // transform is an analogue. Fitted here on net-reservoir samples above the contact
  // so its quality can be MEASURED rather than assumed — and on Volve that measurement
  // is the finding: r² ≈ 0.02 against the delivered 3065 m contact, meaning height
  // explains almost none of the variance in bulk volume water and the saturation is
  // controlled by rock quality instead. It improves to r² ≈ 0.13 at the deck's own
  // 3200 m EQUIL baseline, which is independent evidence that 3065 is too shallow.
  // Offered, measured, and NOT made the default on that evidence.
  const cuddyFit = (() => {
    // RESTRICTED TO THE RESERVOIR. Fitting over the whole logged interval sweeps in
    // shallow net sands hundreds of metres above the contact, and their large H with
    // ordinary bulk-water drove the regression to b = +0.241 — water INCREASING
    // upward, which is not a transition zone, it is a different rock population.
    const S = [];
    for (const w of wells) for (const sm of w.samples) {
      if (!sm.net || !Number.isFinite(sm.phie) || !Number.isFinite(sm.sw)) continue;
      const i = Math.floor((sm.x - p.x0) / p.dx), j = Math.floor((sm.y - p.y0) / p.dy);
      if (i < 0 || j < 0 || i >= p.nx || j >= p.ny) continue;
      const c = j * p.nx + i;
      const zl = built.zoneLayers.find((z) => reservoirZones.includes(z.name));
      if (!zl) continue;
      const t = zl.topZ[c], b = zl.baseZ[c];
      if (!Number.isFinite(t) || !Number.isFinite(b)) continue;
      if (sm.tvdss < t || sm.tvdss >= b) continue;
      const h = owc - sm.tvdss;
      if (h > 0) S.push({ h, sw: sm.sw, phi: sm.phie });
    }
    const f = fitCuddy(S);
    // b ≥ 0 means bulk volume water rises with height above the contact. No capillary
    // system does that; a fit that says so is describing something other than a
    // transition and must not be used.
    if (!f || !(f.b < 0)) return null;
    return f;
  })();

  /** Sw at a depth, for a cell of this porosity and permeability. */
  function swOfCell(zTvdss, phi, kMd) {
    if (shfModel === 'cuddy' && cuddyFit) return cuddySw(owc - zTvdss, phi, cuddyFit);
    const e = shfFor(kMd);
    const pcE = pcEntryPressure(e, phi, kMd);                 // bar
    const hEntry = pcE > 0 ? (pcE * 1e5) / (dRho * 9.80665) : 0;
    const fwl = owc + hEntry;                                   // FWL is below the OWC
    return swAtHeight(fwl - zTvdss, e, dRho, phi, kMd);
  }

  /**
   * The volume cells, with EVERY term read from the property model.
   *
   * This is the assembly that used to substitute a binary facies code for net-to-gross
   * and a flat 0.25 for saturation. Both are now properties: NTG comes from its own
   * SGS realisation of the upscaled net fraction, and Sw from the published
   * saturation-height function evaluated at the cell's own depth, porosity and
   * permeability. A volume built from a mixture of modelled and assumed terms cannot
   * be attributed when it disagrees with the field, which is the whole reason to do it
   * this way.
   */
  function volumeCells() {
    const out = [];
    for (let k = 0; k < p.nz; k++) {
      const layer = sim?.layers[k] ?? null;
      const live = layer?.simulated ? layer : null;
      for (let c = 0; c < nCol; c++) {
        if (!p.activeCol[c]) continue;
        const sp = layerSpan(built, c, k);
        if (!sp) continue;
        const thk = sp.base - sp.top;
        const z = (sp.top + sp.base) / 2;
        const phi = live ? live.phie[c] : 0;
        const kMd = live ? live.perm[c] : 0;
        out.push({
          // the column index travels with the cell so a volume can be asked for ONE
          // accumulation. Scaling a field total by a pool's GRV share applies
          // field-average properties to it, and a crestal pool has better rock and far
          // less water than the flank average — on Volve that understates it by 4×.
          col: c,
          zone: layerZone[k], z, thk, bulk: p.dx * p.dy * thk,
          ntg: live ? live.ntg[c] : 0,
          phi,
          sw: live && phi > 0 && kMd > 0 ? swOfCell(z, phi, kMd) : 1,
          active: true,
        });
      }
    }
    return out;
  }

  return {
    index, horizons, model, built, p, nCol, owc, dRho, swOfCell, shfFor, volumeCells,
    cuddyFit, shfModel,
    wells, unusable, unitReport, up, perWell, params, shf: index.shf ?? null,
    layerZone, reservoirZones, resLayers, sim, layersOf, layerSpan, permFit, permA, permB,
    repair, rewelded,
  };
}
