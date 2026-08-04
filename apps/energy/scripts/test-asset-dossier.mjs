// Asset Dossier truth-lock — the derivation layer behind the Field Development
// Knowledge Bank. Locks the GROUNDING RULES from the concept doc, not just the maths:
//   · a missing date stays null (never interpolated, never dropped)
//   · "not reported" is never coalesced to 0 (excluded from totals AND raised as a gap)
//   · reserves are filed reserves; gas converts through a checked 5800 scf/boe factor
// Run: node scripts/test-asset-dossier.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

if (!existsSync(join(__dirname, '..', 'src', 'tabs', 'fielddev', 'asset-dossier.ts'))) { console.log('SKIP'); process.exit(0); }
const M = await import('../src/tabs/fielddev/asset-dossier.ts');
const {
  asYear, buildLifecycle, buildReserves, buildProduction, remainingMMBOE, buildMix,
  buildReservoirVerdict, buildReadiness, buildBenchmark, buildAssetDossier,
  observationMMBOE, MMM3_GAS_TO_MMBOE, STAGE_PROGRESS,
} = M;

// ── year parsing ──────────────────────────────────────────────────────────────
check('asYear: number passthrough', asYear(1993) === 1993);
check('asYear: string', asYear('1993') === 1993);
check('asYear: blank → null', asYear('') === null && asYear(null) === null && asYear(undefined) === null);
check('asYear: junk → null', asYear('n/a') === null);
check('asYear: out of range → null', asYear(1200) === null && asYear(3000) === null);

// ── unit conversion ───────────────────────────────────────────────────────────
const obs = (o) => ({ product: 'Oil', year: 2020, classification: '2P', value: null, unit: null, valueConverted: null, unitConverted: null, ...o });
check('liquids: million bbl → MMBOE 1:1', observationMMBOE(obs({ valueConverted: 63, unitConverted: 'million bbl' })) === 63);
check('gas: million m³ → MMBOE factor', near(MMM3_GAS_TO_MMBOE, 35.314666 / 5800, 1e-9),
  `${MMM3_GAS_TO_MMBOE.toFixed(6)} MMBOE per million m³`);
check('gas: 40,500 million m³ ≈ 247 MMBOE',
  near(observationMMBOE(obs({ product: 'Gas', valueConverted: 40500, unitConverted: 'million m³' })), 40500 * MMM3_GAS_TO_MMBOE, 1e-9),
  `${(40500 * MMM3_GAS_TO_MMBOE).toFixed(1)} MMBOE`);
check('unknown unit → null (not 0)', observationMMBOE(obs({ valueConverted: 5, unitConverted: 'barrels of stuff' })) === null);
check('null value → null (not 0)', observationMMBOE(obs({ valueConverted: null, unitConverted: 'million bbl' })) === null);

// ── lifecycle ─────────────────────────────────────────────────────────────────
const VOLVE = {
  fuelType: 'Oil', onshoreOffshore: 'Offshore', productionType: null, status: 'Producing', statusDetail: null,
  discoveryYear: 1993, fidYear: 2005, productionStartYear: 2008,
  operator: 'Equinor', owners: null, block: '15/9', basin: 'Viking Graben',
  reserves: [obs({ product: 'Oil', valueConverted: 63, unitConverted: 'million bbl', year: 2016 })],
  production: [
    { product: 'Oil', year: 2014, classification: null, value: null, unit: null, valueConverted: 6, unitConverted: 'million bbl' },
    { product: 'Oil', year: 2015, classification: null, value: null, unit: null, valueConverted: 9, unitConverted: 'million bbl' },
    { product: 'Oil', year: 2016, classification: null, value: null, unit: null, valueConverted: 4, unitConverted: 'million bbl' },
  ],
};
const lc = buildLifecycle(VOLVE, 2016);
check('lifecycle: 3 milestones always present', lc.milestones.length === 3);
check('lifecycle: appraisal 1993→2005 = 12 yr', lc.appraisalYears === 12);
check('lifecycle: development 2005→2008 = 3 yr', lc.developmentYears === 3);
check('lifecycle: cycle time 1993→2008 = 15 yr', lc.cycleTimeYears === 15);
check('lifecycle: stage producing', lc.stage === 'producing', lc.stage);

// GROUNDING: a missing date must stay null and must NOT be interpolated from neighbours
const noFid = buildLifecycle({ ...VOLVE, fidYear: null }, 2016);
check('GROUNDING missing FID: milestone kept, year null', noFid.milestones[1].year === null && noFid.milestones.length === 3);
check('GROUNDING missing FID: no interpolation', noFid.appraisalYears === null && noFid.developmentYears === null);
check('GROUNDING missing FID: cycle time still derivable', noFid.cycleTimeYears === 15);

// stage inference from dates when status is vague/absent
check('stage: start-up year ⇒ producing even w/o status',
  buildLifecycle({ ...VOLVE, status: null }, 2016).stage === 'producing');
check('stage: FID only ⇒ sanctioned',
  buildLifecycle({ ...VOLVE, status: null, productionStartYear: null }, 2016).stage === 'sanctioned');
check('stage: discovery only ⇒ discovered',
  buildLifecycle({ ...VOLVE, status: null, fidYear: null, productionStartYear: null }, 2016).stage === 'discovered');
check('stage: nothing ⇒ unknown',
  buildLifecycle({ ...VOLVE, status: null, discoveryYear: null, fidYear: null, productionStartYear: null }, 2016).stage === 'unknown');
check('stage: ceased status wins', buildLifecycle({ ...VOLVE, status: 'Ceased production' }, 2016).stage === 'ceased');
check('stage: 25+ yr producing ⇒ late-life', buildLifecycle(VOLVE, 2040).stage === 'late-life');
check('stage: null record ⇒ unknown', buildLifecycle(null, 2016).stage === 'unknown');
check('STAGE_PROGRESS monotonic', STAGE_PROGRESS.discovered < STAGE_PROGRESS.sanctioned
  && STAGE_PROGRESS.sanctioned < STAGE_PROGRESS.producing && STAGE_PROGRESS.producing < STAGE_PROGRESS.ceased);

// ── reserves ──────────────────────────────────────────────────────────────────
const res = buildReserves(VOLVE);
check('reserves: oil total', res.oilMMstb === 63);
check('reserves: gas null when none filed (not 0)', res.gasMMBOE === null);
check('reserves: total = 63', res.totalMMBOE === 63);

// GROUNDING: an unconvertible row must be excluded from the total AND counted
const mixed = buildReserves({ ...VOLVE, reserves: [
  obs({ product: 'Oil', valueConverted: 63, unitConverted: 'million bbl' }),
  obs({ product: 'Gas', valueConverted: 1000, unitConverted: 'million m³' }),
  obs({ product: 'Oil', valueConverted: null, unitConverted: null, value: 12, unit: 'weird' }),
] });
check('GROUNDING unconvertible row excluded from total',
  near(mixed.totalMMBOE, 63 + 1000 * MMM3_GAS_TO_MMBOE, 1e-9), `${mixed.totalMMBOE.toFixed(2)} MMBOE`);
check('GROUNDING unconvertible row counted, not dropped', mixed.unreported === 1 && mixed.lines.length === 3);
check('reserves: gas split kept separate', near(mixed.gasMMBOE, 1000 * MMM3_GAS_TO_MMBOE, 1e-9));
check('reserves: empty record ⇒ all null (never 0)', (() => {
  const r = buildReserves({ ...VOLVE, reserves: [] });
  return r.totalMMBOE === null && r.oilMMstb === null && r.gasMMBOE === null;
})());

// ── production ────────────────────────────────────────────────────────────────
const prod = buildProduction(VOLVE);
check('production: 3 years, sorted', prod.series.length === 3 && prod.series[0].year === 2014 && prod.series[2].year === 2016);
check('production: cumulative 19', prod.cumulativeMMBOE === 19);
check('production: peak 2015 @ 9', prod.peak.year === 2015 && prod.peak.mmboe === 9);
check('production: latest 2016', prod.latest.year === 2016);
check('production: decline from peak 4/9', near(prod.declineFromPeak, 4 / 9));
check('production: same-year rows summed', (() => {
  const p = buildProduction({ ...VOLVE, production: [
    { product: 'Oil', year: 2015, classification: null, value: null, unit: null, valueConverted: 5, unitConverted: 'million bbl' },
    { product: 'Gas', year: 2015, classification: null, value: null, unit: null, valueConverted: 1000, unitConverted: 'million m³' },
  ] });
  return p.series.length === 1 && near(p.series[0].mmboe, 5 + 1000 * MMM3_GAS_TO_MMBOE, 1e-9);
})());
check('production: none ⇒ nulls (never 0)', (() => {
  const p = buildProduction({ ...VOLVE, production: [] });
  return p.cumulativeMMBOE === null && p.peak === null && p.declineFromPeak === null;
})());

// ── remaining ─────────────────────────────────────────────────────────────────
check('remaining: 63 − 19 = 44', remainingMMBOE(res, prod) === 44);
check('GROUNDING remaining: unknown reserves ⇒ null, not a number',
  remainingMMBOE(buildReserves({ ...VOLVE, reserves: [] }), prod) === null);
check('remaining: no production ⇒ full reserves',
  remainingMMBOE(res, buildProduction({ ...VOLVE, production: [] })) === 63);
check('remaining: never negative', remainingMMBOE(buildReserves({ ...VOLVE, reserves: [obs({ valueConverted: 5, unitConverted: 'million bbl' })] }), prod) === 0);

// ── mix ───────────────────────────────────────────────────────────────────────
check('mix: liquids only ⇒ 1 slice', buildMix(res).length === 1);
check('mix: oil+gas ⇒ 2 slices', buildMix(mixed).length === 2);
check('mix: nothing filed ⇒ empty (no fake slice)', buildMix(buildReserves({ ...VOLVE, reserves: [] })).length === 0);

// ── reservoir verdict ─────────────────────────────────────────────────────────
const rvFull = buildReservoirVerdict(VOLVE, { lithology: 'Sandstone', drive: 'waterflood', formation: 'Hugin' });
check('reservoir: full description ⇒ good', rvFull.tone === 'good');
check('reservoir: nothing ⇒ unknown, honest text',
  buildReservoirVerdict(VOLVE, null).tone === 'unknown'
  && buildReservoirVerdict(VOLVE, null).detail.includes('no described reservoir'));

// ── readiness ledger ──────────────────────────────────────────────────────────
const fullGaps = buildReadiness(VOLVE, lc, res, prod, rvFull);
check('readiness: well-described field ⇒ few gaps', fullGaps.length <= 1, `${fullGaps.length} gaps`);
const bare = { ...VOLVE, discoveryYear: null, fidYear: null, productionStartYear: null, operator: null, reserves: [], production: [] };
const bareLc = buildLifecycle(bare, 2026), bareRes = buildReserves(bare), bareProd = buildProduction(bare);
const bareGaps = buildReadiness(bare, bareLc, bareRes, bareProd, buildReservoirVerdict(bare, null));
check('readiness: bare field ⇒ full work programme', bareGaps.length >= 7, `${bareGaps.length} gaps`);
check('readiness: null record ⇒ single honest gap', buildReadiness(null, bareLc, bareRes, bareProd, buildReservoirVerdict(null, null)).length === 1);
check('GROUNDING readiness raises the unconvertible row',
  buildReadiness({ ...VOLVE, reserves: mixed.lines }, lc, mixed, prod, rvFull).some((g) => /unconvertible/.test(g.what)));

// ── benchmark ─────────────────────────────────────────────────────────────────
const bm = buildBenchmark('waterflood', res, prod);
check('benchmark: waterflood class matched', bm.basis === 'class-prior' && /Waterflood/.test(bm.className));
check('benchmark: band ordered low<mid<high', bm.bandLow < bm.bandMid && bm.bandMid < bm.bandHigh);
check('benchmark: produced fraction 19/63', near(bm.observedRF, 19 / 63));
const bmNone = buildBenchmark(null, res, prod);
check('benchmark: no drive ⇒ basis none + honest note', bmNone.basis === 'none' && /not a match/.test(bmNone.note));
check('benchmark: never claims a named peer', !/peer/i.test(bm.note) || /not a named peer/.test(bm.note));
check('benchmark: no reserves ⇒ observed null (no divide-by-unknown)',
  buildBenchmark('waterflood', buildReserves({ ...VOLVE, reserves: [] }), prod).observedRF === null);

// ── assembled dossier ─────────────────────────────────────────────────────────
const ad = buildAssetDossier(VOLVE, { lithology: 'Sandstone', drive: 'waterflood', formation: 'Hugin' }, 2016);
check('dossier: assembles every section', Boolean(ad.lifecycle && ad.reserves && ad.production && ad.reservoir && ad.benchmark) && Array.isArray(ad.gaps));
check('dossier: remaining consistent with parts', ad.remaining === 44);
check('dossier: null record does not throw', (() => {
  try { const z = buildAssetDossier(null, null, 2026); return z.lifecycle.stage === 'unknown' && z.gaps.length === 1; }
  catch { return false; }
})());

// ── bundle well-role split, against the real Volve wb bundle ──────────────────
// producer / injector counts feed the Data availability tile directly — this is
// the one place role gets COUNTED, so a silent miscount would show up as a wrong
// number on screen with no test ever catching it.
{
  const WB = join(__dirname, '..', 'public', 'wb');
  if (!existsSync(join(WB, 'index.json'))) {
    console.log('SKIP well-role split — run `npm run data:wb` first');
  } else {
    const { readBundle } = await import('../src/tabs/fielddev/field-record.ts');
    const { readFileSync } = await import('node:fs');
    const index = JSON.parse(readFileSync(join(WB, 'index.json'), 'utf8'));
    const prod = JSON.parse(readFileSync(join(WB, 'prod-field.json'), 'utf8'));
    const b = readBundle(index, prod);

    check('real Volve bundle resolves', Boolean(b));
    check('every wellbore is counted exactly once',
      b.producers + b.injectors + b.nonFlowing + b.roleUnknown === b.wells,
      `${b.producers}P + ${b.injectors}I + ${b.nonFlowing}nonflow + ${b.roleUnknown}? = ${b.producers + b.injectors + b.nonFlowing + b.roleUnknown} of ${b.wells}`);
    // Volve's real vocabulary is granular ("oil-producer", "water-injector",
    // "water-supply", "appraisal", "exploration", "observation", "none") — pins the
    // actual counts so a reclassification of the matching rule is caught, not silent.
    // 6 oil producers is the PUBLISHED Sodir figure; a water-supply well must never
    // be counted here or the producer count inflates by 50%.
    check('Volve producer count = 6 published oil producers', b.producers === 6, `${b.producers}`);
    check('Volve injector count (water-injector)', b.injectors === 3, `${b.injectors}`);
    check('Volve non-flowing count (appraisal + exploration + observation + water-supply)', b.nonFlowing === 14, `${b.nonFlowing}`);
    check('Volve role-unrecorded count ("none")', b.roleUnknown === 4, `${b.roleUnknown}`);
    check('role counts are non-negative integers',
      [b.producers, b.injectors, b.nonFlowing, b.roleUnknown].every((n) => Number.isInteger(n) && n >= 0));

    // an unmatched role string must still be COUNTED — by subtraction, not by hoping
    // every real-world spelling is in the regex
    const synthetic = readBundle({
      wells: [{ role: 'oil-producer' }, { role: 'water-injector' }, { role: 'appraisal' }, {}, { role: 'some-future-spelling' }],
    }, null);
    check('an unmatched role string is counted as unknown, not dropped or defaulted',
      synthetic.producers === 1 && synthetic.injectors === 1 && synthetic.nonFlowing === 1 && synthetic.roleUnknown === 2,
      `${synthetic.producers}P / ${synthetic.injectors}I / ${synthetic.nonFlowing}nonflow / ${synthetic.roleUnknown}?`);
    check('matching is by substring, so "OIL_PRODUCER" style spellings still resolve',
      readBundle({ wells: [{ role: 'OIL_PRODUCER' }] }, null).producers === 1);
  }
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
