// grid-props.ts truth-lock — writing modelled properties back into the packed grid.
//
// The assertion that matters most is the ROUND TRIP: a value written must come back
// out of `propValueAt` within one quantisation step. Everything downstream — the
// viewport's colours, the IJK slice, the legend, every QC statistic — reads the packed
// grid, so if the write and the read disagree the model looks wrong while being right.
//
// Second: an UNSIMULATED layer must not contribute a zero. That is the exact bug this
// module exists to fix — zeros from unmodelled cells dragged every range to nothing and
// flattened every colour scale to a single value.
// Run: node scripts/test-grid-props.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const eq = (n, got, want) => check(n, Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (n, got, want, tol) => check(n, Math.abs(got - want) <= tol, `got ${got}, want ${want} ±${tol}`);

const mod = join(__dirname, '..', 'src', 'tabs', 'fielddev', 'grid-props.ts');
if (!existsSync(mod)) { console.log('SKIP — grid-props.ts absent'); process.exit(0); }
const { writePackedProps, sourcesFromSim, hcpvSource, averageMap } =
  await import('../src/tabs/fielddev/grid-props.ts');
const { propValueAt } = await import('../src/tabs/fielddev/prop-view.ts');

const NX = 4, NY = 3, NZ = 4, NCOL = NX * NY;
const mkGrid = () => {
  const activeCol = new Uint8Array(NCOL).fill(1);
  activeCol[5] = 0;                                  // one column outside the model
  return {
    nx: NX, ny: NY, nz: NZ, dx: 100, dy: 100, activeCol,
    topZ: Float64Array.from({ length: NCOL }, () => 2800),
    baseZ: Float64Array.from({ length: NCOL }, () => 2840),   // 40 m over 4 layers
    props: [
      { name: 'phi', dtype: 'u16', categorical: false, min: 0, max: 1, data: new Uint16Array(NCOL * NZ) },
      { name: 'facies', dtype: 'u8', categorical: true, min: 0, max: 1, data: new Uint8Array(NCOL * NZ) },
      { name: 'sw', dtype: 'u16', categorical: false, min: 0, max: 1, data: new Uint16Array(NCOL * NZ) },
    ],
  };
};

// ══ THE ROUND TRIP ══════════════════════════════════════════════════════════
{
  const g = mkGrid();
  // a field that varies in BOTH space and depth, so a stride or index error shows
  const truth = (col, l) => 0.05 + 0.01 * (col % 7) + 0.03 * l;
  const rep = writePackedProps(g, { phi: truth });

  const p = g.props[0];
  near('the range is re-derived from what was written (min)', p.min, 0.05, 1e-9);
  near('…and the max', p.max, 0.05 + 0.01 * 6 + 0.03 * 3, 1e-9);
  check('the property is NOT degenerate', !rep.props[0].degenerate, '');

  let worst = 0, n = 0;
  for (let l = 0; l < NZ; l++) {
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const col = j * NX + i;
        if (!g.activeCol[col]) continue;
        const back = propValueAt(g, p, i, j, l);
        worst = Math.max(worst, Math.abs(back - truth(col, l)));
        n++;
      }
    }
  }
  const step = (p.max - p.min) / 65535;
  check('EVERY active cell round-trips within one quantisation step',
    worst <= step * 1.001, `worst ${worst.toExponential(2)} vs step ${step.toExponential(2)} over ${n} cells`);
  eq('…and every active cell was written', rep.props[0].written, (NCOL - 1) * NZ);
  eq('inactive columns are excluded from the count', rep.activeCells, (NCOL - 1) * NZ);
  check('an inactive column still reads NaN afterwards',
    Number.isNaN(propValueAt(g, p, 1, 1, 0)), '');
}

// ══ AN UNSIMULATED LAYER MUST NOT CONTRIBUTE A ZERO ═════════════════════════
//
// The original bug in one assertion: zeros from unmodelled cells set the range and
// flattened the colour scale.
{
  const g = mkGrid();
  const sim = {
    layers: [
      { simulated: false, facies: new Uint8Array(NCOL), phie: new Float32Array(NCOL), ntg: new Float32Array(NCOL), perm: new Float32Array(NCOL) },
      { simulated: true, facies: Uint8Array.from({ length: NCOL }, (_, c) => c % 2),
        phie: Float32Array.from({ length: NCOL }, () => 0.22),
        ntg: Float32Array.from({ length: NCOL }, () => 0.8),
        perm: Float32Array.from({ length: NCOL }, () => 300) },
      { simulated: true, facies: new Uint8Array(NCOL).fill(1),
        phie: Float32Array.from({ length: NCOL }, () => 0.26),
        ntg: Float32Array.from({ length: NCOL }, () => 0.9),
        perm: Float32Array.from({ length: NCOL }, () => 900) },
      { simulated: false, facies: new Uint8Array(NCOL), phie: new Float32Array(NCOL), ntg: new Float32Array(NCOL), perm: new Float32Array(NCOL) },
    ],
  };
  const src = sourcesFromSim(sim);
  const rep = writePackedProps(g, { phi: src.phi, facies: src.facies });

  const phi = g.props[0];
  near('the range spans ONLY the simulated layers', phi.min, 0.22, 1e-6);
  near('…at both ends', phi.max, 0.26, 1e-6);
  check('a zero-filled unsimulated layer never enters the range', phi.min > 0.2, `${phi.min}`);
  eq('unsimulated cells are counted as missing, not written',
    rep.props[0].missing, (NCOL - 1) * 2);
  eq('…and only the simulated ones are written', rep.props[0].written, (NCOL - 1) * 2);

  near('a simulated cell reads back its own value', propValueAt(g, phi, 0, 0, 1), 0.22, 1e-4);
  near('…on the other simulated layer too', propValueAt(g, phi, 0, 0, 2), 0.26, 1e-4);

  // categorical codes survive as CODES, not as a normalised fraction
  const fac = g.props[1];
  eq('facies keeps raw codes', propValueAt(g, fac, 0, 0, 2), 1);
  eq('…and its declared range is the code range', [fac.min, fac.max], [0, 1]);
}

// ══ degenerate is reported, not hidden ══════════════════════════════════════
{
  const g = mkGrid();
  const rep = writePackedProps(g, { phi: () => 0.2 });
  check('a single-valued property is flagged degenerate', rep.props[0].degenerate, '');
  eq('…and named on the report', rep.degenerate, ['phi']);
  near('it still reads back correctly', propValueAt(g, g.props[0], 0, 0, 0), 0.2, 1e-9);

  const none = writePackedProps(mkGrid(), { phi: () => NaN });
  eq('a source that yields nothing writes nothing', none.props[0].written, 0);
  check('…and says so', none.props[0].degenerate, '');
}

// ══ a property with no source is untouched ══════════════════════════════════
{
  const g = mkGrid();
  writePackedProps(g, { phi: () => 0.3 });
  const before = Array.from(g.props[1].data);
  writePackedProps(g, { sw: () => 0.4 });
  eq('updating saturation does not disturb facies', Array.from(g.props[1].data), before);
  near('…and porosity survives the second write', propValueAt(g, g.props[0], 0, 0, 0), 0.3, 1e-9);
  eq('only the sourced property is reported', writePackedProps(g, { sw: () => 0.4 }).props.length, 1);
}

// ══ HCPV ════════════════════════════════════════════════════════════════════
{
  const g = mkGrid();
  const get = { ntg: () => 0.8, phi: () => 0.25, sw: () => 0.2 };
  // no contact: every cell is full
  const full = hcpvSource(g, get);
  // one layer = 100 × 100 × 10 m = 100,000 m³ bulk
  near('HCPV is bulk × NTG × φ × (1−Sw)', full(0, 0), 100 * 100 * 10 * 0.8 * 0.25 * 0.8, 1e-6);
  check('an inactive column has no HCPV', Number.isNaN(full(5, 0)), '');

  // contact at 2820 m: layers 0–1 above (2800–2820), layers 2–3 below
  const cut = hcpvSource(g, get, { owc: 2820 });
  near('a layer wholly above the contact is full', cut(0, 0), full(0, 0), 1e-6);
  eq('a layer wholly below contributes nothing', cut(0, 3), 0);
  eq('…and the one just below too', cut(0, 2), 0);

  // straddling: contact at 2825 puts layer 2 (2820–2830) half in
  const straddle = hcpvSource(g, get, { owc: 2825 });
  near('a straddling layer is counted by its FRACTION, not all-or-nothing',
    straddle(0, 2), full(0, 0) * 0.5, 1e-6);
  check('…which is the whole point — an all-or-nothing cut swings by a whole cell',
    straddle(0, 2) > 0 && straddle(0, 2) < full(0, 0), '');
}

// ══ average maps ════════════════════════════════════════════════════════════
{
  const g = mkGrid();
  // porosity varying with depth only: 0.1, 0.2, 0.3, 0.4
  const src = (_col, l) => 0.1 + 0.1 * l;
  const all = averageMap(g, src);
  eq('one value per active column', all.live, NCOL - 1);
  near('the column average is thickness-weighted (equal layers ⇒ plain mean)',
    all.values[0], 0.25, 1e-9);
  check('an inactive column stays NaN', Number.isNaN(all.values[5]), '');

  // contact at 2820 → layers 0,1 above (mid 2805, 2815); layers 2,3 below
  const above = averageMap(g, src, { owc: 2820, filter: 'above' });
  near('ABOVE the contact averages only the upper layers', above.values[0], 0.15, 1e-9);
  const below = averageMap(g, src, { owc: 2820, filter: 'below' });
  near('BELOW averages only the lower ones', below.values[0], 0.35, 1e-9);
  check('the excluded cells are counted, not silently dropped',
    above.excluded === (NCOL - 1) * 2, `${above.excluded}`);
  eq('the filter travels with the result so a map cannot be mislabelled', above.filter, 'above');

  // a column where the source has nothing yields NaN, not 0
  const sparse = averageMap(g, () => NaN);
  eq('a column with no values produces no average', sparse.live, 0);
  check('…and is NaN rather than zero', Number.isNaN(sparse.values[0]), '');
}

// == PER-ZONE average maps =================================================
//
// A field-wide average across a stacked model is a number about no zone in particular:
// it mixes a 70 m reservoir with 1.2 km of overburden and reports the overburden,
// because there is more of it.
{
  const g = mkGrid();                       // nz = 4
  const src = (_col, l) => 0.1 + 0.1 * l;   // 0.1, 0.2, 0.3, 0.4

  const all = averageMap(g, src);
  near('with no zone the whole column averages', all.values[0], 0.25, 1e-9);

  const upper = averageMap(g, src, { layers: { k0: 0, nz: 2 } });
  near('an upper zone averages only its own layers', upper.values[0], 0.15, 1e-9);
  const lower = averageMap(g, src, { layers: { k0: 2, nz: 2 } });
  near('a lower zone averages only its own', lower.values[0], 0.35, 1e-9);
  check('the two zones bracket the field-wide number',
    upper.values[0] < all.values[0] && all.values[0] < lower.values[0], '');

  eq('the layer band travels with the map, so it cannot be mislabelled',
    upper.layers, { k0: 0, nz: 2 });
  eq('and is undefined when the map is field-wide', all.layers, undefined);

  const one = averageMap(g, src, { layers: { k0: 1, nz: 1 } });
  near('a single-layer zone is just that layer', one.values[0], 0.2, 1e-9);

  // a band beyond the grid must clamp, not read past the end
  const over = averageMap(g, src, { layers: { k0: 2, nz: 99 } });
  near('a band running past the top clamps to the grid', over.values[0], 0.35, 1e-9);
  const none = averageMap(g, src, { layers: { k0: 9, nz: 2 } });
  eq('a band entirely outside the grid yields nothing', none.live, 0);

  // zone AND contact together
  const both = averageMap(g, src, { layers: { k0: 0, nz: 4 }, owc: 2820, filter: 'above' });
  near('a zone scope and a contact filter compose', both.values[0], 0.15, 1e-9);
}

// == BILINEAR upsampling of the coarse simulation ===========================
{
  const { simNodeWeights, sampleSim } = await import('../src/tabs/fielddev/sim-grid.ts');
  const model = { dx: 10, dy: 10, x0: 0, y0: 0 };
  const sim = { nx: 2, ny: 2, dx: 40, dy: 40, x0: 0, y0: 0 };

  const w = simNodeWeights(model, sim, 4, 4);   // model centre (45,45)
  near('the bilinear weights sum to one', w.reduce((a, b) => a + b.w, 0), 1, 1e-12);
  check('all four surrounding nodes contribute', w.length === 4, '');

  // a linear ramp across the coarse grid must come back linear, not stepped
  const vals = [0, 1, 0, 1];                    // varies in x only
  const a = sampleSim(vals, model, sim, 0, 0);
  const b = sampleSim(vals, model, sim, 3, 0);
  const c = sampleSim(vals, model, sim, 7, 0);
  check('the upsampled field increases smoothly rather than in one step',
    a < b && b < c, `${a.toFixed(3)} < ${b.toFixed(3)} < ${c.toFixed(3)}`);
  check('...and every sample stays inside the source range',
    [a, b, c].every((v) => v >= 0 && v <= 1), '');

  // THE POINT: nearest-neighbour would give only two distinct values across the row
  const row = [];
  for (let i = 0; i < 8; i++) row.push(sampleSim(vals, model, sim, i, 0).toFixed(4));
  check('a row of 8 model cells shows more than the 2 values nearest would give',
    new Set(row).size > 2, `${new Set(row).size} distinct`);

  // clamping at the edges, and a NaN node not poisoning its neighbourhood
  check('sampling outside the coarse grid clamps rather than reading past it',
    Number.isFinite(sampleSim(vals, model, sim, -5, -5)), '');
  const holed = [NaN, 1, NaN, 1];
  check('a NaN node is skipped, not propagated',
    Number.isFinite(sampleSim(holed, model, sim, 4, 4)), '');
  check('...and an all-NaN neighbourhood yields NaN',
    Number.isNaN(sampleSim([NaN, NaN, NaN, NaN], model, sim, 4, 4)), '');
}

// == THE STACKED-ZONE TRAP: layer thickness is NOT (base-top)/nz ============
//
// `PackedGrid3D` carries ONE top and base per column -- the model-wide extremes. On a
// grid with two zones of different thickness the uniform fallback spreads them evenly
// across every layer, and the volume it produces is not the volume the grid holds. On
// Volve that was 37.7% on the HCPV map, and it reconciled to 0.2% once the true spans
// were passed.
{
  const g = mkGrid();                       // nz = 4, top 2800, base 2840 model-wide
  // two zones: layers 0-1 span 2800-2810 (thin), layers 2-3 span 2810-2840 (thick)
  const spanOf = (_col, l) => (l < 2
    ? { top: 2800 + l * 5, base: 2800 + (l + 1) * 5 }
    : { top: 2810 + (l - 2) * 15, base: 2810 + (l - 1) * 15 });

  const get = { ntg: () => 1, phi: () => 0.2, sw: () => 0 };
  const uniform = hcpvSource(g, get);                 // (2840-2800)/4 = 10 m every layer
  const real = hcpvSource(g, get, { spanOf });

  near('the uniform fallback gives every layer the same 10 m', uniform(0, 0), 100 * 100 * 10 * 0.2, 1e-6);
  near('the true span makes layer 0 only 5 m', real(0, 0), 100 * 100 * 5 * 0.2, 1e-6);
  near('...and layer 2 fifteen', real(0, 2), 100 * 100 * 15 * 0.2, 1e-6);
  check('so the two DISAGREE, which is the whole point',
    Math.abs(real(0, 0) - uniform(0, 0)) > 1, `${real(0, 0)} vs ${uniform(0, 0)}`);

  // the column total must equal the real rock volume, not the assumed one
  let sumReal = 0, sumUni = 0;
  for (let l = 0; l < 4; l++) { sumReal += real(0, l); sumUni += uniform(0, l); }
  near('the true spans sum to the column bulk x phi', sumReal, 100 * 100 * 40 * 0.2, 1e-6);
  near('...and here the uniform one happens to agree in TOTAL', sumUni, 100 * 100 * 40 * 0.2, 1e-6);
  check('but it is wrong layer BY layer, which is what a map reads',
    real(0, 0) !== uniform(0, 0) && real(0, 2) !== uniform(0, 2), '');

  // averageMap must weight by the same true thickness
  const src = (_c, l) => (l < 2 ? 0.1 : 0.3);
  const uniAvg = averageMap(g, src);
  const realAvg = averageMap(g, src, { spanOf });
  near('equal-weighted layers average to 0.20', uniAvg.values[0], 0.2, 1e-9);
  // thin 0.1 layers (5 m each) vs thick 0.3 layers (15 m each) => 0.25
  near('thickness-weighted, the thick layers dominate', realAvg.values[0], 0.25, 1e-9);

  // a span function that returns null means "no cell here"
  const holed = hcpvSource(g, get, { spanOf: (_c, l) => (l === 1 ? null : spanOf(_c, l)) });
  check('a layer with no span yields NaN, not a fabricated volume',
    Number.isNaN(holed(0, 1)) && Number.isFinite(holed(0, 0)), '');
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
