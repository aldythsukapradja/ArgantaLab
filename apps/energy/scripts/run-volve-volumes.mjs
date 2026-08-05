// run-volve-volumes.mjs — the whole static-model chain, headless, on the real Volve
// delivery. Answers one question with a number you can check:
//
//     what STOIIP does this model produce, and how does it compare with the
//     official Sodir figure of 18.70 MMSm³?
//
// It reads public/wb/*.json directly — the same files the browser digests into
// IndexedDB — so it needs no browser, no dev server and no hidden-tab throttling.
// Every stage is the SAME pure module the UI calls, so a number printed here is the
// number the tab produces.
//
// Run: node scripts/run-volve-volumes.mjs [--nz 20] [--sim 24] [--mc 5000]
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WB = join(__dirname, '..', 'public', 'wb');

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : dflt;
};
const NZ = arg('nz', 10);
const SIM = arg('sim', 20);
const MC = arg('mc', 5000);

if (!existsSync(join(WB, 'index.json'))) {
  console.log('SKIP — public/wb is not built. Run `npm run data:wb` first.');
  process.exit(0);
}

const readJson = (f) => JSON.parse(readFileSync(join(WB, f), 'utf8'));
const index = readJson('index.json');

const { buildZoneModel } = await import('../src/tabs/fielddev/zone-model.ts');
const { buildPackedGrid, layerSpan, zoneOfLayer, zoneSurfaces } = await import('../src/tabs/fielddev/grid-build.ts');
const { runPetro, DEFAULT_PARAMS } = await import('../src/tabs/fielddev/petro-compute.ts');
const { upscaleWells, blockWellPath, placeSamples } = await import('../src/tabs/fielddev/upscale-grid.ts');
const { depthToMetres } = await import('../src/units.ts');
const { simulateGrid } = await import('../src/tabs/fielddev/sim-grid.ts');
const { gridVolumes, reconcile, toMMSm3, toMMstb } = await import('../src/tabs/fielddev/volumes.ts');
const { phiToK } = await import('../src/engine/perm.ts');
const { monteCarlo, tornado } = await import('../src/engine/mc.ts');
const { findPools } = await import('../src/tabs/fielddev/pools.ts');
const { auditHandover, summarise } = await import('../src/tabs/fielddev/handover-audit.ts');

const t0 = Date.now();
const line = (s = '') => console.log(s);
const num = (v, d = 2) => Number(v).toFixed(d);

line('═══ VOLVE · static model → STOIIP ═══════════════════════════════');
line(`grid: ${NZ} layers/zone · simulation ${SIM}×${SIM} · ${MC} MC trials`);
line();

// ── 1 · horizons, ordered by their own mid-depth ────────────────────────────
const horizons = index.surfaces.map((s) => {
  const g = readJson(`surface-${s.id}.json`);
  const vals = Float64Array.from(g.z.map((v) => (v == null ? NaN : v)));
  let lo = Infinity, hi = -Infinity;
  for (const v of vals) { if (Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } }
  // the grids store DEPTH here (positive down); flip only if they were elevations
  const flip = hi <= 0;
  const mid = (Math.abs(lo) + Math.abs(hi)) / 2;
  return {
    id: s.id, name: s.name, ncol: g.nx, nrow: g.ny, values: vals,
    x0: g.x0, y0: g.y0, dx: g.cell, dy: g.cell, flip, mid,
  };
}).sort((a, b) => a.mid - b.mid);

line('HORIZONS (stratigraphic order, by mid-depth)');
for (const h of horizons) line(`  ${h.name.padEnd(22)} ${num(h.mid, 0).padStart(6)} m   ${h.ncol}×${h.nrow} @ ${h.dx} m`);
line();

// ── 2 · zones on one common frame ───────────────────────────────────────────
const model = buildZoneModel(horizons, { kind: 'proportional', nz: NZ });
if (!model) { console.error('no zone model'); process.exit(1); }

line(`COMMON GRID  ${model.grid.nx} × ${model.grid.ny} @ ${num(model.grid.dx, 1)} m`);
line('ZONES');
for (const z of model.zones) {
  const cross = z.crossedCols ? `  ⚠ ${z.crossedCols} crossed` : '';
  line(`  ${z.name.padEnd(34)} ${num(z.meanThicknessM, 1).padStart(7)} m mean   ${z.overlapCols} cols${cross}`);
}
line();

// ── 3 · build + pack ────────────────────────────────────────────────────────
const built = await buildPackedGrid(model);
const p = built.packed;
line(`GRID  ${p.nx} × ${p.ny} × ${p.nz} = ${(built.cells / 1e6).toFixed(2)} M cells · ${(built.activeCells / 1e6).toFixed(2)} M active`);
line(`      ${(built.packedBytes / 1048576).toFixed(1)} MB packed · peak ${(built.peakBuildBytes / 1048576).toFixed(1)} MB · ${(built.ms / 1000).toFixed(1)} s`);
line();

// ── 4 · interpret + upscale ─────────────────────────────────────────────────
const slug = (n) => n.toLowerCase().replace(/\s+/g, '-');
const wells = [];
const noSurvey = [];
const unitReport = new Map();
for (const w of index.wells) {
  if (!w.has?.logs) continue;
  if (!Number.isFinite(w.x) || !Number.isFinite(w.y)) continue;
  const f = join(WB, `logs-${slug(w.name)}.json`);
  if (!existsSync(f)) continue;
  const log = readJson(`logs-${slug(w.name)}.json`);

  // THE DELIVERY MIXES DEPTH UNITS: "M", "mm" and "0.1 in" all appear, and only 4 of
  // 24 logs are in metres. Reading log.md raw put 20 wells three orders of magnitude
  // too deep, which is why they reported "no sample fell inside a layer".
  const uf = depthToMetres(1, log.depth_unit ?? 'm');
  if (uf == null) { noSurvey.push(`${w.name} (unknown depth unit "${log.depth_unit}")`); continue; }
  unitReport.set(log.depth_unit ?? 'm', (unitReport.get(log.depth_unit ?? 'm') ?? 0) + 1);
  const md = log.md.map((v) => v * uf);

  const pick = (fam) => {
    const key = Object.keys(log.curves).find((k) => k.toUpperCase() === fam);
    return key ? log.curves[key].values : undefined;
  };
  const res = runPetro({
    md, gr: pick('GR'), rt: pick('RT'), rhob: pick('RHOB'), nphi: pick('NPHI'), dt: pick('DT'),
    grMin: pick('GRMIN'), grMax: pick('GRMAX'),
  }, DEFAULT_PARAMS);

  const tf = join(WB, `traj-${slug(w.name)}.json`);
  const stations = existsSync(tf) ? readJson(`traj-${slug(w.name)}.json`).stations ?? [] : [];
  if (!stations.length) { noSurvey.push(`${w.name} (no directional survey)`); continue; }

  const raw = md.map((m, i) => ({
    md: m, tvdss: m, vsh: res.vsh[i], phie: res.phie[i], sw: res.sw[i], net: res.net[i],
  }));
  wells.push({
    name: w.name,
    producer: /oil[-_ ]?produc/i.test(String(w.role ?? '')),
    injector: /inject/i.test(String(w.role ?? '')),
    role: String(w.role ?? 'unclassified'),
    // every sample at its OWN position along the survey — step-outs run to 1,595 m
    samples: placeSamples({ x: w.x, y: w.y }, stations, raw),
  });
}

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

const up = { cells: [], skipped: [], thinCells: 0, permAverage: 'geometric' };
const perWell = [];
for (const w of wells) {
  const r = blockWellPath(
    w,
    { nx: p.nx, ny: p.ny, dx: p.dx, dy: p.dy, x0: p.x0, y0: p.y0 },
    layersOf,
    { permAverage: 'geometric', phiToK: (phi) => phiToK(phi, 19, -1.5) },
  );
  up.cells.push(...r.cells);
  perWell.push({ name: w.name, producer: w.producer, injector: w.injector, ...r });
  if (!r.cells.length) up.skipped.push({ well: w.name, why: r.outsideGrid > r.noLayer ? 'path outside the model area' : 'no sample fell inside a layer' });
}
up.thinCells = up.cells.filter((c) => c.nSamples < 3).length;

line(`DEPTH UNITS  ${[...unitReport.entries()].map(([u, n]) => `${u}×${n}`).join(' · ')}`);
if (noSurvey.length) line(`   ${noSurvey.length} bores unusable: ${noSurvey.join(', ')}`);
line(`UPSCALED  ${up.cells.length} cells from ${new Set(up.cells.map((c) => c.well)).size} of ${wells.length} wells (${up.thinCells} on <3 samples)`);
line();
line('  FLOWING WELLS — the dynamic model’s key input');
for (const r of perWell.filter((x) => x.producer || x.injector)) {
  const ok = r.cells.length ? '✓' : '✗';
  const kind = r.producer ? 'PROD' : 'INJ ';
  line(`   ${ok} ${kind} ${r.name.padEnd(9)} ${String(r.cells.length).padStart(4)} cells / ${String(r.columnsCrossed).padStart(3)} cols`);
}
const flow = perWell.filter((x) => x.producer || x.injector);
const flowOk = flow.filter((x) => x.cells.length).length;
line(`   ${flowOk}/${flow.length} flowing wells upscaled  (${perWell.filter((x)=>x.producer&&x.cells.length).length}/${perWell.filter((x)=>x.producer).length} producers, ${perWell.filter((x)=>x.injector&&x.cells.length).length}/${perWell.filter((x)=>x.injector).length} injectors)`);
// flowing bores that never even reached the well list
const flowNames = new Set(flow.map((x) => x.name));
const missing = index.wells.filter((w) => (/oil[-_ ]?produc|inject/i.test(String(w.role ?? ''))) && !flowNames.has(w.name));
if (missing.length) line(`   ✗ NOT UPSCALED AT ALL: ${missing.map((w) => `${w.name} (${w.role})`).join(', ')}`);
line();

// ── which layers are the RESERVOIR ──────────────────────────────────────────
//
// Resolved BEFORE the simulation, because it now scopes it. A φ–k transform fitted
// to the Hugin says nothing about 1.2 km of overburden, and asking it anyway is what
// produced millions of millidarcy in the shallow section.
const layerZone = [];
for (const zl of built.zoneLayers) for (let k = 0; k < zl.nz; k++) layerZone[zl.k0 + k] = zl.name;
// The reservoir is the interval BETWEEN the reservoir top and its base — not every
// zone whose name mentions it. "BCU → Hugin Fm Top" contains the word Hugin and is
// the Heather overburden ABOVE the reservoir; counting it doubled the rock volume.
const reservoirZones = built.zoneLayers.map((z) => z.name)
  .filter((n) => /^hugin[^→]*top\s*→/i.test(n));
const resZoneSet = new Set(reservoirZones);
const resLayers = [];
for (let k = 0; k < p.nz; k++) if (resZoneSet.has(layerZone[k])) resLayers.push(k);
line(`RESERVOIR ZONE  ${reservoirZones.join(', ') || '(none matched — every zone would be counted)'}`);
line(`   layers ${resLayers.length ? `${resLayers[0]}–${resLayers[resLayers.length - 1]}` : '(none)'} of ${p.nz} — the property model is built ONLY here`);
line();

// ── 5 · simulate facies + porosity ──────────────────────────────────────────
const byLayer = new Map();
for (const c of up.cells) {
  const list = byLayer.get(c.k);
  const d = { i: c.i, j: c.j, k: c.k, facies: c.facies, phie: c.phie };
  if (list) list.push(d); else byLayer.set(c.k, [d]);
}
const sim = byLayer.size ? simulateGrid(
  byLayer,
  { nx: p.nx, ny: p.ny, nz: p.nz, dx: p.dx, dy: p.dy, x0: p.x0, y0: p.y0 },
  { vario: { model: 'spherical', nugget: 0.05, sill: 1, range: 800 },
    seed: 1000, simNodes: SIM, permA: 19, permB: -1.5, kvkh: 0.1,
    layers: resLayers.length ? resLayers : undefined },
) : null;
if (sim) {
  line(`SIMULATED  ${sim.simulatedLayers} of ${sim.layers.length} layers (${sim.skippedLayers} outside the reservoir, left empty) · ${(sim.sandFraction * 100).toFixed(0)}% sand · on ${sim.simGrid.nx}×${sim.simGrid.ny} upsampled to ${sim.modelNx}×${sim.modelNy} · seed ${sim.seed} · ${(sim.ms / 1000).toFixed(1)} s`);
  if (sim.unconditionedLayers) line(`           ${sim.unconditionedLayers} layers had no upscaled cell of their own`);
} else {
  line('SIMULATED  none — no upscaled cell to condition on');
}
line();

// ── 6 · volumes ─────────────────────────────────────────────────────────────
const contact = (index.contacts ?? []).find((c) => Number.isFinite(c.tvdss));
const OWC = contact ? Math.abs(contact.tvdss) : 3200;
const BO = index.pvt?.Bo ?? 1.25;
line(`CONTACT  ${contact?.kind ?? 'OWC'} ${OWC} m TVDSS (${contact?.dataNature ?? 'assumed'})   ·   Bo ${BO}`);

// Where the capped permeability sits, per zone. A ceiling hit inside the reservoir is
// a transform problem; one in the overburden was a scope problem — now that only the
// reservoir is simulated, every zone but one should read a flat zero.
if (sim) {
  const byZone = new Map();
  for (let k = 0; k < sim.layers.length; k++) {
    if (!sim.layers[k].simulated) continue;
    const z = layerZone[k] ?? '(none)';
    const e = byZone.get(z) ?? { capped: 0, cells: 0 };
    e.capped += sim.layers[k].permCapped;
    e.cells += sim.modelNx * sim.modelNy;
    byZone.set(z, e);
  }
  line('CAPPED k BY ZONE  (simulated layers only)');
  for (const [z, e] of byZone) {
    const res = reservoirZones.includes(z) ? ' ← RESERVOIR' : '';
    line(`   ${(e.capped / e.cells * 100).toFixed(1).padStart(5)}%  ${e.capped.toLocaleString().padStart(9)} of ${e.cells.toLocaleString().padStart(9)}  ${z}${res}`);
  }
}

const cells = [];
const nCol = p.nx * p.ny;
for (let k = 0; k < p.nz; k++) {
  const layer = sim?.layers[k] ?? null;
  for (let c = 0; c < nCol; c++) {
    if (!p.activeCol[c]) continue;
    const sp = layerSpan(built, c, k);
    if (!sp) continue;
    const thk = sp.base - sp.top;
    cells.push({
      zone: layerZone[k],
      z: (sp.top + sp.base) / 2, thk, bulk: p.dx * p.dy * thk,
      ntg: layer ? (layer.facies[c] ? 1 : 0) : 1,
      phi: layer ? layer.phie[c] : 0,
      sw: layer ? 0.25 : 1,
      active: true,
    });
  }
}
const VIN = { owc: OWC, bo: BO, zones: reservoirZones };
const gv = gridVolumes(cells, VIN);
const rec = reconcile(gv, VIN, undefined, cells);

line();
line('─── VOLUMES ─────────────────────────────────────────────────────');
line(`  GRV above contact   ${(gv.grvM3 / 1e6).toFixed(1)} Mm³   (${gv.cells.toLocaleString('en-US')} cells in zone, ${gv.straddling.toLocaleString('en-US')} straddling, ${gv.outOfZone.toLocaleString('en-US')} outside the reservoir)`);
line(`  volume-weighted     NTG ${num(gv.meanNtg, 3)} · φ ${num(gv.meanPhi, 3)} · Sw ${num(gv.meanSw, 3)}`);
line();
line(`  STOIIP (grid)       ${num(toMMSm3(gv.stoiipSm3))} MMSm³   = ${num(toMMstb(gv.stoiipSm3), 1)} MMstb`);
line(`  STOIIP (map)        ${num(toMMSm3(rec.map.stoiipSm3))} MMSm³   [${rec.mapPropsSource}]`);
line(`  difference          ${(rec.relDiff * 100).toFixed(1)}%`);
line(`  ${rec.verdict}`);
line();
line(`  Sodir official      18.70 MMSm³`);
const ratio = toMMSm3(gv.stoiipSm3) / 18.70;
line(`  this model is       ${ratio.toFixed(2)}× the official figure`);
line();
// What GRV would reproduce the official number under this model's own averages?
// The gap between that and the modelled GRV is the AREAL one: an unfaulted model
// with no closure polygon fills every column whose top is above the contact, across
// the whole mapped area, whereas Volve's oil sits in a small fault-bounded trap.
const impliedGrv = (18.70e6 * BO) / (gv.meanNtg * gv.meanPhi * (1 - gv.meanSw));
line(`  GRV implied by the official STOIIP, at this model's own NTG/φ/Sw:`);
line(`      ${(impliedGrv / 1e6).toFixed(1)} Mm³  vs  ${(gv.grvM3 / 1e6).toFixed(1)} Mm³ modelled  =  ${(gv.grvM3 / impliedGrv).toFixed(0)}× too much rock`);

line();

// ── 6b · POOLS: is the filled area one accumulation, or many? ───────────────
//
// The reservoir zone's own top and base, per column, are what a closure is made of.
const resSurf = reservoirZones.length ? zoneSurfaces(built, reservoirZones[0]) : null;
const resTop = resSurf ? resSurf.topZ : new Float64Array(nCol).fill(NaN);
const resBase = resSurf ? resSurf.baseZ : new Float64Array(nCol).fill(NaN);

// producers, from the delivery's own regulator role
const poolWells = index.wells
  .filter((w) => Number.isFinite(w.x) && Number.isFinite(w.y))
  .map((w) => ({
    name: w.name, x: w.x, y: w.y,
    producer: /oil[-_ ]?produc/i.test(String(w.role ?? '')),
    injector: /inject/i.test(String(w.role ?? '')),
    role: String(w.role ?? 'unclassified'),
  }));

const pools = findPools(
  { nx: p.nx, ny: p.ny, dx: p.dx, dy: p.dy, x0: p.x0, y0: p.y0,
    topZ: resTop, baseZ: resBase, activeCol: p.activeCol },
  OWC, poolWells, 4,
);

// the filled AREA: distinct columns that contributed, not cell count (many layers
// share a column)
const filledCols = new Set();
for (let c = 0; c < nCol; c++) {
  if (!p.activeCol[c]) continue;
  if (Number.isFinite(resTop[c]) && resTop[c] < OWC) filledCols.add(c);
}
const filledKm2 = (filledCols.size * p.dx * p.dy) / 1e6;
line(`      the model fills ${filledKm2.toFixed(1)} km² — every column whose reservoir top is`);
line(`      shallower than the contact, across the whole mapped area. Volve's oil sits in a`);
line(`      fault-bounded trap of roughly ${(filledKm2 / (gv.grvM3 / impliedGrv)).toFixed(1)} km². THE MODEL HAS NO TRAP: v1 is`);
line('      unfaulted with no closure polygon, and this is exactly what that costs.');
line();
line('─── POOLS ───────────────────────────────────────────────────────');
line(`  ${pools.pools.length} separate accumulations above the contact (+${pools.tinyCount} below the 4-column noise floor)`);
line(`  ${pools.drainedCount} contain a producing well · total ${(pools.totalAreaM2 / 1e6).toFixed(1)} km²`);
line();
line('  #   area km²   crest m   column m     GRV Mm³   wells');
for (const pool of pools.pools.slice(0, 12)) {
  const tag = pool.drained ? '★' : ' ';
  const who = pool.wells.length
    ? `${pool.wells.slice(0, 4).join(', ')}${pool.wells.length > 4 ? ` +${pool.wells.length - 4}` : ''}`
    : '—';
  line(`  ${tag}${String(pool.id).padStart(3)}  ${(pool.areaM2 / 1e6).toFixed(2).padStart(8)}   ${num(pool.crestZ, 0).padStart(6)}   ${num(pool.columnM, 0).padStart(7)}   ${(pool.grvM3 / 1e6).toFixed(1).padStart(9)}   ${who}`);
}
if (pools.pools.length > 12) line(`  …and ${pools.pools.length - 12} more, all undrained`);
line();
line(`  GRV in DRAINED pools    ${(pools.drainedGrvM3 / 1e6).toFixed(1)} Mm³`);
line(`  GRV in undrained pools  ${(pools.undrainedGrvM3 / 1e6).toFixed(1)} Mm³`);
line(`  drained share           ${((pools.drainedGrvM3 / (pools.drainedGrvM3 + pools.undrainedGrvM3)) * 100).toFixed(1)}%`);
line();
// what the drained accumulation alone would imply
const drainedFrac = pools.drainedGrvM3 / Math.max(1, pools.drainedGrvM3 + pools.undrainedGrvM3);
const drainedStoiip = toMMSm3(gv.stoiipSm3) * drainedFrac;
line(`  STOIIP in the drained pools only:  ${num(drainedStoiip)} MMSm³  =  ${(drainedStoiip / 18.70).toFixed(1)}× official`);
line();

// ── 7 · uncertainty: Monte Carlo + tornado ──────────────────────────────────
// The grid gives ONE deterministic answer. These are the ranges around it, over the
// inputs a volumetric estimate is actually uncertain in. GRV is held at the grid's
// own value and varied by a geometry factor — the structural uncertainty — because
// re-gridding per trial is not what a screening MC does.
const inputs = [
  { key: 'grvFactor', label: 'GRV / structure', dist: 'pert', min: 0.80, mode: 1.00, max: 1.20 },
  { key: 'ntg', label: 'Net-to-gross', dist: 'pert', min: Math.max(0.05, gv.meanNtg * 0.7), mode: gv.meanNtg, max: Math.min(1, gv.meanNtg * 1.25) },
  { key: 'phi', label: 'Porosity', dist: 'pert', min: gv.meanPhi * 0.85, mode: gv.meanPhi, max: gv.meanPhi * 1.15 },
  { key: 'sw', label: 'Water saturation', dist: 'pert', min: Math.max(0.05, gv.meanSw * 0.75), mode: gv.meanSw, max: Math.min(0.95, gv.meanSw * 1.3) },
  { key: 'bo', label: 'Bo', dist: 'triangular', min: BO * 0.95, mode: BO, max: BO * 1.08 },
];
const mc = monteCarlo(
  inputs,
  (v) => (gv.grvM3 * v.grvFactor * v.ntg * v.phi * (1 - v.sw)) / v.bo,
  MC, 20260805,
);
line('─── UNCERTAINTY ─────────────────────────────────────────────────');
line(`  ${MC} trials, PERT/triangular, seed 20260805`);
line(`  P90 ${num(toMMSm3(mc.p90))}   P50 ${num(toMMSm3(mc.p50))}   P10 ${num(toMMSm3(mc.p10))}  MMSm³`);
line(`  mean ${num(toMMSm3(mc.mean))} MMSm³   ·   P10/P90 ratio ${num(mc.p10 / mc.p90)}`);
line();
line('  TORNADO — |Pearson r| against STOIIP');
for (const b of tornado(mc, inputs)) {
  const bar = '█'.repeat(Math.max(1, Math.round(Math.abs(b.r) * 30)));
  line(`   ${b.label.padEnd(18)} r=${b.r >= 0 ? '+' : ''}${num(b.r)}  ${bar}`);
  line(`   ${''.padEnd(18)} low ${num(toMMSm3(b.lowOut))} → high ${num(toMMSm3(b.highOut))} MMSm³`);
}
line();

// ── 8 · HANDOVER AUDIT ──────────────────────────────────────────────────────
// Is this model fit to give a reservoir engineer for initialisation + history match?
let degenerate = 0, inactive = 0, poroFin = 0, permFin = 0, ntgFin = 0, activeN = 0;
let permSum = 0, permN = 0;
for (let k = 0; k < p.nz; k++) {
  const layer = sim?.layers[k] ?? null;
  for (let c = 0; c < nCol; c++) {
    if (!p.activeCol[c]) continue;
    const sp = layerSpan(built, c, k);
    // no geometry at all = this zone does not cover this column (inactive, expected);
    // geometry with a non-positive thickness = a real defect
    if (!sp) { inactive++; continue; }
    if (!(sp.base - sp.top > 0)) { degenerate++; continue; }
    activeN++;
    if (layer) {
      if (Number.isFinite(layer.phie[c])) poroFin++;
      if (Number.isFinite(layer.perm[c])) { permFin++; permSum += layer.perm[c]; permN++; }
      ntgFin++;                       // facies-derived NTG is defined wherever a layer exists
    }
  }
}
const withHistory = index.wells.filter((w) => w.has?.production).length;
const withSurvey = index.wells.filter((w) => w.has?.traj).length;

const audit = auditHandover({
  grid: {
    nx: p.nx, ny: p.ny, nz: p.nz, cells: built.cells, activeCells: activeN, degenerateCells: degenerate,
    inactiveCells: inactive,
    zones: model.zones.map((z) => ({ name: z.name, nz: z.nz, crossedCols: z.crossedCols })),
    unfaulted: true,
  },
  properties: {
    simulated: !!sim,
    simNodes: sim ? sim.simGrid.nx : null,
    modelNx: p.nx,
    poroFinite: activeN ? poroFin / activeN : 0,
    permFinite: activeN ? permFin / activeN : 0,
    ntgFinite: activeN ? ntgFin / activeN : 0,
    hasPermZ: !!sim && sim.layers.every((l) => l.permZ),
    phiKFitted: false,
    meanPoro: gv.meanPhi, meanPerm: permN ? permSum / permN : 0,
    permCapped: sim ? sim.permCapped : 0,
    simulatedCells: sim ? sim.simulatedCells : 0,
  },
  wells: {
    producers: perWell.filter((x) => x.producer).length,
    producersUpscaled: perWell.filter((x) => x.producer && x.cells.length).length,
    injectors: perWell.filter((x) => x.injector).length,
    injectorsUpscaled: perWell.filter((x) => x.injector && x.cells.length).length,
    withSurvey, total: index.wells.length, withHistory,
  },
  fluids: {
    contacts: (index.contacts ?? []).map((c) => ({ kind: c.kind, tvdss: c.tvdss, nature: c.dataNature })),
    bo: index.pvt?.Bo ?? null, rs: index.pvt?.Rs ?? null,
    pb: index.pvt?.Pb ?? null, pi: index.pvt?.Pi ?? null,
    hasRelPerm: false,
  },
  regions: { eqlnum: 0, fipnum: 0, satnum: 0 },
  volumes: {
    stoiipSm3: gv.stoiipSm3,
    officialSm3: 18.70e6,
    reconcileDiff: rec.relDiff,
  },
});
const sum = summarise(audit);

line();
line('═══ HANDOVER AUDIT — initialisation + history matching ══════════');
const mark = { ready: '  OK  ', warn: ' WARN ', blocked: 'BLOCKED', absent: 'ABSENT' };
let group = '';
for (const it of sum.items) {
  const g = it.needs;
  if (g !== group) { line(); line(`  ── needed for: ${g} ──`); group = g; }
  line(`  [${mark[it.status]}] ${it.label}`);
  line(`             ${it.finding}`);
  if (it.consequence && it.status !== 'ready') line(`             ⇒ ${it.consequence}`);
}
line();
line(`  ${sum.ready} ok · ${sum.warn} warn · ${sum.blocked} blocked · ${sum.absent} absent`);
line(`  ${sum.verdict}`);
line();

line(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
