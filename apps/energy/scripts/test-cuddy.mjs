// Cuddy saturation-height function truth-lock.
//
// The point of Cuddy over a Leverett J is that it needs no permeability. The tests
// below therefore check two things above all: that it round-trips its own constants
// exactly, and that it still puts MORE water in a tighter cell at the same height —
// because the one piece of rock quality it does keep is porosity, and a function that
// lost that too would be a constant with extra steps.
// Run: node scripts/test-cuddy.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const eq = (n, got, want) => check(n, Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (n, got, want, tol) => check(n, Math.abs(got - want) <= tol, `got ${got}, want ${want} ±${tol}`);

const mod = join(__dirname, '..', 'src', 'tabs', 'fielddev', 'fluid-model.ts');
if (!existsSync(mod)) { console.log('SKIP — fluid-model.ts absent'); process.exit(0); }
const { fitCuddy, cuddySw } = await import('../src/tabs/fielddev/fluid-model.ts');

// ── round-trip: a fit must recover the law it was generated from ────────────
{
  const A = 0.035, B = -0.45;
  const samples = [];
  for (let h = 5; h <= 250; h += 2.5) {
    for (const phi of [0.12, 0.18, 0.24, 0.30]) {
      const sw = Math.min(1, (A * h ** B) / phi);
      samples.push({ h, sw, phi });
    }
  }
  const fit = fitCuddy(samples);
  check('a fit is produced', !!fit, '');
  near('…recovering a', fit.a, A, 0.004);
  near('…and b', fit.b, B, 0.03);
  check('…with a high r² on noise-free data', fit.r2 > 0.95, `${fit.r2.toFixed(3)}`);
  check('…and it records the height range it is valid over',
    fit.hMin === 5 && fit.hMax === 250, `${fit.hMin}..${fit.hMax}`);
  eq('…and how many samples it rests on', fit.n, samples.filter((s) => s.sw > 0 && s.sw <= 1).length);
}

// ── the physics it must express ─────────────────────────────────────────────
{
  // Realistic constants: bulk volume water in a producing sand runs roughly 0.02–0.10,
  // so BVW(100 m) ≈ 0.038 here. Picking constants that put BVW at 0.004 would drive
  // every cell onto the Swirr floor and the comparisons below would all read equal —
  // which is exactly what a clamped function looks like when it is working.
  const c = { a: 0.15, b: -0.3 };

  // saturation falls as you climb away from the free-water level
  const high = cuddySw(200, 0.22, c), low = cuddySw(10, 0.22, c);
  check('…and BVW sits in a physical range at mid-column', Math.abs(cuddySw(100, 0.22, c) * 0.22 - 0.038) < 0.01, `${(cuddySw(100, 0.22, c) * 0.22).toFixed(4)}`);
  check('Sw falls with height above the free-water level', high < low, `${high.toFixed(3)} at 200 m vs ${low.toFixed(3)} at 10 m`);

  // THE piece of rock quality Cuddy keeps: equal bulk volume of water means the
  // tighter rock is proportionally wetter
  const tight = cuddySw(100, 0.10, c), good = cuddySw(100, 0.28, c);
  check('at the same height, TIGHTER rock holds more water', tight > good,
    `φ 0.10 → ${tight.toFixed(3)} vs φ 0.28 → ${good.toFixed(3)}`);
  near('…in exact inverse proportion to porosity, because BVW is what is constant',
    tight / good, 0.28 / 0.10, 0.01);

  // below and at the free-water level there is no transition to describe
  eq('at the free-water level the rock is fully water-bearing', cuddySw(0, 0.25, c), 1);
  eq('below it too', cuddySw(-50, 0.25, c), 1);

  // the raw law is unbounded as φ falls — a saturation above 1 is not a saturation
  eq('a very tight cell is clamped to 1 rather than exceeding it', cuddySw(1, 0.001, c), 1);
  const swirr = 0.08;
  eq('and a very good cell high in the column is floored at Swirr',
    cuddySw(1e6, 0.35, c, swirr), swirr);
  check('zero porosity cannot hold hydrocarbon', cuddySw(100, 0, c) === 1, '');
}

// ── the fit must refuse rather than fabricate ───────────────────────────────
{
  const c = { a: 0.035, b: -0.45 };
  eq('too few samples returns null, not a two-point line through noise',
    fitCuddy([{ h: 10, sw: 0.3, phi: 0.2 }, { h: 100, sw: 0.15, phi: 0.2 }]), null);

  // a single zero would take a log–log regression with it
  const withZeros = [];
  for (let h = 5; h <= 200; h += 5) withZeros.push({ h, sw: (c.a * h ** c.b) / 0.2, phi: 0.2 });
  withZeros.push({ h: 0, sw: 1, phi: 0.2 }, { h: 50, sw: 0, phi: 0.2 }, { h: 50, sw: 0.3, phi: 0 });
  const fit = fitCuddy(withZeros, 10);
  check('zero and negative heights, saturations and porosities are screened out', !!fit, '');
  near('…and the surviving fit is still the right law', fit.a, c.a, 0.005);
  eq('…with the bad samples excluded from the count', fit.n, withZeros.length - 3);

  eq('samples at a single height cannot define a slope',
    fitCuddy(Array.from({ length: 40 }, () => ({ h: 50, sw: 0.3, phi: 0.2 })), 10), null);
  eq('an Sw above one is not a saturation and is rejected',
    fitCuddy(Array.from({ length: 40 }, (_, i) => ({ h: 10 + i, sw: 1.4, phi: 0.2 })), 10), null);
}

// ── it must survive real, scattered data ───────────────────────────────────
{
  // deterministic pseudo-noise, so the test cannot flake
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const A = 0.04, B = -0.5, samples = [];
  for (let i = 0; i < 800; i++) {
    const h = 3 + rnd() * 240;
    const phi = 0.08 + rnd() * 0.25;
    const swTrue = Math.min(1, (A * h ** B) / phi);
    samples.push({ h, sw: Math.max(0.01, Math.min(1, swTrue * (0.75 + rnd() * 0.5))), phi });
  }
  const fit = fitCuddy(samples);
  check('a fit survives ±25% scatter', !!fit, '');
  near('…recovering a to within a fifth', fit.a, A, A * 0.2);
  near('…and b to within 0.1', fit.b, B, 0.1);
  check('…and reports an r² that reflects the scatter rather than hiding it',
    fit.r2 > 0.3 && fit.r2 < 0.99, `${fit.r2.toFixed(3)}`);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
