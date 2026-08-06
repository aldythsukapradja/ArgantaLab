// prop-view.ts truth-lock — decoding, colouring and slicing a packed property.
//
// The assertions that matter:
//   1. an inactive cell reads NaN, never 0 — a zero is a legitimate porosity and it
//      would enter every statistic and every colour scale as one;
//   2. the legend is generated from the SAME range the mesh is coloured with, so a
//      caller cannot end up with a picture and a scale that disagree;
//   3. facies is CATEGORICAL — discrete swatches, never a gradient, because a colour
//      halfway between two facies stands for a rock that does not exist;
//   4. a user-drawn section keeps the columns that fall OUTSIDE the model, flagged,
//      rather than closing the gap and reading as continuous geology;
//   5. the display range TRIMS outliers but REPORTS what it clipped — a map with a
//      third of its cells pinned at the end of the ramp is a map with the wrong range,
//      and nothing on the picture says so.
// Run: node scripts/test-prop-view.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const eq = (n, got, want) => check(n, Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (n, got, want, tol) => check(n, Math.abs(got - want) <= tol, `got ${got}, want ${want} ±${tol}`);

const mod = join(__dirname, '..', 'src', 'tabs', 'fielddev', 'prop-view.ts');
if (!existsSync(mod)) { console.log('SKIP — prop-view.ts absent'); process.exit(0); }
const {
  cellIndex, propValueAt, PROPERTY_STYLES, styleFor, rampColor, normalise,
  colorTable, propRange, sliceProp, axisExtent, sectionColumns, sectionPanel,
  RAMPS, RAMP_IDS, safeRange, rampClearance, CANVAS_GROUND,
} = await import('../src/tabs/fielddev/prop-view.ts');

// a 4×3×2 grid with one inactive column
const NX = 4, NY = 3, NZ = 2, NCOL = NX * NY;
const activeCol = new Uint8Array(NCOL).fill(1);
activeCol[5] = 0;                                   // (i=1, j=1) is outside the model

const phi = {
  name: 'phi', dtype: 'u16', categorical: false, min: 0, max: 0.4,
  data: Uint16Array.from({ length: NCOL * NZ }, (_, n) => (n % 5) * 16383),
};
const facies = {
  name: 'facies', dtype: 'u8', categorical: true, min: 0, max: 1,
  data: Uint8Array.from({ length: NCOL * NZ }, (_, n) => n % 2),
};
const G = { nx: NX, ny: NY, nz: NZ, activeCol, props: [phi, facies] };

// ── decoding ────────────────────────────────────────────────────────────────
{
  eq('cell index is layer-major over the areal grid', cellIndex(G, 1, 1, 1), NCOL + 1 * NX + 1);

  // raw 16383 of 65535 over a 0..0.4 range
  near('a u16 code dequantises to its physical value',
    propValueAt(G, phi, 1, 0, 0), 0.4 * (16383 / 65535), 1e-6);
  eq('a categorical code is returned RAW, not normalised', propValueAt(G, facies, 1, 0, 0), 1);

  check('an INACTIVE column reads NaN, not 0', Number.isNaN(propValueAt(G, phi, 1, 1, 0)), '');
  check('…on every layer', Number.isNaN(propValueAt(G, phi, 1, 1, 1)), '');
  check('out of bounds reads NaN too', Number.isNaN(propValueAt(G, phi, 99, 0, 0)), '');
  check('a negative index does not wrap into the array', Number.isNaN(propValueAt(G, phi, -1, 0, 0)), '');
  check('a layer past the top reads NaN', Number.isNaN(propValueAt(G, phi, 0, 0, NZ)), '');
}

// ── ramps and the legend ────────────────────────────────────────────────────
{
  const p = styleFor('phi'), s = styleFor('sw');
  check('porosity and saturation do NOT share a ramp — two maps must not look alike',
    p.stops[0].color !== s.stops[0].color && p.stops[p.stops.length - 1].color !== s.stops[s.stops.length - 1].color, '');
  eq('saturation is flagged as low-is-good', s.highIsGood, false);
  eq('porosity is flagged as high-is-good', p.highIsGood, true);
  eq('permeability is a LOG ramp — a 1–20,000 mD field is one colour on a linear scale',
    styleFor('perm').log, true);
  eq('an unknown property still yields a usable style', styleFor('nope').label, 'nope');

  eq('the ramp ends are exact', rampColor(p.stops, 0), p.stops[0].color);
  eq('…at both ends', rampColor(p.stops, 1), p.stops[p.stops.length - 1].color);
  check('a value beyond the ramp is clamped, not wrapped', rampColor(p.stops, 5) === p.stops[p.stops.length - 1].color, '');
  check('the midpoint interpolates to something between the stops',
    /^#[0-9a-f]{6}$/.test(rampColor(p.stops, 0.4)), rampColor(p.stops, 0.4));

  near('linear normalisation', normalise(p, 0.15, 0.1, 0.3), 0.25, 1e-9);
  // log: 1 → 1000 mD, the geometric midpoint is ~31.6
  near('LOG normalisation puts the geometric mean at the middle',
    normalise(styleFor('perm'), 31.62, 1, 1000), 0.5, 0.01);
  check('an out-of-range value normalises outside 0..1 so the caller can see the clip',
    normalise(p, 0.5, 0.1, 0.3) > 1, '');
}
{
  const t = colorTable(styleFor('phi'), 0.05, 0.30, 5);
  eq('five ticks were asked for and five returned', t.entries.length, 5);
  near('the first tick is the low end', t.entries[0].value, 0.05, 1e-9);
  near('the last is the high end', t.entries[4].value, 0.30, 1e-9);
  eq('the tick colour matches the ramp at that position', t.entries[0].color, rampColor(styleFor('phi').stops, 0));
  eq('…and at the top', t.entries[4].color, rampColor(styleFor('phi').stops, 1));
  check('a css gradient is provided for the swatch', /linear-gradient/.test(t.gradient ?? ''), '');
  eq('the table carries the range it was built from, so it cannot drift from the mesh',
    [t.lo, t.hi], [0.05, 0.30]);
  eq('labels honour the property decimals', t.entries[0].label, '0.050');

  // CATEGORICAL
  const f = colorTable(styleFor('facies'), 0, 1);
  eq('facies gets one entry per CODE', f.entries.length, 2);
  eq('…labelled by rock, not by number', f.entries.map((e) => e.label), ['Shale', 'Sand']);
  check('and NO gradient — a colour between two facies is a rock that does not exist',
    f.gradient === undefined, '');
}

// ── range from percentiles, not min/max ─────────────────────────────────────
{
  const spiky = {
    name: 'phi', dtype: 'u16', categorical: false, min: 0, max: 1,
    data: Uint16Array.from({ length: NCOL * NZ }, (_, n) => (n === 0 ? 65535 : 6553)),
  };
  const g2 = { ...G, props: [spiky] };
  const r = propRange(g2, spiky, 0.02, 0.98);
  check('one wild cell does not set the colour scale', r.hi < 0.9, `hi=${r.hi.toFixed(3)}`);
  check('the inactive column is excluded from the statistics', r.n === (NCOL - 1) * NZ, `n=${r.n}`);
  const cat = propRange(G, facies);
  eq('a categorical property reports its code range as-is', [cat.lo, cat.hi], [0, 1]);
}

// ── slices ──────────────────────────────────────────────────────────────────
{
  eq('the i axis scrubs nx', axisExtent(G, 'i'), NX);
  eq('the j axis scrubs ny', axisExtent(G, 'j'), NY);
  eq('the k axis scrubs LAYERS', axisExtent(G, 'k'), NZ);

  const k = sliceProp(G, phi, 'k', 0);
  eq('a k slice is an areal map', [k.w, k.h], [NX, NY]);
  eq('…and it drops the inactive column', k.live, NCOL - 1);
  check('the inactive cell is NaN in the raster', Number.isNaN(k.values[1 * NX + 1]), '');

  const i = sliceProp(G, phi, 'i', 0);
  eq('an i slice is a section across j and layer', [i.w, i.h], [NY, NZ]);
  const j = sliceProp(G, phi, 'j', 0);
  eq('a j slice is a section across i and layer', [j.w, j.h], [NX, NZ]);

  // the slice must agree with the point decoder — one source of truth
  eq('a k-slice cell equals propValueAt for the same cell',
    k.values[2 * NX + 3], propValueAt(G, phi, 3, 2, 0));
}

// ── user-drawn cross-section ────────────────────────────────────────────────
const GEO = { nx: NX, ny: NY, dx: 100, dy: 100, x0: 0, y0: 0, activeCol };
{
  eq('a single point is not a section', sectionColumns(GEO, [{ x: 0, y: 0 }]), []);
  eq('a zero-length line yields nothing', sectionColumns(GEO, [{ x: 50, y: 50 }, { x: 50, y: 50 }]), []);

  // straight west→east across row j=0
  const row = sectionColumns(GEO, [{ x: 50, y: 50 }, { x: 350, y: 50 }]);
  eq('a straight row crosses every column once', row.map((c) => c.i), [0, 1, 2, 3]);
  eq('…all on the same row', new Set(row.map((c) => c.j)).size, 1);
  check('distance along the line increases monotonically',
    row.every((c, n) => n === 0 || c.sM >= row[n - 1].sM), '');

  // a diagonal must not report a column twice
  const diag = sectionColumns(GEO, [{ x: 50, y: 50 }, { x: 350, y: 250 }]);
  const keys = diag.map((c) => `${c.i},${c.j}`);
  eq('a diagonal never repeats a column', keys.length, new Set(keys).size);
  check('…and it does cross more than one row', new Set(diag.map((c) => c.j)).size > 1, '');

  // THE GAP: a line crossing the inactive column must SAY so, not close over it
  const gap = sectionColumns(GEO, [{ x: 50, y: 150 }, { x: 350, y: 150 }]);
  const outside = gap.filter((c) => !c.inside);
  eq('the inactive column appears in the section', outside.length, 1);
  eq('…flagged as outside the model rather than dropped', outside[0].i, 1);
  check('the section is still continuous in distance across the gap',
    gap.length === 4, `${gap.length} columns`);

  // a line that leaves the grid entirely
  const off = sectionColumns(GEO, [{ x: 50, y: 50 }, { x: 5000, y: 50 }]);
  check('a line running off the grid keeps going and flags the outside part',
    off.some((c) => !c.inside) && off.some((c) => c.inside), '');
}
{
  const g3 = {
    ...G, dx: 100, dy: 100, x0: 0, y0: 0,
    topZ: Float64Array.from({ length: NCOL }, () => 2800),
    baseZ: Float64Array.from({ length: NCOL }, () => 2860),
  };
  const panel = sectionPanel(g3, phi, [{ x: 50, y: 50 }, { x: 350, y: 50 }]);
  eq('the panel has one entry per column crossed', panel.columns.length, 4);
  eq('…times the layer count', panel.values.length, 4 * NZ);
  near('the drawn length is reported', panel.lengthM, 300, 1e-6);
  eq('per-column geometry travels with it, so the panel can be drawn to true depth',
    [panel.topZ[0], panel.baseZ[0]], [2800, 2860]);
  eq('a panel value matches the point decoder', panel.values[0 * NZ + 0], propValueAt(G, phi, 0, 0, 0));

  const across = sectionPanel(g3, phi, [{ x: 50, y: 150 }, { x: 350, y: 150 }]);
  check('the inactive column contributes NaN, not zero',
    Number.isNaN(across.values[1 * NZ + 0]), '');
  check('…and no depth either', Number.isNaN(across.topZ[1]), '');
}

// ── ramps ───────────────────────────────────────────────────────────────────
{
  check('every ramp is registered under an id', RAMP_IDS.length >= 4, RAMP_IDS.join(','));
  for (const id of RAMP_IDS) {
    const st = RAMPS[id];
    check(`${id} spans the whole 0..1 domain`,
      st[0].t === 0 && st[st.length - 1].t === 1, `${st[0].t}..${st[st.length - 1].t}`);
    let mono = true;
    for (let i = 1; i < st.length; i++) if (st[i].t <= st[i - 1].t) mono = false;
    // an out-of-order stop makes the gradient fold back on itself: two different
    // values then get the same colour, and the legend stops being readable
    check(`${id} stops are strictly increasing`, mono, '');
  }

  // POROSITY AND HCPV ARE RAINBOW BY DEFAULT — the eye separates hue far better than
  // lightness, so a rainbow resolves structure a single-hue ramp flattens
  eq('porosity defaults to the rainbow ramp', styleFor('phi').rampId, 'rainbow');
  eq('HCPV defaults to the rainbow ramp', styleFor('hcpv').rampId, 'rainbow');

  const over = styleFor('phi', 'greyscale');
  eq('a caller can override the ramp', over.rampId, 'greyscale');
  eq('…and the override actually supplies the stops', over.stops, RAMPS.greyscale);
  check('the override does not mutate the registry entry',
    styleFor('phi').rampId === 'rainbow', '');

  // FACIES IS CATEGORICAL. A ramp on it would invent rocks between the codes.
  const fac = styleFor('facies', 'rainbow');
  check('a ramp override cannot be forced onto a categorical property',
    fac.categorical === true && !fac.stops, JSON.stringify(fac.rampId));

  // an unknown id must not blank the map out
  check('an unknown ramp id falls back rather than yielding no colours',
    (styleFor('phi', 'not-a-ramp').stops ?? []).length > 0, '');
}

// ── range: trimmed, reported, adjustable ────────────────────────────────────
{
  // one cell far above the rest — the classic scale-wrecker
  const spiky = {
    name: 'phi', dtype: 'u8', min: 0, max: 1, categorical: false,
    data: Uint8Array.from({ length: NCOL * NZ }, (_, i) => (i === 0 ? 255 : 20)),
  };
  const r = propRange(G, spiky);
  check('the outlier does not set the top of the scale', r.hi < spiky.max, `hi ${r.hi}`);
  check('…but the untrimmed extreme is still reported',
    r.dataMax > r.hi, `dataMax ${r.dataMax} vs hi ${r.hi}`);
  check('the clipped cells are counted, not silently swallowed',
    r.clippedLo + r.clippedHi >= 1, `${r.clippedLo}/${r.clippedHi}`);
  check('the count is a subset of the cells measured', r.clippedLo + r.clippedHi < r.n, '');

  // a categorical property has no percentiles to take
  const facProp = { name: 'facies', dtype: 'u8', min: 0, max: 2, categorical: true, data: new Uint8Array(NCOL * NZ) };
  const rf = propRange(G, facProp);
  eq('a categorical range is the code span, untrimmed', [rf.lo, rf.hi], [0, 2]);
  eq('…and nothing is reported as clipped', [rf.clippedLo, rf.clippedHi], [0, 0]);
}

// ── a hand-typed range is repaired, not rejected ────────────────────────────
{
  const fb = { lo: 0, hi: 1 };
  eq('a normal range passes through', safeRange(0.1, 0.3, fb), { lo: 0.1, hi: 0.3 });
  // mid-typing a minus sign must not throw a red box at the user
  eq('a blank field falls back rather than producing NaN', safeRange(NaN, 0.3, fb), { lo: 0, hi: 0.3 });
  const inv = safeRange(0.9, 0.2, fb);
  check('an inverted range is repaired to something drawable', inv.hi > inv.lo, JSON.stringify(inv));
  const zero = safeRange(0.5, 0.5, fb);
  // a zero-width range divides by zero in normalise() and colours the whole map one shade
  check('a zero-width range is widened', zero.hi > zero.lo, JSON.stringify(zero));
}

// -- A SCALE WHOSE MIDDLE IS INVISIBLE IS NOT A SCALE ------------------------
//
// The saturation ramp used to pass within 56 RGB units of the light theme's canvas
// ground at t = 0.55. On Volve that midpoint is the oil-water transition, so a whole
// band of real modelled cells rendered the same colour as "no cell here" -- and because
// a transition band follows the structure contours, the 3D grid looked shot through
// with contour-parallel holes. Three separate geometry investigations went after those
// holes; the mesh was watertight and correctly wound the whole time.
//
// 60 is the floor: below it, a cell and the background are the same thing to the eye.
{
  const FLOOR = 60;
  for (const id of RAMP_IDS) {
    const c = rampClearance(RAMPS[id]);
    check(`${id} never approaches either canvas ground`,
      c.light >= FLOOR && c.dark >= FLOOR,
      `light ${c.light.toFixed(0)} - dark ${c.dark.toFixed(0)} (worst near t=${c.worstT.toFixed(2)}, floor ${FLOOR})`);
  }

  // and the same for every property as it is ACTUALLY resolved -- an inline `stops` on
  // a style wins over the registry, so a fixed ramp can be shadowed by a stale copy
  for (const st of PROPERTY_STYLES) {
    if (st.categorical) {
      for (const code of st.codes ?? []) {
        const c = rampClearance([{ t: 0, color: code.color }, { t: 1, color: code.color }], 1);
        check(`facies code "${code.label ?? code.code}" is visible on both grounds`,
          c.light >= FLOOR && c.dark >= FLOOR, `light ${c.light.toFixed(0)} - dark ${c.dark.toFixed(0)}`);
      }
      continue;
    }
    const resolved = styleFor(st.key);
    const c = rampClearance(resolved.stops ?? []);
    check(`${st.key} as RESOLVED stays clear of the background`,
      c.light >= FLOOR && c.dark >= FLOOR,
      `light ${c.light.toFixed(0)} - dark ${c.dark.toFixed(0)} at t=${c.worstT.toFixed(2)}`);
  }

  eq('the grounds are the ones the stylesheet actually paints',
    [CANVAS_GROUND.light, CANVAS_GROUND.dark], ['#eef2f7', '#070b16']);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
