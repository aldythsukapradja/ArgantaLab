// model-stats.ts truth-lock — the numbers a QC panel puts on screen.
//
// The assertions that carry it:
//   1. percentiles travel with every distribution, because one capped cell sets a max
//      and a mean over a log-distributed property describes no cell in the model;
//   2. facies is COUNTED, never averaged — a "mean facies" of 0.8 is not a rock;
//   3. every volumetric row carries its PROVENANCE, so an assumed saturation cannot be
//      read with the same confidence as a simulated porosity.
// Run: node scripts/test-model-stats.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const eq = (n, got, want) => check(n, Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (n, got, want, tol) => check(n, Math.abs(got - want) <= tol, `got ${got}, want ${want} ±${tol}`);

const mod = join(__dirname, '..', 'src', 'tabs', 'fielddev', 'model-stats.ts');
if (!existsSync(mod)) { console.log('SKIP — model-stats.ts absent'); process.exit(0); }
const {
  distribution, propertyStats, faciesStats, structureStats, upscaleStats, volumeReport,
} = await import('../src/tabs/fielddev/model-stats.ts');

// ── distribution ────────────────────────────────────────────────────────────
{
  const d = distribution([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  eq('n counts the finite values', d.n, 10);
  eq('min and max', [d.min, d.max], [1, 10]);
  near('mean', d.mean, 5.5, 1e-9);
  near('p50', d.p50, 5, 1);
  check('p10 < p50 < p90', d.p10 < d.p50 && d.p50 < d.p90, `${d.p10}/${d.p50}/${d.p90}`);
  check('no geometric mean unless asked for', Number.isNaN(d.geoMean), '');

  // THE POINT OF PERCENTILES: one wild value moves max, not p90
  const spiked = distribution([...Array(99).fill(5), 100000]);
  eq('one outlier owns the max', spiked.max, 100000);
  near('…but p90 is unmoved', spiked.p90, 5, 0.001);
  check('…while the MEAN is dragged with it — which is why both are shown',
    spiked.mean > 1000, `${spiked.mean.toFixed(0)}`);

  // permeability: arithmetic and geometric means differ by design
  const k = distribution([1, 10, 100, 1000, 10000], 0, true);
  near('the geometric mean of a log-spread property', k.geoMean, 100, 1);
  check('…and it is far below the arithmetic mean', k.mean > 20 * k.geoMean, `${k.mean} vs ${k.geoMean}`);

  const empty = distribution([]);
  eq('an empty set yields n=0, not a crash', empty.n, 0);
  check('…with NaN rather than 0 for the statistics', Number.isNaN(empty.mean), '');
  eq('non-finite values are filtered, and the skipped count is carried',
    distribution([1, NaN, 2, Infinity], 7).n, 2);
  eq('…preserving what was skipped', distribution([1, 2], 7).skipped, 7);
}

// ── a small grid ────────────────────────────────────────────────────────────
const NX = 4, NY = 3, NZ = 2, NCOL = NX * NY;
const activeCol = new Uint8Array(NCOL).fill(1);
activeCol[5] = 0;
const phi = {
  name: 'phi', dtype: 'u16', categorical: false, min: 0, max: 0.4,
  data: Uint16Array.from({ length: NCOL * NZ }, (_, n) => 16383 + (n % 3) * 8000),
};
const perm = {
  name: 'perm', dtype: 'u8', categorical: false, min: 1, max: 5000,
  data: Uint8Array.from({ length: NCOL * NZ }, (_, n) => 10 + (n % 7) * 30),
};
const facies = {
  name: 'facies', dtype: 'u8', categorical: true, min: 0, max: 1,
  data: Uint8Array.from({ length: NCOL * NZ }, (_, n) => (n % 4 === 0 ? 0 : 1)),
};
const G = { nx: NX, ny: NY, nz: NZ, activeCol, props: [phi, perm, facies] };

{
  const st = propertyStats(G);
  eq('categorical properties are excluded from the continuous summaries', st.length, 2);
  eq('…and are named for the reader, not by their key', st[0].label, 'Porosity');
  eq('units travel with the number', st[0].unit, 'v/v');
  eq('the inactive column is skipped, not zeroed', st[0].dist.n, (NCOL - 1) * NZ);
  eq('…and the skip is counted', st[0].dist.skipped, NZ);

  const k = st.find((s) => s.key === 'perm');
  check('permeability is flagged log-distributed', k.logDistributed, '');
  check('…and carries a geometric mean', Number.isFinite(k.dist.geoMean), `${k.dist.geoMean}`);
  const p = st.find((s) => s.key === 'phi');
  check('porosity is not, and does not', !p.logDistributed && Number.isNaN(p.dist.geoMean), '');
}

// ── facies is counted, never averaged ───────────────────────────────────────
{
  const f = faciesStats(G);
  eq('every cell is accounted for', f.total, (NCOL - 1) * NZ);
  eq('one entry per code', f.codes.length, 2);
  eq('…labelled by rock', f.codes.map((c) => c.label), ['Shale', 'Sand']);
  near('the fractions sum to one', f.codes.reduce((a, c) => a + c.fraction, 0), 1, 1e-9);
  check('a sand fraction is surfaced', Number.isFinite(f.sandFraction), `${f.sandFraction}`);
  eq('…and it equals the sand code fraction',
    f.sandFraction, f.codes.find((c) => c.label === 'Sand').fraction);

  eq('a grid with no categorical property returns null rather than inventing facies',
    faciesStats({ ...G, props: [phi] }), null);
}

// ── structure ───────────────────────────────────────────────────────────────
{
  const topZ = Float64Array.from({ length: NCOL }, () => 2800);
  const baseZ = Float64Array.from({ length: NCOL }, (_, c) => 2800 + 20 + (c % 4) * 10);
  const s = structureStats({ nx: NX, ny: NY, nz: NZ, dx: 100, dy: 100, topZ, baseZ, activeCol });
  eq('active columns exclude the inactive one', s.activeColumns, NCOL - 1);
  near('area follows from the cell size', s.areaKm2, (NCOL - 1) * 100 * 100 / 1e6, 1e-9);
  eq('total cells is the whole box', s.cells, NCOL * NZ);
  check('live cells are fewer than the box', s.liveCells < s.cells, `${s.liveCells}/${s.cells}`);
  check('thickness is a DISTRIBUTION, not a single number',
    s.thickness.p10 !== s.thickness.p90, `${s.thickness.p10}..${s.thickness.p90}`);
  near('the shallowest top', s.topDepth.min, 2800, 1e-9);
}

// ── upscaling: the blocking bias is the point ───────────────────────────────
{
  const cells = [
    { well: 'A', i: 1, j: 1, phie: 0.20, ntg: 0.9, nSamples: 40 },
    { well: 'A', i: 1, j: 2, phie: 0.22, ntg: 0.8, nSamples: 30 },
    { well: 'A', i: 1, j: 2, phie: 0.18, ntg: 0.7, nSamples: 2 },
    { well: 'B', i: 5, j: 5, phie: 0.10, ntg: 0.3, nSamples: 1 },
  ];
  const u = upscaleStats(cells, [0.24, 0.26, 0.22, 0.28], 6);
  eq('wells with cells are counted separately from wells offered', [u.wellsWithCells, u.wells], [2, 6]);
  eq('cells resting on fewer than three samples are flagged', u.thinCells, 2);
  eq('distinct columns are counted, not cells', u.columnsCrossed, 3);
  eq('the busiest well sorts first', u.perWell[0].well, 'A');
  eq('…with its own column count', u.perWell[0].columns, 2);

  check('the LOG and BLOCKED distributions are both reported, so the bias is visible',
    u.logPhi.n === 4 && u.blockedPhi.n === 4, '');
  check('…and here blocking has lowered the mean', u.blockedPhi.mean < u.logPhi.mean,
    `${u.blockedPhi.mean.toFixed(3)} vs ${u.logPhi.mean.toFixed(3)}`);
}

// ── the volumetric report carries provenance ────────────────────────────────
{
  const rows = volumeReport({
    grvM3: 207.2e6, ntg: 0.826, phi: 0.218, sw: 0.242, bo: 1.47,
    stoiipMMSm3: 18.75, officialMMSm3: 18.70,
    swSource: 'assumed', contactM: 3065, contactNature: 'interpreted',
    poolName: 'main pool',
  });
  const by = (l) => rows.find((r) => r.label.startsWith(l));
  eq('EVERY row declares where its number came from',
    rows.filter((r) => !r.source).length, 0);
  eq('porosity is modelled', by('Porosity').source, 'modelled');
  eq('an assumed saturation says so', by('Water saturation').source, 'assumed');
  eq('the contact is an assumption, not a measurement', by('Fluid contact').source, 'assumed');
  eq('…and carries its nature', by('Fluid contact').note, 'interpreted');
  eq('Bo is published', by('Bo').source, 'published');
  eq('the STOIIP is derived, not measured', by('STOIIP').source, 'derived');
  check('…and is named for the pool it belongs to',
    /main pool/.test(by('STOIIP').label), by('STOIIP').label);
  check('the comparison row quotes the published figure it used',
    /18\.70/.test(by('vs published').note ?? ''), by('vs published').note);

  const noOfficial = volumeReport({ grvM3: 1e6, ntg: 0.8, phi: 0.2, sw: 0.3, bo: 1.2, stoiipMMSm3: 1 });
  check('with no published figure there is no comparison row, not a fabricated one',
    !noOfficial.some((r) => r.label === 'vs published'), '');
  check('…and no contact row when none is defined',
    !noOfficial.some((r) => r.label === 'Fluid contact'), '');
}

// == the volumetric breakdown ===============================================
{
  const { volumeBreakdown, breakdownResidual } = await import('../src/tabs/fielddev/model-stats.ts');
  const BO = 1.5;
  const cells = [
    { group: 'Hugin', bulkM3: 1000, ntg: 0.8, phi: 0.25, sw: 0.2 },
    { group: 'Hugin', bulkM3: 3000, ntg: 0.6, phi: 0.20, sw: 0.3 },
    { group: 'Skagerrak', bulkM3: 2000, ntg: 0.4, phi: 0.15, sw: 0.5 },
  ];
  const rows = volumeBreakdown(cells, BO);
  eq('one row per group', rows.length, 2);
  eq('the biggest contributor sorts first', rows[0].group, 'Hugin');

  const h = rows[0];
  near('GRV is the bulk sum', h.grvM3, 4000, 1e-9);
  near('NRV is GRV x NTG, summed per cell', h.nrvM3, 1000 * 0.8 + 3000 * 0.6, 1e-9);
  near('pore volume follows', h.pvM3, 1000 * 0.8 * 0.25 + 3000 * 0.6 * 0.2, 1e-9);
  near('HCPV takes out the water', h.hcpvM3, 1000 * 0.8 * 0.25 * 0.8 + 3000 * 0.6 * 0.2 * 0.7, 1e-9);
  near('STOIIP is HCPV / Bo', h.stoiipMMSm3, h.hcpvM3 / BO / 1e6, 1e-15);

  // BULK-WEIGHTED, not a cell mean: the 3000 m3 cell must outweigh the 1000 m3 one
  near('NTG is bulk-weighted', h.ntg, (1000 * 0.8 + 3000 * 0.6) / 4000, 1e-9);
  check('...which differs from the plain cell mean of 0.70',
    Math.abs(h.ntg - 0.7) > 0.01, `${h.ntg.toFixed(3)}`);
  near('porosity is weighted by NET rock, not gross', h.phi, h.pvM3 / h.nrvM3, 1e-12);
  near('saturation is recovered from the pore and hydrocarbon volumes', h.sw, 1 - h.hcpvM3 / h.pvM3, 1e-12);

  near('shares sum to one', rows.reduce((s, r) => s + r.share, 0), 1, 1e-9);

  // the breakdown must be checkable against the total it explains
  const total = rows.reduce((s, r) => s + r.stoiipMMSm3, 0);
  near('a complete breakdown has no residual', breakdownResidual(rows, total), 0, 1e-12);
  near('...and a missing group shows up as one',
    breakdownResidual([rows[0]], total), rows[1].stoiipMMSm3 / total, 1e-12);

  // degenerate inputs
  eq('zero-bulk cells are dropped rather than dividing by zero',
    volumeBreakdown([{ group: 'x', bulkM3: 0, ntg: 1, phi: 1, sw: 0 }], BO).length, 0);
  const nan = volumeBreakdown([{ group: 'x', bulkM3: 100, ntg: NaN, phi: NaN, sw: NaN }], BO);
  eq('a cell with no properties contributes bulk but no hydrocarbon', nan[0].hcpvM3, 0);
  near('...and its GRV is still counted, so the rock is not lost', nan[0].grvM3, 100, 1e-9);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
