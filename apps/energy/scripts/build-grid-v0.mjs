// build-grid-v0.mjs — the canonical v0 static model case.
//
// Builds the whole chain physically — horizons → zones → grid → repair → upscale →
// facies/porosity/NTG → permeability → saturation-height → volumetrics — and writes ONE
// artifact the app can seed into its version store:
//
//     public/wb/grid-v0.json
//
// ── WHY A BUILT ARTIFACT AND NOT A LIVE COMPUTATION ─────────────────────────
//
// v0 is the case everything else is compared against, so it has to be reproducible by
// someone who does not trust the code that produced it. It therefore carries the RECIPE
// (every parameter, including the seed) alongside the RESULTS, so rebuilding it and
// getting a different answer is a detectable event rather than a shrug.
//
// It also carries the property MAPS as rasters. The 3D field is 435k cells; the maps are
// what a reader argues with, and baking them means the version list can show a case
// without loading and re-simulating it.
//
// Run: node scripts/build-grid-v0.mjs [--nz 10] [--sim 24]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hasDelivery, buildChain, readJson, WB, PERM_A, PERM_B } from './volve-chain.mjs';

if (!hasDelivery()) { console.log('SKIP — public/wb is not built. Run `npm run data:wb` first.'); process.exit(0); }

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : d; };
const NZ = arg('nz', 10), SIM = arg('sim', 24);

const { gridVolumes, toMMSm3, toMMstb } = await import('../src/tabs/fielddev/volumes.ts');
const { findPools, poolColumnMask } = await import('../src/tabs/fielddev/pools.ts');
const { zoneSurfaces } = await import('../src/tabs/fielddev/grid-build.ts');
const { structuralQc } = await import('../src/tabs/fielddev/struct-qc.ts');
const { volumeBreakdown, breakdownResidual } = await import('../src/tabs/fielddev/model-stats.ts');
const { averageMap, hcpvSource } = await import('../src/tabs/fielddev/grid-props.ts');

const L = (s = '') => console.log(s);
const t0 = Date.now();

L('═══ BUILDING GRID CASE v0 ═══════════════════════════════════════');
L(`nz ${NZ}/zone · simulation ${SIM}² · reservoir interval only`);
L();

const C = await buildChain({ nz: NZ, simNodes: SIM });
const { index, built, p, nCol, reservoirZones, resLayers, sim, owc, permA, permB, cuddyFit, params } = C;
const BO = index.pvt?.Bo ?? 1.47;

// ── properties, per cell, exactly as the volume calculation sees them ────────
const cells = C.volumeCells();
const VIN = { owc, bo: BO, zones: reservoirZones };
const gvAll = gridVolumes(cells, VIN);

const rs = zoneSurfaces(built, reservoirZones[0]);
const poolWells = index.wells.filter((w) => Number.isFinite(w.x)).map((w) => ({
  name: w.name, x: w.x, y: w.y,
  producer: /oil[-_ ]?produc/i.test(String(w.role ?? '')),
  injector: /inject/i.test(String(w.role ?? '')),
}));
const pools = findPools(
  { nx: p.nx, ny: p.ny, dx: p.dx, dy: p.dy, x0: p.x0, y0: p.y0, topZ: rs.topZ, baseZ: rs.baseZ, activeCol: p.activeCol },
  owc, poolWells, 4,
);
const drainedIds = pools.pools.filter((x) => x.drained).map((x) => x.id);
const drainedMask = poolColumnMask(pools, drainedIds, nCol);
const gvMain = gridVolumes(cells.filter((c) => drainedMask[c.col]), VIN);

L(`GRID     ${p.nx} × ${p.ny} × ${p.nz} = ${built.cells.toLocaleString('en-US')} cells · ${(built.packedBytes / 1048576).toFixed(1)} MB`);
L(`ZONES    ${built.zoneLayers.map((z) => z.name).join(' · ')}`);
L(`POOLS    ${pools.pools.length} accumulations, ${pools.drainedCount} drained`);
L();
L(`STOIIP   all pools   ${toMMSm3(gvAll.stoiipSm3).toFixed(2)} MMSm³`);
L(`         MAIN POOL   ${toMMSm3(gvMain.stoiipSm3).toFixed(2)} MMSm³  =  ${(toMMSm3(gvMain.stoiipSm3) / (index.official?.stoiipMMSm3 ?? 18.7)).toFixed(2)}× official`);
L();

// ── the breakdown, per zone and per segment ─────────────────────────────────
const zoneOf = [];
for (const zl of built.zoneLayers) for (let k = 0; k < zl.nz; k++) zoneOf[zl.k0 + k] = zl.name;
const layerOfCell = [];
{
  let n = 0;
  for (let k = 0; k < p.nz; k++) for (let c = 0; c < nCol; c++) { if (p.activeCol[c] && C.layerSpan(built, c, k)) layerOfCell[n++] = k; }
}
// CONTACT-CUT, exactly as `gridVolumes` cuts it. A breakdown over the whole zone
// includes the water leg and reports Sw ≈ 0.8 beside a STOIIP computed above the
// contact — two numbers about different rock, on the same row.
const aboveContact = (c) => {
  const half = c.thk / 2;
  if (c.z - half >= owc) return 0;
  if (c.z + half > owc) return (owc - (c.z - half)) / c.thk;   // fractional straddle
  return 1;
};
const cutCells = cells
  .map((c, n) => ({ c, n, f: aboveContact(c) }))
  .filter((x) => x.f > 0 && reservoirZones.includes(x.c.zone));

const byZone = volumeBreakdown(
  cutCells.map(({ c, n, f }) => ({
    group: c.zone ?? zoneOf[layerOfCell[n]] ?? 'unzoned',
    bulkM3: c.bulk * f, ntg: c.ntg, phi: c.phi, sw: c.sw,
  })),
  BO,
);

const poolOfCol = new Int32Array(nCol).fill(-1);
for (const pl of pools.pools) for (const c of pl.columns) poolOfCol[c] = pl.id;
const bySegment = volumeBreakdown(
  cutCells
    .filter(({ c }) => poolOfCol[c.col] >= 0)
    .map(({ c, f }) => ({
      group: `pool ${poolOfCol[c.col]}${drainedIds.includes(poolOfCol[c.col]) ? ' ★ drained' : ''}`,
      bulkM3: c.bulk * f, ntg: c.ntg, phi: c.phi, sw: c.sw,
    })),
  BO,
);

L('BY ZONE');
for (const r of byZone) L(`  ${r.group.padEnd(32)} GRV ${(r.grvM3 / 1e6).toFixed(1).padStart(7)} · NRV ${(r.nrvM3 / 1e6).toFixed(1).padStart(6)} · φ ${r.phi.toFixed(3)} · Sw ${r.sw.toFixed(3)} · ${r.stoiipMMSm3.toFixed(2)} MMSm³`);
L('BY SEGMENT');
for (const r of bySegment.slice(0, 8)) L(`  ${r.group.padEnd(32)} GRV ${(r.grvM3 / 1e6).toFixed(1).padStart(7)} · ${r.stoiipMMSm3.toFixed(2)} MMSm³ (${(r.share * 100).toFixed(1)}%)`);
L();

// ── the maps ────────────────────────────────────────────────────────────────
//
// Averaged down the RESERVOIR zone only and above the contact — the two scopes a
// property map is normally read in. Stored as plain arrays with their own range so the
// app can draw them without the grid.
const resBand = (() => {
  const zl = built.zoneLayers.find((z) => reservoirZones.includes(z.name));
  return zl ? { k0: zl.k0, nz: zl.nz } : undefined;
})();

// the TRUE per-cell span — see grid-props.hcpvSource for what the fallback costs
const spanOf = (col, layer) => C.layerSpan(built, col, layer);
const propOf = (name) => p.props.find((x) => x.name === name) ?? null;
const cellVal = (prop) => (col, layer) => {
  if (!p.activeCol[col]) return NaN;
  const raw = prop.data[layer * nCol + col];
  const span = prop.dtype === 'u8' ? 255 : 65535;
  return prop.categorical ? raw : prop.min + (raw / span) * (prop.max - prop.min);
};

const maps = {};
for (const name of ['phi', 'sw', 'ntg', 'perm', 'facies']) {
  const prop = propOf(name);
  if (!prop) continue;
  const m = averageMap(p, cellVal(prop), { owc, filter: 'above', layers: resBand, spanOf });
  let lo = Infinity, hi = -Infinity, live = 0;
  for (const v of m.values) if (Number.isFinite(v)) { live++; if (v < lo) lo = v; if (v > hi) hi = v; }
  maps[name] = {
    nx: m.nx, ny: m.ny, live, lo, hi,
    // rounded: a map is drawn at ~250 px, and full float precision triples the file
    values: Array.from(m.values, (v) => (Number.isFinite(v) ? Number(v.toFixed(5)) : null)),
  };
  L(`MAP  ${name.padEnd(7)} ${live} columns · ${lo.toFixed(4)} – ${hi.toFixed(4)}`);
}

// HCPV is a SUM down the column, not an average — "how much oil is under this square
// metre" is the question a volumetric map answers, and averaging it answers nothing.
{
  const ntgP = propOf('ntg'), phiP = propOf('phi'), swP = propOf('sw');
  const src = hcpvSource(
    { nx: p.nx, ny: p.ny, nz: p.nz, dx: p.dx, dy: p.dy, topZ: p.topZ, baseZ: p.baseZ, activeCol: p.activeCol },
    { ntg: cellVal(ntgP), phi: cellVal(phiP), sw: cellVal(swP) },
    { owc, spanOf },
  );
  const values = new Float64Array(nCol).fill(NaN);
  let lo = Infinity, hi = -Infinity, live = 0, total = 0;
  for (let c = 0; c < nCol; c++) {
    if (!p.activeCol[c]) continue;
    let sum = 0, any = false;
    for (let l = resBand ? resBand.k0 : 0; l < (resBand ? resBand.k0 + resBand.nz : p.nz); l++) {
      const v = src(c, l);
      if (Number.isFinite(v)) { sum += v; any = true; }
    }
    if (!any) continue;
    values[c] = sum; total += sum; live++;
    if (sum < lo) lo = sum;
    if (sum > hi) hi = sum;
  }
  maps.hcpv = {
    nx: p.nx, ny: p.ny, live, lo, hi, unit: 'm³ per column',
    values: Array.from(values, (v) => (Number.isFinite(v) ? Number(v.toFixed(1)) : null)),
  };
  L(`MAP  hcpv    ${live} columns · ${(lo / 1e3).toFixed(1)} – ${(hi / 1e3).toFixed(1)} km³·10⁻⁶ · total ${(total / 1e6).toFixed(1)} Mm³`);
  // the map must reconcile with the volume it is a map OF
  const implied = total / BO / 1e6;
  L(`     HCPV map ÷ Bo = ${implied.toFixed(2)} MMSm³ vs grid STOIIP ${toMMSm3(gvAll.stoiipSm3).toFixed(2)} — ${(Math.abs(implied - toMMSm3(gvAll.stoiipSm3)) / toMMSm3(gvAll.stoiipSm3) * 100).toFixed(1)}% apart`);
}
L();

// ── the record ──────────────────────────────────────────────────────────────
const sq = structuralQc(built);
const v0 = {
  id: 'v0',
  name: 'v0 · physical base case',
  note: 'Built end to end from the delivery with the corrected datum, fluid density and cutoffs. The case every other realisation is compared against.',
  createdAt: Date.parse(index.generatedAt ?? '2026-01-01'),
  fieldId: 'volve',
  recipe: {
    horizons: C.horizons.filter((h) => /bcu|hugin/i.test(h.name)).map((h) => h.id),
    nzPerZone: NZ,
    layerScheme: 'proportional',
    seed: sim?.seed ?? 1000,
    simNodes: SIM,
    permAverage: 'geometric',
    owc,
    // every parameter that moves the answer, so a rebuild is checkable
    petrophysics: {
      rhoMa: params.rhoMa, rhoFl: params.rhoFl,
      cutoffs: params.cutoffs,
      archie: { a: params.a, m: params.m, n: params.n, rw: params.rw },
      archieSource: index.shf?.archie ? 'published' : 'default',
    },
    permTransform: { a: permA, b: permB, fitted: permA !== PERM_A || permB !== PERM_B },
    shf: cuddyFit
      ? { model: 'cuddy', a: cuddyFit.a, b: cuddyFit.b, r2: cuddyFit.r2, n: cuddyFit.n }
      : { model: 'j-function' },
  },
  stats: {
    nx: p.nx, ny: p.ny, nz: p.nz,
    cells: built.cells,
    activeColumns: (() => { let n = 0; for (let c = 0; c < nCol; c++) if (p.activeCol[c]) n++; return n; })(),
    zones: built.zoneLayers.map((z) => z.name),
    ntg: gvMain.meanNtg, phi: gvMain.meanPhi, sw: gvMain.meanSw,
    stoiipMMSm3: toMMSm3(gvMain.stoiipSm3),
    sandFraction: sim?.sandFraction ?? NaN,
  },
  volumes: {
    allPools: {
      grvM3: gvAll.grvM3, ntg: gvAll.meanNtg, phi: gvAll.meanPhi, sw: gvAll.meanSw,
      stoiipMMSm3: toMMSm3(gvAll.stoiipSm3), stoiipMMstb: toMMstb(gvAll.stoiipSm3),
    },
    mainPool: {
      grvM3: gvMain.grvM3, ntg: gvMain.meanNtg, phi: gvMain.meanPhi, sw: gvMain.meanSw,
      stoiipMMSm3: toMMSm3(gvMain.stoiipSm3), stoiipMMstb: toMMstb(gvMain.stoiipSm3),
    },
    official: index.official?.stoiipMMSm3 ?? null,
    byZone, bySegment,
    residual: breakdownResidual(byZone, toMMSm3(gvAll.stoiipSm3)),
  },
  structuralQc: {
    worst: sq.worst,
    checks: sq.checks.map((c) => ({ id: c.id, label: c.label, verdict: c.verdict, count: c.count, of: c.of, finding: c.finding })),
    zones: sq.zones,
  },
  pools: pools.pools.map((x) => ({
    id: x.id, areaM2: x.areaM2, crestZ: x.crestZ, columnM: x.columnM,
    grvM3: x.grvM3, drained: x.drained, wells: x.wells,
  })),
  maps,
};

const out = join(WB, 'grid-v0.json');
writeFileSync(out, JSON.stringify(v0));
const kb = (JSON.stringify(v0).length / 1024).toFixed(0);
L(`WROTE  public/wb/grid-v0.json  (${kb} kB)`);
L(`       structural QC: ${sq.worst.toUpperCase()} · breakdown residual ${(v0.volumes.residual * 100).toFixed(2)}%`);
L();
L(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
