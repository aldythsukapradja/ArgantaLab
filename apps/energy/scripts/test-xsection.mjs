// test-xsection.mjs — cross-section sampling/projection and the interpretation model.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  pathLength, bilinearAt, sampleAlongPath, projectOnPath, projectWells, sampleRange, splitAtGaps,
} from '../src/tabs/fielddev/xsection.ts';
import {
  featureAreaM2, featureLengthM, featureMeasure, newFeature, isComplete, MIN_POINTS, toGeoJson,
} from '../src/tabs/fielddev/interpret.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c, e = '') => { if (c) pass++; else { fail++; console.error(`  ✗ ${n}${e ? ` — ${e}` : ''}`); } };
const near = (a, b, t) => Math.abs(a - b) <= t;

// a 5x5 grid, 100 m cells, depth = 2000 + 10*col + 20*row (depth convention)
const G = {
  ncol: 5, nrow: 5, x0: 1000, y0: 2000, dx: 100, dy: 100,
  values: Float64Array.from({ length: 25 }, (_, i) => 2000 + 10 * (i % 5) + 20 * Math.floor(i / 5)),
};

// ── bilinear ──────────────────────────────────────────────────────────────────
ok('exact node', bilinearAt(G, 1000, 2000) === 2000);
ok('one cell east', bilinearAt(G, 1100, 2000) === 2010);
ok('one cell north', bilinearAt(G, 1000, 2100) === 2020);
ok('mid-cell interpolates', near(bilinearAt(G, 1050, 2050), 2015, 1e-9), String(bilinearAt(G, 1050, 2050)));
ok('outside west is null', bilinearAt(G, 900, 2000) === null);
ok('outside north is null', bilinearAt(G, 1000, 2500) === null);
ok('far corner still inside', bilinearAt(G, 1400, 2400) === 2000 + 40 + 80);

const holed = { ...G, values: Float64Array.from(G.values) };
holed.values[0] = NaN;
ok('a null CORNER kills the whole cell, no partial interpolation',
  bilinearAt(holed, 1050, 2050) === null);
ok('but a cell away from the hole still samples', bilinearAt(holed, 1250, 2250) !== null);

// ── path length + sampling ────────────────────────────────────────────────────
const P = [{ x: 1000, y: 2000 }, { x: 1400, y: 2000 }];
ok('length of a straight path', pathLength(P) === 400);
ok('an L-shaped path sums its legs',
  pathLength([{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 400 }]) === 700);
ok('a single point has no length', pathLength([{ x: 0, y: 0 }]) === 0);

const s = sampleAlongPath(G, P, 5);
ok('one sample per step', s.length === 5);
ok('first sample at distance zero', s[0].dist === 0);
ok('last sample at the full length', s[4].dist === 400);
ok('depths follow the grid along the path',
  s.map((p) => p.depth).join() === '2000,2010,2020,2030,2040', s.map((p) => p.depth).join());
ok('samples carry their own position', s[1].x === 1100 && s[1].y === 2000);

const bent = sampleAlongPath(G, [{ x: 1000, y: 2000 }, { x: 1000, y: 2400 }, { x: 1400, y: 2400 }], 9);
ok('a bent section is sampled by ARC LENGTH, not per segment',
  bent.length === 9 && bent[4].x === 1000 && bent[4].y === 2400, JSON.stringify(bent[4]));

const off = sampleAlongPath(G, [{ x: 500, y: 2000 }, { x: 1200, y: 2000 }], 8);
ok('a section running off the grid returns nulls there, never zeros',
  off.some((p) => p.depth === null) && off.some((p) => p.depth !== null));
ok('and no null is silently 0', off.every((p) => p.depth === null || p.depth > 0));

ok('a degenerate path samples nothing', sampleAlongPath(G, [{ x: 0, y: 0 }], 5).length === 0);
ok('a zero-length path samples nothing', sampleAlongPath(G, [{ x: 1, y: 1 }, { x: 1, y: 1 }], 5).length === 0);

// ── gaps ──────────────────────────────────────────────────────────────────────
const gappy = [
  { dist: 0, x: 0, y: 0, depth: 10 }, { dist: 1, x: 0, y: 0, depth: 11 },
  { dist: 2, x: 0, y: 0, depth: null },
  { dist: 3, x: 0, y: 0, depth: 13 }, { dist: 4, x: 0, y: 0, depth: 14 },
];
const runs = splitAtGaps(gappy);
ok('a gap splits the profile into separate runs', runs.length === 2);
ok('and no run spans the gap', runs[0].length === 2 && runs[1].length === 2);
ok('a one-point run is dropped — a line needs two',
  splitAtGaps([{ depth: 1 }, { depth: null }, { depth: 2 }]).length === 0);

ok('range ignores gaps', JSON.stringify(sampleRange([gappy])) === JSON.stringify({ dmin: 10, dmax: 14 }));
ok('an all-gap profile has NO range, not a zero one',
  sampleRange([[{ dist: 0, x: 0, y: 0, depth: null }]]) === null);

// ── projection ────────────────────────────────────────────────────────────────
const line = [{ x: 0, y: 0 }, { x: 1000, y: 0 }];
ok('a point on the line projects with zero offset',
  JSON.stringify(projectOnPath(line, { x: 400, y: 0 })) === JSON.stringify({ dist: 400, offset: 0 }));
ok('an off-line point keeps its perpendicular distance',
  JSON.stringify(projectOnPath(line, { x: 400, y: 300 })) === JSON.stringify({ dist: 400, offset: 300 }));
ok('a point beyond the end clamps to the end, not the extension',
  projectOnPath(line, { x: 5000, y: 0 }).dist === 1000);
ok('a point before the start clamps to the start',
  projectOnPath(line, { x: -900, y: 0 }).dist === 0);
ok('a degenerate path cannot be projected onto', projectOnPath([{ x: 0, y: 0 }], { x: 1, y: 1 }) === null);

const wells = [
  { well: 'near', easting: 300, northing: 50 },
  { well: 'far', easting: 300, northing: 4000 },
  { well: 'mid', easting: 800, northing: -200 },
];
const proj = projectWells(line, wells, 500);
ok('wells outside the corridor are DROPPED, not squashed onto the line',
  proj.length === 2 && !proj.some((p) => p.item.well === 'far'));
ok('projected wells come back ordered along the section',
  proj.map((p) => p.item.well).join() === 'near,mid');
ok('and each carries how far it was moved',
  proj[0].offset === 50 && proj[1].offset === 200);

// ── interpretation model ──────────────────────────────────────────────────────
ok('a polygon needs three points', MIN_POINTS.polygon === 3 && !isComplete('polygon', 2) && isComplete('polygon', 3));
ok('a section needs two', isComplete('section', 2) && !isComplete('section', 1));
ok('a point needs one', isComplete('point', 1));

const square = [
  { lon: 2.0, lat: 58.0 }, { lon: 2.01, lat: 58.0 },
  { lon: 2.01, lat: 58.01 }, { lon: 2.0, lat: 58.01 },
];
const a = featureAreaM2(square);
// 0.01 deg lat = 1113 m; 0.01 deg lon at 58 N = 590 m  ⇒  ~0.66 km2
ok('polygon area is spherical and plausible', a / 1e6 > 0.55 && a / 1e6 < 0.75, `${(a / 1e6).toFixed(3)} km2`);
ok('two points enclose nothing', featureAreaM2(square.slice(0, 2)) === 0);
ok('length of one degree-ish leg', near(featureLengthM([square[0], square[3]]), 1113, 40),
  String(Math.round(featureLengthM([square[0], square[3]]))));

const f1 = newFeature('polygon', square, []);
const f2 = newFeature('polygon', square, [f1]);
ok('features are numbered per kind', f1.name === 'Polygon 1' && f2.name === 'Polygon 2');
ok('ids do not collide inside one millisecond', f1.id !== f2.id);
ok('every drawn feature is stamped as user interpretation',
  f1.origin === 'user' && !Number.isNaN(Date.parse(f1.createdAt)));
ok('measure reports area for a polygon', /km²$/.test(featureMeasure(f1)));
ok('and length for a section',
  /m$|km$/.test(featureMeasure(newFeature('section', square.slice(0, 2), []))));

const gj = toGeoJson([f1, newFeature('point', [square[0]], []), newFeature('polyline', square.slice(0, 2), [])]);
ok('a polygon closes its ring', gj.features[0].geometry.coordinates[0].length === 5);
ok('a single point is a Point', gj.features[1].geometry.type === 'Point');
ok('a two-point line is a LineString', gj.features[2].geometry.type === 'LineString');
ok('the kind travels for styling', gj.features[0].properties.kind === 'polygon');

// ── against the real bundle ───────────────────────────────────────────────────
let s2 = null;
try { s2 = JSON.parse(readFileSync(join(root, 'public/wb/surface-hugin_top.json'), 'utf8')); } catch { /* gitignored */ }
if (s2) {
  const grid = {
    ncol: s2.nx, nrow: s2.ny, x0: s2.x0, y0: s2.y0, dx: s2.cell, dy: s2.cell,
    values: Float64Array.from(s2.z.map((v) => (v == null ? NaN : Math.abs(v)))),
  };
  // a west–east section straight through the middle of the Hugin grid
  const midY = s2.y0 + (s2.cell * (s2.ny - 1)) / 2;
  const path = [{ x: s2.x0, y: midY }, { x: s2.x0 + s2.cell * (s2.nx - 1), y: midY }];
  const prof = sampleAlongPath(grid, path, 200);
  ok('a real section samples the whole line', prof.length === 200);
  const live = prof.filter((p) => p.depth != null);
  ok('and hits real data', live.length > 20, `${live.length}/200`);
  ok('every sampled depth is inside the grid range',
    live.every((p) => p.depth >= s2.zmin - 1 && p.depth <= s2.zmax + 1));
  ok('the section crosses un-mapped ground and says so',
    prof.some((p) => p.depth == null));
  ok('which splits it into separate drawable runs', splitAtGaps(prof).length >= 1);
  const r = sampleRange([prof]);
  ok('range is a real depth window', r && r.dmax > r.dmin);
}

console.log(`xsection: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
