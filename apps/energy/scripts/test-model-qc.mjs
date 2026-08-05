// model-qc.ts truth-lock — the static model QC gate.
//
// Three things carry this module and each gets its own block below:
//   1. `absent` and `n/a` are never `pass`, and never let the model through;
//   2. the consistency section must FAIL on definitions that disagree between
//      disciplines, even when every individual discipline's own check passes;
//   3. Standing's correlation must convert Rs from Sm³/Sm³ to scf/stb — getting that
//      wrong invents a 30% PVT fault in a perfectly sound deck.
// Run: node scripts/test-model-qc.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const eq = (n, got, want) => check(n, Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (n, got, want, tol) => check(n, Math.abs(got - want) <= tol, `got ${got}, want ${want} ±${tol}`);

const mod = join(__dirname, '..', 'src', 'tabs', 'fielddev', 'model-qc.ts');
if (!existsSync(mod)) { console.log('SKIP — model-qc.ts absent'); process.exit(0); }
const { auditModel, summariseModelQc, standingBoFromSi: standingBo, apiGravity } = await import('../src/tabs/fielddev/model-qc.ts');

/** A model with nothing wrong anywhere. */
const clean = () => ({
  data: {
    wellsTotal: 24, wellsWithLogs: 24, wellsWithSurvey: 24, wellsUpscaled: 20,
    producers: 6, producersUpscaled: 6, injectors: 3, injectorsUpscaled: 3,
    depthUnits: [['m', 24]], logSamples: 175000,
    curveCoverage: [{ family: 'GR', wells: 24 }, { family: 'RHOB', wells: 22 }, { family: 'RT', wells: 20 }],
    conditionedColumnFraction: 0.08, crs: 'ED50 / UTM 31N',
    datum: { n: 52, meanAbsErrM: 0.84, kbApplied: true },
  },
  geometry: {
    nx: 190, ny: 143, nz: 50, cells: 1358500, activeCells: 768350, liveCells: 768350,
    negativeCells: 0, zeroCells: 0, pinchCells: 0, highAspectCells: 0,
    stackingDefects: 0, orderDefects: 0, bodies: 1,
    repairedColumns: 0, repairAddedFraction: 0, unfaulted: false,
  },
  facies: {
    count: 3, conditioningCells: 347, conditioningSandFraction: 0.827,
    realisationSandFraction: 0.806, unconditionedLayers: 0,
    simulatedLayers: 10, totalLayers: 50, simNodes: 190, modelNx: 190,
  },
  petrophysics: {
    logPhiMean: 0.124, netPhiMean: 0.232, upscaledPhiMean: 0.228, simulatedPhiMean: 0.225,
    phiMin: 0.002, phiMax: 0.326, netFraction: 0.288, ntgUsed: 0.288,
    ntgSource: 'net-cutoff', publishedPhi: 0.225, publishedNtg: 0.9,
    archieSource: 'published', archie: { a: 1, m: 1.795, n: 2.45, rw: 0.0221 },
    archieProvenance: 'Statoil doc 3781-06',
  },
  permeability: {
    fitted: true, geoMeanMd: 120, arithMeanMd: 540, maxMd: 8000,
    cappedCells: 0, simulatedCells: 153670, ceilingMd: 20000,
    kvkh: 0.1, kvkhSource: 'measured', upscaleAverage: 'geometric', hasPermZ: true,
  },
  pvt: {
    bo: 1.47, rs: 148, pb: 256, pi: 337, tempC: 110, datumTvdss: 3060,
    oilDensityKgM3: 882, gasDensityKgM3: 1.09956, waterDensityKgM3: 1101.3,
    rockCf: 0.00002, rockPrefBara: 329, source: 'VOLVE_2016.PRT deck PVTO',
  },
  saturation: {
    modelled: true, shfPresent: true, shfWiredToGrid: true, shfSource: 'lab study',
    scalPresent: true, scalSource: 'fluid-model.ts', constantUsed: undefined,
    netSwMean: 0.256, logSwMean: 0.834, swCutoff: 0.6,
    contactTvdss: 3065, crestTvdss: 2805, publishedSw: 0.2,
  },
  volumes: { stoiipMMSm3: 18.0, officialMMSm3: 18.7, gridVsMapRelDiff: 0.03 },
});
const find = (items, id) => items.find((i) => i.id === id);

// ══ Standing's correlation and its units trap ═══════════════════════════════
{
  // Volve: Rs 148 Sm³/Sm³ = 831 scf/stb, 28.8 °API, 110 °C. A saturated Bo near 1.5
  // is the right answer; treating Rs as if it were already scf/stb gives ~1.16 and
  // would make a sound deck look 27% wrong.
  const b = standingBo(148, 882, 1.09956, 110);
  near('Standing Bo for the Volve fluid', b, 1.54, 0.10);
  check('the correlation CONVERTS Rs to scf/stb — the untransformed value is far lower',
    b > 1.35, `got ${b.toFixed(3)}`);
  near('API gravity from the oil density', apiGravity(882), 28.8, 0.5);

  // monotonic in the things it should be monotonic in
  check('more solution gas gives a larger Bo', standingBo(200, 882, 1.1, 110) > b, '');
  check('a hotter reservoir gives a larger Bo', standingBo(148, 882, 1.1, 130) > b, '');
}

// ══ the clean model ═════════════════════════════════════════════════════════
{
  const r = summariseModelQc(auditModel(clean()));
  eq('a clean model has no failures', r.counts.fail, 0);
  eq('…and nothing absent', r.counts.absent, 0);
  eq('…so it is ready for simulation', r.readyForSimulation, true);
  check('the verdict says READY', /^READY/.test(r.verdict), r.verdict);
  check('every section is populated', r.bySection.length === 8, `${r.bySection.length}`);
  check('the sections come in review order, data first and consistency last',
    r.bySection[0].section === 'data' && r.bySection[7].section === 'consistency', '');

  // the Volve deck PVT must pass its own correlation check
  eq('a real deck PVT passes the Standing consistency check',
    find(r.items, 'pvt.correlation').status, 'pass');
  eq('…and is correctly called undersaturated',
    /UNDERSATURATED/.test(find(r.items, 'pvt.saturation').finding), true);
}

// ══ THE CONSISTENCY SECTION — the errors that survive a review ══════════════
{
  // Every discipline's own check passes. The facies model is fine. The petrophysics
  // is fine. But the volume calculation uses the facies code as net-to-gross while
  // the petrophysicist's cutoffs say something different — and nobody's own check
  // catches it.
  const m = clean();
  m.petrophysics.ntgSource = 'binary-facies';
  m.petrophysics.ntgUsed = 0.80;
  const items = auditModel(m);
  eq('facies-as-NTG is a consistency FAILURE, not a note',
    find(items, 'cons.ntg').status, 'fail');
  check('…and the finding names BOTH numbers so the disagreement is visible',
    /0\.80/.test(find(items, 'cons.ntg').finding) && /0\.28/.test(find(items, 'cons.ntg').finding),
    find(items, 'cons.ntg').finding);
  check('…and it says what to do', !!find(items, 'cons.ntg').action, '');
  eq('the facies section itself still passes — which is the whole point',
    find(items, 'facies.proportion').status, 'pass');
  eq('a model with a definition clash is not ready', summariseModelQc(items).readyForSimulation, false);
}
{
  const m = clean();
  m.saturation.modelled = false;
  m.saturation.constantUsed = 0.25;
  const items = auditModel(m);
  eq('an unmodelled Sw fails the property check', find(items, 'sat.property').status, 'fail');
  eq('…AND fails the consistency check, because the volume mixes modelled and assumed terms',
    find(items, 'cons.sw').status, 'fail');
  eq('the constant is compared against the log-derived value it stands in for',
    find(items, 'sat.vs-logs').status, 'pass');

  const m2 = clean();
  m2.saturation.modelled = false; m2.saturation.constantUsed = 0.25; m2.saturation.netSwMean = 0.45;
  eq('…and flags when the constant does not match the logs',
    find(auditModel(m2), 'sat.vs-logs').status, 'flag');
}
{
  const m = clean();
  m.pvt.datumTvdss = 1500;                       // a datum 1.5 km off the contact
  eq('a PVT datum far from the contact is flagged',
    find(auditModel(m), 'cons.datum').status, 'flag');
}

// ══ absent is never pass, and never lets the model through ══════════════════
{
  const m = clean();
  m.saturation.shfPresent = false;
  const items = auditModel(m);
  eq('a missing saturation-height function is ABSENT, not a fail and not a pass',
    find(items, 'sat.shf').status, 'absent');
  check('…and it says what to build', /J-function/.test(find(items, 'sat.shf').action ?? ''), '');

  // AN SHF THAT EXISTS BUT IS NOT WIRED IS A DIFFERENT FINDING.
  //
  // Volve publishes one (Swn = 2.222·J^-1.111) and fluid-model.ts implements it; the
  // static grid just never calls it. Reporting that as "absent" hides finished work
  // and sends someone to rebuild what is already there.
  const unwired = clean();
  unwired.saturation.shfWiredToGrid = false;
  const u = find(auditModel(unwired), 'sat.shf');
  eq('an SHF that exists but is not read by the grid FLAGS, it is not absent', u.status, 'flag');
  check('…and the finding says so explicitly', /NOT WIRED/.test(u.finding), u.finding);
  check('…and the action is to wire it, not to build it',
    /swAtHeight/.test(u.action ?? ''), u.action);
  check('…and the consequence distinguishes a wiring gap from missing science',
    /ignores it/.test(u.consequence ?? ''), u.consequence);
  eq('a wiring gap does not block handover on its own',
    summariseModelQc(auditModel(unwired)).counts.absent, 0);

  const noScal = clean(); noScal.saturation.scalPresent = false;
  eq('a missing SCAL description is absent', find(auditModel(noScal), 'sat.scal').status, 'absent');
  eq('…and a present one passes, naming its source', find(auditModel(clean()), 'sat.scal').status, 'pass');
  const r = summariseModelQc(items);
  eq('an absent artifact still blocks handover', r.readyForSimulation, false);
  check('…and the verdict says CONDITIONAL rather than READY', /CONDITIONAL/.test(r.verdict), r.verdict);

  const noCrs = clean(); noCrs.data.crs = null;
  eq('a missing CRS is absent', find(auditModel(noCrs), 'data.crs').status, 'absent');
  const noRock = clean(); noRock.pvt.rockCf = undefined;
  eq('a missing rock compressibility is absent', find(auditModel(noRock), 'pvt.rock').status, 'absent');
  check('…and says why it matters for an undersaturated reservoir',
    /compressibility/.test(find(auditModel(noRock), 'pvt.rock').consequence ?? ''), '');
}

// ══ Archie constants — textbook where the delivery published its own ═══════
//
// a, m, n and Rw compound multiplicatively. Running defaults over a field that
// published its own evaluation is not an approximation; on Volve it put the median
// Sw at 1.000 and the net-pay cutoff then discarded most of the reservoir.
{
  eq('published Archie constants pass', find(auditModel(clean()), 'petro.archie').status, 'pass');
  const d = clean();
  d.petrophysics.archieSource = 'default';
  d.petrophysics.archie = { a: 1, m: 2, n: 2, rw: 0.03 };
  const it = find(auditModel(d), 'petro.archie');
  eq('textbook constants FAIL when the delivery publishes its own', it.status, 'fail');
  check('…and the finding says TEXTBOOK', /TEXTBOOK/.test(it.finding), it.finding);
  check('…and names the resolver to call', /resolvePublishedArchie/.test(it.action ?? ''), it.action);
  check('…and the consequence reaches the net-pay cutoff',
    /cutoff/.test(it.consequence ?? ''), it.consequence);

  const none = clean(); delete none.petrophysics.archieSource;
  eq('a model that does not declare its Archie source raises no check at all',
    find(auditModel(none), 'petro.archie'), undefined);
}

// ══ THE DEPTH DATUM — the error that hides because it is uniform ═══════════
//
// A survey's TVD is below the kelly bushing; a grid, a contact and a pick are below
// sea level. On Volve the gap was a flat 54.9 m, which displaced every well equally,
// so the structure still tied and the petrophysics still looked right while F-14's
// whole Hugin fell out of the bottom of the grid.
{
  eq('a reconciled datum passes', find(auditModel(clean()), 'data.datum').status, 'pass');
  check('…and quotes the residual and the pick count',
    /0\.84 m over 52 picks/.test(find(auditModel(clean()), 'data.datum').finding),
    find(auditModel(clean()), 'data.datum').finding);

  const noKb = clean();
  noKb.data.datum = { n: 52, meanAbsErrM: 54.9, kbApplied: false };
  const it = find(auditModel(noKb), 'data.datum');
  eq('using survey TVD as TVDSS is a FAIL, not a flag', it.status, 'fail');
  check('…and says the rig floor was never subtracted', /NOT subtracted/.test(it.finding), it.finding);
  check('…and names the fix', /kb/.test(it.action ?? ''), it.action);
  check('…and explains why nothing ELSE fails', /uniformly/.test(it.consequence ?? ''), it.consequence);
  eq('a model on the wrong datum is not ready', summariseModelQc(auditModel(noKb)).readyForSimulation, false);

  const drift = clean();
  drift.data.datum = { n: 52, meanAbsErrM: 22.5, kbApplied: true, worstWell: 'F-15 A', worstErrM: 599 };
  eq('a large residual fails even when the KB WAS applied — a broken survey is still broken',
    find(auditModel(drift), 'data.datum').status, 'fail');
  check('…and names the offending well', /F-15 A/.test(find(auditModel(drift), 'data.datum').finding),
    find(auditModel(drift), 'data.datum').finding);

  const none = clean(); delete none.data.datum;
  eq('a model that cannot reconcile its datum raises no check rather than a false pass',
    find(auditModel(none), 'data.datum'), undefined);
}

// ══ geometry failures stop the model dead ══════════════════════════════════
{
  const neg = clean(); neg.geometry.negativeCells = 4760;
  eq('negative-volume cells FAIL', find(auditModel(neg), 'geom.negative').status, 'fail');
  const ord = clean(); ord.geometry.orderDefects = 119;
  eq('inverted zone order FAILS', find(auditModel(ord), 'geom.stacking').status, 'fail');
  const pinch = clean(); pinch.geometry.pinchCells = 460;
  eq('pinch-outs only flag — thin geology is real', find(auditModel(pinch), 'geom.pinch').status, 'flag');
  const unf = clean(); unf.geometry.unfaulted = true;
  eq('an unfaulted grid flags', find(auditModel(unf), 'geom.faults').status, 'flag');
  const iso = clean(); iso.geometry.bodies = 4;
  eq('disconnected bodies flag', find(auditModel(iso), 'geom.bodies').status, 'flag');
}

// ══ the repair must appear on the sheet ════════════════════════════════════
{
  const m = clean();
  m.geometry.repairedColumns = 476; m.geometry.repairAddedFraction = 0.05;
  const it = find(auditModel(m), 'geom.repair');
  eq('a large structural repair is flagged, not hidden', it.status, 'flag');
  check('…and quotes the volume it invented', /5\.00%/.test(it.finding), it.finding);
  check('…and says it belongs in the STOIIP uncertainty',
    /uncertainty/.test(it.consequence ?? ''), it.consequence);
}

// ══ net vs gross porosity — the check a petrophysicist runs first ══════════
{
  const m = clean();
  m.petrophysics.upscaledPhiMean = 0.128;        // gross block average
  m.petrophysics.netPhiMean = 0.232;             // what the logs say about net rock
  const items = auditModel(m);
  eq('a gross block average against a net figure is flagged', find(items, 'petro.net').status, 'flag');
  check('…and the consequence names the double count',
    /twice/.test(find(items, 'petro.net').consequence ?? ''), '');
  eq('and the published comparison uses NET porosity, so it does not report a false 2× error',
    find(items, 'petro.published').status, 'pass');
}

// ══ permeability ══════════════════════════════════════════════════════════
{
  const m = clean();
  m.permeability.cappedCells = 60000;            // 39%
  eq('heavy capping FAILS', find(auditModel(m), 'perm.range').status, 'fail');
  const light = clean(); light.permeability.cappedCells = 700;   // 0.46%
  eq('light capping flags', find(auditModel(light), 'perm.range').status, 'flag');

  const nokv = clean(); nokv.permeability.hasPermZ = false;
  eq('no PERMZ FAILS — vertical flow is unmodellable', find(auditModel(nokv), 'perm.kv').status, 'fail');
  const assumed = clean(); assumed.permeability.kvkhSource = 'assumed';
  eq('an assumed kv/kh flags', find(auditModel(assumed), 'perm.kv').status, 'flag');

  const it = find(auditModel(clean()), 'perm.average');
  check('the averaging check states BOTH means and the factor between them',
    /geometric/.test(it.finding) && /arithmetic/.test(it.finding) && /4/.test(it.finding), it.finding);
}

// ══ every non-passing item must say why it matters ════════════════════════
{
  const broken = clean();
  broken.saturation.modelled = false; broken.saturation.constantUsed = 0.25;
  broken.saturation.shfPresent = false;
  broken.petrophysics.ntgSource = 'binary-facies';
  broken.geometry.negativeCells = 10;
  const items = auditModel(broken);
  const silent = items.filter((i) => (i.status === 'fail' || i.status === 'absent') && !i.consequence);
  eq('no failure or absence is left without a stated consequence', silent.map((i) => i.id), []);
  const r = summariseModelQc(items);
  check('a failing model says NOT READY', /NOT READY/.test(r.verdict), r.verdict);
  check('and counts add up to the item total',
    r.counts.pass + r.counts.flag + r.counts.fail + r.counts.absent + r.counts['n/a'] === items.length, '');
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
