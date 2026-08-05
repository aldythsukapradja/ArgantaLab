// upscale-grid.ts truth-lock — well logs → grid cells (S4).
//
// The assertions here are about the averaging decisions, because those are what
// upscaling IS. A mean facies is meaningless, φ is exact under arithmetic, and k is
// not additive — the three means bracket it by orders of magnitude and picking the
// wrong one is the single largest error this step can make.
// Run: node scripts/test-upscale-grid.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const eq = (n, got, want) => check(n, Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (n, got, want, tol = 1e-9) =>
  check(n, Number.isFinite(got) && Math.abs(got - want) <= tol, `got ${got}, want ${want} ±${tol}`);

const mod = join(__dirname, '..', 'src', 'tabs', 'fielddev', 'upscale-grid.ts');
if (!existsSync(mod)) { console.log('SKIP — upscale-grid.ts absent'); process.exit(0); }
const {
  arithmetic, geometric, harmonic, averageBy, majority, netFraction,
  blockWell, columnOf, upscaleWells, mdToTvd, mdToPoint, placeSamples, blockWellPath,
} = await import('../src/tabs/fielddev/upscale-grid.ts');

// ── the deviated well must block into every column it CROSSES ────────────────
//
// Volve's producers step out 463 m (F-12) to 1,595 m (F-15 D) — 9 to 32 columns on a
// 50 m grid. Blocking a well at its surface slot conditions rock it never touched and
// misses every column it actually drilled. Before this, 6 producers contributed 1
// column each; after, they contribute 24–68.
{
  const st = [
    { md: 0, tvd: 0, dispNs: 0, dispEw: 0 },
    { md: 1000, tvd: 1000, dispNs: 0, dispEw: 0 },
    { md: 2000, tvd: 1900, dispNs: 0, dispEw: 400 },   // building angle, heading east
  ];
  const p0 = mdToPoint(st, 0);
  eq('at surface the offset is zero', [p0.ns, p0.ew], [0, 0]);
  const mid = mdToPoint(st, 1500);
  near('the lateral offset interpolates', mid.ew, 200);
  near('…and so does TVD', mid.tvd, 1450);
  const past = mdToPoint(st, 2500);
  check('past the last station the tangent CONTINUES laterally too',
    past.ew > 400, `ew = ${past.ew}`);
  eq('no survey ⇒ no offset rather than a throw',
    [mdToPoint([], 900).ns, mdToPoint([], 900).ew], [0, 0]);

  // placeSamples puts each sample at wellhead + offset
  const placed = placeSamples({ x: 1000, y: 2000 }, st, [
    { md: 0, tvdss: 0, vsh: 0.1, phie: 0.2, sw: 0.3, net: true },
    { md: 2000, tvdss: 0, vsh: 0.1, phie: 0.2, sw: 0.3, net: true },
  ]);
  eq('the shallow sample sits at the wellhead', [placed[0].x, placed[0].y], [1000, 2000]);
  eq('the deep sample sits 400 m east of it', [placed[1].x, placed[1].y], [1400, 2000]);
  near('…and carries its true vertical depth', placed[1].tvdss, 1900);
}

// ── blockWellPath spreads a well across columns ──────────────────────────────
{
  const grid = { nx: 10, ny: 4, dx: 100, dy: 100, x0: 0, y0: 0 };
  const spans = { spans: [[1000, 1100], [1100, 1200], [1200, 1300]] };
  const layersFor = () => spans;
  const K = (phi) => Math.pow(10, 19 * phi - 1.5);

  // a well walking east, one sample per 100 m of easting, all at the same depth
  const samples = Array.from({ length: 6 }, (_, i) => ({
    md: 1050, tvdss: 1050, vsh: 0.1, phie: 0.2, sw: 0.3, net: true,
    x: 50 + i * 100, y: 50,
  }));
  const r = blockWellPath({ name: 'DEV-1', samples }, grid, layersFor,
    { permAverage: 'geometric', phiToK: K });

  eq('a well crossing six columns produces six cells', r.cells.length, 6);
  eq('…and reports the columns it crossed', r.columnsCrossed, 6);
  eq('every cell is in a different column', new Set(r.cells.map((c) => `${c.i},${c.j}`)).size, 6);
  eq('all in the layer their depth falls in', new Set(r.cells.map((c) => c.k)), new Set([0]));

  // the same samples at ONE position give ONE cell — the old slot behaviour
  const slot = blockWellPath(
    { name: 'SLOT', samples: samples.map((s) => ({ ...s, x: 50, y: 50 })) },
    grid, layersFor, { permAverage: 'geometric', phiToK: K },
  );
  eq('the same log blocked at a single slot gives ONE cell', slot.cells.length, 1);
  check('so following the path multiplies the conditioning data',
    r.cells.length > slot.cells.length * 5, `${r.cells.length} vs ${slot.cells.length}`);

  // off-grid and out-of-layer samples are counted, not silently lost
  const messy = blockWellPath({ name: 'M', samples: [
    { md: 1, tvdss: 1050, vsh: 0.1, phie: 0.2, sw: 0.3, net: true, x: 50, y: 50 },
    { md: 2, tvdss: 1050, vsh: 0.1, phie: 0.2, sw: 0.3, net: true, x: 99999, y: 50 },
    { md: 3, tvdss: 5000, vsh: 0.1, phie: 0.2, sw: 0.3, net: true, x: 50, y: 50 },
  ] }, grid, layersFor, { permAverage: 'geometric', phiToK: K });
  eq('one usable sample ⇒ one cell', messy.cells.length, 1);
  eq('the off-grid sample is counted', messy.outsideGrid, 1);
  eq('the out-of-layer sample is counted', messy.noLayer, 1);
}

// ── MD → TVD: not optional, and measured against the real Volve survey ────────
//
// A log is indexed in MEASURED depth; a grid is built in TRUE VERTICAL depth. On
// Volve's F-12 (53 deg inclination) MD 3520 is TVD 3108 — a 412 m difference. Using
// MD as a depth put every sample in the wrong layer and missed the reservoir; the
// headless run showed 2 of 24 wells producing a cell before this, and 4+ after.
{
  const st = [{ md: 0, tvd: 0 }, { md: 1000, tvd: 1000 }, { md: 2000, tvd: 1800 }, { md: 3000, tvd: 2400 }];
  eq('a vertical section is 1:1', mdToTvd(st, 500), 500);
  eq('an exact station returns its own TVD', mdToTvd(st, 2000), 1800);
  eq('between stations it interpolates', mdToTvd(st, 1500), 1400);
  eq('and in the deviated section too', mdToTvd(st, 2500), 2100);
  // a log routinely runs deeper than the last survey point; clamping would stack
  // every deeper sample at one depth
  eq('beyond the last station the final gradient is CONTINUED, not clamped',
    mdToTvd(st, 4000), 3000);
  check('…which is strictly deeper than the last station', mdToTvd(st, 4000) > 2400, '');
  eq('no survey at all falls back to MD rather than throwing', mdToTvd([], 1234), 1234);
  check('a real 53-degree well diverges by hundreds of metres',
    Math.abs(mdToTvd([{ md: 0, tvd: 0 }, { md: 3520, tvd: 3108.36 }], 3520) - 3520) > 400,
    `MD 3520 → TVD ${mdToTvd([{ md: 0, tvd: 0 }, { md: 3520, tvd: 3108.36 }], 3520).toFixed(0)}`);
}

// ── the three means, and the order that matters ────────────────────────────────
{
  const k = [1, 10, 100, 1000];
  near('arithmetic is the parallel-flow upper bound', arithmetic(k), 277.75);
  near('geometric is the screening compromise', geometric(k), Math.exp((Math.log(1) + Math.log(10) + Math.log(100) + Math.log(1000)) / 4), 1e-9);
  near('harmonic is the series-flow lower bound', harmonic(k), 4 / (1 / 1 + 1 / 10 + 1 / 100 + 1 / 1000), 1e-9);
  check('harmonic ≤ geometric ≤ arithmetic — always',
    harmonic(k) < geometric(k) && geometric(k) < arithmetic(k),
    `${harmonic(k).toFixed(2)} < ${geometric(k).toFixed(2)} < ${arithmetic(k).toFixed(2)}`);
  check('and they span orders of magnitude, which is why the choice is explicit',
    arithmetic(k) / harmonic(k) > 50, `ratio ${(arithmetic(k) / harmonic(k)).toFixed(0)}×`);

  eq('averageBy routes to the named mean', averageBy('harmonic', k), harmonic(k));
  eq('nulls are skipped, not treated as zero', arithmetic([2, null, 4]), 3);
  eq('no finite value ⇒ null, never 0', arithmetic([null, undefined, NaN]), null);
  // a single zero would drive the geometric mean to zero regardless of the rest —
  // that is a property of the formula, not of the rock
  near('a zero is EXCLUDED from the geometric mean rather than zeroing it',
    geometric([0, 10, 1000]), Math.exp((Math.log(10) + Math.log(1000)) / 2), 1e-9);
  eq('all-zero ⇒ null rather than 0', geometric([0, 0]), null);
}

// ── facies is a label ─────────────────────────────────────────────────────────
{
  eq('the mode wins', majority([1, 1, 0]), 1);
  eq('and the other way', majority([0, 0, 1]), 0);
  eq('a tie is resolved deterministically, not by a coin flip', majority([1, 0]), 1);
  eq('…and the same input always gives the same answer', majority([0, 1]), 0);
  eq('an empty label set is null', majority([]), null);
}

// ── net fraction ──────────────────────────────────────────────────────────────
{
  near('half net is 0.5', netFraction([true, false]), 0.5);
  eq('an unevaluable sample is excluded from BOTH sides, not counted as non-net',
    netFraction([true, null, null]), 1);
  eq('nothing evaluable ⇒ null', netFraction([null, null]), null);
}

// ── blocking a well into layers ───────────────────────────────────────────────
// `??` would turn an explicit null back into the default, which is exactly the case
// several assertions below are trying to construct — so the defaults are applied by
// key presence, not by nullishness.
const sample = (tvdss, o = {}) => ({
  md: tvdss, tvdss,
  vsh: 'vsh' in o ? o.vsh : 0.1,
  phie: 'phie' in o ? o.phie : 0.2,
  sw: 'sw' in o ? o.sw : 0.3,
  net: 'net' in o ? o.net : true,
});
const LAYERS = { spans: [[3000, 3010], [3010, 3020], [3020, 3030]] };
const K = (phi) => Math.pow(10, 19 * phi - 1.5);   // engine/perm.phiToK defaults

{
  const well = {
    name: 'F-1', x: 0, y: 0,
    samples: [sample(3001), sample(3005), sample(3012), sample(3025)],
  };
  const cells = blockWell(well, { i: 2, j: 3 }, LAYERS, { permAverage: 'geometric', phiToK: K });

  eq('one cell per layer that received a sample', cells.map((c) => c.k), [0, 1, 2]);
  eq('the column is carried through', [cells[0].i, cells[0].j], [2, 3]);
  eq('sample counts are reported', cells.map((c) => c.nSamples), [2, 1, 1]);
  near('φ is the arithmetic mean of its samples', cells[0].phie, 0.2);
  eq('the well name rides along', cells[0].well, 'F-1');

  // a sample outside every layer is DROPPED, not clamped into the nearest
  const outside = blockWell(
    { name: 'F-2', x: 0, y: 0, samples: [sample(2500), sample(3500)] },
    { i: 0, j: 0 }, LAYERS, { permAverage: 'geometric', phiToK: K },
  );
  eq('samples above and below the model produce no cell', outside.length, 0);

  // net vs non-net: φ/Sw come from the NET samples, NTG from all of them
  const mixed = blockWell(
    { name: 'F-3', x: 0, y: 0, samples: [
      sample(3001, { net: true, phie: 0.25, sw: 0.2 }),
      sample(3002, { net: false, phie: 0.05, sw: 0.9 }),
    ] },
    { i: 0, j: 0 }, LAYERS, { permAverage: 'geometric', phiToK: K },
  );
  near('φ is averaged over the NET samples only', mixed[0].phie, 0.25);
  near('…and so is Sw — averaging through shale drags it toward the seal', mixed[0].sw, 0.2);
  near('NTG counts ALL the samples', mixed[0].ntg, 0.5);

  // facies is the mode over ALL samples, by the Vsh cutoff
  const shaly = blockWell(
    { name: 'F-4', x: 0, y: 0, samples: [
      sample(3001, { vsh: 0.8 }), sample(3002, { vsh: 0.9 }), sample(3003, { vsh: 0.1 }),
    ] },
    { i: 0, j: 0 }, LAYERS, { permAverage: 'geometric', phiToK: K },
  );
  eq('a mostly-shale cell blocks to SHALE', shaly[0].facies, 0);

  // no porosity ⇒ no cell, rather than a cell with a fabricated zero
  const noPhi = blockWell(
    { name: 'F-5', x: 0, y: 0, samples: [sample(3001, { phie: null })] },
    { i: 0, j: 0 }, LAYERS, { permAverage: 'geometric', phiToK: K },
  );
  eq('a cell with no porosity is not created', noPhi.length, 0);
}

// ── the perm average genuinely changes the answer ─────────────────────────────
{
  const spread = {
    name: 'F-6', x: 0, y: 0,
    samples: [sample(3001, { phie: 0.05 }), sample(3002, { phie: 0.30 })],
  };
  const g = blockWell(spread, { i: 0, j: 0 }, LAYERS, { permAverage: 'geometric', phiToK: K })[0].perm;
  const a = blockWell(spread, { i: 0, j: 0 }, LAYERS, { permAverage: 'arithmetic', phiToK: K })[0].perm;
  const h = blockWell(spread, { i: 0, j: 0 }, LAYERS, { permAverage: 'harmonic', phiToK: K })[0].perm;
  check('the three means order correctly on real φ→k values', h < g && g < a, `${h.toFixed(2)} < ${g.toFixed(2)} < ${a.toFixed(2)}`);
  check('and differ by orders of magnitude over a realistic φ spread',
    a / h > 100, `arithmetic is ${(a / h).toFixed(0)}× the harmonic`);
}

// ── areal placement ───────────────────────────────────────────────────────────
{
  const grid = { nx: 10, ny: 10, dx: 100, dy: 100, x0: 1000, y0: 2000 };
  eq('a wellhead lands in its column', columnOf(1050, 2050, grid), { i: 0, j: 0 });
  eq('and further in', columnOf(1450, 2750, grid), { i: 4, j: 7 });
  eq('west of the grid is outside', columnOf(900, 2050, grid), null);
  eq('east of the grid is outside', columnOf(9000, 2050, grid), null);
  eq('north of the grid is outside', columnOf(1050, 9000, grid), null);
}

// ── the whole pass ────────────────────────────────────────────────────────────
{
  const grid = { nx: 4, ny: 4, dx: 100, dy: 100, x0: 0, y0: 0 };
  const layersFor = (i, j) => (i === 3 && j === 3 ? null : LAYERS);   // one dead column
  const wells = [
    { name: 'IN', x: 150, y: 150, samples: [sample(3005)] },
    { name: 'OUT', x: 9999, y: 9999, samples: [sample(3005)] },
    { name: 'EMPTY', x: 150, y: 150, samples: [] },
    { name: 'DEADCOL', x: 350, y: 350, samples: [sample(3005)] },
    { name: 'ABOVE', x: 250, y: 250, samples: [sample(1000)] },
  ];
  const r = upscaleWells(wells, grid, layersFor, { permAverage: 'geometric', phiToK: K });

  eq('only the well inside a live column produced cells', r.cells.map((c) => c.well), ['IN']);
  eq('every skip names its reason', r.skipped.map((s) => `${s.well}:${s.why}`), [
    'OUT:wellhead outside the model area',
    'EMPTY:no interpreted samples',
    'DEADCOL:column is not in the model',
    'ABOVE:no sample fell inside a layer',
  ]);
  eq('the perm average is recorded on the result', r.permAverage, 'geometric');
  eq('thin cells are counted, so a 1-sample average is not mistaken for a solid one',
    r.thinCells, 1);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
