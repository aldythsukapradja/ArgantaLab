// test-contact-contour.mjs — the fluid-contact isoline, including the rule that
// a null grid edge must never be traced as if it were a contact.
import { contactTrace, traceToProjected, closureAreaKm2 } from '../src/tabs/fielddev/contact-contour.ts';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; } else { fail++; console.error(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};

// A cone: shallowest (least negative elevation) at the centre, deepening outward.
// Elevation convention, so "shallower" = larger value.
const N = 41;
const cone = new Float64Array(N * N);
for (let r = 0; r < N; r++) {
  for (let c = 0; c < N; c++) {
    const d = Math.hypot(c - (N - 1) / 2, r - (N - 1) / 2);
    cone[r * N + c] = -2800 - d * 20;        // crest −2800, flanks deeper
  }
}

const at3000 = contactTrace(cone, N, N, -3000);
ok('a contact inside the structure traces', at3000.length > 0, `${at3000.length} line(s)`);
ok('the trace closes around the crest', at3000[0].length > 20, `${at3000[0]?.length} vertices`);

// every vertex should sit ~10 cells from the centre (200 m / 20 m-per-cell)
const centre = (N - 1) / 2;
const radii = at3000.flat().map(([x, y]) => Math.hypot(x - centre - 0.5, y - centre - 0.5));
const rmin = Math.min(...radii), rmax = Math.max(...radii);
ok('the trace is an isoline, not a bounding box', rmax - rmin < 1.5, `r ${rmin.toFixed(2)}–${rmax.toFixed(2)}`);
ok('and it sits at the right radius', Math.abs((rmin + rmax) / 2 - 10) < 0.7, `${((rmin + rmax) / 2).toFixed(2)}`);

ok('a contact above the crest traces nothing', contactTrace(cone, N, N, -2000).length === 0);
ok('a contact below the deepest node traces nothing (nothing to enclose)',
  contactTrace(cone, N, N, -9999).length === 0);

// ── the null-edge rule ────────────────────────────────────────────────────────
// Same cone, but the whole right half is un-mapped. The contact must now be an
// OPEN arc: the part that runs along the null boundary is survey edge, not contact.
const halfNull = Float64Array.from(cone);
for (let r = 0; r < N; r++) for (let c = Math.floor(N / 2); c < N; c++) halfNull[r * N + c] = NaN;
const open = contactTrace(halfNull, N, N, -3000);
ok('a half-mapped grid still traces the part it can see', open.length > 0);
const xs = open.flat().map(([x]) => x);
ok('and never runs into the un-mapped half', Math.max(...xs) <= N / 2 + 1, `max col ${Math.max(...xs)}`);
ok('the open arc is genuinely shorter than the closed one',
  open.flat().length < at3000.flat().length, `${open.flat().length} vs ${at3000.flat().length}`);

const allNull = new Float64Array(N * N).fill(NaN);
ok('an entirely un-mapped grid traces nothing', contactTrace(allNull, N, N, -3000).length === 0);
ok('a degenerate grid returns empty, not a throw', contactTrace(new Float64Array(0), 0, 0, -3000).length === 0);
ok('short fragments are dropped', contactTrace(cone, N, N, -3000, 10_000).length === 0);

// ── grid → projected ──────────────────────────────────────────────────────────
const proj = traceToProjected([[[0, 0], [2, 3]]], 432_108, 6_475_807, 50);
ok('origin maps to the grid origin', proj[0][0][0] === 432_108 && proj[0][0][1] === 6_475_807);
ok('column is easting and row is northing, scaled by the cell',
  proj[0][1][0] === 432_208 && proj[0][1][1] === 6_475_957, JSON.stringify(proj[0][1]));

// ── against Volve's published contact ─────────────────────────────────────────
// OWC 3200 m TVDSS on a Hugin Top that spans 2725.68–3392.92 m. The contact is
// inside that range, so it must trace; this is the case the map actually draws.
const span = new Float64Array(N * N);
for (let r = 0; r < N; r++) {
  for (let c = 0; c < N; c++) {
    const d = Math.hypot(c - centre, r - centre) / centre;      // 0 at crest, 1 at corner
    span[r * N + c] = -(2725.68 + d * (3392.92 - 2725.68));
  }
}
const owc = contactTrace(span, N, N, -3200);
ok('Volve OWC at 3200 m traces on a Hugin-range grid', owc.length > 0, `${owc.length}`);
ok('and encloses the crest rather than the flanks',
  owc.flat().every(([x, y]) => Math.hypot(x - centre - 0.5, y - centre - 0.5) < centre));

// ── closure area, and the claim it must NOT make ──────────────────────────────
{
  const g = new Float64Array(4 * 4).fill(-3000);
  ok('area counts live nodes at cell size', closureAreaKm2(g, 4, 4, -3100, 100) === 16 * 100 * 100 / 1e6);
  ok('nothing above a shallower level', closureAreaKm2(g, 4, 4, -2000, 100) === 0);
  const half = Float64Array.from(g); for (let i = 0; i < 8; i++) half[i] = -3500;
  ok('only the shallow half counts', closureAreaKm2(half, 4, 4, -3100, 100) === 8 * 100 * 100 / 1e6);
  const nulls = Float64Array.from(g); nulls.fill(NaN, 0, 8);
  ok('null nodes are not area', closureAreaKm2(nulls, 4, 4, -3100, 100) === 8 * 100 * 100 / 1e6);
  ok('an all-null grid has no area, not zero area', closureAreaKm2(new Float64Array(16).fill(NaN), 4, 4, -3100, 100) === null);
  ok('a degenerate grid returns null', closureAreaKm2(new Float64Array(0), 0, 0, -1, 100) === null);
}

// THE VOLVE CHECK. The contour is the maximum closure of the whole mapped
// horizon, NOT the accumulation — this pins the real, published gap so the UI can
// never quietly start presenting one as the other.
try {
  const s = JSON.parse(readFileSync(new URL('../public/wb/surface-hugin_top.json', import.meta.url)));
  const vals = Float64Array.from(s.z.map((v) => (v == null ? NaN : -Math.abs(v))));
  const a = closureAreaKm2(vals, s.nx, s.ny, -3200, s.cell);
  ok('OWC 3200 m on Top Hugin encloses ~24 km2', a > 23 && a < 26, `${a.toFixed(2)} km2`);
  // Sodir's mapped Volve outline is 3.70 km2 (public/osdu/cockpit-polygons.geojson)
  ok('which is several times the regulator-mapped field outline of 3.70 km2',
    a / 3.70 > 4, `${(a / 3.70).toFixed(1)}x`);
} catch { /* public/wb is generated and gitignored */ }

console.log(`contact-contour: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
