// test-surface-mesh.mjs — the 3D grid tessellation, and the two rules that keep
// it from inventing geology: null nodes kill triangles, surfaces share an origin.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildSurfaceMesh, commonOrigin, sharedDepthRange, nodeDepth } from '../src/tabs/fielddev/surface-mesh.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c, e = '') => { if (c) pass++; else { fail++; console.error(`  ✗ ${n}${e ? ` — ${e}` : ''}`); } };

const flat = (ncol, nrow, val = -3000) => ({
  ncol, nrow, x0: 1000, y0: 2000, dx: 50, dy: 50,
  values: Float64Array.from({ length: ncol * nrow }, () => val),
});
const grey = () => [0.5, 0.5, 0.5];
const base = { originX: 1000, originY: 2000, flip: true, zScale: 1, colorAt: grey };

// ── convention ────────────────────────────────────────────────────────────────
ok('an elevation grid flips to depth', nodeDepth(-3000, true) === 3000);
ok('a depth grid does not', nodeDepth(3000, false) === 3000);

// ── tessellation ──────────────────────────────────────────────────────────────
const m = buildSurfaceMesh(flat(4, 3), base);
ok('a full grid meshes', m != null);
ok('one vertex per node', m.positions.length === 4 * 3 * 3);
ok('two triangles per cell', m.indices.length === (4 - 1) * (3 - 1) * 6, String(m.indices.length));
ok('nothing dropped when nothing is null', m.droppedQuads === 0);
ok('every node counted live', m.liveNodes === 12);
ok('positions are metres relative to the passed origin',
  m.positions[0] === 0 && m.positions[1] === 0);
ok('the second column is one cell east', m.positions[3] === 50);
ok('depth below datum is NEGATIVE height', m.positions[2] === -3000);

const exagg = buildSurfaceMesh(flat(4, 3), { ...base, zScale: 5 });
ok('vertical exaggeration scales height only',
  exagg.positions[2] === -15000 && exagg.positions[0] === 0);

// ── RULE 1: nulls ─────────────────────────────────────────────────────────────
const holed = flat(4, 3);
holed.values[0] = NaN;                       // one corner of the SW cell
const h = buildSurfaceMesh(holed, base);
ok('one null corner keeps the cell\'s surviving triangle, not the whole cell',
  h.indices.length === (4 - 1) * (3 - 1) * 6 - 3, String(h.indices.length));
ok('and reports the degraded quad', h.droppedQuads === 1);
ok('live node count excludes the null', h.liveNodes === 11);
ok('no index ever points at a null vertex',
  ![...h.indices].some((i) => i === 0));

const halfNull = flat(6, 6);
for (let r = 0; r < 6; r++) for (let c = 3; c < 6; c++) halfNull.values[r * 6 + c] = NaN;
const hn = buildSurfaceMesh(halfNull, base);
ok('a half-mapped grid meshes only the mapped half', hn.droppedQuads > 0);
const usedX = new Set([...hn.indices].map((i) => hn.positions[i * 3]));
ok('and never emits a triangle in the un-mapped half', Math.max(...usedX) <= 50 * 3, String(Math.max(...usedX)));

const allNull = flat(4, 3);
allNull.values.fill(NaN);
ok('an entirely un-mapped grid meshes to nothing, not a flat plane at zero',
  buildSurfaceMesh(allNull, base) === null);
ok('a degenerate grid returns null', buildSurfaceMesh(flat(1, 1), base) === null);

// ── stride ────────────────────────────────────────────────────────────────────
const big = buildSurfaceMesh(flat(41, 41), { ...base, stride: 4 });
ok('stride decimates the vertex count', big.positions.length / 3 === 11 * 11, String(big.positions.length / 3));
ok('and still spans the full grid extent',
  Math.max(...[...Array(11)].map((_, i) => big.positions[i * 3])) === 40 * 50);

// ── RULE 2: shared origin ─────────────────────────────────────────────────────
const gA = { ...flat(3, 3), x0: 432108, y0: 6475807 };
const gB = { ...flat(3, 3), x0: 431128, y0: 6475411 };
const o = commonOrigin([gA, gB]);
ok('the common origin is the south-west-most corner', o.x === 431128 && o.y === 6475411);

const mA = buildSurfaceMesh(gA, { ...base, originX: o.x, originY: o.y });
const mB = buildSurfaceMesh(gB, { ...base, originX: o.x, originY: o.y });
ok('surfaces on different origins keep their real offset in the shared frame',
  mA.positions[0] - mB.positions[0] === 432108 - 431128, String(mA.positions[0] - mB.positions[0]));
ok('and their northings too', mA.positions[1] - mB.positions[1] === 6475807 - 6475411);
ok('an empty set has no origin', commonOrigin([]) === null);

// ── shared colour range ───────────────────────────────────────────────────────
const shallow = flat(3, 3, -2700), deep = flat(3, 3, -3400);
const range = sharedDepthRange([shallow, deep], true);
ok('the range spans every surface, not each alone', range.dmin === 2700 && range.dmax === 3400);
ok('an all-null set has no range', sharedDepthRange([allNull], true) === null);

let colored = null;
buildSurfaceMesh(flat(3, 3, -3000), {
  ...base,
  colorAt: (d) => { colored = d; return [1, 0, 0]; },
});
ok('colorAt is handed a DEPTH, positive down', colored === 3000);

// ── against the shipped grids ─────────────────────────────────────────────────
let index = null;
try { index = JSON.parse(readFileSync(join(root, 'public/wb/index.json'), 'utf8')); } catch { /* gitignored */ }
if (index?.surfaces?.length) {
  const reservoir = index.surfaces.filter((s) => s.id !== 'seabed');
  const origins = new Set(reservoir.map((s) => s.x0));
  ok('the real horizons DO sit on different origins — rule 2 is not hypothetical',
    origins.size > 1, `${origins.size} distinct origins`);
  const spread = Math.max(...reservoir.map((s) => s.x0)) - Math.min(...reservoir.map((s) => s.x0));
  ok('and the offset is large enough to matter', spread > 500, `${spread} m`);
}

console.log(`surface-mesh: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
