// Field-review engine truth-lock (Fable). Validates the decline fit, the BLIND
// TEST (recovers a synthetic decline and predicts the held-out tail), the
// exponential EUR, and the FDP NPV sign logic (economic vs sub-economic).
// Run: node scripts/test-review.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const approx = (a, b, tol) => Math.abs(a - b) <= tol;
function check(name, ok, detail = '') { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); ok ? pass++ : fail++; }

console.log('\n=== field-review engine truth-lock ===');

if (existsSync(join(__dirname, '..', 'src', 'engine', 'review.ts'))) {
  const R = await import('../src/engine/review.ts');
  // synthetic exponential decline: q = 1000·e^(−0.03·t), 100 months
  const qi0 = 1000, Di0 = 0.03;
  const series = Array.from({ length: 100 }, (_, t) => qi0 * Math.exp(-Di0 * t));

  // 1 · fit recovers qi, Di
  {
    const f = R.fitExpDecline(series);
    check('fitExpDecline recovers qi', approx(f.qi, qi0, qi0 * 0.02), `qi=${f.qi.toFixed(1)}`);
    check('fitExpDecline recovers Di', approx(f.Di, Di0, Di0 * 0.02), `Di=${f.Di.toFixed(4)}`);
  }
  // 2 · blind test: train on 60%, predict the tail near-exactly (clean data)
  {
    const bt = R.blindTest(series, 0.6);
    check('blind test recovers Di from training window', approx(bt.Di, Di0, Di0 * 0.05), `Di=${bt.Di.toFixed(4)}`);
    check('blind test predicts held-out tail (MAPE < 2%)', bt.mapePct < 2, `MAPE=${bt.mapePct.toFixed(2)}%`);
    check('blind test RMSE small on clean decline', bt.rmsePct < 3, `RMSE=${bt.rmsePct.toFixed(2)}%`);
  }
  // 3 · noisy blind test still robust (±10% noise → MAPE modest, not blown up)
  {
    let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const noisy = series.map((q) => q * (1 + 0.1 * (rnd() - 0.5)));
    const bt = R.blindTest(noisy, 0.6);
    check('blind test robust to 10% noise (MAPE < 12%)', bt.mapePct < 12, `MAPE=${bt.mapePct.toFixed(2)}%`);
  }
  // 4 · exponential cumulative to economic limit
  {
    const eur = R.expCumToLimit(1000, 0.03, 50); // (1000−50)/0.03
    check('expCumToLimit = (qi−qEcon)/Di', approx(eur, (1000 - 50) / 0.03, 1e-6), `EUR=${eur.toFixed(0)}`);
    check('expCumToLimit 0 when qi ≤ qEcon', R.expCumToLimit(40, 0.03, 50) === 0);
  }
  // 5 · FDP economics: a fat-margin option is economic; a thin one is not
  {
    const rich = { oilPrice: 90, opexVar: 10, opexFixMM: 20, perWellCapexMM: 40, facilityReentryMM: 100, discount: 0.10, abandonMM: 30, years: 8 };
    const good = R.evaluateFdp({ name: 'rich', producers: 2, injectors: 1, incrRecoveryMMSm3: 6 }, rich);
    check('FDP: large reserves + cheap re-entry → positive NPV', good.npvMM > 0 && good.economic, `NPV=$${good.npvMM.toFixed(0)}MM`);

    const volveLike = { oilPrice: 70, opexVar: 14, opexFixMM: 45, perWellCapexMM: 80, facilityReentryMM: 700, discount: 0.10, abandonMM: 150, years: 7 };
    const infill = R.evaluateFdp({ name: '2 infill + 1 inj', producers: 2, injectors: 1, incrRecoveryMMSm3: 1.5 }, volveLike);
    check('FDP: small reserves + offshore re-entry → negative NPV', infill.npvMM < 0 && !infill.economic, `NPV=$${infill.npvMM.toFixed(0)}MM`);

    // verdict honest: all sub-economic → do not redevelop
    const opts = [infill, R.evaluateFdp({ name: '1 infill', producers: 1, injectors: 0, incrRecoveryMMSm3: 0.8 }, volveLike)];
    const v = R.fdpVerdict(opts, 12);
    check('FDP verdict is honest (sub-economic → redevelop=false)', v.redevelop === false && /Sub-economic/i.test(v.headline), v.headline.slice(0, 48));
  }
  // 6 · higher capex strictly lowers NPV (monotonic sanity)
  {
    const base = { oilPrice: 70, opexVar: 14, opexFixMM: 45, perWellCapexMM: 80, facilityReentryMM: 700, discount: 0.10, abandonMM: 150, years: 7 };
    const a = R.evaluateFdp({ name: 'a', producers: 1, injectors: 0, incrRecoveryMMSm3: 2 }, base);
    const b = R.evaluateFdp({ name: 'b', producers: 3, injectors: 2, incrRecoveryMMSm3: 2 }, base);
    check('FDP: more wells (more capex, same oil) → lower NPV', b.npvMM < a.npvMM, `a=$${a.npvMM.toFixed(0)} b=$${b.npvMM.toFixed(0)}`);
  }
} else {
  console.log('SKIP  review engine not built');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
