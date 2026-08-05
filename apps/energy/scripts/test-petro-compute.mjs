// petro-compute.ts truth-lock — the interactive petrophysics computation.
//
// Every assertion is either a published relation (Archie, Simandoux, Indonesia,
// Arps, Bateman–Konen) checked against a hand-computed value, or a rule the module
// promises: a result requires its inputs, nulls survive, and a misfit over too few
// samples is not reported as a calibration.
// Run: node scripts/test-petro-compute.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const eq = (n, got, want) => check(n, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (n, got, want, tol = 1e-6) =>
  check(n, Number.isFinite(got) && Math.abs(got - want) <= tol, `got ${got}, want ${want} ±${tol}`);

const mod = join(__dirname, '..', 'src', 'tabs', 'fielddev', 'petro-compute.ts');
if (!existsSync(mod)) { console.log('SKIP — petro-compute.ts absent'); process.exit(0); }
const P = await import('../src/tabs/fielddev/petro-compute.ts');
const {
  DEFAULT_PARAMS, runPetro, resolveEndpoints, simandouxSw, indonesiaSw, saturation,
  arps, rwFromSalinity, salinityFromRw, tempAtDepth, misfit, swModelHonoursN, swModelUsesRsh,
  screenCurve, PHYSICAL_RANGE,
} = P;

// ── Archie, against a hand-computed value ───────────────────────────────────────
// Sw = ((a·Rw)/(φ^m·Rt))^(1/n) = ((1·0.03)/(0.2²·10))^(1/2) = (0.03/0.4)^0.5 = 0.27386…
{
  const p = { ...DEFAULT_PARAMS, a: 1, m: 2, n: 2, rw: 0.03 };
  near('Archie matches the closed form', saturation('archie', 0.2, 10, 0, p), Math.sqrt(0.03 / 0.4), 1e-9);
  eq('Archie clamps to 1 in a wet, tight interval', saturation('archie', 0.02, 0.5, 0, p), 1);
}

// ── Simandoux reduces to Archie when there is no shale ──────────────────────────
{
  const a = 1, m = 2, rw = 0.03, rt = 10, phie = 0.2;
  const arch = Math.sqrt((a * rw) / (Math.pow(phie, m) * rt));
  near('Simandoux → Archie at Vsh = 0', simandouxSw(phie, rt, 0, a, m, rw, 4), arch, 1e-9);
  check('Simandoux reads LOWER Sw than Archie once shale conducts',
    simandouxSw(phie, rt, 0.4, a, m, rw, 4) < arch,
    'shale conductivity that Archie attributes to water must not be counted as water');
}

// ── Indonesia likewise ─────────────────────────────────────────────────────────
{
  const a = 1, m = 2, n = 2, rw = 0.03, rt = 10, phie = 0.2;
  const arch = Math.sqrt((a * rw) / (Math.pow(phie, m) * rt));
  near('Indonesia → Archie at Vsh = 0', indonesiaSw(phie, rt, 0, a, m, n, rw, 4), arch, 1e-9);
  check('Indonesia reads LOWER Sw than Archie in shaly rock',
    indonesiaSw(phie, rt, 0.4, a, m, n, rw, 4) < arch, '');
  check('Indonesia is monotonic in Vsh',
    indonesiaSw(phie, rt, 0.6, a, m, n, rw, 4) < indonesiaSw(phie, rt, 0.2, a, m, n, rw, 4), '');
}

// ── model capability flags are honest about what they ignore ────────────────────
eq('Simandoux does not honour n (closed form fixes it at 2)', swModelHonoursN('simandoux'), false);
eq('Archie and Indonesia do honour n', [swModelHonoursN('archie'), swModelHonoursN('indonesia')], [true, true]);
eq('only the shale-corrected models read Rsh',
  ['archie', 'simandoux', 'indonesia'].map(swModelUsesRsh), [false, true, true]);

// ── Arps / Bateman–Konen ───────────────────────────────────────────────────────
// Arps at equal temperature is the identity; warmer brine is LESS resistive.
near('Arps is the identity at the same temperature', arps(0.1, 80, 80), 0.1, 1e-12);
check('Arps: hotter brine is less resistive', arps(0.1, 20, 90) < 0.1, '');
{
  // Rw = (400000/(T_F·ppm))^0.88 ; ppm = 100000, T = 100 °C → 212 °F
  const want = Math.pow(400000 / (212 * 100000), 0.88);
  near('Bateman–Konen matches the published form', rwFromSalinity(100000, 100), want, 1e-12);
  // and it round-trips
  near('Rw → salinity → Rw round-trips', rwFromSalinity(salinityFromRw(want, 100), 100), want, 1e-9);
  eq('zero salinity has no Rw rather than a fabricated one', rwFromSalinity(0, 100), null);
}
near('temperature at depth follows the gradient', tempAtDepth(3000, 6, 3.5), 6 + 30 * 3.5, 1e-12);

// A Volve reality check, not a unit test of arithmetic: Equinor's shipped RW curve
// on 19 A sits at ~0.0197 Ω·m. Whatever salinity reproduces that at reservoir
// temperature must be a strong brine — if this ever reports fresh water, the
// correlation has been wired up wrong.
{
  const ppm = salinityFromRw(0.0197, 100);
  check('Volve Rw 0.0197 Ω·m @100 °C implies a strong brine',
    ppm > 50000 && ppm < 400000, `implied ${Math.round(ppm).toLocaleString('en-US')} ppm NaCl-eq`);
}

// ── endpoints ──────────────────────────────────────────────────────────────────
{
  const gr = Array.from({ length: 200 }, (_, i) => 20 + i);   // 20 … 219
  const auto = resolveEndpoints(gr, { grClean: null, grShale: null });
  eq('auto endpoints are the well’s own P5/P95 and are `derived`',
    [auto.clean, auto.shale, auto.nature], [30, 210, 'derived']);
  const user = resolveEndpoints(gr, { grClean: 15, grShale: 120 });
  eq('a user endpoint wins and is labelled `user`', [user.clean, user.shale, user.nature], [15, 120, 'user']);
  const shipped = resolveEndpoints(gr, { grClean: null, grShale: null },
    { grMin: [20, 24, 28], grMax: [70, 80, 90] });
  eq('shipped GRMIN/GRMAX outrank auto and are `interpreted`',
    [shipped.clean, shipped.shale, shipped.nature], [24, 80, 'interpreted']);
  eq('too little GR yields no endpoints rather than a guess',
    resolveEndpoints([1, 2, 3], { grClean: null, grShale: null }), null);
  eq('a flat GR log yields no endpoints', resolveEndpoints(new Array(50).fill(60), { grClean: null, grShale: null }), null);
}

// ── the whole-log run: a result requires its inputs ────────────────────────────
{
  const md = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109];
  const full = {
    md,
    gr: [20, 25, 30, 90, 100, 35, 28, 22, 95, 40],
    rt: [40, 38, 45, 2, 1.8, 50, 60, 55, 2.1, 30],
    rhob: [2.2, 2.22, 2.18, 2.5, 2.55, 2.15, 2.12, 2.2, 2.52, 2.3],
  };
  const r = runPetro(full, DEFAULT_PARAMS);
  eq('a complete input produces every track', Object.keys(r.missing), []);
  check('Vsh is bounded [0,1]', r.vsh.every((v) => v >= 0 && v <= 1), '');
  check('Sw is bounded [0,1]', r.sw.every((v) => v >= 0 && v <= 1), '');
  check('the clean, resistive, porous samples flag as net',
    r.net[0] === true && r.net[6] === true, `net = ${JSON.stringify(r.net)}`);
  check('the shaly, conductive samples do NOT flag as net',
    r.net[3] === false && r.net[4] === false, '');

  // no RT ⇒ no saturation, and the reason is named
  const noRt = runPetro({ ...full, rt: undefined }, DEFAULT_PARAMS);
  eq('no RT ⇒ no Sw, with the reason named', noRt.missing.sw, 'no RT curve');
  eq('no RT ⇒ every Sw sample is null', noRt.sw.every((v) => v === null), true);
  check('…but porosity still computes', noRt.counts.phie === md.length, '');
  eq('no RT ⇒ no net flag either', noRt.net.every((v) => v === null), true);

  // no GR ⇒ no Vsh, and porosity falls back to total
  const noGr = runPetro({ ...full, gr: undefined }, DEFAULT_PARAMS);
  eq('no GR ⇒ no Vsh, with the reason named', noGr.missing.vsh, 'no GR curve');
  eq('no GR ⇒ φe falls back to φt rather than vanishing',
    noGr.phie.map((v) => (v == null ? null : +v.toFixed(6))),
    noGr.phit.map((v) => (v == null ? null : +v.toFixed(6))));
  eq('no GR ⇒ no net flag (the Vsh cutoff has nothing to test)', noGr.net.every((v) => v === null), true);

  // no RHOB ⇒ no porosity, therefore no saturation
  const noRhob = runPetro({ ...full, rhob: undefined }, DEFAULT_PARAMS);
  eq('no RHOB ⇒ no porosity, with the reason named', noRhob.missing.phie, 'no RHOB curve');
  eq('…and no Sw either, saying which input it lacked', noRhob.missing.sw, 'no porosity (no RHOB curve)');

  // density–neutron without NPHI is refused rather than silently degraded to density
  const dn = runPetro(full, { ...DEFAULT_PARAMS, porosityModel: 'density-neutron' });
  eq('density–neutron without NPHI is refused, not downgraded', dn.missing.phie, 'no NPHI curve for the density–neutron model');

  // nulls survive
  const holed = { ...full, rhob: [2.2, null, 2.18, 2.5, null, 2.15, 2.12, 2.2, 2.52, 2.3] };
  const hr = runPetro(holed, DEFAULT_PARAMS);
  eq('a null input sample yields a null output sample, never an interpolation',
    [hr.phie[1], hr.phie[4]], [null, null]);
  check('and the neighbours are unaffected', hr.phie[0] != null && hr.phie[2] != null, '');
}

// ── misfit: too few overlapping samples is not a calibration ───────────────────
{
  const ours = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  eq('a perfect match reports zero error',
    (() => { const m = misfit(ours, ours); return [m.n, +m.rms.toFixed(12), +m.bias.toFixed(12), +m.r2.toFixed(12)]; })(),
    [10, 0, 0, 1]);
  const high = ours.map((v) => v + 0.1);
  const m2 = misfit(high, ours);
  near('a constant offset shows as bias, not noise', m2.bias, 0.1, 1e-12);
  near('…and as RMS of the same size', m2.rms, 0.1, 1e-12);
  eq('no reference ⇒ no misfit', misfit(ours, undefined), null);
  eq('fewer than 8 overlapping samples is NOT reported as a calibration',
    misfit([1, 2, 3, null, null, null, null, null, null, null], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), null);
  eq('non-overlapping nulls are excluded from n',
    misfit([1, null, 3, 4, 5, 6, 7, 8, 9, 10], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).n, 9);
}

// ── the plausibility gate: an unresolved null sentinel must not become an answer ──
//
// This is the exact Volve failure that motivated the gate. The LWD composite logs
// (F-15 C and its siblings) carry -999.25 as a literal value rather than a resolved
// null. Without screening, density porosity computes (2.65 + 999.25)/1.65 = 607,
// clamps to 1.0, and a 1,500 m Hordaland shale reports 98% porosity at 100% net —
// ranked top of the field. Confidently wrong beats honestly absent only for people
// who do not have to drill it.
{
  const md = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109];
  const S = -999.25;
  const r = runPetro({
    md,
    gr: [20, S, 30, 90, S, 35, 28, 22, S, 40],
    rt: [40, S, 45, 2, S, 50, 60, 55, S, 30],
    rhob: [2.2, S, 2.18, 2.5, S, 2.15, 2.12, 2.2, S, 2.3],
  }, DEFAULT_PARAMS);

  check('no sentinel becomes a porosity',
    r.phie.filter((v) => v != null).every((v) => v <= 0.6),
    'max phie = ' + Math.max(...r.phie.filter((v) => v != null)));
  eq('the sentinel depths yield null porosity, not 1.0',
    [r.phie[1], r.phie[4], r.phie[8]], [null, null, null]);
  eq('...and null saturation', [r.sw[1], r.sw[4], r.sw[8]], [null, null, null]);
  eq('...and no net flag', [r.net[1], r.net[4], r.net[8]], [null, null, null]);
  check('the screening is REPORTED, not silent',
    r.screened.length === 3 && r.screened.every((x) => x.rejected === 3),
    JSON.stringify(r.screened));
  eq('every screened curve is named by mnemonic',
    r.screened.map((x) => x.curve).sort(), ['GR', 'RHOB', 'RT']);
  check('the surviving samples are untouched',
    Math.abs(r.phie[0] - (2.65 - 2.2) / 1.65) < 1e-9, 'phit at sample 0 = ' + r.phie[0]);
  // With only 7 GR samples surviving, resolveEndpoints correctly refuses (it needs 8)
  eq('too few survivors ⇒ no endpoints, so no Vsh', r.endpoints, null);
  eq('...and the reason names the endpoints, not the curve',
    r.missing.vsh, 'GR present but its clean/shale endpoints could not be resolved');

  // A -999 GR would otherwise drag the clean endpoint to -999 and make every sample
  // read as pure sand. Over a log long enough to resolve endpoints at all, they must
  // come from the SCREENED curve.
  {
    const n = 60;
    const longMd = Array.from({ length: n }, (_, i) => 100 + i);
    const longGr = Array.from({ length: n }, (_, i) => (i % 5 === 0 ? S : 20 + i));
    const withSentinel = runPetro({ md: longMd, gr: longGr }, DEFAULT_PARAMS);
    const withoutSentinel = runPetro({
      md: longMd, gr: longGr.map((v) => (v === S ? null : v)),
    }, DEFAULT_PARAMS);
    check('a sentinel cannot drag the clean endpoint below zero',
      withSentinel.endpoints.clean >= 0, 'clean = ' + withSentinel.endpoints.clean);
    eq('screening a sentinel is identical to it having been a proper null',
      [withSentinel.endpoints.clean, withSentinel.endpoints.shale],
      [withoutSentinel.endpoints.clean, withoutSentinel.endpoints.shale]);
  }

  const clean = runPetro({
    md,
    gr: [20, 25, 30, 90, 100, 35, 28, 22, 95, 40],
    rt: [40, 38, 45, 2, 1.8, 50, 60, 55, 2.1, 30],
    rhob: [2.2, 2.22, 2.18, 2.5, 2.55, 2.15, 2.12, 2.2, 2.52, 2.3],
  }, DEFAULT_PARAMS);
  eq('a physically clean log reports nothing screened — the gate must not cry wolf',
    clean.screened, []);
}

// screenCurve itself
{
  eq('an in-range curve passes through untouched', screenCurve([1, 2, 3], { lo: 0, hi: 10 }).rejected, 0);
  const out = screenCurve([1, -999.25, 3], { lo: 0, hi: 10 });
  eq('the out-of-range sample is nulled', out.values, [1, null, 3]);
  eq('...and counted', out.rejected, 1);
  eq('an existing null is not counted as a rejection', screenCurve([1, null, 3], { lo: 0, hi: 10 }).rejected, 0);
  eq('no declared range means no screening', screenCurve([1, -999], undefined).rejected, 0);
  check('negative gamma is impossible', PHYSICAL_RANGE.gr.lo === 0, '');
  check('resistivity must be strictly positive for Archie', PHYSICAL_RANGE.rt.lo > 0, '');
}


// ── the delivery's PUBLISHED Archie constants ────────────────────────────────
//
// a=1, m=2, n=2, Rw=0.03 is a textbook sandstone, not this reservoir. Volve's own
// evaluation (Statoil doc 3781-06) fits m = 1.865·k^-0.0083 and n = 2.45 and measures
// the brine at 0.07 Ω·m @ 20 °C. All three feed Archie multiplicatively, so starting
// from the defaults is a systematic error in every saturation the tab computes.
{
  const { archieMFromK, mAt, resolvePublishedArchie } = P;
  const rel = { a: 1.865, b: -0.0083 };

  near('m from k matches the published relation', archieMFromK(100, rel), 1.865 * Math.pow(100, -0.0083), 1e-12);
  check('the k-dependence is weak but the LEVEL is well below 2.0',
    archieMFromK(1, rel) < 1.9 && archieMFromK(1000, rel) > 1.7,
    `m: ${archieMFromK(1, rel).toFixed(3)} at 1 mD → ${archieMFromK(1000, rel).toFixed(3)} at 1000 mD`);
  check('a fixed m of 2.0 is ~11% above the published level',
    (2 - archieMFromK(100, rel)) / archieMFromK(100, rel) > 0.10, '');
  eq('no permeability yields no k-derived m', archieMFromK(null, rel), null);
  eq('a zero or negative permeability yields no m rather than an infinity', archieMFromK(0, rel), null);
  eq('no published relation yields no k-derived m', archieMFromK(100, null), null);
  eq('an absurd relation is rejected rather than returned', archieMFromK(1e9, { a: 1.865, b: -2 }), null);

  const withRel = { ...DEFAULT_PARAMS, mFromK: rel };
  near('mAt uses the k-derived exponent where a permeability exists', mAt(withRel, 100), archieMFromK(100, rel), 1e-12);
  eq('mAt falls back to the scalar where there is none', mAt(withRel, null), DEFAULT_PARAMS.m);
  eq('mAt is the scalar when the delivery publishes no relation', mAt(DEFAULT_PARAMS, 100), DEFAULT_PARAMS.m);

  // resolving the published block
  const pub = { mFromK: rel, n: 2.45, brine: { rwOhmM: 0.07, rwTempC: 20 } };
  const r = resolvePublishedArchie(DEFAULT_PARAMS, pub, 110);
  eq('the published saturation exponent is adopted', r.n, 2.45);
  eq('the published m relation is carried', r.mFromK, rel);
  near('the scalar m falls back to the relation at mid-range k, not to 2.0',
    r.m, archieMFromK(100, rel), 1e-12);
  check('Rw is converted from the measurement temperature to formation temperature',
    r.rw < 0.07 && r.rw > 0.01, `0.07 Ω·m @20 °C → ${r.rw.toFixed(4)} Ω·m @110 °C`);
  near('...by Arps exactly', r.rw, P.arps(0.07, 20, 110), 1e-12);
  eq('no published block leaves the parameters untouched', resolvePublishedArchie(DEFAULT_PARAMS, null, 110), DEFAULT_PARAMS);
  eq('a published block with no temperature leaves Rw at its quoted value',
    resolvePublishedArchie(DEFAULT_PARAMS, { brine: { rwOhmM: 0.07 } }, null).rw, 0.07);

  // it must actually change the answer, and in the right direction
  {
    const phie = 0.22, rt = 20;
    const def = P.saturation('archie', phie, rt, 0, DEFAULT_PARAMS);
    const pubSw = P.saturation('archie', phie, rt, 0, { ...r, mFromK: rel }, 200);
    check('the published constants change the computed saturation materially',
      Math.abs(pubSw - def) / def > 0.05,
      `default Sw ${def.toFixed(3)} vs published ${pubSw.toFixed(3)} — ${((pubSw / def - 1) * 100).toFixed(1)}%`);
    // Each constant moves Sw a different way, so the NET direction is not obvious and
    // must not be asserted as folklore. Lock each term on its own, then the net.
    const only = (over) => P.saturation('archie', phie, rt, 0, { ...DEFAULT_PARAMS, ...over });
    check('a lower Rw alone lowers Sw', only({ rw: 0.0221 }) < def, '');
    check('a lower m alone lowers Sw — φ^m is larger for a smaller exponent',
      only({ m: 1.799 }) < def, `m 1.799 → ${only({ m: 1.799 }).toFixed(4)} vs ${def.toFixed(4)}`);
    check('a HIGHER n alone raises Sw — the ratio is below 1, so a smaller 1/n exponent lifts it',
      only({ n: 2.45 }) > def, `n 2.45 → ${only({ n: 2.45 }).toFixed(4)} vs ${def.toFixed(4)}`);
    check('n dominates on this rock, so the published set reads WETTER than the textbook default',
      pubSw > def,
      `published ${pubSw.toFixed(4)} > default ${def.toFixed(4)} — the generic parameters were optimistic`);
  }

  // and the whole-log run must honour the permeability curve
  {
    const md = [1, 2, 3];
    const base = { md, gr: [40, 40, 40], rhob: [2.3, 2.3, 2.3], nphi: [0.2, 0.2, 0.2], rt: [20, 20, 20] };
    const noK = P.runPetro(base, { ...r, mFromK: rel });
    const withK = P.runPetro({ ...base, klogh: [1000, 1000, 1000] }, { ...r, mFromK: rel });
    check('runPetro applies the per-sample cementation exponent from KLOGH',
      Math.abs((withK.sw[0] ?? 0) - (noK.sw[0] ?? 0)) > 1e-6,
      `no k: ${noK.sw[0]?.toFixed(4)} · k=1000 mD: ${withK.sw[0]?.toFixed(4)}`);
    check('a null permeability sample falls back rather than producing a null Sw',
      P.runPetro({ ...base, klogh: [null, null, null] }, { ...r, mFromK: rel }).sw[0] != null, '');
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
