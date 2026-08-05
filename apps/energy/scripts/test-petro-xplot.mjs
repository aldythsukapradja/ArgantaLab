// test-petro-xplot.mjs — the crossplots, and above all what each REFUSES to say.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  availability, densityNeutron, pickett, pickettLines, permeability,
  saturationHeight, cuddyBvw, linreg, MATRIX_RHO,
} from '../src/tabs/fielddev/petro-xplot.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c, e = '') => { if (c) pass++; else { fail++; console.error(`  ✗ ${n}${e ? ` — ${e}` : ''}`); } };
const near = (a, b, t) => Math.abs(a - b) <= t;

const bore = (well, curves, depth, depthKind = 'tvdss') => ({ well, depth, depthKind, curves });

// ── availability ─────────────────────────────────────────────────────────────
const set = [
  bore('A', { GR: [10, 20], RT: [2, 3], RHOB: [2.3, 2.4], NPHI: [0.2, 0.25] }),
  bore('B', { GR: [15, 25], RT: [4, 5] }),
];
ok('counts bores carrying every needed curve', availability(set, ['GR', 'RT']).wells === 2);
ok('a bore missing one curve does not count', availability(set, ['RHOB', 'NPHI']).wells === 1);
ok('nothing carrying it is BLOCKED, with a reason',
  availability(set, ['PERM']).blocked !== null);
ok('an available plot is not blocked', availability(set, ['GR']).blocked === null);
ok('a curve present but all-null does not count',
  availability([bore('C', { GR: [null, null] })], ['GR']).wells === 0);

// ── density–neutron ──────────────────────────────────────────────────────────
{
  // clean wet sand: RHOB 2.25 at 25% porosity, NPHI agrees ⇒ no gas flag
  const r = densityNeutron([bore('A', { RHOB: [2.2825], NPHI: [0.22] })]);
  ok('phiD from the density curve', near(r.points[0].phiD, 0.22, 0.01), String(r.points[0].phiD));
  ok('agreeing curves are not flagged as gas', r.points[0].gasEffect === false);
}
{
  // gas: neutron reads far LOW against the density porosity ⇒ crossover
  const r = densityNeutron([bore('A', { RHOB: [2.2], NPHI: [0.10] })]);
  ok('gas crossover is detected', r.points[0].gasEffect === true, String(r.points[0].separation));
  ok('and the separation is negative', r.points[0].separation < 0);
}
{
  // A percent-scaled neutron log must be recognised from the CURVE, not the
  // sample: 18 could be 18% or an impossible 18 v/v, and only the distribution
  // settles it. Twelve samples on a 0-100 scale is unambiguous.
  const pct = [18, 22, 25, 19, 30, 27, 21, 24, 26, 20, 23, 28];
  const r = densityNeutron([bore('A', { RHOB: pct.map(() => 2.4), NPHI: pct })]);
  ok('a percent NPHI curve is unit-resolved, not rejected', r.points.length === pct.length,
    `${r.points.length}/${pct.length}`);
  ok('and comes back as a fraction', near(r.points[0].x, 0.18, 1e-9), String(r.points[0]?.x));
  ok('a fraction curve is left alone',
    near(densityNeutron([bore('A', {
      RHOB: pct.map(() => 2.4), NPHI: pct.map((v) => v / 100),
    })]).points[0].x, 0.18, 1e-9));
  // too few samples to judge: refuse rather than guess a scale
  ok('a single sample cannot establish a unit, so it is screened out',
    densityNeutron([bore('A', { RHOB: [2.4], NPHI: [18] })]).points.length === 0);
}
ok('blocked when the delivery has no RHOB/NPHI',
  densityNeutron([bore('B', { GR: [1] })]).availability.blocked !== null);
ok('a blocked plot yields NO points, not a partial cloud',
  densityNeutron([bore('B', { GR: [1] })]).points.length === 0);
ok('matrix densities are the standard three',
  MATRIX_RHO.sandstone === 2.65 && MATRIX_RHO.limestone === 2.71 && MATRIX_RHO.dolomite === 2.87);

// ── Pickett ──────────────────────────────────────────────────────────────────
{
  const lines = pickettLines([0.05, 0.35], 0.03, 1, 2, 2, [1, 0.5]);
  ok('one line per saturation', lines.length === 2);
  // Archie at Sw=1: RT = a·Rw/phi^m  ⇒  at phi=0.1, m=2, Rw=0.03 → 3.0
  const wet = lines[0].points.find(([p]) => p === 0.05);
  ok('the Sw=1 line is Archie for wet rock',
    near(pickettLines([0.1, 0.1], 0.03, 1, 2, 2, [1])[0].points[0][1], 3.0, 1e-9));
  ok('and it is monotonic in porosity', wet[1] > lines[0].points[1][1]);
  // halving Sw with n=2 quadruples RT
  const s1 = pickettLines([0.1, 0.1], 0.03, 1, 2, 2, [1])[0].points[0][1];
  const s5 = pickettLines([0.1, 0.1], 0.03, 1, 2, 2, [0.5])[0].points[0][1];
  ok('Sw enters as Sw^n', near(s5 / s1, 4, 1e-9), String(s5 / s1));
}
{
  const p = pickett([bore('A', { PHIE: [0.2, 0, 0.25], RT: [5, 5, -1] })]);
  ok('non-positive porosity or resistivity is dropped, not clamped', p.points.length === 1);
}

// ── permeability: the refusal ────────────────────────────────────────────────
{
  const r = permeability([bore('A', { PHIE: [0.2, 0.25, 0.3] })]);
  ok('with no K curve the plot is BLOCKED', r.availability.blocked !== null);
  ok('and no law is invented', r.law === null);
  ok('and no points are emitted', r.points.length === 0);
  ok('the reason names the real problem',
    /no permeability curve and no core K/i.test(r.availability.blocked));
  ok('and warns against a literature transform',
    /literature transform|this field/i.test(r.availability.blocked));
}
{
  // when K IS supplied the fit is real: log10(k) = 10·phi + 0  ⇒ phi .1/.2/.3 → 10/100/1000
  const r = permeability([bore('A', { PHIE: [0.1, 0.2, 0.3], PERM: [10, 100, 1000] })]);
  ok('a delivered K curve produces a real fit', r.law !== null);
  ok('slope recovered', near(r.law.a, 10, 1e-6), String(r.law?.a));
  ok('intercept recovered', near(r.law.b, 0, 1e-6));
  ok('perfect data gives r²=1', near(r.law.r2, 1, 1e-9));
}

// ── saturation height / Cuddy ────────────────────────────────────────────────
{
  // BVW = 0.05·H^-0.5 exactly; with PHIE 0.25 that is Sw = BVW/phi.
  // 24 samples, because the fit is now fluid-model.fitCuddy and it requires 20 —
  // the same guard the initialization uses, so both tabs quote one constant.
  const H = Array.from({ length: 24 }, (_, i) => 10 + i * 8);
  const depth = H.map((h) => 3000 - h);            // contact at 3000 m
  const phie = H.map(() => 0.25);
  const sw = H.map((h) => (0.05 * h ** -0.5) / 0.25);
  const r = saturationHeight([bore('A', { SWE: sw, PHIE: phie }, depth)], 3000);
  ok('every sample above the contact is kept', r.points.length === H.length);
  ok('height is measured above the free water level', r.points[0].height === 10);
  ok('BVW is Sw × PHIE', near(r.points[0].bvw, 0.05 * 10 ** -0.5, 1e-9));
  ok('Cuddy exponent recovered', near(r.cuddy.b, -0.5, 1e-6), String(r.cuddy?.b));
  ok('Cuddy coefficient recovered', near(r.cuddy.a, 0.05, 1e-6), String(r.cuddy?.a));
  ok('and the fit predicts back', near(cuddyBvw(r.cuddy, 40), 0.05 * 40 ** -0.5, 1e-9));
  // inherited from the shared fitter, and the reason to share it
  ok('the fit reports the height range it was fitted over',
    r.cuddy.hMin === 10 && r.cuddy.hMax === H[H.length - 1]);
  ok('too few samples yield NO fit rather than a fitted-looking pair',
    saturationHeight([bore('B', {
      SWE: sw.slice(0, 6), PHIE: phie.slice(0, 6),
    }, depth.slice(0, 6))], 3000).cuddy === null);
}
{
  // samples BELOW the contact are not a column and must not enter the fit
  const r = saturationHeight([bore('A', { SWE: [0.3, 0.9], PHIE: [0.25, 0.25] }, [2950, 3100])], 3000);
  ok('below the free water level is excluded', r.points.length === 1 && r.points[0].depth === 2950);
}
{
  // percent Sw, resolved from the curve rather than the sample (same rule as NPHI)
  const pctSw = [40, 45, 38, 52, 60, 35, 48, 55, 42, 50, 44, 58];
  const d = pctSw.map((_, i) => 2900 - i);
  const r = saturationHeight([bore('A', { SWE: pctSw, PHIE: pctSw.map(() => 0.25) }, d)], 3000);
  ok('a percent Sw curve is unit-resolved', r.points.length === pctSw.length);
  ok('and comes back as a fraction', near(r.points[0].sw, 0.4, 1e-9), String(r.points[0]?.sw));
}
{
  // THE ONE THAT BIT: the delivered logs are on MEASURED depth, and Volve is
  // deviated, so contact-minus-MD is negative through most of the reservoir. That
  // produced an empty plot that looked like "no data" instead of "wrong depth".
  const md = [3300, 3350, 3400];
  const r = saturationHeight([bore('A', { SWE: [0.3, 0.4, 0.5], PHIE: [0.25, 0.25, 0.25] }, md, 'md')], 3065);
  ok('measured-depth logs are REFUSED, not silently emptied', r.availability.blocked !== null);
  ok('and the reason names TVDSS', /TVDSS/i.test(r.availability.blocked ?? ''));
  ok('no fit is produced from them', r.cuddy === null);
}
ok('no Sw curve blocks the plot',
  saturationHeight([bore('A', { PHIE: [0.2] }, [2900])], 3000).availability.blocked !== null);

// ── linreg guards ────────────────────────────────────────────────────────────
ok('two points are NOT a fit', linreg([[0, 0], [1, 1]]) === null);
ok('three collinear points are', near(linreg([[0, 0], [1, 2], [2, 4]]).a, 2, 1e-9));
ok('a vertical cloud has no slope', linreg([[1, 0], [1, 5], [1, 9]]) === null);

// ── against the real Volve logs ──────────────────────────────────────────────
let bores = [];
let loadError = null;
try {
  for (const f of readdirSync(join(root, 'public/wb')).filter((n) => n.startsWith('logs-'))) {
    const j = JSON.parse(readFileSync(join(root, 'public/wb', f), 'utf8'));
    // The delivered shape is { md: [...], curves: { GR: { values: [...] } } } and
    // absent samples are the LAS -999.25, NOT null. An earlier version of this
    // loader assumed an array of curves, threw, and the catch below silently
    // skipped every real-delivery assertion — a test that looked like coverage
    // and was not. Hence `loadError`, asserted on below.
    const curves = {};
    for (const [name, c] of Object.entries(j.curves ?? {})) {
      const vals = Array.isArray(c) ? c : c?.values;
      if (Array.isArray(vals)) curves[name] = vals;
    }
    if (Object.keys(curves).length) bores.push({ well: j.well ?? f, depth: j.md, depthKind: 'md', curves });
  }
} catch (e) { loadError = e instanceof Error ? e.message : String(e); }

ok('the real-delivery fixture loaded without error', loadError === null, String(loadError));

if (bores.length) {
  ok('the delivery has logged bores', bores.length > 10, `${bores.length}`);
  const dn = densityNeutron(bores);
  ok('density–neutron runs on the real delivery', dn.availability.blocked === null);
  ok('and it covers most of the bores, not all', dn.availability.wells >= 15,
    `${dn.availability.wells}/${dn.availability.ofWells}`);
  ok('it produces a real cloud', dn.points.length > 1000, `${dn.points.length}`);
  ok('every plotted RHOB is physical — the LAS -999.25 absent value never reaches a plot',
    dn.points.every((p) => p.y > 1.2 && p.y < 3.6));
  ok('every plotted NPHI is physical too', dn.points.every((p) => p.x >= -0.15 && p.x <= 1));
  ok('density porosity stays inside what rock can hold',
    dn.points.every((p) => p.phiD <= 1 && p.phiD >= -0.5));

  // THE HEADLINE: this delivery cannot support a PHIE–K law.
  const k = permeability(bores);
  ok('PHIE–K is blocked on the real delivery — there is no K anywhere',
    k.availability.blocked !== null && k.law === null);

  // and the interpreted quartet is thin, which the availability must report
  const shf = saturationHeight(bores, 3065);
  ok('saturation-height finds the LFP-interpreted bores',
    shf.availability.wells > 0 && shf.availability.wells <= 5,
    `${shf.availability.wells}/${shf.availability.ofWells}`);
  // and then refuses them, because the delivered logs are on measured depth
  ok('but refuses to plot them off measured depth',
    shf.availability.blocked !== null && /TVDSS/i.test(shf.availability.blocked));
  ok('so no Cuddy fit is offered from MD', shf.cuddy === null);
}

console.log(`petro-xplot: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
