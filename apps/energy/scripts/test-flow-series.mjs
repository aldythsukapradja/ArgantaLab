// test-flow-series.mjs — the solution/free gas split, against the real Volve record.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildFlow, SM3_TO_BBL, SM3_GAS_TO_BOE,
} from '../src/tabs/fielddev/flow-series.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c, e = '') => { if (c) pass++; else { fail++; console.error(`  ✗ ${n}${e ? ` — ${e}` : ''}`); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ── the split ─────────────────────────────────────────────────────────────────
const one = buildFlow([{ ym: '2010-01', oil: 100, water: 50, wi: 0, gas: 14_800 }], 148);
ok('gas exactly at the solution GOR is ALL solution gas',
  one.points[0].solutionGas === 14_800 && one.points[0].freeGas === 0);

const free = buildFlow([{ ym: '2010-01', oil: 100, water: 0, wi: 0, gas: 20_000 }], 148);
ok('gas above the solution GOR yields free gas',
  free.points[0].solutionGas === 14_800 && free.points[0].freeGas === 5_200);

const under = buildFlow([{ ym: '2010-01', oil: 100, water: 0, wi: 0, gas: 5_000 }], 148);
ok('gas BELOW the solution GOR is never negative free gas',
  under.points[0].freeGas === 0 && under.points[0].solutionGas === 5_000,
  JSON.stringify([under.points[0].solutionGas, under.points[0].freeGas]));

const noRs = buildFlow([{ ym: '2010-01', oil: 100, water: 0, wi: 0, gas: 20_000 }], null);
ok('with no published Rs, NO gas is claimed as free — the safe direction',
  noRs.points[0].freeGas === 0 && noRs.points[0].solutionGas === 20_000);
ok('and the solution share is null, not 1', noRs.solutionGasShare === null);

// ── GOR ───────────────────────────────────────────────────────────────────────
ok('GOR is gas over oil', near(free.points[0].gor, 200, 1e-9));
ok('GOR with no oil is null, not zero',
  buildFlow([{ ym: 'x', oil: 0, water: 10, wi: 0, gas: 500 }], 148).points[0].gor === null);
ok('a month with no gas reports GOR 0, which is a real reading',
  buildFlow([{ ym: 'x', oil: 10, water: 0, wi: 0, gas: 0 }], 148).points[0].gor === 0);

// ── voidage ───────────────────────────────────────────────────────────────────
const v = buildFlow([{ ym: 'x', oil: 100, water: 100, wi: 200, gas: 0 }], 148);
ok('oil voidage is Bo·oil', near(v.points[0].oilV, 147, 1e-9));
ok('water voidage is Bw·water', near(v.points[0].waterV, 103, 1e-9));
ok('injection voidage is Bw·wi', near(v.points[0].injV, 206, 1e-9));
ok('free-gas voidage is zero while Bg is zero — computed, not assumed',
  buildFlow([{ ym: 'x', oil: 1, water: 0, wi: 0, gas: 1e6 }], 148).points[0].freeGasV === 0);
ok('a field publishing a Bg DOES get a free-gas band',
  buildFlow([{ ym: 'x', oil: 1, water: 0, wi: 0, gas: 1e6 }], 148, { Bo: 1.4, Bw: 1, Bg: 0.005 })
    .points[0].freeGasV > 0);

// ── missing / malformed input ─────────────────────────────────────────────────
const sparse = buildFlow([{ ym: 'x', oil: 10, water: null, wi: undefined, gas: null }], 148);
ok('missing components read as zero, not NaN',
  Number.isFinite(sparse.points[0].waterV) && sparse.points[0].gas === 0);
ok('an empty series does not throw', buildFlow([], 148).points.length === 0);
ok('scales never collapse to zero', buildFlow([], 148).maxProduced === 1);

// ── against the shipped field record ──────────────────────────────────────────
let prod = null, index = null;
try {
  prod = JSON.parse(readFileSync(join(root, 'public/wb/prod-field.json'), 'utf8'));
  index = JSON.parse(readFileSync(join(root, 'public/wb/index.json'), 'utf8'));
} catch { /* public/wb is generated and gitignored */ }

if (prod?.monthly && index) {
  const rs = index.pvt?.Rs ?? null;
  ok('the bundle publishes a solution GOR to split on', rs != null, String(rs));
  const f = buildFlow(prod.monthly, rs);
  ok('every month is carried through', f.points.length === prod.monthly.length);
  ok('cumulative oil matches a plain sum of the record',
    near(f.cumOil, prod.monthly.reduce((s, m) => s + (m.oil || 0), 0), 1e-6));
  ok('solution and free gas partition the produced gas exactly',
    near(f.points.reduce((s, p) => s + p.solutionGas + p.freeGas, 0), f.cumGas, 1e-6));
  // the fact the UI quotes: Volve's gas is overwhelmingly in solution
  ok('Volve gas is overwhelmingly solution gas',
    f.solutionGasShare > 0.9, `${(f.solutionGasShare * 100).toFixed(1)}%`);
  ok('so the free-gas band is a small minority, not a fat double-counted bar',
    (1 - f.solutionGasShare) < 0.1, `${((1 - f.solutionGasShare) * 100).toFixed(1)}%`);
  ok('gas scale is real', f.maxGas > 1);
}

// ── the SURFACE stack, in barrels ────────────────────────────────────────────
//
// This is the chart the dossier draws: oil → gas → water stacked up, injection
// mirrored down, all surface volumes. The failure it guards against is treating
// it as the voidage stack — where solution gas must be EXCLUDED, because those
// cubic metres are already inside Bo. Here the whole produced gas belongs, and
// getting that backwards would either double-count oil or hide the gas.
{
  const f = buildFlow([
    { ym: '2010-01', oil: 1000, water: 500, wi: 2000, gas: 160_000 },
  ], 160);
  const p = f.points[0];

  ok('oil converts at 6.2898 bbl/Sm³', near(p.oilB, 1000 * SM3_TO_BBL, 1e-6), String(p.oilB));
  ok('water converts the same way', near(p.waterB, 500 * SM3_TO_BBL, 1e-6));
  ok('injection converts the same way', near(p.injB, 2000 * SM3_TO_BBL, 1e-6));
  // 5,800 scf/boe — the same number RM's MSCF_PER_BOE = 5.8 expresses
  ok('gas converts at 5,800 scf/boe', near(p.gasB, 160_000 * SM3_GAS_TO_BOE, 1e-6), String(p.gasB));
  ok('the boe factor is the industry one', near(SM3_GAS_TO_BOE, 35.314666 / 5800, 1e-12));

  // THE distinction this module exists for
  ok('the surface stack carries the WHOLE produced gas, not just the free part',
    p.gasB > 0 && near(p.gasB, (p.solutionGas + p.freeGas) * SM3_GAS_TO_BOE, 1e-6));
  ok('this month is entirely solution gas, so the VOIDAGE band is zero',
    p.freeGas === 0 && p.freeGasV === 0);
  ok('…and yet the SURFACE gas bar is not — the two answer different questions',
    p.gasB > 0);

  ok('the produced maximum is the whole stack, so no bar overflows its half',
    near(f.maxProducedB, p.oilB + p.gasB + p.waterB, 1e-6));
  ok('the injected maximum is the injection bar', near(f.maxInjectedB, p.injB, 1e-6));
}
{
  // gas with no oil is all free gas, and must still stack
  const f = buildFlow([{ ym: '2010-01', oil: 0, water: 0, wi: 0, gas: 50_000 }], 160);
  ok('gas with no oil is entirely free', f.points[0].freeGas === 50_000);
  ok('and still lands in the surface bar', near(f.points[0].gasB, 50_000 * SM3_GAS_TO_BOE, 1e-6));
  ok('no oil means no GOR rather than a zero that reads as dry oil',
    f.points[0].gor === null);
}
{
  const f = buildFlow([{ ym: '2010-01', oil: 100, water: 0, wi: 0 }], 160);
  ok('a month with no gas record contributes no gas bar', f.points[0].gasB === 0);
  ok('and the stack is still the oil', near(f.maxProducedB, 100 * SM3_TO_BBL, 1e-6));
}
{
  const f = buildFlow([], 160);
  ok('an empty series gives non-zero maxima rather than dividing by zero',
    f.maxProducedB === 1 && f.maxInjectedB === 1);
}

console.log(`flow-series: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
