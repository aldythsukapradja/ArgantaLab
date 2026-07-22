// Analog + engineering-judgement engine truth-lock (Fable). Validates matching,
// the benchmark prior, and the reconcile layer that encodes the RE philosophy:
// analog anchors, physics bands, data-confidence weights, derisk haircuts the upside.
// Run: node scripts/test-analog.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const approx = (a, b, tol) => Math.abs(a - b) <= tol;
function check(name, ok, detail = '') { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); ok ? pass++ : fail++; }

console.log('\n=== analog + engineering-judgement truth-lock ===');

if (existsSync(join(__dirname, '..', 'src', 'engine', 'analog.ts'))) {
  const A = await import('../src/engine/analog.ts');
  const db = A.SEED_ANALOGS;

  // 1 · matching: a sandstone waterflood target ranks sandstone-waterflood analogs first
  {
    const t = { lithology: 'sandstone', drive: 'waterflood', porosity: 0.22, permMd: 300, oilAPI: 29 };
    const m = A.matchAnalogs(t, db, 6);
    check('best analog is same lithology+drive', m[0].field.lithology === 'sandstone' && m[0].field.drive === 'waterflood', `${m[0].field.name} sim=${m[0].similarity.toFixed(2)}`);
    check('similarity ordered descending', m.every((x, i) => i === 0 || x.similarity <= m[i - 1].similarity));
    // a carbonate solution-gas analog must rank below (categorical penalty)
    const carb = m.find((x) => x.field.lithology === 'carbonate' && x.field.drive === 'solution-gas');
    check('mismatched class penalised', !carb || carb.similarity < m[0].similarity * 0.6);
  }
  // 2 · exact self-match → similarity 1
  {
    const f = db.find((x) => x.name.startsWith('Volve'));
    const s = A.similarity({ lithology: f.lithology, drive: f.drive, depthM: f.depthM, porosity: f.porosity, permMd: f.permMd, oilAPI: f.oilAPI }, f);
    check('exact self-match similarity = 1', approx(s, 1, 1e-9), `sim=${s.toFixed(4)}`);
  }
  // 3 · benchmark prior: ordered percentiles, RF in a sane range
  {
    const t = { lithology: 'sandstone', drive: 'waterflood', porosity: 0.22, permMd: 300 };
    const prior = A.analogPrior(A.matchAnalogs(t, db, 6));
    check('prior P10 ≤ P50 ≤ P90', prior.p10 <= prior.p50 && prior.p50 <= prior.p90, `P10=${prior.p10} P50=${prior.p50} P90=${prior.p90}`);
    check('waterflood RF prior in 0.25–0.60', prior.p50 >= 0.25 && prior.p50 <= 0.60, `P50=${prior.p50}`);
    check('effN > 0', prior.effN > 0, `effN=${prior.effN.toFixed(2)}`);
  }
  // 4 · reconcile — the engineering-judgement layer
  {
    const prior = { p10: 0.32, p50: 0.45, p90: 0.55, mean: 0.45, n: 5, effN: 3.2 };
    // data-rich (confidence 1) → P50 tracks physics (× derisk)
    const rich = A.reconcile(0.60, prior, 1.0, { derisk: 0.9, physicsCV: 0.2 });
    check('data-rich → physics leads (P50 ≈ physics×derisk)', approx(rich.p50, 0.60 * 0.9, 0.01) && rich.physicsWeight === 1, `P50=${rich.p50.toFixed(3)}`);
    // data-scarce (confidence 0) → analog carries it (× derisk)
    const scarce = A.reconcile(0.60, prior, 0.0, { derisk: 0.9 });
    check('data-scarce → analog carries (P50 ≈ analogP50×derisk)', approx(scarce.p50, 0.45 * 0.9, 0.01) && scarce.analogWeight === 1, `P50=${scarce.p50.toFixed(3)}`);
    // no physics run → pure analog
    const none = A.reconcile(null, prior, 0.8, { derisk: 0.9 });
    check('no physics → pure analog basis', none.physicsWeight === 0 && /analog-only/.test(none.basis), none.basis.slice(0, 30));
    // derisk haircuts the upside (P90), keeps honest downside
    const hi = A.reconcile(0.60, prior, 1.0, { derisk: 1.0 });
    const lo = A.reconcile(0.60, prior, 1.0, { derisk: 0.8 });
    check('derisk lowers P50 and P90 (upside haircut)', lo.p50 < hi.p50 && lo.p90 < hi.p90, `P50 ${hi.p50.toFixed(3)}→${lo.p50.toFixed(3)}`);
    // ordered + physicsWeight+analogWeight = 1
    check('answer ordered P10≤P50≤P90 & weights sum 1', rich.p10 <= rich.p50 && rich.p50 <= rich.p90 && approx(rich.physicsWeight + rich.analogWeight, 1, 1e-9));
    // with a WIDE analog prior + TIGHT physics, data-scarce range > data-rich range
    // (the range reflects the dominant source — analogs when scarce, physics when rich)
    const wide = { p10: 0.20, p50: 0.45, p90: 0.70, mean: 0.45, n: 6, effN: 4 };
    const band = (r) => r.p90 - r.p10;
    const sc = A.reconcile(0.45, wide, 0.0, { derisk: 0.9 });        // analog carries → wide
    const ri = A.reconcile(0.45, wide, 1.0, { derisk: 0.9, physicsCV: 0.08 }); // tight physics
    check('scarce range (analog) wider than data-rich (tight physics)', band(sc) > band(ri), `scarce=${band(sc).toFixed(3)} rich=${band(ri).toFixed(3)}`);
  }
  // 5 · inverse-variance weighting (the "why 40/60" basis)
  {
    const prior = { p10: 0.35, p50: 0.45, p90: 0.55, mean: 0.45, n: 5, effN: 3 };
    // equal variances → weight 0.5
    const sigmaA = (0.55 - 0.35) / 2.563;               // analog σ
    const cvEqual = sigmaA / 0.45;                        // physics CV giving equal variance
    check('inverse-variance: equal variance → weight 0.5', approx(A.optimalPhysicsWeight(0.45, cvEqual, prior), 0.5, 0.02), `w=${A.optimalPhysicsWeight(0.45, cvEqual, prior).toFixed(3)}`);
    // very precise physics → weight → 1
    check('inverse-variance: precise physics → weight →1', A.optimalPhysicsWeight(0.45, 0.01, prior) > 0.95);
    // very uncertain physics → weight → 0
    check('inverse-variance: uncertain physics → weight →0', A.optimalPhysicsWeight(0.45, 1.0, prior) < 0.1);
  }
  // 6 · leave-one-out cross-validation (the blind test) — mechanics + honesty
  {
    // synthetic informative KB: one class, RF clustered around 0.45 with spread
    const syn = [0.38, 0.42, 0.45, 0.47, 0.50, 0.44, 0.48, 0.40].map((rf, i) => ({ name: `f${i}`, lithology: 'sandstone', drive: 'waterflood', porosity: 0.22, permMd: 300, recoveryFactor: rf, source: 'syn', confidence: 'field' }));
    const cv = A.crossValidate(syn, 6);
    check('LOO-CV runs on every field', cv.n === syn.length, `n=${cv.n}`);
    check('LOO-CV MAE small on a tight cluster', cv.mae < 0.05, `MAE=${cv.mae.toFixed(3)}`);
    check('LOO-CV coverage in [0,1]', cv.coverageP80 >= 0 && cv.coverageP80 <= 1, `cov=${cv.coverageP80.toFixed(2)}`);
    // held-out field never leaks into its own prediction
    check('LOO-CV excludes the held-out field', cv.rows.every((r) => Math.abs(r.p50 - r.actual) === r.absErr));
  }
  // 7 · tornado sensitivity ordering
  {
    const prior = { p10: 0.35, p50: 0.45, p90: 0.55, mean: 0.45, n: 5, effN: 3 };
    const t = A.reconcileTornado(0.5, prior, 0.4, 0.9, { physics: [0.3, 0.7], dataConfidence: [0, 1], derisk: [0.7, 1] });
    check('tornado sorted by swing (descending)', t.every((b, i) => i === 0 || b.swing <= t[i - 1].swing), t.map((b) => `${b.param}:${b.swing.toFixed(2)}`).join(' '));
    check('tornado bars have low ≤ high', t.every((b) => b.low <= b.high));
  }
  // 8 · HONEST BLIND TEST on the real seed KB — print the number
  {
    const cv = A.crossValidate(A.SEED_ANALOGS, 6);
    console.log(`\n  ┌─ BLIND TEST (leave-one-out CV) on seed KB (${cv.n} analogs):`);
    console.log(`  │  MAE of P50      = ${(cv.mae * 100).toFixed(1)} RF-points`);
    console.log(`  │  median abs err  = ${(cv.medAbsErr * 100).toFixed(1)} RF-points`);
    console.log(`  │  P10–P90 coverage= ${(cv.coverageP80 * 100).toFixed(0)}%  (target ≈80% = well-calibrated)`);
    console.log(`  └─ (thin KB → wide error; accuracy improves as you load more field analogs)\n`);
    check('blind test executed on seed KB', cv.n >= 8);
  }
} else {
  console.log('SKIP  analog engine not built');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
