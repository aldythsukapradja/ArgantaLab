// volumes.ts truth-lock — GRV → STOIIP, two independent ways (S9).
//
// The assertions are about the contact cut (a layer straddling the OWC must not swing
// the answer by its whole volume), volume-weighted averaging, and the reconciliation
// being REPORTED rather than resolved.
// Run: node scripts/test-volumes.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const eq = (n, got, want) => check(n, Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (n, got, want, tol = 1e-6) =>
  check(n, Number.isFinite(got) && Math.abs(got - want) <= tol, `got ${got}, want ${want} ±${tol}`);

const mod = join(__dirname, '..', 'src', 'tabs', 'fielddev', 'volumes.ts');
if (!existsSync(mod)) { console.log('SKIP — volumes.ts absent'); process.exit(0); }
const {
  aboveContactFraction, gridVolumes, mapVolumes, reconcile, identityResidual,
  toMMstb, toMMSm3, BBL_PER_SM3,
} = await import('../src/tabs/fielddev/volumes.ts');

// ── the contact cut ───────────────────────────────────────────────────────────
{
  // a 10 m cell centred at 3000 spans 2995–3005
  eq('a cell entirely above the contact counts fully', aboveContactFraction(3000, 10, 3200), 1);
  eq('a cell entirely below counts for nothing', aboveContactFraction(3400, 10, 3200), 0);
  near('a cell centred exactly on the contact counts half', aboveContactFraction(3200, 10, 3200), 0.5);
  near('a cell three-quarters above counts three-quarters', aboveContactFraction(3200, 10, 3202.5), 0.75);
  // this is the whole point: without fractional counting, a 20 m layer straddling the
  // contact swings the answer by its ENTIRE volume depending on which side its centre lands
  const justAbove = aboveContactFraction(3199.9, 20, 3200);
  const justBelow = aboveContactFraction(3200.1, 20, 3200);
  check('a layer straddling the contact does NOT swing by its whole volume',
    Math.abs(justAbove - justBelow) < 0.02,
    `${justAbove.toFixed(3)} vs ${justBelow.toFixed(3)} — a hard centre test would give 1 vs 0`);
  eq('a zero-thickness cell is a point test', aboveContactFraction(3000, 0, 3200), 1);
}

// ── a uniform block: the arithmetic must be exact ─────────────────────────────
const cell = (z, o = {}) => ({
  z, thk: o.thk ?? 10, bulk: o.bulk ?? 1000,
  ntg: o.ntg ?? 1, phi: o.phi ?? 0.2, sw: o.sw ?? 0.25,
  active: o.active ?? true,
});
{
  // 10 identical cells, all above the contact: 10 × 1000 m³ bulk
  const cells = Array.from({ length: 10 }, (_, i) => cell(3000 + i * 10));
  const g = gridVolumes(cells, { owc: 3200, bo: 1.25 });

  near('GRV is the sum of the bulk volumes', g.grvM3, 10000);
  near('NRV is GRV × NTG', g.nrvM3, 10000 * 1);
  near('PV is NRV × φ', g.pvM3, 10000 * 0.2);
  near('HCPV is PV × (1 − Sw)', g.hcpvM3, 10000 * 0.2 * 0.75);
  near('STOIIP is HCPV / Bo', g.stoiipSm3, (10000 * 0.2 * 0.75) / 1.25);
  eq('every cell contributed', g.cells, 10);
  eq('none straddled the contact', g.straddling, 0);
  near('the averages reproduce the uniform input', g.meanPhi, 0.2);
  near('…and Sw', g.meanSw, 0.25);

  // a uniform block is exactly where the two routes MUST agree
  const r = reconcile(g, { owc: 3200, bo: 1.25 }, undefined, cells);
  near('grid and map agree exactly on a uniform block', r.relDiff, 0, 1e-9);
  check('and the verdict says so', /agree/i.test(r.verdict), r.verdict);
  // the weighted route is an ALGEBRAIC IDENTITY with the summation — a non-zero
  // residual would mean the accumulation itself is wrong
  near('the volume-weighted identity holds exactly', identityResidual(g, 1.25), 0, 1e-12);
}

// ── inactive cells and cells below the contact contribute nothing ────────────
{
  const cells = [
    cell(3000),
    cell(3010, { active: false }),
    cell(3400),                       // below a 3200 contact
  ];
  const g = gridVolumes(cells, { owc: 3200, bo: 1.25 });
  eq('only the live cell above the contact contributed', g.cells, 1);
  near('GRV is that one cell', g.grvM3, 1000);
}

// ── the straddling cell is counted fractionally ──────────────────────────────
{
  const cells = [cell(3195, { thk: 20, bulk: 2000 })];   // spans 3185–3205, contact at 3200
  const g = gridVolumes(cells, { owc: 3200, bo: 1.25 });
  eq('it is flagged as straddling', g.straddling, 1);
  near('and counted by the fraction above — 15 of its 20 m', g.grvM3, 2000 * 0.75);
}

// ── volume weighting: a thick cell must outweigh a sliver ────────────────────
{
  const cells = [
    cell(3000, { thk: 1, bulk: 100, phi: 0.40 }),     // a sliver with high porosity
    cell(3050, { thk: 100, bulk: 10000, phi: 0.10 }), // the bulk of the rock
  ];
  const g = gridVolumes(cells, { owc: 3200, bo: 1.25 });
  const naiveMean = (0.40 + 0.10) / 2;
  check('the mean φ is VOLUME-weighted, not a cell mean',
    Math.abs(g.meanPhi - naiveMean) > 0.05,
    `volume-weighted ${g.meanPhi.toFixed(4)} vs naive cell mean ${naiveMean.toFixed(4)}`);
  near('and it is the pore-volume-weighted value', g.meanPhi, (0.40 * 100 + 0.10 * 10000) / 10100, 1e-9);
}

// ── the reconciliation REPORTS rather than resolves ──────────────────────────
{
  // φ and Sw anti-correlated: good rock is also low-Sw, so the product of averages
  // understates the sum of products. The gap is real and must be surfaced.
  const cells = [
    cell(3000, { phi: 0.30, sw: 0.15, bulk: 5000 }),
    cell(3050, { phi: 0.05, sw: 0.85, bulk: 5000 }),
  ];
  const g = gridVolumes(cells, { owc: 3200, bo: 1.25 });
  const r = reconcile(g, { owc: 3200, bo: 1.25 }, undefined, cells);
  check('an INDEPENDENT average produces a real gap on a correlated field',
    Math.abs(r.relDiff) > 0.005, `${(r.relDiff * 100).toFixed(2)}%`);
  check('and the verdict names the cause rather than hiding it',
    /average|correlat/i.test(r.verdict), r.verdict);
  check('both numbers survive — neither is discarded',
    r.grid.stoiipSm3 > 0 && r.map.stoiipSm3 > 0, '');
  check('the source of the averages is stated, so the check cannot be mistaken for an identity',
    /cell mean/i.test(r.mapPropsSource), r.mapPropsSource);
  // …while the weighted route still reproduces the sum exactly
  near('the identity residual is still zero on the same field', r.identityResidual, 0, 1e-12);

  // and feeding it grid-derived averages collapses the gap — which is precisely
  // why reconcile does not do that by default
  const tautology = reconcile(g, { owc: 3200, bo: 1.25 },
    { ntg: g.meanNtg, phi: g.meanPhi, sw: g.meanSw });
  near('grid-derived averages reproduce the grid by construction — a tautology',
    tautology.relDiff, 0, 1e-12);
  check('…and the result says so rather than claiming agreement',
    Math.abs(r.relDiff) > Math.abs(tautology.relDiff),
    'the independent comparison must be the informative one');
}

// ── nothing above the contact is a finding, not a zero ───────────────────────
{
  const g = gridVolumes([cell(3400)], { owc: 3200, bo: 1.25 });
  eq('no cell contributed', g.cells, 0);
  eq('STOIIP is zero', g.stoiipSm3, 0);
  const r = reconcile(g, { owc: 3200, bo: 1.25 }, undefined, [cell(3400)]);
  check('and the verdict explains WHY it is zero', /No cell lies above the contact/i.test(r.verdict), r.verdict);
}

// ── the ZONE filter: the overburden is not the reservoir ─────────────────────
//
// Without it, every zone in a structural model contributes — including the whole
// section from seabed down. On Volve that produced a STOIIP 218x the official
// figure, and restricting to the reservoir interval alone cut it by 7.6x.
{
  const cells = [
    { zone: 'overburden', ...cell(3000) },
    { zone: 'overburden', ...cell(3010) },
    { zone: 'reservoir', ...cell(3020) },
  ];
  const all = gridVolumes(cells, { owc: 3200, bo: 1.25 });
  const res = gridVolumes(cells, { owc: 3200, bo: 1.25, zones: ['reservoir'] });
  eq('with no filter every zone contributes', all.cells, 3);
  eq('with a filter only the reservoir does', res.cells, 1);
  eq('and the excluded cells are COUNTED, not silently dropped', res.outOfZone, 2);
  near('the volume falls to the reservoir share', res.grvM3, all.grvM3 / 3);
  eq('an unzoned cell is excluded when a filter is active',
    gridVolumes([cell(3000)], { owc: 3200, bo: 1.25, zones: ['reservoir'] }).cells, 0);

  // the map comparison must use the SAME rock, or it compares two different volumes
  const rec = reconcile(res, { owc: 3200, bo: 1.25, zones: ['reservoir'] }, undefined, cells);
  near('the map route is restricted to the same zone', rec.map.grvM3, res.grvM3);
}

// ── unit conversions, against the published factor ───────────────────────────
{
  near('1 MMSm³ is 6.2898 MMstb', toMMstb(1e6), BBL_PER_SM3, 1e-9);
  near('MMSm³ is a plain scaling', toMMSm3(18.7e6), 18.7, 1e-9);
  // a Volve reality check: the official STOIIP is 18.70 MMSm³ — any grid volume is
  // compared against it, never quoted instead of it
  near('Volve official STOIIP in MMstb', toMMstb(18.7e6), 18.7 * BBL_PER_SM3, 1e-6);
}

// ── Bo of zero cannot silently produce infinity ──────────────────────────────
{
  const g = gridVolumes([cell(3000)], { owc: 3200, bo: 0 });
  eq('a zero Bo yields zero STOIIP rather than Infinity', g.stoiipSm3, 0);
  eq('and the map route agrees', mapVolumes(1000, { ntg: 1, phi: 0.2, sw: 0.25, bo: 0 }).stoiipSm3, 0);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
