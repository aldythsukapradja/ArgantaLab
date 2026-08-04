// test-contact-contour.mjs — the fluid-contact isoline, including the rule that
// a null grid edge must never be traced as if it were a contact.
import { contactTrace, traceToProjected } from '../src/tabs/fielddev/contact-contour.ts';

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

console.log(`contact-contour: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
