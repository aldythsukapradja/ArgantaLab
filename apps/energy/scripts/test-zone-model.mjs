// zone-model.ts truth-lock — horizons on different grids → one common frame → zones.
//
// The assertions here are about the three rules the module promises: a node outside a
// horizon's extent is NULL rather than extrapolated, a crossing horizon is REPORTED
// rather than clipped, and depth is normalised so an elevation grid and a depth grid
// can be differenced at all.
// Run: node scripts/test-zone-model.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const eq = (n, got, want) => check(n, Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (n, got, want, tol = 1e-9) =>
  check(n, Number.isFinite(got) && Math.abs(got - want) <= tol, `got ${got}, want ${want} ±${tol}`);

const mod = join(__dirname, '..', 'src', 'tabs', 'fielddev', 'zone-model.ts');
if (!existsSync(mod)) { console.log('SKIP — zone-model.ts absent'); process.exit(0); }
const {
  deriveCommonGrid, sampleHorizon, resample, buildZoneModel, zoneToGridSpec,
  toDepth, packedBytes, peakBuildBytes,
} = await import('../src/tabs/fielddev/zone-model.ts');

/** A flat horizon at constant depth, on its own origin and spacing. */
const flat = (id, depth, o = {}) => ({
  id, name: id,
  ncol: o.ncol ?? 5, nrow: o.nrow ?? 5,
  values: new Float64Array((o.ncol ?? 5) * (o.nrow ?? 5)).fill(depth),
  x0: o.x0 ?? 0, y0: o.y0 ?? 0, dx: o.dx ?? 100, dy: o.dy ?? 100,
  flip: o.flip ?? false,
});

// ── depth convention ───────────────────────────────────────────────────────────
eq('a depth grid passes through', toDepth(3000, false), 3000);
eq('an elevation grid is negated to a depth', toDepth(-3000, true), 3000);

// ── the common grid ────────────────────────────────────────────────────────────
{
  // two horizons on DIFFERENT origins and DIFFERENT spacings — the Volve case
  const a = flat('A', 2000, { x0: 0, y0: 0, dx: 100, dy: 100, ncol: 5, nrow: 5 });      // 0..400
  const b = flat('B', 2100, { x0: 200, y0: 200, dx: 50, dy: 50, ncol: 5, nrow: 5 });    // 200..400
  const g = deriveCommonGrid([a, b]);
  eq('the common origin is the south-west-most corner', [g.x0, g.y0], [0, 0]);
  eq('the common spacing is the FINEST of the inputs', [g.dx, g.dy], [50, 50]);
  eq('the common extent reaches the north-east-most node', [g.nx, g.ny], [9, 9]);
  check('no horizon is cropped',
    g.x0 + g.dx * (g.nx - 1) >= 400 && g.y0 + g.dy * (g.ny - 1) >= 400, '');

  // the node ceiling relaxes the cell size rather than producing a grid nobody asked for
  const huge = flat('H', 2000, { x0: 0, y0: 0, dx: 1, dy: 1, ncol: 4001, nrow: 4001 });
  const capped = deriveCommonGrid([huge], 100_000);
  check('the node ceiling is respected', capped.nx * capped.ny <= 100_000,
    `${capped.nx} × ${capped.ny} = ${capped.nx * capped.ny}`);
  check('…by relaxing the cell size, which the caller can see', capped.dx > 1, `dx = ${capped.dx}`);

  eq('no usable grid ⇒ no common frame', deriveCommonGrid([]), null);
}

// ── sampling: bilinear inside, NULL outside, NULL across a hole ────────────────
{
  // a ramp: value = 1000 + 10·i, so an exact node is exact and a midpoint is the mean
  const ncol = 3, nrow = 3;
  const values = new Float64Array(ncol * nrow);
  for (let j = 0; j < nrow; j++) for (let i = 0; i < ncol; i++) values[j * ncol + i] = 1000 + 10 * i;
  const g = { id: 'R', name: 'R', ncol, nrow, values, x0: 0, y0: 0, dx: 100, dy: 100, flip: false };

  near('an exact node returns its own value', sampleHorizon(g, 0, 0), 1000);
  near('a second node too', sampleHorizon(g, 100, 0), 1010);
  near('a midpoint is the linear blend', sampleHorizon(g, 50, 0), 1005);
  near('and it is bilinear in both axes', sampleHorizon(g, 50, 50), 1005);

  check('outside the west edge is NULL, not extrapolated', Number.isNaN(sampleHorizon(g, -1, 0)), '');
  check('outside the east edge is NULL', Number.isNaN(sampleHorizon(g, 201, 0)), '');
  check('outside the north edge is NULL', Number.isNaN(sampleHorizon(g, 0, 201)), '');
  check('the far corner node is still IN', Number.isFinite(sampleHorizon(g, 200, 200)), '');

  // a hole: any corner null ⇒ the sample is null, so the edge of the interpretation
  // is not smeared outwards
  const holed = { ...g, values: Float64Array.from(values) };
  holed.values[0] = NaN;
  check('a cell touching a null node yields NULL', Number.isNaN(sampleHorizon(holed, 50, 50)), '');
  check('a cell away from the hole is unaffected', Number.isFinite(sampleHorizon(holed, 150, 150)), '');
}

// ── resample onto the common frame ────────────────────────────────────────────
{
  const a = flat('A', 2000, { x0: 0, y0: 0, dx: 100, dy: 100, ncol: 3, nrow: 3 });   // 0..200
  const common = { nx: 5, ny: 5, dx: 100, dy: 100, x0: 0, y0: 0 };                   // 0..400
  const z = resample(a, common);
  eq('nodes inside the horizon carry its value', z[0], 2000);
  check('nodes beyond it are NULL', Number.isNaN(z[4]), `z[4] = ${z[4]}`);
  const live = [...z].filter(Number.isFinite).length;
  eq('exactly the covered nodes are live', live, 9);
}

// ── zones: thickness, crossings, active columns ───────────────────────────────
{
  const top = flat('Top', 2000);
  const base = flat('Base', 2050);
  const deeper = flat('Deeper', 2400);
  const m = buildZoneModel([top, base, deeper], { kind: 'proportional', nz: 10 });

  eq('N horizons give N−1 zones', m.zones.length, 2);
  eq('the zone is named for its bounding pair', m.zones[0].name, 'Top → Base');
  near('mean gross thickness is measured, not assumed', m.zones[0].meanThicknessM, 50);
  near('and the second zone too', m.zones[1].meanThicknessM, 350);
  eq('every column is active where both horizons exist', m.zones[0].activeCol.length, 25);
  eq('…and all 25 are active here', [...m.zones[0].activeCol].filter((v) => v === 1).length, 25);
  eq('nothing crossed', m.zones[0].crossedCols, 0);
  eq('cells = columns × layers × zones', m.cells, 25 * 10 * 2);

  const spec = zoneToGridSpec(m.zones[0], m.grid);
  eq('the GridSpec carries the common frame', [spec.nx, spec.ny, spec.nz], [5, 5, 10]);
  eq('…and the zone’s own surfaces', [spec.topZ[0], spec.baseZ[0]], [2000, 2050]);
}

// ── a CROSSING is reported, never clipped ─────────────────────────────────────
{
  const top = flat('Top', 2000);
  // a base that is ABOVE the top over part of the area — a structural error
  const bad = flat('Base', 2050);
  bad.values = Float64Array.from(bad.values);
  for (let c = 0; c < 10; c++) bad.values[c] = 1900;   // 10 nodes sit above the top
  const m = buildZoneModel([top, bad], { kind: 'proportional', nz: 5 });

  check('the crossing is COUNTED', m.zones[0].crossedCols > 0, `${m.zones[0].crossedCols} columns`);
  eq('a crossed column is NOT active', [...m.zones[0].activeCol].filter((v) => v === 1).length,
    m.zones[0].overlapCols - m.zones[0].crossedCols);
  check('mean thickness excludes the crossed columns rather than going negative',
    m.zones[0].meanThicknessM > 0, `mean = ${m.zones[0].meanThicknessM}`);
  check('min thickness is a real positive thickness',
    m.zones[0].minThicknessM > 0, `min = ${m.zones[0].minThicknessM}`);
}

// ── an elevation grid differenced against a depth grid ────────────────────────
{
  // Top stored as ELEVATION (−2000), base stored as DEPTH (2050). Without the
  // convention normalisation this zone would come out 4050 m thick.
  const top = flat('Top', -2000, { flip: true });
  const base = flat('Base', 2050);
  const m = buildZoneModel([top, base], { kind: 'proportional', nz: 4 });
  near('mixed conventions still difference correctly', m.zones[0].meanThicknessM, 50);
}

// ── non-overlapping horizons produce no zone rather than a bogus one ──────────
{
  const a = flat('A', 2000, { x0: 0, y0: 0, ncol: 3, nrow: 3, dx: 100, dy: 100 });        // 0..200
  const b = flat('B', 2100, { x0: 10000, y0: 10000, ncol: 3, nrow: 3, dx: 100, dy: 100 }); // far away
  const m = buildZoneModel([a, b], { kind: 'proportional', nz: 5 });
  check('two horizons that never overlap yield no active column',
    !m || m.zones.every((z) => [...z.activeCol].every((v) => v === 0)),
    m ? `${m.zones[0].overlapCols} overlapping columns` : 'no model');
}

eq('fewer than two horizons is not a zone model', buildZoneModel([flat('A', 2000)], { kind: 'proportional', nz: 5 }), null);

// ── the budget, and why building zone-by-zone matters ─────────────────────────
{
  const m = buildZoneModel([flat('A', 2000), flat('B', 2100), flat('C', 2300)], { kind: 'proportional', nz: 10 });
  eq('packed bytes are 8 per cell plus the per-column arrays',
    packedBytes(m) > m.cells * 8, true);
  const peak = peakBuildBytes(m);
  check('building zone-by-zone lowers the peak below the whole model',
    peak.perZone < peak.wholeModel,
    `${(peak.perZone / 1024).toFixed(1)} KB vs ${(peak.wholeModel / 1024).toFixed(1)} KB`);
  check('the naive GridModel really is the expensive representation',
    peak.wholeModel / packedBytes(m) > 5,
    `GridModel is ${(peak.wholeModel / packedBytes(m)).toFixed(1)}× the packed size`);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
