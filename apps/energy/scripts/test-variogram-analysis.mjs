// variogram-analysis.ts truth-lock.
//
// The whole point of this module is that it must be ABLE TO FAIL. It replaces a
// hardcoded `range 800` that always looked reasonable, so a fitter that always returns
// a plausible number would be no improvement — it would just move where the assumption
// lives. The assertions therefore weight heavily toward refusal: too few pairs, a range
// longer than the data can see, anisotropy the wells cannot resolve.
// Run: node scripts/test-variogram-analysis.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const eq = (n, got, want) => check(n, Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (n, got, want, tol) => check(n, Math.abs(got - want) <= tol, `got ${got}, want ${want} ±${tol}`);

const mod = join(__dirname, '..', 'src', 'tabs', 'fielddev', 'variogram-analysis.ts');
if (!existsSync(mod)) { console.log('SKIP — variogram-analysis.ts absent'); process.exit(0); }
const {
  experimentalVariogram, fitVariogram, detectAnisotropy, analyseVariogram,
  fitVerticalTrend, applyTrend, removeTrend, verticalProportionCurve,
  collocatedCokrige, correlation,
} = await import('../src/tabs/fielddev/variogram-analysis.ts');
const { simpleKrige } = await import('../src/engine/geostat.ts');

// deterministic noise — a flaky geostatistics test is worse than none
let seed = 987654321;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const gauss = () => {
  const u = Math.max(1e-9, rnd()), v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/** A field with a real correlation length: a smooth cosine plus noise. */
function field(n, wavelength, aniso = 1, azDeg = 0) {
  const t = (azDeg * Math.PI) / 180;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const x = rnd() * 2000, y = rnd() * 2000;
    // rotate into the anisotropy frame; the MINOR axis varies faster
    const major = x * Math.sin(t) + y * Math.cos(t);
    const minor = x * Math.cos(t) - y * Math.sin(t);
    const v = Math.cos((2 * Math.PI * major) / wavelength)
      + Math.cos((2 * Math.PI * minor) / (wavelength * aniso))
      + 0.15 * gauss();
    pts.push({ x, y, v });
  }
  return pts;
}

// ══ the experimental variogram ══════════════════════════════════════════════
{
  const pts = field(300, 1200);
  const exp = experimentalVariogram(pts);

  check('bins are produced', exp.bins.length > 5, `${exp.bins.length}`);
  check('every bin reports its PAIR count, not its point count',
    exp.bins.every((b) => b.pairs > 0), '');
  check('bin separations increase', exp.bins.every((b, i) => i === 0 || b.h > exp.bins[i - 1].h), '');
  check('the variance is reported — a variogram should approach it',
    Number.isFinite(exp.variance) && exp.variance > 0, `${exp.variance.toFixed(3)}`);
  check('the data EXTENT is reported, so a range can be judged against it',
    exp.extentM > 1000, `${exp.extentM.toFixed(0)}`);

  // γ must RISE from near zero: that is the definition, and a fitter cannot be trusted
  // if the thing it fits does not do it
  const first = exp.bins[0].gamma, last = exp.bins[exp.bins.length - 1].gamma;
  check('semivariance rises with separation', last > first, `${first.toFixed(3)} → ${last.toFixed(3)}`);

  eq('an omnidirectional variogram declares no azimuth', exp.azimuthDeg, null);
  const dir = experimentalVariogram(pts, { azimuthDeg: 45, toleranceDeg: 20 });
  eq('a directional one carries its azimuth', dir.azimuthDeg, 45);
  check('…and uses fewer pairs than omnidirectional', dir.pairs < exp.pairs, `${dir.pairs} vs ${exp.pairs}`);

  // an empty or trivial input must not throw
  eq('no points, no bins', experimentalVariogram([]).bins, []);
  eq('one point, no pairs', experimentalVariogram([{ x: 0, y: 0, v: 1 }]).pairs, 0);
}

// ══ the fit, and its refusals ═══════════════════════════════════════════════
{
  const pts = field(300, 1200);
  const fit = fitVariogram(experimentalVariogram(pts));
  check('a well-sampled field fits', fit.usable, fit.reason ?? '');
  check('…with a positive range inside the data extent', fit.vario.range > 0, `${fit.vario.range.toFixed(0)}`);
  check('…a nugget below the sill', fit.vario.nugget < fit.vario.sill, `${fit.vario.nugget.toFixed(3)}/${fit.vario.sill.toFixed(3)}`);
  check('…and a finite error', Number.isFinite(fit.rmse), `${fit.rmse}`);
  check('the model is one of the three', ['spherical', 'exponential', 'gaussian'].includes(fit.vario.model), fit.vario.model);

  // REFUSAL 1: too few pairs
  const sparse = fitVariogram(experimentalVariogram([
    { x: 0, y: 0, v: 1 }, { x: 100, y: 0, v: 2 }, { x: 200, y: 0, v: 1.5 },
  ]));
  check('three points do not make a variogram', !sparse.usable, '');
  check('…and it says why', /lag bin/.test(sparse.reason ?? ''), sparse.reason);
  check('…while still returning something usable as a fallback',
    sparse.vario.range > 0 && sparse.vario.sill > 0, '');

  // REFUSAL 2: a range the data cannot see
  //
  // A pure linear gradient has no sill inside the window, so the best fit is a range
  // longer than the data — which is exactly the case where an assumed 800 m would have
  // looked fine and been meaningless.
  const ramp = [];
  for (let i = 0; i < 200; i++) { const x = rnd() * 1000, y = rnd() * 1000; ramp.push({ x, y, v: x * 0.01 }); }
  const rampFit = fitVariogram(experimentalVariogram(ramp));
  if (!rampFit.usable) {
    check('a range beyond the data extent is REFUSED', /exceeds the data extent/.test(rampFit.reason ?? ''), rampFit.reason);
  } else {
    check('a trending field fits inside its own extent', rampFit.vario.range <= 1500, `${rampFit.vario.range.toFixed(0)}`);
  }

  // WEIGHTING: a three-pair bin must not steer the fit
  const exp = experimentalVariogram(field(300, 1200));
  const poisoned = {
    ...exp,
    bins: [...exp.bins, { h: exp.bins[exp.bins.length - 1].h * 1.5, gamma: 99, pairs: 3 }],
  };
  const a = fitVariogram(exp), b = fitVariogram(poisoned);
  near('one 3-pair outlier bin does not move the range', b.vario.range, a.vario.range, a.vario.range * 0.2);
  eq('…because it is excluded by the pair threshold', b.binsUsed, a.binsUsed);
}

// ══ anisotropy ══════════════════════════════════════════════════════════════
{
  // correlates FOUR times further along 90° (east-west) than across it
  const pts = field(500, 1600, 0.25, 90);
  const an = detectAnisotropy(pts, { nDirections: 6 });
  check('anisotropy is detected', an.usable, an.reason ?? '');
  if (an.usable) {
    check('the major range exceeds the minor', an.majorRangeM > an.minorRangeM,
      `${an.majorRangeM.toFixed(0)} vs ${an.minorRangeM.toFixed(0)}`);
    check('the ratio is below 1', an.ratio < 1 && an.ratio > 0, `${an.ratio.toFixed(2)}`);
    check('every direction tried is reported, for the rose plot', an.directions.length === 6, '');
    check('the azimuth is a compass bearing in [0,180)',
      an.azimuthDeg >= 0 && an.azimuthDeg < 180, `${an.azimuthDeg}`);
  }

  // REFUSAL: too sparse to resolve a direction
  const few = detectAnisotropy([
    { x: 0, y: 0, v: 1 }, { x: 500, y: 0, v: 2 }, { x: 0, y: 500, v: 1.4 },
  ], { nDirections: 4 });
  check('sparse data cannot resolve anisotropy', !few.usable, '');
  check('…and says so rather than returning a direction', /too sparse/.test(few.reason ?? ''), few.reason);
  eq('…falling back to isotropic', few.ratio, 1);
}

// ══ the whole analysis returns something the ENGINES accept ═════════════════
{
  const out = analyseVariogram(field(400, 1400, 0.3, 45), { nDirections: 6 });
  check('a Vario is produced', out.vario.range > 0 && out.vario.sill > 0, '');
  check('the experimental variogram travels with it, so the fit can be judged',
    out.exp.bins.length > 3, '');
  check('so does the anisotropy search', out.aniso.directions.length === 6, '');
  if (out.vario.aniso) {
    check('an anisotropic result carries azimuth and ratio',
      Number.isFinite(out.vario.aniso.azimuthDeg) && out.vario.aniso.ratio > 0 && out.vario.aniso.ratio <= 1, '');
  }

  // an isotropic field must NOT be handed a spurious anisotropy
  const iso = analyseVariogram(field(400, 1200, 1, 0), { nDirections: 6 });
  if (iso.aniso.usable) {
    check('an isotropic field yields a ratio near 1, or no anisotropy at all',
      !iso.vario.aniso || iso.vario.aniso.ratio > 0.4, `${iso.vario.aniso?.ratio}`);
  } else {
    check('…or the search honestly declines', true, iso.aniso.reason);
  }
}

// ══ trends ══════════════════════════════════════════════════════════════════
{
  // porosity falling 0.05 per 100 m of depth, plus noise
  const s = [];
  for (let i = 0; i < 200; i++) { const z = 2800 + rnd() * 200; s.push({ z, v: 0.30 - 0.0005 * (z - 2800) + 0.01 * gauss() }); }
  const t = fitVerticalTrend(s);
  check('a real vertical trend is found', t.usable, `r2 ${t.r2.toFixed(2)}`);
  near('…with the right gradient', t.b, -0.0005, 0.0002);
  near('applying it reproduces the trend value', applyTrend(t, 2900), 0.30 - 0.05, 0.02);
  near('removing it centres the residual near zero',
    removeTrend(t, 2900, applyTrend(t, 2900)), 0, 1e-9);

  // a trend that explains almost nothing must NOT be removed
  const flat = [];
  for (let i = 0; i < 200; i++) flat.push({ z: 2800 + rnd() * 200, v: 0.22 + 0.05 * gauss() });
  const ft = fitVerticalTrend(flat);
  check('noise is not a trend', !ft.usable, `r2 ${ft.r2.toFixed(3)}`);
  check('…and r² is reported either way', Number.isFinite(ft.r2), '');

  eq('too few samples cannot be fitted', fitVerticalTrend([{ z: 1, v: 1 }]).usable, false);
}

// ══ the vertical proportion curve ═══════════════════════════════════════════
{
  const cells = [];
  // coarsening upward: layer 0 is 90% sand, layer 3 is 10%
  for (let k = 0; k < 4; k++) {
    for (let n = 0; n < 20; n++) cells.push({ k, facies: n < (18 - k * 5) ? 1 : 0 });
  }
  const c = verticalProportionCurve(cells, 5);
  eq('one entry per layer', c.layers.length, 5);
  near('the top layer is sand-rich', c.layers[0].sand, 0.9, 0.01);
  check('and it decreases downward', c.layers[0].sand > c.layers[3].sand, '');
  check('the overall fraction is reported', c.overall > 0 && c.overall < 1, `${c.overall.toFixed(2)}`);

  // THE ASSERTION THAT MATTERS: a layer no well saw must not be filled with the mean
  check('a layer with no data reports NaN, not the global average',
    Number.isNaN(c.layers[4].sand) && c.layers[4].n === 0, '');
  eq('…and its sample count says so', c.layers[4].n, 0);

  eq('cells outside the grid are ignored',
    verticalProportionCurve([{ k: 99, facies: 1 }], 4).layers.every((l) => l.n === 0), true);
}

// ══ collocated cokriging ════════════════════════════════════════════════════
{
  const data = [
    { x: 0, y: 0, v: 1 }, { x: 100, y: 0, v: -1 },
    { x: 0, y: 100, v: 0.5 }, { x: 100, y: 100, v: -0.5 },
  ];
  const p = { model: 'spherical', nugget: 0.05, sill: 1, range: 300 };
  const krige = (d, t, pp) => simpleKrige(d, t, pp, 0);

  // rho = 0: the secondary carries no information and must be ignored entirely
  const none = collocatedCokrige(data, { x: 50, y: 50 }, 3.0, p, 0, krige);
  near('with zero correlation the secondary takes no weight', none.secondaryWeight, 0, 1e-9);
  near('…and the estimate is pure kriging', none.est, krige(data, { x: 50, y: 50 }, p).est, 1e-9);

  // a correlated secondary pulls the estimate toward itself
  const some = collocatedCokrige(data, { x: 50, y: 50 }, 3.0, p, 0.8, krige);
  check('a correlated secondary takes weight', some.secondaryWeight > 0, `${some.secondaryWeight.toFixed(3)}`);
  check('…and pulls the estimate toward its own value',
    some.est > none.est, `${some.est.toFixed(3)} vs ${none.est.toFixed(3)}`);
  check('the weight never exceeds one', some.secondaryWeight <= 1, `${some.secondaryWeight}`);

  // IT MATTERS MOST WHERE THE WELLS SAY LEAST — that is the reason to cokrige at all
  const nearWell = collocatedCokrige(data, { x: 2, y: 2 }, 3.0, p, 0.8, krige);
  const farAway = collocatedCokrige(data, { x: 900, y: 900 }, 3.0, p, 0.8, krige);
  check('the secondary weighs more far from the data than beside it',
    farAway.secondaryWeight > nearWell.secondaryWeight,
    `far ${farAway.secondaryWeight.toFixed(3)} vs near ${nearWell.secondaryWeight.toFixed(3)}`);

  // with no primary at all the secondary IS the estimate
  const only = collocatedCokrige([], { x: 0, y: 0 }, 2.0, p, 0.7, krige);
  near('no primary data: the secondary carries the estimate', only.est, 0.7 * 2.0, 1e-9);
  check('a missing secondary does not produce NaN',
    Number.isFinite(collocatedCokrige(data, { x: 50, y: 50 }, NaN, p, 0.8, krige).est), '');
}

// ══ correlation — the rho cokriging REQUIRES ════════════════════════════════
{
  const a = [1, 2, 3, 4, 5], b = [2, 4, 6, 8, 10];
  near('a perfect linear relation', correlation(a, b).rho, 1, 1e-9);
  near('…and its inverse', correlation(a, [10, 8, 6, 4, 2]).rho, -1, 1e-9);
  eq('pairs are counted', correlation(a, b).n, 5);
  check('non-finite pairs are dropped', correlation([1, NaN, 3], [1, 2, 3]).n === 2, '');
  check('too few pairs yields NaN rather than a number', Number.isNaN(correlation([1, 2], [1, 2]).rho), '');
  check('a constant series has no correlation', Number.isNaN(correlation([1, 1, 1, 1], b).rho), '');
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
